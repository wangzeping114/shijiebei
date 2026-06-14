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
  // 北京时间 → UTC 存储字符串（严格按官方赛程文件）
  const pad = n => String(n).padStart(2, '0');
  const bj = (mo, d, h, mi = 0) =>
    new Date(`2026-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+08:00`)
      .toISOString().replace('T', ' ').slice(0, 19);
  const F = (home, away, mo, d, h, mi, round, venue = '') =>
    [home, away, bj(mo, d, h, mi), 'upcoming', round, venue];

  return [
    // ══════════════════════════════════════
    // 小组赛（严格按官方赛程，共35场）
    // ══════════════════════════════════════
    // 6月12日
    F('墨西哥',       '南非',         6, 12,  3,  0, 'A组小组赛', '墨西哥城'),    // 揭幕战
    F('韩国',         '捷克',         6, 12, 10,  0, 'A组小组赛', '瓜达拉哈拉'),
    // 6月13日
    F('加拿大',       '波黑',         6, 13,  3,  0, 'B组小组赛', '多伦多'),
    F('美国',         '巴拉圭',       6, 13,  9,  0, 'D组小组赛', '洛杉矶'),
    // 6月14日
    F('卡塔尔',       '瑞士',         6, 14,  3,  0, 'B组小组赛', '旧金山湾区'),
    F('巴西',         '摩洛哥',       6, 14,  6,  0, 'C组小组赛', '纽约/新泽西'),
    F('澳大利亚',     '土耳其',       6, 14, 12,  0, 'D组小组赛', '温哥华'),
    // 6月15日
    F('德国',         '库拉索',       6, 15,  1,  0, 'E组小组赛', '休斯敦'),
    F('荷兰',         '日本',         6, 15,  4,  0, 'F组小组赛', '达拉斯'),
    F('瑞典',         '突尼斯',       6, 15, 10,  0, 'F组小组赛', '蒙特雷'),
    // 6月16日
    F('西班牙',       '佛得角',       6, 16,  0,  0, 'H组小组赛', '亚特兰大'),
    F('比利时',       '埃及',         6, 16,  3,  0, 'G组小组赛', '西雅图'),
    F('沙特阿拉伯',   '乌拉圭',       6, 16,  6,  0, 'H组小组赛', '迈阿密'),
    // 6月17日
    F('法国',         '塞内加尔',     6, 17,  3,  0, 'I组小组赛', '纽约/新泽西'),
    F('阿根廷',       '阿尔及利亚',   6, 17,  9,  0, 'J组小组赛', '堪萨斯城'),
    // 6月18日
    F('葡萄牙',       '民主刚果',     6, 18,  1,  0, 'K组小组赛', '休斯敦'),
    F('英格兰',       '克罗地亚',     6, 18,  4,  0, 'L组小组赛', '达拉斯'),
    // 6月19日
    F('墨西哥',       '韩国',         6, 19,  9,  0, 'A组小组赛', '瓜达拉哈拉'),
    // 6月20日
    F('美国',         '澳大利亚',     6, 20,  3,  0, 'D组小组赛', '西雅图'),
    F('巴西',         '海地',         6, 20,  8, 30, 'C组小组赛', '费城'),
    // 6月21日
    F('德国',         '科特迪瓦',     6, 21,  4,  0, 'E组小组赛', '多伦多'),
    // 6月22日
    F('比利时',       '伊朗',         6, 22,  3,  0, 'G组小组赛', '洛杉矶'),
    // 6月23日
    F('阿根廷',       '奥地利',       6, 23,  1,  0, 'J组小组赛', '达拉斯'),
    F('法国',         '伊拉克',       6, 23,  5,  0, 'I组小组赛', '费城'),
    // 6月24日
    F('葡萄牙',       '乌兹别克斯坦', 6, 24,  1,  0, 'K组小组赛', '休斯敦'),
    F('英格兰',       '加纳',         6, 24,  4,  0, 'L组小组赛', '波士顿'),
    // 6月25日
    F('捷克',         '墨西哥',       6, 25,  9,  0, 'A组小组赛', '墨西哥城'),
    // 6月26日
    F('厄瓜多尔',     '德国',         6, 26,  4,  0, 'E组小组赛', '纽约/新泽西'),
    F('日本',         '瑞典',         6, 26,  7,  0, 'F组小组赛', '达拉斯'),
    F('土耳其',       '美国',         6, 26, 10,  0, 'D组小组赛', '洛杉矶'),
    // 6月27日
    F('挪威',         '法国',         6, 27,  3,  0, 'I组小组赛', '波士顿'),
    F('乌拉圭',       '西班牙',       6, 27,  8,  0, 'H组小组赛', '瓜达拉哈拉'),
    F('埃及',         '伊朗',         6, 27, 11,  0, 'G组小组赛', '西雅图'),
    // 6月28日
    F('巴拿马',       '英格兰',       6, 28,  5,  0, 'L组小组赛', '纽约/新泽西'),
    F('哥伦比亚',     '葡萄牙',       6, 28,  7, 30, 'K组小组赛', '迈阿密'),

    // ══════════════════════════════════════
    // 1/16决赛（6月29日 - 7月2日 已有明确场次）
    // ══════════════════════════════════════
    F('待定', '待定', 6, 29,  3,  0, '1/16决赛', '洛杉矶'),
    F('待定', '待定', 6, 30,  1,  0, '1/16决赛', '休斯敦'),
    F('待定', '待定', 7,  1,  1,  0, '1/16决赛', '达拉斯'),
    F('待定', '待定', 7,  2,  0,  0, '1/16决赛', '亚特兰大'),
    // 其余1/16待公布（7月3日-6日各1场占位）
    F('待定', '待定', 7,  3,  3,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  3, 10,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  4,  3,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  4, 10,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  5,  3,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  5, 10,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  6,  3,  0, '1/16决赛', ''),
    F('待定', '待定', 7,  6, 10,  0, '1/16决赛', ''),
    // ══════════════════════════════════════
    // 1/8决赛（7月4日-8日）
    // ══════════════════════════════════════
    F('待定', '待定', 7,  7,  3,  0, '1/8决赛', ''),
    F('待定', '待定', 7,  7, 10,  0, '1/8决赛', ''),
    F('待定', '待定', 7,  8,  3,  0, '1/8决赛', ''),
    F('待定', '待定', 7,  8, 10,  0, '1/8决赛', ''),
    // ══════════════════════════════════════
    // 四分之一决赛（7月10日-12日）
    // ══════════════════════════════════════
    F('待定', '待定', 7, 10,  3,  0, '四分之一决赛', ''),
    F('待定', '待定', 7, 10, 10,  0, '四分之一决赛', ''),
    F('待定', '待定', 7, 12,  3,  0, '四分之一决赛', ''),
    F('待定', '待定', 7, 12, 10,  0, '四分之一决赛', ''),
    // ══════════════════════════════════════
    // 半决赛
    // ══════════════════════════════════════
    F('待定', '待定', 7, 15,  3,  0, '半决赛', ''),
    F('待定', '待定', 7, 16,  3,  0, '半决赛', ''),
    // ══════════════════════════════════════
    // 季军战 + 决赛
    // ══════════════════════════════════════
    F('待定', '待定', 7, 19,  3,  0, '季军战', '迈阿密'),
    F('待定', '待定', 7, 20,  3,  0, '决赛',   '纽约/新泽西'),
  ]; // 35 小组赛 + 12×1/16 + 4×1/8 + 4×1/4 + 2×半决赛 + 1季军 + 1决赛 = 59
}

async function seedWorldCup2026Matches(client) {
  const fixtures = buildWorldCup2026Fixtures();

  const countResult = await client.query('SELECT COUNT(*)::int AS count FROM matches');
  const existingCount = countResult.rows[0].count;

  if (existingCount > 0) {
    // 验证：第1场是否为 墨西哥 vs 南非（揭幕战），是则认为已是最新正确数据
    const check = await client.query('SELECT home_team, away_team FROM matches ORDER BY id LIMIT 1');
    const first = check.rows[0];
    if (first && first.home_team === '墨西哥' && first.away_team === '南非' && existingCount === fixtures.length) {
      return;
    }
    const betCount = await client.query('SELECT COUNT(*)::int AS count FROM bet_orders');
    if (betCount.rows[0].count > 0) {
      console.warn(`已有投注记录，跳过赛程重建`);
      return;
    }
    await client.query('TRUNCATE TABLE bet_items, bet_orders, odds, matches RESTART IDENTITY CASCADE');
  }

  for (const [home, away, time, status, round, venue] of fixtures) {
    await client.query(
      'INSERT INTO matches (home_team, away_team, match_time, status, round, venue) VALUES ($1, $2, $3, $4, $5, $6)',
      [home, away, time, status, round, venue || '']
    );
  }

  console.log(`已初始化 2026 美加墨世界杯赛事 ${fixtures.length} 场（按官方公布赛程）`);
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

    // 兼容旧表：添加 round / venue 字段
    await client.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS round VARCHAR(30)`);
    await client.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue VARCHAR(100)`);

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
