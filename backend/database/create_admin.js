const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Carregar .env do diretório backend
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'controle_financeiro',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function createAdmin() {
  try {
    console.log('Criando usuário admin...');
    
    const username = 'admin';
    const password = 'admin123';
    const nome = 'Administrador';
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Verificar se já existe
    const checkResult = await pool.query(
      'SELECT id FROM usuarios WHERE username = $1',
      [username]
    );
    
    if (checkResult.rows.length > 0) {
      console.log('Usuário admin já existe. Atualizando senha...');
      await pool.query(
        'UPDATE usuarios SET password = $1, nome = $2, is_admin = $3 WHERE username = $4',
        [hashedPassword, nome, true, username]
      );
      console.log('Senha do admin atualizada com sucesso!');
    } else {
      await pool.query(
        'INSERT INTO usuarios (username, password, nome, is_admin) VALUES ($1, $2, $3, $4)',
        [username, hashedPassword, nome, true]
      );
      console.log('Usuário admin criado com sucesso!');
    }
    
    console.log('Credenciais:');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar usuário admin:', error);
    process.exit(1);
  }
}

createAdmin();

