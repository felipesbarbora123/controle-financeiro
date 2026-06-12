import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import { UNIDADES_SUGERIDAS } from './estoqueTypes';
import { saldoIntEstoque } from './estoqueProdutoUtils';
import { IconTrash } from './EstoqueIcons';
import '../Estoque.css';

interface RestauranteOption {
  id: number;
  nome: string;
}

interface ReplicarResponse {
  criados: number;
  ignorados_duplicata: number;
  ignorados_categoria_ausente: number;
  categorias_criadas: number;
}

const MAX_FOTO_FILE_BYTES = 280 * 1024;

function filtrarCategoriasProdutos(cats: EstoqueCategoria[], needle: string): EstoqueCategoria[] {
  const n = needle.trim().toLowerCase();
  if (!n) return cats;
  return cats
    .map((c) => ({
      ...c,
      produtos: (c.produtos || []).filter(
        (p) => p.nome.toLowerCase().includes(n) || (p.unidade || '').toLowerCase().includes(n)
      )
    }))
    .filter((c) => (c.produtos || []).length > 0);
}

interface Props {
  restauranteId: number;
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => Promise<void>;
  onMessage?: (msg: string | null) => void;
}

const EstoqueProdutos: React.FC<Props> = ({
  restauranteId,
  categorias,
  loading,
  onReload,
  onMessage
}) => {
  const [busca, setBusca] = useState('');
  const categoriasVis = useMemo(() => filtrarCategoriasProdutos(categorias, busca), [categorias, busca]);

  const [novoProduto, setNovoProduto] = useState({
    categoria_id: '' as string | number,
    nome: '',
    unidade: '',
    quantidade: '0',
    quantidade_critica: '0',
    foto_url: ''
  });

  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState('');
  const [editUnidade, setEditUnidade] = useState('');
  const [editQuantidade, setEditQuantidade] = useState('0');
  const [editCritica, setEditCritica] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [restaurantes, setRestaurantes] = useState<RestauranteOption[]>([]);
  const [replicarProdIds, setReplicarProdIds] = useState<number[]>([]);
  const [replicarDestIds, setReplicarDestIds] = useState<number[]>([]);
  const [replicarCriarCats, setReplicarCriarCats] = useState(true);
  const [replicarCopiarQtd, setReplicarCopiarQtd] = useState(false);
  const [replicando, setReplicando] = useState(false);

  const todosProdutos = useMemo(
    () =>
      categorias.flatMap((c) =>
        (c.produtos || []).map((p) => ({ ...p, categoria_nome: c.nome }))
      ),
    [categorias]
  );

  const outrosRestaurantes = useMemo(
    () => restaurantes.filter((r) => r.id !== restauranteId),
    [restaurantes, restauranteId]
  );

  useEffect(() => {
    let cancelled = false;
    axios
      .get<RestauranteOption[]>(`${API_URL}/restaurantes`)
      .then(({ data }) => {
        if (!cancelled) setRestaurantes(data || []);
      })
      .catch(() => {
        if (!cancelled) setRestaurantes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleReplicarProd = (id: number) => {
    setReplicarProdIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleReplicarDest = (id: number) => {
    setReplicarDestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selecionarTodosProdutos = () => {
    setReplicarProdIds(todosProdutos.map((p) => p.id));
  };

  const selecionarTodosDestinos = () => {
    setReplicarDestIds(outrosRestaurantes.map((r) => r.id));
  };

  const replicarProdutos = async () => {
    if (replicarDestIds.length === 0) {
      onMessage?.('Selecione ao menos um restaurante de destino.');
      return;
    }
    if (todosProdutos.length === 0) {
      onMessage?.('Não há produtos para replicar.');
      return;
    }

    const prodIds = replicarProdIds.length > 0 ? replicarProdIds : todosProdutos.map((p) => p.id);
    const qtdLabel = prodIds.length === todosProdutos.length ? 'todos os produtos' : `${prodIds.length} produto(s)`;
    const destLabel = replicarDestIds
      .map((id) => outrosRestaurantes.find((r) => r.id === id)?.nome || `#${id}`)
      .join(', ');

    if (
      !window.confirm(
        `Replicar ${qtdLabel} para: ${destLabel}?\n\nProdutos já existentes (mesmo nome na categoria) serão ignorados. Estoque inicial será ${replicarCopiarQtd ? 'copiado da origem' : 'zero'}.`
      )
    ) {
      return;
    }

    onMessage?.(null);
    setReplicando(true);
    try {
      const body: Record<string, unknown> = {
        origem_restaurante_id: restauranteId,
        destino_restaurante_ids: replicarDestIds,
        criar_categorias_ausentes: replicarCriarCats,
        copiar_quantidade: replicarCopiarQtd
      };
      if (replicarProdIds.length > 0) {
        body.produto_ids = replicarProdIds;
      }
      const { data } = await axios.post<ReplicarResponse>(`${API_URL}/estoque/produtos/replicar`, body);
      const partes = [`${data.criados} produto(s) criado(s)`];
      if (data.categorias_criadas > 0) partes.push(`${data.categorias_criadas} categoria(s) criada(s)`);
      if (data.ignorados_duplicata > 0) partes.push(`${data.ignorados_duplicata} ignorado(s) (já existiam)`);
      if (data.ignorados_categoria_ausente > 0) {
        partes.push(`${data.ignorados_categoria_ausente} ignorado(s) (categoria ausente)`);
      }
      onMessage?.(`Replicação concluída: ${partes.join('; ')}.`);
      setReplicarProdIds([]);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao replicar produtos.');
    } finally {
      setReplicando(false);
    }
  };

  const lerArquivoComoDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.size > MAX_FOTO_FILE_BYTES) {
        reject(new Error('GRANDE'));
        return;
      }
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('READ'));
      r.readAsDataURL(file);
    });

  const onFotoNova = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    onMessage?.(null);
    try {
      const dataUrl = await lerArquivoComoDataUrl(f);
      if (dataUrl.length > 350000) {
        onMessage?.('Imagem grande demais após leitura. Use arquivo menor ou URL.');
        return;
      }
      setNovoProduto((p) => ({ ...p, foto_url: dataUrl }));
    } catch (err) {
      if ((err as Error)?.message === 'GRANDE') {
        onMessage?.('Foto muito grande. Máximo ~250 KB.');
      } else {
        onMessage?.('Não foi possível ler a foto.');
      }
    }
  };

  const onFotoEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    onMessage?.(null);
    try {
      const dataUrl = await lerArquivoComoDataUrl(f);
      if (dataUrl.length > 350000) {
        onMessage?.('Imagem grande demais. Use arquivo menor ou URL.');
        return;
      }
      setEditFoto(dataUrl);
    } catch {
      onMessage?.('Não foi possível ler a foto.');
    }
  };

  const abrirEditar = (p: EstoqueProduto) => {
    setEditOpen(p.id);
    setEditNome(p.nome);
    setEditCategoriaId(String(p.categoria_id));
    setEditUnidade(p.unidade || '');
    setEditQuantidade(String(saldoIntEstoque(p)));
    setEditCritica(String(Math.max(0, Math.round(Number(p.quantidade_critica)) || 0)));
    setEditFoto(p.foto_url?.trim() || '');
  };

  const salvarEdicao = async (produtoId: number) => {
    if (!editNome.trim() || !editCategoriaId) {
      onMessage?.('Nome e categoria são obrigatórios.');
      return;
    }
    onMessage?.(null);
    const qc = Math.max(0, parseInt(String(editCritica).replace(/\D/g, ''), 10) || 0);
    const qtd = Math.max(0, parseInt(String(editQuantidade).replace(/\D/g, ''), 10) || 0);
    const foto = editFoto.trim();
    if (foto.length > 400000) {
      onMessage?.('URL ou imagem muito longa.');
      return;
    }
    setEditSaving(true);
    try {
      await axios.put(`${API_URL}/estoque/produtos/${produtoId}`, {
        categoria_id: Number(editCategoriaId),
        nome: editNome.trim(),
        unidade: (editUnidade && editUnidade.trim()) || 'un',
        quantidade: qtd,
        quantidade_critica: qc,
        foto_url: foto || null
      });
      setEditOpen(null);
      await onReload();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setEditSaving(false);
    }
  };

  const criarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoProduto.categoria_id || !novoProduto.nome.trim()) return;
    onMessage?.(null);
    try {
      const body: Record<string, unknown> = {
        restaurante_id: restauranteId,
        categoria_id: Number(novoProduto.categoria_id),
        nome: novoProduto.nome.trim(),
        unidade: (novoProduto.unidade && String(novoProduto.unidade).trim()) || 'un',
        quantidade: Math.max(0, parseInt(String(novoProduto.quantidade).replace(/\D/g, ''), 10) || 0),
        quantidade_critica: Math.max(
          0,
          parseInt(String(novoProduto.quantidade_critica).replace(/\D/g, ''), 10) || 0
        )
      };
      const fu = novoProduto.foto_url.trim();
      if (fu) body.foto_url = fu;
      await axios.post(`${API_URL}/estoque/produtos`, body);
      setNovoProduto({
        categoria_id: '',
        nome: '',
        unidade: '',
        quantidade: '0',
        quantidade_critica: '0',
        foto_url: ''
      });
      await onReload();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao criar produto.');
    }
  };

  const excluir = async (id: number, nome: string) => {
    if (!window.confirm(`Excluir o produto "${nome}"?`)) return;
    onMessage?.(null);
    try {
      await axios.delete(`${API_URL}/estoque/produtos/${id}`);
      await onReload();
    } catch {
      onMessage?.('Erro ao excluir produto.');
    }
  };

  return (
    <div className="estoque-modulo estoque-modulo--screen">
      <div className="estoque-toolbar estoque-toolbar--stack">
        <h2 className="estoque-screen-title">Cadastro de produtos</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => onReload()}>
          Atualizar
        </button>
      </div>

      <section className="estoque-admin-screen-card" aria-label="Novo produto">
        <h3 className="estoque-subsection-title">Novo produto</h3>
        <form onSubmit={criarProduto} className="estoque-form">
          <label className="estoque-label">Categoria</label>
          <select
            className="estoque-input"
            value={novoProduto.categoria_id}
            onChange={(e) => setNovoProduto((p) => ({ ...p, categoria_id: e.target.value }))}
            required
          >
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <label className="estoque-label">Nome do item</label>
          <input
            className="estoque-input"
            value={novoProduto.nome}
            onChange={(e) => setNovoProduto((p) => ({ ...p, nome: e.target.value }))}
            placeholder="Ex.: Queijo mussarela"
            required
          />
          <div className="estoque-form-row estoque-form-row--wrap">
            <div className="estoque-field-grow">
              <label className="estoque-label">Descrição (como contar / embalagem)</label>
              <input
                className="estoque-input"
                list="estoque-unidades-sugestao"
                value={novoProduto.unidade}
                onChange={(e) => setNovoProduto((p) => ({ ...p, unidade: e.target.value }))}
                placeholder="Ex.: kg, caixa, fardo, litro"
              />
              <datalist id="estoque-unidades-sugestao">
                {UNIDADES_SUGERIDAS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="estoque-field-grow">
              <label className="estoque-label">Qtd. inicial (inteiro)</label>
              <input
                className="estoque-input"
                inputMode="numeric"
                pattern="[0-9]*"
                value={novoProduto.quantidade}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '');
                  setNovoProduto((p) => ({ ...p, quantidade: d === '' ? '0' : d }));
                }}
                placeholder="0"
              />
            </div>
            <div className="estoque-field-grow">
              <label className="estoque-label">Quantidade crítica (alerta de reposição)</label>
              <input
                className="estoque-input"
                inputMode="numeric"
                pattern="[0-9]*"
                value={novoProduto.quantidade_critica}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '');
                  setNovoProduto((p) => ({ ...p, quantidade_critica: d === '' ? '0' : d }));
                }}
                placeholder="0 = sem alerta"
                title="Quando o saldo for menor ou igual a este número, o item aparece como crítico."
              />
            </div>
          </div>
          <label className="estoque-label">Foto (opcional)</label>
          <div className="estoque-produto-foto-row">
            <input type="file" accept="image/*" className="estoque-input-file" onChange={onFotoNova} />
            {novoProduto.foto_url ? (
              <>
                <button
                  type="button"
                  className="estoque-btn-secondary estoque-btn-small"
                  onClick={() => setNovoProduto((p) => ({ ...p, foto_url: '' }))}
                >
                  Remover foto
                </button>
                <img src={novoProduto.foto_url} alt="" className="estoque-produto-foto-preview" />
              </>
            ) : null}
          </div>
          <p className="estoque-hint-foto">Até ~250 KB. Ou cadastre sem foto e edite depois com URL no painel do item.</p>
          <button type="submit" className="estoque-btn-primary estoque-btn-block">
            Cadastrar produto
          </button>
        </form>
      </section>

      {todosProdutos.length > 0 && outrosRestaurantes.length > 0 && (
        <section className="estoque-admin-screen-card" aria-label="Replicar produtos">
          <h3 className="estoque-subsection-title">Replicar para outros restaurantes</h3>
          <p className="estoque-hint-foto">
            Copia o cadastro (nome, unidade, foto, quantidade crítica) deste restaurante para as lojas selecionadas.
            Categorias são associadas pelo nome. Se nenhum produto estiver marcado, replica todos.
          </p>

          <fieldset className="estoque-replicar-fieldset">
            <legend className="estoque-replicar-legend">Produtos a replicar</legend>
            <div className="estoque-replicar-actions">
              <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={selecionarTodosProdutos}>
                Selecionar todos
              </button>
              <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => setReplicarProdIds([])}>
                Limpar seleção
              </button>
              <span className="estoque-replicar-count">
                {replicarProdIds.length > 0
                  ? `${replicarProdIds.length} selecionado(s)`
                  : `Todos (${todosProdutos.length})`}
              </span>
            </div>
            <ul className="estoque-replicar-checklist">
              {todosProdutos.map((p) => (
                <li key={p.id}>
                  <label className="estoque-replicar-check">
                    <input
                      type="checkbox"
                      checked={replicarProdIds.includes(p.id)}
                      onChange={() => toggleReplicarProd(p.id)}
                    />
                    <span>
                      {p.nome}
                      <span className="estoque-replicar-check-meta"> · {p.categoria_nome}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="estoque-replicar-fieldset">
            <legend className="estoque-replicar-legend">Restaurantes de destino</legend>
            <div className="estoque-replicar-actions">
              <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={selecionarTodosDestinos}>
                Selecionar todos
              </button>
              <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => setReplicarDestIds([])}>
                Limpar seleção
              </button>
            </div>
            <ul className="estoque-replicar-checklist">
              {outrosRestaurantes.map((r) => (
                <li key={r.id}>
                  <label className="estoque-replicar-check">
                    <input
                      type="checkbox"
                      checked={replicarDestIds.includes(r.id)}
                      onChange={() => toggleReplicarDest(r.id)}
                    />
                    <span>{r.nome}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <label className="estoque-replicar-check estoque-replicar-check--inline">
            <input
              type="checkbox"
              checked={replicarCriarCats}
              onChange={(e) => setReplicarCriarCats(e.target.checked)}
            />
            <span>Criar categorias ausentes nos restaurantes de destino</span>
          </label>
          <label className="estoque-replicar-check estoque-replicar-check--inline">
            <input
              type="checkbox"
              checked={replicarCopiarQtd}
              onChange={(e) => setReplicarCopiarQtd(e.target.checked)}
            />
            <span>Copiar quantidade em estoque da origem (padrão: iniciar com zero)</span>
          </label>

          <button
            type="button"
            className="estoque-btn-primary estoque-btn-block"
            disabled={replicando || replicarDestIds.length === 0}
            onClick={replicarProdutos}
          >
            {replicando ? 'Replicando…' : 'Replicar produtos'}
          </button>
        </section>
      )}

      <section className="estoque-admin-screen-card" aria-label="Produtos cadastrados">
        <h3 className="estoque-subsection-title">Produtos cadastrados</h3>
        {!loading && categorias.some((c) => c.produtos?.length) && (
          <div className="estoque-busca-wrap estoque-busca-wrap--inline">
            <label className="estoque-busca-label" htmlFor="estoque-prod-busca">
              Pesquisar
            </label>
            <input
              id="estoque-prod-busca"
              type="search"
              className="estoque-input estoque-busca-input"
              placeholder="Nome ou descrição…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        )}
        {loading ? (
          <p className="estoque-empty-msg">Carregando…</p>
        ) : categorias.every((c) => !c.produtos?.length) ? (
          <p className="estoque-empty-msg">Nenhum produto. Cadastre acima ou crie categorias primeiro.</p>
        ) : categoriasVis.every((c) => !c.produtos?.length) ? (
          <p className="estoque-empty-msg">Nenhum produto corresponde à pesquisa.</p>
        ) : (
          <div className="estoque-produto-table-wrap">
            {categoriasVis.map((cat) =>
              (cat.produtos || []).length ? (
                <div key={cat.id} className="estoque-produto-group">
                  <h4 className="estoque-produto-group-title">{cat.nome}</h4>
                  <ul className="estoque-produto-flat-list">
                    {cat.produtos!.map((p) => (
                      <li key={p.id} className="estoque-produto-flat-li">
                        <div className="estoque-produto-flat-item">
                          {p.foto_url?.trim() ? (
                            <img src={p.foto_url} alt="" className="estoque-produto-flat-thumb" loading="lazy" />
                          ) : (
                            <span className="estoque-produto-flat-thumb estoque-produto-flat-thumb--empty" aria-hidden>
                              —
                            </span>
                          )}
                          <div className="estoque-produto-flat-body">
                            <span className="estoque-produto-flat-nome">{p.nome}</span>
                            <span className="estoque-produto-flat-meta">
                              Qtd. {saldoIntEstoque(p)}
                              {p.unidade ? ` · ${p.unidade}` : ''}
                              {Math.max(0, Math.round(Number(p.quantidade_critica)) || 0) > 0
                                ? ` · crítico ≤ ${Math.max(0, Math.round(Number(p.quantidade_critica)) || 0)}`
                                : ''}
                            </span>
                          </div>
                          <div className="estoque-produto-flat-acoes">
                            <button
                              type="button"
                              className="estoque-btn-secondary estoque-btn-small"
                              onClick={() => (editOpen === p.id ? setEditOpen(null) : abrirEditar(p))}
                            >
                              {editOpen === p.id ? 'Fechar' : 'Editar'}
                            </button>
                            <button
                              type="button"
                              className="estoque-btn-icon estoque-btn-icon--danger"
                              title="Excluir produto"
                              aria-label={`Excluir ${p.nome}`}
                              onClick={() => excluir(p.id, p.nome)}
                            >
                              <IconTrash width={20} height={20} />
                            </button>
                          </div>
                        </div>
                        {editOpen === p.id && (
                          <div className="estoque-produto-edit">
                            <label className="estoque-label">Nome do item</label>
                            <input
                              className="estoque-input"
                              value={editNome}
                              onChange={(e) => setEditNome(e.target.value)}
                            />
                            <label className="estoque-label">Categoria</label>
                            <select
                              className="estoque-input"
                              value={editCategoriaId}
                              onChange={(e) => setEditCategoriaId(e.target.value)}
                            >
                              {categorias.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.nome}
                                </option>
                              ))}
                            </select>
                            <label className="estoque-label">Como contar / unidade</label>
                            <input
                              className="estoque-input"
                              list="estoque-unidades-sugestao-edit"
                              value={editUnidade}
                              onChange={(e) => setEditUnidade(e.target.value)}
                            />
                            <datalist id="estoque-unidades-sugestao-edit">
                              {UNIDADES_SUGERIDAS.map((u) => (
                                <option key={u} value={u} />
                              ))}
                            </datalist>
                            <label className="estoque-label">Quantidade em estoque (ajuste manual)</label>
                            <input
                              className="estoque-input"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={editQuantidade}
                              onChange={(e) => setEditQuantidade(e.target.value.replace(/\D/g, '') || '0')}
                            />
                            <p className="estoque-hint-foto">
                              Alterar este número grava um ajuste no histórico de movimentação. Prefira entrada/saída na aba correspondente
                              quando possível.
                            </p>
                            <label className="estoque-label">Quantidade crítica (0 = sem alerta)</label>
                            <input
                              className="estoque-input"
                              inputMode="numeric"
                              value={editCritica}
                              onChange={(e) => setEditCritica(e.target.value.replace(/\D/g, ''))}
                            />
                            <label className="estoque-label">Foto — arquivo ou URL</label>
                            <input type="file" accept="image/*" className="estoque-input-file" onChange={onFotoEdit} />
                            <input
                              className="estoque-input"
                              placeholder="https://… ou deixe em branco para remover"
                              value={editFoto.startsWith('data:') ? '' : editFoto}
                              onChange={(e) => setEditFoto(e.target.value)}
                            />
                            {editFoto.trim() ? (
                              <img src={editFoto} alt="" className="estoque-produto-foto-preview" />
                            ) : null}
                            <div className="estoque-produto-edit-btns">
                              <button
                                type="button"
                                className="estoque-btn-primary estoque-btn-small"
                                disabled={editSaving}
                                onClick={() => salvarEdicao(p.id)}
                              >
                                {editSaving ? 'Salvando…' : 'Salvar alterações'}
                              </button>
                              <button
                                type="button"
                                className="estoque-btn-secondary estoque-btn-small"
                                onClick={() => setEditFoto('')}
                              >
                                Limpar foto
                              </button>
                              <button
                                type="button"
                                className="estoque-btn-secondary estoque-btn-small"
                                onClick={() => setEditOpen(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default EstoqueProdutos;
