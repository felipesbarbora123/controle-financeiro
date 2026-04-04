# Sistema de Controle Financeiro - Restaurante

Sistema simples de controle de gastos para gerenciamento de restaurante, desenvolvido com React (frontend) e Node.js (backend) usando PostgreSQL como banco de dados.

## Características

- Grid editável similar ao Excel para lançamento de gastos
- Interface responsiva para desktop e mobile
- Campos: Data, Descrição, Valor, Observação, Pago
- CRUD completo de gastos
- Banco de dados PostgreSQL

## Pré-requisitos

- Node.js (v14 ou superior)
- PostgreSQL (v12 ou superior)
- npm ou yarn

## Instalação

1. Clone o repositório ou navegue até a pasta do projeto

2. Instale as dependências do backend e frontend:
```bash
npm run install-all
```

3. Configure o banco de dados PostgreSQL:
   - Crie um banco de dados chamado `controle_financeiro`
   - Copie o arquivo `backend/env.example` para `backend/.env`
   - Edite `backend/.env` com suas credenciais do PostgreSQL

4. Execute as migrations:
```bash
npm run migrate
```

## Executando o Projeto

Para executar o backend e frontend simultaneamente:
```bash
npm run dev
```

Ou execute separadamente:

Backend (porta 5000):
```bash
npm run server
```

Frontend (porta 3000):
```bash
npm run client
```

## Testes

Testes unitários e de integração leve (Jest no backend, Testing Library no frontend). Detalhes e comandos: **[TESTING.md](./TESTING.md)**.

## Estrutura do Projeto

```
controlefinanceiro/
├── backend/
│   ├── server.js              # Servidor Express
│   ├── database/
│   │   ├── migrate.js         # Script de migração
│   │   └── migrations/
│   │       └── 001_create_gastos_table.sql
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.js             # Componente principal
│   │   ├── App.css
│   │   ├── components/
│   │   │   ├── GridEditavel.js    # Grid editável
│   │   │   └── GridEditavel.css
│   │   ├── index.js
│   │   └── index.css
│   └── public/
│       └── index.html
├── package.json
└── README.md
```

## Uso

1. Acesse `http://localhost:3000` no navegador
2. Clique em qualquer célula para editar
3. Pressione Enter ou clique fora para salvar
4. Use Tab para navegar entre campos
5. Clique no botão "×" para deletar uma linha
6. Use o botão "+ Adicionar Linha" para criar novos registros

## API Endpoints

- `GET /api/gastos` - Lista todos os gastos
- `GET /api/gastos/:id` - Busca um gasto específico
- `POST /api/gastos` - Cria um novo gasto
- `PUT /api/gastos/:id` - Atualiza um gasto
- `DELETE /api/gastos/:id` - Deleta um gasto
- `PUT /api/gastos/bulk` - Atualiza múltiplos gastos

## Banco de Dados

A tabela `gastos` possui os seguintes campos:
- `id` (SERIAL PRIMARY KEY)
- `data` (DATE)
- `descricao` (VARCHAR(255))
- `valor` (DECIMAL(10,2))
- `observacao` (TEXT)
- `pago` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Tecnologias Utilizadas

- **Frontend**: React, CSS3
- **Backend**: Node.js, Express
- **Banco de Dados**: PostgreSQL
- **HTTP Client**: Axios

