// api-gateway/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

// Shared registry (file-based)
const serviceRegistry = require('../shared/serviceRegistry');

class APIGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;

        // Circuit Breaker { [serviceName]: { failures, isOpen, isHalfOpen, lastFailure } }
        this.circuitBreakers = new Map();

        // Mapa de rotas -> serviços e prefixos a remover
        this.routeTable = [
            { prefix: '/api/auth',   service: 'user-service', strip: '/api/auth',   forwardBase: '/auth'  },
            { prefix: '/api/users',  service: 'user-service', strip: '/api/users',  forwardBase: '/users' },
            { prefix: '/api/items',  service: 'item-service', strip: '/api/items',  forwardBase: '/items' },
            { prefix: '/api/lists',  service: 'list-service', strip: '/api/lists',  forwardBase: '/lists' },
        ];

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();

        // Aguardamos alguns segundos para os serviços registrarem e iniciamos os health checks
        setTimeout(() => this.startHealthChecks(), 3000);
    }

    // ========= Middleware =========
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Headers informativos do gateway
        this.app.use((req, res, next) => {
            res.setHeader('X-Gateway', 'api-gateway');
            res.setHeader('X-Gateway-Version', '1.0.0');
            res.setHeader('X-Architecture', 'Microservices-NoSQL');
            next();
        });

        // Log simpático
        this.app.use((req, _res, next) => {
            console.log(`➡️  ${req.method} ${req.originalUrl}`);
            next();
        });
    }

    // ========= Rotas =========
    setupRoutes() {
        // Health do gateway + status de serviços
        this.app.get('/health', (_req, res) => {
            const services = serviceRegistry.listServices();
            res.json({
                service: 'api-gateway',
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services,
                serviceCount: Object.keys(services).length,
            });
        });

        // Lista conteúdo do registry (arquivo compartilhado)
        this.app.get('/registry', (_req, res) => {
            const services = serviceRegistry.listServices();
            res.json({ success: true, services, count: Object.keys(services).length });
        });

        // Página de informação do gateway
        this.app.get('/', (_req, res) => {
            res.json({
                service: 'API Gateway',
                version: '1.0.0',
                description: 'Gateway para microsserviços (User, Item, List)',
                routes: {
                    auth: '/api/auth/*  → user-service',
                    users: '/api/users/* → user-service',
                    items: '/api/items/* → item-service',
                    lists: '/api/lists/* → list-service',
                },
                aggregated: ['/api/dashboard', '/api/search?q=...'],
                health: '/health',
                registry: '/registry',
            });
        });

        // ---------- Proxy genérico baseado na tabela ----------
        for (const entry of this.routeTable) {
            this.app.use(entry.prefix, (req, res, next) => this.proxyByEntry(entry, req, res, next));
        }

        // ---------- Endpoints Agregados ----------
        this.app.get('/api/dashboard', (req, res) => this.getDashboard(req, res));
        this.app.get('/api/search', (req, res) => this.globalSearch(req, res));
    }

    setupErrorHandling() {
        // 404 - rota não encontrada
        this.app.use('*', (_req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                service: 'api-gateway',
                availableEndpoints: {
                    auth: '/api/auth/*',
                    users: '/api/users/*',
                    items: '/api/items/*',
                    lists: '/api/lists/*',
                    dashboard: '/api/dashboard',
                    search: '/api/search?q=termo',
                    health: '/health',
                    registry: '/registry'
                }
            });
        });

        // Error handler (precisa ter 4 parâmetros)
        this.app.use((err, _req, res, _next) => {
            console.error('Gateway Error:', err);
            const status = err.status || 500;
            res.status(status).json({
                success: false,
                message: status === 500 ? 'Erro interno do gateway' : (err.message || 'Erro no gateway'),
                service: 'api-gateway'
            });
        });
    }


    // ========= Proxy =========
    async proxyByEntry(entry, req, res, _next) {
        const serviceName = entry.service;

        try {
            // Circuit breaker
            if (this.isCircuitOpen(serviceName)) {
                return res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} temporariamente indisponível`,
                    service: serviceName,
                });
            }

            // Descobrir URL do serviço
            let service;
            try {
                service = serviceRegistry.discover(serviceName);
            } catch (err) {
                const available = Object.keys(serviceRegistry.listServices());
                return res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} não encontrado`,
                    availableServices: available,
                });
            }

            // Reescrever caminho: remove prefixo /api/... e aplica base correta do serviço
            // Ex.: /api/items/123  -> /items/123
            //     /api/auth/login -> /auth/login
            let suffix = req.originalUrl.replace(entry.strip, '');
            if (!suffix.startsWith('/')) suffix = '/' + suffix;
            if (suffix === '/' || suffix === '') suffix = ''; // virar base pura
            const targetPath = `${entry.forwardBase}${suffix}`;
            const targetUrl = `${service.url}${targetPath}`;

            // Montar request
            const config = {
                method: req.method,
                url: targetUrl,
                headers: { ...req.headers },
                timeout: 10000,
                family: 4,
                validateStatus: (status) => status < 500, // deixa 4xx passar
            };

            // Body e query
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) config.data = req.body;
            if (Object.keys(req.query).length > 0) config.params = req.query;

            // Headers problemáticos
            delete config.headers.host;
            delete config.headers['content-length'];

            const response = await axios(config);

            // Sucesso → reset no breaker
            this.resetCircuitBreaker(serviceName);

            return res.status(response.status).json(response.data);
        } catch (error) {
            // Falha → computa no breaker
            this.recordFailure(serviceName);

            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                return res.status(503).json({
                    success: false,
                    message: `Serviço ${serviceName} indisponível`,
                    service: serviceName,
                    error: error.code,
                });
            }

            if (error.response) {
                return res.status(error.response.status).json(error.response.data);
            }

            return res.status(500).json({
                success: false,
                message: 'Erro interno do gateway',
                service: 'api-gateway',
                error: error.message,
            });
        }
    }

    // ========= Circuit Breaker =========
    isCircuitOpen(serviceName) {
        const b = this.circuitBreakers.get(serviceName);
        if (!b) return false;

        const now = Date.now();
        // meio-aberto após 30s
        if (b.isOpen && now - b.lastFailure > 30000) {
            b.isOpen = false;
            b.isHalfOpen = true;
            console.log(`⚠️  Circuit half-open for ${serviceName}`);
            return false;
        }
        return b.isOpen;
    }

    recordFailure(serviceName) {
        const b = this.circuitBreakers.get(serviceName) || {
            failures: 0,
            isOpen: false,
            isHalfOpen: false,
            lastFailure: 0,
        };
        b.failures += 1;
        b.lastFailure = Date.now();
        if (b.failures >= 3) {
            b.isOpen = true;
            b.isHalfOpen = false;
            console.log(`🛑 Circuit opened for ${serviceName}`);
        }
        this.circuitBreakers.set(serviceName, b);
    }

    resetCircuitBreaker(serviceName) {
        const b = this.circuitBreakers.get(serviceName);
        if (b) {
            b.failures = 0;
            b.isOpen = false;
            b.isHalfOpen = false;
            console.log(`✅ Circuit reset for ${serviceName}`);
        }
    }

    // ========= Helpers para chamadas agregadas =========
    discover(serviceName) {
        return serviceRegistry.discover(serviceName); // lança se não encontrado
    }

    async callService(serviceName, path, method = 'GET', authHeader = null, params = {}, data = null) {
        const svc = this.discover(serviceName);
        const config = {
            method,
            url: `${svc.url}${path}`,
            timeout: 10000,
            family: 4,
            validateStatus: (s) => s < 500,
        };
        if (authHeader) config.headers = { Authorization: authHeader };
        if (method === 'GET' && Object.keys(params).length) config.params = params;
        if (['POST', 'PUT', 'PATCH'].includes(method) && data) config.data = data;
        const resp = await axios(config);
        return resp.data;
    }

    // ========= /api/dashboard =========
    // Agrega algumas estatísticas do usuário autenticado:
    // - listas do usuário + resumo agregado
    // - amostra de itens e categorias
    async getDashboard(req, res) {
        try {
            const authHeader = req.header('Authorization');
            if (!authHeader) {
                return res.status(401).json({ success: false, message: 'Token de autenticação obrigatório' });
            }

            const [listsRes, itemsRes, catsRes] = await Promise.allSettled([
                this.callService('list-service', '/lists', 'GET', authHeader, { limit: 50 }),
                this.callService('item-service', '/items', 'GET', null, { limit: 10 }),
                this.callService('item-service', '/categories', 'GET'),
            ]);

            const lists = listsRes.status === 'fulfilled' ? listsRes.value.data || listsRes.value : [];// compat
            const items = itemsRes.status === 'fulfilled' ? itemsRes.value.data || itemsRes.value : [];
            const categories = catsRes.status === 'fulfilled' ? catsRes.value.data || catsRes.value : [];

            // Resumo global das listas (somatório dos summaries individuais)
            let totalLists = 0, totalItems = 0, purchasedItems = 0, estimatedTotal = 0;
            if (Array.isArray(lists)) {
                totalLists = lists.length;
                for (const l of lists) {
                    const s = l.summary || { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 };
                    totalItems += Number(s.totalItems) || 0;
                    purchasedItems += Number(s.purchasedItems) || 0;
                    estimatedTotal += Number(s.estimatedTotal) || 0;
                }
            }

            res.json({
                success: true,
                data: {
                    timestamp: new Date().toISOString(),
                    services: serviceRegistry.listServices(),
                    lists: {
                        totalLists,
                        totalItems,
                        purchasedItems,
                        estimatedTotal: Number(estimatedTotal.toFixed(2)),
                        sample: lists.slice(0, 5),
                    },
                    catalog: {
                        sampleItems: items.slice ? items.slice(0, 5) : items,
                        categories,
                    },
                },
            });
        } catch (err) {
            console.error('Dashboard error:', err.message);
            res.status(500).json({ success: false, message: 'Erro ao agregar dashboard' });
        }
    }

    // ========= /api/search =========
    // Busca global em Itens (Item Service) e em Listas do usuário (List Service)
    // Para listas, como não há endpoint de busca dedicado, buscamos todas e filtramos por nome da lista
    // e por nome de itens cacheados dentro da lista.
    async globalSearch(req, res) {
        try {
            const { q } = req.query;
            if (!q) {
                return res.status(400).json({ success: false, message: 'Parâmetro "q" é obrigatório' });
            }

            const authHeader = req.header('Authorization') || null;

            const searches = [
                this.callService('item-service', '/search', 'GET', null, { q }),
            ];

            // Se autenticado, consultar listas do usuário e filtrar no gateway
            if (authHeader) {
                searches.push(this.callService('list-service', '/lists', 'GET', authHeader, { limit: 100 }));
            }

            const [itemsRes, listsRes] = await Promise.allSettled(searches);

            const itemResults = itemsRes.status === 'fulfilled'
                ? (itemsRes.value?.data?.results || itemsRes.value?.data || itemsRes.value?.results || [])
                : [];

            let listMatches = [];
            if (listsRes && listsRes.status === 'fulfilled') {
                const lists = Array.isArray(listsRes.value?.data) ? listsRes.value.data : listsRes.value;
                const term = String(q).toLowerCase();
                listMatches = (lists || []).filter(l => {
                    const nameHit = (l.name || '').toLowerCase().includes(term);
                    const itemHit = (l.items || []).some(it => (it.itemName || '').toLowerCase().includes(term));
                    return nameHit || itemHit;
                });
            }

            res.json({
                success: true,
                data: {
                    query: q,
                    items: { total: itemResults.length, results: itemResults.slice(0, 20) },
                    lists: { total: listMatches.length, results: listMatches.slice(0, 10) },
                },
            });
        } catch (err) {
            console.error('Global search error:', err.message);
            res.status(500).json({ success: false, message: 'Erro na busca global' });
        }
    }

    // ========= Health checks (registry) =========
    startHealthChecks() {
        // Executa a cada 30s
        setInterval(async () => {
            try {
                await serviceRegistry.performHealthChecks();
            } catch (e) {
                console.error('Health check loop error:', e.message);
            }
        }, 30000);

        // Primeira rodada
        setTimeout(async () => {
            try {
                await serviceRegistry.performHealthChecks();
            } catch (e) {
                console.error('Initial health check error:', e.message);
            }
        }, 5000);
    }

    // ========= Boot =========
    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`API Gateway iniciado na porta ${this.port}`);
            console.log(`URL: http://localhost:${this.port}`);
            console.log(`Health:  GET /health`);
            console.log(`Registry: GET /registry`);
            console.log(`Routes: 
  /api/auth/*  → user-service (/auth/*)
  /api/users/* → user-service (/users/*)
  /api/items/* → item-service (/items/*)
  /api/lists/* → list-service (/lists/*)
  Aggregated:
  GET /api/dashboard
  GET /api/search?q=...`);
            console.log('=====================================');
        });
    }
}

// Start gateway
if (require.main === module) {
    const gateway = new APIGateway();
    gateway.start();

    // Graceful shutdown
    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
}

module.exports = APIGateway;
