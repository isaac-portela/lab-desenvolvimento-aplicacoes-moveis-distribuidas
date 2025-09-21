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
│   ├── user-service/   # Gerenciamento de usuários
│   ├── item-service/   # Catálogo de itens/produtos
│   └── list-service/   # Gerenciamento de listas de compras
├── api-gateway/        # Ponto único de entrada
└── client-demo.js      # Cliente de demonstração
```

- **User Service (porta 3001)** → Cadastro, login e perfil de usuários.
- **Item Service (porta 3003)** → Catálogo de itens/produtos.
- **List Service (porta 3002)** → Criação e gerenciamento de listas de compras.
- **API Gateway (porta 3000)** → Encaminha as requisições e agrega endpoints.

---

## 🛠️ Tecnologias Utilizadas
- Node.js + Express
- Axios
- JWT + bcrypt
- Banco NoSQL baseado em arquivos JSON
- Service Discovery (arquivo compartilhado)
- Nodemon / Concurrently

---

## 🚀 Como Executar

### 1. Instalar dependências
```bash
npm install
npm run install:all
```

### 2. Rodar os serviços
```bash
npm run start
```

Isso irá inicializar:
- API Gateway → http://localhost:3000
- User Service → http://localhost:3001
- List Service → http://localhost:3002
- Item Service → http://localhost:3003

### 3. Rodar em desenvolvimento
```bash
npm run dev
```

### 4. Rodar cliente demo
```bash
node client-demo.js
```

---

## 📡 Endpoints

### 🔑 Autenticação (User Service via Gateway)
- `POST /api/auth/register` → Registrar usuário
- `POST /api/auth/login` → Login
- `GET /api/users/:id` → Buscar usuário
- `PUT /api/users/:id` → Atualizar perfil

### 📦 Itens (Item Service via Gateway)
- `GET /api/items` → Listar itens (com filtros)
- `GET /api/items/:id` → Buscar item por ID
- `POST /api/items` → Criar item (auth)
- `PUT /api/items/:id` → Atualizar item
- `GET /api/items/categories` → Listar categorias
- `GET /api/search?q=termo` → Buscar itens por nome

### 📝 Listas (List Service via Gateway)
- `POST /api/lists` → Criar lista
- `GET /api/lists` → Listar listas do usuário
- `GET /api/lists/:id` → Buscar lista
- `PUT /api/lists/:id` → Atualizar lista
- `DELETE /api/lists/:id` → Remover lista
- `POST /api/lists/:id/items` → Adicionar item
- `PUT /api/lists/:id/items/:itemId` → Atualizar item
- `DELETE /api/lists/:id/items/:itemId` → Remover item
- `GET /api/lists/:id/summary` → Resumo da lista

### 🌐 Endpoints agregados (API Gateway)
- `GET /api/dashboard` → Estatísticas do usuário
- `GET /api/search?q=termo` → Busca global
- `GET /health` → Status dos serviços
- `GET /registry` → Lista de serviços registrados

---

## 🔐 Autenticação
- O login gera um **token JWT**.
- O token deve ser enviado no header das requisições:
```
Authorization: Bearer <token>
```

---

## 🧪 Testes no Postman/Insomnia

### Registro de usuário
```json
POST /api/auth/register
{
  "email": "teste@puc.com",
  "username": "teste123",
  "password": "123456",
  "firstName": "Teste",
  "lastName": "Usuário"
}
```

### Login
```json
POST /api/auth/login
{
  "identifier": "teste@puc.com",
  "password": "123456"
}
```

### Criar lista
```json
POST /api/lists
{
  "name": "Compras da Semana",
  "description": "Lista do supermercado"
}
```

### Adicionar item à lista
```json
POST /api/lists/{listId}/items
{
  "itemId": "id-do-item",
  "quantity": 2,
  "unit": "un",
  "estimatedPrice": 12.5,
  "notes": "Comprar promoção"
}
```

---

## 📊 Demonstração com Client Demo

Rodar:
```bash
node client-demo.js
```

Demonstra:
1. Health check dos serviços
2. Registro/login de usuário
3. Listagem de itens
4. Busca por categorias
5. Criação de lista e adição de itens
6. Resumo de lista
7. Dashboard agregado

---

## 👨‍🏫 Professores
- Artur Mol
- Cleiton Tavares
- Cristiano Neto

---

## 📅 Entrega
- **Data limite:** 21/09/2025
- **Forma:** Repositório GitHub + Demonstração em vídeo

---
