-- Histórico de lançamentos de quantidade (entrada/saída implícita pela diferença)
CREATE TABLE IF NOT EXISTS estoque_movimentos (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES estoque_produtos(id) ON DELETE CASCADE,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    quantidade_antes INTEGER NOT NULL,
    quantidade_depois INTEGER NOT NULL,
    diferenca INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_estoque_mov_diferenca CHECK (diferenca = quantidade_depois - quantidade_antes)
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_restaurante ON estoque_movimentos(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_created ON estoque_movimentos(created_at);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto ON estoque_movimentos(produto_id);

COMMENT ON TABLE estoque_movimentos IS 'Cada alteração de quantidade: diferenca > 0 entrada, < 0 saída (em unidades inteiras).';
