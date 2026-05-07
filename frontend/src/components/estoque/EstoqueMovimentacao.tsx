import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { movimentarProduto } from '../../lib/estoqueMovimentarApi';
import type { ResumoMovimentosResponse } from './estoqueTypes';
import { addDays, formatarDiaPt, isoHoje } from './estoquePeriodoUtils';
import '../Estoque.css';

export type { ResumoMovimentosResponse };

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

export interface EstoqueCatalogoItem {
  id: number;
  nome: string;
  quantidade: number;
}

interface Props {
  restauranteId: number;
  onMessage?: (msg: string | null) => void;
  periodoPreset?: { data_inicio: string; data_fim: string; token: number } | null;
  produtosCatalogo?: EstoqueCatalogoItem[];
  onLancamentoFeito?: () => void | Promise<void>;
}

function formatarDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const EstoqueMovimentacao: React.FC<Props> = ({
  restauranteId,
  onMessage,
  periodoPreset,
  produtosCatalogo = [],
  onLancamentoFeito
}) => {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onLancamentoFeitoRef = useRef(onLancamentoFeito);
  onLancamentoFeitoRef.current = onLancamentoFeito;

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [resumo, setResumo] = useState<ResumoMovimentosResponse | null>(null);
  const [lista, setLista] = useState<MovimentoRow[]>([]);
  const [produtoId, setProdutoId] = useState('');
  const [loading, setLoading] = useState(true);

  const [lancProdId, setLancProdId] = useState('');
  const [lancTipo, setLancTipo] = useState<'entrada' | 'saida'>('saida');
  const [lancQtd, setLancQtd] = useState('1');
  const [lancObs, setLancObs] = useState('');
  const [lancSaving, setLancSaving] = useState(false);

  const opcoesProdutoFiltro = useMemo(() => {
    const map = new Map<number, string>();
    produtosCatalogo.forEach((p) => map.set(p.id, p.nome));
    (resumo?.saldos || []).forEach((s) => map.set(s.produto_id, s.nome));
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [produtosCatalogo, resumo?.saldos]);

  const saldoLancamentoRapido = useMemo(() => {
    const id = parseInt(lancProdId, 10);
    if (Number.isNaN(id)) return 0;
    const cat = produtosCatalogo.find((p) => p.id === id);
    if (cat !== undefined) return cat.quantidade;
    const s = resumo?.saldos?.find((x) => x.produto_id === id);
    return s?.saldo_atual ?? 0;
  }, [lancProdId, produtosCatalogo, resumo?.saldos]);

  useEffect(() => {
    setLancProdId('');
    setLancQtd('1');
    setLancObs('');
  }, [restauranteId]);

  useEffect(() => {
    if (lancProdId !== '' || produtosCatalogo.length === 0) return;
    setLancProdId(String(produtosCatalogo[0].id));
  }, [produtosCatalogo, lancProdId]);

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
          axios.get<{ movimentos?: MovimentoRow[] }>(`${API_URL}/estoque/movimentos`, { params: paramsLista })
        ]);
        const raw = rRes.data;
        const periodo = raw.periodo ?? { data_inicio: '', data_fim: '' };
        setResumo({
          ...raw,
          periodo,
          totais: raw.totais ?? { entradas: 0, saidas: 0 },
          por_produto: raw.por_produto ?? [],
          saidas_por_dia: raw.saidas_por_dia ?? [],
          movimentacao_por_dia: raw.movimentacao_por_dia ?? [],
          saldos: raw.saldos ?? []
        });
        setLista(lRes.data?.movimentos ?? []);
        setDataInicio(periodo.data_inicio);
        setDataFim(periodo.data_fim);
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

  const aplicarHoje = () => {
    const h = isoHoje();
    setDataInicio(h);
    setDataFim(h);
    carregar(h, h);
  };

  const aplicarUltimos7Dias = () => {
    const f = isoHoje();
    const i = addDays(f, -6);
    setDataInicio(i);
    setDataFim(f);
    carregar(i, f);
  };

  const recarregarPeriodoAtual = useCallback(async () => {
    if (dataInicio && dataFim) await carregar(dataInicio, dataFim);
    else await carregar();
  }, [carregar, dataInicio, dataFim]);

  const lancarRapido = async () => {
    const id = parseInt(lancProdId, 10);
    if (Number.isNaN(id) || id <= 0) {
      onMessageRef.current?.('Escolha um produto.');
      return;
    }
    const q = parseInt(String(lancQtd).replace(/\D/g, ''), 10);
    if (!q || q <= 0) {
      onMessageRef.current?.('Informe quantidade inteira maior que zero.');
      return;
    }
    setLancSaving(true);
    onMessageRef.current?.(null);
    try {
      await movimentarProduto(
        id,
        { tipo: lancTipo, quantidade: q, observacao: lancObs.trim() },
        saldoLancamentoRapido
      );
      await recarregarPeriodoAtual();
      await onLancamentoFeitoRef.current?.();
      onMessageRef.current?.('Lançamento registrado.');
      setLancQtd('1');
      setLancObs('');
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      onMessageRef.current?.(ax.response?.data?.error || 'Erro ao lançar.');
    } finally {
      setLancSaving(false);
    }
  };

  const estornarMovimento = async (id: number) => {
    if (!window.confirm('Estornar este lançamento incorreto?')) return;
    onMessageRef.current?.(null);
    try {
      await axios.post(`${API_URL}/estoque/movimentos/${id}/estornar`);
      await recarregarPeriodoAtual();
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
    ? `${formatarDiaPt(resumo.periodo.data_inicio)} — ${formatarDiaPt(resumo.periodo.data_fim)}`
    : '';

  const movimentoPorDia = useMemo(() => {
    const m = resumo?.movimentacao_por_dia;
    if (m && m.length > 0) return m;
    const s = resumo?.saidas_por_dia ?? [];
    return s.map((r) => ({ data: r.data, entradas: 0, saidas: r.saidas }));
  }, [resumo?.movimentacao_por_dia, resumo?.saidas_por_dia]);

  return (
    <div className="estoque-modulo estoque-modulo--screen estoque-movimentacao">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">Movimentação</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => recarregarPeriodoAtual()}>
          Atualizar
        </button>
      </div>

      <p className="estoque-movimentacao-intro">
        Veja <strong>entradas e saídas por dia</strong> no período escolhido. Use os atalhos <strong>Hoje</strong> ou{' '}
        <strong>Últimos 7 dias</strong> para comparar o consumo recente. Para lançar movimentos: bloco rápido abaixo ou a aba{' '}
        <strong>Entrada e saída</strong>.
      </p>

      {produtosCatalogo.length > 0 && (
        <section className="estoque-lancamento-rapido" aria-label="Lançamento rápido">
          <h3 className="estoque-subsection-title">Lançamento rápido</h3>
          <p className="estoque-lancamento-rapido-saldo">
            Saldo atual do item selecionado: <strong>{saldoLancamentoRapido}</strong>
          </p>
          <div className="estoque-lancamento-rapido-grid">
            <label className="estoque-movimentacao-label">
              Produto
              <select
                className="estoque-input estoque-input--date estoque-input--full"
                value={lancProdId}
                onChange={(e) => setLancProdId(e.target.value)}
              >
                {produtosCatalogo.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="estoque-movimentacao-label">
              Tipo
              <select
                className="estoque-input estoque-input--date estoque-input--full"
                value={lancTipo}
                onChange={(e) => setLancTipo(e.target.value === 'entrada' ? 'entrada' : 'saida')}
              >
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>
            </label>
            <label className="estoque-movimentacao-label">
              Quantidade (entrada soma · saída subtrai)
              <input
                className="estoque-input estoque-input-qtd estoque-input-qtd--int estoque-input--full"
                inputMode="numeric"
                autoComplete="off"
                value={lancQtd}
                onChange={(e) => setLancQtd(e.target.value.replace(/\D/g, '') || '')}
                title="Não digite o total em estoque; digite só o que entra ou sai neste lançamento."
              />
            </label>
            <label className="estoque-movimentacao-label estoque-lancamento-rapido-span-obs">
              Observação (opcional)
              <input
                className="estoque-input estoque-input--full"
                value={lancObs}
                onChange={(e) => setLancObs(e.target.value)}
                placeholder="Ex.: compra, perda…"
              />
            </label>
            <div className="estoque-lancamento-rapido-acao">
              <button
                type="button"
                className="estoque-btn-primary estoque-btn-block"
                disabled={lancSaving}
                onClick={lancarRapido}
              >
                {lancSaving ? 'Salvando…' : 'Confirmar lançamento'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="estoque-movimentacao-filtros" aria-label="Período">
        <div className="estoque-mov-presets" role="group" aria-label="Atalhos de período">
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={aplicarHoje}>
            Hoje
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={aplicarUltimos7Dias}>
            Últimos 7 dias
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={semanaAtual}>
            Semana (seg–dom)
          </button>
        </div>
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
              className="estoque-input estoque-input--date estoque-input--filtro-prod"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
            >
              <option value="">Todos os produtos</option>
              {opcoesProdutoFiltro.map((p) => (
                <option key={p.id} value={String(p.id)}>
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
            Recarregar semana padrão
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={semanaProxima}>
            Próxima semana →
          </button>
        </div>
      </section>

      {loading ? (
        <p className="estoque-empty-msg">Carregando relatório do período…</p>
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

          <section className="estoque-movimentacao-tabela-wrap" aria-label="Movimento por dia">
            <h3 className="estoque-subsection-title">Movimento por dia</h3>
            {movimentoPorDia.length === 0 ? (
              <p className="estoque-empty-msg">Nenhum lançamento neste período.</p>
            ) : (
              <table className="estoque-movimentacao-table estoque-movimentacao-table--dia">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th className="estoque-movimentacao-th-num">Entradas</th>
                    <th className="estoque-movimentacao-th-num">Saídas</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentoPorDia.map((row) => (
                    <tr key={row.data}>
                      <td>{formatarDiaPt(row.data)}</td>
                      <td className="estoque-movimentacao-td-num">{row.entradas}</td>
                      <td className="estoque-movimentacao-td-num">{row.saidas}</td>
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
      ) : (
        <p className="estoque-empty-msg">
          Não foi possível carregar o resumo deste período. Ajuste as datas ou use Atualizar. O lançamento rápido acima
          continua disponível.
        </p>
      )}
    </div>
  );
};

export default EstoqueMovimentacao;
