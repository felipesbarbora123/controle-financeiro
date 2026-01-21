-- Add retroativo column to gastos table
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS retroativo BOOLEAN DEFAULT false;

-- Create index on retroativo for better query performance
CREATE INDEX IF NOT EXISTS idx_gastos_retroativo ON gastos(retroativo);
