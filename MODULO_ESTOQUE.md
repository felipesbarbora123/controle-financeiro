# Módulo de Estoque (multi-restaurante)

## Visão geral

- **Categorias** e **produtos** por restaurante.
- **Admin** (`usuarios.is_admin = true`): cadastra categorias e produtos (nome, unidade, categoria, quantidade inicial), edita tudo e exclui.
- **Demais usuários**: só alteram **quantidade** (API valida).
- **Perfil estoque** (`usuarios.somente_estoque = true`): vê **apenas** o módulo Estoque no app; rotas `/api/gastos*` retornam **403**; **POST/PUT/DELETE** em `/api/restaurantes` também retornam **403** (apenas **GET** para escolher o restaurante no seletor).

## Migração SQL

Execute no PostgreSQL (ou rode `node backend/database/migrate.js` após incluir `006_estoque_modulo.sql` na lista):

Arquivo: `backend/database/migrations/006_estoque_modulo.sql`

Conteúdo principal:

- `ALTER TABLE usuarios ADD COLUMN somente_estoque BOOLEAN DEFAULT false`
- Tabelas `estoque_categorias` e `estoque_produtos`

## Marcar usuário como “somente estoque”

```sql
-- Substitua 'usuario_estoque' pelo login desejado
UPDATE usuarios
SET somente_estoque = true
WHERE username = 'usuario_estoque';
```

O usuário precisa **fazer login de novo** para o token JWT trazer o novo perfil.

## Marcar usuário como admin (cadastro de itens)

```sql
UPDATE usuarios
SET is_admin = true, somente_estoque = false
WHERE username = 'admin';
```

## API (todas exigem `Authorization: Bearer <token>`)

| Método | Rota | Quem |
|--------|------|------|
| GET | `/api/estoque/agrupado?restaurante_id=` | Autenticado |
| POST | `/api/estoque/categorias` | Admin |
| PUT | `/api/estoque/categorias/:id` | Admin |
| DELETE | `/api/estoque/categorias/:id` | Admin |
| POST | `/api/estoque/produtos` | Admin |
| PUT | `/api/estoque/produtos/:id` | Admin: corpo completo; demais: só `{ "quantidade": n }` |
| DELETE | `/api/estoque/produtos/:id` | Admin |

## Frontend (TypeScript incremental)

- Novo módulo em **`src/components/Estoque.tsx`** + **`Estoque.css`** (layout mobile-first).
- Entrada do app: **`src/index.tsx`** (TypeScript).
- **`App.js`** permanece em JavaScript; importa o componente TS normalmente.
- Para migrar o restante do projeto para TS, renomeie arquivos `.js` → `.tsx` aos poucos e corrija tipos (`strict` ativo no `tsconfig.json`).

## Instalação local (frontend)

Na pasta `frontend`:

```bash
npm install
npm start
```

Certifique-se de que a migração `006` foi aplicada no banco antes de usar o estoque.
