// services/list-service/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Shared
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ListService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3002;
        this.serviceName = 'list-service';
        this.serviceUrl = `http://localhost:${this.port}`;

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupDatabase() {
        const dbPath = path.join(__dirname, 'database');
        this.listsDb = new JsonDatabase(dbPath, 'lists');
        console.log('[List Service] Banco NoSQL inicializado');
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Headers informativos
        this.app.use((req, res, next) => {
            res.setHeader('X-Service', this.serviceName);
            res.setHeader('X-Service-Version', '1.0.0');
            res.setHeader('X-Database', 'JSON-NoSQL');
            next();
        });
    }

    // ==== AUTH (todas as rotas de lista exigem token) ====
    authMiddleware = (req, res, next) => {
        const authHeader = req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token obrigatório' });
        }
        const token = authHeader.replace('Bearer ', '');
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'user-secret');
            req.user = decoded;
            return next();
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Token inválido' });
        }
    };

    // ==== HELPERS ====
    async discoverItemServiceBaseUrl() {
        const svc = serviceRegistry.discover('item-service'); // lança erro se indisponível
        return svc.url;
    }

    async fetchItemById(itemId) {
        const base = await this.discoverItemServiceBaseUrl();
        const { data } = await axios.get(`${base}/items/${itemId}`, { timeout: 5000 });
        if (!data?.success) throw new Error('Item Service retornou formato inesperado');
        return data.data;
    }

    ensureOwnership(list, userId) {
        if (!list || list.userId !== userId) {
            const err = new Error('Não encontrado ou sem permissão');
            err.status = 404;
            throw err;
        }
    }

    recalcSummary(list) {
        const totalItems = list.items.length;
        const purchasedItems = list.items.filter(i => i.purchased).length;
        const estimatedTotal = list.items.reduce((acc, it) => {
            const q = Number(it.quantity) || 0;
            const p = Number(it.estimatedPrice) || 0;
            return acc + q * p;
        }, 0);
        list.summary = { totalItems, purchasedItems, estimatedTotal: Number(estimatedTotal.toFixed(2)) };
        return list.summary;
    }

    // ==== ROTAS ====
    setupRoutes() {
        // Health
        this.app.get('/health', async (_req, res) => {
            try {
                const count = await this.listsDb.count();
                res.json({
                    service: this.serviceName,
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    database: { type: 'JSON-NoSQL', listCount: count },
                });
            } catch (e) {
                res.status(503).json({ service: this.serviceName, status: 'unhealthy', error: e.message });
            }
        });

        // Root info
        this.app.get('/', (_req, res) => {
            res.json({
                service: 'List Service',
                version: '1.0.0',
                description: 'Gerenciamento de listas de compras',
                endpoints: [
                    'POST /lists',
                    'GET /lists',
                    'GET /lists/:id',
                    'PUT /lists/:id',
                    'DELETE /lists/:id',
                    'POST /lists/:id/items',
                    'PUT /lists/:id/items/:itemId',
                    'DELETE /lists/:id/items/:itemId',
                    'GET /lists/:id/summary',
                ],
            });
        });

        // ---- Criar nova lista ----
        this.app.post('/lists', this.authMiddleware, async (req, res) => {
            try {
                const { name, description } = req.body;
                if (!name) {
                    return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
                }

                const newList = await this.listsDb.create({
                    id: uuidv4(),
                    userId: req.user.id,
                    name,
                    description: description || null,
                    status: 'active',
                    items: [],
                    summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
                });

                res.status(201).json({ success: true, message: 'Lista criada', data: newList });
            } catch (err) {
                console.error('[List Service] POST /lists error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        // ---- Listar listas do usuário ----
        this.app.get('/lists', this.authMiddleware, async (req, res) => {
            try {
                const { page = 1, limit = 20, status } = req.query;
                const filter = { userId: req.user.id };
                if (status) filter.status = status;

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const lists = await this.listsDb.find(filter, {
                    skip,
                    limit: parseInt(limit),
                    sort: { updatedAt: -1 },
                });
                const total = await this.listsDb.count(filter);

                res.json({
                    success: true,
                    data: lists,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit)),
                    },
                });
            } catch (err) {
                console.error('[List Service] GET /lists error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        // ---- Buscar lista específica ----
        this.app.get('/lists/:id', this.authMiddleware, async (req, res) => {
            try {
                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);
                res.json({ success: true, data: list });
            } catch (err) {
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });

        // ---- Atualizar lista (nome, descrição, status) ----
        this.app.put('/lists/:id', this.authMiddleware, async (req, res) => {
            try {
                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);

                const updates = {};
                if (req.body.name !== undefined) updates.name = req.body.name;
                if (req.body.description !== undefined) updates.description = req.body.description;
                if (req.body.status !== undefined) {
                    const allowed = ['active', 'completed', 'archived'];
                    if (!allowed.includes(req.body.status)) {
                        return res.status(400).json({ success: false, message: 'Status inválido' });
                    }
                    updates.status = req.body.status;
                }

                const updated = await this.listsDb.update(list.id, updates);
                res.json({ success: true, message: 'Lista atualizada', data: updated });
            } catch (err) {
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });

        // ---- Deletar lista ----
        this.app.delete('/lists/:id', this.authMiddleware, async (req, res) => {
            try {
                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);
                await this.listsDb.delete(list.id);
                res.json({ success: true, message: 'Lista deletada' });
            } catch (err) {
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });

        // ---- Adicionar item à lista ----
        this.app.post('/lists/:id/items', this.authMiddleware, async (req, res) => {
            try {
                const { itemId, quantity, unit, estimatedPrice, notes } = req.body;
                if (!itemId || quantity === undefined) {
                    return res.status(400).json({ success: false, message: 'itemId e quantity são obrigatórios' });
                }

                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);

                // buscar dados do Item Service (nome, unit/averagePrice defaults)
                const item = await this.fetchItemById(itemId);

                const entry = {
                    itemId: itemId,
                    itemName: item.name,            // cache do nome
                    quantity: Number(quantity) || 0,
                    unit: unit || item.unit || 'un',
                    estimatedPrice: estimatedPrice !== undefined
                        ? Number(estimatedPrice) || 0
                        : (Number(item.averagePrice) || 0),
                    purchased: false,
                    notes: notes || null,
                    addedAt: new Date().toISOString(),
                };

                list.items.push(entry);
                this.recalcSummary(list);

                const updated = await this.listsDb.update(list.id, {
                    items: list.items,
                    summary: list.summary,
                });

                res.status(201).json({ success: true, message: 'Item adicionado à lista', data: updated });
            } catch (err) {
                if (axios.isAxiosError?.(err)) {
                    return res.status(502).json({ success: false, message: 'Falha ao consultar Item Service' });
                }
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });

        // ---- Atualizar item da lista ----
        this.app.put('/lists/:id/items/:itemId', this.authMiddleware, async (req, res) => {
            try {
                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);

                const idx = list.items.findIndex(i => i.itemId === req.params.itemId);
                if (idx === -1) {
                    return res.status(404).json({ success: false, message: 'Item não encontrado na lista' });
                }

                const allowed = ['quantity', 'unit', 'estimatedPrice', 'purchased', 'notes', 'itemName'];
                for (const k of allowed) {
                    if (req.body[k] !== undefined) {
                        // normalizações
                        if (k === 'quantity' || k === 'estimatedPrice') {
                            list.items[idx][k] = Number(req.body[k]) || 0;
                        } else if (k === 'purchased') {
                            list.items[idx][k] = Boolean(req.body[k]);
                        } else {
                            list.items[idx][k] = req.body[k];
                        }
                    }
                }

                this.recalcSummary(list);
                const updated = await this.listsDb.update(list.id, {
                    items: list.items,
                    summary: list.summary,
                });

                res.json({ success: true, message: 'Item atualizado', data: updated });
            } catch (err) {
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });

        // ---- Remover item da lista ----
        this.app.delete('/lists/:id/items/:itemId', this.authMiddleware, async (req, res) => {
            try {
                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);

                const before = list.items.length;
                list.items = list.items.filter(i => i.itemId !== req.params.itemId);
                if (list.items.length === before) {
                    return res.status(404).json({ success: false, message: 'Item não encontrado na lista' });
                }

                this.recalcSummary(list);
                const updated = await this.listsDb.update(list.id, {
                    items: list.items,
                    summary: list.summary,
                });

                res.json({ success: true, message: 'Item removido', data: updated });
            } catch (err) {
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });

        // ---- Resumo da lista ----
        this.app.get('/lists/:id/summary', this.authMiddleware, async (req, res) => {
            try {
                const list = await this.listsDb.findById(req.params.id);
                this.ensureOwnership(list, req.user.id);

                const summary = this.recalcSummary(list);
                // Persistir o summary recalculado (mantém coerência)
                await this.listsDb.update(list.id, { summary });

                res.json({ success: true, data: summary });
            } catch (err) {
                const status = err.status || 500;
                res.status(status).json({ success: false, message: status === 404 ? 'Lista não encontrada' : 'Erro interno do servidor' });
            }
        });
    }

    setupErrorHandling() {
        this.app.use('*', (_req, res) => {
            res.status(404).json({ success: false, message: 'Endpoint não encontrado', service: this.serviceName });
        });

        this.app.use((err, _req, res, _next) => {
            console.error('[List Service] error middleware:', err);
            res.status(500).json({ success: false, message: 'Erro interno do serviço' });
        });
    }

    registerWithRegistry() {
        serviceRegistry.register(this.serviceName, {
            url: this.serviceUrl,
            version: '1.0.0',
            database: 'JSON-NoSQL',
            endpoints: [
                '/health',
                '/lists',
                '/lists/:id',
                '/lists/:id/items',
                '/lists/:id/items/:itemId',
                '/lists/:id/summary'
            ],
        });
    }

    startHealthReporting() {
        setInterval(() => {
            serviceRegistry.updateHealth(this.serviceName, true);
        }, 30000);
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('=====================================');
            console.log(`List Service na porta ${this.port}`);
            console.log(`URL: ${this.serviceUrl}`);
            console.log(`Health: ${this.serviceUrl}/health`);
            console.log('=====================================');

            this.registerWithRegistry();
            this.startHealthReporting();
        });
    }
}

// Boot
if (require.main === module) {
    const listService = new ListService();
    listService.start();

    // Graceful shutdown
    process.on('SIGTERM', () => {
        serviceRegistry.unregister('list-service');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        serviceRegistry.unregister('list-service');
        process.exit(0);
    });
}

module.exports = ListService;
