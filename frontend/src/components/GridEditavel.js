import React, { useState, useEffect, useMemo } from 'react';
import './GridEditavel.css';

// Funções utilitárias para cálculo de semanas
const getDomingoSemanaAtual = () => {
  const hoje = new Date();
  const dia = hoje.getDay(); // 0 = domingo, 1 = segunda, etc
  const diff = hoje.getDate() - dia; // Diferença até o domingo
  const domingo = new Date(hoje);
  domingo.setDate(diff);
  domingo.setHours(0, 0, 0, 0);
  return domingo;
};

const getSabadoSemanaAtual = () => {
  const domingo = getDomingoSemanaAtual();
  const sabado = new Date(domingo);
  sabado.setDate(domingo.getDate() + 6);
  sabado.setHours(23, 59, 59, 999);
  return sabado;
};

const getDomingoProximaSemana = () => {
  const domingo = getDomingoSemanaAtual();
  const proximoDomingo = new Date(domingo);
  proximoDomingo.setDate(domingo.getDate() + 7);
  return proximoDomingo;
};

const getSabadoProximaSemana = () => {
  const proximoDomingo = getDomingoProximaSemana();
  const proximoSabado = new Date(proximoDomingo);
  proximoSabado.setDate(proximoDomingo.getDate() + 6);
  proximoSabado.setHours(23, 59, 59, 999);
  return proximoSabado;
};

const formatarDataParaComparacao = (dataStr) => {
  if (!dataStr) {
    console.log('[FORMATAR_DATA] Data vazia ou nula');
    return null;
  }
  
  console.log('[FORMATAR_DATA] Formatando data para comparação:', dataStr);
  
  // Se está no formato YYYY-MM-DD
  if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = new Date(dataStr + 'T00:00:00');
    console.log('[FORMATAR_DATA] Data formatada (YYYY-MM-DD):', date.toISOString().split('T')[0]);
    return date;
  }
  
  // Se está no formato ISO (com timestamp) - formato do PostgreSQL
  if (dataStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
    const date = new Date(dataStr);
    // Normalizar para meia-noite para comparação
    date.setHours(0, 0, 0, 0);
    console.log('[FORMATAR_DATA] Data formatada (ISO):', date.toISOString().split('T')[0]);
    return date;
  }
  
  // Se está no formato DD/MM/YYYY
  if (dataStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [dia, mes, ano] = dataStr.split('/');
    const date = new Date(ano, mes - 1, dia);
    console.log('[FORMATAR_DATA] Data formatada (DD/MM/YYYY):', date.toISOString().split('T')[0]);
    return date;
  }
  
  // Tentar parsear como data genérica
  const date = new Date(dataStr);
  if (isNaN(date.getTime())) {
    console.error('[FORMATAR_DATA] ❌ Erro ao parsear data:', dataStr);
    return null;
  }
  date.setHours(0, 0, 0, 0);
  console.log('[FORMATAR_DATA] Data formatada (genérico):', date.toISOString().split('T')[0]);
  return date;
};

const pertenceSemanaAtual = (dataStr) => {
  const data = formatarDataParaComparacao(dataStr);
  if (!data) {
    console.log('[PERTENCE_SEMANA] Data inválida:', dataStr);
    return false;
  }
  
  const domingo = getDomingoSemanaAtual();
  const sabado = getSabadoSemanaAtual();
  
  const pertence = data >= domingo && data <= sabado;
  console.log('[PERTENCE_SEMANA] Verificando se', dataStr, 'pertence à semana atual:', {
    data: data.toISOString().split('T')[0],
    domingo: domingo.toISOString().split('T')[0],
    sabado: sabado.toISOString().split('T')[0],
    pertence
  });
  
  return pertence;
};

const pertenceProximaSemana = (dataStr) => {
  const data = formatarDataParaComparacao(dataStr);
  if (!data) {
    console.log('[PERTENCE_SEMANA] Data inválida:', dataStr);
    return false;
  }
  
  const proximoDomingo = getDomingoProximaSemana();
  const proximoSabado = getSabadoProximaSemana();
  
  const pertence = data >= proximoDomingo && data <= proximoSabado;
  console.log('[PERTENCE_SEMANA] Verificando se', dataStr, 'pertence à próxima semana:', {
    data: data.toISOString().split('T')[0],
    proximoDomingo: proximoDomingo.toISOString().split('T')[0],
    proximoSabado: proximoSabado.toISOString().split('T')[0],
    pertence
  });
  
  return pertence;
};

const formatarPeriodoSemana = (domingo, sabado) => {
  const formatarData = (date) => {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}`;
  };
  return `${formatarData(domingo)} a ${formatarData(sabado)}`;
};

const GridEditavel = ({ gastos, onSave, onDelete, restauranteId }) => {
  const [linhasSemanaAtual, setLinhasSemanaAtual] = useState([]);
  const [linhasProximaSemana, setLinhasProximaSemana] = useState([]);
  const [editando, setEditando] = useState(null);
  const [campoEditando, setCampoEditando] = useState(null);
  const [tabPressionado, setTabPressionado] = useState(false);
  const [tabelaEditando, setTabelaEditando] = useState(null); // 'atual' ou 'proxima'
  // Carregar valor da conta do localStorage ao montar
  const [valorConta, setValorConta] = useState(() => {
    const salvo = localStorage.getItem(`conta_${restauranteId}`);
    return salvo ? parseFloat(salvo) || 0 : 0;
  });
  const [editandoConta, setEditandoConta] = useState(false);
  const [valorContaTexto, setValorContaTexto] = useState('');

  // Atualizar valor da conta quando restaurante mudar
  useEffect(() => {
    const salvo = localStorage.getItem(`conta_${restauranteId}`);
    setValorConta(salvo ? parseFloat(salvo) || 0 : 0);
  }, [restauranteId]);

  // Separar gastos por semana
  const { gastosSemanaAtual, gastosProximaSemana } = useMemo(() => {
    console.log('[SEPARAR_SEMANAS] Separando gastos por semana. Total de gastos:', gastos.length);
    const semanaAtual = [];
    const proximaSemana = [];
    
    gastos.forEach((gasto, index) => {
      console.log(`[SEPARAR_SEMANAS] Processando gasto ${index + 1}:`, {
        id: gasto.id,
        data: gasto.data,
        descricao: gasto.descricao
      });
      
      const pertenceAtual = pertenceSemanaAtual(gasto.data);
      const pertenceProxima = pertenceProximaSemana(gasto.data);
      
      console.log(`[SEPARAR_SEMANAS] Gasto ${index + 1} (ID: ${gasto.id}):`, {
        data: gasto.data,
        pertenceAtual,
        pertenceProxima
      });
      
      if (pertenceAtual) {
        semanaAtual.push(gasto);
        console.log(`[SEPARAR_SEMANAS] Gasto ${index + 1} adicionado à semana ATUAL`);
      } else if (pertenceProxima) {
        proximaSemana.push(gasto);
        console.log(`[SEPARAR_SEMANAS] Gasto ${index + 1} adicionado à PRÓXIMA semana`);
      } else {
        console.log(`[SEPARAR_SEMANAS] ⚠️ Gasto ${index + 1} não pertence a nenhuma semana visível`);
      }
    });
    
    console.log('[SEPARAR_SEMANAS] Resultado:', {
      semanaAtual: semanaAtual.length,
      proximaSemana: proximaSemana.length
    });
    
    return {
      gastosSemanaAtual: semanaAtual.sort((a, b) => {
        const dataA = formatarDataParaComparacao(a.data);
        const dataB = formatarDataParaComparacao(b.data);
        return dataB - dataA; // Mais recente primeiro
      }),
      gastosProximaSemana: proximaSemana.sort((a, b) => {
        const dataA = formatarDataParaComparacao(a.data);
        const dataB = formatarDataParaComparacao(b.data);
        return dataB - dataA; // Mais recente primeiro
      })
    };
  }, [gastos]);

  useEffect(() => {
    console.log('[USE_EFFECT] Atualizando linhas das tabelas');
    console.log('[USE_EFFECT] Gastos semana atual:', gastosSemanaAtual.length);
    console.log('[USE_EFFECT] Gastos próxima semana:', gastosProximaSemana.length);
    
    // Adicionar uma linha vazia no final de cada tabela para facilitar adição
    const linhasAtualComVazia = [
      ...gastosSemanaAtual,
      { id: null, data: '', descricao: '', valor: '', observacao: '', pago: false, restaurante_id: restauranteId }
    ];
    const linhasProximaComVazia = [
      ...gastosProximaSemana,
      { id: null, data: '', descricao: '', valor: '', observacao: '', pago: false, restaurante_id: restauranteId }
    ];
    
    console.log('[USE_EFFECT] Linhas semana atual (com vazia):', linhasAtualComVazia.length);
    console.log('[USE_EFFECT] Linhas próxima semana (com vazia):', linhasProximaComVazia.length);
    
    // Log dos valores das linhas
    console.log('[USE_EFFECT] Valores semana atual:', 
      linhasAtualComVazia.map(l => ({ id: l.id, valor: l.valor, tipo: typeof l.valor }))
    );
    
    setLinhasSemanaAtual(linhasAtualComVazia);
    setLinhasProximaSemana(linhasProximaComVazia);
  }, [gastosSemanaAtual, gastosProximaSemana, restauranteId]);

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
    if (valorStr === null || valorStr === undefined || valorStr === '') return null;
    
    // Se já é um número, retornar diretamente
    if (typeof valorStr === 'number') {
      return isNaN(valorStr) ? null : valorStr;
    }
    
    // Se é string, processar
    if (typeof valorStr === 'string') {
      // Verificar se tem vírgula (formato brasileiro: "1.234,56")
      if (valorStr.includes(',')) {
        // Formato brasileiro: remover pontos (milhar) e substituir vírgula por ponto
        let valorLimpo = valorStr.replace(/\./g, '').replace(',', '.');
        const valorNum = parseFloat(valorLimpo);
        return isNaN(valorNum) ? null : valorNum;
      } else {
        // Formato numérico (vem do banco como "500.00")
        // Tentar parsear diretamente
        const valorNum = parseFloat(valorStr);
        if (!isNaN(valorNum)) {
          return valorNum;
        }
        // Se não conseguiu, tentar remover pontos (caso seja milhar sem vírgula)
        let valorLimpo = valorStr.replace(/\./g, '');
        const valorNum2 = parseFloat(valorLimpo);
        return isNaN(valorNum2) ? null : valorNum2;
      }
    }
    
    return null;
  };

  // Funções auxiliares para trabalhar com as duas tabelas
  const getLinhas = (tabela) => tabela === 'atual' ? linhasSemanaAtual : linhasProximaSemana;
  const setLinhas = (tabela, novasLinhas) => {
    if (tabela === 'atual') {
      setLinhasSemanaAtual(novasLinhas);
    } else {
      setLinhasProximaSemana(novasLinhas);
    }
  };

  const iniciarEdicao = (linhaIndex, campo, tabela) => {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('[INICIAR_EDIÇÃO] Iniciando edição');
    console.log('[INICIAR_EDIÇÃO] Parâmetros:', { linhaIndex, campo, tabela });
    
    const linhas = getLinhas(tabela);
    console.log('[INICIAR_EDIÇÃO] Total de linhas na tabela:', linhas.length);
    
    if (linhaIndex >= linhas.length) {
      console.error('[INICIAR_EDIÇÃO] ❌ ERRO: Índice inválido!', linhaIndex, '>=', linhas.length);
      return;
    }
    
    const linha = linhas[linhaIndex];
    console.log('[INICIAR_EDIÇÃO] Linha encontrada:', JSON.parse(JSON.stringify(linha)));
    
    // Inicializar campos específicos se necessário
    if (campo === 'valor') {
      console.log('[INICIAR_EDIÇÃO] Inicializando campo valor');
      const novasLinhas = [...linhas];
      if (novasLinhas[linhaIndex] && !novasLinhas[linhaIndex].valorTexto) {
        const valorFormatado = formatarValor(linhas[linhaIndex].valor);
        novasLinhas[linhaIndex].valorTexto = valorFormatado || '';
        console.log('[INICIAR_EDIÇÃO] Valor formatado:', valorFormatado);
        setLinhas(tabela, novasLinhas);
      }
    } else if (campo === 'data') {
      console.log('[INICIAR_EDIÇÃO] Inicializando campo data');
      const novasLinhas = [...linhas];
      if (novasLinhas[linhaIndex] && !novasLinhas[linhaIndex].dataTexto) {
        const dataFormatada = parsearDataParaInput(linhas[linhaIndex].data) || '';
        novasLinhas[linhaIndex].dataTexto = dataFormatada;
        console.log('[INICIAR_EDIÇÃO] Data formatada:', dataFormatada);
        setLinhas(tabela, novasLinhas);
      }
    }
    
    console.log('[INICIAR_EDIÇÃO] Definindo estado de edição:');
    console.log('  - editando:', linhaIndex);
    console.log('  - campoEditando:', campo);
    console.log('  - tabelaEditando:', tabela);
    
    setEditando(linhaIndex);
    setCampoEditando(campo);
    setTabelaEditando(tabela);
    
    console.log('[INICIAR_EDIÇÃO] ✅ Edição iniciada com sucesso');
    console.log('└─────────────────────────────────────────────────────────┘');
  };

  const finalizarEdicao = () => {
    console.log('[FINALIZAR] Finalizando edição');
    setEditando(null);
    setCampoEditando(null);
    setTabelaEditando(null);
  };

  const atualizarLinha = (linhaIndex, campo, valor, salvarValorBruto = false, tabela) => {
    console.log('[ATUALIZAR] Atualizando linha:', { linhaIndex, campo, valor, salvarValorBruto, tabela });
    
    const linhas = getLinhas(tabela);
    const novasLinhas = [...linhas];
    const linha = novasLinhas[linhaIndex];
    
    if (!linha) {
      console.error('[ATUALIZAR] ❌ ERRO: Linha não encontrada!');
      return;
    }
    
    console.log('[ATUALIZAR] Linha antes da atualização:', JSON.parse(JSON.stringify(linha)));

    if (campo === 'data') {
      // Salvar o texto digitado para permitir edição completa
      linha.dataTexto = valor;
      console.log('[ATUALIZAR] dataTexto atualizado para:', valor);
      // Converter para formato do banco apenas quando completo (DD/MM/YYYY)
      if (valor.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const dataConvertida = converterDataParaBanco(valor);
        linha.data = dataConvertida;
        console.log('[ATUALIZAR] Data convertida para formato banco:', dataConvertida);
      }
    } else if (campo === 'valor') {
      // Se salvarValorBruto, manter o texto digitado para permitir edição
      if (salvarValorBruto) {
        linha.valorTexto = valor;
        console.log('[ATUALIZAR] valorTexto atualizado para:', valor);
      } else {
        // Parsear apenas quando sair do campo
        const valorParseado = parsearValor(valor);
        linha.valor = valorParseado;
        linha.valorTexto = null;
        console.log('[ATUALIZAR] Valor parseado:', valorParseado);
      }
    } else if (campo === 'pago') {
      linha.pago = valor;
      console.log('[ATUALIZAR] Pago atualizado para:', valor);
    } else {
      linha[campo] = valor;
      console.log('[ATUALIZAR] Campo', campo, 'atualizado para:', valor);
    }

    console.log('[ATUALIZAR] Linha após atualização:', JSON.parse(JSON.stringify(linha)));
    setLinhas(tabela, novasLinhas);
  };

  const salvarLinha = async (linhaIndex, forcarSalvar = false, recarregar = true, tabela) => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[SALVAR] ===== INÍCIO DO SALVAMENTO =====');
    console.log('[SALVAR] Parâmetros:', { linhaIndex, tabela, forcarSalvar, recarregar });
    
    const linhas = getLinhas(tabela);
    console.log('[SALVAR] Total de linhas na tabela:', linhas.length);
    console.log('[SALVAR] Linha original (antes de processar):', JSON.parse(JSON.stringify(linhas[linhaIndex])));
    
    const linha = linhas[linhaIndex];
    if (!linha) {
      console.error('[SALVAR] ❌ ERRO: Linha não encontrada no índice', linhaIndex);
      return;
    }
    
    // Criar cópia da linha para não modificar o estado diretamente
    const linhaParaSalvar = { ...linha };
    console.log('[SALVAR] Linha copiada:', JSON.parse(JSON.stringify(linhaParaSalvar)));
    
    // Se tem dataTexto, converter para formato do banco antes de salvar
    if (linhaParaSalvar.dataTexto !== undefined && linhaParaSalvar.dataTexto !== null && linhaParaSalvar.dataTexto !== '') {
      console.log('[SALVAR] Processando dataTexto:', linhaParaSalvar.dataTexto);
      const dataConvertida = converterDataParaBanco(linhaParaSalvar.dataTexto);
      console.log('[SALVAR] Data convertida:', dataConvertida);
      if (dataConvertida) {
        linhaParaSalvar.data = dataConvertida;
      }
    }
    
    // Se tem valorTexto, parsear antes de salvar
    if (linhaParaSalvar.valorTexto !== undefined && linhaParaSalvar.valorTexto !== null && linhaParaSalvar.valorTexto !== '') {
      console.log('[SALVAR] Processando valorTexto:', linhaParaSalvar.valorTexto);
      const valorParseado = parsearValor(linhaParaSalvar.valorTexto);
      console.log('[SALVAR] Valor parseado:', valorParseado);
      if (valorParseado !== null) {
        linhaParaSalvar.valor = valorParseado;
      }
    }
    
    // Validar se tem pelo menos descrição ou data
    if (!forcarSalvar && !linhaParaSalvar.descricao && !linhaParaSalvar.data) {
      console.log('[SALVAR] ⚠️ Linha vazia, não salvando');
      return;
    }

    // Se não tem data, usar data atual
    if (!linhaParaSalvar.data) {
      const hoje = new Date();
      linhaParaSalvar.data = hoje.toISOString().split('T')[0];
      console.log('[SALVAR] Data não informada, usando data atual:', linhaParaSalvar.data);
    }

    // Preparar dados para salvar - GARANTIR QUE TODOS OS CAMPOS ESTEJAM PRESENTES
    const dadosParaSalvar = {
      id: linhaParaSalvar.id || null,
      data: linhaParaSalvar.data || '',
      descricao: linhaParaSalvar.descricao || '',
      valor: linhaParaSalvar.valor !== undefined && linhaParaSalvar.valor !== null ? linhaParaSalvar.valor : null,
      observacao: linhaParaSalvar.observacao || '',
      pago: linhaParaSalvar.pago !== undefined ? linhaParaSalvar.pago : false,
      restaurante_id: restauranteId || linhaParaSalvar.restaurante_id || null
    };

    console.log('[SALVAR] ✅ Dados preparados para salvar:', JSON.parse(JSON.stringify(dadosParaSalvar)));
    console.log('[SALVAR] Validação dos dados:');
    console.log('  - ID:', dadosParaSalvar.id);
    console.log('  - Data:', dadosParaSalvar.data);
    console.log('  - Descrição:', dadosParaSalvar.descricao);
    console.log('  - Valor:', dadosParaSalvar.valor);
    console.log('  - Observação:', dadosParaSalvar.observacao);
    console.log('  - Pago:', dadosParaSalvar.pago);
    console.log('  - Restaurante ID:', dadosParaSalvar.restaurante_id);

    // Verificar se a data pertence à semana correta após salvar
    const dataSalva = dadosParaSalvar.data;
    const pertenceAtual = pertenceSemanaAtual(dataSalva);
    const pertenceProxima = pertenceProximaSemana(dataSalva);
    
    console.log('[SALVAR] Verificação de semana:');
    console.log('  - Data salva:', dataSalva);
    console.log('  - Pertence à semana atual:', pertenceAtual);
    console.log('  - Pertence à próxima semana:', pertenceProxima);
    console.log('  - Tabela atual:', tabela);
    
    // Se a data não pertence à tabela atual, precisamos mover
    const tabelaCorreta = pertenceAtual ? 'atual' : (pertenceProxima ? 'proxima' : null);
    const precisaMover = tabelaCorreta && tabelaCorreta !== tabela;
    
    console.log('[SALVAR] Tabela correta:', tabelaCorreta);
    console.log('[SALVAR] Precisa mover?', precisaMover);

    // Só salvar se tiver pelo menos descrição ou se forçar
    if (dadosParaSalvar.descricao || forcarSalvar) {
      try {
        console.log('[SALVAR] Chamando onSave com recarregar=', recarregar);
        await onSave([dadosParaSalvar], recarregar);
        console.log('[SALVAR] ✅ Salvo com sucesso no servidor');
        
        // Se precisa mover para outra tabela
        if (precisaMover) {
          console.log('[SALVAR] 🔄 Gasto precisa ser movido para tabela:', tabelaCorreta);
          console.log('[SALVAR] Dados completos que serão movidos:', JSON.parse(JSON.stringify(dadosParaSalvar)));
          
          if (recarregar) {
            // Se vai recarregar, o recarregamento vai fazer isso automaticamente
            console.log('[SALVAR] Gasto será movido automaticamente após recarregamento');
          } else {
            // Se não vai recarregar, precisamos mover manualmente
            console.log('[SALVAR] Movendo manualmente para tabela', tabelaCorreta);
            // Remover da tabela atual
            const novasLinhasAtual = linhas.filter((_, idx) => idx !== linhaIndex);
            setLinhas(tabela, novasLinhasAtual);
            console.log('[SALVAR] ✅ Gasto removido da tabela', tabela);
            
            // Adicionar na tabela correta (será atualizado quando recarregar)
            const linhasDestino = getLinhas(tabelaCorreta);
            const novasLinhasDestino = [...linhasDestino];
            // Substituir a linha vazia no final pela linha movida
            const indiceVazio = novasLinhasDestino.findIndex(l => !l.id && !l.descricao && !l.data);
            if (indiceVazio !== -1) {
              novasLinhasDestino[indiceVazio] = { ...dadosParaSalvar };
            } else {
              novasLinhasDestino.push({ ...dadosParaSalvar });
            }
            setLinhas(tabelaCorreta, novasLinhasDestino);
            console.log('[SALVAR] ✅ Gasto adicionado na tabela', tabelaCorreta);
          }
        } else {
          // Atualizar estado local removendo valorTexto e dataTexto após salvar
          console.log('[SALVAR] Atualizando estado local da tabela', tabela);
          const novasLinhas = [...linhas];
          if (novasLinhas[linhaIndex]) {
            // Preservar todos os dados, apenas limpar campos temporários
            novasLinhas[linhaIndex] = {
              ...novasLinhas[linhaIndex],
              ...dadosParaSalvar,
              valorTexto: null,
              dataTexto: null
            };
            console.log('[SALVAR] Linha atualizada:', JSON.parse(JSON.stringify(novasLinhas[linhaIndex])));
            setLinhas(tabela, novasLinhas);
          }
        }
        console.log('[SALVAR] ===== FIM DO SALVAMENTO =====');
        console.log('═══════════════════════════════════════════════════════════');
      } catch (error) {
        console.error('[SALVAR] ❌ ERRO ao salvar:', error);
        console.error('[SALVAR] Stack:', error.stack);
        console.log('═══════════════════════════════════════════════════════════');
      }
    } else {
      console.log('[SALVAR] ⚠️ Não tem descrição, não salvando');
      console.log('═══════════════════════════════════════════════════════════');
    }
  };

  const handleLinhaBlur = async (linhaIndex, campo, tabela) => {
    console.log('─────────────────────────────────────────────────────────────');
    console.log('[BLUR] Campo perdeu foco:', campo, '| Linha:', linhaIndex, '| Tabela:', tabela);
    console.log('[BLUR] Estado - tabPressionado:', tabPressionado);
    console.log('[BLUR] Estado - editando:', editando, '| campoEditando:', campoEditando, '| tabelaEditando:', tabelaEditando);
    
    // Aguardar um pouco para verificar se Tab foi realmente pressionado
    // Isso evita que o blur interfira durante navegação com Tab
    if (tabPressionado) {
      console.log('[BLUR] ⚠️ Ignorando blur porque Tab foi pressionado');
      console.log('[BLUR] A flag será resetada pelo handleKeyDown');
      // Aguardar um pouco e verificar novamente
      setTimeout(() => {
        if (!tabPressionado) {
          console.log('[BLUR] Tab não estava ativo, salvando após delay');
          salvarLinha(linhaIndex, false, true, tabela).then(() => {
            finalizarEdicao();
          });
        }
      }, 200);
      return;
    }
    
    console.log('[BLUR] ✅ Processando blur normal - salvando linha');
    // Salvar quando sair da linha (com recarregamento para sincronizar e mover se necessário)
    await salvarLinha(linhaIndex, false, true, tabela);
    console.log('[BLUR] Finalizando edição após salvamento');
    finalizarEdicao();
    console.log('─────────────────────────────────────────────────────────────');
  };

  const deletarLinha = async (linhaIndex, tabela) => {
    const linhas = getLinhas(tabela);
    const linha = linhas[linhaIndex];
    if (linha.id) {
      if (window.confirm('Tem certeza que deseja deletar este gasto?')) {
        await onDelete(linha.id);
      }
    } else {
      // Remover linha vazia
      const novasLinhas = linhas.filter((_, index) => index !== linhaIndex);
      setLinhas(tabela, novasLinhas);
    }
  };

  const handleKeyDown = async (e, linhaIndex, campo, tabela) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[KEYDOWN] Tecla pressionada:', e.key, '| Campo:', campo, '| Linha:', linhaIndex, '| Tabela:', tabela);
    
    const linhas = getLinhas(tabela);
    console.log('[KEYDOWN] Total de linhas na tabela:', linhas.length);
    console.log('[KEYDOWN] Estado atual - editando:', editando, '| campoEditando:', campoEditando, '| tabelaEditando:', tabelaEditando);
    console.log('[KEYDOWN] Estado atual - tabPressionado:', tabPressionado);
    
    if (e.key === 'Enter') {
      console.log('[KEYDOWN] Enter pressionado - salvando e movendo para próxima linha');
      e.preventDefault();
      await salvarLinha(linhaIndex, false, true, tabela);
      // Mover para próxima linha, mesmo campo
      if (linhaIndex < linhas.length - 1) {
        console.log('[KEYDOWN] Movendo para próxima linha:', linhaIndex + 1);
        iniciarEdicao(linhaIndex + 1, campo, tabela);
      } else {
        console.log('[KEYDOWN] Última linha, finalizando edição');
        finalizarEdicao();
      }
    } else if (e.key === 'Escape') {
      console.log('[KEYDOWN] Escape pressionado - cancelando edição');
      finalizarEdicao();
    } else if (e.key === 'Tab') {
      console.log('[KEYDOWN] ═══ TAB PRESSIONADO ═══');
      e.preventDefault();
      e.stopPropagation();
      
      // Marcar que Tab foi pressionado para evitar que onBlur interfira
      const tabAnterior = tabPressionado;
      setTabPressionado(true);
      console.log('[KEYDOWN] Flag tabPressionado alterada de', tabAnterior, 'para true');
      
      // Ordem dos campos: data, descricao, valor, observacao, pago
      const campos = ['data', 'descricao', 'valor', 'observacao', 'pago'];
      const campoAtual = campos.indexOf(campo);
      
      // Verificar se campoAtual é válido
      if (campoAtual === -1) {
        console.error('[KEYDOWN] ❌ ERRO: Campo não encontrado:', campo);
        setTabPressionado(false);
        return;
      }
      
      console.log('[KEYDOWN] Campo atual:', campo, '| Índice:', campoAtual);
      console.log('[KEYDOWN] Total de campos:', campos.length);
      
      // NÃO salvar durante Tab para evitar perda de foco
      // O salvamento será feito no blur
      console.log('[KEYDOWN] Pulando salvamento durante Tab para preservar foco');
      
      // Navegar para o próximo campo
      // Se não é o último campo, ir para o próximo na mesma linha
      if (campoAtual < campos.length - 1) {
        // Próximo campo na mesma linha
        const proximoCampo = campos[campoAtual + 1];
        console.log('[KEYDOWN] Navegando para próximo campo na mesma linha:', proximoCampo);
        
        // Usar requestAnimationFrame para garantir que o DOM está atualizado
        requestAnimationFrame(() => {
          setTimeout(() => {
            console.log('[KEYDOWN] Iniciando edição do próximo campo');
            iniciarEdicao(linhaIndex, proximoCampo, tabela);
            // Resetar flag após garantir que o novo campo está focado
            setTimeout(() => {
              console.log('[KEYDOWN] Resetando flag tabPressionado');
              setTabPressionado(false);
            }, 150);
          }, 50);
        });
      } else {
        // Se está no último campo (pago), ir para próxima linha
        console.log('[KEYDOWN] Último campo, verificando próxima linha');
        if (linhaIndex < linhas.length - 1) {
          // Já existe próxima linha, ir para ela
          console.log('[KEYDOWN] Navegando para próxima linha:', linhaIndex + 1);
          requestAnimationFrame(() => {
            setTimeout(() => {
              iniciarEdicao(linhaIndex + 1, campos[0], tabela);
              setTimeout(() => {
                console.log('[KEYDOWN] Resetando flag tabPressionado após navegação para próxima linha');
                setTabPressionado(false);
              }, 150);
            }, 50);
          });
        } else {
          // Está na última linha e último campo - salvar antes de finalizar
          console.log('[KEYDOWN] Última linha da tabela, salvando antes de finalizar');
          // Salvar a linha atual antes de finalizar
          salvarLinha(linhaIndex, false, true, tabela).then(() => {
            console.log('[KEYDOWN] Gasto salvo, finalizando edição');
            finalizarEdicao();
            setTabPressionado(false);
          }).catch(err => {
            console.error('[KEYDOWN] Erro ao salvar na última linha:', err);
            finalizarEdicao();
            setTabPressionado(false);
          });
        }
      }
      console.log('[KEYDOWN] ═══ FIM DO PROCESSAMENTO DO TAB ═══');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // Função para renderizar uma tabela
  const renderizarTabela = (linhas, tabela, titulo, periodo) => {
    const estaEditando = (linhaIndex, campo) => 
      editando === linhaIndex && campoEditando === campo && tabelaEditando === tabela;

    return (
      <div className="grid-container-semana">
        <div className="grid-semana-header">
          <h3>{titulo}</h3>
          <span className="grid-semana-periodo">{periodo}</span>
        </div>
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
            <div className="grid-cell" data-label="Data">
              {estaEditando(linhaIndex, 'data') ? (
                <input
                  type="text"
                  value={linha.dataTexto !== undefined && linha.dataTexto !== null 
                    ? linha.dataTexto 
                    : parsearDataParaInput(linha.data)}
                  onChange={(e) => {
                    // Aplicar máscara de data enquanto digita
                    const valorDigitado = e.target.value;
                    const valorComMascara = aplicarMascaraData(valorDigitado);
                    atualizarLinha(linhaIndex, 'data', valorComMascara, false, tabela);
                  }}
                  onBlur={() => handleLinhaBlur(linhaIndex, 'data', tabela)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'data', tabela)}
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
                    setLinhas(tabela, novasLinhas);
                    iniciarEdicao(linhaIndex, 'data', tabela);
                  }}
                >
                  {formatarData(linha.data) || 'Clique para digitar'}
                </div>
              )}
            </div>

            <div className="grid-cell" data-label="Descrição">
              {estaEditando(linhaIndex, 'descricao') ? (
                <input
                  type="text"
                  value={linha.descricao || ''}
                  onChange={(e) => atualizarLinha(linhaIndex, 'descricao', e.target.value, false, tabela)}
                  onBlur={() => handleLinhaBlur(linhaIndex, 'descricao', tabela)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'descricao', tabela)}
                  autoFocus
                  className="grid-input"
                  placeholder="Digite a descrição"
                />
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => iniciarEdicao(linhaIndex, 'descricao', tabela)}
                >
                  {linha.descricao || ''}
                </div>
              )}
            </div>

            <div className="grid-cell" data-label="Valor">
              {estaEditando(linhaIndex, 'valor') ? (
                <input
                  type="text"
                  value={linha.valorTexto !== undefined && linha.valorTexto !== null 
                    ? linha.valorTexto 
                    : formatarValor(linha.valor)}
                  onChange={(e) => {
                    // Aplicar máscara monetária enquanto digita
                    const valorDigitado = e.target.value;
                    const valorComMascara = aplicarMascaraValor(valorDigitado);
                    atualizarLinha(linhaIndex, 'valor', valorComMascara, true, tabela);
                  }}
                  onBlur={() => handleLinhaBlur(linhaIndex, 'valor', tabela)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'valor', tabela)}
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
                    setLinhas(tabela, novasLinhas);
                    iniciarEdicao(linhaIndex, 'valor', tabela);
                  }}
                >
                  {linha.valor ? `R$ ${formatarValor(linha.valor)}` : '0,00'}
                </div>
              )}
            </div>

            <div className="grid-cell" data-label="Observação">
              {estaEditando(linhaIndex, 'observacao') ? (
                <input
                  type="text"
                  value={linha.observacao || ''}
                  onChange={(e) => atualizarLinha(linhaIndex, 'observacao', e.target.value, false, tabela)}
                  onBlur={() => handleLinhaBlur(linhaIndex, 'observacao', tabela)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'observacao', tabela)}
                  autoFocus
                  className="grid-input"
                  placeholder="Observações"
                />
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => iniciarEdicao(linhaIndex, 'observacao', tabela)}
                >
                  {linha.observacao || ''}
                </div>
              )}
            </div>

            <div className="grid-cell" data-label="Pago">
              {estaEditando(linhaIndex, 'pago') ? (
                <select
                  value={linha.pago ? 'sim' : 'nao'}
                  onChange={(e) => {
                    atualizarLinha(linhaIndex, 'pago', e.target.value === 'sim', false, tabela);
                    salvarLinha(linhaIndex, false, true, tabela);
                  }}
                  onBlur={() => handleLinhaBlur(linhaIndex, 'pago', tabela)}
                  onKeyDown={(e) => handleKeyDown(e, linhaIndex, 'pago', tabela)}
                  autoFocus
                  className="grid-input"
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              ) : (
                <div
                  className="grid-cell-content"
                  onClick={() => iniciarEdicao(linhaIndex, 'pago', tabela)}
                >
                  {linha.pago ? 'Sim' : 'Não'}
                </div>
              )}
            </div>

            <div className="grid-cell acoes-cell" data-label="Ações">
              <button
                className="btn-delete"
                onClick={() => deletarLinha(linhaIndex, tabela)}
                title="Deletar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    );
  };

  // Função auxiliar para extrair valor numérico de uma linha
  const extrairValorNumerico = (linha) => {
    // Se está editando e tem valorTexto, usar ele
    if (linha.valorTexto !== undefined && linha.valorTexto !== null && linha.valorTexto !== '') {
      const valor = parsearValor(linha.valorTexto);
      return valor !== null ? valor : 0;
    }
    
    // Senão, usar o valor original (pode ser número ou string formatada)
    if (linha.valor !== undefined && linha.valor !== null && linha.valor !== '') {
      // Se já é número, retornar diretamente
      if (typeof linha.valor === 'number') {
        return linha.valor;
      }
      // Se é string, parsear
      const valor = parsearValor(linha.valor);
      return valor !== null ? valor : 0;
    }
    
    return 0;
  };

  // Calcular totais baseado nas linhas editadas (para refletir mudanças em tempo real)
  const totais = useMemo(() => {
    // Total de despesas da semana atual (usando linhas editadas)
    const despesasSemanaAtual = linhasSemanaAtual.reduce((total, linha) => {
      // Ignorar linha vazia (nova linha sem dados)
      if (!linha.id && !linha.descricao && !linha.data && !linha.valor && !linha.valorTexto) {
        return total;
      }
      const valor = extrairValorNumerico(linha);
      return total + (valor || 0);
    }, 0);

    // Total de despesas da próxima semana (usando linhas editadas)
    const despesasProximaSemana = linhasProximaSemana.reduce((total, linha) => {
      // Ignorar linha vazia (nova linha sem dados)
      if (!linha.id && !linha.descricao && !linha.data && !linha.valor && !linha.valorTexto) {
        return total;
      }
      const valor = extrairValorNumerico(linha);
      return total + (valor || 0);
    }, 0);

    // Total de despesas pagas (da semana atual)
    const valorJaPago = linhasSemanaAtual.reduce((total, linha) => {
      // Ignorar linha vazia
      if (!linha.id && !linha.descricao && !linha.data && !linha.valor && !linha.valorTexto) {
        return total;
      }
      if (linha.pago) {
        const valor = extrairValorNumerico(linha);
        return total + (valor || 0);
      }
      return total;
    }, 0);

    // Saldo semanal (conta - despesas pagas)
    const saldoSemanal = valorConta - valorJaPago;

    // Log detalhado para debug - apenas quando houver linhas
    if (linhasSemanaAtual.length > 0 || linhasProximaSemana.length > 0) {
      console.log('[TOTAIS] ════════════════════════════════════════════════════');
      console.log('[TOTAIS] Calculados:', {
        valorConta: valorConta.toFixed(2),
        despesasSemanaAtual: despesasSemanaAtual.toFixed(2),
        despesasProximaSemana: despesasProximaSemana.toFixed(2),
        valorJaPago: valorJaPago.toFixed(2),
        saldoSemanal: saldoSemanal.toFixed(2),
        linhasSemanaAtual: linhasSemanaAtual.length,
        linhasProximaSemana: linhasProximaSemana.length
      });

      // Log detalhado semana atual (apenas linhas com ID, ignorar linha vazia)
      const linhasComDadosAtual = linhasSemanaAtual.filter(l => l.id !== null);
      if (linhasComDadosAtual.length > 0) {
        console.log('[TOTAIS] Detalhamento semana atual:');
        linhasComDadosAtual.forEach(l => {
          const valorNum = extrairValorNumerico(l);
          console.log(`  - ID ${l.id}: ${l.descricao} | Valor original: ${l.valor} (${typeof l.valor}) | Valor numérico: ${valorNum} | Pago: ${l.pago}`);
        });
      }

      // Log detalhado próxima semana (apenas linhas com ID, ignorar linha vazia)
      const linhasComDadosProxima = linhasProximaSemana.filter(l => l.id !== null);
      if (linhasComDadosProxima.length > 0) {
        console.log('[TOTAIS] Detalhamento próxima semana:');
        linhasComDadosProxima.forEach(l => {
          const valorNum = extrairValorNumerico(l);
          console.log(`  - ID ${l.id}: ${l.descricao} | Valor original: ${l.valor} (${typeof l.valor}) | Valor numérico: ${valorNum} | Pago: ${l.pago}`);
        });
      }
      console.log('[TOTAIS] ════════════════════════════════════════════════════');
    }

    return {
      valorConta,
      despesasSemanaAtual,
      despesasProximaSemana,
      valorJaPago,
      saldoSemanal
    };
  }, [linhasSemanaAtual, linhasProximaSemana, valorConta]);

  // Calcular períodos das semanas
  const domingoSemanaAtual = getDomingoSemanaAtual();
  const sabadoSemanaAtual = getSabadoSemanaAtual();
  const domingoProximaSemana = getDomingoProximaSemana();
  const sabadoProximaSemana = getSabadoProximaSemana();

  // Função para formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (valor === null || valor === undefined || valor === '') {
      return 'R$ 0,00';
    }
    
    // Se já é número, usar diretamente
    let valorNum;
    if (typeof valor === 'number') {
      valorNum = valor;
    } else if (typeof valor === 'string') {
      // Tentar parsear string
      valorNum = parseFloat(valor);
      if (isNaN(valorNum)) {
        // Se não conseguiu parsear, tentar remover formatação
        valorNum = parsearValor(valor);
        if (valorNum === null) {
          return 'R$ 0,00';
        }
      }
    } else {
      return 'R$ 0,00';
    }
    
    // Formatar com 2 casas decimais, vírgula como separador decimal e ponto como separador de milhar
    return `R$ ${valorNum.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  // Handler para editar valor da conta
  const handleContaChange = (e) => {
    const valorDigitado = e.target.value;
    // Aplicar máscara monetária enquanto digita
    const valorComMascara = aplicarMascaraValor(valorDigitado);
    setValorContaTexto(valorComMascara);
  };

  const handleContaBlur = (e) => {
    const valorDigitado = valorContaTexto || e.target.value;
    const valorParseado = parsearValor(valorDigitado);
    if (valorParseado !== null && !isNaN(valorParseado)) {
      setValorConta(valorParseado);
      console.log('[CONTA] Valor da conta atualizado para:', valorParseado);
      // Salvar no localStorage para persistir
      localStorage.setItem(`conta_${restauranteId}`, valorParseado.toString());
    } else {
      // Se não conseguiu parsear, manter o valor anterior
      setValorContaTexto('');
    }
    setEditandoConta(false);
  };

  const iniciarEdicaoConta = () => {
    setValorContaTexto(formatarValorMonetario(valorConta).replace('R$ ', '').replace(/\./g, ''));
    setEditandoConta(true);
  };

  // Renderizar totalizadores
  const renderizarTotalizadores = () => {
    return (
      <div className="totalizadores-container">
        <div className="totalizador-item conta-item">
          <label className="totalizador-label">Conta:</label>
          {editandoConta ? (
            <input
              type="text"
              className="totalizador-input"
              value={valorContaTexto}
              onChange={handleContaChange}
              onBlur={handleContaBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                } else if (e.key === 'Escape') {
                  setValorContaTexto('');
                  setEditandoConta(false);
                }
              }}
              autoFocus
              placeholder="0,00"
              inputMode="decimal"
            />
          ) : (
            <div 
              className="totalizador-valor editavel"
              onClick={iniciarEdicaoConta}
              title="Clique para editar"
            >
              {formatarValorMonetario(totais.valorConta)}
            </div>
          )}
        </div>

        <div className="totalizador-item">
          <label className="totalizador-label">Despesas Futura:</label>
          <div className="totalizador-valor">
            {formatarValorMonetario(totais.despesasProximaSemana)}
          </div>
        </div>

        <div className="totalizador-item">
          <label className="totalizador-label">Despesas:</label>
          <div className="totalizador-valor">
            {formatarValorMonetario(totais.despesasSemanaAtual)}
          </div>
        </div>

        <div className="totalizador-item">
          <label className="totalizador-label">Valor Já Pago:</label>
          <div className="totalizador-valor">
            {formatarValorMonetario(totais.valorJaPago)}
          </div>
        </div>

        <div className="totalizador-item saldo-item">
          <label className="totalizador-label">Saldo Semanal:</label>
          <div className={`totalizador-valor saldo ${totais.saldoSemanal < 0 ? 'negativo' : 'positivo'}`}>
            {formatarValorMonetario(totais.saldoSemanal)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid-wrapper">
      {renderizarTotalizadores()}
      <div className="grid-container-dual">
        {renderizarTabela(
          linhasSemanaAtual,
          'atual',
          'Semana Atual',
          formatarPeriodoSemana(domingoSemanaAtual, sabadoSemanaAtual)
        )}
        {renderizarTabela(
          linhasProximaSemana,
          'proxima',
          'Próxima Semana',
          formatarPeriodoSemana(domingoProximaSemana, sabadoProximaSemana)
        )}
      </div>
    </div>
  );
};

export default GridEditavel;

