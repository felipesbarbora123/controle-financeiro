import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import '../Estoque.css';

interface Props {
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => Promise<void>;
  isAdmin: boolean;
  modoOperador?: boolean;
  onMessage?: (msg: string | null) => void;
}

/** Lista plana para não exibir categorias recolhíveis na tela de lançamento / resumo */
function flattenProdutos(categorias: EstoqueCategoria[]): EstoqueProduto[] {
  const list: EstoqueProduto[] = [];
  categorias.forEach((cat) => {
    (cat.produtos || []).forEach((p) => list.push(p));
  });
  list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return list;
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
          Para cada item, informe a <strong>quantidade</strong> contada. O campo <strong>descrição</strong> só lembra como o
          produto é contado (ex.: caixa, kg). O restaurante deste lançamento é o selecionado no topo — você só enxerga as{' '}
          <strong>lojas</strong> às quais o administrador liberou seu usuário.
        </p>
      )}

      {!modoOperador && isAdmin && (
        <p className="estoque-admin-visao-hint">
          Lista simples dos itens do restaurante selecionado. Para criar categorias ou cadastrar produtos, use as abas
          acima.
        </p>
      )}

      <section className="estoque-lista estoque-lista--plana" aria-label="Itens de estoque">
        {vazio ? (
          <p className="estoque-empty-msg">
            {categorias.length === 0
              ? `Nenhuma categoria cadastrada.${isAdmin ? ' Use a aba Categorias.' : ' Peça ao admin para cadastrar itens.'}`
              : 'Nenhum produto neste restaurante.'}
          </p>
        ) : modoOperador ? (
          <ul className="estoque-lista-plana">
            {produtosPlano.map((p) => (
              <li key={p.id} className="estoque-produto estoque-produto--card estoque-produto--simple">
                <div className="estoque-item-detalhe">
                  <div className="estoque-item-linha">
                    <span className="estoque-item-rotulo">Item</span>
                    <span className="estoque-item-valor estoque-item-valor--nome">{p.nome}</span>
                  </div>
                  <div className="estoque-item-linha">
                    <span className="estoque-item-rotulo">Descrição</span>
                    <span className="estoque-item-valor estoque-item-valor--desc">{p.unidade || '—'}</span>
                  </div>
                  <div className="estoque-item-linha estoque-item-linha--qtd">
                    <span className="estoque-item-rotulo">Quantidade</span>
                    <QuantidadeEditor produto={p} onSave={salvarQuantidade} mostrarRotulo={false} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="estoque-lista-plana estoque-lista-plana--admin">
            {produtosPlano.map((p) => (
              <li key={p.id} className="estoque-produto estoque-produto--admin-linha">
                <div className="estoque-produto-info estoque-produto-info--simples">
                  <span className="estoque-produto-nome">{p.nome}</span>
                  <span className="estoque-produto-desc-label">Descrição:</span>
                  <span className="estoque-produto-un">{p.unidade || '—'}</span>
                </div>
                <div className="estoque-produto-acoes-qtd">
                  <QuantidadeEditor produto={p} onSave={salvarQuantidade} />
                  {isAdmin && (
                    <button
                      type="button"
                      className="estoque-btn-danger estoque-btn-small estoque-produto-excluir"
                      onClick={() => excluirProduto(p.id)}
                    >
                      Excluir
                    </button>
                  )}
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
  mostrarRotulo?: boolean;
}

const QuantidadeEditor: React.FC<QEProps> = ({ produto, onSave, mostrarRotulo = true }) => {
  const [val, setVal] = useState(String(produto.quantidade ?? ''));
  useEffect(() => {
    setVal(String(produto.quantidade ?? ''));
  }, [produto.id, produto.quantidade]);

  return (
    <div className={`estoque-qtd-row ${mostrarRotulo ? '' : 'estoque-qtd-row--inline'}`}>
      {mostrarRotulo && (
        <label className="estoque-qtd-label-visivel" htmlFor={`qtd-${produto.id}`}>
          Quantidade
        </label>
      )}
      <div className="estoque-qtd-controls">
        <input
          id={`qtd-${produto.id}`}
          className="estoque-input estoque-input-qtd"
          inputMode="decimal"
          autoComplete="off"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            if (val !== String(produto.quantidade)) {
              onSave(produto, val);
            }
          }}
          aria-label={`Quantidade de ${produto.nome}`}
        />
        <button type="button" className="estoque-btn-primary estoque-btn-small" onClick={() => onSave(produto, val)}>
          Salvar
        </button>
      </div>
    </div>
  );
};

export default EstoqueVisaoGeral;
