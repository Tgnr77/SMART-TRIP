const { Pool } = require('pg');
const logger = require('../utils/logger');

// Configuration de la connexion PostgreSQL
// Railway fournit DATABASE_URL ; en local on utilise les variables individuelles
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // requis par Railway
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'smarttrip_dev',
      user: process.env.DB_USER || 'smarttrip_user',
      password: process.env.DB_PASSWORD || 'smarttrip_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

// Gestion des erreurs du pool
pool.on('error', (err) => {
  logger.error('Erreur inattendue du pool PostgreSQL:', err);
});

// Test de connexion
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info('✅ Connexion à la base de données PostgreSQL réussie');
    logger.info(`📅 Heure serveur DB: ${result.rows[0].now}`);
    client.release();
    return true;
  } catch (err) {
    logger.error('❌ Erreur de connexion à la base de données:', err.message);
    return false;
  }
};

// Fermeture du pool
const closeConnection = async () => {
  try {
    await pool.end();
    logger.info('🔒 Pool de connexions fermé');
  } catch (err) {
    logger.error('Erreur lors de la fermeture du pool:', err);
  }
};

// Query helper avec gestion d'erreurs
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms`);
    return res;
  } catch (err) {
    logger.error('Erreur de requête DB:', err.message);
    throw err;
  }
};

module.exports = {
  pool,
  query,
  testConnection,
  closeConnection
};
