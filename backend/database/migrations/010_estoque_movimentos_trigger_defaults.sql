-- Garante tipo/quantidade em INSERTs legados (apenas 6 colunas) após 009 NOT NULL.
-- Evita 23502 quando o backend em produção ainda não envia tipo/quantidade no INSERT.

CREATE OR REPLACE FUNCTION estoque_movimentos_preencher_tipo_quantidade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo IS NULL THEN
    NEW.tipo := CASE WHEN NEW.diferenca >= 0 THEN 'entrada' ELSE 'saida' END;
  END IF;
  IF NEW.quantidade IS NULL THEN
    NEW.quantidade := ABS(NEW.diferenca);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_estoque_movimentos_defaults ON estoque_movimentos;

CREATE TRIGGER trg_estoque_movimentos_defaults
  BEFORE INSERT ON estoque_movimentos
  FOR EACH ROW
  EXECUTE PROCEDURE estoque_movimentos_preencher_tipo_quantidade();

COMMENT ON FUNCTION estoque_movimentos_preencher_tipo_quantidade() IS
  'Preenche tipo e quantidade quando o INSERT não os informa (compatibilidade com API antiga).';
