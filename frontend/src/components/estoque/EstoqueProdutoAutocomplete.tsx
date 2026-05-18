import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import '../Estoque.css';

export interface EstoqueProdutoOpcao {
  id: number;
  nome: string;
  cat: string;
}

function rotuloOpcao(o: EstoqueProdutoOpcao): string {
  return `${o.nome} — ${o.cat}`;
}

function normalizaBusca(s: string): string {
  return s.trim().toLowerCase();
}

interface Props {
  id?: string;
  label?: string;
  value: string;
  onChange: (produtoId: string) => void;
  opcoes: EstoqueProdutoOpcao[];
  placeholder?: string;
  disabled?: boolean;
}

const EstoqueProdutoAutocomplete: React.FC<Props> = ({
  id: idProp,
  label = 'Produto',
  value,
  onChange,
  opcoes,
  placeholder = 'Digite o nome do produto ou da categoria…',
  disabled = false
}) => {
  const autoId = useId();
  const inputId = idProp || `estoque-prod-autocomplete-${autoId}`;
  const listId = `${inputId}-listbox`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selecionado = useMemo(
    () => opcoes.find((o) => String(o.id) === value),
    [opcoes, value]
  );

  const filtradas = useMemo(() => {
    const n = normalizaBusca(query);
    if (!n) return opcoes.slice(0, 40);
    return opcoes
      .filter(
        (o) =>
          o.nome.toLowerCase().includes(n) ||
          o.cat.toLowerCase().includes(n) ||
          rotuloOpcao(o).toLowerCase().includes(n)
      )
      .slice(0, 40);
  }, [opcoes, query]);

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
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const escolher = (o: EstoqueProdutoOpcao) => {
    onChange(String(o.id));
    setQuery(rotuloOpcao(o));
    setOpen(false);
    inputRef.current?.blur();
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
    if (selecionado && texto !== rotuloOpcao(selecionado)) {
      onChange('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
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

  return (
    <div className="estoque-produto-autocomplete" ref={wrapRef}>
      <label className="estoque-resumo-hist-prod-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="estoque-produto-autocomplete-input-wrap">
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          className="estoque-input estoque-produto-autocomplete-input"
          placeholder={placeholder}
          value={query}
          disabled={disabled || opcoes.length === 0}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtradas.length > 0 ? `${inputId}-opt-${filtradas[highlight].id}` : undefined
          }
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value && !disabled && (
          <button
            type="button"
            className="estoque-produto-autocomplete-clear"
            onClick={limpar}
            aria-label="Limpar produto selecionado"
            title="Limpar"
          >
            ×
          </button>
        )}
      </div>
      {open && !disabled && opcoes.length > 0 && (
        <ul id={listId} className="estoque-produto-autocomplete-list" role="listbox">
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
                  <span className="estoque-produto-autocomplete-item-cat">{o.cat}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default EstoqueProdutoAutocomplete;
