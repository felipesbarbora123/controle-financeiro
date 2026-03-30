import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './Estoque.css';

export interface EstoqueProduto {
  id: number;
  restaurante_id: number;
  categoria_id: number;
  nome: string;
  unidade: string;
  quantidade: string | number;
}

export interface EstoqueCategoria {
  id: number;
  restaurante_id: number;
  nome: string;
  ordem: number;
  produtos: EstoqueProduto[];
}

interface EstoqueAgrupadoResponse {
  restaurante_id: number;
  categorias: EstoqueCategoria[];
}

const UNIDADES_SUGERIDAS = ['un', 'kg', 'g', 'lt', 'ml', 'cx', 'fd', 'pct', 'dz'];

interface EstoqueProps {
  restauranteId: number | null;
  isAdmin: boolean;
  onMessage?: (msg: string | null) => void;
}

const Estoque: React.FC<EstoqueProps> = ({ restauranteId, isAdmin, onMessage }) => {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<EstoqueCategoria[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [novaCategoria, setNovaCategoria] = useState('');
  const [novoProduto, setNovoProduto] = useState({
    categoria_id: '' as string | number,
    nome: '',
    unidade: 'un',
    quantidade: '0'
  });

  const carregar = useCallback(async () => {
    if (!restauranteId) {
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
      const exp: Record<number, boolean> = {};
      (data.categorias || []).forEach((c) => {
        exp[c.id] = true;
      });
      setExpanded(exp);
    } catch (e) {
      console.error(e);
      onMessage?.('Não foi possível carregar o estoque.');
    } finally {
      setLoading(false);
    }
  }, [restauranteId, onMessage]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const toggleCat = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const criarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restauranteId || !novaCategoria.trim()) return;
    onMessage?.(null);
    try {
      await axios.post(`${API_URL}/estoque/categorias`, {
        restaurante_id: restauranteId,
        nome: novaCategoria.trim()
      });
      setNovaCategoria('');
      await carregar();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao criar categoria.');
    }
  };

  const criarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restauranteId || !novoProduto.categoria_id || !novoProduto.nome.trim()) return;
    onMessage?.(null);
    try {
      await axios.post(`${API_URL}/estoque/produtos`, {
        restaurante_id: restauranteId,
        categoria_id: Number(novoProduto.categoria_id),
        nome: novoProduto.nome.trim(),
        unidade: novoProduto.unidade || 'un',
        quantidade: parseFloat(String(novoProduto.quantidade).replace(',', '.')) || 0
      });
      setNovoProduto({ categoria_id: '', nome: '', unidade: 'un', quantidade: '0' });
      await carregar();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao criar produto.');
    }
  };

  const salvarQuantidade = async (produto: EstoqueProduto, valorTexto: string) => {
    const q = parseFloat(String(valorTexto).replace(',', '.'));
    if (Number.isNaN(q)) {
      onMessage?.('Quantidade inválida.');
      return;
    }
    onMessage?.(null);
    try {
      await axios.put(`${API_URL}/estoque/produtos/${produto.id}`, { quantidade: q });
      await carregar();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao salvar quantidade.');
    }
  };

  const excluirProduto = async (id: number) => {
    if (!window.confirm('Excluir este item do estoque?')) return;
    onMessage?.(null);
    try {
      await axios.delete(`${API_URL}/estoque/produtos/${id}`);
      await carregar();
    } catch {
      onMessage?.('Erro ao excluir produto.');
    }
  };

  const excluirCategoria = async (id: number) => {
    if (!window.confirm('Excluir categoria e todos os itens dentro dela?')) return;
    onMessage?.(null);
    try {
      await axios.delete(`${API_URL}/estoque/categorias/${id}`);
      await carregar();
    } catch {
      onMessage?.('Erro ao excluir categoria.');
    }
  };

  if (!restauranteId) {
    return <div className="estoque-empty">Selecione um restaurante.</div>;
  }

  if (loading) {
    return <div className="estoque-loading">Carregando estoque…</div>;
  }

  return (
    <div className="estoque-modulo">
      <div className="estoque-toolbar">
        <button type="button" className="estoque-btn-refresh" onClick={() => carregar()}>
          Atualizar
        </button>
      </div>

      {isAdmin && (
        <section className="estoque-admin-card" aria-label="Cadastro (admin)">
          <h2 className="estoque-section-title">Cadastro (admin)</h2>
          <form onSubmit={criarCategoria} className="estoque-form">
            <label className="estoque-label">Nova categoria</label>
            <div className="estoque-form-row">
              <input
                className="estoque-input"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Ex.: Frios, Bebidas…"
              />
              <button type="submit" className="estoque-btn-primary">
                Adicionar
              </button>
            </div>
          </form>
          <form onSubmit={criarProduto} className="estoque-form">
            <label className="estoque-label">Novo produto</label>
            <select
              className="estoque-input"
              value={novoProduto.categoria_id}
              onChange={(e) => setNovoProduto((p) => ({ ...p, categoria_id: e.target.value }))}
              required
            >
              <option value="">Categoria…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <input
              className="estoque-input"
              value={novoProduto.nome}
              onChange={(e) => setNovoProduto((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Nome do item"
              required
            />
            <div className="estoque-form-row">
              <select
                className="estoque-input estoque-input-un"
                value={novoProduto.unidade}
                onChange={(e) => setNovoProduto((p) => ({ ...p, unidade: e.target.value }))}
              >
                {UNIDADES_SUGERIDAS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                className="estoque-input"
                inputMode="decimal"
                value={novoProduto.quantidade}
                onChange={(e) => setNovoProduto((p) => ({ ...p, quantidade: e.target.value }))}
                placeholder="Qtd inicial"
              />
            </div>
            <button type="submit" className="estoque-btn-primary estoque-btn-block">
              Cadastrar produto
            </button>
          </form>
        </section>
      )}

      <section className="estoque-lista" aria-label="Itens por categoria">
        <h2 className="estoque-section-title">Estoque por categoria</h2>
        {categorias.length === 0 && (
          <p className="estoque-empty-msg">
            Nenhuma categoria cadastrada.
            {isAdmin ? ' Use o formulário acima para criar.' : ' Peça ao admin para cadastrar itens.'}
          </p>
        )}
        {categorias.map((cat) => (
          <div key={cat.id} className="estoque-categoria">
            <button
              type="button"
              className="estoque-categoria-header"
              onClick={() => toggleCat(cat.id)}
              aria-expanded={expanded[cat.id]}
            >
              <span className="estoque-categoria-nome">{cat.nome}</span>
              <span className="estoque-categoria-badge">{cat.produtos?.length || 0}</span>
              <span className="estoque-chevron">{expanded[cat.id] ? '▼' : '▶'}</span>
            </button>
            {expanded[cat.id] && (
              <ul className="estoque-produtos">
                {(cat.produtos || []).map((p) => (
                  <li key={p.id} className="estoque-produto">
                    <div className="estoque-produto-info">
                      <span className="estoque-produto-nome">{p.nome}</span>
                      <span className="estoque-produto-un">{p.unidade}</span>
                    </div>
                    <QuantidadeEditor produto={p} onSave={salvarQuantidade} />
                    {isAdmin && (
                      <button
                        type="button"
                        className="estoque-btn-danger estoque-btn-small"
                        onClick={() => excluirProduto(p.id)}
                      >
                        Excluir
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && expanded[cat.id] && (
              <div className="estoque-cat-actions">
                <button
                  type="button"
                  className="estoque-btn-danger estoque-btn-small"
                  onClick={() => excluirCategoria(cat.id)}
                >
                  Excluir categoria
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};

interface QuantidadeEditorProps {
  produto: EstoqueProduto;
  onSave: (p: EstoqueProduto, v: string) => void;
}

const QuantidadeEditor: React.FC<QuantidadeEditorProps> = ({ produto, onSave }) => {
  const [val, setVal] = useState(String(produto.quantidade ?? ''));
  useEffect(() => {
    setVal(String(produto.quantidade ?? ''));
  }, [produto.id, produto.quantidade]);

  return (
    <div className="estoque-qtd-row">
      <label className="estoque-sr-only" htmlFor={`qtd-${produto.id}`}>
        Quantidade
      </label>
      <input
        id={`qtd-${produto.id}`}
        className="estoque-input estoque-input-qtd"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val !== String(produto.quantidade)) {
            onSave(produto, val);
          }
        }}
      />
      <button
        type="button"
        className="estoque-btn-secondary estoque-btn-small"
        onClick={() => onSave(produto, val)}
      >
        Salvar
      </button>
    </div>
  );
};

export default Estoque;
