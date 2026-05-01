// Configuração dinâmica da URL da API
// Detecta automaticamente se está rodando em localhost ou em rede local

function trimTrailingSlashes(url) {
  return String(url || '').replace(/\/+$/, '');
}

/**
 * Easypanel homolog: front em …financialmanagementhomolog… e API em …financialmanagementapphomolog…
 * Quando REACT_APP_API_URL não entra no build do CRA, o host da página seria o do front — POST /api iria para o React (405).
 */
function easypanelHostnameToApiHost(hostname) {
  if (
    hostname.includes('financialmanagementhomolog') &&
    !hostname.includes('financialmanagementapphomolog')
  ) {
    return hostname.replace(/financialmanagementhomolog/gi, 'financialmanagementapphomolog');
  }
  return hostname;
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
      const apiHost = easypanelHostnameToApiHost(hostname);
      return `${protocol}//${apiHost}/api`;
    }
    // Fallback: usa o protocolo atual da página
    return `${protocol}//${hostname}:5000/api`;
  }
  
  // Default: localhost (desenvolvimento)
  return 'http://localhost:5000/api';
};

export const API_URL = trimTrailingSlashes(getApiUrl());
