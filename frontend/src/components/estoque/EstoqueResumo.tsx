import React, { useMemo } from 'react';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import { criticaIntEstoque, isEstoqueAbaixoOuCritico, saldoIntEstoque } from './estoqueProdutoUtils';
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
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => void | Promise<void>;
  onIrParaLancar: () => void;
}

const EstoqueResumo: React.FC<Props> = ({ categorias, loading, onReload, onIrParaLancar }) => {
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

  if (loading) {
    return <div className="estoque-loading">Carregando estoque…</div>;
  }

  const semDados = categorias.length === 0 || linhas.length === 0;

  return (
    <div className="estoque-modulo estoque-modulo--screen estoque-modulo--resumo">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">Visão geral do estoque</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => void onReload()}>
          Atualizar
        </button>
      </div>

      <p className="estoque-resumo-lead">
        Lista pensada para <strong>reposição</strong>: veja saldos, limite crítico e foto. Itens no alerta aparecem primeiro e no bloco
        laranja abaixo. Para <strong>lançar entrada ou saída</strong>, use a aba{' '}
        <button type="button" className="estoque-inline-link" onClick={onIrParaLancar}>
          Entrada e saída
        </button>
        . Histórico por dia/semana em <strong>Movimentação</strong>.
      </p>

      {!semDados && (
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

      {!semDados && criticos.length > 0 && (
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

      {semDados ? (
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
