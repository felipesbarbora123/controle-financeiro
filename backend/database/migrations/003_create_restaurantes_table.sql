-- Create restaurantes table
CREATE TABLE IF NOT EXISTS restaurantes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    endereco VARCHAR(500),
    telefone VARCHAR(20),
    email VARCHAR(255),
    cnpj VARCHAR(18),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on nome for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurantes_nome ON restaurantes(nome);

-- Create index on ativo for filtering
CREATE INDEX IF NOT EXISTS idx_restaurantes_ativo ON restaurantes(ativo);
