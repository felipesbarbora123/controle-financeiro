import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import '../Estoque.css';

interface Props {
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => Promise<void>;
  isAdmin: boolean;
  onMessage?: (msg: string | null) => void;
}

const EstoqueVisaoGeral: React.FC<Props> = ({
  categorias,
  loading,
  onReload,
  isAdmin,
  onMessage
}) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      categorias.forEach((c) => {
        if (next[c.id] === undefined) next[c.id] = true;
      });
      return next;
    });
  }, [categorias]);

  const toggleCat = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
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
      await onReload();
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
      await onReload();
    } catch {
      onMessage?.('Erro ao excluir produto.');
    }
  };

  const excluirCategoria = async (id: number) => {
    if (!window.confirm('Excluir categoria e todos os itens dentro dela?')) return;
    onMessage?.(null);
    try {
      await axios.delete(`${API_URL}/estoque/categorias/${id}`);
      await onReload();
    } catch {
      onMessage?.('Erro ao excluir categoria.');
    }
  };

  if (loading) {
    return <div className="estoque-loading">Carregando estoque…</div>;
  }

  return (
    <div className="estoque-modulo estoque-modulo--screen">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">Visão geral</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => onReload()}>
          Atualizar
        </button>
      </div>

      <section className="estoque-lista" aria-label="Itens por categoria">
        {categorias.length === 0 && (
          <p className="estoque-empty-msg">
            Nenhuma categoria cadastrada.
            {isAdmin ? ' Use o menu Cadastro de categorias.' : ' Peça ao admin para cadastrar itens.'}
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

interface QEProps {
  produto: EstoqueProduto;
  onSave: (p: EstoqueProduto, v: string) => void;
}

const QuantidadeEditor: React.FC<QEProps> = ({ produto, onSave }) => {
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
      <button type="button" className="estoque-btn-secondary estoque-btn-small" onClick={() => onSave(produto, val)}>
        Salvar
      </button>
    </div>
  );
};

export default EstoqueVisaoGeral;
