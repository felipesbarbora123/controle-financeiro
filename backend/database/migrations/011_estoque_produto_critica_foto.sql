-- Quantidade mínima/crítica para alerta de reposição e foto do item (URL ou data URL).

ALTER TABLE estoque_produtos ADD COLUMN IF NOT EXISTS quantidade_critica INTEGER NOT NULL DEFAULT 0;
ALTER TABLE estoque_produtos ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN estoque_produtos.quantidade_critica IS 'Quando quantidade em estoque <= este valor (e > 0), o item aparece como crítico. 0 = sem limite configurado.';
COMMENT ON COLUMN estoque_produtos.foto_url IS 'URL pública ou data URL (base64) da imagem do produto.';
