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

/** Usuários com somente_estoque=true não acessam rotas financeiras (gastos). */
const requireFinanceiroAccess = (req, res, next) => {
  if (req.user && req.user.somente_estoque === true) {
    return res.status(403).json({ error: 'Acesso ao módulo financeiro não permitido para este perfil.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Apenas administradores podem realizar esta ação.' });
  }
  next();
};

/** Flags atuais do usuário (DB — não confiar só no JWT). */
async function loadUserFlags(userId) {
  const r = await pool.query(
    'SELECT id, is_admin, COALESCE(somente_estoque, false) AS somente_estoque FROM usuarios WHERE id = $1',
    [userId]
  );
  return r.rows[0] || null;
}

async function restauranteIdsUsuarioEstoque(userId) {
  const r = await pool.query(
    'SELECT restaurante_id FROM usuario_restaurante_estoque WHERE usuario_id = $1 ORDER BY restaurante_id',
    [userId]
  );
  return r.rows.map((row) => row.restaurante_id);
}

async function usuarioSomenteEstoquePodeRestaurante(userId, restauranteId) {
  const r = await pool.query(
    'SELECT 1 FROM usuario_restaurante_estoque WHERE usuario_id = $1 AND restaurante_id = $2',
    [userId, restauranteId]
  );
  return r.rows.length > 0;
}

/** Admin e usuários financeiros: qualquer restaurante. Somente estoque: só vinculados. */
async function assertEstoqueAcessoRestaurante(req, res, restauranteId) {
  const rid = parseInt(restauranteId, 10);
  if (Number.isNaN(rid)) {
    res.status(400).json({ error: 'restaurante_id inválido' });
    return false;
  }
  const flags = await loadUserFlags(req.user.id);
  if (!flags) {
    res.status(403).json({ error: 'Usuário inválido.' });
    return false;
  }
  if (flags.is_admin || !flags.somente_estoque) {
    return true;
  }
  const ok = await usuarioSomenteEstoquePodeRestaurante(req.user.id, rid);
  if (!ok) {
    res.status(403).json({ error: 'Sem permissão para acessar o estoque deste restaurante.' });
    return false;
  }
  return true;
}

/** Quantidade de estoque: sempre inteiro ≥ 0 */
function parseEstoqueQuantidadeInt(raw) {
  if (raw === undefined || raw === null) {
    return { ok: false, error: 'quantidade é obrigatória' };
  }
  const s = String(raw).trim().replace(',', '.');
  if (s === '' || !/^\d+$/.test(s)) {
    return { ok: false, error: 'A quantidade deve ser um número inteiro (sem casas decimais).' };
  }
  const n = parseInt(s, 10);
  if (n < 0) {
    return { ok: false, error: 'A quantidade não pode ser negativa.' };
  }
  return { ok: true, value: n };
}

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
    const somenteEstoque = !!user.somente_estoque;
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        somente_estoque: somenteEstoque
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login bem-sucedido para:', username);
    let restauranteIds = [];
    if (somenteEstoque) {
      const assoc = await pool.query(
        'SELECT restaurante_id FROM usuario_restaurante_estoque WHERE usuario_id = $1 ORDER BY restaurante_id',
        [user.id]
      );
      restauranteIds = assoc.rows.map((row) => row.restaurante_id);
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome,
        is_admin: user.is_admin,
        somente_estoque: somenteEstoque,
        restaurante_ids: restauranteIds
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
    const result = await pool.query(
      'SELECT id, username, nome, is_admin, COALESCE(somente_estoque, false) AS somente_estoque FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const row = result.rows[0];
    let restauranteIds = [];
    if (row.somente_estoque) {
      restauranteIds = await restauranteIdsUsuarioEstoque(row.id);
    }
    res.json({ user: { ...row, restaurante_ids: restauranteIds } });
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
    const flags = await loadUserFlags(req.user.id);
    if (!flags) {
      return res.status(403).json({ error: 'Usuário inválido.' });
    }
    if (flags.somente_estoque && !flags.is_admin) {
      const result = await pool.query(
        `SELECT r.*
         FROM restaurantes r
         INNER JOIN usuario_restaurante_estoque ur ON ur.restaurante_id = r.id AND ur.usuario_id = $1
         WHERE r.ativo = true
         ORDER BY r.nome ASC`,
        [req.user.id]
      );
      return res.json(result.rows);
    }
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
    const rid = parseInt(id, 10);
    const flags = await loadUserFlags(req.user.id);
    if (flags && flags.somente_estoque && !flags.is_admin) {
      const ok = await usuarioSomenteEstoquePodeRestaurante(req.user.id, rid);
      if (!ok) {
        return res.status(403).json({ error: 'Sem acesso a este restaurante.' });
      }
    }
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
app.post('/api/restaurantes', authenticateToken, requireFinanceiroAccess, async (req, res) => {
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
app.put('/api/restaurantes/:id', authenticateToken, requireFinanceiroAccess, async (req, res) => {
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
app.delete('/api/restaurantes/:id', authenticateToken, requireFinanceiroAccess, async (req, res) => {
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
app.get('/api/gastos', authenticateToken, requireFinanceiroAccess, async (req, res) => {
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
        } else if (typeof gasto.data === 'string' && gasto.data.match(/^\d{4}-\d{2}-\d{2}T/)) {
          // Se é ISO string, extrair apenas a parte da data antes do T
          dataFormatada = gasto.data.split('T')[0];
        } else {
          // Caso contrário (objeto Date), extrair a data local (não UTC)
          const date = new Date(gasto.data);
          // Usar métodos locais para preservar o dia correto
          const ano = date.getFullYear();
          const mes = String(date.getMonth() + 1).padStart(2, '0');
          const dia = String(date.getDate()).padStart(2, '0');
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
app.get('/api/gastos/:id', authenticateToken, requireFinanceiroAccess, async (req, res) => {
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
      } else if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}T/)) {
        // Se é ISO string, extrair apenas a parte da data
        dataFormatada = result.rows[0].data.split('T')[0];
      } else {
        // Caso contrário (objeto Date), extrair a data local
        const date = new Date(result.rows[0].data);
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
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
app.post('/api/gastos', authenticateToken, requireFinanceiroAccess, async (req, res) => {
  try {
    const { data, descricao, valor, observacao, pago, retroativo, restaurante_id } = req.body;
    
    if (!restaurante_id) {
      return res.status(400).json({ error: 'restaurante_id é obrigatório' });
    }
    
    const result = await pool.query(
      'INSERT INTO gastos (data, descricao, valor, observacao, pago, retroativo, restaurante_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [data, descricao, valor || null, observacao || null, pago || false, retroativo || false, restaurante_id]
    );
    // Formatar data para evitar problemas de timezone
    let dataFormatada = result.rows[0].data;
    if (result.rows[0].data) {
      if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dataFormatada = result.rows[0].data;
      } else if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}T/)) {
        // Se é ISO string, extrair apenas a parte da data
        dataFormatada = result.rows[0].data.split('T')[0];
      } else {
        // Caso contrário (objeto Date), extrair a data local
        const date = new Date(result.rows[0].data);
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
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
app.put('/api/gastos/:id', authenticateToken, requireFinanceiroAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, descricao, valor, observacao, pago, retroativo, restaurante_id } = req.body;
    const result = await pool.query(
      'UPDATE gastos SET data = $1, descricao = $2, valor = $3, observacao = $4, pago = $5, retroativo = $6, restaurante_id = $7 WHERE id = $8 RETURNING *',
      [data, descricao, valor || null, observacao || null, pago || false, retroativo || false, restaurante_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }
    // Formatar data para evitar problemas de timezone
    let dataFormatada = result.rows[0].data;
    if (result.rows[0].data) {
      if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dataFormatada = result.rows[0].data;
      } else if (typeof result.rows[0].data === 'string' && result.rows[0].data.match(/^\d{4}-\d{2}-\d{2}T/)) {
        // Se é ISO string, extrair apenas a parte da data
        dataFormatada = result.rows[0].data.split('T')[0];
      } else {
        // Caso contrário (objeto Date), extrair a data local
        const date = new Date(result.rows[0].data);
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
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
app.delete('/api/gastos/:id', authenticateToken, requireFinanceiroAccess, async (req, res) => {
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
app.put('/api/gastos/bulk', authenticateToken, requireFinanceiroAccess, async (req, res) => {
  try {
    const { gastos } = req.body;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const gasto of gastos) {
        if (gasto.id) {
          // Update existing
          await client.query(
            'UPDATE gastos SET data = $1, descricao = $2, valor = $3, observacao = $4, pago = $5, retroativo = $6, restaurante_id = $7 WHERE id = $8',
            [gasto.data, gasto.descricao, gasto.valor || null, gasto.observacao || null, gasto.pago || false, gasto.retroativo || false, gasto.restaurante_id, gasto.id]
          );
        } else {
          // Insert new - restaurante_id é obrigatório
          if (!gasto.restaurante_id) {
            throw new Error('restaurante_id é obrigatório para novos gastos');
          }
          await client.query(
            'INSERT INTO gastos (data, descricao, valor, observacao, pago, retroativo, restaurante_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [gasto.data, gasto.descricao, gasto.valor || null, gasto.observacao || null, gasto.pago || false, gasto.retroativo || false, gasto.restaurante_id]
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

// ========== Módulo Estoque ==========

// Lista categorias + produtos agrupados (todos autenticados)
app.get('/api/estoque/agrupado', authenticateToken, async (req, res) => {
  try {
    const { restaurante_id } = req.query;
    if (!restaurante_id) {
      return res.status(400).json({ error: 'restaurante_id é obrigatório' });
    }
    const rid = parseInt(restaurante_id, 10);
    if (Number.isNaN(rid)) {
      return res.status(400).json({ error: 'restaurante_id inválido' });
    }

    const pode = await assertEstoqueAcessoRestaurante(req, res, rid);
    if (!pode) return;

    const catResult = await pool.query(
      `SELECT id, restaurante_id, nome, ordem
       FROM estoque_categorias
       WHERE restaurante_id = $1
       ORDER BY ordem ASC, nome ASC`,
      [rid]
    );

    const prodResult = await pool.query(
      `SELECT p.id, p.restaurante_id, p.categoria_id, p.nome, p.unidade, p.quantidade, p.created_at, p.updated_at
       FROM estoque_produtos p
       WHERE p.restaurante_id = $1
       ORDER BY p.nome ASC`,
      [rid]
    );

    const produtosPorCat = {};
    prodResult.rows.forEach((p) => {
      if (!produtosPorCat[p.categoria_id]) produtosPorCat[p.categoria_id] = [];
      const qn = Math.max(0, Math.round(Number(p.quantidade)) || 0);
      produtosPorCat[p.categoria_id].push({ ...p, quantidade: qn });
    });

    const categorias = catResult.rows.map((c) => ({
      ...c,
      produtos: produtosPorCat[c.id] || []
    }));

    res.json({ restaurante_id: rid, categorias });
  } catch (error) {
    console.error('Erro ao listar estoque agrupado:', error);
    res.status(500).json({ error: 'Erro ao listar estoque' });
  }
});

// CRUD categorias (somente admin)
app.post('/api/estoque/categorias', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { restaurante_id, nome, ordem } = req.body;
    if (!restaurante_id || !nome || String(nome).trim() === '') {
      return res.status(400).json({ error: 'restaurante_id e nome são obrigatórios' });
    }
    const result = await pool.query(
      `INSERT INTO estoque_categorias (restaurante_id, nome, ordem)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [restaurante_id, String(nome).trim(), ordem !== undefined ? ordem : 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma categoria com este nome neste restaurante.' });
    }
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

app.put('/api/estoque/categorias/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ordem } = req.body;
    if (!nome || String(nome).trim() === '') {
      return res.status(400).json({ error: 'nome é obrigatório' });
    }
    const result = await pool.query(
      `UPDATE estoque_categorias
       SET nome = $1, ordem = COALESCE($2, ordem), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [String(nome).trim(), ordem, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

app.delete('/api/estoque/categorias/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM estoque_categorias WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.json({ message: 'Categoria removida', id: result.rows[0].id });
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    res.status(500).json({ error: 'Erro ao remover categoria' });
  }
});

// CRUD produtos
app.post('/api/estoque/produtos', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { restaurante_id, categoria_id, nome, unidade, quantidade } = req.body;
    if (!restaurante_id || !categoria_id || !nome || String(nome).trim() === '') {
      return res.status(400).json({ error: 'restaurante_id, categoria_id e nome são obrigatórios' });
    }
    const un = unidade && String(unidade).trim() !== '' ? String(unidade).trim().slice(0, 20) : 'un';
    const qParsed = parseEstoqueQuantidadeInt(
      quantidade !== undefined && quantidade !== null ? quantidade : 0
    );
    if (!qParsed.ok) {
      return res.status(400).json({ error: qParsed.error });
    }
    const qtd = qParsed.value;
    const result = await pool.query(
      `INSERT INTO estoque_produtos (restaurante_id, categoria_id, nome, unidade, quantidade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restaurante_id, categoria_id, String(nome).trim(), un, qtd]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com este nome nesta categoria.' });
    }
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

app.put('/api/estoque/produtos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const isAdmin = !!req.user.is_admin;

    const existing = await pool.query('SELECT * FROM estoque_produtos WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const rowRestId = existing.rows[0].restaurante_id;
    const pode = await assertEstoqueAcessoRestaurante(req, res, rowRestId);
    if (!pode) return;

    if (isAdmin) {
      const row = existing.rows[0];
      const categoria_id = body.categoria_id !== undefined ? body.categoria_id : row.categoria_id;
      const nome =
        body.nome !== undefined && String(body.nome).trim() !== ''
          ? String(body.nome).trim()
          : row.nome;
      const unidade =
        body.unidade !== undefined && String(body.unidade).trim() !== ''
          ? String(body.unidade).trim().slice(0, 20)
          : row.unidade;
      let quantidadeVal = row.quantidade;
      if (body.quantidade !== undefined && body.quantidade !== null) {
        const qp = parseEstoqueQuantidadeInt(body.quantidade);
        if (!qp.ok) {
          return res.status(400).json({ error: qp.error });
        }
        quantidadeVal = qp.value;
      } else {
        const qp = parseEstoqueQuantidadeInt(row.quantidade);
        quantidadeVal = qp.ok ? qp.value : Math.max(0, Math.round(Number(row.quantidade)) || 0);
      }
      const result = await pool.query(
        `UPDATE estoque_produtos
         SET categoria_id = $1, nome = $2, unidade = $3, quantidade = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [categoria_id, nome, unidade, quantidadeVal, id]
      );
      return res.json(result.rows[0]);
    }

    // Não-admin: apenas quantidade
    if (body.quantidade === undefined || body.quantidade === null) {
      return res.status(400).json({ error: 'Informe quantidade para atualizar.' });
    }
    const qp = parseEstoqueQuantidadeInt(body.quantidade);
    if (!qp.ok) {
      return res.status(400).json({ error: qp.error });
    }
    const result = await pool.query(
      `UPDATE estoque_produtos SET quantidade = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [qp.value, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/estoque/produtos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM estoque_produtos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    res.json({ message: 'Produto removido', id: result.rows[0].id });
  } catch (error) {
    console.error('Erro ao remover produto:', error);
    res.status(500).json({ error: 'Erro ao remover produto' });
  }
});

// ========== Admin: usuários de estoque + vínculos com restaurantes ==========

app.get('/api/admin/usuarios-estoque', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.nome, u.created_at,
        COALESCE(
          array_agg(ur.restaurante_id ORDER BY ur.restaurante_id) FILTER (WHERE ur.restaurante_id IS NOT NULL),
          ARRAY[]::integer[]
        ) AS restaurante_ids
       FROM usuarios u
       LEFT JOIN usuario_restaurante_estoque ur ON ur.usuario_id = u.id
       WHERE COALESCE(u.somente_estoque, false) = true
       GROUP BY u.id, u.username, u.nome, u.created_at
       ORDER BY u.nome ASC`
    );
    const rows = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      nome: row.nome,
      created_at: row.created_at,
      restaurante_ids: Array.isArray(row.restaurante_ids) ? row.restaurante_ids : []
    }));
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar usuários de estoque:', error);
    res.status(500).json({ error: 'Erro ao listar usuários de estoque' });
  }
});

app.post('/api/admin/usuarios-estoque', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password, nome, restaurante_ids } = req.body || {};
    if (!username || String(username).trim() === '') {
      return res.status(400).json({ error: 'username é obrigatório' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Senha é obrigatória (mín. 4 caracteres).' });
    }
    if (!nome || String(nome).trim() === '') {
      return res.status(400).json({ error: 'nome é obrigatório' });
    }
    let ids = Array.isArray(restaurante_ids) ? restaurante_ids.map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x)) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Associe ao menos um restaurante.' });
    }
    const dup = await client.query('SELECT id FROM usuarios WHERE username = $1', [String(username).trim()]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Já existe usuário com este login.' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO usuarios (username, password, nome, is_admin, somente_estoque)
       VALUES ($1, $2, $3, false, true)
       RETURNING id, username, nome, created_at`,
      [String(username).trim(), hash, String(nome).trim()]
    );
    const newUser = ins.rows[0];
    let inseridos = 0;
    for (const rid of ids) {
      const ex = await client.query('SELECT id FROM restaurantes WHERE id = $1 AND ativo = true', [rid]);
      if (ex.rows.length === 0) continue;
      await client.query(
        `INSERT INTO usuario_restaurante_estoque (usuario_id, restaurante_id) VALUES ($1, $2)
         ON CONFLICT (usuario_id, restaurante_id) DO NOTHING`,
        [newUser.id, rid]
      );
      inseridos += 1;
    }
    if (inseridos === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nenhum dos restaurantes informados é válido ou está ativo.' });
    }
    await client.query('COMMIT');
    const restauranteIds = await restauranteIdsUsuarioEstoque(newUser.id);
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      nome: newUser.nome,
      created_at: newUser.created_at,
      restaurante_ids: restauranteIds
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe usuário com este login.' });
    }
    console.error('Erro ao criar usuário de estoque:', error);
    res.status(500).json({ error: 'Erro ao criar usuário de estoque' });
  } finally {
    client.release();
  }
});

app.put('/api/admin/usuarios-estoque/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'id inválido' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Não é possível alterar o próprio usuário por esta tela.' });
    }
    const cur = await client.query(
      'SELECT id, username, nome FROM usuarios WHERE id = $1 AND COALESCE(somente_estoque, false) = true',
      [userId]
    );
    if (cur.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário de estoque não encontrado.' });
    }
    const { nome, password, restaurante_ids } = req.body || {};
    await client.query('BEGIN');
    if (nome !== undefined) {
      if (String(nome).trim() === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'nome não pode ser vazio.' });
      }
      await client.query('UPDATE usuarios SET nome = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        String(nome).trim(),
        userId
      ]);
    }
    if (password !== undefined && String(password) !== '') {
      if (String(password).length < 4) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Senha deve ter no mínimo 4 caracteres.' });
      }
      const hash = await bcrypt.hash(String(password), 10);
      await client.query('UPDATE usuarios SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        hash,
        userId
      ]);
    }
    if (restaurante_ids !== undefined) {
      const ids = Array.isArray(restaurante_ids)
        ? restaurante_ids.map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x))
        : [];
      await client.query('DELETE FROM usuario_restaurante_estoque WHERE usuario_id = $1', [userId]);
      for (const rid of ids) {
        const ex = await client.query('SELECT id FROM restaurantes WHERE id = $1 AND ativo = true', [rid]);
        if (ex.rows.length === 0) continue;
        await client.query(
          `INSERT INTO usuario_restaurante_estoque (usuario_id, restaurante_id) VALUES ($1, $2)
           ON CONFLICT (usuario_id, restaurante_id) DO NOTHING`,
          [userId, rid]
        );
      }
    }
    await client.query('COMMIT');
    const row = await pool.query(
      'SELECT id, username, nome, created_at FROM usuarios WHERE id = $1',
      [userId]
    );
    const restauranteIds = await restauranteIdsUsuarioEstoque(userId);
    res.json({
      ...row.rows[0],
      restaurante_ids: restauranteIds
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao atualizar usuário de estoque:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário de estoque' });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/usuarios-estoque/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'id inválido' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Não é possível excluir o próprio usuário.' });
    }
    const cur = await pool.query(
      'SELECT id FROM usuarios WHERE id = $1 AND COALESCE(somente_estoque, false) = true',
      [userId]
    );
    if (cur.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário de estoque não encontrado.' });
    }
    await pool.query('DELETE FROM usuarios WHERE id = $1', [userId]);
    res.json({ message: 'Usuário removido', id: userId });
  } catch (error) {
    console.error('Erro ao remover usuário de estoque:', error);
    res.status(500).json({ error: 'Erro ao remover usuário de estoque' });
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
