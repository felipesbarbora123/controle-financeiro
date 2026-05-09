import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto, ResumoMovimentosResponse } from './estoqueTypes';
import { criticaIntEstoque, isEstoqueAbaixoOuCritico, saldoIntEstoque } from './estoqueProdutoUtils';
import {
  addDays,
  formatarDiaPt,
  isoHoje,
  normalizaDataIsoDia,
  periodoSemanaSegDom
} from './estoquePeriodoUtils';
import EstoqueMovimentosLista, { type EstoqueMovimentoLinha } from './EstoqueMovimentosLista';
import '../Estoque.css';

function formatAtualizacao(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

interface Props {
  restauranteId: number;
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => void | Promise<void>;
  onIrParaLancar: () => void;
  onIrParaMovimentacao: () => void;
  isAdmin: boolean;
}

function categoriasOrdenadas(cats: EstoqueCategoria[]): EstoqueCategoria[] {
  return [...cats].sort((a, b) => {
    const o = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (o !== 0) return o;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

const EstoqueResumo: React.FC<Props> = ({
  restauranteId,
  categorias,
  loading,
  onReload,
  onIrParaLancar,
  onIrParaMovimentacao,
  isAdmin
}) => {
  const [movInicio, setMovInicio] = useState('');
  const [movFim, setMovFim] = useState('');
  const [movDi, setMovDi] = useState('');
  const [movDf, setMovDf] = useState('');
  const [histProdutoId, setHistProdutoId] = useState('');
  const [histResumo, setHistResumo] = useState<ResumoMovimentosResponse | null>(null);
  const [histLista, setHistLista] = useState<EstoqueMovimentoLinha[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);

  useEffect(() => {
    const f = isoHoje();
    const i = addDays(f, -6);
    setMovInicio(i);
    setMovFim(f);
    setMovDi(i);
    setMovDf(f);
  }, [restauranteId]);

  const opcoesProdutoHist = useMemo(() => {
    const out: { id: number; nome: string; cat: string }[] = [];
    categorias.forEach((c) => {
      (c.produtos || []).forEach((p) => {
        out.push({ id: p.id, nome: p.nome, cat: c.nome });
      });
    });
    out.sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    );
    return out;
  }, [categorias]);

  const carregarHistoricoProduto = useCallback(async () => {
    const pid = parseInt(histProdutoId, 10);
    if (!restauranteId || !movInicio || !movFim || Number.isNaN(pid) || pid <= 0) {
      setHistResumo(null);
      setHistLista([]);
      return;
    }
    setHistLoading(true);
    setHistErr(null);
    try {
      const paramsResumo = {
        restaurante_id: String(restauranteId),
        data_inicio: movInicio,
        data_fim: movFim,
        produto_id: String(pid)
      };
      const paramsLista: Record<string, string | number> = {
        restaurante_id: restauranteId,
        data_inicio: movInicio,
        data_fim: movFim,
        produto_id: pid,
        limite: 200
      };
      const [rRes, lRes] = await Promise.all([
        axios.get<ResumoMovimentosResponse>(`${API_URL}/estoque/movimentos/resumo`, { params: paramsResumo }),
        axios.get<{ movimentos?: EstoqueMovimentoLinha[] }>(`${API_URL}/estoque/movimentos`, { params: paramsLista })
      ]);
      const raw = rRes.data;
      setHistResumo({
        ...raw,
        periodo: raw.periodo ?? { data_inicio: movInicio, data_fim: movFim },
        totais: raw.totais ?? { entradas: 0, saidas: 0 },
        por_produto: raw.por_produto ?? [],
        saidas_por_dia: raw.saidas_por_dia ?? [],
        movimentacao_por_dia: raw.movimentacao_por_dia ?? [],
        saldos: raw.saldos ?? []
      });
      setHistLista(lRes.data?.movimentos ?? []);
    } catch {
      setHistResumo(null);
      setHistLista([]);
      setHistErr('Não foi possível carregar o histórico deste produto.');
    } finally {
      setHistLoading(false);
    }
  }, [restauranteId, movInicio, movFim, histProdutoId]);

  useEffect(() => {
    if (!histProdutoId) {
      setHistResumo(null);
      setHistLista([]);
      setHistErr(null);
      return;
    }
    carregarHistoricoProduto();
  }, [histProdutoId, carregarHistoricoProduto]);

  const movimentoPorDiaHist = useMemo(() => {
    const m = histResumo?.movimentacao_por_dia;
    if (m && m.length > 0) {
      return m.map((row) => ({
        ...row,
        data: normalizaDataIsoDia(row.data)
      }));
    }
    const s = histResumo?.saidas_por_dia ?? [];
    return s.map((r) => ({
      data: normalizaDataIsoDia(r.data),
      entradas: 0,
      saidas: r.saidas
    }));
  }, [histResumo?.movimentacao_por_dia, histResumo?.saidas_por_dia]);

  const periodoMovLabel =
    movInicio && movFim ? `${formatarDiaPt(movInicio)} — ${formatarDiaPt(movFim)}` : '';

  const aplicarPresetHoje = () => {
    const h = isoHoje();
    setMovInicio(h);
    setMovFim(h);
    setMovDi(h);
    setMovDf(h);
  };

  const aplicarPreset7Dias = () => {
    const f = isoHoje();
    setMovInicio(addDays(f, -6));
    setMovFim(f);
    setMovDi(addDays(f, -6));
    setMovDf(f);
  };

  const aplicarPresetSemanaCalendario = () => {
    const w = periodoSemanaSegDom(isoHoje());
    setMovInicio(w.data_inicio);
    setMovFim(w.data_fim);
    setMovDi(w.data_inicio);
    setMovDf(w.data_fim);
  };

  const aplicarSemanaPassada = () => {
    const w = periodoSemanaSegDom(isoHoje());
    setMovInicio(addDays(w.data_inicio, -7));
    setMovFim(addDays(w.data_fim, -7));
    setMovDi(addDays(w.data_inicio, -7));
    setMovDf(addDays(w.data_fim, -7));
  };

  const deslocarPeriodo = (dias: number) => {
    if (!movInicio || !movFim) return;
    setMovInicio(addDays(movInicio, dias));
    setMovFim(addDays(movFim, dias));
    setMovDi(addDays(movInicio, dias));
    setMovDf(addDays(movFim, dias));
  };

  const aplicarDatasDigitadas = () => {
    if (!movDi || !movDf) return;
    if (movDi > movDf) {
      setHistErr('A data inicial não pode ser maior que a final.');
      return;
    }
    setHistErr(null);
    setMovInicio(movDi);
    setMovFim(movDf);
  };

  const estornarMovimento = async (id: number) => {
    if (!window.confirm('Estornar este lançamento incorreto?')) return;
    setHistErr(null);
    try {
      await axios.post(`${API_URL}/estoque/movimentos/${id}/estornar`);
      await carregarHistoricoProduto();
      await onReload();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setHistErr(ax.response?.data?.error || 'Não foi possível estornar.');
    }
  };

  const catsOrd = useMemo(() => categoriasOrdenadas(categorias), [categorias]);

  const criticosRows = useMemo(() => {
    const out: { cat: string; p: EstoqueProduto }[] = [];
    categorias.forEach((c) => {
      (c.produtos || []).forEach((p) => {
        if (isEstoqueAbaixoOuCritico(p)) out.push({ cat: c.nome, p });
      });
    });
    out.sort(
      (a, b) =>
        a.cat.localeCompare(b.cat, 'pt-BR') ||
        a.p.nome.localeCompare(b.p.nome, 'pt-BR', { sensitivity: 'base' })
    );
    return out;
  }, [categorias]);

  const stats = useMemo(() => {
    let produtos = 0;
    let zerados = 0;
    categorias.forEach((c) => {
      const ps = c.produtos || [];
      produtos += ps.length;
      ps.forEach((p) => {
        if (saldoIntEstoque(p) === 0) zerados += 1;
      });
    });
    return { produtos, categorias: categorias.length, zerados };
  }, [categorias]);

  const semItens =
    categorias.length === 0 ||
    categorias.every((c) => !(c.produtos && c.produtos.length));

  return (
    <div className="estoque-modulo estoque-modulo--screen estoque-modulo--resumo">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">Visão geral do estoque</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => void onReload()}>
          Atualizar saldos
        </button>
      </div>

      <p className="estoque-resumo-lead">
        <strong>Histórico por produto:</strong> escolha o item e o período para ver entradas/saídas <strong>por dia</strong> e cada
        lançamento (como na movimentação). A lista abaixo agrupa <strong>categorias e produtos</strong> para reposição. Lançamentos: aba{' '}
        <button type="button" className="estoque-inline-link" onClick={onIrParaLancar}>
          Entrada e saída
        </button>{' '}
        ou{' '}
        <button type="button" className="estoque-inline-link" onClick={onIrParaMovimentacao}>
          Movimentação
        </button>
        . Para <strong>editar cadastro</strong> do item (nome, categoria, foto…): aba <strong>Produtos</strong>.
      </p>

      <section className="estoque-resumo-mov" aria-label="Histórico por produto">
        <h3 className="estoque-subsection-title">Histórico do produto</h3>
        <p className="estoque-resumo-mov-hint">
          O que importa aqui é <strong>cada entrada e saída do item no tempo</strong>, não o total geral do restaurante. Escolha o
          produto e o intervalo (inclui semanas passadas).
        </p>

        <label className="estoque-resumo-hist-prod-label" htmlFor="estoque-resumo-hist-prod">
          Produto
        </label>
        <select
          id="estoque-resumo-hist-prod"
          className="estoque-input estoque-resumo-hist-prod-select"
          value={histProdutoId}
          onChange={(e) => setHistProdutoId(e.target.value)}
        >
          <option value="">Selecione um produto…</option>
          {opcoesProdutoHist.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.nome} — {o.cat}
            </option>
          ))}
        </select>

        <div className="estoque-resumo-mov-presets">
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={aplicarPresetHoje}>
            Hoje
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={aplicarPreset7Dias}>
            Últimos 7 dias
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={aplicarPresetSemanaCalendario}>
            Esta semana (seg–dom)
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={aplicarSemanaPassada}>
            Semana passada
          </button>
        </div>

        <div className="estoque-resumo-mov-nav">
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => deslocarPeriodo(-7)}>
            ← 7 dias antes
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => deslocarPeriodo(7)}>
            7 dias depois →
          </button>
        </div>

        <div className="estoque-resumo-mov-datas">
          <label className="estoque-movimentacao-label">
            De
            <input
              type="date"
              className="estoque-input estoque-input--date"
              value={movDi}
              onChange={(e) => setMovDi(e.target.value)}
            />
          </label>
          <label className="estoque-movimentacao-label">
            Até
            <input
              type="date"
              className="estoque-input estoque-input--date"
              value={movDf}
              onChange={(e) => setMovDf(e.target.value)}
            />
          </label>
          <button type="button" className="estoque-btn-primary estoque-btn-small" onClick={aplicarDatasDigitadas}>
            Aplicar datas
          </button>
        </div>

        {histErr && <p className="estoque-resumo-mov-err">{histErr}</p>}

        {!histProdutoId ? (
          <p className="estoque-empty-msg">Selecione um produto para ver o resumo por dia e os lançamentos.</p>
        ) : histLoading ? (
          <p className="estoque-empty-msg">Carregando histórico…</p>
        ) : histResumo ? (
          <>
            <p className="estoque-resumo-mov-periodo">{periodoMovLabel}</p>

            <div className="estoque-resumo-dia-ent-sai-wrap">
              <table className="estoque-resumo-dia-ent-sai">
                <thead>
                  <tr>
                    <th scope="col">Dia</th>
                    <th scope="col" className="estoque-movimentacao-th-num">
                      Entradas
                    </th>
                    <th scope="col" className="estoque-movimentacao-th-num">
                      Saídas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movimentoPorDiaHist.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="estoque-resumo-dia-empty">
                        Nenhum movimento neste período.
                      </td>
                    </tr>
                  ) : (
                    movimentoPorDiaHist.map((row) => (
                      <tr key={row.data}>
                        <td>{formatarDiaPt(row.data)}</td>
                        <td className="estoque-movimentacao-td-num">{row.entradas}</td>
                        <td className="estoque-movimentacao-td-num">{row.saidas}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h4 className="estoque-resumo-mov-sub">Últimos lançamentos</h4>
            <EstoqueMovimentosLista
              lista={histLista}
              onEstornar={isAdmin ? estornarMovimento : undefined}
              mostrarEstornar={isAdmin}
            />
          </>
        ) : (
          <p className="estoque-empty-msg">Sem dados.</p>
        )}
      </section>

      {!loading && !semItens && (
        <ul className="estoque-resumo-stats" aria-label="Totais">
          <li>
            <span className="estoque-resumo-stat-val">{stats.categorias}</span>
            <span className="estoque-resumo-stat-lab">categorias</span>
          </li>
          <li>
            <span className="estoque-resumo-stat-val">{stats.produtos}</span>
            <span className="estoque-resumo-stat-lab">itens</span>
          </li>
          {criticosRows.length > 0 && (
            <li className="estoque-resumo-stats--alerta">
              <span className="estoque-resumo-stat-val">{criticosRows.length}</span>
              <span className="estoque-resumo-stat-lab">abaixo do limite</span>
            </li>
          )}
          {stats.zerados > 0 && (
            <li className="estoque-resumo-stats--alerta">
              <span className="estoque-resumo-stat-val">{stats.zerados}</span>
              <span className="estoque-resumo-stat-lab">quantidade zero</span>
            </li>
          )}
        </ul>
      )}

      {!loading && !semItens && criticosRows.length > 0 && (
        <section className="estoque-resumo-criticos-table-wrap" aria-label="Produtos em quantidade crítica">
          <h3 className="estoque-subsection-title">Itens em quantidade crítica</h3>
          <div className="estoque-resumo-criticos-table-scroll">
            <table className="estoque-resumo-criticos-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Produto</th>
                  <th className="estoque-movimentacao-th-num">Saldo</th>
                  <th className="estoque-movimentacao-th-num">Mín.</th>
                </tr>
              </thead>
              <tbody>
                {criticosRows.map(({ cat, p }) => (
                  <tr key={p.id}>
                    <td>{cat}</td>
                    <td>{p.nome}</td>
                    <td className="estoque-movimentacao-td-num">{saldoIntEstoque(p)}</td>
                    <td className="estoque-movimentacao-td-num">{criticaIntEstoque(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading ? (
        <p className="estoque-empty-msg">Carregando saldos dos itens…</p>
      ) : semItens ? (
        <p className="estoque-empty-msg">
          {categorias.length === 0
            ? 'Nenhuma categoria cadastrada ainda.'
            : 'Nenhum produto neste restaurante.'}
        </p>
      ) : (
        <section className="estoque-resumo-por-cat" aria-label="Estoque por categoria">
          <h3 className="estoque-subsection-title">Estoque por categoria</h3>
          {catsOrd.map((c) => {
            const ps = [...(c.produtos || [])].sort((a, b) =>
              a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
            );
            if (ps.length === 0) return null;
            return (
              <div key={c.id} className="estoque-resumo-cat-bloco">
                <h4 className="estoque-resumo-cat-titulo">{c.nome}</h4>
                <div className="estoque-resumo-cat-table-wrap">
                  <table className="estoque-resumo-cat-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="estoque-movimentacao-th-num">Qtd</th>
                        <th className="estoque-movimentacao-th-num">Crítico</th>
                        <th>Como contar</th>
                        <th>Última alteração</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ps.map((p) => {
                        const q = saldoIntEstoque(p);
                        const lim = criticaIntEstoque(p);
                        const crit = isEstoqueAbaixoOuCritico(p);
                        return (
                          <tr
                            key={p.id}
                            className={
                              crit ? 'estoque-resumo-tr--critico' : q === 0 ? 'estoque-resumo-tr--zero' : undefined
                            }
                          >
                            <td>{p.nome}</td>
                            <td className="estoque-movimentacao-td-num">{q}</td>
                            <td className="estoque-movimentacao-td-num">{lim > 0 ? lim : '—'}</td>
                            <td>{p.unidade?.trim() || '—'}</td>
                            <td>{formatAtualizacao(p.updated_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="estoque-resumo-cat-cards">
                  {ps.map((p) => {
                    const q = saldoIntEstoque(p);
                    const lim = criticaIntEstoque(p);
                    const crit = isEstoqueAbaixoOuCritico(p);
                    return (
                      <li
                        key={`card-${p.id}`}
                        className={`estoque-resumo-cat-card ${crit ? 'estoque-resumo-cat-card--crit' : ''}`}
                      >
                        <span className="estoque-resumo-cat-card-nome">{p.nome}</span>
                        <span className="estoque-resumo-cat-card-meta">
                          {q} {p.unidade?.trim() || ''}
                          {lim > 0 ? ` · crít. ≤ ${lim}` : ''}
                        </span>
                        <span className="estoque-resumo-cat-card-upd">{formatAtualizacao(p.updated_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default EstoqueResumo;
