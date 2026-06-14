const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// 获取所有赛事
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches ORDER BY match_time ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '获取赛事失败' });
  }
});

// 获取赛事详情（含赔率）
router.get('/:id', async (req, res) => {
  try {
    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    if (match.rows.length === 0) return res.status(404).json({ error: '赛事不存在' });

    const odds = await pool.query(
      'SELECT * FROM odds WHERE match_id = $1 ORDER BY home_score ASC, away_score ASC',
      [req.params.id]
    );

    res.json({ ...match.rows[0], odds: odds.rows });
  } catch (err) {
    res.status(500).json({ error: '获取赛事详情失败' });
  }
});

module.exports = router;
