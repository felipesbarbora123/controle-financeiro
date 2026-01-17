-- Script SQL para criar usuário admin no banco de produção
-- IMPORTANTE: A senha precisa ser hasheada com bcrypt antes de inserir no banco
-- Use o script Node.js: node generate_admin_hash.js para gerar o hash correto

-- Opção 1: Se você já tem o hash bcrypt da senha, use este SQL:
-- (Substitua 'SEU_HASH_AQUI' pelo hash gerado)

-- Verificar se o usuário já existe e deletar (opcional - descomente se necessário)
-- DELETE FROM usuarios WHERE username = 'admin';

-- Inserir ou atualizar o usuário admin
INSERT INTO usuarios (username, password, nome, is_admin, created_at, updated_at)
VALUES (
  'admin',
  'SEU_HASH_BCRYPT_AQUI', -- Substitua pelo hash gerado pelo script Node.js
  'Administrador',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (username) 
DO UPDATE SET 
  password = EXCLUDED.password,
  nome = EXCLUDED.nome,
  is_admin = EXCLUDED.is_admin,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- INSTRUÇÕES PARA USAR ESTE SQL:
-- ============================================================
-- 
-- 1. Primeiro, gere o hash bcrypt executando (no terminal do Easypanel):
--    node backend/database/generate_admin_hash.js
--
-- 2. O script irá gerar um SQL completo com o hash correto
--
-- 3. Copie o SQL gerado e execute no banco de produção
--
-- 4. Ou use o SQL abaixo substituindo 'SEU_HASH_AQUI' pelo hash gerado
--
-- ============================================================

-- Após gerar o hash, você pode fazer login com:
-- Username: admin
-- Password: admin123 (ou a senha que você escolheu)
--
-- RECOMENDAÇÃO: Altere a senha após o primeiro login!
