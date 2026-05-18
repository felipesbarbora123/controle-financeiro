import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../Estoque.css';

export interface EstoqueProdutoOpcao {
  id: number;
  nome: string;
  cat?: string;
}

function rotuloOpcao(o: EstoqueProdutoOpcao): string {
  const cat = o.cat?.trim();
  return cat ? `${o.nome} — ${cat}` : o.nome;
}

function normalizaBusca(s: string): string {
  return s.trim().toLowerCase();
}

function acharPorTexto(opcoes: EstoqueProdutoOpcao[], texto: string): EstoqueProdutoOpcao | undefined {
  const t = texto.trim();
  if (!t) return undefined;
  const n = normalizaBusca(t);
  return opcoes.find(
    (o) =>
      rotuloOpcao(o) === t ||
      o.nome.toLowerCase() === n ||
      (o.cat && `${o.nome} — ${o.cat}`.toLowerCase() === n)
  );
}

interface Props {
  id?: string;
  label?: string;
  value: string;
  onChange: (produtoId: string) => void;
  opcoes: EstoqueProdutoOpcao[];
  placeholder?: string;
  disabled?: boolean;
  /** Permite limpar a seleção (ex.: “todos os produtos” na movimentação). */
  permitirVazio?: boolean;
}

const EstoqueProdutoAutocomplete: React.FC<Props> = ({
  id: idProp,
  label = 'Produto',
  value,
  onChange,
  opcoes,
  placeholder = 'Digite para buscar…',
  disabled = false,
  permitirVazio = false
}) => {
  const autoId = useId();
  const inputId = idProp || `estoque-prod-autocomplete-${autoId}`;
  const listId = `${inputId}-listbox`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [listPos, setListPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selecionado = useMemo(
    () => opcoes.find((o) => String(o.id) === value),
    [opcoes, value]
  );

  const filtradas = useMemo(() => {
    const n = normalizaBusca(query);
    if (!n) return opcoes.slice(0, 50);
    return opcoes
      .filter((o) => {
        const cat = o.cat?.toLowerCase() ?? '';
        return (
          o.nome.toLowerCase().includes(n) ||
          cat.includes(n) ||
          rotuloOpcao(o).toLowerCase().includes(n)
        );
      })
      .slice(0, 50);
  }, [opcoes, query]);

  const semOpcoes = opcoes.length === 0;
  const campoDesabilitado = disabled;

  const atualizarPosLista = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setListPos({
      top: r.bottom + 4,
      left: r.left,
      width: r.width
    });
  };

  useEffect(() => {
    if (selecionado) {
      setQuery(rotuloOpcao(selecionado));
    } else if (!value) {
      setQuery('');
    }
  }, [value, selecionado]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setListPos(null);
      return;
    }
    atualizarPosLista();
    const onScroll = () => atualizarPosLista();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      const portal = document.getElementById(listId);
      if (portal?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [listId]);

  const escolher = (o: EstoqueProdutoOpcao) => {
    onChange(String(o.id));
    setQuery(rotuloOpcao(o));
    setOpen(false);
  };

  const limpar = () => {
    onChange('');
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const onInputChange = (texto: string) => {
    setQuery(texto);
    setOpen(true);
    if (!texto.trim()) {
      if (permitirVazio) onChange('');
      else if (value) onChange('');
      return;
    }
    const match = acharPorTexto(opcoes, texto);
    if (match) {
      onChange(String(match.id));
      return;
    }
    if (value) onChange('');
  };

  const onBlurInput = () => {
    window.setTimeout(() => {
      if (!query.trim()) {
        if (permitirVazio) onChange('');
        setOpen(false);
        return;
      }
      const match = acharPorTexto(opcoes, query);
      if (match) {
        onChange(String(match.id));
        setQuery(rotuloOpcao(match));
      } else if (selecionado) {
        setQuery(rotuloOpcao(selecionado));
      }
      setOpen(false);
    }, 180);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      atualizarPosLista();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      if (selecionado) setQuery(rotuloOpcao(selecionado));
      else setQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtradas.length === 0) return;
      setHighlight((h) => (h + 1) % filtradas.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtradas.length === 0) return;
      setHighlight((h) => (h - 1 + filtradas.length) % filtradas.length);
      return;
    }
    if (e.key === 'Enter' && open && filtradas.length > 0) {
      e.preventDefault();
      escolher(filtradas[highlight]);
    }
  };

  const listaPortal =
    open && !campoDesabilitado && listPos && !semOpcoes
      ? createPortal(
          <ul
            id={listId}
            className="estoque-produto-autocomplete-list estoque-produto-autocomplete-list--portal"
            role="listbox"
            style={{
              position: 'fixed',
              top: listPos.top,
              left: listPos.left,
              width: listPos.width,
              zIndex: 10000
            }}
          >
            {filtradas.length === 0 ? (
              <li className="estoque-produto-autocomplete-empty" role="option" aria-selected={false}>
                Nenhum produto encontrado.
              </li>
            ) : (
              filtradas.map((o, i) => (
                <li key={o.id} role="presentation">
                  <button
                    type="button"
                    id={`${inputId}-opt-${o.id}`}
                    role="option"
                    aria-selected={value === String(o.id)}
                    className={`estoque-produto-autocomplete-item ${
                      i === highlight ? 'estoque-produto-autocomplete-item--active' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolher(o)}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    <span className="estoque-produto-autocomplete-item-nome">{o.nome}</span>
                    {o.cat?.trim() ? (
                      <span className="estoque-produto-autocomplete-item-cat">{o.cat}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body
        )
      : null;

  const podeLimpar = permitirVazio ? query.length > 0 || value !== '' : value !== '';

  return (
    <div
      className="estoque-produto-autocomplete"
      ref={wrapRef}
      data-estoque-autocomplete="v2"
    >
      <label className="estoque-resumo-hist-prod-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="estoque-produto-autocomplete-input-wrap">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          className="estoque-input estoque-produto-autocomplete-input"
          placeholder={
            campoDesabilitado
              ? 'Carregando…'
              : semOpcoes
                ? 'Cadastre produtos na aba Produtos'
                : placeholder
          }
          value={query}
          disabled={campoDesabilitado}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => {
            if (semOpcoes) return;
            setOpen(true);
            atualizarPosLista();
          }}
          onBlur={onBlurInput}
          onKeyDown={onKeyDown}
        />
        {podeLimpar && !campoDesabilitado && (
          <button
            type="button"
            className="estoque-produto-autocomplete-clear"
            onClick={limpar}
            aria-label="Limpar produto"
            title="Limpar"
          >
            ×
          </button>
        )}
      </div>
      {listaPortal}
    </div>
  );
};

export default EstoqueProdutoAutocomplete;
