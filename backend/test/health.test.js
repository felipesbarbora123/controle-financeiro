/**
 * Integração leve: Express + rota /health com banco mockado (padrão Jest + Supertest).
 * `var` + factory do jest.mock: compatível com hoist do Jest (ver doc "Manual mocks").
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest_jwt_secret';

// eslint-disable-next-line no-var
var mockPoolQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockPoolQuery,
    connect: jest.fn(),
    end: jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    }),
  })),
}));

const request = require('supertest');

describe('GET /health', () => {
  let app;

  beforeAll(() => {
    // eslint-disable-next-line global-require
    app = require('../server');
  });

  beforeEach(() => {
    mockPoolQuery.mockReset();
  });

  it('retorna 200 quando o banco responde', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      database: 'connected',
    });
    expect(res.body.timestamp).toBeDefined();
    expect(mockPoolQuery).toHaveBeenCalled();
  });

  it('retorna 503 quando o banco falha', async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/health').expect(503);

    expect(res.body).toMatchObject({
      status: 'error',
      database: 'disconnected',
    });
  });
});
