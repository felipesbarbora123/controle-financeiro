import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import { UNIDADES_SUGERIDAS } from './estoqueTypes';
import { saldoIntEstoque } from './estoqueProdutoUtils';
import { IconTrash } from './EstoqueIcons';
import '../Estoque.css';

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
  const [editCritica, setEditCritica] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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
    setEditCritica(String(Math.max(0, Math.round(Number(p.quantidade_critica)) || 0)));
    setEditFoto(p.foto_url?.trim() || '');
  };

  const salvarLimiteFoto = async (p: EstoqueProduto) => {
    onMessage?.(null);
    const qc = Math.max(0, parseInt(String(editCritica).replace(/\D/g, ''), 10) || 0);
    const foto = editFoto.trim();
    if (foto.length > 400000) {
      onMessage?.('URL ou imagem muito longa.');
      return;
    }
    setEditSaving(true);
    try {
      await axios.put(`${API_URL}/estoque/produtos/${p.id}`, {
        categoria_id: p.categoria_id,
        nome: p.nome,
        unidade: p.unidade,
        quantidade: saldoIntEstoque(p),
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
                              {editOpen === p.id ? 'Fechar' : 'Limite / foto'}
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
                                onClick={() => salvarLimiteFoto(p)}
                              >
                                {editSaving ? 'Salvando…' : 'Salvar'}
                              </button>
                              <button
                                type="button"
                                className="estoque-btn-secondary estoque-btn-small"
                                onClick={() => setEditFoto('')}
                              >
                                Limpar foto
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
