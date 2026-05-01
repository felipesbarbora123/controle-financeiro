import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueAgrupadoResponse, EstoqueCategoria, EstoqueView } from './estoqueTypes';
import EstoqueVisaoGeral from './EstoqueVisaoGeral';
import EstoqueCategorias from './EstoqueCategorias';
import EstoqueProdutos from './EstoqueProdutos';
import EstoqueMovimentacao from './EstoqueMovimentacao';
import '../Estoque.css';

function catalogoParaMovimentacao(cats: EstoqueCategoria[]) {
  const out: { id: number; nome: string; quantidade: number }[] = [];
  cats.forEach((c) => {
    (c.produtos || []).forEach((p) => {
      out.push({
        id: p.id,
        nome: p.nome,
        quantidade: Math.max(0, Math.round(Number(p.quantidade)) || 0)
      });
    });
  });
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return out;
}

interface Props {
  restauranteId: number | null;
  isAdmin: boolean;
  view: EstoqueView;
  onViewChange: (v: EstoqueView) => void;
  onMessage?: (msg: string | null) => void;
  movimentoPeriodoPreset?: { data_inicio: string; data_fim: string; token: number } | null;
}

const EstoqueShell: React.FC<Props> = ({
  restauranteId,
  isAdmin,
  view,
  onViewChange,
  onMessage,
  movimentoPeriodoPreset
}) => {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([]);
  const catalogoMovimentacao = useMemo(() => catalogoParaMovimentacao(categorias), [categorias]);

  const carregar = useCallback(async () => {
    if (!restauranteId) {
      setCategorias([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    onMessage?.(null);
    try {
      const { data } = await axios.get<EstoqueAgrupadoResponse>(
        `${API_URL}/estoque/agrupado?restaurante_id=${restauranteId}`
      );
      setCategorias(data.categorias || []);
    } catch (e) {
      console.error(e);
      onMessage?.('Não foi possível carregar o estoque.');
    } finally {
      setLoading(false);
    }
  }, [restauranteId, onMessage]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!isAdmin && (view === 'categorias' || view === 'produtos')) {
      onViewChange('visao');
    }
  }, [isAdmin, view, onViewChange]);

  if (!restauranteId) {
    return <div className="estoque-empty">Selecione um restaurante.</div>;
  }

  const effectiveView: EstoqueView = !isAdmin
    ? view === 'movimentacao'
      ? 'movimentacao'
      : 'visao'
    : view;

  const subNavItems: { id: EstoqueView; label: string; adminOnly?: boolean }[] = [
    { id: 'visao', label: isAdmin ? 'Itens' : 'Lançar estoque' },
    { id: 'movimentacao', label: 'Movimentação' },
    { id: 'categorias', label: 'Categorias', adminOnly: true },
    { id: 'produtos', label: 'Produtos', adminOnly: true }
  ];

  const visibleNav = subNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="estoque-shell">
      <nav className="estoque-subnav" aria-label="Menu do estoque">
        <div className="estoque-subnav-scroll">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`estoque-subnav-btn ${view === item.id ? 'estoque-subnav-btn--active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="estoque-shell-content" id="estoque-lancamento-panel">
        {effectiveView === 'visao' && (
          <EstoqueVisaoGeral
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            isAdmin={isAdmin}
            onMessage={onMessage}
            modoOperador={!isAdmin}
          />
        )}
        {effectiveView === 'movimentacao' && (
          <EstoqueMovimentacao
            restauranteId={restauranteId}
            onMessage={onMessage}
            periodoPreset={movimentoPeriodoPreset}
            produtosCatalogo={catalogoMovimentacao}
            onLancamentoFeito={carregar}
          />
        )}
        {effectiveView === 'categorias' && isAdmin && (
          <EstoqueCategorias
            restauranteId={restauranteId}
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            onMessage={onMessage}
          />
        )}
        {effectiveView === 'produtos' && isAdmin && (
          <EstoqueProdutos
            restauranteId={restauranteId}
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            onMessage={onMessage}
          />
        )}
      </div>
    </div>
  );
};

export default EstoqueShell;
