const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Shared
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

class ItemService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3003;
        this.serviceName = 'item-service';
        this.serviceUrl = `http://localhost:${this.port}`;

        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupDatabase() {
        const dbPath = path.join(__dirname, 'database');
        this.itemsDb = new JsonDatabase(dbPath, 'items');
        console.log('[Item Service] Banco NoSQL inicializado');
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Info
        this.app.use((req, res, next) => {
            res.setHeader('X-Service', this.serviceName);
            res.setHeader('X-Service-Version', '1.0.0');
            res.setHeader('X-Database', 'JSON-NoSQL');
            next();
        });
    }

    // --- Auth (apenas para criação/atualização) ---
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

    // --- Rotas ---
    setupRoutes() {
        // Health
        this.app.get('/health', async (req, res) => {
            try {
                const count = await this.itemsDb.count();
                res.json({
                    service: this.serviceName,
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    database: { type: 'JSON-NoSQL', itemCount: count },
                });
            } catch (e) {
                res.status(503).json({ service: this.serviceName, status: 'unhealthy', error: e.message });
            }
        });

        // Root info
        this.app.get('/', (req, res) => {
            res.json({
                service: 'Item Service',
                version: '1.0.0',
                description: 'Catálogo de itens/produtos',
                endpoints: [
                    'GET /items',
                    'GET /items/:id',
                    'POST /items',
                    'PUT /items/:id',
                    'GET /categories',
                    'GET /search?q=termo'
                ]
            });
        });

        /**
         * GET /items
         * Filtros: ?category=...&name=...
         * Paginação opcional: ?page=1&limit=20
         */
        this.app.get('/items', async (req, res) => {
            try {
                const { category, name, page = 1, limit = 20 } = req.query;
                const filter = { active: true };

                if (category) filter.category = category;
                if (name) filter.name = { $regex: name, $options: 'i' };

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const items = await this.itemsDb.find(filter, {
                    skip,
                    limit: parseInt(limit),
                    sort: { createdAt: -1 }
                });
                const total = await this.itemsDb.count(filter);

                res.json({
                    success: true,
                    data: items,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    }
                });
            } catch (err) {
                console.error('[Item Service] GET /items error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        /**
         * GET /items/:id
         */
        this.app.get('/items/:id', async (req, res) => {
            try {
                const item = await this.itemsDb.findById(req.params.id);
                if (!item) {
                    return res.status(404).json({ success: false, message: 'Item não encontrado' });
                }
                res.json({ success: true, data: item });
            } catch (err) {
                console.error('[Item Service] GET /items/:id error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        /**
         * POST /items  (requer autenticação)
         * Body: name, category, brand, unit, averagePrice, barcode, description, active
         */
        this.app.post('/items', this.authMiddleware, async (req, res) => {
            try {
                const {
                    name, category, brand, unit,
                    averagePrice, barcode, description,
                    active = true
                } = req.body;

                // validação simples
                if (!name || !category || !unit) {
                    return res.status(400).json({ success: false, message: 'name, category e unit são obrigatórios' });
                }

                const newItem = await this.itemsDb.create({
                    id: uuidv4(),
                    name,
                    category,
                    brand: brand || null,
                    unit, // "kg", "un", "litro"
                    averagePrice: typeof averagePrice === 'number' ? averagePrice : null,
                    barcode: barcode || null,
                    description: description || null,
                    active: Boolean(active),
                });

                res.status(201).json({ success: true, message: 'Item criado', data: newItem });
            } catch (err) {
                console.error('[Item Service] POST /items error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        /**
         * PUT /items/:id  (requer autenticação também — mais seguro)
         */
        this.app.put('/items/:id', this.authMiddleware, async (req, res) => {
            try {
                const updates = {};
                const allowed = ['name','category','brand','unit','averagePrice','barcode','description','active'];
                for (const k of allowed) {
                    if (req.body[k] !== undefined) updates[k] = req.body[k];
                }

                const updated = await this.itemsDb.update(req.params.id, updates);
                if (!updated) {
                    return res.status(404).json({ success: false, message: 'Item não encontrado' });
                }
                res.json({ success: true, message: 'Item atualizado', data: updated });
            } catch (err) {
                console.error('[Item Service] PUT /items/:id error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        /**
         * GET /categories
         * Lista categorias distintas
         */
        this.app.get('/categories', async (_req, res) => {
            try {
                const all = await this.itemsDb.find();
                const categories = [...new Set(all.map(i => i.category).filter(Boolean))].sort();
                res.json({ success: true, data: categories });
            } catch (err) {
                console.error('[Item Service] GET /categories error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });

        /**
         * GET /search?q=termo
         * Busca por nome (full-text simples no JsonDatabase)
         */
        this.app.get('/search', async (req, res) => {
            try {
                const { q, limit = 20 } = req.query;
                if (!q) {
                    return res.status(400).json({ success: false, message: 'Parâmetro "q" é obrigatório' });
                }
                const results = await this.itemsDb.search(q, ['name']);
                const activeOnly = results.filter(r => r.active !== false).slice(0, parseInt(limit));
                res.json({ success: true, data: { query: q, results: activeOnly, total: activeOnly.length } });
            } catch (err) {
                console.error('[Item Service] GET /search error:', err);
                res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
        });
    }

    setupErrorHandling() {
        this.app.use('*', (_req, res) => {
            res.status(404).json({ success: false, message: 'Endpoint não encontrado', service: this.serviceName });
        });

        this.app.use((err, _req, res, _next) => {
            console.error('[Item Service] error middleware:', err);
            res.status(500).json({ success: false, message: 'Erro interno do serviço' });
        });
    }

    registerWithRegistry() {
        serviceRegistry.register(this.serviceName, {
            url: this.serviceUrl,
            version: '1.0.0',
            database: 'JSON-NoSQL',
            endpoints: ['/health','/items','/items/:id','/categories','/search']
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
            console.log(`Item Service na porta ${this.port}`);
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
    const itemService = new ItemService();
    itemService.start();

    // Graceful shutdown
    process.on('SIGTERM', () => {
        serviceRegistry.unregister('item-service');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        serviceRegistry.unregister('item-service');
        process.exit(0);
    });
}

module.exports = ItemService;
