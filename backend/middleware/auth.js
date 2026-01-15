const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Garantir que o .env está carregado
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura_aqui';

if (!JWT_SECRET || JWT_SECRET === 'sua_chave_secreta_super_segura_aqui') {
  console.warn('AVISO: JWT_SECRET não configurado, usando chave padrão. Configure JWT_SECRET no .env para produção!');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, JWT_SECRET };

