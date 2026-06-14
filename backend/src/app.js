require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./config/database');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const betRoutes = require('./routes/bets');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        home_team VARCHAR(100) NOT NULL,
        away_team VARCHAR(100) NOT NULL,
        match_time TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'upcoming',
        home_score INTEGER,
        away_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS odds (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        odds_value DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        UNIQUE(match_id, home_score, away_score)
      );

      CREATE TABLE IF NOT EXISTS bet_orders (
        id SERIAL PRIMARY KEY,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        match_id INTEGER REFERENCES matches(id),
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bet_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES bet_orders(id) ON DELETE CASCADE,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        odds_value DECIMAL(10, 2) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        is_winner BOOLEAN DEFAULT FALSE
      );
    `);

    // Create default admin if not exists
    const existing = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (existing.rows.length === 0) {
      const hashed = await bcrypt.hash('Admin@123', 10);
      await client.query(
        "INSERT INTO users (username, password, nickname, role) VALUES ('admin', $1, '系统管理员', 'admin')",
        [hashed]
      );
      console.log('默认管理员已创建 → 账号: admin  密码: Admin@123');
    }

    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务运行在 http://localhost:${PORT}`);
  });
});
