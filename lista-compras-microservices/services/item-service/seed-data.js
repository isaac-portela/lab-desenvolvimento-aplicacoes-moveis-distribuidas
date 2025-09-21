const path = require('path');
const JsonDatabase = require('../../shared/JsonDatabase');
const { v4: uuidv4 } = require('uuid');

(async () => {
    try {
        const db = new JsonDatabase(path.join(__dirname, 'database'), 'items');

        const existing = await db.find();
        if (existing.length >= 20) {
            console.log('[Seed] Já existem itens suficientes. Nada a fazer.');
            process.exit(0);
        }

        const items = [
            // Alimentos
            { name: 'Arroz Tipo 1 5kg', category: 'Alimentos', brand: 'Camil', unit: 'kg', averagePrice: 28.9, barcode: '789123000001', description: 'Arroz branco tipo 1', active: true },
            { name: 'Feijão Carioca 1kg', category: 'Alimentos', brand: 'Kicaldo', unit: 'kg', averagePrice: 9.5, barcode: '789123000002', description: 'Feijão carioca selecionado', active: true },
            { name: 'Macarrão Espaguete 500g', category: 'Alimentos', brand: 'Renata', unit: 'un', averagePrice: 5.9, barcode: '789123000003', description: 'Massa de sêmola', active: true },
            { name: 'Açúcar Refinado 1kg', category: 'Alimentos', brand: 'União', unit: 'kg', averagePrice: 6.2, barcode: '789123000004', description: 'Açúcar refinado', active: true },

            // Limpeza
            { name: 'Detergente 500ml', category: 'Limpeza', brand: 'Ypê', unit: 'un', averagePrice: 2.9, barcode: '789223000001', description: 'Detergente neutro', active: true },
            { name: 'Sabão em Pó 800g', category: 'Limpeza', brand: 'OMO', unit: 'un', averagePrice: 12.9, barcode: '789223000002', description: 'Lava-roupas em pó', active: true },
            { name: 'Água Sanitária 1L', category: 'Limpeza', brand: 'Qboa', unit: 'litro', averagePrice: 5.5, barcode: '789223000003', description: 'Desinfetante clorado', active: true },
            { name: 'Desinfetante 2L', category: 'Limpeza', brand: 'Pinho Sol', unit: 'litro', averagePrice: 14.9, barcode: '789223000004', description: 'Limpeza e perfume', active: true },

            // Higiene
            { name: 'Creme Dental 90g', category: 'Higiene', brand: 'Colgate', unit: 'un', averagePrice: 6.9, barcode: '789323000001', description: 'Proteção anticáries', active: true },
            { name: 'Escova de Dentes', category: 'Higiene', brand: 'Oral-B', unit: 'un', averagePrice: 9.9, barcode: '789323000002', description: 'Cerdas macias', active: true },
            { name: 'Sabonete 85g', category: 'Higiene', brand: 'Dove', unit: 'un', averagePrice: 3.9, barcode: '789323000003', description: 'Hidratação cremosa', active: true },
            { name: 'Papel Higiênico 12 rolos', category: 'Higiene', brand: 'Neve', unit: 'un', averagePrice: 22.9, barcode: '789323000004', description: 'Folha dupla', active: true },

            // Bebidas
            { name: 'Refrigerante Cola 2L', category: 'Bebidas', brand: 'Coca-Cola', unit: 'litro', averagePrice: 11.9, barcode: '789423000001', description: 'Refrigerante cola', active: true },
            { name: 'Suco de Laranja 1L', category: 'Bebidas', brand: 'Del Valle', unit: 'litro', averagePrice: 7.9, barcode: '789423000002', description: 'Néctar de laranja', active: true },
            { name: 'Água Mineral 1,5L', category: 'Bebidas', brand: 'Crystal', unit: 'litro', averagePrice: 3.5, barcode: '789423000003', description: 'Sem gás', active: true },
            { name: 'Café Torrado e Moído 500g', category: 'Bebidas', brand: 'Pilão', unit: 'un', averagePrice: 17.9, barcode: '789423000004', description: 'Café tradicional', active: true },

            // Padaria
            { name: 'Pão de Forma 500g', category: 'Padaria', brand: 'Wickbold', unit: 'un', averagePrice: 10.9, barcode: '789523000001', description: 'Tradicional', active: true },
            { name: 'Pão Francês 1kg', category: 'Padaria', brand: 'Padaria do Bairro', unit: 'kg', averagePrice: 18.0, barcode: '789523000002', description: 'Fresco do dia', active: true },
            { name: 'Bolo Inglês 300g', category: 'Padaria', brand: 'Pullman', unit: 'un', averagePrice: 12.5, barcode: '789523000003', description: 'Sabor laranja', active: true },
            { name: 'Croissant 80g', category: 'Padaria', brand: 'Padaria do Bairro', unit: 'un', averagePrice: 5.5, barcode: '789523000004', description: 'Manteigado', active: true },
        ];

        for (const it of items) {
            await db.create({
                id: uuidv4(),
                ...it
            });
        }

        console.log(`[Seed] Inseridos ${items.length} itens.`);
        process.exit(0);
    } catch (err) {
        console.error('[Seed] Erro ao inserir itens:', err);
        process.exit(1);
    }
})();
