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

// Aumentar limite de headers para evitar erro 431
app.use((req, res, next) => {
  req.headers['content-length'] = req.headers['content-length'] || '0';
  next();
});

// Middleware
app.use(cors({
  credentials: true,
  maxAge: 86400
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'controle_financeiro',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
});

// Log de debug para verificar variáveis (remover em produção se necessário)
console.log('🔍 Configuração do Banco:');
console.log('  DB_HOST:', process.env.DB_HOST || '(não definido)');
console.log('  DB_PORT:', process.env.DB_PORT || '(não definido)');
console.log('  DB_NAME:', process.env.DB_NAME || '(não definido)');
console.log('  DB_USER:', process.env.DB_USER || '(não definido)');

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
// Restaurantes Routes
// Get all restaurants
app.get('/api/restaurantes', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM restaurantes WHERE ativo = true ORDER BY nome ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar restaurantes:', error);
    res.status(500).json({ error: 'Erro ao buscar restaurantes' });
  }
});

// Get single restaurant
app.get('/api/restaurantes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM restaurantes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar restaurante:', error);
    res.status(500).json({ error: 'Erro ao buscar restaurante' });
  }
});

// Create restaurant
app.post('/api/restaurantes', authenticateToken, async (req, res) => {
  try {
    const { nome, endereco, telefone, email, cnpj, observacoes } = req.body;
    
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    
    const result = await pool.query(
      'INSERT INTO restaurantes (nome, endereco, telefone, email, cnpj, observacoes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nome.trim(), endereco || null, telefone || null, email || null, cnpj || null, observacoes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar restaurante:', error);
    res.status(500).json({ error: 'Erro ao criar restaurante' });
  }
});

// Update restaurant
app.put('/api/restaurantes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, endereco, telefone, email, cnpj, observacoes, ativo } = req.body;
    
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    
    const result = await pool.query(
      'UPDATE restaurantes SET nome = $1, endereco = $2, telefone = $3, email = $4, cnpj = $5, observacoes = $6, ativo = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *',
      [nome.trim(), endereco || null, telefone || null, email || null, cnpj || null, observacoes || null, ativo !== undefined ? ativo : true, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar restaurante:', error);
    res.status(500).json({ error: 'Erro ao atualizar restaurante' });
  }
});

// Delete restaurant (soft delete - marca como inativo)
app.delete('/api/restaurantes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE restaurantes SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }
    res.json({ message: 'Restaurante desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar restaurante:', error);
    res.status(500).json({ error: 'Erro ao deletar restaurante' });
  }
});

// Get all expenses (now filtered by restaurante_id if provided)
app.get('/api/gastos', authenticateToken, async (req, res) => {
  try {
    const { restaurante_id } = req.query;
    let query = 'SELECT * FROM gastos';
    const params = [];
    
    if (restaurante_id) {
      query += ' WHERE restaurante_id = $1';
      params.push(restaurante_id);
    }
    
    query += ' ORDER BY data DESC, id DESC';
    
    const result = await pool.query(query, params);
    // Formatar datas para evitar problemas de timezone
    const gastosFormatados = result.rows.map(gasto => {
      let dataFormatada = gasto.data;
      if (gasto.data) {
        // Se já é string no formato YYYY-MM-DD, usar diretamente
        if (typeof gasto.data === 'string' && gasto.data.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dataFormatada = gasto.data;
        } else {
          // Caso contrário, extrair apenas a parte da data (YYYY-MM-DD)
          const date = new Date(gasto.data);
          const ano = date.getUTCFullYear();
          const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
          const dia = String(date.getUTCDate()).padStart(2, '0');
          dataFormatada = `${ano}-${mes}-${dia}`;
        }
      }
      return {
        ...gasto,
        data: dataFormatada
      };
    });
    res.json(gastosFormatados);
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
    // Formatar data para evitar problemas de timezone
    let dataFormatada = result.rows[0].data;
    if (result.rows[0].data) {
      if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dataFormatada = result.rows[0].data;
      } else {
        const date = new Date(result.rows[0].data);
        const ano = date.getUTCFullYear();
        const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(date.getUTCDate()).padStart(2, '0');
        dataFormatada = `${ano}-${mes}-${dia}`;
      }
    }
    const gastoFormatado = {
      ...result.rows[0],
      data: dataFormatada
    };
    res.json(gastoFormatado);
  } catch (error) {
    console.error('Erro ao buscar gasto:', error);
    res.status(500).json({ error: 'Erro ao buscar gasto' });
  }
});

// Create expense
app.post('/api/gastos', authenticateToken, async (req, res) => {
  try {
    const { data, descricao, valor, observacao, pago, restaurante_id } = req.body;
    
    if (!restaurante_id) {
      return res.status(400).json({ error: 'restaurante_id é obrigatório' });
    }
    
    const result = await pool.query(
      'INSERT INTO gastos (data, descricao, valor, observacao, pago, restaurante_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data, descricao, valor || null, observacao || null, pago || false, restaurante_id]
    );
    // Formatar data para evitar problemas de timezone
    let dataFormatada = result.rows[0].data;
    if (result.rows[0].data) {
      if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dataFormatada = result.rows[0].data;
      } else {
        const date = new Date(result.rows[0].data);
        const ano = date.getUTCFullYear();
        const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(date.getUTCDate()).padStart(2, '0');
        dataFormatada = `${ano}-${mes}-${dia}`;
      }
    }
    const gastoFormatado = {
      ...result.rows[0],
      data: dataFormatada
    };
    res.status(201).json(gastoFormatado);
  } catch (error) {
    console.error('Erro ao criar gasto:', error);
    res.status(500).json({ error: 'Erro ao criar gasto' });
  }
});

// Update expense
app.put('/api/gastos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, descricao, valor, observacao, pago, restaurante_id } = req.body;
    const result = await pool.query(
      'UPDATE gastos SET data = $1, descricao = $2, valor = $3, observacao = $4, pago = $5, restaurante_id = $6 WHERE id = $7 RETURNING *',
      [data, descricao, valor || null, observacao || null, pago || false, restaurante_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }
    // Formatar data para evitar problemas de timezone
    let dataFormatada = result.rows[0].data;
    if (result.rows[0].data) {
      if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dataFormatada = result.rows[0].data;
      } else {
        const date = new Date(result.rows[0].data);
        const ano = date.getUTCFullYear();
        const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(date.getUTCDate()).padStart(2, '0');
        dataFormatada = `${ano}-${mes}-${dia}`;
      }
    }
    const gastoFormatado = {
      ...result.rows[0],
      data: dataFormatada
    };
    res.json(gastoFormatado);
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
            'UPDATE gastos SET data = $1, descricao = $2, valor = $3, observacao = $4, pago = $5, restaurante_id = $6 WHERE id = $7',
            [gasto.data, gasto.descricao, gasto.valor || null, gasto.observacao || null, gasto.pago || false, gasto.restaurante_id, gasto.id]
          );
        } else {
          // Insert new - restaurante_id é obrigatório
          if (!gasto.restaurante_id) {
            throw new Error('restaurante_id é obrigatório para novos gastos');
          }
          await client.query(
            'INSERT INTO gastos (data, descricao, valor, observacao, pago, restaurante_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [gasto.data, gasto.descricao, gasto.valor || null, gasto.observacao || null, gasto.pago || false, gasto.restaurante_id]
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

// Health check endpoint para Easypanel
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await pool.query('SELECT 1');
    res.status(200).json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Tratamento de sinais para encerramento gracioso
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando servidor graciosamente...');
  server.close(() => {
    console.log('Servidor encerrado');
    pool.end(() => {
      console.log('Pool de conexões fechado');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recebido, encerrando servidor graciosamente...');
  server.close(() => {
    console.log('Servidor encerrado');
    pool.end(() => {
      console.log('Pool de conexões fechado');
      process.exit(0);
    });
  });
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
