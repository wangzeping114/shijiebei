const { Pool, types } = require('pg');

// 后端直接存储北京时间，返回原始字符串，不做时区转换
types.setTypeParser(1114, str => str || null);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'worldcup_betting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

module.exports = pool;
