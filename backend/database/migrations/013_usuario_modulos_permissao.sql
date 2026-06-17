-- Permissões por módulo (substitui o modelo binário somente_estoque)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulo_financeiro BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulo_estoque BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulo_estoque_simplificado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN usuarios.modulo_financeiro IS 'Acesso a gastos, relatórios e cadastro de restaurantes.';
COMMENT ON COLUMN usuarios.modulo_estoque IS 'Acesso ao módulo de estoque completo (catálogo, movimentação, etc.).';
COMMENT ON COLUMN usuarios.modulo_estoque_simplificado IS 'Acesso apenas ao lançamento diário simplificado de estoque.';

-- Administradores: todos os módulos
UPDATE usuarios
SET modulo_financeiro = true,
    modulo_estoque = true,
    modulo_estoque_simplificado = true
WHERE is_admin = true;

-- Usuários financeiros legados (não admin, não somente_estoque)
UPDATE usuarios
SET modulo_financeiro = true,
    modulo_estoque = false,
    modulo_estoque_simplificado = false
WHERE is_admin = false
  AND COALESCE(somente_estoque, false) = false;

-- Usuários somente estoque legados → módulo estoque completo
UPDATE usuarios
SET modulo_financeiro = false,
    modulo_estoque = true,
    modulo_estoque_simplificado = false
WHERE is_admin = false
  AND COALESCE(somente_estoque, false) = true;
