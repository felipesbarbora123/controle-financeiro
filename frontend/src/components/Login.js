import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';
import { API_URL } from '../config';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body = { username, password };
    const primaryUrl = `${API_URL}/login`;

    const postLogin = async (url) => axios.post(url, body);

    try {
      let response;
      try {
        response = await postLogin(primaryUrl);
      } catch (firstErr) {
        const st = firstErr.response?.status;
        const altBase = String(API_URL).replace(/\/api$/i, '');
        if (st === 405 && altBase && altBase !== API_URL) {
          response = await postLogin(`${altBase}/login`);
        } else {
          throw firstErr;
        }
      }

      // Salvar token no localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Notificar componente pai
      onLogin(response.data.user, response.data.token);
    } catch (err) {
      if (err.response?.status === 405) {
        setError(
          'Servidor recusou o login (405). Confira no Easypanel se REACT_APP_API_URL aponta para o serviço Node (API), não para o site estático do front.'
        );
      } else {
        setError(err.response?.data?.error || 'Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Controle Financeiro</h1>
        <h2 className="login-subtitle">Sistema de Gestão de Gastos</h2>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Usuário</label>
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

