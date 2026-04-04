/**
 * Regras de quantidade no estoque (inteiro ≥ 0).
 */

function parseEstoqueQuantidadeInt(raw) {
  if (raw === undefined || raw === null) {
    return { ok: false, error: 'quantidade é obrigatória' };
  }
  const s = String(raw).trim().replace(',', '.');
  if (s === '' || !/^\d+$/.test(s)) {
    return { ok: false, error: 'A quantidade deve ser um número inteiro (sem casas decimais).' };
  }
  const n = parseInt(s, 10);
  if (n < 0) {
    return { ok: false, error: 'A quantidade não pode ser negativa.' };
  }
  return { ok: true, value: n };
}

function normalizeQuantidadeInt(raw) {
  return Math.max(0, Math.round(Number(raw)) || 0);
}

/** diferença depois - antes; usada em movimentos */
function diferencaMovimento(antes, depois) {
  return normalizeQuantidadeInt(depois) - normalizeQuantidadeInt(antes);
}

module.exports = {
  parseEstoqueQuantidadeInt,
  normalizeQuantidadeInt,
  diferencaMovimento
};
