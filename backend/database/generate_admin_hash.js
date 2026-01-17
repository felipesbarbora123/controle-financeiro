/**
 * Script para gerar hash bcrypt e SQL para criar usuário admin
 * 
 * Uso:
 *   node generate_admin_hash.js
 *   ou
 *   node generate_admin_hash.js "minhasenha123"
 */

const bcrypt = require('bcryptjs');

// Senha padrão ou senha passada como argumento
const password = process.argv[2] || 'admin123';
const username = 'admin';
const nome = 'Administrador';

async function generateAdminSQL() {
  try {
    console.log('Gerando hash bcrypt para a senha...');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('');
    
    // Gerar hash com salt rounds 10 (mesmo padrão usado no create_admin.js)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('✅ Hash gerado com sucesso!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('SQL PRONTO PARA EXECUTAR NO BANCO DE PRODUÇÃO:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Gerar SQL
    const sql = `
-- SQL para criar usuário admin no banco de produção
-- Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}

INSERT INTO usuarios (username, password, nome, is_admin, created_at, updated_at)
VALUES (
  '${username}',
  '${hashedPassword}', -- Hash bcrypt para senha: ${password}
  '${nome}',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (username) 
DO UPDATE SET 
  password = EXCLUDED.password,
  nome = EXCLUDED.nome,
  is_admin = EXCLUDED.is_admin,
  updated_at = CURRENT_TIMESTAMP;
`.trim();
    
    console.log(sql);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 INSTRUÇÕES:');
    console.log('1. Copie o SQL acima');
    console.log('2. Acesse o terminal do PostgreSQL no Easypanel');
    console.log('3. Conecte ao banco: psql -U postgres -d controle_financeiro');
    console.log('4. Cole e execute o SQL');
    console.log('');
    console.log(`🔑 Credenciais após execução:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    
    // Salvar em arquivo (opcional)
    const fs = require('fs');
    const path = require('path');
    const outputFile = path.join(__dirname, 'create_admin_producao_generated.sql');
    fs.writeFileSync(outputFile, sql);
    console.log('');
    console.log(`💾 SQL também salvo em: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Erro ao gerar hash:', error);
    process.exit(1);
  }
}

generateAdminSQL();
