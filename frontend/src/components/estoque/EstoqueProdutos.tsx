import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria } from './estoqueTypes';
import { UNIDADES_SUGERIDAS } from './estoqueTypes';
import '../Estoque.css';

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
  const [novoProduto, setNovoProduto] = useState({
    categoria_id: '' as string | number,
    nome: '',
    unidade: '',
    quantidade: '0'
  });

  const criarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoProduto.categoria_id || !novoProduto.nome.trim()) return;
    onMessage?.(null);
    try {
      await axios.post(`${API_URL}/estoque/produtos`, {
        restaurante_id: restauranteId,
        categoria_id: Number(novoProduto.categoria_id),
        nome: novoProduto.nome.trim(),
        unidade: (novoProduto.unidade && String(novoProduto.unidade).trim()) || 'un',
        quantidade: Math.max(0, parseInt(String(novoProduto.quantidade).replace(/\D/g, ''), 10) || 0)
      });
      setNovoProduto({ categoria_id: '', nome: '', unidade: '', quantidade: '0' });
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
          </div>
          <button type="submit" className="estoque-btn-primary estoque-btn-block">
            Cadastrar produto
          </button>
        </form>
      </section>

      <section className="estoque-admin-screen-card" aria-label="Produtos cadastrados">
        <h3 className="estoque-subsection-title">Produtos cadastrados</h3>
        {loading ? (
          <p className="estoque-empty-msg">Carregando…</p>
        ) : categorias.every((c) => !c.produtos?.length) ? (
          <p className="estoque-empty-msg">Nenhum produto. Cadastre acima ou crie categorias primeiro.</p>
        ) : (
          <div className="estoque-produto-table-wrap">
            {categorias.map((cat) =>
              (cat.produtos || []).length ? (
                <div key={cat.id} className="estoque-produto-group">
                  <h4 className="estoque-produto-group-title">{cat.nome}</h4>
                  <ul className="estoque-produto-flat-list">
                    {cat.produtos!.map((p) => (
                      <li key={p.id} className="estoque-produto-flat-item">
                        <div>
                          <span className="estoque-produto-flat-nome">{p.nome}</span>
                          <span className="estoque-produto-flat-meta">
                            Qtd. {Math.max(0, Math.round(Number(p.quantidade)) || 0)}
                            {p.unidade ? ` · ${p.unidade}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="estoque-btn-danger estoque-btn-small"
                          onClick={() => excluir(p.id, p.nome)}
                        >
                          Excluir
                        </button>
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
