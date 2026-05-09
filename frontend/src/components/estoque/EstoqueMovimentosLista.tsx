import React from 'react';
import { formatarDataHoraPt } from './estoquePeriodoUtils';
import '../Estoque.css';

export interface EstoqueMovimentoLinha {
  id: number;
  produto_id: number;
  produto_nome: string;
  quantidade_antes: number;
  quantidade_depois: number;
  diferenca: number;
  tipo?: string;
  observacao?: string | null;
  estornado?: boolean;
  movimento_estorno_de_id?: number | null;
  created_at: string;
  usuario_nome: string | null;
}

interface Props {
  lista: EstoqueMovimentoLinha[];
  onEstornar?: (id: number) => void | Promise<void>;
  /** Se false, não exibe o botão Estornar (ex.: operador sem permissão no futuro). */
  mostrarEstornar?: boolean;
}

const EstoqueMovimentosLista: React.FC<Props> = ({ lista, onEstornar, mostrarEstornar = true }) => {
  if (lista.length === 0) {
    return <p className="estoque-empty-msg">Nenhum lançamento neste período.</p>;
  }

  return (
    <ul className="estoque-movimentacao-ul">
      {lista.map((m) => (
        <li key={m.id} className="estoque-movimentacao-li">
          <span className="estoque-movimentacao-li-data">{formatarDataHoraPt(m.created_at)}</span>
          <span className="estoque-movimentacao-li-prod">{m.produto_nome}</span>
          <span className="estoque-movimentacao-li-delta">
            {m.diferenca > 0 ? `+${m.diferenca}` : m.diferenca}
          </span>
          <span className="estoque-movimentacao-li-meta">
            {m.quantidade_antes} → {m.quantidade_depois} · {m.tipo || 'ajuste'}
            {m.usuario_nome ? ` · ${m.usuario_nome}` : ''}
            {m.observacao ? ` · ${m.observacao}` : ''}
            {m.estornado ? ' · ESTORNADO' : ''}
          </span>
          {mostrarEstornar && onEstornar && !m.estornado && !m.movimento_estorno_de_id && (
            <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => onEstornar(m.id)}>
              Estornar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export default EstoqueMovimentosLista;
