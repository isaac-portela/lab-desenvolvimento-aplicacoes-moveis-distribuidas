// client-demo.js (versão estendida)
const axios = require('axios');

class MicroservicesClient {
    constructor(gatewayUrl = 'http://127.0.0.1:3000') {
        this.gatewayUrl = gatewayUrl;
        this.authToken = null;
        this.user = null;

        this.api = axios.create({
            baseURL: gatewayUrl,
            timeout: 10000,
            family: 4, // força IPv4
        });

        // Injeta Bearer automaticamente
        this.api.interceptors.request.use((config) => {
            if (this.authToken) {
                config.headers.Authorization = `Bearer ${this.authToken}`;
            }
            return config;
        });

        // Log de erros
        this.api.interceptors.response.use(
            (res) => res,
            (error) => {
                console.error('Erro na requisição:', {
                    url: error.config?.url,
                    method: error.config?.method,
                    status: error.response?.status,
                    message: error.response?.data?.message || error.message,
                });
                return Promise.reject(error);
            }
        );
    }

    // ===================== AUTH =====================
    async register({ email, username, password, firstName, lastName }) {
        try {
            console.log('\n📦 Registrando usuário...');
            const { data } = await this.api.post('/api/auth/register', {
                email, username, password, firstName, lastName,
            });
            if (!data?.success) throw new Error(data?.message || 'Falha no registro');
            this.authToken = data.data.token;
            this.user = data.data.user;
            console.log(`✅ Usuário registrado: @${this.user.username}`);
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            console.log('❌ Erro no registro:', msg);
            throw err;
        }
    }

    async login({ identifier, password }) {
        try {
            console.log('\n🔐 Fazendo login...');
            const { data } = await this.api.post('/api/auth/login', { identifier, password });
            if (!data?.success) throw new Error(data?.message || 'Falha no login');
            this.authToken = data.data.token;
            this.user = data.data.user;
            console.log(`✅ Login ok: @${this.user.username}`);
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            console.log('❌ Erro no login:', msg);
            throw err;
        }
    }

    ensureAuth() {
        if (!this.authToken) throw new Error('Token de autenticação ausente. Faça login/registro antes.');
    }

    // ===================== ITENS =====================
    async getItems(filters = {}) {
        try {
            console.log('\n🛒 Buscando itens...');
            const { data } = await this.api.get('/api/items', { params: filters });
            if (!data?.success) return [];
            const items = data.data || [];
            console.log(`✅ ${items.length} itens encontrados`);
            items.slice(0, 10).forEach((it, idx) => {
                console.log(
                    `  ${idx + 1}. ${it.name} (${it.category}) • ${it.unit}` +
                    ` • preço médio: ${it.averagePrice ?? '-'} • id: ${it.id}`
                );
            });
            return items;
        } catch (err) {
            console.log('❌ Erro ao buscar itens:', err.response?.data?.message || err.message);
            return [];
        }
    }

    async searchItems(term, limit = 10) {
        try {
            const { data } = await this.api.get('/api/search', { params: { q: term } });
            if (!data?.success) return [];
            const items = data.data?.items?.results || [];
            console.log(`🔎 Itens encontrados para "${term}": ${items.length}`);
            items.slice(0, limit).forEach((it, idx) => {
                console.log(`  ${idx + 1}. ${it.name} (${it.category}) • id: ${it.id}`);
            });
            return items;
        } catch (err) {
            console.log('❌ Erro na busca de itens:', err.response?.data?.message || err.message);
            return [];
        }
    }

    // Tenta /api/items/categories; se não existir, calcula a partir de /api/items
    async getCategories() {
        console.log('\n🏷️ Buscando categorias...');
        try {
            const direct = await this.api.get('/api/items/categories');
            if (direct.data?.success) {
                const cats = direct.data.data || direct.data;
                console.log(`✅ Categorias (endpoint): ${cats.length}`);
                cats.slice(0, 20).forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
                return cats;
            }
        } catch (_) {
            // segue para o fallback
        }

        const items = await this.getItems({ limit: 200 });
        const set = new Set(items.map((i) => i.category).filter(Boolean));
        const cats = Array.from(set).sort();
        console.log(`✅ Categorias (deduzidas): ${cats.length}`);
        cats.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
        return cats;
    }

    async createItem(itemData) {
        this.ensureAuth();
        try {
            console.log('\n➕ Criando item...');
            const { data } = await this.api.post('/api/items', itemData);
            if (!data?.success) throw new Error(data?.message || 'Falha ao criar item');
            console.log(`✅ Item criado: ${data.data.name} (id: ${data.data.id})`);
            return data.data;
        } catch (err) {
            console.log('❌ Erro ao criar item:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    // ===================== LISTAS =====================
    async createList({ name, description }) {
        this.ensureAuth();
        try {
            console.log('\n📝 Criando lista...');
            const { data } = await this.api.post('/api/lists', { name, description });
            if (!data?.success) throw new Error(data?.message || 'Falha ao criar lista');
            console.log(`✅ Lista criada: ${data.data.name} (id: ${data.data.id})`);
            return data.data;
        } catch (err) {
            console.log('❌ Erro ao criar lista:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    async getMyLists({ limit = 50, page = 1, status } = {}) {
        this.ensureAuth();
        try {
            const { data } = await this.api.get('/api/lists', { params: { limit, page, status } });
            if (!data?.success) return [];
            const lists = data.data || [];
            console.log(`🗂️ Minhas listas: ${lists.length}`);
            lists.slice(0, 10).forEach((l, i) => {
                console.log(
                    `  ${i + 1}. ${l.name} • itens: ${l.summary?.totalItems ?? l.items?.length ?? 0} • id: ${l.id}`
                );
            });
            return lists;
        } catch (err) {
            console.log('❌ Erro ao buscar listas:', err.response?.data?.message || err.message);
            return [];
        }
    }

    async addItemToList(listId, { itemId, quantity = 1, unit, estimatedPrice, notes }) {
        this.ensureAuth();
        try {
            console.log(`\n📥 Adicionando item ${itemId} à lista ${listId}...`);
            const { data } = await this.api.post(`/api/lists/${listId}/items`, {
                itemId, quantity, unit, estimatedPrice, notes,
            });
            if (!data?.success) throw new Error(data?.message || 'Falha ao adicionar item');
            console.log(
                '✅ Item adicionado. Total itens na lista:',
                data.data?.summary?.totalItems ?? data.data?.items?.length
            );
            return data.data;
        } catch (err) {
            console.log('❌ Erro ao adicionar item à lista:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    async updateListItem(listId, itemId, updates) {
        this.ensureAuth();
        try {
            const { data } = await this.api.put(`/api/lists/${listId}/items/${itemId}`, updates);
            if (!data?.success) throw new Error(data?.message || 'Falha ao atualizar item da lista');
            console.log('🖊️ Item atualizado na lista.');
            return data.data;
        } catch (err) {
            console.log('❌ Erro ao atualizar item da lista:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    async getListSummary(listId) {
        this.ensureAuth();
        try {
            const { data } = await this.api.get(`/api/lists/${listId}/summary`);
            if (!data?.success) throw new Error(data?.message || 'Falha ao obter resumo');
            const s = data.data;
            console.log(
                `📊 Resumo da lista ${listId}: itens ${s.totalItems}, comprados ${s.purchasedItems}, estimado R$ ${s.estimatedTotal}`
            );
            return s;
        } catch (err) {
            console.log('❌ Erro no resumo da lista:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    // ===================== AGREGADOS =====================
    async getDashboard() {
        this.ensureAuth();
        try {
            console.log('\n📈 Buscando dashboard...');
            const { data } = await this.api.get('/api/dashboard');
            if (!data?.success) throw new Error(data?.message || 'Falha ao carregar dashboard');

            const dash = data.data;

            // Cabeçalho
            console.log('✅ Dashboard:');
            console.log(`  Timestamp: ${dash.timestamp}`);

            // Serviços
            const services = dash.services || dash.services_status || {};
            const names = Object.keys(services);
            console.log(`  Serviços registrados: ${names.length}`);
            names.forEach((n) =>
                console.log(`   - ${n}: ${services[n]?.healthy ? 'OK' : 'DOWN'} (${services[n]?.url})`)
            );

            // Info de usuário autenticado (do cliente)
            if (this.user) {
                console.log('  Usuário autenticado:');
                console.log(`   - id: ${this.user.id}`);
                console.log(`   - username: @${this.user.username}`);
                console.log(`   - email: ${this.user.email}`);
                if (this.user.firstName || this.user.lastName) {
                    console.log(`   - nome: ${this.user.firstName || ''} ${this.user.lastName || ''}`.trim());
                }
            }

            // Blocos extra se o gateway tiver agregado
            const lists = dash.lists || dash.data?.lists;
            if (lists) {
                console.log(
                    `  Listas: total=${lists.totalLists} • itens=${lists.totalItems} • comprados=${lists.purchasedItems} • estimado=R$ ${lists.estimatedTotal}`
                );
            }

            const catalog = dash.catalog || dash.data?.catalog;
            if (catalog) {
                console.log(
                    `  Catálogo: amostra itens=${catalog.sampleItems?.length ?? 0} • categorias=${catalog.categories?.length ?? 0}`
                );
            }

            return dash;
        } catch (err) {
            console.log('❌ Erro no dashboard:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    async globalSearch(q) {
        try {
            console.log(`\n🌐 Busca global: "${q}"`);
            const { data } = await this.api.get('/api/search', { params: { q } });
            if (!data?.success) throw new Error(data?.message || 'Falha na busca');
            const items = data.data?.items?.results || [];
            const lists = data.data?.lists?.results || [];
            console.log(`  Itens: ${items.length} | Listas: ${lists.length}`);
            items.slice(0, 10).forEach((it, i) => console.log(`   - [item] ${i + 1}. ${it.name} (${it.category})`));
            lists.slice(0, 5).forEach((l, i) =>
                console.log(`   - [lista] ${i + 1}. ${l.name} (itens: ${l.summary?.totalItems ?? l.items?.length ?? 0})`)
            );
            return data.data;
        } catch (err) {
            console.log('❌ Erro na busca global:', err.response?.data?.message || err.message);
            throw err;
        }
    }

    // ===================== HEALTH =====================
    async checkHealth() {
        console.log('\n🩺 Verificando saúde do Gateway e Registry...');
        const [h, r] = await Promise.allSettled([this.api.get('/health'), this.api.get('/registry')]);
        if (h.status === 'fulfilled') {
            console.log('  Gateway: OK');
            const svcCount = Object.keys(h.value.data?.services || {}).length;
            console.log(`  Serviços no health: ${svcCount}`);
        } else {
            console.log('  Gateway: DOWN', h.reason?.message);
        }

        if (r.status === 'fulfilled') {
            const services = r.value.data?.services || {};
            console.log(`  Registry: ${Object.keys(services).length} serviços`);
            Object.entries(services).forEach(([name, info]) => {
                console.log(`    - ${name}: ${info.healthy ? 'OK' : 'DOWN'} (${info.url})`);
            });
        } else {
            console.log('  Registry: erro', r.reason?.message);
        }
    }

    // ===================== DEMO COMPLETA =====================
    async runDemo() {
        console.log('=====================================');
        console.log(' Demo: Microsserviços (User / Item / List)');
        console.log('=====================================');

        // 1) Health
        await this.checkHealth();
        await this.delay(500);

        // 2) Auth: tenta registrar usuário novo; se falhar, faz login de admin
        const unique = Date.now();
        const userData = {
            email: `demo${unique}@microservices.com`,
            username: `demo${unique}`,
            password: 'demo123456',
            firstName: 'Demo',
            lastName: 'User',
        };

        let authed = false;
        try {
            await this.register(userData); // já deixa token e user
            authed = true;
        } catch (_) {
            console.log('\nTentando login com admin...');
            try {
                await this.login({ identifier: 'admin@microservices.com', password: 'admin123' });
                authed = true;
            } catch (e2) {
                console.log('Login admin falhou; seguindo sem auth.');
            }
        }

        // 3) Catálogo: itens + categorias
        const catalogItems = await this.getItems({ limit: 10 });
        await this.delay(300);
        await this.getCategories();
        await this.delay(300);

        // 4) Busca global por um termo
        await this.globalSearch('arroz');
        await this.delay(300);

        // 5) Operações de compra (lista) — adicionar múltiplos itens e marcar como comprados
        if (authed && this.authToken) {
            const toBuy = (catalogItems.length >= 3 ? catalogItems.slice(0, 3) : catalogItems.slice(0, 2));
            if (toBuy.length === 0) {
                console.log('Sem itens para adicionar à lista — encerrando.');
                return;
            }

            // cria lista
            const list = await this.createList({
                name: `Lista Demo ${unique}`,
                description: 'Criada via client-demo',
            });
            await this.delay(200);

            // adiciona 2-3 itens (com quantidades variadas)
            for (let i = 0; i < toBuy.length; i++) {
                const item = toBuy[i];
                await this.addItemToList(list.id, {
                    itemId: item.id,
                    quantity: (i === 0 ? 2 : (i === 1 ? 3 : 1)),
                    unit: item.unit || 'un',
                    estimatedPrice: item.averagePrice ?? undefined,
                    notes: i === 0 ? 'Promoção' : i === 1 ? 'Estoque baixo' : 'Pedido avulso',
                });
                await this.delay(150);
            }

            // marca 1-2 itens como comprados
            await this.updateListItem(list.id, toBuy[0].id, { purchased: true });
            await this.delay(150);
            if (toBuy[1]) {
                await this.updateListItem(list.id, toBuy[1].id, { purchased: true, quantity: 2 }); // ex.: ajusta qtd
                await this.delay(150);
            }

            // resumo da lista
            const summary = await this.getListSummary(list.id);
            console.log('🧾 Resumo pós-compras:');
            console.log(`   - Total de itens: ${summary.totalItems}`);
            console.log(`   - Itens comprados: ${summary.purchasedItems}`);
            console.log(`   - Valor estimado: R$ ${summary.estimatedTotal}`);

            // dashboard com informações do usuário e de serviços
            await this.delay(300);
            await this.getDashboard();
        } else {
            console.log('\n(Operações de lista puladas: sem autenticação)');
        }

        console.log('\n✅ Demonstração concluída.');
    }

    // util
    delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}

// ===== CLI =====
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Uso: node client-demo.js [opções]');
        console.log('  --health                Verificar saúde (gateway/registry)');
        console.log('  --items                 Listar itens');
        console.log('  --categories            Listar categorias');
        console.log('  --search=termo          Busca global (itens + listas)');
        console.log('  --login=<email>:<pass>  Login com credenciais');
        console.log('  (sem args)              Executa a demonstração completa');
        return;
    }

    const client = new MicroservicesClient();

    try {
        const searchArg = args.find((a) => a.startsWith('--search='));
        const loginArg = args.find((a) => a.startsWith('--login='));

        if (loginArg) {
            const [, pair] = loginArg.split('=');
            const [identifier, password] = pair.split(':');
            await client.login({ identifier, password });
        }

        if (args.includes('--health')) {
            await client.checkHealth();
        } else if (args.includes('--items')) {
            await client.getItems();
        } else if (args.includes('--categories')) {
            await client.getCategories();
        } else if (searchArg) {
            await client.globalSearch(searchArg.split('=')[1] || 'arroz');
        } else {
            await client.runDemo();
        }
    } catch (err) {
        console.error('Erro na execução:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((e) => {
        console.error('Erro crítico:', e.message);
        process.exit(1);
    });
}

module.exports = MicroservicesClient;
