const express = require('express');
const pool = require('../config/database');

const router = express.Router();

function beijingDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

async function refreshMatchStatus() {
  const result = await pool.query("SELECT id, match_time, status FROM matches WHERE status NOT IN ('finished', 'closed')");
  const now = new Date();
  const twoHours = 2 * 60 * 60 * 1000;

  for (const match of result.rows) {
    const matchTime = new Date(match.match_time);
    const diff = now.getTime() - matchTime.getTime();
    let newStatus = 'upcoming';

    if (diff >= 0 && diff <= twoHours) {
      newStatus = 'ongoing';
    } else if (diff > twoHours) {
      newStatus = 'closed';
    }

    if (newStatus !== match.status) {
      await pool.query('UPDATE matches SET status = $1 WHERE id = $2', [newStatus, match.id]);
    }
  }
}

// 获取所有赛事
router.get('/', async (req, res) => {
  try {
    await refreshMatchStatus();

    const result = await pool.query('SELECT * FROM matches ORDER BY match_time ASC');
    const todayKey = beijingDateKey(new Date());

    const rows = result.rows.map(m => {
      const matchDate = new Date(m.match_time);
      return {
        ...m,
        is_today: beijingDateKey(matchDate) === todayKey
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取赛事失败' });
  }
});

// 获取赛事详情（含赔率，无赔率时自动生成默认值）
const DEFAULT_ODDS = [
  [0, 0, 0.00], [1, 0, 0.00], [0, 1, 0.00], [1, 1, 0.00],
  [2, 0, 0.00], [0, 2, 0.00], [2, 1, 0.00], [1, 2, 0.00],
  [2, 2, 0.00], [3, 0, 0.00], [0, 3, 0.00], [3, 1, 0.00],
  [1, 3, 0.00], [3, 2, 0.00], [2, 3, 0.00], [4, 0, 0.00],
  [0, 4, 0.00], [4, 1, 0.00], [1, 4, 0.00], [3, 3, 0.00]
];

router.get('/:id', async (req, res) => {
  try {
    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    if (match.rows.length === 0) return res.status(404).json({ error: '赛事不存在' });

    const oddsCount = await pool.query(
      'SELECT COUNT(*)::int AS c FROM odds WHERE match_id = $1',
      [req.params.id]
    );

    if (oddsCount.rows[0].c === 0) {
      for (const [h, a, o] of DEFAULT_ODDS) {
        await pool.query(
          `INSERT INTO odds (match_id, home_score, away_score, odds_value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (match_id, home_score, away_score) DO NOTHING`,
          [req.params.id, h, a, o]
        );
      }
    }

    const odds = await pool.query(
      'SELECT * FROM odds WHERE match_id = $1 ORDER BY home_score ASC, away_score ASC',
      [req.params.id]
    );

    const marketOdds = await pool.query(
      'SELECT * FROM market_odds WHERE match_id = $1 ORDER BY market_type ASC, id ASC',
      [req.params.id]
    );

    res.json({ ...match.rows[0], odds: odds.rows, market_odds: marketOdds.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取赛事详情失败' });
  }
});

module.exports = router;
