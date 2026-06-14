const { Pool, types } = require('pg');

// TIMESTAMP WITHOUT TIME ZONE 列存储的是 UTC 值，加 'Z' 让 Node.js 正确识别为 UTC
types.setTypeParser(1114, str => (str ? new Date(str + 'Z') : null));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'worldcup_betting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

module.exports = pool;
