import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import '../Estoque.css';

export interface ResumoMovimentosResponse {
  restaurante_id: number;
  periodo: { data_inicio: string; data_fim: string };
  filtro?: { produto_id: number | null };
  totais: { entradas: number; saidas: number };
  por_produto: Array<{ produto_id: number; nome: string; entradas: number; saidas: number }>;
  saidas_por_dia: Array<{ data: string; saidas: number }>;
  saldos: Array<{ produto_id: number; nome: string; saldo_atual: number }>;
}

interface MovimentoRow {
  id: number;
  produto_id: number;
  produto_nome: string;
  quantidade_antes: number;
  quantidade_depois: number;
  diferenca: number;
  tipo?: string;
  quantidade?: number;
  observacao?: string | null;
  estornado?: boolean;
  estornado_por_movimento_id?: number | null;
  movimento_estorno_de_id?: number | null;
  created_at: string;
  usuario_nome: string | null;
}

interface Props {
  restauranteId: number;
  onMessage?: (msg: string | null) => void;
  periodoPreset?: { data_inicio: string; data_fim: string; token: number } | null;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function formatarDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const EstoqueMovimentacao: React.FC<Props> = ({ restauranteId, onMessage, periodoPreset }) => {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [resumo, setResumo] = useState<ResumoMovimentosResponse | null>(null);
  const [lista, setLista] = useState<MovimentoRow[]>([]);
  const [produtoId, setProdutoId] = useState('');
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(
    async (inicio?: string, fim?: string) => {
      setLoading(true);
      onMessageRef.current?.(null);
      try {
        const paramsResumo: Record<string, string> = { restaurante_id: String(restauranteId) };
        if (inicio && fim) {
          paramsResumo.data_inicio = inicio;
          paramsResumo.data_fim = fim;
        }
        if (produtoId) paramsResumo.produto_id = produtoId;
        const paramsLista: Record<string, string | number> = {
          restaurante_id: restauranteId,
          limite: 80
        };
        if (inicio && fim) {
          paramsLista.data_inicio = inicio;
          paramsLista.data_fim = fim;
        }
        if (produtoId) paramsLista.produto_id = produtoId;

        const [rRes, lRes] = await Promise.all([
          axios.get<ResumoMovimentosResponse>(`${API_URL}/estoque/movimentos/resumo`, { params: paramsResumo }),
          axios.get<{ movimentos: MovimentoRow[] }>(`${API_URL}/estoque/movimentos`, { params: paramsLista })
        ]);
        setResumo(rRes.data);
        setLista(lRes.data.movimentos || []);
        setDataInicio(rRes.data.periodo.data_inicio);
        setDataFim(rRes.data.periodo.data_fim);
      } catch (e) {
        console.error(e);
        onMessageRef.current?.('Não foi possível carregar a movimentação.');
        setResumo(null);
        setLista([]);
      } finally {
        setLoading(false);
      }
    },
    [restauranteId, produtoId]
  );

  useEffect(() => {
    carregar();
  }, [restauranteId, carregar]);

  useEffect(() => {
    if (!periodoPreset?.data_inicio || !periodoPreset?.data_fim) return;
    setDataInicio(periodoPreset.data_inicio);
    setDataFim(periodoPreset.data_fim);
    carregar(periodoPreset.data_inicio, periodoPreset.data_fim);
  }, [periodoPreset?.token, carregar, periodoPreset]);

  const aplicarPeriodoDigitado = () => {
    if (!dataInicio || !dataFim) return;
    carregar(dataInicio, dataFim);
  };

  const estornarMovimento = async (id: number) => {
    if (!window.confirm('Estornar este lançamento incorreto?')) return;
    onMessageRef.current?.(null);
    try {
      await axios.post(`${API_URL}/estoque/movimentos/${id}/estornar`);
      await carregar(dataInicio, dataFim);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      onMessageRef.current?.(ax.response?.data?.error || 'Não foi possível estornar o lançamento.');
    }
  };

  const semanaAtual = () => {
    carregar();
  };

  const semanaAnterior = () => {
    if (!dataInicio || !dataFim) return;
    carregar(addDays(dataInicio, -7), addDays(dataFim, -7));
  };

  const semanaProxima = () => {
    if (!dataInicio || !dataFim) return;
    carregar(addDays(dataInicio, 7), addDays(dataFim, 7));
  };

  const periodoLabel = resumo
    ? `${resumo.periodo.data_inicio} → ${resumo.periodo.data_fim}`
    : '';

  return (
    <div className="estoque-modulo estoque-modulo--screen estoque-movimentacao">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">Movimentação</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => carregar(dataInicio, dataFim)}>
          Atualizar
        </button>
      </div>

      <p className="estoque-movimentacao-intro">
        Entradas e saídas são calculadas pela diferença entre o valor anterior e o novo em cada lançamento (ex.: 10 → 8 =
        2 saídas; 8 → 10 = 2 entradas).
      </p>

      <section className="estoque-movimentacao-filtros" aria-label="Período">
        <div className="estoque-movimentacao-datas">
          <label className="estoque-movimentacao-label">
            De
            <input
              type="date"
              className="estoque-input estoque-input--date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </label>
          <label className="estoque-movimentacao-label">
            Até
            <input
              type="date"
              className="estoque-input estoque-input--date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </label>
          <button type="button" className="estoque-btn-primary estoque-btn-small" onClick={aplicarPeriodoDigitado}>
            Aplicar
          </button>
          <label className="estoque-movimentacao-label">
            Produto
            <select
              className="estoque-input estoque-input--date"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
            >
              <option value="">Todos</option>
              {(resumo?.saldos || []).map((p) => (
                <option key={p.produto_id} value={String(p.produto_id)}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="estoque-movimentacao-nav-semana">
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={semanaAnterior}>
            ← Semana anterior
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={semanaAtual}>
            Semana atual
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={semanaProxima}>
            Próxima semana →
          </button>
        </div>
      </section>

      {loading ? (
        <p className="estoque-empty-msg">Carregando…</p>
      ) : resumo ? (
        <>
          <section className="estoque-movimentacao-resumo" aria-label="Totais do período">
            <p className="estoque-movimentacao-periodo">{periodoLabel}</p>
            <div className="estoque-movimentacao-cards">
              <div className="estoque-movimentacao-card estoque-movimentacao-card--entrada">
                <span className="estoque-movimentacao-card-label">Entradas</span>
                <span className="estoque-movimentacao-card-valor">{resumo.totais.entradas}</span>
              </div>
              <div className="estoque-movimentacao-card estoque-movimentacao-card--saida">
                <span className="estoque-movimentacao-card-label">Saídas</span>
                <span className="estoque-movimentacao-card-valor">{resumo.totais.saidas}</span>
              </div>
            </div>
          </section>

          <section className="estoque-movimentacao-tabela-wrap" aria-label="Por produto">
            <h3 className="estoque-subsection-title">Por produto</h3>
            {resumo.por_produto.length === 0 ? (
              <p className="estoque-empty-msg">Nenhum movimento neste período.</p>
            ) : (
              <table className="estoque-movimentacao-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Entradas</th>
                    <th>Saídas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.por_produto.map((row) => (
                    <tr key={row.produto_id}>
                      <td>{row.nome}</td>
                      <td>{row.entradas}</td>
                      <td>{row.saidas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="estoque-movimentacao-tabela-wrap" aria-label="Saídas por dia">
            <h3 className="estoque-subsection-title">Saídas diárias</h3>
            {resumo.saidas_por_dia.length === 0 ? (
              <p className="estoque-empty-msg">Sem saídas no período.</p>
            ) : (
              <table className="estoque-movimentacao-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Saídas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.saidas_por_dia.map((row) => (
                    <tr key={row.data}>
                      <td>{row.data}</td>
                      <td>{row.saidas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="estoque-movimentacao-lista" aria-label="Últimos lançamentos">
            <h3 className="estoque-subsection-title">Últimos lançamentos</h3>
            {lista.length === 0 ? (
              <p className="estoque-empty-msg">Nenhum registro.</p>
            ) : (
              <ul className="estoque-movimentacao-ul">
                {lista.map((m) => (
                  <li key={m.id} className="estoque-movimentacao-li">
                    <span className="estoque-movimentacao-li-data">{formatarDataHora(m.created_at)}</span>
                    <span className="estoque-movimentacao-li-prod">{m.produto_nome}</span>
                    <span className="estoque-movimentacao-li-delta">
                      {m.diferenca > 0 ? `+${m.diferenca}` : m.diferenca}
                    </span>
                    <span className="estoque-movimentacao-li-meta">
                      {m.quantidade_antes} → {m.quantidade_depois} · {m.tipo || 'ajuste'}
                      {m.usuario_nome ? ` · ${m.usuario_nome}` : ''} {m.observacao ? ` · ${m.observacao}` : ''}
                      {m.estornado ? ' · ESTORNADO' : ''}
                    </span>
                    {!m.estornado && !m.movimento_estorno_de_id && (
                      <button
                        type="button"
                        className="estoque-btn-secondary estoque-btn-small"
                        onClick={() => estornarMovimento(m.id)}
                      >
                        Estornar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default EstoqueMovimentacao;
