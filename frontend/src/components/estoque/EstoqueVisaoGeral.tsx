import React, { useMemo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import { IconSave, IconTrash } from './EstoqueIcons';
import '../Estoque.css';

interface Props {
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => Promise<void>;
  isAdmin: boolean;
  modoOperador?: boolean;
  onMessage?: (msg: string | null) => void;
}

function flattenProdutos(categorias: EstoqueCategoria[]): EstoqueProduto[] {
  const list: EstoqueProduto[] = [];
  categorias.forEach((cat) => {
    (cat.produtos || []).forEach((p) => list.push(p));
  });
  list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return list;
}

/** Exibe quantidade como inteiro */
function qtdeInt(q: string | number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(q)) || 0);
  return String(n);
}

const EstoqueVisaoGeral: React.FC<Props> = ({
  categorias,
  loading,
  onReload,
  isAdmin,
  modoOperador = false,
  onMessage
}) => {
  const produtosPlano = useMemo(() => flattenProdutos(categorias), [categorias]);

  const salvarQuantidade = async (produto: EstoqueProduto, valorTexto: string) => {
    const s = String(valorTexto).trim();
    if (s === '' || !/^\d+$/.test(s)) {
      onMessage?.('Informe uma quantidade inteira (sem decimais).');
      return;
    }
    const q = parseInt(s, 10);
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

  if (loading) {
    return <div className="estoque-loading">Carregando estoque…</div>;
  }

  const tituloTela = modoOperador ? 'Lançar estoque' : 'Itens';

  const vazio = categorias.length === 0 || produtosPlano.length === 0;

  return (
    <div className="estoque-modulo estoque-modulo--screen">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">{tituloTela}</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => onReload()}>
          Atualizar
        </button>
      </div>

      {modoOperador && (
        <p className="estoque-operador-ajuda">
          A <strong>quantidade</strong> é sempre um número inteiro (sem vírgula ou ponto). A <strong>descrição</strong>{' '}
          lembra como o produto é contado. O restaurante é o selecionado no topo — você só vê as <strong>lojas</strong>{' '}
          liberadas pelo administrador.
        </p>
      )}

      {!modoOperador && isAdmin && (
        <p className="estoque-admin-visao-hint">
          Quantidades inteiras. Para categorias e cadastro de produtos, use as abas acima.
        </p>
      )}

      <section className="estoque-lista estoque-lista--plana" aria-label="Itens de estoque">
        {vazio ? (
          <p className="estoque-empty-msg">
            {categorias.length === 0
              ? `Nenhuma categoria cadastrada.${isAdmin ? ' Use a aba Categorias.' : ' Peça ao admin para cadastrar itens.'}`
              : 'Nenhum produto neste restaurante.'}
          </p>
        ) : (
          <ul className="estoque-lista-plana estoque-lista-plana--admin">
            {produtosPlano.map((p) => (
              <li key={p.id} className="estoque-produto estoque-produto--admin-linha">
                <div className="estoque-admin-linha-conteudo">
                  <div className="estoque-produto-info estoque-produto-info--simples">
                    <span className="estoque-produto-nome">{p.nome}</span>
                    <span className="estoque-produto-desc-inline">
                      <span className="estoque-produto-desc-label">Descrição</span>
                      <span className="estoque-produto-un">{p.unidade || '—'}</span>
                    </span>
                  </div>
                  <div className="estoque-admin-linha-acoes">
                    <QuantidadeEditor produto={p} onSave={salvarQuantidade} />
                    {isAdmin && (
                      <button
                        type="button"
                        className="estoque-btn-icon estoque-btn-icon--danger"
                        title="Excluir item"
                        aria-label={`Excluir ${p.nome}`}
                        onClick={() => excluirProduto(p.id)}
                      >
                        <IconTrash width={20} height={20} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

interface QEProps {
  produto: EstoqueProduto;
  onSave: (p: EstoqueProduto, v: string) => void;
}

const QuantidadeEditor: React.FC<QEProps> = ({ produto, onSave }) => {
  const synced = qtdeInt(produto.quantidade);
  const [val, setVal] = useState(synced);

  useEffect(() => {
    setVal(qtdeInt(produto.quantidade));
  }, [produto.id, produto.quantidade]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setVal(onlyDigits);
  }, []);

  const doSave = useCallback(() => {
    onSave(produto, val);
  }, [onSave, produto, val]);

  return (
    <div className="estoque-qtd-editor estoque-qtd-editor--admin">
      <label className="estoque-qtd-editor-label" htmlFor={`qtd-${produto.id}`}>
        Qtd.
      </label>
      <input
        id={`qtd-${produto.id}`}
        className="estoque-input estoque-input-qtd estoque-input-qtd--int"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={val}
        onChange={onInputChange}
        aria-label={`Quantidade inteira de ${produto.nome}`}
      />
      <button
        type="button"
        className="estoque-btn-icon estoque-btn-icon--primary"
        title="Salvar quantidade"
        aria-label={`Salvar quantidade de ${produto.nome}`}
        onClick={doSave}
      >
        <IconSave width={20} height={20} />
      </button>
    </div>
  );
};

export default EstoqueVisaoGeral;
