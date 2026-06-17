const express = require('express');
const pool = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const MATCH_SELECT_FIELDS = `
  id,
  home_team,
  away_team,
  to_char(match_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS match_time,
  status,
  home_score,
  away_score,
  created_at,
  round,
  venue
`;

async function getMatchById(matchId) {
  const result = await pool.query(
    `SELECT ${MATCH_SELECT_FIELDS} FROM matches WHERE id = $1`,
    [matchId]
  );
  return result.rows[0] || null;
}

// ═══════════════ 赛事管理 ═══════════════

// 获取所有赛事
router.get('/matches', async (req, res) => {
  try {
    const result = await pool.query(`SELECT ${MATCH_SELECT_FIELDS} FROM matches ORDER BY match_time ASC`);
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
      'INSERT INTO matches (home_team, away_team, match_time) VALUES ($1, $2, $3) RETURNING id',
      [home_team, away_team, match_time]
    );
    const created = await getMatchById(result.rows[0].id);
    res.status(201).json(created);
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
       WHERE id = $5 RETURNING id`,
      [home_team, away_team, match_time, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '赛事不存在' });
    const updated = await getMatchById(result.rows[0].id);
    res.json(updated);
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
    [0, 0, 0.00], [1, 0, 0.00], [0, 1, 0.00], [1, 1, 0.00],
    [2, 0, 0.00], [0, 2, 0.00], [2, 1, 0.00], [1, 2, 0.00],
    [2, 2, 0.00], [3, 0, 0.00], [0, 3, 0.00], [3, 1, 0.00],
    [1, 3, 0.00], [3, 2, 0.00], [2, 3, 0.00], [4, 0, 0.00],
    [0, 4, 0.00], [4, 1, 0.00], [1, 4, 0.00], [3, 3, 0.00]
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [h, a, o] of defaults) {
      await client.query(
        `INSERT INTO odds (match_id, home_score, away_score, odds_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (match_id, home_score, away_score) DO UPDATE SET odds_value = EXCLUDED.odds_value`,
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
  if (odds.some(o => Number(o.odds_value) < 0)) {
    return res.status(400).json({ error: '赔率不能小于0' });
  }

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
  if (home_score === undefined || away_score === undefined || odds_value === undefined || odds_value === null) {
    return res.status(400).json({ error: '请填写完整赔率信息' });
  }
  if (Number(odds_value) < 0) {
    return res.status(400).json({ error: '赔率不能小于0' });
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

// 结算市场投注项（全场或上半场，type='ft'|'ht'；extraData: { totalCorners }）
async function settleMarketItems(client, matchId, homeScore, awayScore, type, extraData = {}) {
  const prefix = type === 'ht' ? 'ht_' : '';
  // ft 时用 '%' 匹配全部（含无前缀的 btts/corners），ht 时只匹配 ht_ 前缀
  const pattern = type === 'ft' ? '%' : `${prefix}%`;
  const marketItems = await client.query(
    `SELECT bi.id, mo.selection_code
     FROM bet_items bi
     JOIN market_odds mo ON bi.market_odds_id = mo.id
     JOIN bet_orders bo ON bi.order_id = bo.id
     WHERE bo.match_id = $1 AND bi.is_winner = FALSE
       AND mo.selection_code LIKE $2`,
    [matchId, pattern]
  );

  for (const item of marketItems.rows) {
    const code = item.selection_code;
    let isWinner = false;
    const total = homeScore + awayScore;

    if (code === `${prefix}home_win`) isWinner = homeScore > awayScore;
    else if (code === `${prefix}draw`) isWinner = homeScore === awayScore;
    else if (code === `${prefix}away_win`) isWinner = awayScore > homeScore;
    else {
      const overMatch = code.match(new RegExp(`^${prefix}total_over_(-?\\d+\\.?\\d*)$`));
      const underMatch = code.match(new RegExp(`^${prefix}total_under_(-?\\d+\\.?\\d*)$`));
      const hcHomeMatch = code.match(new RegExp(`^${prefix}handicap_home_(-?\\d+\\.?\\d*)$`));
      const hcAwayMatch = code.match(new RegExp(`^${prefix}handicap_away_(-?\\d+\\.?\\d*)$`));

      if (overMatch) isWinner = total > parseFloat(overMatch[1]);
      else if (underMatch) isWinner = total < parseFloat(underMatch[1]);
      else if (hcHomeMatch) isWinner = (homeScore + parseFloat(hcHomeMatch[1])) > awayScore;
      else if (hcAwayMatch) isWinner = (awayScore + parseFloat(hcAwayMatch[1])) > homeScore;
      // 无前缀盘口：仅全场结算
      else if (type === 'ft') {
        if (code === 'btts_yes') isWinner = homeScore > 0 && awayScore > 0;
        else if (code === 'btts_no') isWinner = !(homeScore > 0 && awayScore > 0);
        else {
          const cornersMatch = code.match(/^corners_over_(-?\d+\.?\d*)$/);
          if (cornersMatch && extraData.totalCorners != null) {
            isWinner = extraData.totalCorners > parseFloat(cornersMatch[1]);
          }
        }
      }
    }

    if (isWinner) {
      await client.query('UPDATE bet_items SET is_winner = TRUE WHERE id = $1', [item.id]);
    }
  }
}

// 录入全场比分（同时结算比分投注 + 全场市场投注）
router.put('/matches/:id/result', async (req, res) => {
  const { home_score, away_score, home_corners, away_corners } = req.body;
  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: '请输入主队和客队比分' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 更新赛事比分、角球数和状态
    await client.query(
      "UPDATE matches SET home_score = $1, away_score = $2, home_corners = $3, away_corners = $4, status = 'finished' WHERE id = $5",
      [home_score, away_score, home_corners ?? null, away_corners ?? null, req.params.id]
    );

    // 标记中奖比分投注项
    await client.query(
      `UPDATE bet_items SET is_winner = TRUE
       WHERE order_id IN (SELECT id FROM bet_orders WHERE match_id = $1)
         AND bet_type = 'score' AND home_score = $2 AND away_score = $3`,
      [req.params.id, home_score, away_score]
    );

    // 结算全场市场投注项（含 BTTS；角球仅在填写了角球数时结算）
    const totalCorners = (home_corners != null && away_corners != null)
      ? Number(home_corners) + Number(away_corners) : null;
    await settleMarketItems(client, req.params.id, Number(home_score), Number(away_score), 'ft', { totalCorners });

    // 检查是否已有上半场比分，若有则一并结算上半场市场投注
    const matchRow = await client.query('SELECT ht_home_score, ht_away_score FROM matches WHERE id = $1', [req.params.id]);
    const { ht_home_score, ht_away_score } = matchRow.rows[0];
    if (ht_home_score !== null && ht_away_score !== null) {
      await settleMarketItems(client, req.params.id, Number(ht_home_score), Number(ht_away_score), 'ht');
    }

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

// 录入上半场比分（结算上半场市场投注，不改变赛事状态）
router.put('/matches/:id/ht-result', async (req, res) => {
  const { ht_home_score, ht_away_score } = req.body;
  if (ht_home_score === undefined || ht_away_score === undefined) {
    return res.status(400).json({ error: '请输入上半场主队和客队比分' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE matches SET ht_home_score = $1, ht_away_score = $2 WHERE id = $3',
      [ht_home_score, ht_away_score, req.params.id]
    );

    await settleMarketItems(client, req.params.id, Number(ht_home_score), Number(ht_away_score), 'ht');

    await client.query('COMMIT');
    res.json({ message: '上半场比分录入成功，上半场市场投注已结算' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: '上半场比分录入失败' });
  } finally {
    client.release();
  }
});

// ═══════════════ 统计报表 ═══════════════

// 投注上报清单（按赛事汇总，默认仅 pending）
router.get('/upstream-report', async (req, res) => {
  const orderStatus = (req.query.orderStatus || 'pending').trim();

  try {
    const matchesResult = orderStatus === 'all'
      ? await pool.query(
          `SELECT DISTINCT m.id, m.home_team, m.away_team, m.match_time
           FROM bet_orders bo
           JOIN matches m ON bo.match_id = m.id
           ORDER BY m.match_time ASC, m.id ASC`
        )
      : await pool.query(
          `SELECT DISTINCT m.id, m.home_team, m.away_team, m.match_time
           FROM bet_orders bo
           JOIN matches m ON bo.match_id = m.id
           WHERE bo.status = $1
           ORDER BY m.match_time ASC, m.id ASC`,
          [orderStatus]
        );

    const data = [];

    for (const match of matchesResult.rows) {
      const linesResult = orderStatus === 'all'
        ? await pool.query(
            `SELECT bi.bet_type, bi.home_score, bi.away_score, bi.market_label, bi.odds_value,
                    SUM(bi.amount)::numeric(12,2) AS amount
             FROM bet_orders bo
             JOIN bet_items bi ON bi.order_id = bo.id
             WHERE bo.match_id = $1
             GROUP BY bi.bet_type, bi.home_score, bi.away_score, bi.market_label, bi.odds_value
             ORDER BY bi.bet_type ASC, bi.home_score ASC NULLS LAST, bi.away_score ASC NULLS LAST`,
            [match.id]
          )
        : await pool.query(
            `SELECT bi.bet_type, bi.home_score, bi.away_score, bi.market_label, bi.odds_value,
                    SUM(bi.amount)::numeric(12,2) AS amount
             FROM bet_orders bo
             JOIN bet_items bi ON bi.order_id = bo.id
             WHERE bo.match_id = $1 AND bo.status = $2
             GROUP BY bi.bet_type, bi.home_score, bi.away_score, bi.market_label, bi.odds_value
             ORDER BY bi.bet_type ASC, bi.home_score ASC NULLS LAST, bi.away_score ASC NULLS LAST`,
            [match.id, orderStatus]
          );

      const detailsResult = orderStatus === 'all'
        ? await pool.query(
            `SELECT bo.order_no, bo.created_at, bo.status,
                    u.username, u.nickname,
                    bi.bet_type, bi.home_score, bi.away_score, bi.market_label, bi.odds_value, bi.amount
             FROM bet_orders bo
             JOIN users u ON u.id = bo.user_id
             JOIN bet_items bi ON bi.order_id = bo.id
             WHERE bo.match_id = $1
             ORDER BY bo.created_at DESC, bo.order_no ASC, bi.id ASC`,
            [match.id]
          )
        : await pool.query(
            `SELECT bo.order_no, bo.created_at, bo.status,
                    u.username, u.nickname,
                    bi.bet_type, bi.home_score, bi.away_score, bi.market_label, bi.odds_value, bi.amount
             FROM bet_orders bo
             JOIN users u ON u.id = bo.user_id
             JOIN bet_items bi ON bi.order_id = bo.id
             WHERE bo.match_id = $1 AND bo.status = $2
             ORDER BY bo.created_at DESC, bo.order_no ASC, bi.id ASC`,
            [match.id, orderStatus]
          );

      if (linesResult.rows.length === 0) continue;

      const totalAmount = linesResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
      data.push({
        match,
        lines: linesResult.rows,
        details: detailsResult.rows,
        total_amount: Number(totalAmount.toFixed(2))
      });
    }

    res.json({
      order_status: orderStatus,
      generated_at: new Date().toISOString(),
      items: data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取投注上报清单失败' });
  }
});

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

// ═══════════════ 市场赔率管理 ═══════════════

// 获取指定赛事市场赔率
router.get('/market-odds/:matchId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM market_odds WHERE match_id = $1 ORDER BY market_type ASC, id ASC',
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '获取市场赔率失败' });
  }
});

// 生成默认市场赔率（以主队/客队名称替换占位符，让球值/大小球线从请求体读取）
router.post('/market-odds/:matchId/generate', async (req, res) => {
  const matchResult = await pool.query('SELECT home_team, away_team FROM matches WHERE id = $1', [req.params.matchId]);
  if (matchResult.rows.length === 0) return res.status(404).json({ error: '赛事不存在' });
  const { home_team, away_team } = matchResult.rows[0];

  // 每场比赛的让球值和大小球线各不相同，从请求体读取，未填则用默认值
  const ftHc1   = parseFloat(req.body.ft_hc1   ?? 1.75); // 全场让球线1（主队收让）
  const ftHc2   = parseFloat(req.body.ft_hc2   ?? 2);    // 全场让球线2（主队受让）
  const htHc1   = parseFloat(req.body.ht_hc1   ?? 0.75); // 上半场让球线
  const ftT1    = parseFloat(req.body.ft_total1 ?? 3);   // 全场大小球线1
  const ftT2    = parseFloat(req.body.ft_total2 ?? 2.5); // 全场大小球线2
  const htT1    = parseFloat(req.body.ht_total1 ?? 1);   // 上半场大小球线

  const defaults = [
    // 独赢盘口
    ['独赢盘口', `${home_team}独赢`, 'home_win', 0.00],
    ['独赢盘口', '平局',              'draw',     0.00],
    ['独赢盘口', `${away_team}独赢`, 'away_win',  0.00],
    // 上半场独赢盘口
    ['上半场独赢盘口', `上半场${home_team}独赢`, 'ht_home_win', 0.00],
    ['上半场独赢盘口', '上半场平局',              'ht_draw',     0.00],
    ['上半场独赢盘口', `上半场${away_team}独赢`, 'ht_away_win',  0.00],
    // 全场让球盘口（让球值由参数决定）
    ['全场让球盘口', `${home_team}让${ftHc1}球`, `handicap_home_${ftHc1}`,  0.00],
    ['全场让球盘口', `${away_team}让${ftHc1}球`, `handicap_away_${ftHc1}`,  0.00],
    ['全场让球盘口', `${home_team}让${ftHc2}球`, `handicap_home_${ftHc2}`,  0.00],
    ['全场让球盘口', `${away_team}让${ftHc2}球`, `handicap_away_${ftHc2}`,  0.00],
    // 上半场让球盘口
    ['上半场让球盘口', `上半场${home_team}让${htHc1}球`, `ht_handicap_home_${htHc1}`, 0.00],
    ['上半场让球盘口', `上半场${away_team}让${htHc1}球`, `ht_handicap_away_${htHc1}`, 0.00],
    // 全场比分大小盘口（大小球线由参数决定）
    ['全场比分大小盘口', `全场比分大于${ftT1}`, `total_over_${ftT1}`,  0.00],
    ['全场比分大小盘口', `全场比分小于${ftT1}`, `total_under_${ftT1}`, 0.00],
    ['全场比分大小盘口', `全场比分大于${ftT2}`, `total_over_${ftT2}`,  0.00],
    ['全场比分大小盘口', `全场比分小于${ftT2}`, `total_under_${ftT2}`, 0.00],
    // 上半场比分大小盘口
    ['上半场比分大小盘口', `上半场比分大于${htT1}`, `ht_total_over_${htT1}`,  0.00],
    ['上半场比分大小盘口', `上半场比分小于${htT1}`, `ht_total_under_${htT1}`, 0.00],
    // 双方是否进球
    ['双方是否进球', '双方均进球（是）',   'btts_yes', 0.00],
    ['双方是否进球', '双方未均进球（否）', 'btts_no',  0.00],
    // 全场角球盘口（默认一条，可增删）
    ['全场角球盘口', '全场角球大于9.5', 'corners_over_9.5', 0.00],
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 让球/大小球线会随参数变化，先清除旧行再重建，避免堆积
    await client.query(
      `DELETE FROM market_odds WHERE match_id = $1
         AND market_type IN ('全场让球盘口','上半场让球盘口','全场比分大小盘口','上半场比分大小盘口')`,
      [req.params.matchId]
    );
    for (const [market_type, selection, selection_code, odds_value] of defaults) {
      await client.query(
        `INSERT INTO market_odds (match_id, market_type, selection, selection_code, odds_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (match_id, market_type, selection) DO UPDATE SET selection_code = EXCLUDED.selection_code`,
        [req.params.matchId, market_type, selection, selection_code, odds_value]
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(
      'SELECT * FROM market_odds WHERE match_id = $1 ORDER BY market_type ASC, id ASC',
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '生成默认市场赔率失败' });
  } finally {
    client.release();
  }
});

// 批量更新市场赔率
router.put('/market-odds/:matchId', async (req, res) => {
  const { odds } = req.body;
  if (!odds || odds.length === 0) return res.status(400).json({ error: '数据不能为空' });
  if (odds.some(o => Number(o.odds_value) < 0)) {
    return res.status(400).json({ error: '赔率不能小于0' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const odd of odds) {
      if (odd.id) {
        await client.query(
          'UPDATE market_odds SET odds_value = $1, selection = $2, selection_code = $3 WHERE id = $4 AND match_id = $5',
          [odd.odds_value, odd.selection, odd.selection_code, odd.id, req.params.matchId]
        );
      } else if (odd.market_type && odd.selection && odd.selection_code) {
        // Excel 导入的新条目
        await client.query(
          `INSERT INTO market_odds (match_id, market_type, selection, selection_code, odds_value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (match_id, market_type, selection) DO UPDATE
             SET selection_code = EXCLUDED.selection_code, odds_value = EXCLUDED.odds_value`,
          [req.params.matchId, odd.market_type, odd.selection, odd.selection_code, odd.odds_value]
        );
      }
    }
    await client.query('COMMIT');
    const result = await pool.query(
      'SELECT * FROM market_odds WHERE match_id = $1 ORDER BY market_type ASC, id ASC',
      [req.params.matchId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '更新市场赔率失败' });
  } finally {
    client.release();
  }
});

// 新增单条市场赔率（用于角球等可变项）
router.post('/market-odds/:matchId/items', async (req, res) => {
  const { market_type, selection, selection_code, odds_value } = req.body;
  if (!market_type || !selection || !selection_code) {
    return res.status(400).json({ error: '参数不完整' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO market_odds (match_id, market_type, selection, selection_code, odds_value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (match_id, market_type, selection) DO UPDATE
         SET selection_code = EXCLUDED.selection_code, odds_value = EXCLUDED.odds_value
       RETURNING *`,
      [req.params.matchId, market_type, selection, selection_code, odds_value || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '新增失败' });
  }
});

// 删除单条市场赔率
router.delete('/market-odds/item/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM market_odds WHERE id = $1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
