import React, { useMemo, useState, useCallback } from 'react';
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

function formatAtualizacao(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function filtrarCategoriasPorBusca(cats: EstoqueCategoria[], needle: string): EstoqueCategoria[] {
  const n = needle.trim().toLowerCase();
  if (!n) return cats;
  return cats
    .map((c) => ({
      ...c,
      produtos: (c.produtos || []).filter(
        (p) =>
          p.nome.toLowerCase().includes(n) ||
          (p.unidade || '').toLowerCase().includes(n) ||
          c.nome.toLowerCase().includes(n)
      )
    }))
    .filter((c) => c.produtos.length > 0);
}

interface LinhaProps {
  produto: EstoqueProduto;
  salvarMovimento: (
    produto: EstoqueProduto,
    tipo: 'entrada' | 'saida',
    valorTexto: string,
    observacao: string
  ) => void | Promise<void>;
  isAdmin: boolean;
  excluirProduto: (id: number) => void | Promise<void>;
}

function classeAtualizacao(iso?: string | null): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const dias = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (dias > 2) return 'estoque-produto--atraso-critico';
  if (dias > 1) return 'estoque-produto--atraso-alerta';
  return '';
}

const LinhaItemEstoque: React.FC<LinhaProps> = ({ produto, salvarMovimento, isAdmin, excluirProduto }) => (
  <li className={`estoque-produto estoque-produto--admin-linha ${classeAtualizacao(produto.updated_at)}`.trim()}>
    <div className="estoque-admin-linha-conteudo">
      <div className="estoque-produto-info estoque-produto-info--simples">
        <span className="estoque-produto-nome">{produto.nome}</span>
        <span className="estoque-produto-desc-inline">
          <span className="estoque-produto-desc-label">Descrição</span>
          <span className="estoque-produto-un">{produto.unidade || '—'}</span>
        </span>
        <span className="estoque-produto-atualizado" title="Última alteração da quantidade ou cadastro">
          Atual.: {formatAtualizacao(produto.updated_at)}
        </span>
      </div>
      <div className="estoque-admin-linha-acoes">
        <MovimentoEditor produto={produto} onSave={salvarMovimento} />
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
  const [busca, setBusca] = useState('');
  const categoriasFiltradas = useMemo(
    () => filtrarCategoriasPorBusca(categorias, busca),
    [categorias, busca]
  );
  const produtosPlano = useMemo(() => flattenProdutos(categoriasFiltradas), [categoriasFiltradas]);
  const gruposOperador = useMemo(() => categoriasComProdutosOrdenadas(categoriasFiltradas), [categoriasFiltradas]);

  const salvarMovimento = async (
    produto: EstoqueProduto,
    tipo: 'entrada' | 'saida',
    valorTexto: string,
    observacao: string
  ) => {
    const s = String(valorTexto).trim();
    if (s === '' || !/^\d+$/.test(s)) {
      onMessage?.('Informe uma quantidade inteira (sem decimais).');
      return;
    }
    const q = parseInt(s, 10);
    if (q <= 0) {
      onMessage?.('Quantidade deve ser maior que zero.');
      return;
    }
    onMessage?.(null);
    try {
      await axios.post(`${API_URL}/estoque/produtos/${produto.id}/movimentar`, {
        tipo,
        quantidade: q,
        observacao: (observacao || '').trim()
      });
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

  const semItensNoRestaurante = categorias.length === 0 || flattenProdutos(categorias).length === 0;
  const vazioLista =
    modoOperador
      ? categoriasFiltradas.length === 0 || gruposOperador.length === 0
      : categoriasFiltradas.length === 0 || produtosPlano.length === 0;

  const emptyMsg = (
    <p className="estoque-empty-msg">
      {categorias.length === 0
        ? `Nenhuma categoria cadastrada.${isAdmin ? ' Use a aba Categorias.' : ' Peça ao admin para cadastrar itens.'}`
        : semItensNoRestaurante
          ? 'Nenhum produto neste restaurante.'
          : 'Nenhum item corresponde à pesquisa.'}
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
          Lançamentos por entrada/saída. Item sem atualização há mais de 1 dia fica amarelo; mais de 2 dias, vermelho.
        </p>
      )}

      {!semItensNoRestaurante && (
        <div className="estoque-busca-wrap">
          <label className="estoque-busca-label" htmlFor="estoque-busca-input">
            Pesquisar
          </label>
          <input
            id="estoque-busca-input"
            type="search"
            className="estoque-input estoque-busca-input"
            placeholder="Nome, descrição ou categoria…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}

      <section className="estoque-lista estoque-lista--plana" aria-label="Itens de estoque">
        {vazioLista ? (
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
                      salvarMovimento={salvarMovimento}
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
                salvarMovimento={salvarMovimento}
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
  onSave: (p: EstoqueProduto, tipo: 'entrada' | 'saida', v: string, observacao: string) => void;
}

const MovimentoEditor: React.FC<QEProps> = ({ produto, onSave }) => {
  const [val, setVal] = useState('1');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [observacao, setObservacao] = useState('');

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setVal(onlyDigits === '' ? '' : onlyDigits);
  }, []);

  const doSave = useCallback(() => {
    onSave(produto, tipo, val, observacao);
    setVal('1');
    setObservacao('');
  }, [onSave, produto, tipo, val, observacao]);

  return (
    <div className="estoque-qtd-editor estoque-qtd-editor--admin">
      <select
        className="estoque-input estoque-input--mov-tipo"
        value={tipo}
        onChange={(e) => setTipo(e.target.value === 'entrada' ? 'entrada' : 'saida')}
        aria-label={`Tipo de lançamento para ${produto.nome}`}
      >
        <option value="saida">Saída</option>
        <option value="entrada">Entrada</option>
      </select>
      <input
        id={`qtd-${produto.id}`}
        className="estoque-input estoque-input-qtd estoque-input-qtd--int"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={val}
        onChange={onInputChange}
        aria-label={`Quantidade do lançamento para ${produto.nome}`}
      />
      <input
        className="estoque-input estoque-input--mov-obs"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Obs. (opcional)"
        aria-label={`Observação do lançamento para ${produto.nome}`}
      />
      <button
        type="button"
        className="estoque-btn-icon estoque-btn-icon--primary"
        title="Lançar movimento"
        aria-label={`Lançar movimento de ${produto.nome}`}
        onClick={doSave}
      >
        <IconSave width={20} height={20} />
      </button>
    </div>
  );
};

export default EstoqueVisaoGeral;
