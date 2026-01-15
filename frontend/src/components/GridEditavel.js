import React, { useState, useEffect } from 'react';
import './GridEditavel.css';

const GridEditavel = ({ gastos, onSave, onDelete }) => {
  const [linhas, setLinhas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [campoEditando, setCampoEditando] = useState(null);
  const [tabPressionado, setTabPressionado] = useState(false);

  useEffect(() => {
    // Adicionar uma linha vazia no final para facilitar adição
    const linhasComVazia = [...gastos, { id: null, data: '', descricao: '', valor: '', observacao: '', pago: false }];
    setLinhas(linhasComVazia);
  }, [gastos]);

  const formatarData = (data) => {
    if (!data) return '';
    // Se já está no formato YYYY-MM-DD (do banco), converter para DD/MM/YYYY
    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    // Se já está no formato DD/MM/YYYY, retornar como está
    if (data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return data;
    }
    // Tentar converter Date object
    const date = new Date(data);
    if (!isNaN(date.getTime())) {
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      return `${dia}/${mes}/${ano}`;
    }
    return '';
  };

  const aplicarMascaraData = (valor) => {
    if (!valor) return '';
    
    // Remove tudo que não é número
    let apenasNumeros = valor.replace(/\D/g, '');
    
    // Limita a 8 dígitos (DDMMYYYY)
    if (apenasNumeros.length > 8) {
      apenasNumeros = apenasNumeros.substring(0, 8);
    }
    
    // Aplica a máscara DD/MM/YYYY
    if (apenasNumeros.length <= 2) {
      return apenasNumeros;
    } else if (apenasNumeros.length <= 4) {
      return `${apenasNumeros.substring(0, 2)}/${apenasNumeros.substring(2)}`;
    } else {
      return `${apenasNumeros.substring(0, 2)}/${apenasNumeros.substring(2, 4)}/${apenasNumeros.substring(4)}`;
    }
  };

  const parsearDataParaInput = (data) => {
    if (!data) return '';
    // Se está no formato YYYY-MM-DD, converter para DD/MM/YYYY para exibição
    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    // Se já está no formato DD/MM/YYYY, retornar como está
    if (data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return data;
    }
    return '';
  };

  const converterDataParaBanco = (dataStr) => {
    if (!dataStr) return '';
    // Se está no formato DD/MM/YYYY, converter para YYYY-MM-DD
    if (dataStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [dia, mes, ano] = dataStr.split('/');
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    // Se já está no formato YYYY-MM-DD, retornar como está
    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dataStr;
    }
    return '';
  };

  const formatarValor = (valor) => {
    if (!valor && valor !== 0) return '';
    if (typeof valor === 'number') {
      return valor.toFixed(2).replace('.', ',');
    }
    return String(valor).replace('.', ',');
  };

  const aplicarMascaraValor = (valor) => {
    if (!valor) return '';
    
    // Remove tudo que não é número
    let apenasNumeros = valor.replace(/\D/g, '');
    
    // Se não tem números, retorna vazio
    if (!apenasNumeros) return '';
    
    // Converte para número e divide por 100 para ter centavos
    const valorNumerico = parseFloat(apenasNumeros) / 100;
    
    // Formata com vírgula como separador decimal
    return valorNumerico.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parsearValor = (valorStr) => {
    if (!valorStr) return null;
    // Remove pontos (separadores de milhar) e substitui vírgula por ponto
    let valorLimpo = valorStr.replace(/\./g, '').replace(',', '.');
    const valorNum = parseFloat(valorLimpo);
    return isNaN(valorNum) ? null : valorNum;
  };

  const iniciarEdicao = (linhaIndex, campo) => {
    // Inicializar campos específicos se necessário
    if (campo === 'valor') {
      const novasLinhas = [...linhas];
      if (novasLinhas[linhaIndex] && !novasLinhas[linhaIndex].valorTexto) {
        const valorFormatado = formatarValor(linhas[linhaIndex].valor);
        novasLinhas[linhaIndex].valorTexto = valorFormatado || '';
        setLinhas(novasLinhas);
      }
    } else if (campo === 'data') {
      const novasLinhas = [...linhas];
      if (novasLinhas[linhaIndex] && !novasLinhas[linhaIndex].dataTexto) {
        novasLinhas[linhaIndex].dataTexto = parsearDataParaInput(linhas[linhaIndex].data) || '';
        setLinhas(novasLinhas);
      }
    }
    
    setEditando(linhaIndex);
    setCampoEditando(campo);
  };

  const finalizarEdicao = () => {
    setEditando(null);
    setCampoEditando(null);
  };

  const atualizarLinha = (linhaIndex, campo, valor, salvarValorBruto = false) => {
    const novasLinhas = [...linhas];
    const linha = novasLinhas[linhaIndex];

    if (campo === 'data') {
      // Salvar o texto digitado para permitir edição completa
      linha.dataTexto = valor;
      // Converter para formato do banco apenas quando completo (DD/MM/YYYY)
      if (valor.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        linha.data = converterDataParaBanco(valor);
      }
    } else if (campo === 'valor') {
      // Se salvarValorBruto, manter o texto digitado para permitir edição
      if (salvarValorBruto) {
        linha.valorTexto = valor;
      } else {
        // Parsear apenas quando sair do campo
        linha.valor = parsearValor(valor);
        linha.valorTexto = null;
      }
    } else if (campo === 'pago') {
      linha.pago = valor;
    } else {
      linha[campo] = valor;
    }

    setLinhas(novasLinhas);
  };

  const salvarLinha = async (linhaIndex, forcarSalvar = false) => {
    const linha = linhas[linhaIndex];
    if (!linha) return;
    
    // Criar cópia da linha para não modificar o estado diretamente
    const linhaParaSalvar = { ...linha };
    
    // Se tem dataTexto, converter para formato do banco antes de salvar
    if (linhaParaSalvar.dataTexto !== undefined && linhaParaSalvar.dataTexto !== null && linhaParaSalvar.dataTexto !== '') {
      const dataConvertida = converterDataParaBanco(linhaParaSalvar.dataTexto);
      if (dataConvertida) {
        linhaParaSalvar.data = dataConvertida;
      }
    }
    
    // Se tem valorTexto, parsear antes de salvar
    if (linhaParaSalvar.valorTexto !== undefined && linhaParaSalvar.valorTexto !== null && linhaParaSalvar.valorTexto !== '') {
      linhaParaSalvar.valor = parsearValor(linhaParaSalvar.valorTexto);
    }
    
    // Validar se tem pelo menos descrição ou data
    if (!forcarSalvar && !linhaParaSalvar.descricao && !linhaParaSalvar.data) {
      return;
    }

    // Se não tem data, usar data atual
    if (!linhaParaSalvar.data) {
      const hoje = new Date();
      linhaParaSalvar.data = hoje.toISOString().split('T')[0];
    }

    // Preparar dados para salvar
    const dadosParaSalvar = {
      id: linhaParaSalvar.id || null,
      data: linhaParaSalvar.data,
      descricao: linhaParaSalvar.descricao || '',
      valor: linhaParaSalvar.valor || null,
      observacao: linhaParaSalvar.observacao || '',
      pago: linhaParaSalvar.pago || false
    };

    // Só salvar se tiver pelo menos descrição ou se forçar
    if (dadosParaSalvar.descricao || forcarSalvar) {
      try {
        await onSave([dadosParaSalvar]);
        // Atualizar estado local removendo valorTexto e dataTexto após salvar
        const novasLinhas = [...linhas];
        if (novasLinhas[linhaIndex]) {
          if (novasLinhas[linhaIndex].valorTexto !== undefined) {
            novasLinhas[linhaIndex].valorTexto = null;
          }
          if (novasLinhas[linhaIndex].dataTexto !== undefined) {
            novasLinhas[linhaIndex].dataTexto = null;
          }
          setLinhas(novasLinhas);
        }
      } catch (error) {
        console.error('Erro ao salvar:', error);
      }
    }
  };

  const handleLinhaBlur = async (linhaIndex) => {
    // Não fazer nada se Tab foi pressionado (o handleKeyDown já cuida disso)
    if (tabPressionado) {
      // Aguardar um pouco antes de resetar a flag para garantir que o novo campo abriu
      setTimeout(() => {
        setTabPressionado(false);
      }, 200);
      return;
    }
    // Salvar quando sair da linha
    await salvarLinha(linhaIndex);
    finalizarEdicao();
  };

  const deletarLinha = async (linhaIndex) => {
    const linha = linhas[linhaIndex];
    if (linha.id) {
      if (window.confirm('Tem certeza que deseja deletar este gasto?')) {
        await onDelete(linha.id);
      }
    } else {
      // Remover linha vazia
      const novasLinhas = linhas.filter((_, index) => index !== linhaIndex);
      setLinhas(novasLinhas);
    }
  };

  const adicionarLinha = (callback) => {
    const novaLinha = { id: null, data: '', descricao: '', valor: '', observacao: '', pago: false };
    setLinhas(prevLinhas => {
      const novasLinhas = [...prevLinhas, novaLinha];
      if (callback) {
        setTimeout(() => callback(novasLinhas.length - 1), 0);
      }
      return novasLinhas;
    });
  };

  const handleKeyDown = async (e, linhaIndex, campo) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await salvarLinha(linhaIndex);
      // Mover para próxima linha, mesmo campo
      if (linhaIndex < linhas.length - 1) {
        iniciarEdicao(linhaIndex + 1, campo);
      } else {
        finalizarEdicao();
      }
    } else if (e.key === 'Escape') {
      finalizarEdicao();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      
      // Marcar que Tab foi pressionado para evitar que onBlur interfira
      setTabPressionado(true);
      
      // Ordem dos campos: data, descricao, valor, observacao, pago
      const campos = ['data', 'descricao', 'valor', 'observacao', 'pago'];
      const campoAtual = campos.indexOf(campo);
      
      // Verificar se campoAtual é válido
      if (campoAtual === -1) {
        console.warn('Campo não encontrado:', campo);
        setTabPressionado(false);
        return;
      }
      
      // Navegar imediatamente para o próximo campo (sem salvar primeiro para evitar re-render)
      // Se não é o último campo, ir para o próximo na mesma linha
      if (campoAtual < campos.length - 1) {
        // Próximo campo na mesma linha
        const proximoCampo = campos[campoAtual + 1];
        // Iniciar edição imediatamente
        iniciarEdicao(linhaIndex, proximoCampo);
        // Salvar o campo anterior em background (sem bloquear)
        setTimeout(() => {
          salvarLinha(linhaIndex).catch(err => console.error('Erro ao salvar:', err));
          setTabPressionado(false);
        }, 50);
      } else {
        // Se está no último campo (pago), ir para próxima linha ou criar nova
        if (linhaIndex < linhas.length - 1) {
          // Já existe próxima linha, ir para ela
          iniciarEdicao(linhaIndex + 1, campos[0]);
          setTimeout(() => {
            salvarLinha(linhaIndex).catch(err => console.error('Erro ao salvar:', err));
            setTabPressionado(false);
          }, 50);
        } else {
          // Criar nova linha e ir para o primeiro campo dela
          adicionarLinha((novoIndice) => {
            iniciarEdicao(novoIndice, campos[0]);
            setTimeout(() => {
              salvarLinha(linhaIndex).catch(err => console.error('Erro ao salvar:', err));
              setTabPressionado(false);
            }, 50);
          });
        }
      }
    }
  };

  return (
    <div className="grid-container">
      <div className="grid-header">
        <div className="grid-cell header-cell">Data</div>
        <div className="grid-cell header-cell">Descrição</div>
        <div className="grid-cell header-cell">Valor</div>
        <div className="grid-cell header-cell">Observação</div>
        <div className="grid-cell header-cell">Pago</div>
        <div className="grid-cell header-cell">Ações</div>
      </div>

      <div className="grid-body">
        {linhas.map((linha, linhaIndex) => (
          <div key={linha.id || `new-${linhaIndex}`} className="grid-row">
            <div className="grid-cell">
              {editando === linhaIndex && campoEditando === 'data' ? (
                <input
                  type="text"
                  value={linha.dataTexto !== undefined && linha.dataTexto !== null 
                    ? linha.dataTexto 
                    : parsearDataParaInput(linha.data)}
                  onChange={(e) => {
                    // Aplicar máscara de data enquanto digita
                    const valorDigitado = e.target.value;
                    const valorComMascara = aplicarMascaraData(valorDigitado);
                    atualizarLinha(linhaIndex, 'data', valorComMascara);
                  }}
                  onBlur={() => handleLinhaBlur(linhaIndex)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'data')}
                  autoFocus
                  className="grid-input"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                />
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => {
                    // Inicializar dataTexto com a data formatada
                    const novasLinhas = [...linhas];
                    if (!novasLinhas[linhaIndex].dataTexto) {
                      novasLinhas[linhaIndex].dataTexto = parsearDataParaInput(linhas[linhaIndex].data) || '';
                    }
                    setLinhas(novasLinhas);
                    iniciarEdicao(linhaIndex, 'data');
                  }}
                >
                  {formatarData(linha.data) || 'Clique para digitar'}
                </div>
              )}
            </div>

            <div className="grid-cell">
              {editando === linhaIndex && campoEditando === 'descricao' ? (
                <input
                  type="text"
                  value={linha.descricao || ''}
                  onChange={(e) => atualizarLinha(linhaIndex, 'descricao', e.target.value)}
                  onBlur={() => handleLinhaBlur(linhaIndex)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'descricao')}
                  autoFocus
                  className="grid-input"
                  placeholder="Digite a descrição"
                />
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => iniciarEdicao(linhaIndex, 'descricao')}
                >
                  {linha.descricao || ''}
                </div>
              )}
            </div>

            <div className="grid-cell">
              {editando === linhaIndex && campoEditando === 'valor' ? (
                <input
                  type="text"
                  value={linha.valorTexto !== undefined && linha.valorTexto !== null 
                    ? linha.valorTexto 
                    : formatarValor(linha.valor)}
                  onChange={(e) => {
                    // Aplicar máscara monetária enquanto digita
                    const valorDigitado = e.target.value;
                    const valorComMascara = aplicarMascaraValor(valorDigitado);
                    atualizarLinha(linhaIndex, 'valor', valorComMascara, true);
                  }}
                  onBlur={() => handleLinhaBlur(linhaIndex)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'valor')}
                  autoFocus
                  className="grid-input"
                  placeholder="0,00"
                  inputMode="decimal"
                />
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => {
                    // Inicializar valorTexto com o valor formatado
                    const novasLinhas = [...linhas];
                    if (!novasLinhas[linhaIndex].valorTexto) {
                      const valorFormatado = formatarValor(linhas[linhaIndex].valor);
                      novasLinhas[linhaIndex].valorTexto = valorFormatado || '';
                    }
                    setLinhas(novasLinhas);
                    iniciarEdicao(linhaIndex, 'valor');
                  }}
                >
                  {linha.valor ? `R$ ${formatarValor(linha.valor)}` : '0,00'}
                </div>
              )}
            </div>

            <div className="grid-cell">
              {editando === linhaIndex && campoEditando === 'observacao' ? (
                <input
                  type="text"
                  value={linha.observacao || ''}
                  onChange={(e) => atualizarLinha(linhaIndex, 'observacao', e.target.value)}
                  onBlur={() => handleLinhaBlur(linhaIndex)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'observacao')}
                  autoFocus
                  className="grid-input"
                  placeholder="Observações"
                />
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => iniciarEdicao(linhaIndex, 'observacao')}
                >
                  {linha.observacao || ''}
                </div>
              )}
            </div>

            <div className="grid-cell">
              {editando === linhaIndex && campoEditando === 'pago' ? (
                <select
                  value={linha.pago ? 'sim' : 'nao'}
                  onChange={(e) => {
                    atualizarLinha(linhaIndex, 'pago', e.target.value === 'sim');
                    salvarLinha(linhaIndex);
                  }}
                  onBlur={() => handleLinhaBlur(linhaIndex)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'pago')}
                  autoFocus
                  className="grid-input"
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => iniciarEdicao(linhaIndex, 'pago')}
                >
                  {linha.pago ? 'Sim' : 'Não'}
                </div>
              )}
            </div>

            <div className="grid-cell acoes-cell">
              <button
                className="btn-delete"
                onClick={() => deletarLinha(linhaIndex)}
                title="Deletar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-footer">
        <button className="btn-adicionar" onClick={() => adicionarLinha()}>
          + Adicionar Linha
        </button>
      </div>
    </div>
  );
};

export default GridEditavel;

