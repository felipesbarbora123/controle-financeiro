import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import type { EstoqueAgrupadoResponse } from './estoque/estoqueTypes';
import './AdminDashboard.css';

interface GastoRow {
  id?: number;
  valor?: string | number | null;
  pago?: boolean;
  data?: string;
}

interface Props {
  restauranteId: number | null;
  restauranteNome?: string;
  gastos: GastoRow[];
  onIrParaGastos: () => void;
  onIrParaRelatorios: () => void;
  onIrParaEstoque: (view?: 'visao' | 'categorias' | 'produtos') => void;
  onIrParaRestaurantes: () => void;
  onIrParaUsuariosEstoque?: () => void;
}

function parseValor(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

function inicioFimMesAtual(): { ini: string; fim: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ini = `${y}-${pad(m + 1)}-01`;
  const ultimo = new Date(y, m + 1, 0).getDate();
  const fim = `${y}-${pad(m + 1)}-${pad(ultimo)}`;
  return { ini, fim };
}

const AdminDashboard: React.FC<Props> = ({
  restauranteId,
  restauranteNome,
  gastos,
  onIrParaGastos,
  onIrParaRelatorios,
  onIrParaEstoque,
  onIrParaRestaurantes,
  onIrParaUsuariosEstoque
}) => {
  const [loadingEstoque, setLoadingEstoque] = useState(true);
  const [numCategorias, setNumCategorias] = useState(0);
  const [numProdutos, setNumProdutos] = useState(0);

  const carregarResumoEstoque = useCallback(async () => {
    if (!restauranteId) {
      setNumCategorias(0);
      setNumProdutos(0);
      setLoadingEstoque(false);
      return;
    }
    setLoadingEstoque(true);
    try {
      const { data } = await axios.get<EstoqueAgrupadoResponse>(
        `${API_URL}/estoque/agrupado?restaurante_id=${restauranteId}`
      );
      const cats = data.categorias || [];
      setNumCategorias(cats.length);
      let prod = 0;
      cats.forEach((c) => {
        prod += c.produtos?.length || 0;
      });
      setNumProdutos(prod);
    } catch {
      setNumCategorias(0);
      setNumProdutos(0);
    } finally {
      setLoadingEstoque(false);
    }
  }, [restauranteId]);

  useEffect(() => {
    carregarResumoEstoque();
  }, [carregarResumoEstoque]);

  const { ini, fim } = useMemo(() => inicioFimMesAtual(), []);

  const resumoGastosMes = useMemo(() => {
    let total = 0;
    let pendente = 0;
    let count = 0;
    gastos.forEach((g) => {
      const d = g.data || '';
      if (d >= ini && d <= fim) {
        count += 1;
        const val = parseValor(g.valor);
        total += val;
        if (!g.pago) pendente += val;
      }
    });
    return { total, pendente, count };
  }, [gastos, ini, fim]);

  if (!restauranteId) {
    return (
      <div className="admin-dashboard admin-dashboard--empty">
        <p>Selecione um restaurante no topo para ver o painel.</p>
        <button type="button" className="admin-dashboard-btn admin-dashboard-btn--primary" onClick={onIrParaRestaurantes}>
          Gerenciar restaurantes
        </button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard-header">
        <h1 className="admin-dashboard-title">Painel</h1>
        {restauranteNome && <p className="admin-dashboard-sub">{restauranteNome}</p>}
        <p className="admin-dashboard-hint">Resumo do mês atual (gastos) e estoque do restaurante selecionado.</p>
      </header>

      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-card" aria-label="Gastos do mês">
          <h2 className="admin-dashboard-card-title">Gastos (mês)</h2>
          <div className="admin-dashboard-metrics">
            <div className="admin-dashboard-metric">
              <span className="admin-dashboard-metric-label">Total</span>
              <span className="admin-dashboard-metric-value">
                {resumoGastosMes.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="admin-dashboard-metric">
              <span className="admin-dashboard-metric-label">A pagar</span>
              <span className="admin-dashboard-metric-value admin-dashboard-metric-value--warn">
                {resumoGastosMes.pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="admin-dashboard-metric">
              <span className="admin-dashboard-metric-label">Lançamentos</span>
              <span className="admin-dashboard-metric-value">{resumoGastosMes.count}</span>
            </div>
          </div>
          <div className="admin-dashboard-actions">
            <button type="button" className="admin-dashboard-btn" onClick={onIrParaGastos}>
              Abrir gastos
            </button>
            <button type="button" className="admin-dashboard-btn admin-dashboard-btn--ghost" onClick={onIrParaRelatorios}>
              Relatórios
            </button>
          </div>
        </section>

        <section className="admin-dashboard-card" aria-label="Estoque">
          <h2 className="admin-dashboard-card-title">Estoque</h2>
          {loadingEstoque ? (
            <p className="admin-dashboard-loading">Carregando resumo…</p>
          ) : (
            <div className="admin-dashboard-metrics">
              <div className="admin-dashboard-metric">
                <span className="admin-dashboard-metric-label">Categorias</span>
                <span className="admin-dashboard-metric-value">{numCategorias}</span>
              </div>
              <div className="admin-dashboard-metric">
                <span className="admin-dashboard-metric-label">Produtos</span>
                <span className="admin-dashboard-metric-value">{numProdutos}</span>
              </div>
            </div>
          )}
          <div className="admin-dashboard-actions admin-dashboard-actions--stack">
            <button type="button" className="admin-dashboard-btn" onClick={() => onIrParaEstoque('visao')}>
              Visão geral do estoque
            </button>
            <button type="button" className="admin-dashboard-btn admin-dashboard-btn--ghost" onClick={() => onIrParaEstoque('categorias')}>
              Cadastro de categorias
            </button>
            <button type="button" className="admin-dashboard-btn admin-dashboard-btn--ghost" onClick={() => onIrParaEstoque('produtos')}>
              Cadastro de produtos
            </button>
          </div>
        </section>
      </div>

      <section className="admin-dashboard-card admin-dashboard-card--wide">
        <h2 className="admin-dashboard-card-title">Atalhos</h2>
        <div className="admin-dashboard-shortcuts">
          <button type="button" className="admin-dashboard-chip" onClick={onIrParaRestaurantes}>
            Restaurantes
          </button>
          <button type="button" className="admin-dashboard-chip" onClick={onIrParaGastos}>
            Lançar gastos
          </button>
          <button type="button" className="admin-dashboard-chip" onClick={() => onIrParaEstoque('visao')}>
            Conferir estoque
          </button>
          {onIrParaUsuariosEstoque && (
            <button type="button" className="admin-dashboard-chip" onClick={onIrParaUsuariosEstoque}>
              Usuários de estoque
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
