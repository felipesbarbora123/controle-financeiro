# Guia de Configuração Rápida

## Passo a Passo

### 1. Instalar Dependências

```bash
# Instalar dependências do projeto raiz
npm install

# Instalar dependências do frontend
cd frontend
npm install
cd ..
```

### 2. Configurar PostgreSQL

1. Certifique-se de que o PostgreSQL está instalado e rodando
2. Crie o banco de dados:
```sql
CREATE DATABASE controle_financeiro;
```

3. Copie o arquivo de exemplo e configure:
```bash
# Windows PowerShell
Copy-Item backend\env.example backend\.env

# Linux/Mac
cp backend/env.example backend/.env
```

4. Edite `backend/.env` com suas credenciais:
```
DB_USER=seu_usuario
DB_HOST=localhost
DB_NAME=controle_financeiro
DB_PASSWORD=sua_senha
DB_PORT=5432
PORT=5000
```

### 3. Executar Migrations

```bash
npm run migrate
```

### 4. Iniciar o Sistema

```bash
# Iniciar backend e frontend juntos
npm run dev

# Ou separadamente:
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

### 5. Acessar a Aplicação

Abra o navegador em: `http://localhost:3000`

## Solução de Problemas

### Erro de conexão com o banco
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais em `backend/.env`
- Teste a conexão: `psql -U seu_usuario -d controle_financeiro`

### Erro ao executar migrations
- Certifique-se de que o banco de dados existe
- Verifique as permissões do usuário do PostgreSQL

### Porta já em uso
- Altere a porta no arquivo `.env` (backend) ou `package.json` (frontend)

