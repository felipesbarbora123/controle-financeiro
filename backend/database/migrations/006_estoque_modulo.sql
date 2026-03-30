-- Módulo de estoque multi-restaurante + perfil de usuário "somente estoque"
-- Execute após as migrações anteriores.

-- Coluna: usuários que acessam apenas o módulo de estoque (sem financeiro)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS somente_estoque BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN usuarios.somente_estoque IS 'Se true, o usuário vê apenas estoque no app e a API financeira retorna 403.';

-- Categorias de produtos por restaurante
CREATE TABLE IF NOT EXISTS estoque_categorias (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_estoque_categoria_restaurante_nome UNIQUE (restaurante_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_estoque_categorias_restaurante ON estoque_categorias(restaurante_id);

-- Produtos do estoque
CREATE TABLE IF NOT EXISTS estoque_produtos (
    id SERIAL PRIMARY KEY,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES estoque_categorias(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    unidade VARCHAR(20) NOT NULL DEFAULT 'un',
    quantidade NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_estoque_produto_rest_cat_nome UNIQUE (restaurante_id, categoria_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_estoque_produtos_restaurante ON estoque_produtos(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_estoque_produtos_categoria ON estoque_produtos(categoria_id);
