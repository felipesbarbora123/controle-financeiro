ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(10),
  ADD COLUMN IF NOT EXISTS quantidade INTEGER,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS estornado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estornado_por_movimento_id INTEGER REFERENCES estoque_movimentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS movimento_estorno_de_id INTEGER REFERENCES estoque_movimentos(id) ON DELETE SET NULL;

UPDATE estoque_movimentos
SET tipo = CASE WHEN diferenca >= 0 THEN 'entrada' ELSE 'saida' END
WHERE tipo IS NULL;

UPDATE estoque_movimentos
SET quantidade = ABS(diferenca)
WHERE quantidade IS NULL;

ALTER TABLE estoque_movimentos
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN quantidade SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_estoque_mov_tipo'
  ) THEN
    ALTER TABLE estoque_movimentos
      ADD CONSTRAINT chk_estoque_mov_tipo CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'estorno'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estoque_mov_tipo ON estoque_movimentos(tipo);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_prod_data ON estoque_movimentos(produto_id, created_at);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_mov_estorno_de ON estoque_movimentos(movimento_estorno_de_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_mov_estornado_por ON estoque_movimentos(estornado_por_movimento_id) WHERE estornado_por_movimento_id IS NOT NULL;
