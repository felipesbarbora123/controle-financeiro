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

export type EstoqueView = 'resumo' | 'visao' | 'categorias' | 'produtos' | 'movimentacao';

export const UNIDADES_SUGERIDAS = ['un', 'kg', 'g', 'lt', 'ml', 'cx', 'fd', 'pct', 'dz'];
