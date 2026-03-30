-- Usuários "somente estoque" só acessam restaurantes vinculados nesta tabela.
CREATE TABLE IF NOT EXISTS usuario_restaurante_estoque (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, restaurante_id)
);

CREATE INDEX IF NOT EXISTS idx_ure_usuario ON usuario_restaurante_estoque(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ure_restaurante ON usuario_restaurante_estoque(restaurante_id);

COMMENT ON TABLE usuario_restaurante_estoque IS 'Restaurantes que cada usuário somente_estoque pode lançar estoque.';

-- Quem já era somente_estoque ganha acesso a todos os restaurantes ativos (comportamento anterior).
INSERT INTO usuario_restaurante_estoque (usuario_id, restaurante_id)
SELECT u.id, r.id
FROM usuarios u
CROSS JOIN restaurantes r
WHERE COALESCE(u.somente_estoque, false) = true
  AND COALESCE(r.ativo, true) = true
ON CONFLICT (usuario_id, restaurante_id) DO NOTHING;
