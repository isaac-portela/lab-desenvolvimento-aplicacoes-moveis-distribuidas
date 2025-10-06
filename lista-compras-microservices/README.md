# 🛒 Sistema de Lista de Compras com Microsserviços

Projeto desenvolvido como parte da disciplina **Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas (PUC Minas)**.

---

## 📌 Objetivo
Implementar um sistema distribuído para gerenciamento de listas de compras utilizando arquitetura de **microsserviços** com:
- API Gateway
- Service Discovery
- Bancos NoSQL independentes
- Autenticação JWT

---

## ⚙️ Arquitetura

```
lista-compras-microservices/
├── package.json
├── shared/
│   ├── JsonDatabase.js
│   └── serviceRegistry.js
├── services/
│   ├── user-service/   # Gerenciamento de usuários (porta 3001)
│   ├── item-service/   # Catálogo de itens/produtos (porta 3003)
│   └── list-service/   # Listas de compras (porta 3002)
├── api-gateway/        # Ponto único de entrada (porta 3000)
└── client-demo.js      # Cliente de demonstração (Node/Axios)
```

### Padrões implementados
- **API Gateway** (roteamento/aggregations)
- **Service Discovery** via arquivo compartilhado (`shared/services-registry.json`)
- **Circuit Breaker** (3 falhas → abre circuito)
- **Health Checks** automáticos (30s)
- **Database-per-Service** (NoSQL em arquivos JSON)
- **JWT** e **bcrypt**

---

## 🚀 Como Executar

1) Dependências
```bash
npm install
npm run install:all
```

2) Popular catálogo (20+ itens iniciais)
```bash
npm run seed
```

3) Subir serviços (modo dev com nodemon)
```bash
npm run dev
```
- Gateway → http://localhost:3000
- User → http://localhost:3001
- List → http://localhost:3002
- Item → http://localhost:3003

4) Cliente de demonstração
```bash
node client-demo.js
```

---

## 📡 Endpoints (via API Gateway)

### 🔑 Auth (User Service)
- `POST /api/auth/register`  
  **Body**: `{ email, username, password, firstName, lastName }`  
  **200/201** → `data.user`, `data.token`

- `POST /api/auth/login`  
  **Body**: `{ identifier, password }` (identifier = email **ou** username)  
  **200** → `data.user`, `data.token`

- `POST /api/users/auth/validate` *(opcional dependendo do gateway)*  
  **Body**: `{ token }` → valida JWT e retorna `user`

> **Header de autenticação** (onde for requerido):  
> `Authorization: Bearer <TOKEN>`

---

### 👤 Users
- `GET /api/users/:id` *(auth)* → retorna usuário (você mesmo ou admin)
- `PUT /api/users/:id` *(auth)* → atualiza campos: `firstName`, `lastName`, `email`, `profile.bio`, `profile.preferences.theme`, `profile.preferences.language`

---

### 📦 Items (Item Service)
- `GET /api/items` → lista itens com filtros
    - **Query**: `q` (texto), `category`, `name`, `active`, `limit`, `page`
- `GET /api/items/:id` → item específico
- `POST /api/items` *(auth)* → cria item
    - **Body** (ex.):
      ```json
      {
        "name": "Arroz Tipo 1 5kg",
        "category": "Alimentos",
        "brand": "Marca X",
        "unit": "kg",
        "averagePrice": 32.90,
        "barcode": "7890000000000",
        "description": "Pacote 5kg",
        "active": true
      }
      ```
- `PUT /api/items/:id` *(auth)* → atualiza campos do item
- `GET /api/items/categories` → lista categorias únicas
- `GET /api/search?q=termo` → busca por nome (atalho do catálogo)

**Schema de Item**
```json
{
  "id": "uuid",
  "name": "string",
  "category": "string",
  "brand": "string",
  "unit": "string",
  "averagePrice": "number",
  "barcode": "string",
  "description": "string",
  "active": "boolean",
  "createdAt": "timestamp"
}
```

---

### 📝 Lists (List Service)
- `POST /api/lists` *(auth)* → cria lista  
  **Body**: `{ "name": "Compras da Semana", "description": "Supermercado" }`

- `GET /api/lists` *(auth)* → todas as listas do usuário  
  **Query**: `status=active|completed|archived`, `limit`, `page`

- `GET /api/lists/:id` *(auth)* → detalhes da lista

- `PUT /api/lists/:id` *(auth)* → atualiza nome/descrição/status  
  **Body**: `{ "name": "...", "description": "...", "status": "active|completed|archived" }`

- `DELETE /api/lists/:id` *(auth)* → remove lista

- `POST /api/lists/:id/items` *(auth)* → adiciona item à lista  
  **Body**:
  ```json
  {
    "itemId": "uuid-do-item",
    "quantity": 2,
    "unit": "un|kg|litro",
    "estimatedPrice": 12.5,
    "purchased": false,
    "notes": "Pegar promoção"
  }
  ```

- `PUT /api/lists/:id/items/:itemId` *(auth)* → atualiza o item da lista (ex.: `quantity`, `purchased`)  
  **Body (ex.)**: `{ "quantity": 3, "purchased": true }`

- `DELETE /api/lists/:id/items/:itemId` *(auth)* → remove item da lista

- `GET /api/lists/:id/summary` *(auth)* → resumo da lista  
  **Retorno**: `{ totalItems, purchasedItems, estimatedTotal }`

**Schema de Lista**
```json
{
  "id": "uuid",
  "userId": "string",
  "name": "string",
  "description": "string",
  "status": "active|completed|archived",
  "items": [
    {
      "itemId": "string",
      "itemName": "string",
      "quantity": "number",
      "unit": "string",
      "estimatedPrice": "number",
      "purchased": "boolean",
      "notes": "string",
      "addedAt": "timestamp"
    }
  ],
  "summary": {
    "totalItems": "number",
    "purchasedItems": "number",
    "estimatedTotal": "number"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

> **Regras de negócio**
> - Usuário só vê suas próprias listas.
> - Ao adicionar item, dados são buscados no **Item Service** para cache (`itemName`, `unit`).
> - Totais da `summary` são recalculados automaticamente.
> - Pode-se marcar `purchased: true` nos itens.

---

### 🌐 Endpoints Agregados (Gateway)
- `GET /api/dashboard` *(auth)* → estatísticas do usuário  
  **Retorna**: status dos serviços, contagem de listas/itens, amostra do catálogo, etc.
- `GET /api/search?q=termo` → busca global (itens + listas do usuário, quando autenticado)
- `GET /health` → status do gateway + serviços
- `GET /registry` → serviços registrados (Service Discovery)

---

## 🧪 Testes no Postman/Insomnia

### Como importar a coleção do Insomnia
1. Abra **Insomnia** → Workspace onde deseja importar.
2. `Application Menu` → **Create** → **Import/Export** → **Import Data** → **From Clipboard/File**.
3. Cole/importe o JSON da coleção (se disponibilizado).
4. Confira as **variáveis de Ambiente** (Settings → Environment):
   ```json
   {
     "baseUrl": "http://localhost:3000",
     "token": "COLAR_TOKEN_AQUI",
     "userId": "",
     "listId": "",
     "itemId": ""
   }
   ```
5. Em **Auth** das requisições protegidas, selecione **Bearer Token** e use `{{ token }}`  
   *(ou no Header: `Authorization: Bearer {{ token }}`)*

### Como gerar timestamp no Insomnia
- Use um literal ISO (ex.: `2025-09-21T23:59:00.000Z`) **ou** o template:  
  `{{ now "iso8601" }}`

### Organização da coleção sugerida
```
Lista de Compras (Workspace)
├── Auth
│   ├── Register (POST /api/auth/register)
│   └── Login (POST /api/auth/login)
├── Users
│   ├── Get Me (GET /api/users/{{ userId }})
│   └── Update (PUT /api/users/{{ userId }})
├── Items
│   ├── List (GET /api/items?limit=20)
│   ├── Get by ID (GET /api/items/{{ itemId }})
│   ├── Create (POST /api/items) [Bearer {{ token }}]
│   ├── Update (PUT /api/items/{{ itemId }}) [Bearer {{ token }}]
│   └── Categories (GET /api/items/categories)
├── Lists
│   ├── Create (POST /api/lists) [Bearer {{ token }}]
│   ├── Mine (GET /api/lists) [Bearer {{ token }}]
│   ├── Get by ID (GET /api/lists/{{ listId }}) [Bearer {{ token }}]
│   ├── Update (PUT /api/lists/{{ listId }}) [Bearer {{ token }}]
│   ├── Delete (DELETE /api/lists/{{ listId }}) [Bearer {{ token }}]
│   ├── Add Item (POST /api/lists/{{ listId }}/items) [Bearer {{ token }}]
│   ├── Update Item (PUT /api/lists/{{ listId }}/items/{{ itemId }}) [Bearer {{ token }}]
│   ├── Remove Item (DELETE /api/lists/{{ listId }}/items/{{ itemId }}) [Bearer {{ token }}]
│   └── Summary (GET /api/lists/{{ listId }}/summary) [Bearer {{ token }}]
└── Aggregated
    ├── Dashboard (GET /api/dashboard) [Bearer {{ token }}]
    ├── Search Global (GET /api/search?q=arroz)
    ├── Health (GET /health)
    └── Registry (GET /registry)
```

### Exemplos rápidos para colar no Insomnia

**Register**
```
POST {{ baseUrl }}/api/auth/register
Content-Type: application/json

{
  "email": "demo{{ now 'X' }}@micro.com",
  "username": "demo{{ now 'X' }}",
  "password": "demo123456",
  "firstName": "Demo",
  "lastName": "User"
}
```

**Login**
```
POST {{ baseUrl }}/api/auth/login
Content-Type: application/json

{ "identifier": "admin@microservices.com", "password": "admin123" }
```

**Criar Lista**
```
POST {{ baseUrl }}/api/lists
Authorization: Bearer {{ token }}
Content-Type: application/json

{ "name": "Compras da Semana", "description": "Supermercado" }
```

**Adicionar Item na Lista**
```
POST {{ baseUrl }}/api/lists/{{ listId }}/items
Authorization: Bearer {{ token }}
Content-Type: application/json

{
  "itemId": "{{ itemId }}",
  "quantity": 2,
  "unit": "un",
  "estimatedPrice": 12.5,
  "notes": "Pegar promoção"
}
```

**Resumo**
```
GET {{ baseUrl }}/api/lists/{{ listId }}/summary
Authorization: Bearer {{ token }}
```

**Dashboard**
```
GET {{ baseUrl }}/api/dashboard
Authorization: Bearer {{ token }}
```

---

## 📊 Dashboard (exemplo de retorno)
```json
{
  "timestamp": "2025-09-21T18:00:00.000Z",
  "services_status": {
    "user-service": { "healthy": true, "url": "http://localhost:3001" },
    "item-service": { "healthy": true, "url": "http://localhost:3003" },
    "list-service": { "healthy": true, "url": "http://localhost:3002" }
  },
  "lists": { "totalLists": 4, "totalItems": 12, "purchasedItems": 5, "estimatedTotal": 230.5 },
  "catalog": { "sampleItems": [/* ... */], "categories": ["Alimentos","Higiene","Limpeza","Bebidas","Padaria"] }
}
```

---

## 🧩 Dicas & Troubleshooting
- **Nodemon reiniciando em loop?** Verifique se as pastas `database/` estão ignoradas no `nodemon.json` de cada serviço (evita reinícios ao gravar JSON).
- **`jsonwebtoken` não encontrado?** Rode `npm run install:all` na raiz para instalar deps dos serviços.
- **Registry vazio?** Suba primeiro os serviços (user/list/item) e depois o gateway, ou use `GET /registry` para conferir.
- **Seed não cria índice?** Garanta que a pasta `services/item-service/database` exista antes do `seed` (o código já tenta criar, mas em alguns SOs pode falhar se não houver permissão).

---

## 👨‍🏫 Professores
- Artur Mol • Cleiton Tavares • Cristiano Neto

## 📅 Entrega
- **Data limite:** 21/09/2025 — **Formato**: repositório Git + vídeo (10 min)

---
