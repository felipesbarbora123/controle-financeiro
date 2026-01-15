-- Create gastos table
CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2),
    observacao TEXT,
    pago BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on data for better query performance
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos(data);

-- Create index on descricao for search
CREATE INDEX IF NOT EXISTS idx_gastos_descricao ON gastos(descricao);

