import axios from 'axios';
import { API_URL } from '../config';

/** POST /movimentar; se o servidor não expuser a rota (404), aplica delta via PUT (APIs antigas). */
export async function movimentarProduto(
  produtoId: number,
  opts: { tipo: 'entrada' | 'saida'; quantidade: number; observacao?: string },
  saldoAtualParaFallback: number
): Promise<void> {
  const observacao = (opts.observacao || '').trim() || undefined;
  try {
    await axios.post(`${API_URL}/estoque/produtos/${produtoId}/movimentar`, {
      tipo: opts.tipo,
      quantidade: opts.quantidade,
      observacao
    });
  } catch (e: unknown) {
    const ax = e as { response?: { status?: number } };
    if (ax.response?.status !== 404) throw e;
    const antes = Math.max(0, Math.round(Number(saldoAtualParaFallback)) || 0);
    const q = opts.quantidade;
    const depois = opts.tipo === 'entrada' ? antes + q : antes - q;
    if (depois < 0) {
      const err = new Error('SAIDA_EXCEDE') as Error & { response?: { data?: { error?: string } } };
      err.response = { data: { error: 'Saída maior que o saldo atual do produto.' } };
      throw err;
    }
    await axios.put(`${API_URL}/estoque/produtos/${produtoId}`, { quantidade: depois });
  }
}
