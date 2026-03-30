import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import GridEditavel from './components/GridEditavel';
import Login from './components/Login';
import CadastroRestaurantes from './components/CadastroRestaurantes';
import Relatorios from './components/Relatorios';
import Estoque from './components/Estoque';
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
  const [restaurantes, setRestaurantes] = useState([]);
  const [restauranteSelecionado, setRestauranteSelecionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [telaAtual, setTelaAtual] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.somente_estoque ? 'estoque' : 'gastos';
    } catch {
      return 'gastos';
    }
  }); // 'gastos' | 'relatorios' | 'restaurantes' | 'estoque'
  const [msgEstoque, setMsgEstoque] = useState(null);

  useEffect(() => {
    verificarAutenticacao();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      carregarRestaurantes();
    }
  }, [isAuthenticated]);

  // Perfil somente estoque: abrir direto no módulo de estoque
  useEffect(() => {
    if (user?.somente_estoque) {
      setTelaAtual('estoque');
    }
  }, [user]);

  // Perfil somente estoque não carrega gastos — liberar tela de loading
  useEffect(() => {
    if (isAuthenticated && user?.somente_estoque) {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && restaurantes.length > 0) {
      // Selecionar primeiro restaurante se nenhum estiver selecionado
      if (!restauranteSelecionado) {
        setRestauranteSelecionado(restaurantes[0].id);
      }
      if (user && !user.somente_estoque) {
        carregarGastos();
      }
    }
  }, [isAuthenticated, restauranteSelecionado, restaurantes, user]);

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

  const carregarRestaurantes = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurantes`);
      setRestaurantes(response.data);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar restaurantes:', err);
      setError('Erro ao carregar restaurantes. Verifique se o servidor está rodando.');
    }
  };

  const carregarGastos = async () => {
    if (!restauranteSelecionado) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/gastos?restaurante_id=${restauranteSelecionado}`);
      setGastos(response.data);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar gastos:', err);
      setError('Erro ao carregar gastos. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const salvarGastos = async (gastosAtualizados, recarregar = true) => {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('[APP] ═══ SALVARGASTOS INICIADO ═══');
    console.log('[APP] Parâmetros:', { 
      quantidade: gastosAtualizados.length, 
      recarregar,
      restauranteSelecionado 
    });
    console.log('[APP] Gastos recebidos:', JSON.parse(JSON.stringify(gastosAtualizados)));
    
    try {
      
      if (!restauranteSelecionado) {
        console.error('[APP] ❌ ERRO: Nenhum restaurante selecionado');
        setError('Selecione um restaurante antes de salvar gastos.');
        return;
      }
      
      // Garantir que todos os gastos tenham restaurante_id e todos os campos necessários
      const gastosComRestaurante = gastosAtualizados.map((gasto, index) => {
        const gastoProcessado = {
          id: gasto.id || null,
          data: gasto.data || '',
          descricao: gasto.descricao || '',
          valor: gasto.valor !== undefined && gasto.valor !== null ? gasto.valor : null,
          observacao: gasto.observacao || '',
          pago: gasto.pago !== undefined ? gasto.pago : false,
          retroativo: gasto.retroativo !== undefined ? gasto.retroativo : false,
          restaurante_id: gasto.restaurante_id || restauranteSelecionado
        };
        console.log(`[APP] Gasto ${index + 1} processado:`, JSON.parse(JSON.stringify(gastoProcessado)));
        return gastoProcessado;
      });
      
      console.log('[APP] Total de gastos processados:', gastosComRestaurante.length);
      
      // Separar novos e existentes
      const novos = gastosComRestaurante.filter(g => !g.id);
      const existentes = gastosComRestaurante.filter(g => g.id);
      
      console.log('[APP] Novos gastos:', novos.length);
      console.log('[APP] Gastos existentes:', existentes.length);

      // Criar novos
      for (let i = 0; i < novos.length; i++) {
        const gasto = novos[i];
        if (gasto.descricao || gasto.data) {
          console.log(`[APP] Criando novo gasto ${i + 1}:`, JSON.parse(JSON.stringify(gasto)));
          const response = await axios.post(`${API_URL}/gastos`, gasto);
          console.log(`[APP] ✅ Novo gasto criado:`, response.data);
        } else {
          console.log(`[APP] ⚠️ Pulando gasto ${i + 1} - sem descrição ou data`);
        }
      }

      // Atualizar existentes
      for (let i = 0; i < existentes.length; i++) {
        const gasto = existentes[i];
        console.log(`[APP] Atualizando gasto ${i + 1} (ID: ${gasto.id}):`, JSON.parse(JSON.stringify(gasto)));
        const response = await axios.put(`${API_URL}/gastos/${gasto.id}`, gasto);
        console.log(`[APP] ✅ Gasto atualizado:`, response.data);
      }

      // Recarregar lista apenas se solicitado (evita re-render durante navegação com Tab)
      if (recarregar) {
        console.log('[APP] 🔄 Recarregando gastos do servidor...');
        await carregarGastos();
        console.log('[APP] ✅ Gastos recarregados');
      } else {
        console.log('[APP] ⚠️ Pulando recarregamento para evitar perda de foco');
        // Atualizar estado local sem recarregar do servidor
        setGastos(prevGastos => {
          const novosGastos = [...prevGastos];
          gastosComRestaurante.forEach(gastoAtualizado => {
            if (gastoAtualizado.id) {
              // Atualizar existente
              const index = novosGastos.findIndex(g => g.id === gastoAtualizado.id);
              if (index !== -1) {
                console.log('[APP] Atualizando gasto local (ID:', gastoAtualizado.id, '):', JSON.parse(JSON.stringify(gastoAtualizado)));
                novosGastos[index] = { ...novosGastos[index], ...gastoAtualizado };
              } else {
                console.log('[APP] ⚠️ Gasto não encontrado localmente para atualizar (ID:', gastoAtualizado.id, ')');
              }
            } else {
              // Adicionar novo (será atualizado quando recarregar)
              console.log('[APP] Adicionando novo gasto local:', JSON.parse(JSON.stringify(gastoAtualizado)));
              novosGastos.push(gastoAtualizado);
            }
          });
          console.log('[APP] Total de gastos após atualização local:', novosGastos.length);
          return novosGastos;
        });
      }
    } catch (err) {
      console.error('[APP] ❌ ERRO ao salvar gastos:', err);
      console.error('[APP] Detalhes do erro:', err.response?.data || err.message);
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

  const somenteEstoque = !!user?.somente_estoque;

  if (loading && !somenteEstoque) {
    return (
      <div className="app">
        <div className="loading">Carregando...</div>
      </div>
    );
  }

  const handleRestauranteChange = (e) => {
    const novoRestauranteId = parseInt(e.target.value);
    setRestauranteSelecionado(novoRestauranteId);
  };

  const handleRestaurantesUpdated = async () => {
    await carregarRestaurantes();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{somenteEstoque ? 'Estoque' : 'Controle Financeiro - Multi Restaurante'}</h1>
          {user && (
            <p className="user-info">Olá, {user.nome}!</p>
          )}
        </div>
        <div className="header-actions">
          <div className="nav-tabs">
            {!somenteEstoque && (
              <>
                <button
                  type="button"
                  onClick={() => setTelaAtual('gastos')}
                  className={telaAtual === 'gastos' ? 'nav-tab active' : 'nav-tab'}
                >
                  Gastos
                </button>
                <button
                  type="button"
                  onClick={() => setTelaAtual('relatorios')}
                  className={telaAtual === 'relatorios' ? 'nav-tab active' : 'nav-tab'}
                >
                  Relatórios
                </button>
                <button
                  type="button"
                  onClick={() => setTelaAtual('restaurantes')}
                  className={telaAtual === 'restaurantes' ? 'nav-tab active' : 'nav-tab'}
                >
                  Restaurantes
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setTelaAtual('estoque')}
              className={telaAtual === 'estoque' ? 'nav-tab active' : 'nav-tab'}
            >
              Estoque
            </button>
          </div>
          {(telaAtual === 'gastos' || telaAtual === 'estoque' || somenteEstoque) && restaurantes.length > 0 && (
            <select
              value={restauranteSelecionado || ''}
              onChange={handleRestauranteChange}
              className="restaurante-select"
            >
              {restaurantes.map(restaurante => (
                <option key={restaurante.id} value={restaurante.id}>
                  {restaurante.nome}
                </option>
              ))}
            </select>
          )}
          {telaAtual === 'gastos' && !somenteEstoque && (
            <button type="button" onClick={carregarGastos} className="btn-refresh">
              Atualizar
            </button>
          )}
          <button type="button" onClick={handleLogout} className="btn-logout">
            Sair
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      {msgEstoque && (
        <div className="error-message" role="status">
          {msgEstoque}
        </div>
      )}

      <main className="app-main">
        {telaAtual === 'estoque' ? (
          restaurantes.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum restaurante disponível. Peça ao administrador para cadastrar um restaurante.</p>
            </div>
          ) : (
            <Estoque
              restauranteId={restauranteSelecionado}
              isAdmin={!!user?.is_admin}
              onMessage={setMsgEstoque}
            />
          )
        ) : telaAtual === 'gastos' ? (
          restaurantes.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum restaurante cadastrado. Por favor, cadastre um restaurante primeiro.</p>
              <button type="button" onClick={() => setTelaAtual('restaurantes')} className="btn-primary">
                Cadastrar Restaurante
              </button>
            </div>
          ) : (
            <GridEditavel
              gastos={gastos}
              onSave={salvarGastos}
              onDelete={deletarGasto}
              restauranteId={restauranteSelecionado}
            />
          )
        ) : telaAtual === 'relatorios' ? (
          <Relatorios restauranteId={restauranteSelecionado} />
        ) : (
          <CadastroRestaurantes onUpdate={handleRestaurantesUpdated} />
        )}
      </main>
    </div>
  );
}

export default App;

