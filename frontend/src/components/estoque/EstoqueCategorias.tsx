import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import type { EstoqueCategoria } from './estoqueTypes';
import '../Estoque.css';

interface Props {
  restauranteId: number;
  categorias: EstoqueCategoria[];
  loading: boolean;
  onReload: () => Promise<void>;
  onMessage?: (msg: string | null) => void;
}

const EstoqueCategorias: React.FC<Props> = ({
  restauranteId,
  categorias,
  loading,
  onReload,
  onMessage
}) => {
  const [novaCategoria, setNovaCategoria] = useState('');

  const criarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    onMessage?.(null);
    try {
      await axios.post(`${API_URL}/estoque/categorias`, {
        restaurante_id: restauranteId,
        nome: novaCategoria.trim()
      });
      setNovaCategoria('');
      await onReload();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      onMessage?.(ax.response?.data?.error || 'Erro ao criar categoria.');
    }
  };

  const excluir = async (id: number, nome: string) => {
    if (!window.confirm(`Excluir a categoria "${nome}" e todos os produtos nela?`)) return;
    onMessage?.(null);
    try {
      await axios.delete(`${API_URL}/estoque/categorias/${id}`);
      await onReload();
    } catch {
      onMessage?.('Erro ao excluir categoria.');
    }
  };

  return (
    <div className="estoque-modulo estoque-modulo--screen">
      <div className="estoque-toolbar estoque-toolbar--stack">
        <h2 className="estoque-screen-title">Cadastro de categorias</h2>
        <button type="button" className="estoque-btn-refresh" onClick={() => onReload()}>
          Atualizar
        </button>
      </div>

      <section className="estoque-admin-screen-card" aria-label="Nova categoria">
        <h3 className="estoque-subsection-title">Nova categoria</h3>
        <form onSubmit={criarCategoria} className="estoque-form">
          <div className="estoque-form-row estoque-form-row--full">
            <input
              className="estoque-input"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              placeholder="Ex.: Frios, Bebidas, Limpeza…"
              aria-label="Nome da categoria"
            />
            <button type="submit" className="estoque-btn-primary">
              Adicionar
            </button>
          </div>
        </form>
      </section>

      <section className="estoque-admin-screen-card" aria-label="Lista de categorias">
        <h3 className="estoque-subsection-title">Categorias ({categorias.length})</h3>
        {loading ? (
          <p className="estoque-empty-msg">Carregando…</p>
        ) : categorias.length === 0 ? (
          <p className="estoque-empty-msg">Nenhuma categoria ainda. Cadastre acima.</p>
        ) : (
          <ul className="estoque-cat-list">
            {categorias.map((c) => (
              <li key={c.id} className="estoque-cat-list-item">
                <div className="estoque-cat-list-info">
                  <span className="estoque-cat-list-nome">{c.nome}</span>
                  <span className="estoque-cat-list-meta">
                    {c.produtos?.length || 0} produto(s) · ordem {c.ordem}
                  </span>
                </div>
                <button
                  type="button"
                  className="estoque-btn-danger estoque-btn-small"
                  onClick={() => excluir(c.id, c.nome)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default EstoqueCategorias;
