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

function buildWorldCup2026Fixtures() {
  // 2026 FIFA 世界杯美加墨 48 队 12 组
  const groups = [
    { name: 'A', teams: ['墨西哥', '厄瓜多尔', '委内瑞拉', '牙买加'] },
    { name: 'B', teams: ['美国', '乌拉圭', '巴拿马', '玻利维亚'] },
    { name: 'C', teams: ['加拿大', '摩洛哥', '比利时', '克罗地亚'] },
    { name: 'D', teams: ['法国', '阿根廷', '塞内加尔', '秘鲁'] },
    { name: 'E', teams: ['西班牙', '德国', '塞尔维亚', '丹麦'] },
    { name: 'F', teams: ['英格兰', '荷兰', '阿尔及利亚', '突尼斯'] },
    { name: 'G', teams: ['巴西', '哥伦比亚', '巴拉圭', '洪都拉斯'] },
    { name: 'H', teams: ['葡萄牙', '意大利', '波兰', '土耳其'] },
    { name: 'I', teams: ['日本', '韩国', '澳大利亚', '沙特阿拉伯'] },
    { name: 'J', teams: ['瑞士', '奥地利', '乌克兰', '哥斯达黎加'] },
    { name: 'K', teams: ['喀麦隆', '埃及', '尼日利亚', '科特迪瓦'] },
    { name: 'L', teams: ['新西兰', '危地马拉', '萨尔瓦多', '巴林'] },
  ];

  // 北京时间 → UTC 存储
  const bj = (dateStr, hour, minute = 0) => {
    const d = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  };

  const fixtures = [];

  // 小组赛赛程表：[分组索引, 第1轮日期, 第1场时, 第2场时, 第2轮日期, 第1场时, 第2场时, 第3轮日期]
  const groupSchedule = [
    [0,  '2026-06-12', 2,  9,  '2026-06-18', 2,  8,  '2026-06-25'],
    [1,  '2026-06-12', 5,  12, '2026-06-18', 5,  11, '2026-06-25'],
    [2,  '2026-06-13', 2,  9,  '2026-06-19', 2,  8,  '2026-06-25'],
    [3,  '2026-06-13', 5,  12, '2026-06-19', 5,  11, '2026-06-25'],
    [4,  '2026-06-14', 2,  9,  '2026-06-20', 2,  8,  '2026-06-26'],
    [5,  '2026-06-14', 5,  12, '2026-06-20', 5,  11, '2026-06-26'],
    [6,  '2026-06-15', 2,  9,  '2026-06-21', 2,  8,  '2026-06-26'],
    [7,  '2026-06-15', 5,  12, '2026-06-21', 5,  11, '2026-06-26'],
    [8,  '2026-06-16', 2,  9,  '2026-06-22', 2,  8,  '2026-06-27'],
    [9,  '2026-06-16', 5,  12, '2026-06-22', 5,  11, '2026-06-27'],
    [10, '2026-06-17', 2,  9,  '2026-06-23', 2,  8,  '2026-06-27'],
    [11, '2026-06-17', 5,  12, '2026-06-23', 5,  11, '2026-06-27'],
  ];

  for (const [gi, d1, h1a, h1b, d2, h2a, h2b, d3] of groupSchedule) {
    const g = groups[gi];
    const [t0, t1, t2, t3] = g.teams;
    const round = `${g.name}组小组赛`;
    // 第1轮
    fixtures.push([t0, t1, bj(d1, h1a), 'upcoming', round]);
    fixtures.push([t2, t3, bj(d1, h1b), 'upcoming', round]);
    // 第2轮
    fixtures.push([t0, t2, bj(d2, h2a), 'upcoming', round]);
    fixtures.push([t1, t3, bj(d2, h2b), 'upcoming', round]);
    // 第3轮（同组同时开赛）
    fixtures.push([t0, t3, bj(d3, 4), 'upcoming', round]);
    fixtures.push([t1, t2, bj(d3, 4), 'upcoming', round]);
  }

  // 1/16决赛 16 场 (2026-06-29 ~ 2026-07-06)
  const r32Times = [
    ['2026-06-29', 4], ['2026-06-29', 23], ['2026-06-30', 4], ['2026-06-30', 23],
    ['2026-07-01', 4], ['2026-07-01', 23], ['2026-07-02', 4], ['2026-07-02', 23],
    ['2026-07-03', 4], ['2026-07-03', 23], ['2026-07-04', 4], ['2026-07-04', 23],
    ['2026-07-05', 4], ['2026-07-05', 23], ['2026-07-06', 4], ['2026-07-06', 23],
  ];
  r32Times.forEach(([d, h], i) => {
    fixtures.push([`待定`, `待定`, bj(d, h), 'upcoming', '1/16决赛']);
  });

  // 1/8决赛 8 场 (2026-07-08 ~ 2026-07-11)
  const r16Times = [
    ['2026-07-08', 4], ['2026-07-08', 23], ['2026-07-09', 4], ['2026-07-09', 23],
    ['2026-07-10', 4], ['2026-07-10', 23], ['2026-07-11', 4], ['2026-07-11', 23],
  ];
  r16Times.forEach(([d, h], i) => {
    fixtures.push([`待定`, `待定`, bj(d, h), 'upcoming', '1/8决赛']);
  });

  // 四分之一决赛 4 场
  [['2026-07-14', 4], ['2026-07-14', 23], ['2026-07-15', 4], ['2026-07-15', 23]].forEach(([d, h]) => {
    fixtures.push([`待定`, `待定`, bj(d, h), 'upcoming', '四分之一决赛']);
  });

  // 半决赛 2 场
  fixtures.push(['待定', '待定', bj('2026-07-18', 7), 'upcoming', '半决赛']);
  fixtures.push(['待定', '待定', bj('2026-07-19', 7), 'upcoming', '半决赛']);

  // 季军赛
  fixtures.push(['待定', '待定', bj('2026-07-22', 7), 'upcoming', '季军赛']);

  // 决赛
  fixtures.push(['待定', '待定', bj('2026-07-23', 10), 'upcoming', '决赛']);

  return fixtures; // 72 + 16 + 8 + 4 + 2 + 1 + 1 = 104
}

async function seedWorldCup2026Matches(client) {
  const fixtures = buildWorldCup2026Fixtures();

  const countResult = await client.query('SELECT COUNT(*)::int AS count FROM matches');
  const existingCount = countResult.rows[0].count;

  if (existingCount === fixtures.length) {
    // 检查是否仍用旧格式（队名含"组"前缀）
    const sampleRow = await client.query("SELECT home_team FROM matches LIMIT 1");
    if (!sampleRow.rows[0] || !sampleRow.rows[0].home_team.includes('组 ')) {
      return;
    }
  }

  if (existingCount > 0) {
    const betCount = await client.query('SELECT COUNT(*)::int AS count FROM bet_orders');
    if (betCount.rows[0].count > 0) {
      console.warn(`已有投注记录，跳过赛程重建`);
      return;
    }
    await client.query('TRUNCATE TABLE bet_items, bet_orders, odds, matches RESTART IDENTITY CASCADE');
  }

  for (const [home, away, time, status, round] of fixtures) {
    await client.query(
      'INSERT INTO matches (home_team, away_team, match_time, status, round) VALUES ($1, $2, $3, $4, $5)',
      [home, away, time, status, round]
    );
  }

  console.log(`已初始化 2026 美加墨世界杯赛事 ${fixtures.length} 场`);
}

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

    // 兼容旧表：添加 round 字段
    await client.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS round VARCHAR(30)`);

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

    await seedWorldCup2026Matches(client);

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
