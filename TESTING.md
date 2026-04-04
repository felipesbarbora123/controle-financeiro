# Testes automatizados

Padrão adotado: **Jest** no backend (Node/Express) e **Jest + Testing Library** no frontend (Create React App).

## Backend (`backend/`)

- **Unitários:** funções puras em `lib/` (ex.: `test/estoqueQuantidade.test.js`).
- **Integração leve:** **Supertest** contra o `app` Express exportado por `server.js`, com **`pg` mockado** no próprio arquivo de teste quando necessário (ex.: `test/health.test.js`).
- O servidor só chama `listen()` quando o arquivo é executado diretamente (`node server.js` / `npm start`), permitindo `require('../server')` nos testes sem abrir porta.
- Com `NODE_ENV=test`, o backend não faz ping inicial ao PostgreSQL nem imprime logs de configuração do banco.

```bash
cd backend
npm install
npm test              # uma execução
npm run test:watch    # durante o desenvolvimento
npm run test:coverage # cobertura (pastas configuradas no jest.config.js)
```

## Frontend (`frontend/`)

- Testes com **`react-scripts test`** (Jest + `@testing-library/react`).
- Arquivos: `*.test.js` ou `*.test.tsx` junto ao código; `setupTests.js` importa `@testing-library/jest-dom`.

```bash
cd frontend
npm test
```

Em CI, use `CI=true npm test` no frontend para execução não interativa.

## Referências

- [Jest](https://jestjs.io/)
- [Supertest](https://github.com/ladjs/supertest)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
