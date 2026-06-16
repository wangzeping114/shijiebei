const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function getEditableBetItem(client, itemId, userId) {
  const result = await client.query(
    `SELECT bi.*, bo.user_id, bo.status AS order_status, bo.match_id,
            m.status AS match_status, m.match_time
     FROM bet_items bi
     JOIN bet_orders bo ON bi.order_id = bo.id
     JOIN matches m ON bo.match_id = m.id
     WHERE bi.id = $1 AND bo.user_id = $2`,
    [itemId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('投注项不存在');
  }

  const item = result.rows[0];
  if (item.order_status !== 'pending') {
    throw new Error('订单已结算，无法操作');
  }

  const started = Date.now() >= new Date(item.match_time).getTime();
  if (started || ['closed', 'finished'].includes(item.match_status)) {
    throw new Error('赛事已开始或已关闭接单，无法操作');
  }

  return item;
}

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
  const { match_id, items, market_items } = req.body;

  const allItems = [...(items || []), ...(market_items || [])];
  if (!match_id || allItems.length === 0) {
    return res.status(400).json({ error: '请选择赛事和至少一个投注项' });
  }

  // 校验金额
  for (const item of allItems) {
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
    const totalAmount = allItems.reduce((sum, item) => sum + Number(item.amount), 0);

    // 生成订单号
    const orderNo = 'BET' + Date.now() + Math.floor(Math.random() * 900 + 100);

    // 创建订单
    const orderResult = await client.query(
      'INSERT INTO bet_orders (order_no, user_id, match_id, total_amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [orderNo, req.user.id, match_id, totalAmount]
    );
    const order = orderResult.rows[0];

    const savedItems = [];

    // 比分投注明细
    for (const item of (items || [])) {
      const oddsResult = await client.query(
        'SELECT * FROM odds WHERE match_id = $1 AND home_score = $2 AND away_score = $3',
        [match_id, item.home_score, item.away_score]
      );
      if (oddsResult.rows.length === 0) {
        throw new Error(`比分 ${item.home_score}:${item.away_score} 不在赔率表中`);
      }
      const currentOdds = oddsResult.rows[0].odds_value;
      if (Number(currentOdds) <= 0) {
        throw new Error(`比分 ${item.home_score}:${item.away_score} 赔率未配置，暂不可投注`);
      }
      const itemResult = await client.query(
        `INSERT INTO bet_items (order_id, home_score, away_score, odds_value, amount, bet_type)
         VALUES ($1, $2, $3, $4, $5, 'score') RETURNING *`,
        [order.id, item.home_score, item.away_score, currentOdds, item.amount]
      );
      savedItems.push(itemResult.rows[0]);
    }

    // 市场盘口投注明细
    for (const item of (market_items || [])) {
      const moResult = await client.query(
        'SELECT * FROM market_odds WHERE id = $1 AND match_id = $2',
        [item.market_odds_id, match_id]
      );
      if (moResult.rows.length === 0) {
        throw new Error(`盘口选项不存在`);
      }
      const mo = moResult.rows[0];
      if (Number(mo.odds_value) <= 0) {
        throw new Error(`"${mo.selection}" 赔率未配置，暂不可投注`);
      }
      const itemResult = await client.query(
        `INSERT INTO bet_items (order_id, market_odds_id, market_label, odds_value, amount, bet_type)
         VALUES ($1, $2, $3, $4, $5, 'market') RETURNING *`,
        [order.id, mo.id, mo.selection, mo.odds_value, item.amount]
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

// 修改单条投注比分/金额（仅未开赛且未关闭接单）
router.put('/items/:itemId', authenticate, async (req, res) => {
  const itemId = Number(req.params.itemId);
  const { home_score, away_score, amount } = req.body;

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: '参数错误' });
  }
  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: '请提供目标比分' });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: '投注金额必须大于0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const item = await getEditableBetItem(client, itemId, req.user.id);

    const odds = await client.query(
      'SELECT odds_value FROM odds WHERE match_id = $1 AND home_score = $2 AND away_score = $3 LIMIT 1',
      [item.match_id, home_score, away_score]
    );
    if (odds.rows.length === 0) {
      throw new Error('目标比分不在赔率表中');
    }
    if (Number(odds.rows[0].odds_value) <= 0) {
      throw new Error('目标比分赔率未配置，无法修改为该比分');
    }

    const updated = await client.query(
      `UPDATE bet_items
       SET home_score = $1, away_score = $2, odds_value = $3, amount = $4
       WHERE id = $5
       RETURNING *`,
      [home_score, away_score, odds.rows[0].odds_value, amount, itemId]
    );

    await client.query(
      `UPDATE bet_orders
       SET total_amount = (
         SELECT COALESCE(SUM(amount), 0) FROM bet_items WHERE order_id = $1
       )
       WHERE id = $1`,
      [item.order_id]
    );

    await client.query('COMMIT');
    res.json({ message: '修改成功', item: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message || '修改失败' });
  } finally {
    client.release();
  }
});

// 删除单条投注比分（仅未开赛且未关闭接单）
router.delete('/items/:itemId', authenticate, async (req, res) => {
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: '参数错误' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const item = await getEditableBetItem(client, itemId, req.user.id);
    await client.query('DELETE FROM bet_items WHERE id = $1', [itemId]);

    const left = await client.query('SELECT COUNT(*)::int AS count FROM bet_items WHERE order_id = $1', [item.order_id]);
    const leftCount = left.rows[0].count;

    if (leftCount === 0) {
      await client.query('DELETE FROM bet_orders WHERE id = $1', [item.order_id]);
      await client.query('COMMIT');
      return res.json({ message: '已删除该投注项，空订单已移除', order_deleted: true });
    }

    await client.query(
      `UPDATE bet_orders
       SET total_amount = (
         SELECT COALESCE(SUM(amount), 0) FROM bet_items WHERE order_id = $1
       )
       WHERE id = $1`,
      [item.order_id]
    );

    await client.query('COMMIT');
    res.json({ message: '删除成功', order_deleted: false });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message || '删除失败' });
  } finally {
    client.release();
  }
});

module.exports = router;
