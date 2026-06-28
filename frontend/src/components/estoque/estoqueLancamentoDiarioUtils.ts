export type CampoLancamentoDiario = 'restaurante' | 'produto' | 'data' | 'quantidade';

export const CAMPOS_LANCAMENTO_DIARIO: CampoLancamentoDiario[] = ['restaurante', 'produto', 'data', 'quantidade'];

export interface LancamentoDiarioApi {
  id: number;
  restaurante_id: number;
  usuario_id?: number | null;
  produto: string;
  data_lancamento: string | null;
  quantidade: string;
  created_at?: string;
  updated_at?: string;
}

export interface LinhaLancamentoDiario {
  id: number | null;
  restaurante_id: number | null;
  produto: string;
  data_lancamento: string | null;
  quantidade: string;
  /** Texto digitado no campo data (edição sem máscara) */
  dataTexto?: string;
}

export function hojeIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function hojeBr(): string {
  const iso = hojeIso();
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function linhaVaziaLancamentoDiario(restauranteId?: number | null): LinhaLancamentoDiario {
  const hoje = hojeBr();
  return {
    id: null,
    restaurante_id: restauranteId ?? null,
    produto: '',
    data_lancamento: hojeIso(),
    quantidade: '',
    dataTexto: hoje
  };
}

export function formatarDataExibicao(data: string | null | undefined): string {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [y, m, d] = data.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(data)) {
    const part = data.split('T')[0];
    const [y, m, d] = part.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
  return String(data);
}

export function dataIsoParaPicker(data: string | null | undefined, dataTexto?: string): string {
  if (dataTexto && /^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) return dataTexto;
  if (dataTexto && /^\d{2}\/\d{2}\/\d{4}$/.test(dataTexto)) {
    const [d, m, y] = dataTexto.split('/');
    return `${y}-${m}-${d}`;
  }
  if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  if (data && /^\d{4}-\d{2}-\d{2}T/.test(data)) return data.split('T')[0];
  if (data && /^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split('/');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/** Converte texto digitado ou ISO para YYYY-MM-DD (banco). Retorna null se vazio. */
export function parseDataParaBanco(texto: string | null | undefined): string | null {
  const t = (texto || '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
    const [d, m, y] = t.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export function pickerParaTextoBr(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function apiParaLinha(row: LancamentoDiarioApi): LinhaLancamentoDiario {
  const dataIso =
    row.data_lancamento && /^\d{4}-\d{2}-\d{2}/.test(row.data_lancamento)
      ? row.data_lancamento.slice(0, 10)
      : null;
  return {
    id: row.id,
    restaurante_id: row.restaurante_id,
    produto: row.produto || '',
    data_lancamento: dataIso,
    quantidade: row.quantidade || '',
    dataTexto: formatarDataExibicao(dataIso)
  };
}
