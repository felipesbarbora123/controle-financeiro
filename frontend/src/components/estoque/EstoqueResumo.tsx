import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto, ResumoMovimentosResponse } from './estoqueTypes';
import { criticaIntEstoque, isEstoqueAbaixoOuCritico, saldoIntEstoque } from './estoqueProdutoUtils';
import {
  addDays,
  formatarDiaPt,
  isoHoje,
  periodoSemanaSegDom
} from './estoquePeriodoUtils';
import '../Estoque.css';

interface Linha {
  categoria: string;
  produto: EstoqueProduto;
}

function formatAtualizacao(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function FotoCell({ url }: { url?: string | null }) {
  const u = url?.trim();
  if (!u) {
    return <span className="estoque-foto-missing">—</span>;
  }
  return <img src={u} alt="" className="estoque-foto-thumb" loading="lazy" />;
}

interface Props {
  restauranteId: number;
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => void | Promise<void>;
  onIrParaLancar: () => void;
  onIrParaMovimentacao: () => void;
}

const EstoqueResumo: React.FC<Props> = ({
  restauranteId,
  categorias,
  loading,
  onReload,
  onIrParaLancar,
  onIrParaMovimentacao
}) => {
  const [movInicio, setMovInicio] = useState('');
  const [movFim, setMovFim] = useState('');
  const [movDi, setMovDi] = useState('');
  const [movDf, setMovDf] = useState('');
  const [movResumo, setMovResumo] = useState<ResumoMovimentosResponse | null>(null);
  const [movLoading, setMovLoading] = useState(false);
  const [movErr, setMovErr] = useState<string | null>(null);

  useEffect(() => {
    const f = isoHoje();
    const i = addDays(f, -6);
    setMovInicio(i);
    setMovFim(f);
    setMovDi(i);
    setMovDf(f);
  }, [restauranteId]);

  useEffect(() => {
    if (!restauranteId || !movInicio || !movFim) return;
    let cancel = false;
    (async () => {
      setMovLoading(true);
      setMovErr(null);
      try {
        const { data } = await axios.get<ResumoMovimentosResponse>(`${API_URL}/estoque/movimentos/resumo`, {
          params: {
            restaurante_id: restauranteId,
            data_inicio: movInicio,
            data_fim: movFim
          }
        });
        if (!cancel) {
          setMovResumo(data);
          setMovDi(movInicio);
          setMovDf(movFim);
        }
      } catch {
        if (!cancel) {
          setMovResumo(null);
          setMovErr('Não foi possível carregar entradas/saídas deste período.');
        }
      } finally {
        if (!cancel) setMovLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [restauranteId, movInicio, movFim]);

  const movimentoPorDia = useMemo(() => {
    const m = movResumo?.movimentacao_por_dia;
    if (m && m.length > 0) return m;
    const s = movResumo?.saidas_por_dia ?? [];
    return s.map((r) => ({ data: r.data, entradas: 0, saidas: r.saidas }));
  }, [movResumo?.movimentacao_por_dia, movResumo?.saidas_por_dia]);

  const periodoMovLabel =
    movDi && movDf ? `${formatarDiaPt(movDi)} — ${formatarDiaPt(movDf)}` : '';

  const aplicarPresetHoje = () => {
    const h = isoHoje();
    setMovInicio(h);
    setMovFim(h);
  };

  const aplicarPreset7Dias = () => {
    const f = isoHoje();
    setMovInicio(addDays(f, -6));
    setMovFim(f);
  };

  const aplicarPresetSemanaCalendario = () => {
    const w = periodoSemanaSegDom(isoHoje());
    setMovInicio(w.data_inicio);
    setMovFim(w.data_fim);
  };

  const aplicarSemanaPassada = () => {
    const w = periodoSemanaSegDom(isoHoje());
    setMovInicio(addDays(w.data_inicio, -7));
    setMovFim(addDays(w.data_fim, -7));
  };

  const deslocarPeriodo = (dias: number) => {
    if (!movInicio || !movFim) return;
    setMovInicio(addDays(movInicio, dias));
    setMovFim(addDays(movFim, dias));
  };

  const aplicarDatasDigitadas = () => {
    if (!movDi || !movDf) return;
    if (movDi > movDf) {
      setMovErr('A data inicial não pode ser maior que a final.');
      return;
    }
    setMovErr(null);
    setMovInicio(movDi);
    setMovFim(movDf);
  };

  const linhas = useMemo(() => {
    const out: Linha[] = [];
    categorias.forEach((c) => {
      (c.produtos || []).forEach((p) => {
        out.push({ categoria: c.nome, produto: p });
      });
    });
    out.sort((a, b) => {
      const ca = isEstoqueAbaixoOuCritico(a.produto);
      const cb = isEstoqueAbaixoOuCritico(b.produto);
      if (ca !== cb) return ca ? -1 : 1;
      const cat = a.categoria.localeCompare(b.categoria, 'pt-BR');
      if (cat !== 0) return cat;
      return a.produto.nome.localeCompare(b.produto.nome, 'pt-BR', { sensitivity: 'base' });
    });
    return out;
  }, [categorias]);

  const criticos = useMemo(() => linhas.filter((l) => isEstoqueAbaixoOuCritico(l.produto)), [linhas]);

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

  const semDados = categorias.length === 0 || linhas.length === 0;

  return (
    <div className="estoque-modulo estoque-modulo--screen estoque-modulo--resumo">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">Visão geral do estoque</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => void onReload()}>
          Atualizar saldos
        </button>
      </div>

      <p className="estoque-resumo-lead">
        Abaixo você vê <strong>quanto entrou e saiu por dia</strong> no período escolhido (incluindo semanas anteriores). Depois, a lista
        de itens para <strong>reposição</strong>. Para lançar movimentos: aba{' '}
        <button type="button" className="estoque-inline-link" onClick={onIrParaLancar}>
          Entrada e saída
        </button>{' '}
        ou{' '}
        <button type="button" className="estoque-inline-link" onClick={onIrParaMovimentacao}>
          Movimentação
        </button>{' '}
        (histórico detalhado e estorno).
      </p>

      <section className="estoque-resumo-mov" aria-label="Resumo de movimentação no período">
        <h3 className="estoque-subsection-title">Entradas e saídas no período</h3>
        <p className="estoque-resumo-mov-hint">
          Escolha o intervalo para ver o total e o detalhe <strong>por dia</strong>. Use setas para deslocar a mesma janela (ex.: uma semana)
          ou <strong>Semana passada</strong> para o bloco seg–dom anterior.
        </p>

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
            ← Período anterior (7 dias)
          </button>
          <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => deslocarPeriodo(7)}>
            Próximo período (7 dias) →
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

        {movErr && <p className="estoque-resumo-mov-err">{movErr}</p>}

        {movLoading ? (
          <p className="estoque-empty-msg">Carregando totais do período…</p>
        ) : movResumo ? (
          <>
            <p className="estoque-resumo-mov-periodo">{periodoMovLabel}</p>
            <div className="estoque-movimentacao-cards estoque-resumo-mov-cards">
              <div className="estoque-movimentacao-card estoque-movimentacao-card--entrada">
                <span className="estoque-movimentacao-card-label">Entradas (total)</span>
                <span className="estoque-movimentacao-card-valor">{movResumo.totais?.entradas ?? 0}</span>
              </div>
              <div className="estoque-movimentacao-card estoque-movimentacao-card--saida">
                <span className="estoque-movimentacao-card-label">Saídas (total)</span>
                <span className="estoque-movimentacao-card-valor">{movResumo.totais?.saidas ?? 0}</span>
              </div>
            </div>

            <div className="estoque-resumo-mov-tabela-wrap">
              <h4 className="estoque-resumo-mov-sub">Por dia</h4>
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
            </div>

            {(movResumo.por_produto?.length ?? 0) > 0 && (
              <div className="estoque-resumo-mov-tabela-wrap">
                <h4 className="estoque-resumo-mov-sub">Por produto (no período)</h4>
                <table className="estoque-movimentacao-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th className="estoque-movimentacao-th-num">Entradas</th>
                      <th className="estoque-movimentacao-th-num">Saídas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(movResumo.por_produto ?? []).map((row) => (
                      <tr key={row.produto_id}>
                        <td>{row.nome}</td>
                        <td className="estoque-movimentacao-td-num">{row.entradas}</td>
                        <td className="estoque-movimentacao-td-num">{row.saidas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="estoque-empty-msg">Sem dados do período.</p>
        )}
      </section>

      {!loading && !semDados && (
        <ul className="estoque-resumo-stats" aria-label="Totais">
          <li>
            <span className="estoque-resumo-stat-val">{stats.categorias}</span>
            <span className="estoque-resumo-stat-lab">categorias</span>
          </li>
          <li>
            <span className="estoque-resumo-stat-val">{stats.produtos}</span>
            <span className="estoque-resumo-stat-lab">itens</span>
          </li>
          {criticos.length > 0 && (
            <li className="estoque-resumo-stats--alerta">
              <span className="estoque-resumo-stat-val">{criticos.length}</span>
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

      {!loading && !semDados && criticos.length > 0 && (
        <section className="estoque-resumo-criticos" aria-label="Itens em quantidade crítica">
          <h3 className="estoque-subsection-title">Precisa de reposição</h3>
          <p className="estoque-resumo-criticos-hint">
            Estoque atual está no limite ou abaixo do mínimo que você cadastrou (quantidade crítica).
          </p>
          <ul className="estoque-resumo-criticos-list">
            {criticos.map(({ categoria, produto: p }) => {
              const q = saldoIntEstoque(p);
              const lim = criticaIntEstoque(p);
              return (
                <li key={`crit-${p.id}`} className="estoque-resumo-criticos-item">
                  {p.foto_url?.trim() ? (
                    <img src={p.foto_url} alt="" className="estoque-resumo-criticos-foto" loading="lazy" />
                  ) : (
                    <span className="estoque-resumo-criticos-foto estoque-resumo-criticos-foto--empty" aria-hidden>
                      —
                    </span>
                  )}
                  <div className="estoque-resumo-criticos-text">
                    <span className="estoque-resumo-criticos-cat">{categoria}</span>
                    <strong className="estoque-resumo-criticos-nome">{p.nome}</strong>
                    <span className="estoque-resumo-criticos-meta">
                      Saldo <strong>{q}</strong> · mín. <strong>{lim}</strong>
                      {p.unidade ? ` · ${p.unidade}` : ''}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="estoque-empty-msg">Carregando saldos dos itens…</p>
      ) : semDados ? (
        <p className="estoque-empty-msg">
          {categorias.length === 0
            ? 'Nenhuma categoria cadastrada ainda.'
            : 'Nenhum produto neste restaurante.'}
        </p>
      ) : (
        <>
          <div className="estoque-resumo-table-wrap" role="region" aria-label="Tabela de saldos">
            <table className="estoque-resumo-table">
              <thead>
                <tr>
                  <th scope="col" className="estoque-resumo-th-foto">
                    Foto
                  </th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Item</th>
                  <th scope="col" className="estoque-resumo-th-num">
                    Qtd
                  </th>
                  <th scope="col" className="estoque-resumo-th-num">
                    Crítico
                  </th>
                  <th scope="col">Como contar</th>
                  <th scope="col">Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ categoria, produto: p }) => {
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
                      <td className="estoque-resumo-td-foto">
                        <FotoCell url={p.foto_url} />
                      </td>
                      <td>{categoria}</td>
                      <td>{p.nome}</td>
                      <td className="estoque-resumo-td-num">
                        <span className="estoque-resumo-qtd">{q}</span>
                      </td>
                      <td className="estoque-resumo-td-num">{lim > 0 ? lim : '—'}</td>
                      <td>{p.unidade?.trim() || '—'}</td>
                      <td>{formatAtualizacao(p.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="estoque-resumo-cards">
            {linhas.map(({ categoria, produto: p }) => {
              const q = saldoIntEstoque(p);
              const lim = criticaIntEstoque(p);
              const crit = isEstoqueAbaixoOuCritico(p);
              return (
                <article
                  key={`m-${p.id}`}
                  className={`estoque-resumo-card ${crit ? 'estoque-resumo-card--critico' : ''} ${q === 0 ? 'estoque-resumo-card--zero' : ''}`}
                >
                  {crit && <p className="estoque-resumo-card-alert">Atenção: no limite ou abaixo do mínimo</p>}
                  <div className="estoque-resumo-card-row">
                    {p.foto_url?.trim() ? (
                      <img src={p.foto_url} alt="" className="estoque-resumo-card-img" loading="lazy" />
                    ) : (
                      <span className="estoque-resumo-card-img estoque-resumo-card-img--empty" aria-hidden>
                        Sem foto
                      </span>
                    )}
                    <header className="estoque-resumo-card-h">
                      <span className="estoque-resumo-card-cat">{categoria}</span>
                      <h3 className="estoque-resumo-card-nome">{p.nome}</h3>
                    </header>
                  </div>
                  <p className="estoque-resumo-card-qtd">
                    <span className="estoque-resumo-card-qtd-num">{q}</span>
                    <span className="estoque-resumo-card-qtd-lab">{p.unidade?.trim() || '—'}</span>
                  </p>
                  {lim > 0 && (
                    <p className="estoque-resumo-card-crit">
                      Quantidade crítica: <strong>{lim}</strong>
                    </p>
                  )}
                  <p className="estoque-resumo-card-upd">Última alteração: {formatAtualizacao(p.updated_at)}</p>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default EstoqueResumo;
