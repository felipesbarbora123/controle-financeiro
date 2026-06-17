-- Lançamentos diários simplificados (texto livre, sem vínculo com catálogo de produtos)
CREATE TABLE IF NOT EXISTS estoque_lancamentos_diarios (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    produto TEXT NOT NULL DEFAULT '',
    data_lancamento DATE,
    quantidade TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estoque_ld_restaurante_data
    ON estoque_lancamentos_diarios(restaurante_id, data_lancamento DESC);

CREATE INDEX IF NOT EXISTS idx_estoque_ld_restaurante_created
    ON estoque_lancamentos_diarios(restaurante_id, created_at DESC);

COMMENT ON TABLE estoque_lancamentos_diarios IS
    'Lançamento diário simplificado: produto e quantidade em texto livre, sem catálogo.';
