-- Script de inicialização do banco de dados
-- Execute este script para criar o banco de dados e o usuário (se necessário)

-- Criar banco de dados (execute como superusuário)
-- CREATE DATABASE controle_financeiro;

-- Conectar ao banco de dados
-- \c controle_financeiro

-- Criar tabela de gastos
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

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos(data);
CREATE INDEX IF NOT EXISTS idx_gastos_descricao ON gastos(descricao);

-- Inserir alguns dados de exemplo (opcional)
-- INSERT INTO gastos (data, descricao, valor, observacao, pago) VALUES
-- ('2026-01-12', 'meganet', NULL, NULL, true),
-- ('2026-01-12', 'UL', 847.25, NULL, false),
-- ('2026-01-12', 'sul', 1142.94, NULL, false);

