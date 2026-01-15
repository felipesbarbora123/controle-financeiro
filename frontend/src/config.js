// Configuração dinâmica da URL da API
// Detecta automaticamente se está rodando em localhost ou em rede local
const getApiUrl = () => {
  // Se está definido nas variáveis de ambiente, usa
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Se está acessando de outro dispositivo (não localhost), usa o hostname atual
  const hostname = window.location.hostname;
  
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Está acessando de outro dispositivo, usa o hostname atual
    return `http://${hostname}:5000/api`;
  }
  
  // Default: localhost
  return 'http://localhost:5000/api';
};

export const API_URL = getApiUrl();
