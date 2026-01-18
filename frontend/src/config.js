// Configuração dinâmica da URL da API
// Detecta automaticamente se está rodando em localhost ou em rede local
const getApiUrl = () => {
  // Se está definido nas variáveis de ambiente, usa
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Se está acessando de outro dispositivo (não localhost)
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 'https:' ou 'http:'
  
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Usa o mesmo protocolo da página (HTTPS em produção)
    // Se o backend está no mesmo domínio mas porta diferente, ajuste aqui
    // Por padrão, usa o domínio do backend no Easypanel
    if (hostname.includes('easypanel.host')) {
      // Produção: usa o domínio do backend com HTTPS
      return `https://multi-app-financialmanagementapp.dtun51.easypanel.host/api`;
    }
    // Fallback: usa o protocolo atual da página
    return `${protocol}//${hostname}:5000/api`;
  }
  
  // Default: localhost (desenvolvimento)
  return 'http://localhost:5000/api';
};

export const API_URL = getApiUrl();
