import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import GridEditavel from './components/GridEditavel';
import Login from './components/Login';
import { API_URL } from './config';

// Configurar axios para incluir token em todas as requisições
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

function App() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    verificarAutenticacao();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      carregarGastos();
    }
  }, [isAuthenticated]);

  const verificarAutenticacao = async () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (!token) {
      setCheckingAuth(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/verify`);
      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = (userData, token) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const carregarGastos = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/gastos`);
      setGastos(response.data);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar gastos:', err);
      setError('Erro ao carregar gastos. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const salvarGastos = async (gastosAtualizados) => {
    try {
      // Separar novos e existentes
      const novos = gastosAtualizados.filter(g => !g.id);
      const existentes = gastosAtualizados.filter(g => g.id);

      // Criar novos
      for (const gasto of novos) {
        if (gasto.descricao || gasto.data) {
          await axios.post(`${API_URL}/gastos`, gasto);
        }
      }

      // Atualizar existentes
      for (const gasto of existentes) {
        await axios.put(`${API_URL}/gastos/${gasto.id}`, gasto);
      }

      // Recarregar lista
      await carregarGastos();
    } catch (err) {
      console.error('Erro ao salvar gastos:', err);
      setError('Erro ao salvar gastos. Tente novamente.');
    }
  };

  const deletarGasto = async (id) => {
    try {
      await axios.delete(`${API_URL}/gastos/${id}`);
      await carregarGastos();
    } catch (err) {
      console.error('Erro ao deletar gasto:', err);
      setError('Erro ao deletar gasto. Tente novamente.');
    }
  };

  if (checkingAuth) {
    return (
      <div className="app">
        <div className="loading">Verificando autenticação...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Controle Financeiro - Restaurante</h1>
          {user && (
            <p className="user-info">Olá, {user.nome}!</p>
          )}
        </div>
        <div className="header-actions">
          <button onClick={carregarGastos} className="btn-refresh">
            Atualizar
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Sair
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <main className="app-main">
        <GridEditavel
          gastos={gastos}
          onSave={salvarGastos}
          onDelete={deletarGasto}
        />
      </main>
    </div>
  );
}

export default App;

