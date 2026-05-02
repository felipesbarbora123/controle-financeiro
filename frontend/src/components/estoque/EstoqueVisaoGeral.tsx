import React, { useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { movimentarProduto } from '../../lib/estoqueMovimentarApi';
import type { EstoqueCategoria, EstoqueProduto } from './estoqueTypes';
import { IconTrash } from './EstoqueIcons';
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
  ) => Promise<void>;
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

function saldoInteiroProduto(p: EstoqueProduto): number {
  return Math.max(0, Math.round(Number(p.quantidade)) || 0);
}

const LinhaItemEstoque: React.FC<LinhaProps> = ({ produto, salvarMovimento, isAdmin, excluirProduto }) => (
  <li className={`estoque-item-card estoque-produto--admin-linha ${classeAtualizacao(produto.updated_at)}`.trim()}>
    <div className="estoque-item-card-top">
      <div className="estoque-item-card-identidade">
        <h3 className="estoque-item-card-nome">{produto.nome}</h3>
        <p className="estoque-item-card-meta">
          <span className="estoque-item-card-meta-label">Como contar / unidade</span>{' '}
          <span className="estoque-item-card-meta-valor">{produto.unidade?.trim() || '—'}</span>
          <span className="estoque-item-card-meta-sep" aria-hidden="true">
            {' · '}
          </span>
          <span className="estoque-item-card-meta-label">Última alteração</span>{' '}
          <span className="estoque-item-card-meta-valor">{formatAtualizacao(produto.updated_at)}</span>
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          className="estoque-btn-icon estoque-btn-icon--danger estoque-item-card-excluir"
          title="Excluir item"
          aria-label={`Excluir ${produto.nome}`}
          onClick={() => excluirProduto(produto.id)}
        >
          <IconTrash width={20} height={20} />
        </button>
      )}
    </div>

    <div className="estoque-item-card-saldo-destaque" aria-live="polite">
      <span className="estoque-item-card-saldo-rotulo">Quantidade em estoque agora</span>
      <span className="estoque-item-card-saldo-numero">{saldoInteiroProduto(produto)}</span>
    </div>

    <MovimentoEditorEntradaSaida produto={produto} onSave={salvarMovimento} />
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
      throw new Error('VALIDACAO');
    }
    const q = parseInt(s, 10);
    if (q <= 0) {
      onMessage?.('Quantidade deve ser maior que zero.');
      throw new Error('VALIDACAO');
    }
    onMessage?.(null);
    try {
      await movimentarProduto(
        produto.id,
        { tipo, quantidade: q, observacao: (observacao || '').trim() },
        Number(produto.quantidade)
      );
      await onReload();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao salvar quantidade.');
      throw err;
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
    <div className="estoque-modulo estoque-modulo--screen estoque-modulo--lista-itens">
      <div className="estoque-toolbar estoque-toolbar--with-title">
        <h2 className="estoque-screen-title">{tituloTela}</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => onReload()}>
          Atualizar
        </button>
      </div>

      {modoOperador && (
        <p className="estoque-operador-ajuda">
          Use <strong>Registrar entrada</strong> para o que chegou (soma ao número em estoque) e <strong>Registrar saída</strong> para o
          que saiu (subtrai). O número digitado não é o total final — só o deste lançamento. Confira o restaurante no topo da tela.
        </p>
      )}

      {!modoOperador && isAdmin && (
        <p className="estoque-admin-visao-hint">
          Cada cartão mostra o <strong>estoque atual</strong> e dois blocos: entrada (soma) e saída (subtrai). Itens sem atualização há
          mais de 1 dia (fundo amarelo) ou 2 (fundo rosado).
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
  onSave: (p: EstoqueProduto, tipo: 'entrada' | 'saida', v: string, observacao: string) => Promise<void>;
}

function digitsOnly(v: string): string {
  const d = v.replace(/\D/g, '');
  return d === '' ? '' : d;
}

const MovimentoEditorEntradaSaida: React.FC<QEProps> = ({ produto, onSave }) => {
  const [qEntrada, setQEntrada] = useState('1');
  const [qSaida, setQSaida] = useState('1');
  const [observacao, setObservacao] = useState('');
  const saldoAtual = useMemo(() => saldoInteiroProduto(produto), [produto.quantidade]);

  const previewEntrada = useMemo(() => {
    const s = String(qEntrada).trim();
    if (!/^\d+$/.test(s)) return null;
    const q = parseInt(s, 10);
    if (q <= 0) return null;
    return saldoAtual + q;
  }, [qEntrada, saldoAtual]);

  const previewSaida = useMemo(() => {
    const s = String(qSaida).trim();
    if (!/^\d+$/.test(s)) return null;
    const q = parseInt(s, 10);
    if (q <= 0) return null;
    const depois = saldoAtual - q;
    return { depois, erro: depois < 0 };
  }, [qSaida, saldoAtual]);

  const setPresetEntrada = useCallback((n: number) => setQEntrada(String(n)), []);
  const setPresetSaida = useCallback((n: number) => setQSaida(String(n)), []);

  const registrarEntrada = useCallback(async () => {
    try {
      await onSave(produto, 'entrada', qEntrada, observacao);
      setQEntrada('1');
      setObservacao('');
    } catch {
      /* validação ou API: mensagem já exibida pelo pai */
    }
  }, [onSave, produto, qEntrada, observacao]);

  const registrarSaida = useCallback(async () => {
    try {
      await onSave(produto, 'saida', qSaida, observacao);
      setQSaida('1');
      setObservacao('');
    } catch {
      /* validação ou API: mensagem já exibida pelo pai */
    }
  }, [onSave, produto, qSaida, observacao]);

  const idE = `estoque-entrada-qtd-${produto.id}`;
  const idS = `estoque-saida-qtd-${produto.id}`;
  const idObs = `estoque-obs-${produto.id}`;

  return (
    <div className="estoque-item-card-movimentos">
      <div className="estoque-mov-duas-colunas">
        <div className="estoque-mov-bloco estoque-mov-bloco--entrada">
          <span className="estoque-mov-bloco-titulo">Entrada</span>
          <p className="estoque-mov-bloco-texto">Somará ao estoque acima (compras, reposição…).</p>
          <label className="estoque-mov-bloco-label" htmlFor={idE}>
            Quantidade que entra neste lançamento
          </label>
          <div className="estoque-mov-bloco-linha-qtd">
            <input
              id={idE}
              className="estoque-input estoque-input-qtd estoque-input-qtd--int estoque-mov-bloco-input"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={qEntrada}
              onChange={(e) => setQEntrada(digitsOnly(e.target.value))}
              aria-describedby={`${idE}-ajuda`}
            />
            <div className="estoque-qtd-presets" role="group" aria-label="Valores rápidos para entrada">
              {[1, 5, 10].map((n) => (
                <button key={n} type="button" className="estoque-qtd-preset-btn" onClick={() => setPresetEntrada(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p id={`${idE}-ajuda`} className="estoque-mov-bloco-preview" role="status">
            {previewEntrada !== null ? (
              <>
                Depois desta entrada o estoque será <strong>{previewEntrada}</strong>.
              </>
            ) : (
              <span className="estoque-mov-bloco-preview--muted">Digite um número inteiro maior que zero.</span>
            )}
          </p>
          <button type="button" className="estoque-btn estoque-btn--entrada" onClick={registrarEntrada}>
            Registrar entrada
          </button>
        </div>

        <div className="estoque-mov-bloco estoque-mov-bloco--saida">
          <span className="estoque-mov-bloco-titulo">Saída</span>
          <p className="estoque-mov-bloco-texto">Subtrairá do estoque acima (uso, venda, perda…).</p>
          <label className="estoque-mov-bloco-label" htmlFor={idS}>
            Quantidade que sai neste lançamento
          </label>
          <div className="estoque-mov-bloco-linha-qtd">
            <input
              id={idS}
              className="estoque-input estoque-input-qtd estoque-input-qtd--int estoque-mov-bloco-input"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={qSaida}
              onChange={(e) => setQSaida(digitsOnly(e.target.value))}
              aria-describedby={`${idS}-ajuda`}
            />
            <div className="estoque-qtd-presets" role="group" aria-label="Valores rápidos para saída">
              {[1, 5, 10].map((n) => (
                <button key={n} type="button" className="estoque-qtd-preset-btn" onClick={() => setPresetSaida(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p id={`${idS}-ajuda`} className="estoque-mov-bloco-preview" role="status">
            {previewSaida === null ? (
              <span className="estoque-mov-bloco-preview--muted">Digite um número inteiro maior que zero.</span>
            ) : previewSaida.erro ? (
              <span className="estoque-mov-bloco-preview--erro">
                Esta saída é maior que o estoque atual ({saldoAtual}). Reduza a quantidade.
              </span>
            ) : (
              <>
                Depois desta saída o estoque será <strong>{previewSaida.depois}</strong>.
              </>
            )}
          </p>
          <button
            type="button"
            className="estoque-btn estoque-btn--saida"
            onClick={registrarSaida}
            disabled={previewSaida?.erro === true}
          >
            Registrar saída
          </button>
        </div>
      </div>

      <div className="estoque-mov-obs-wrap">
        <label className="estoque-mov-bloco-label" htmlFor={idObs}>
          Observação (opcional) — salva junto com o botão de entrada ou de saída que você apertar
        </label>
        <input
          id={idObs}
          className="estoque-input estoque-mov-obs-input"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: compra fornecedor, quebra, evento…"
          autoComplete="off"
        />
      </div>
    </div>
  );
};

export default EstoqueVisaoGeral;
