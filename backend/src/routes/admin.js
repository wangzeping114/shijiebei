const express = require('express');
const pool = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// ═══════════════ 赛事管理 ═══════════════

// 获取所有赛事
router.get('/matches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches ORDER BY match_time ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '获取赛事失败' });
  }
});

// 创建赛事
router.post('/matches', async (req, res) => {
  const { home_team, away_team, match_time } = req.body;
  if (!home_team || !away_team || !match_time) {
    return res.status(400).json({ error: '请填写完整赛事信息' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO matches (home_team, away_team, match_time) VALUES ($1, $2, $3) RETURNING *',
      [home_team, away_team, match_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '创建赛事失败' });
  }
});

// 更新赛事
router.put('/matches/:id', async (req, res) => {
  const { home_team, away_team, match_time, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE matches
       SET home_team  = COALESCE($1, home_team),
           away_team  = COALESCE($2, away_team),
           match_time = COALESCE($3, match_time),
           status     = COALESCE($4, status)
       WHERE id = $5 RETURNING *`,
      [home_team, away_team, match_time, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '赛事不存在' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '更新赛事失败' });
  }
});

// 删除赛事
router.delete('/matches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE id = $1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除赛事失败' });
  }
});

// ═══════════════ 赔率管理 ═══════════════

// 获取指定赛事赔率
router.get('/odds/:matchId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM odds WHERE match_id = $1 ORDER BY home_score ASC, away_score ASC',
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '获取赔率失败' });
  }
});

// 生成默认赔率
router.post('/odds/:matchId/generate', async (req, res) => {
  const defaults = [
    [0, 0, 8.50], [1, 0, 6.00], [0, 1, 6.00], [1, 1, 5.50],
    [2, 0, 7.00], [0, 2, 7.00], [2, 1, 5.00], [1, 2, 5.00],
    [2, 2, 9.00], [3, 0, 10.00], [0, 3, 10.00], [3, 1, 9.00],
    [1, 3, 9.00], [3, 2, 12.00], [2, 3, 12.00], [4, 0, 18.00],
    [0, 4, 18.00], [4, 1, 15.00], [1, 4, 15.00], [3, 3, 20.00]
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [h, a, o] of defaults) {
      await client.query(
        `INSERT INTO odds (match_id, home_score, away_score, odds_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (match_id, home_score, away_score) DO NOTHING`,
        [req.params.matchId, h, a, o]
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(
      'SELECT * FROM odds WHERE match_id = $1 ORDER BY home_score ASC, away_score ASC',
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '生成默认赔率失败' });
  } finally {
    client.release();
  }
});

// 批量更新赔率
router.put('/odds/:matchId', async (req, res) => {
  const { odds } = req.body; // [{ id?, home_score, away_score, odds_value }]
  if (!odds || odds.length === 0) return res.status(400).json({ error: '赔率数据不能为空' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const odd of odds) {
      if (odd.id) {
        await client.query(
          'UPDATE odds SET odds_value = $1 WHERE id = $2 AND match_id = $3',
          [odd.odds_value, odd.id, req.params.matchId]
        );
      } else {
        await client.query(
          `INSERT INTO odds (match_id, home_score, away_score, odds_value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (match_id, home_score, away_score) DO UPDATE SET odds_value = EXCLUDED.odds_value`,
          [req.params.matchId, odd.home_score, odd.away_score, odd.odds_value]
        );
      }
    }
    await client.query('COMMIT');
    const result = await pool.query(
      'SELECT * FROM odds WHERE match_id = $1 ORDER BY home_score ASC, away_score ASC',
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '更新赔率失败' });
  } finally {
    client.release();
  }
});

// 新增单条赔率
router.post('/odds/:matchId', async (req, res) => {
  const { home_score, away_score, odds_value } = req.body;
  if (home_score === undefined || away_score === undefined || !odds_value) {
    return res.status(400).json({ error: '请填写完整赔率信息' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO odds (match_id, home_score, away_score, odds_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, home_score, away_score) DO UPDATE SET odds_value = EXCLUDED.odds_value
       RETURNING *`,
      [req.params.matchId, home_score, away_score, odds_value]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '新增赔率失败' });
  }
});

// 删除单条赔率
router.delete('/odds/item/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM odds WHERE id = $1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除赔率失败' });
  }
});

// ═══════════════ 比分录入 & 结算 ═══════════════

router.put('/matches/:id/result', async (req, res) => {
  const { home_score, away_score } = req.body;
  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: '请输入主队和客队比分' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 更新赛事比分和状态
    await client.query(
      "UPDATE matches SET home_score = $1, away_score = $2, status = 'finished' WHERE id = $3",
      [home_score, away_score, req.params.id]
    );

    // 标记中奖投注项
    await client.query(
      `UPDATE bet_items SET is_winner = TRUE
       WHERE order_id IN (SELECT id FROM bet_orders WHERE match_id = $1)
         AND home_score = $2 AND away_score = $3`,
      [req.params.id, home_score, away_score]
    );

    // 所有待结算订单先置为 lost
    await client.query(
      "UPDATE bet_orders SET status = 'lost' WHERE match_id = $1 AND status = 'pending'",
      [req.params.id]
    );

    // 含中奖项的订单置为 won
    await client.query(
      `UPDATE bet_orders SET status = 'won'
       WHERE id IN (
         SELECT DISTINCT order_id FROM bet_items
         WHERE is_winner = TRUE
           AND order_id IN (SELECT id FROM bet_orders WHERE match_id = $1)
       )`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: '比分录入成功，系统已完成自动结算' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: '比分录入失败' });
  } finally {
    client.release();
  }
});

// ═══════════════ 统计报表 ═══════════════

// 已结束赛事列表
router.get('/reports', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM matches WHERE status = 'finished' ORDER BY match_time DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '获取报表列表失败' });
  }
});

// 指定赛事报表详情
router.get('/reports/:matchId', async (req, res) => {
  try {
    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.matchId]);
    if (match.rows.length === 0) return res.status(404).json({ error: '赛事不存在' });

    const orders = await pool.query(
      `SELECT bo.*, u.username, u.nickname
       FROM bet_orders bo
       JOIN users u ON bo.user_id = u.id
       WHERE bo.match_id = $1
       ORDER BY u.username, bo.created_at`,
      [req.params.matchId]
    );

    for (const order of orders.rows) {
      const items = await pool.query('SELECT * FROM bet_items WHERE order_id = $1', [order.id]);
      order.items = items.rows;
      order.winning_amount = items.rows
        .filter(i => i.is_winner)
        .reduce((sum, i) => sum + Number(i.amount) * Number(i.odds_value), 0);
    }

    // 按用户聚合
    const userMap = {};
    for (const order of orders.rows) {
      if (!userMap[order.user_id]) {
        userMap[order.user_id] = {
          user_id: order.user_id,
          username: order.username,
          nickname: order.nickname,
          total_bet: 0,
          total_won: 0,
          orders: []
        };
      }
      userMap[order.user_id].total_bet += Number(order.total_amount);
      userMap[order.user_id].total_won += order.winning_amount;
      userMap[order.user_id].orders.push(order);
    }

    const userDetails = Object.values(userMap);
    const winningUsers = userDetails.filter(u => u.total_won > 0);

    const totalAmount = orders.rows.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const totalWinningAmount = winningUsers.reduce((sum, u) => sum + u.total_won, 0);

    res.json({
      match: match.rows[0],
      summary: {
        total_orders: orders.rows.length,
        total_amount: totalAmount,
        total_winning_amount: totalWinningAmount,
        winning_users_count: winningUsers.length
      },
      user_details: userDetails,
      winning_users: winningUsers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取报表失败' });
  }
});

module.exports = router;
