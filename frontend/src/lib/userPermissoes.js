/** Permissões efetivas do usuário (admin = tudo). */
export function permissoesUsuario(user) {
  if (!user) {
    return { financeiro: false, estoque: false, estoqueSimplificado: false };
  }
  if (user.is_admin) {
    return { financeiro: true, estoque: true, estoqueSimplificado: true };
  }
  return {
    financeiro: !!user.modulo_financeiro,
    estoque: !!user.modulo_estoque,
    estoqueSimplificado: !!user.modulo_estoque_simplificado
  };
}

export function usuarioTemAlgumModulo(user) {
  const p = permissoesUsuario(user);
  return p.financeiro || p.estoque || p.estoqueSimplificado;
}

/** Restaurantes restritos (usuário só com módulos de estoque). */
export function usuarioRestaurantesRestritos(user) {
  if (!user || user.is_admin) return false;
  const p = permissoesUsuario(user);
  return !p.financeiro && (p.estoque || p.estoqueSimplificado);
}

export function telaInicialUsuario(user) {
  if (!user) return 'gastos';
  if (user.is_admin) return 'inicio';
  const p = permissoesUsuario(user);
  if (p.financeiro) return 'gastos';
  if (p.estoque || p.estoqueSimplificado) return 'estoque';
  return 'gastos';
}

export function estoqueViewInicial(user) {
  const p = permissoesUsuario(user);
  if (p.estoque) return 'resumo';
  if (p.estoqueSimplificado) return 'diario';
  return 'resumo';
}
