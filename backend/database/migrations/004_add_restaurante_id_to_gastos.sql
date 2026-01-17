-- Add restaurante_id column to gastos table
ALTER TABLE gastos 
ADD COLUMN IF NOT EXISTS restaurante_id INTEGER REFERENCES restaurantes(id) ON DELETE SET NULL;

-- Create index on restaurante_id for better query performance
CREATE INDEX IF NOT EXISTS idx_gastos_restaurante_id ON gastos(restaurante_id);
