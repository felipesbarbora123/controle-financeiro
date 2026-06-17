export interface EstoqueProduto {
  id: number;
  restaurante_id: number;
  categoria_id: number;
  nome: string;
  unidade: string;
  quantidade: string | number;
  /** Quando saldo <= este valor (>0), alerta de reposição. 0 = não configurado. */
  quantidade_critica?: string | number | null;
  foto_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EstoqueCategoria {
  id: number;
  restaurante_id: number;
  nome: string;
  ordem: number;
  produtos: EstoqueProduto[];
}

export interface EstoqueAgrupadoResponse {
  restaurante_id: number;
  categorias: EstoqueCategoria[];
}

export interface ResumoMovimentosResponse {
  restaurante_id: number;
  periodo: { data_inicio: string; data_fim: string };
  filtro?: { produto_id: number | null };
  totais: { entradas: number; saidas: number };
  por_produto: Array<{ produto_id: number; nome: string; entradas: number; saidas: number }>;
  saidas_por_dia: Array<{ data: string; saidas: number }>;
  movimentacao_por_dia?: Array<{ data: string; entradas: number; saidas: number }>;
  saldos: Array<{ produto_id: number; nome: string; saldo_atual: number }>;
}

export type EstoqueView = 'resumo' | 'visao' | 'diario' | 'categorias' | 'produtos' | 'movimentacao';

export interface LancamentoDiario {
  id: number;
  restaurante_id: number;
  produto: string;
  data_lancamento: string | null;
  quantidade: string;
  created_at?: string;
  updated_at?: string;
}

export const UNIDADES_SUGERIDAS = ['un', 'kg', 'g', 'lt', 'ml', 'cx', 'fd', 'pct', 'dz'];
