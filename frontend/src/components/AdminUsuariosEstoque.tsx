import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './AdminUsuariosEstoque.css';

interface Restaurante {
  id: number;
  nome: string;
}

export interface UsuarioEstoqueRow {
  id: number;
  username: string;
  nome: string;
  created_at?: string;
  restaurante_ids: number[];
}

interface Props {
  /** Opcional: propaga erros críticos para o cabeçalho do app */
  onError?: (msg: string | null) => void;
}

const AdminUsuariosEstoque: React.FC<Props> = ({ onError }) => {
  const [lista, setLista] = useState<UsuarioEstoqueRow[]>([]);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [novoUsername, setNovoUsername] = useState('');
  const [novoPassword, setNovoPassword] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoRestIds, setNovoRestIds] = useState<number[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRestIds, setEditRestIds] = useState<number[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    onError?.(null);
    setBanner(null);
    try {
      const [uRes, rRes] = await Promise.all([
        axios.get<UsuarioEstoqueRow[]>(`${API_URL}/admin/usuarios-estoque`),
        axios.get<Restaurante[]>(`${API_URL}/restaurantes`)
      ]);
      setLista(uRes.data || []);
      setRestaurantes(rRes.data || []);
    } catch (e) {
      console.error(e);
      const msg = 'Não foi possível carregar usuários de estoque.';
      setBanner({ type: 'err', text: msg });
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const toggleNovoRest = (id: number) => {
    setNovoRestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleEditRest = (id: number) => {
    setEditRestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const criarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novoRestIds.length === 0) {
      setBanner({ type: 'err', text: 'Marque ao menos um restaurante.' });
      return;
    }
    setSaving(true);
    setBanner(null);
    onError?.(null);
    try {
      await axios.post(`${API_URL}/admin/usuarios-estoque`, {
        username: novoUsername.trim(),
        password: novoPassword,
        nome: novoNome.trim(),
        restaurante_ids: novoRestIds
      });
      setNovoUsername('');
      setNovoPassword('');
      setNovoNome('');
      setNovoRestIds([]);
      await carregar();
      setBanner({ type: 'ok', text: 'Usuário criado. Ele já pode entrar com o login e senha definidos.' });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setBanner({ type: 'err', text: ax.response?.data?.error || 'Erro ao criar usuário.' });
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicao = (u: UsuarioEstoqueRow) => {
    setEditingId(u.id);
    setEditNome(u.nome);
    setEditPassword('');
    setEditRestIds([...(u.restaurante_ids || [])]);
    setBanner(null);
  };

  const cancelarEdicao = () => {
    setEditingId(null);
    setEditPassword('');
  };

  const salvarEdicao = async (id: number) => {
    if (!editNome.trim()) {
      setBanner({ type: 'err', text: 'Informe o nome do usuário.' });
      return;
    }
    setSaving(true);
    setBanner(null);
    onError?.(null);
    try {
      const body: { nome: string; restaurante_ids: number[]; password?: string } = {
        nome: editNome.trim(),
        restaurante_ids: editRestIds
      };
      if (editPassword.trim() !== '') {
        body.password = editPassword;
      }
      await axios.put(`${API_URL}/admin/usuarios-estoque/${id}`, body);
      cancelarEdicao();
      await carregar();
      setBanner({
        type: 'ok',
        text: 'Usuário atualizado. Se alterou vínculos, peça para o operador entrar de novo no app.'
      });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setBanner({ type: 'err', text: ax.response?.data?.error || 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: number, nome: string) => {
    if (!window.confirm(`Excluir o usuário de estoque "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setBanner(null);
    try {
      await axios.delete(`${API_URL}/admin/usuarios-estoque/${id}`);
      if (editingId === id) cancelarEdicao();
      await carregar();
      setBanner({ type: 'ok', text: 'Usuário removido.' });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setBanner({ type: 'err', text: ax.response?.data?.error || 'Erro ao excluir.' });
    }
  };

  if (loading) {
    return (
      <div className="admin-ue admin-ue--loading">
        <p>Carregando…</p>
      </div>
    );
  }

  return (
    <div className="admin-ue">
      {banner && (
        <div className={`admin-ue-banner admin-ue-banner--${banner.type}`} role="status">
          {banner.text}
        </div>
      )}
      <header className="admin-ue-header">
        <h1 className="admin-ue-title">Usuários de estoque</h1>
        <p className="admin-ue-hint">
          Crie logins que veem apenas o módulo de estoque. O operador <strong>só acessa as lojas que você marcar</strong>{' '}
          — normalmente uma loja por usuário. Só marque várias se essa pessoa tiver permissão para lançar em mais de um
          local.
        </p>
        <button type="button" className="admin-ue-refresh" onClick={() => carregar()}>
          Atualizar lista
        </button>
      </header>

      <section className="admin-ue-card" aria-label="Novo usuário de estoque">
        <h2 className="admin-ue-card-title">Novo usuário</h2>
        <form onSubmit={criarUsuario} className="admin-ue-form">
          <label className="admin-ue-label">
            Login (usuário)
            <input
              className="admin-ue-input"
              value={novoUsername}
              onChange={(e) => setNovoUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="admin-ue-label">
            Senha (mín. 4 caracteres)
            <input
              className="admin-ue-input"
              type="password"
              value={novoPassword}
              onChange={(e) => setNovoPassword(e.target.value)}
              autoComplete="new-password"
              minLength={4}
              required
            />
          </label>
          <label className="admin-ue-label">
            Nome para exibição
            <input
              className="admin-ue-input"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              required
            />
          </label>
          <fieldset className="admin-ue-fieldset">
            <legend className="admin-ue-legend">Lojas / restaurantes liberados para este usuário</legend>
            {restaurantes.length === 0 ? (
              <p className="admin-ue-empty">Cadastre restaurantes antes.</p>
            ) : (
              <ul className="admin-ue-checklist">
                {restaurantes.map((r) => (
                  <li key={r.id}>
                    <label className="admin-ue-check">
                      <input
                        type="checkbox"
                        checked={novoRestIds.includes(r.id)}
                        onChange={() => toggleNovoRest(r.id)}
                      />
                      <span>{r.nome}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <button type="submit" className="admin-ue-btn admin-ue-btn--primary" disabled={saving || restaurantes.length === 0}>
            {saving ? 'Salvando…' : 'Criar usuário'}
          </button>
        </form>
      </section>

      <section className="admin-ue-card" aria-label="Usuários cadastrados">
        <h2 className="admin-ue-card-title">Cadastrados ({lista.length})</h2>
        {lista.length === 0 ? (
          <p className="admin-ue-empty">Nenhum usuário de estoque ainda.</p>
        ) : (
          <ul className="admin-ue-list">
            {lista.map((u) => (
              <li key={u.id} className="admin-ue-user">
                {editingId === u.id ? (
                  <div className="admin-ue-edit">
                    <p className="admin-ue-user-login">
                      <strong>{u.username}</strong>
                    </p>
                    <label className="admin-ue-label">
                      Nome
                      <input className="admin-ue-input" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                    </label>
                    <label className="admin-ue-label">
                      Nova senha (deixe em branco para não alterar)
                      <input
                        className="admin-ue-input"
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <fieldset className="admin-ue-fieldset">
                      <legend className="admin-ue-legend">Lojas liberadas</legend>
                      <ul className="admin-ue-checklist">
                        {restaurantes.map((r) => (
                          <li key={r.id}>
                            <label className="admin-ue-check">
                              <input
                                type="checkbox"
                                checked={editRestIds.includes(r.id)}
                                onChange={() => toggleEditRest(r.id)}
                              />
                              <span>{r.nome}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                    <div className="admin-ue-actions">
                      <button
                        type="button"
                        className="admin-ue-btn admin-ue-btn--primary"
                        disabled={saving}
                        onClick={() => salvarEdicao(u.id)}
                      >
                        Salvar
                      </button>
                      <button type="button" className="admin-ue-btn" disabled={saving} onClick={cancelarEdicao}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-ue-row">
                    <div className="admin-ue-row-info">
                      <span className="admin-ue-user-name">{u.nome}</span>
                      <span className="admin-ue-user-login">@{u.username}</span>
                      <span className="admin-ue-user-rests">
                        Lojas:{' '}
                        {(u.restaurante_ids || [])
                          .map((id) => restaurantes.find((r) => r.id === id)?.nome || `#${id}`)
                          .join(', ') || 'nenhum'}
                      </span>
                    </div>
                    <div className="admin-ue-row-btns">
                      <button type="button" className="admin-ue-btn" onClick={() => abrirEdicao(u)}>
                        Editar
                      </button>
                      <button type="button" className="admin-ue-btn admin-ue-btn--danger" onClick={() => excluir(u.id, u.nome)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AdminUsuariosEstoque;
