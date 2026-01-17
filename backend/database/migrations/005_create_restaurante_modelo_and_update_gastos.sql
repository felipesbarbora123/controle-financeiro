-- Create restaurante modelo (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM restaurantes WHERE nome = 'Restaurante Modelo') THEN
        INSERT INTO restaurantes (nome, endereco, ativo)
        VALUES ('Restaurante Modelo', 'Endereço não informado', true);
    END IF;
END $$;

-- Get the ID of the restaurante modelo (or first restaurante if it already exists)
DO $$
DECLARE
    restaurante_modelo_id INTEGER;
BEGIN
    -- Get the first restaurante (should be the modelo we just created or existing one)
    SELECT id INTO restaurante_modelo_id 
    FROM restaurantes 
    ORDER BY id ASC 
    LIMIT 1;
    
    -- Update all existing gastos to use the restaurante modelo
    IF restaurante_modelo_id IS NOT NULL THEN
        UPDATE gastos 
        SET restaurante_id = restaurante_modelo_id 
        WHERE restaurante_id IS NULL;
    END IF;
END $$;
