import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueAgrupadoResponse, EstoqueCategoria, EstoqueView } from './estoqueTypes';
import EstoqueResumo from './EstoqueResumo';
import EstoqueVisaoGeral from './EstoqueVisaoGeral';
import EstoqueCategorias from './EstoqueCategorias';
import EstoqueProdutos from './EstoqueProdutos';
import EstoqueMovimentacao from './EstoqueMovimentacao';
import EstoqueLancamentoDiario from './EstoqueLancamentoDiario';
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
  restaurantes: Array<{ id: number; nome: string }>;
  isAdmin: boolean;
  modulos: { estoque: boolean; simplificado: boolean };
  view: EstoqueView;
  onViewChange: (v: EstoqueView) => void;
  onMessage?: (msg: string | null) => void;
  movimentoPeriodoPreset?: { data_inicio: string; data_fim: string; token: number } | null;
}

const EstoqueShell: React.FC<Props> = ({
  restauranteId,
  restaurantes,
  isAdmin,
  modulos,
  view,
  onViewChange,
  onMessage,
  movimentoPeriodoPreset
}) => {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([]);
  const catalogoMovimentacao = useMemo(() => catalogoParaMovimentacao(categorias), [categorias]);

  const carregar = useCallback(async () => {
    if (!restauranteId || !modulos.estoque) {
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
  }, [restauranteId, modulos.estoque, onMessage]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!isAdmin && (view === 'categorias' || view === 'produtos')) {
      onViewChange('visao');
    }
  }, [isAdmin, view, onViewChange]);

  useEffect(() => {
    if (!modulos.estoque && view !== 'diario' && modulos.simplificado) {
      onViewChange('diario');
    } else if (!modulos.simplificado && view === 'diario' && modulos.estoque) {
      onViewChange('resumo');
    } else if (!modulos.estoque && !modulos.simplificado) {
      onViewChange('resumo');
    }
  }, [modulos, view, onViewChange]);

  const effectiveView: EstoqueView = (() => {
    if (!modulos.estoque && modulos.simplificado) return 'diario';
    if (view === 'diario' && !modulos.simplificado) {
      return modulos.estoque ? 'resumo' : 'diario';
    }
    if (!modulos.estoque && view !== 'diario') return 'diario';
    if (!isAdmin && (view === 'categorias' || view === 'produtos')) {
      return modulos.estoque ? 'visao' : 'diario';
    }
    if (!isAdmin && view === 'movimentacao') return 'movimentacao';
    if (!isAdmin && view === 'resumo') return 'resumo';
    if (!isAdmin && modulos.estoque) {
      return view === 'movimentacao' ? 'movimentacao' : view === 'resumo' ? 'resumo' : 'visao';
    }
    return view;
  })();

  if (!restauranteId) {
    return <div className="estoque-empty">Selecione um restaurante.</div>;
  }

  const subNavItems: { id: EstoqueView; label: string; adminOnly?: boolean; requer?: 'estoque' | 'simplificado' }[] = [
    { id: 'resumo', label: 'Visão geral', requer: 'estoque' },
    { id: 'diario', label: 'Lançamento diário', requer: 'simplificado' },
    { id: 'visao', label: isAdmin ? 'Entrada e saída' : 'Lançar entrada e saída', requer: 'estoque' },
    { id: 'movimentacao', label: 'Movimentação', requer: 'estoque' },
    { id: 'categorias', label: 'Categorias', adminOnly: true, requer: 'estoque' },
    { id: 'produtos', label: 'Produtos', adminOnly: true, requer: 'estoque' }
  ];

  const visibleNav = subNavItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.requer === 'estoque' && !modulos.estoque) return false;
    if (item.requer === 'simplificado' && !modulos.simplificado) return false;
    if (item.id === 'diario' && modulos.estoque) return false;
    return true;
  });

  const mostrarSubnav = modulos.estoque && visibleNav.length > 0;

  return (
    <div className="estoque-shell">
      {mostrarSubnav && (
      <nav className="estoque-subnav" aria-label="Menu do estoque">
        <div className="estoque-subnav-scroll">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`estoque-subnav-btn ${effectiveView === item.id ? 'estoque-subnav-btn--active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      )}

      <div className="estoque-shell-content" id="estoque-lancamento-panel">
        {effectiveView === 'diario' && modulos.simplificado && (
          <EstoqueLancamentoDiario
            restauranteId={restauranteId}
            restaurantes={restaurantes}
            onMessage={onMessage}
          />
        )}
        {effectiveView === 'resumo' && modulos.estoque && (
          <EstoqueResumo
            restauranteId={restauranteId}
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            onIrParaLancar={() => onViewChange('visao')}
            onIrParaMovimentacao={() => onViewChange('movimentacao')}
            isAdmin={isAdmin}
          />
        )}
        {effectiveView === 'visao' && modulos.estoque && (
          <EstoqueVisaoGeral
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            isAdmin={isAdmin}
            onMessage={onMessage}
            modoOperador={!isAdmin}
          />
        )}
        {effectiveView === 'movimentacao' && modulos.estoque && (
          <EstoqueMovimentacao
            restauranteId={restauranteId}
            onMessage={onMessage}
            periodoPreset={movimentoPeriodoPreset}
            produtosCatalogo={catalogoMovimentacao}
            onLancamentoFeito={carregar}
          />
        )}
        {effectiveView === 'categorias' && isAdmin && modulos.estoque && (
          <EstoqueCategorias
            restauranteId={restauranteId}
            categorias={categorias}
            loading={loading}
            onReload={carregar}
            onMessage={onMessage}
          />
        )}
        {effectiveView === 'produtos' && isAdmin && modulos.estoque && (
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
