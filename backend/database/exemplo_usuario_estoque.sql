-- Exemplo: usuário que vê apenas o módulo de estoque (sem financeiro)
-- A senha deve ser um hash bcrypt. Gere com: node backend/database/generate_admin_hash.js
-- ou crie o usuário pelo fluxo normal e depois execute o UPDATE abaixo.

-- Marcar usuário existente como somente estoque:
-- UPDATE usuarios SET somente_estoque = true WHERE username = 'estoque_loja1';

-- Inserir novo usuário (substitua HASH_BCRYPT pela saída do script de hash):
-- INSERT INTO usuarios (username, password, nome, is_admin, somente_estoque)
-- VALUES ('estoque_loja1', 'HASH_BCRYPT', 'Estoque Loja 1', false, true);
