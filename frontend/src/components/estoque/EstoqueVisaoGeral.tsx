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

/** Categorias que têm ao menos um produto, com produtos ordenados por nome */
function categoriasComProdutosOrdenadas(categorias: EstoqueCategoria[]): EstoqueCategoria[] {
  return categorias
    .map((c) => ({
      ...c,
      produtos: [...(c.produtos || [])].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
      )
    }))
    .filter((c) => c.produtos.length > 0);
}

function qtdeInt(q: string | number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(q)) || 0);
  return String(n);
}

interface LinhaProps {
  produto: EstoqueProduto;
  salvarQuantidade: (produto: EstoqueProduto, valorTexto: string) => void | Promise<void>;
  isAdmin: boolean;
  excluirProduto: (id: number) => void | Promise<void>;
}

const LinhaItemEstoque: React.FC<LinhaProps> = ({ produto, salvarQuantidade, isAdmin, excluirProduto }) => (
  <li className="estoque-produto estoque-produto--admin-linha">
    <div className="estoque-admin-linha-conteudo">
      <div className="estoque-produto-info estoque-produto-info--simples">
        <span className="estoque-produto-nome">{produto.nome}</span>
        <span className="estoque-produto-desc-inline">
          <span className="estoque-produto-desc-label">Descrição</span>
          <span className="estoque-produto-un">{produto.unidade || '—'}</span>
        </span>
      </div>
      <div className="estoque-admin-linha-acoes">
        <QuantidadeEditor produto={produto} onSave={salvarQuantidade} />
        {isAdmin && (
          <button
            type="button"
            className="estoque-btn-icon estoque-btn-icon--danger"
            title="Excluir item"
            aria-label={`Excluir ${produto.nome}`}
            onClick={() => excluirProduto(produto.id)}
          >
            <IconTrash width={20} height={20} />
          </button>
        )}
      </div>
    </div>
  </li>
);

const EstoqueVisaoGeral: React.FC<Props> = ({
  categorias,
  loading,
  onReload,
  isAdmin,
  modoOperador = false,
  onMessage
}) => {
  const produtosPlano = useMemo(() => flattenProdutos(categorias), [categorias]);
  const gruposOperador = useMemo(() => categoriasComProdutosOrdenadas(categorias), [categorias]);

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

  const vazio = modoOperador
    ? categorias.length === 0 || gruposOperador.length === 0
    : categorias.length === 0 || produtosPlano.length === 0;

  const emptyMsg = (
    <p className="estoque-empty-msg">
      {categorias.length === 0
        ? `Nenhuma categoria cadastrada.${isAdmin ? ' Use a aba Categorias.' : ' Peça ao admin para cadastrar itens.'}`
        : 'Nenhum produto neste restaurante.'}
    </p>
  );

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
          Itens agrupados por <strong>categoria</strong>. A <strong>quantidade</strong> é sempre inteira. O restaurante é o
          selecionado no topo — você só vê as <strong>lojas</strong> liberadas pelo administrador.
        </p>
      )}

      {!modoOperador && isAdmin && (
        <p className="estoque-admin-visao-hint">
          Quantidades inteiras. Para categorias e cadastro de produtos, use as abas acima.
        </p>
      )}

      <section className="estoque-lista estoque-lista--plana" aria-label="Itens de estoque">
        {vazio ? (
          emptyMsg
        ) : modoOperador ? (
          <div className="estoque-operador-por-categoria">
            {gruposOperador.map((cat) => (
              <div key={cat.id} className="estoque-operador-grupo">
                <h3 className="estoque-operador-cat-titulo">{cat.nome}</h3>
                <ul className="estoque-lista-plana estoque-lista-plana--admin estoque-lista-plana--grupo">
                  {cat.produtos.map((p) => (
                    <LinhaItemEstoque
                      key={p.id}
                      produto={p}
                      salvarQuantidade={salvarQuantidade}
                      isAdmin={false}
                      excluirProduto={excluirProduto}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="estoque-lista-plana estoque-lista-plana--admin">
            {produtosPlano.map((p) => (
              <LinhaItemEstoque
                key={p.id}
                produto={p}
                salvarQuantidade={salvarQuantidade}
                isAdmin={isAdmin}
                excluirProduto={excluirProduto}
              />
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
