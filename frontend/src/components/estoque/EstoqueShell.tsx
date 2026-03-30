import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueAgrupadoResponse, EstoqueCategoria, EstoqueView } from './estoqueTypes';
import EstoqueVisaoGeral from './EstoqueVisaoGeral';
import EstoqueCategorias from './EstoqueCategorias';
import EstoqueProdutos from './EstoqueProdutos';
import '../Estoque.css';

interface Props {
  restauranteId: number | null;
  isAdmin: boolean;
  view: EstoqueView;
  onViewChange: (v: EstoqueView) => void;
  onMessage?: (msg: string | null) => void;
}

const EstoqueShell: React.FC<Props> = ({
  restauranteId,
  isAdmin,
  view,
  onViewChange,
  onMessage
}) => {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([]);

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

  const subNavItems: { id: EstoqueView; label: string; adminOnly?: boolean }[] = [
    { id: 'visao', label: isAdmin ? 'Visão geral' : 'Lançar estoque' },
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

      <div className="estoque-shell-content">
        {view === 'visao' && (
          <EstoqueVisaoGeral
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            isAdmin={isAdmin}
            onMessage={onMessage}
            modoOperador={!isAdmin}
          />
        )}
        {view === 'categorias' && isAdmin && (
          <EstoqueCategorias
            restauranteId={restauranteId}
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            onMessage={onMessage}
          />
        )}
        {view === 'produtos' && isAdmin && (
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
