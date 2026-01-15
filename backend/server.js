const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Carregar .env do diretório backend ANTES de importar outros módulos
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'controle_financeiro',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao PostgreSQL:', res.rows[0].now);
  }
});

// Auth Routes
// Login
app.post('/api/login', async (req, res) => {
  try {
    console.log('Tentativa de login recebida');
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    console.log('Buscando usuário:', username);
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.log('Usuário não encontrado');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    console.log('Usuário encontrado, verificando senha...');
    
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('Senha inválida');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    console.log('Senha válida, gerando token...');
    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login bem-sucedido para:', username);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao fazer login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify token
app.get('/api/verify', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, nome, is_admin FROM usuarios WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(500).json({ error: 'Erro ao verificar token' });
  }
});

// Protected Routes
// Get all expenses
app.get('/api/gastos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM gastos ORDER BY data DESC, id DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar gastos:', error);
    res.status(500).json({ error: 'Erro ao buscar gastos' });
  }
});

// Get single expense
app.get('/api/gastos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM gastos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar gasto:', error);
    res.status(500).json({ error: 'Erro ao buscar gasto' });
  }
});

// Create expense
app.post('/api/gastos', authenticateToken, async (req, res) => {
  try {
    const { data, descricao, valor, observacao, pago } = req.body;
    const result = await pool.query(
      'INSERT INTO gastos (data, descricao, valor, observacao, pago) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [data, descricao, valor || null, observacao || null, pago || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar gasto:', error);
    res.status(500).json({ error: 'Erro ao criar gasto' });
  }
});

// Update expense
app.put('/api/gastos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, descricao, valor, observacao, pago } = req.body;
    const result = await pool.query(
      'UPDATE gastos SET data = $1, descricao = $2, valor = $3, observacao = $4, pago = $5 WHERE id = $6 RETURNING *',
      [data, descricao, valor || null, observacao || null, pago || false, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar gasto:', error);
    res.status(500).json({ error: 'Erro ao atualizar gasto' });
  }
});

// Delete expense
app.delete('/api/gastos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM gastos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }
    res.json({ message: 'Gasto deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar gasto:', error);
    res.status(500).json({ error: 'Erro ao deletar gasto' });
  }
});

// Bulk update (for grid editing)
app.put('/api/gastos/bulk', authenticateToken, async (req, res) => {
  try {
    const { gastos } = req.body;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const gasto of gastos) {
        if (gasto.id) {
          // Update existing
          await client.query(
            'UPDATE gastos SET data = $1, descricao = $2, valor = $3, observacao = $4, pago = $5 WHERE id = $6',
            [gasto.data, gasto.descricao, gasto.valor || null, gasto.observacao || null, gasto.pago || false, gasto.id]
          );
        } else {
          // Insert new
          await client.query(
            'INSERT INTO gastos (data, descricao, valor, observacao, pago) VALUES ($1, $2, $3, $4, $5)',
            [gasto.data, gasto.descricao, gasto.valor || null, gasto.observacao || null, gasto.pago || false]
          );
        }
      }
      
      await client.query('COMMIT');
      res.json({ message: 'Gastos atualizados com sucesso' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao atualizar gastos em lote:', error);
    res.status(500).json({ error: 'Erro ao atualizar gastos em lote' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

