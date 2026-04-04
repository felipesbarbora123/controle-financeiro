const {
  parseEstoqueQuantidadeInt,
  normalizeQuantidadeInt,
  diferencaMovimento,
} = require('../lib/estoqueQuantidade');

describe('parseEstoqueQuantidadeInt', () => {
  test('aceita inteiros em string', () => {
    expect(parseEstoqueQuantidadeInt('0')).toEqual({ ok: true, value: 0 });
    expect(parseEstoqueQuantidadeInt('42')).toEqual({ ok: true, value: 42 });
  });

  test('aceita número', () => {
    expect(parseEstoqueQuantidadeInt(7)).toEqual({ ok: true, value: 7 });
  });

  test('rejeita decimal', () => {
    const r = parseEstoqueQuantidadeInt('3.5');
    expect(r.ok).toBe(false);
  });

  test('rejeita vazio e null', () => {
    expect(parseEstoqueQuantidadeInt('').ok).toBe(false);
    expect(parseEstoqueQuantidadeInt(null).ok).toBe(false);
  });
});

describe('normalizeQuantidadeInt', () => {
  test('arredonda e limita a não negativo', () => {
    expect(normalizeQuantidadeInt(10.7)).toBe(11);
    expect(normalizeQuantidadeInt(-3)).toBe(0);
  });
});

describe('diferencaMovimento', () => {
  test('10 -> 8 = -2 (saída)', () => {
    expect(diferencaMovimento(10, 8)).toBe(-2);
  });

  test('8 -> 10 = +2 (entrada)', () => {
    expect(diferencaMovimento(8, 10)).toBe(2);
  });
});
