import type { EstoqueProduto } from './estoqueTypes';

export function saldoIntEstoque(p: Pick<EstoqueProduto, 'quantidade'>): number {
  return Math.max(0, Math.round(Number(p.quantidade)) || 0);
}

/** Limite configurado para alerta (> 0). Zero ou inválido = sem alerta. */
export function criticaIntEstoque(p: Pick<EstoqueProduto, 'quantidade_critica'>): number {
  const n = Math.round(Number(p.quantidade_critica));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isEstoqueAbaixoOuCritico(p: EstoqueProduto): boolean {
  const lim = criticaIntEstoque(p);
  if (lim <= 0) return false;
  return saldoIntEstoque(p) <= lim;
}
