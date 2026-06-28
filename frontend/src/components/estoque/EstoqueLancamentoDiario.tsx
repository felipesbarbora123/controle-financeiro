import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import {
  CAMPOS_LANCAMENTO_DIARIO,
  type CampoLancamentoDiario,
  type LancamentoDiarioApi,
  type LinhaLancamentoDiario,
  apiParaLinha,
  dataIsoParaPicker,
  formatarDataExibicao,
  linhaVaziaLancamentoDiario,
  parseDataParaBanco,
  pickerParaTextoBr
} from './estoqueLancamentoDiarioUtils';
import { IconTrash } from './EstoqueIcons';
import '../Estoque.css';
import './EstoqueLancamentoDiario.css';

interface Props {
  restauranteId: number;
  restaurantes: Array<{ id: number; nome: string }>;
  onMessage?: (msg: string | null) => void;
}

const EstoqueLancamentoDiario: React.FC<Props> = ({ restauranteId, restaurantes, onMessage }) => {
  const [linhas, setLinhas] = useState<LinhaLancamentoDiario[]>([]);
  const [filtroRestaurante, setFiltroRestaurante] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const [campoEditando, setCampoEditando] = useState<CampoLancamentoDiario | null>(null);
  const tabPressionadoRef = useRef(false);
  const restaurantesOrdenados = useMemo(
    () => [...restaurantes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    [restaurantes]
  );
  const restauranteNomePorId = useMemo(() => {
    const map = new Map<number, string>();
    restaurantesOrdenados.forEach((r) => map.set(r.id, r.nome));
    return map;
  }, [restaurantesOrdenados]);

  const restaurantePadraoLinha = useCallback(() => {
    if (filtroRestaurante !== 'todos') {
      const rid = parseInt(filtroRestaurante, 10);
      if (!Number.isNaN(rid)) return rid;
    }
    return restauranteId;
  }, [filtroRestaurante, restauranteId]);

  const carregar = useCallback(
    async (focarNovaLinha = false) => {
      setLoading(true);
      onMessage?.(null);
      try {
        const queryRestaurante =
          filtroRestaurante === 'todos'
            ? ''
            : `?restaurante_id=${encodeURIComponent(filtroRestaurante)}`;
        const { data } = await axios.get<LancamentoDiarioApi[]>(
          `${API_URL}/estoque/lancamentos-diarios${queryRestaurante}`
        );
        const ordenadas = (data || [])
          .map(apiParaLinha)
          .sort((a, b) => {
            const da = a.data_lancamento || '';
            const db = b.data_lancamento || '';
            if (da !== db) return db.localeCompare(da);
            return (b.id || 0) - (a.id || 0);
          });
        const comVazia = [...ordenadas, linhaVaziaLancamentoDiario(restaurantePadraoLinha())];
        setLinhas(comVazia);
        if (focarNovaLinha) {
          const idx = comVazia.length - 1;
          window.setTimeout(() => {
            setEditando(idx);
            setCampoEditando('restaurante');
          }, 80);
        }
      } catch {
        onMessage?.('Não foi possível carregar os lançamentos diários.');
        setLinhas([linhaVaziaLancamentoDiario(restaurantePadraoLinha())]);
      } finally {
        setLoading(false);
      }
    },
    [filtroRestaurante, onMessage, restaurantePadraoLinha]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (editando === null || !campoEditando) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-ld-linha="${editando}"][data-ld-campo="${campoEditando}"]`
      );
      el?.focus();
      if (el instanceof HTMLInputElement && el.type === 'text') {
        el.select();
      }
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    return () => window.clearTimeout(t);
  }, [editando, campoEditando]);

  const iniciarEdicao = (linhaIndex: number, campo: CampoLancamentoDiario) => {
    setLinhas((prev) => {
      const next = [...prev];
      const linha = next[linhaIndex];
      if (!linha) return prev;
      if (campo === 'data' && linha.dataTexto === undefined) {
        next[linhaIndex] = {
          ...linha,
          dataTexto: formatarDataExibicao(linha.data_lancamento) || ''
        };
      }
      return next;
    });
    setEditando(linhaIndex);
    setCampoEditando(campo);
  };

  const finalizarEdicao = () => {
    setEditando(null);
    setCampoEditando(null);
  };

  const atualizarLinha = (linhaIndex: number, campo: CampoLancamentoDiario, valor: string) => {
    setLinhas((prev) => {
      const next = [...prev];
      const linha = { ...next[linhaIndex] };
      if (campo === 'restaurante') {
        const rid = parseInt(valor, 10);
        linha.restaurante_id = Number.isNaN(rid) ? null : rid;
      } else if (campo === 'produto') linha.produto = valor;
      else if (campo === 'quantidade') linha.quantidade = valor;
      else if (campo === 'data') {
        linha.dataTexto = valor;
        const iso = parseDataParaBanco(valor);
        if (iso) linha.data_lancamento = iso;
      }
      next[linhaIndex] = linha;
      return next;
    });
  };

  const salvarLinha = async (linhaIndex: number, recarregar = false, focarNovaLinha = false) => {
    const linha = linhas[linhaIndex];
    if (!linha) return;
    const produto = linha.produto.trim();
    if (!produto) return;
    const rid = linha.restaurante_id || restaurantePadraoLinha();
    if (!rid) {
      onMessage?.('Selecione um restaurante para salvar o lançamento.');
      return;
    }

    const dataIso = parseDataParaBanco(linha.dataTexto ?? formatarDataExibicao(linha.data_lancamento));
    const body = {
      restaurante_id: rid,
      produto,
      data_lancamento: dataIso,
      quantidade: linha.quantidade
    };

    try {
      if (linha.id) {
        await axios.put(`${API_URL}/estoque/lancamentos-diarios/${linha.id}`, body);
      } else {
        await axios.post(`${API_URL}/estoque/lancamentos-diarios`, body);
      }
      if (recarregar) {
        await carregar(focarNovaLinha);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao salvar lançamento.');
    }
  };

  const handleBlur = async (linhaIndex: number) => {
    if (tabPressionadoRef.current) return;
    await salvarLinha(linhaIndex, true);
    finalizarEdicao();
  };

  const navegarTab = (linhaIndex: number, campo: CampoLancamentoDiario) => {
    const idx = CAMPOS_LANCAMENTO_DIARIO.indexOf(campo);
    if (idx < CAMPOS_LANCAMENTO_DIARIO.length - 1) {
      iniciarEdicao(linhaIndex, CAMPOS_LANCAMENTO_DIARIO[idx + 1]);
      window.setTimeout(() => {
        tabPressionadoRef.current = false;
      }, 120);
      return;
    }

    salvarLinha(linhaIndex, true, true).finally(() => {
      window.setTimeout(() => {
        tabPressionadoRef.current = false;
      }, 120);
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    linhaIndex: number,
    campo: CampoLancamentoDiario
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      tabPressionadoRef.current = true;
      navegarTab(linhaIndex, campo);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      tabPressionadoRef.current = false;
      salvarLinha(linhaIndex, true).then(() => {
        const prox = linhaIndex + 1;
        if (prox < linhas.length) {
          iniciarEdicao(prox, campo);
        } else {
          finalizarEdicao();
        }
      });
    } else if (e.key === 'Escape') {
      finalizarEdicao();
    }
  };

  const excluirLinha = async (linhaIndex: number) => {
    const linha = linhas[linhaIndex];
    if (!linha) return;
    if (linha.id) {
      if (!window.confirm('Excluir este lançamento?')) return;
      try {
        await axios.delete(`${API_URL}/estoque/lancamentos-diarios/${linha.id}`);
        await carregar();
      } catch {
        onMessage?.('Erro ao excluir lançamento.');
      }
    } else {
      setLinhas((prev) => prev.filter((_, i) => i !== linhaIndex));
    }
  };

  const estaEditando = (linhaIndex: number, campo: CampoLancamentoDiario) =>
    editando === linhaIndex && campoEditando === campo;

  return (
    <div className="estoque-modulo estoque-modulo--screen estoque-ld-wrap">
      <div className="estoque-ld-toolbar">
        <h2 className="estoque-screen-title">Lançamento diário</h2>
        <label className="estoque-ld-filter">
          <span>Restaurante</span>
          <select
            value={filtroRestaurante}
            onChange={(e) => setFiltroRestaurante(e.target.value)}
            className="estoque-ld-input"
          >
            <option value="todos">Todos</option>
            {restaurantesOrdenados.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="estoque-btn-refresh" onClick={() => carregar()}>
          Atualizar
        </button>
      </div>

      <p className="estoque-ld-hint">
        Planilha simplificada: digite produto, data e quantidade em texto livre. Use <strong>Tab</strong> para
        avançar entre os campos e para a próxima linha. A data pode ser digitada ou escolhida no calendário.
      </p>

      <div className="estoque-ld-grid" aria-label="Lançamentos diários">
        <div className="estoque-ld-header" role="row">
          <div className="estoque-ld-cell">Restaurante</div>
          <div className="estoque-ld-cell">Produto</div>
          <div className="estoque-ld-cell">Data</div>
          <div className="estoque-ld-cell">Quantidade</div>
          <div className="estoque-ld-cell" aria-hidden />
        </div>

        <div className="estoque-ld-body">
          {loading ? (
            <div className="estoque-ld-row">
              <div className="estoque-ld-cell" style={{ gridColumn: '1 / -1' }}>
                <span className="estoque-empty-msg">Carregando…</span>
              </div>
            </div>
          ) : (
            linhas.map((linha, linhaIndex) => (
              <div
                key={linha.id ?? `new-${linhaIndex}`}
                className={`estoque-ld-row ${linha.id ? '' : 'estoque-ld-row--nova'}`}
                role="row"
              >
                <div className="estoque-ld-cell" data-label="Restaurante">
                  {estaEditando(linhaIndex, 'restaurante') ? (
                    <select
                      className="estoque-ld-input"
                      value={linha.restaurante_id ?? restaurantePadraoLinha() ?? ''}
                      onChange={(e) => atualizarLinha(linhaIndex, 'restaurante', e.target.value)}
                      onBlur={() => handleBlur(linhaIndex)}
                      onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'restaurante')}
                      data-ld-linha={linhaIndex}
                      data-ld-campo="restaurante"
                      autoFocus
                    >
                      {restaurantesOrdenados.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      className={`estoque-ld-cell-content ${!linha.restaurante_id ? 'estoque-ld-cell-content--placeholder' : ''}`}
                      onClick={() => iniciarEdicao(linhaIndex, 'restaurante')}
                    >
                      {linha.restaurante_id
                        ? restauranteNomePorId.get(linha.restaurante_id) || `Restaurante #${linha.restaurante_id}`
                        : 'Clique para escolher'}
                    </div>
                  )}
                </div>

                <div className="estoque-ld-cell" data-label="Produto">
                  {estaEditando(linhaIndex, 'produto') ? (
                    <input
                      type="text"
                      className="estoque-ld-input"
                      value={linha.produto}
                      onChange={(e) => atualizarLinha(linhaIndex, 'produto', e.target.value)}
                      onBlur={() => handleBlur(linhaIndex)}
                      onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'produto')}
                      data-ld-linha={linhaIndex}
                      data-ld-campo="produto"
                      placeholder="Nome do produto"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={`estoque-ld-cell-content ${!linha.produto ? 'estoque-ld-cell-content--placeholder' : ''}`}
                      onClick={() => iniciarEdicao(linhaIndex, 'produto')}
                    >
                      {linha.produto || 'Clique para digitar'}
                    </div>
                  )}
                </div>

                <div className="estoque-ld-cell" data-label="Data">
                  {estaEditando(linhaIndex, 'data') ? (
                    <div className="estoque-ld-data-edit">
                      <input
                        type="text"
                        className="estoque-ld-input"
                        value={linha.dataTexto ?? formatarDataExibicao(linha.data_lancamento)}
                        onChange={(e) => atualizarLinha(linhaIndex, 'data', e.target.value)}
                        onBlur={() => handleBlur(linhaIndex)}
                        onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'data')}
                        data-ld-linha={linhaIndex}
                        data-ld-campo="data"
                        placeholder="DD/MM/AAAA"
                        autoFocus
                      />
                      <input
                        type="date"
                        className="estoque-ld-data-picker"
                        value={dataIsoParaPicker(linha.data_lancamento, linha.dataTexto)}
                        onChange={(e) => {
                          const br = pickerParaTextoBr(e.target.value);
                          atualizarLinha(linhaIndex, 'data', br);
                        }}
                        aria-label="Selecionar data no calendário"
                        tabIndex={-1}
                      />
                    </div>
                  ) : (
                    <div
                      className={`estoque-ld-cell-content ${!linha.data_lancamento && !linha.dataTexto ? 'estoque-ld-cell-content--placeholder' : ''}`}
                      onClick={() => iniciarEdicao(linhaIndex, 'data')}
                    >
                      {formatarDataExibicao(linha.data_lancamento) ||
                        linha.dataTexto ||
                        'Clique para digitar'}
                    </div>
                  )}
                </div>

                <div className="estoque-ld-cell" data-label="Quantidade">
                  {estaEditando(linhaIndex, 'quantidade') ? (
                    <input
                      type="text"
                      className="estoque-ld-input"
                      value={linha.quantidade}
                      onChange={(e) => atualizarLinha(linhaIndex, 'quantidade', e.target.value)}
                      onBlur={() => handleBlur(linhaIndex)}
                      onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'quantidade')}
                      data-ld-linha={linhaIndex}
                      data-ld-campo="quantidade"
                      placeholder="Ex.: 2 cx"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={`estoque-ld-cell-content ${!linha.quantidade ? 'estoque-ld-cell-content--placeholder' : ''}`}
                      onClick={() => iniciarEdicao(linhaIndex, 'quantidade')}
                    >
                      {linha.quantidade || 'Clique para digitar'}
                    </div>
                  )}
                </div>

                <div className="estoque-ld-cell estoque-ld-cell--acoes" data-label="Ações">
                  {(linha.id || linha.produto.trim()) && (
                    <button
                      type="button"
                      className="estoque-ld-btn-del"
                      title="Excluir linha"
                      aria-label="Excluir linha"
                      onClick={() => excluirLinha(linhaIndex)}
                    >
                      <IconTrash width={18} height={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EstoqueLancamentoDiario;
