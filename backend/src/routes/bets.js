const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 获取我的投注记录（放在 POST / 之前避免路由冲突）
router.get('/my', authenticate, async (req, res) => {
  try {
    const orders = await pool.query(
      `SELECT bo.*, m.home_team, m.away_team, m.match_time,
              m.home_score AS result_home, m.away_score AS result_away, m.status AS match_status
       FROM bet_orders bo
       JOIN matches m ON bo.match_id = m.id
       WHERE bo.user_id = $1
       ORDER BY bo.created_at DESC`,
      [req.user.id]
    );

    for (const order of orders.rows) {
      const items = await pool.query('SELECT * FROM bet_items WHERE order_id = $1', [order.id]);
      order.items = items.rows;
      order.winning_amount = items.rows
        .filter(i => i.is_winner)
        .reduce((sum, i) => sum + Number(i.amount) * Number(i.odds_value), 0);
    }

    res.json(orders.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取投注记录失败' });
  }
});

// 提交投注
router.post('/', authenticate, async (req, res) => {
  const { match_id, items } = req.body;

  if (!match_id || !items || items.length === 0) {
    return res.status(400).json({ error: '请选择赛事和至少一个投注比分' });
  }

  // 校验金额
  for (const item of items) {
    if (Number(item.amount) <= 0) {
      return res.status(400).json({ error: '投注金额必须大于0' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 检查赛事状态
    const match = await client.query('SELECT * FROM matches WHERE id = $1', [match_id]);
    if (match.rows.length === 0) throw new Error('赛事不存在');
    if (['finished', 'closed'].includes(match.rows[0].status)) {
      throw new Error('赛事已结束，无法投注');
    }

    // 计算总金额
    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    // 生成订单号
    const orderNo = 'BET' + Date.now() + Math.floor(Math.random() * 900 + 100);

    // 创建订单
    const orderResult = await client.query(
      'INSERT INTO bet_orders (order_no, user_id, match_id, total_amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [orderNo, req.user.id, match_id, totalAmount]
    );
    const order = orderResult.rows[0];

    // 创建投注明细（以数据库最新赔率为准）
    const savedItems = [];
    for (const item of items) {
      const oddsResult = await client.query(
        'SELECT * FROM odds WHERE match_id = $1 AND home_score = $2 AND away_score = $3',
        [match_id, item.home_score, item.away_score]
      );
      if (oddsResult.rows.length === 0) {
        throw new Error(`比分 ${item.home_score}:${item.away_score} 不在赔率表中`);
      }
      const currentOdds = oddsResult.rows[0].odds_value;

      const itemResult = await client.query(
        'INSERT INTO bet_items (order_id, home_score, away_score, odds_value, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [order.id, item.home_score, item.away_score, currentOdds, item.amount]
      );
      savedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      order: { ...order, items: savedItems },
      match: match.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message || '投注失败' });
  } finally {
    client.release();
  }
});

module.exports = router;
