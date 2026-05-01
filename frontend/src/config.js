// Configuração dinâmica da URL da API
// Detecta automaticamente se está rodando em localhost ou em rede local

function trimTrailingSlashes(url) {
  return String(url || '').replace(/\/+$/, '');
}

const getApiUrl = () => {
  // Se está definido nas variáveis de ambiente, usa (sem barra final: evita .../api//login)
  if (process.env.REACT_APP_API_URL) {
    return trimTrailingSlashes(process.env.REACT_APP_API_URL);
  }
  
  // Se está acessando de outro dispositivo (não localhost)
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 'https:' ou 'http:'
  
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Usa o mesmo protocolo da página (HTTPS em produção)
    if (hostname.includes('easypanel.host')) {
      // Mesmo host da página (homolog/prod cada um no seu domínio). Se a API for outro host, defina REACT_APP_API_URL no build.
      return `${protocol}//${hostname}/api`;
    }
    // Fallback: usa o protocolo atual da página
    return `${protocol}//${hostname}:5000/api`;
  }
  
  // Default: localhost (desenvolvimento)
  return 'http://localhost:5000/api';
};

export const API_URL = trimTrailingSlashes(getApiUrl());
