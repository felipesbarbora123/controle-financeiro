import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './Relatorios.css';

const Relatorios = ({ restauranteId }) => {
  const [gastos, setGastos] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    restauranteId: restauranteId || '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    status: 'todos' // 'todos', 'pago', 'pendente'
  });

  useEffect(() => {
    carregarRestaurantes();
  }, []);

  useEffect(() => {
    if (filtros.restauranteId) {
      carregarGastos();
    } else {
      setGastos([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.restauranteId]);

  useEffect(() => {
    if (filtros.restauranteId && restaurantes.length > 0 && !filtros.restauranteId) {
      setFiltros(prev => ({ ...prev, restauranteId: restaurantes[0].id }));
    }
  }, [restaurantes]);

  const carregarRestaurantes = async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurantes`);
      setRestaurantes(response.data);
      if (response.data.length > 0 && !filtros.restauranteId) {
        setFiltros(prev => ({ ...prev, restauranteId: response.data[0].id }));
      }
    } catch (error) {
      console.error('Erro ao carregar restaurantes:', error);
    }
  };

  const carregarGastos = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/gastos`, {
        params: {
          restaurante_id: filtros.restauranteId
        }
      });
      setGastos(response.data);
    } catch (error) {
      console.error('Erro ao carregar gastos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar gastos
  const gastosFiltrados = useMemo(() => {
    let filtrado = [...gastos];

    // Filtro por descrição
    if (filtros.descricao) {
      filtrado = filtrado.filter(gasto =>
        gasto.descricao.toLowerCase().includes(filtros.descricao.toLowerCase())
      );
    }

    // Filtro por período
    if (filtros.dataInicio) {
      const dataInicio = new Date(filtros.dataInicio + 'T00:00:00');
      filtrado = filtrado.filter(gasto => {
        const dataGasto = new Date(gasto.data);
        return dataGasto >= dataInicio;
      });
    }

    if (filtros.dataFim) {
      const dataFim = new Date(filtros.dataFim + 'T23:59:59');
      filtrado = filtrado.filter(gasto => {
        const dataGasto = new Date(gasto.data);
        return dataGasto <= dataFim;
      });
    }

    // Filtro por status
    if (filtros.status !== 'todos') {
      filtrado = filtrado.filter(gasto => {
        if (filtros.status === 'pago') {
          return gasto.pago === true;
        } else if (filtros.status === 'pendente') {
          return gasto.pago === false;
        }
        return true;
      });
    }

    // Ordenar por data (mais recente primeiro)
    return filtrado.sort((a, b) => {
      const dataA = new Date(a.data);
      const dataB = new Date(b.data);
      return dataB - dataA;
    });
  }, [gastos, filtros]);

  // Calcular totais
  const totais = useMemo(() => {
    const totalLancado = gastosFiltrados.reduce((total, gasto) => {
      const valor = typeof gasto.valor === 'number' ? gasto.valor : parseFloat(gasto.valor) || 0;
      return total + valor;
    }, 0);

    const totalPago = gastosFiltrados.reduce((total, gasto) => {
      if (gasto.pago) {
        const valor = typeof gasto.valor === 'number' ? gasto.valor : parseFloat(gasto.valor) || 0;
        return total + valor;
      }
      return total;
    }, 0);

    const totalPendente = gastosFiltrados.reduce((total, gasto) => {
      if (!gasto.pago) {
        const valor = typeof gasto.valor === 'number' ? gasto.valor : parseFloat(gasto.valor) || 0;
        return total + valor;
      }
      return total;
    }, 0);

    return {
      totalLancado,
      totalPago,
      totalPendente,
      quantidade: gastosFiltrados.length,
      quantidadePago: gastosFiltrados.filter(g => g.pago).length,
      quantidadePendente: gastosFiltrados.filter(g => !g.pago).length
    };
  }, [gastosFiltrados]);

  // Formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (!valor && valor !== 0) return 'R$ 0,00';
    const valorNum = typeof valor === 'number' ? valor : parseFloat(valor) || 0;
    return `R$ ${valorNum.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  // Formatar data
  const formatarData = (data) => {
    if (!data) return '';
    const date = new Date(data);
    if (isNaN(date.getTime())) return '';
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const limparFiltros = () => {
    setFiltros(prev => ({
      ...prev,
      descricao: '',
      dataInicio: '',
      dataFim: '',
      status: 'todos'
    }));
  };

  if (loading) {
    return (
      <div className="relatorios-container">
        <div className="loading">Carregando relatórios...</div>
      </div>
    );
  }

  return (
    <div className="relatorios-container">
      <div className="relatorios-header">
        <h2>Relatórios de Gastos</h2>
        <button onClick={carregarGastos} className="btn-refresh">
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="filtros-container">
        <div className="filtro-row">
          <div className="filtro-group">
            <label>Restaurante:</label>
            <select
              value={filtros.restauranteId}
              onChange={(e) => handleFiltroChange('restauranteId', e.target.value)}
              className="filtro-input"
            >
              <option value="">Todos os restaurantes</option>
              {restaurantes.map(restaurante => (
                <option key={restaurante.id} value={restaurante.id}>
                  {restaurante.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="filtro-group">
            <label>Descrição:</label>
            <input
              type="text"
              value={filtros.descricao}
              onChange={(e) => handleFiltroChange('descricao', e.target.value)}
              placeholder="Buscar por descrição..."
              className="filtro-input"
            />
          </div>

          <div className="filtro-group">
            <label>Período:</label>
            <div className="filtro-periodo">
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => handleFiltroChange('dataInicio', e.target.value)}
                className="filtro-input filtro-date"
                placeholder="Data inicial"
              />
              <span>até</span>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => handleFiltroChange('dataFim', e.target.value)}
                className="filtro-input filtro-date"
                placeholder="Data final"
              />
            </div>
          </div>

          <div className="filtro-group">
            <label>Status:</label>
            <select
              value={filtros.status}
              onChange={(e) => handleFiltroChange('status', e.target.value)}
              className="filtro-input"
            >
              <option value="todos">Todos</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>

          <div className="filtro-actions">
            <button onClick={limparFiltros} className="btn-limpar">
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="totalizadores-relatorio">
        <div className="totalizador-item">
          <label>Total Lançado:</label>
          <div className="totalizador-valor">{formatarValorMonetario(totais.totalLancado)}</div>
          <span className="totalizador-quantidade">({totais.quantidade} gastos)</span>
        </div>

        <div className="totalizador-item pago">
          <label>Total Pago:</label>
          <div className="totalizador-valor">{formatarValorMonetario(totais.totalPago)}</div>
          <span className="totalizador-quantidade">({totais.quantidadePago} gastos)</span>
        </div>

        <div className="totalizador-item pendente">
          <label>Total Pendente:</label>
          <div className="totalizador-valor">{formatarValorMonetario(totais.totalPendente)}</div>
          <span className="totalizador-quantidade">({totais.quantidadePendente} gastos)</span>
        </div>
      </div>

      {/* Tabela de gastos */}
      <div className="relatorios-table-container">
        {gastosFiltrados.length === 0 ? (
          <div className="empty-message">
            Nenhum gasto encontrado com os filtros selecionados.
          </div>
        ) : (
          <table className="relatorios-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Observação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map(gasto => (
                <tr key={gasto.id}>
                  <td>{formatarData(gasto.data)}</td>
                  <td>{gasto.descricao || '-'}</td>
                  <td className="valor-cell">{formatarValorMonetario(gasto.valor)}</td>
                  <td>{gasto.observacao || '-'}</td>
                  <td>
                    <span className={`status-badge ${gasto.pago ? 'pago' : 'pendente'}`}>
                      {gasto.pago ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Relatorios;
