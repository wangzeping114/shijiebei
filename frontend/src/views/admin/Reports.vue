<template>
  <div class="page">
    <div class="page-header">
      <h2>📊 统计报表</h2>
    </div>

    <div class="layout-wrap">
      <!-- 左侧：赛事列表 -->
      <div class="match-list-panel">
        <div class="panel-title">已结束赛事</div>
        <div v-if="loadingList" class="loading-block"><el-skeleton :rows="3" animated /></div>
        <div v-else-if="finishedMatches.length === 0" class="empty-tip">暂无已结束赛事</div>
        <div
          v-for="m in finishedMatches"
          :key="m.id"
          class="match-item"
          :class="{ active: selectedMatch?.id === m.id }"
          @click="selectMatch(m)"
        >
          <div class="match-name">{{ m.home_team }} vs {{ m.away_team }}</div>
          <div class="match-meta">
            <span class="final-score">{{ m.home_score }} : {{ m.away_score }}</span>
            <span class="match-time">{{ formatDate(m.match_time) }}</span>
          </div>
        </div>
      </div>

      <!-- 右侧：报表详情 -->
      <div class="report-panel" v-loading="loadingReport">
        <div v-if="!report" class="empty-report">
          <el-empty description="请从左侧选择赛事查看报表" />
        </div>

        <template v-else>
          <!-- 汇总卡片 -->
          <div class="summary-cards">
            <div class="summary-card">
              <div class="card-value">{{ report.summary.total_orders }}</div>
              <div class="card-label">总投注笔数</div>
            </div>
            <div class="summary-card blue">
              <div class="card-value">¥{{ report.summary.total_amount.toFixed(2) }}</div>
              <div class="card-label">总投注金额</div>
            </div>
            <div class="summary-card green">
              <div class="card-value">{{ report.summary.winning_users_count }}</div>
              <div class="card-label">中奖人数</div>
            </div>
            <div class="summary-card red">
              <div class="card-value">¥{{ report.summary.total_winning_amount.toFixed(2) }}</div>
              <div class="card-label">总赔付金额</div>
            </div>
          </div>

          <!-- 中奖用户榜 -->
          <div class="section">
            <h3>🏆 中奖用户名单</h3>
            <el-table :data="report.winning_users" border stripe empty-text="本场无中奖用户">
              <el-table-column label="用户名" prop="username" width="120" />
              <el-table-column label="昵称" prop="nickname" width="120" />
              <el-table-column label="总投注额">
                <template #default="{ row }">¥{{ Number(row.total_bet).toFixed(2) }}</template>
              </el-table-column>
              <el-table-column label="中奖赔付总额">
                <template #default="{ row }">
                  <span class="win-amount">¥{{ Number(row.total_won).toFixed(2) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 所有用户投注明细 -->
          <div class="section">
            <h3>📋 所有用户投注明细</h3>
            <div v-for="user in report.user_details" :key="user.user_id" class="user-block">
              <div class="user-header">
                <span class="user-name">{{ user.nickname }}（{{ user.username }}）</span>
                <span class="user-total">总投注 ¥{{ Number(user.total_bet).toFixed(2) }}</span>
                <span v-if="user.total_won > 0" class="user-won">中奖赔付 ¥{{ Number(user.total_won).toFixed(2) }}</span>
              </div>
              <el-table :data="flattenItems(user.orders)" border size="small" class="detail-table">
                <el-table-column label="订单号" width="200">
                  <template #default="{ row }">
                    <span class="order-no">{{ row.order_no }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="比分（主:客）" width="120">
                  <template #default="{ row }">
                    <span class="score">{{ row.home_score }} : {{ row.away_score }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="赔率" width="80">
                  <template #default="{ row }">× {{ Number(row.odds_value).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column label="投注金额" width="100">
                  <template #default="{ row }">¥{{ Number(row.amount).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column label="结果" width="150">
                  <template #default="{ row }">
                    <el-tag v-if="row.is_winner" type="success">
                      中奖 +¥{{ (Number(row.amount) * Number(row.odds_value)).toFixed(2) }}
                    </el-tag>
                    <el-tag v-else type="info">未中奖</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="投注时间">
                  <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <!-- 打印 -->
          <div class="print-bar">
            <el-button type="primary" @click="window.print()">🖨️ 打印报表</el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminAPI } from '../../api'

const finishedMatches = ref([])
const selectedMatch = ref(null)
const report = ref(null)
const loadingList = ref(false)
const loadingReport = ref(false)

const window = globalThis

function formatDate(t) {
  return new Date(t).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function formatDateTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

// 将 orders + items 摊平为 item 行（附带 order 信息）
function flattenItems(orders) {
  const rows = []
  for (const order of orders) {
    for (const item of order.items || []) {
      rows.push({ ...item, order_no: order.order_no, created_at: order.created_at })
    }
  }
  return rows
}

async function selectMatch(match) {
  selectedMatch.value = match
  loadingReport.value = true
  try {
    report.value = await adminAPI.getReport(match.id)
  } catch (err) {
    ElMessage.error(err.error || '获取报表失败')
  } finally {
    loadingReport.value = false
  }
}

onMounted(async () => {
  loadingList.value = true
  try {
    finishedMatches.value = await adminAPI.getReportList()
  } catch {
    ElMessage.error('获取赛事列表失败')
  } finally {
    loadingList.value = false
  }
})
</script>

<style scoped>
.page { padding: 32px; }
.page-header { margin-bottom: 24px; }
.page-header h2 { font-size: 22px; color: #1a4a1a; }

.layout-wrap { display: flex; gap: 20px; align-items: flex-start; }

.match-list-panel {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.panel-title { font-weight: 700; color: #1a4a1a; margin-bottom: 12px; font-size: 14px; }
.empty-tip { color: #aaa; text-align: center; padding: 20px; font-size: 13px; }
.loading-block { padding: 12px; }

.match-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: background 0.15s;
  border: 1px solid transparent;
}
.match-item:hover { background: #f5faf5; border-color: #b7e4b7; }
.match-item.active { background: #e8f5e8; border-color: #2d7d2d; }
.match-name { font-size: 13px; font-weight: 600; color: #333; }
.match-meta { display: flex; justify-content: space-between; margin-top: 4px; }
.final-score { font-size: 15px; font-weight: 700; color: #c00; }
.match-time { font-size: 11px; color: #aaa; }

.report-panel { flex: 1; min-width: 0; }
.empty-report { background: #fff; border-radius: 12px; padding: 60px; }

.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border-top: 4px solid #2d7d2d;
}
.summary-card.blue { border-top-color: #3498db; }
.summary-card.green { border-top-color: #27ae60; }
.summary-card.red { border-top-color: #e74c3c; }
.card-value { font-size: 24px; font-weight: 800; color: #1a4a1a; }
.card-label { font-size: 13px; color: #888; margin-top: 4px; }

.section { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
.section h3 { font-size: 16px; color: #1a4a1a; margin-bottom: 14px; }

.win-amount { font-weight: 700; color: #27ae60; font-size: 15px; }

.user-block { margin-bottom: 16px; }
.user-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 8px 8px 0 0;
  font-size: 14px;
}
.user-name { font-weight: 700; color: #1a4a1a; }
.user-total { color: #666; }
.user-won { color: #27ae60; font-weight: 600; }
.detail-table { border-radius: 0 0 8px 8px; }
.order-no { font-size: 11px; font-family: monospace; color: #888; }
.score { font-weight: 700; font-size: 15px; color: #1a4a1a; }

.print-bar { text-align: right; margin-top: 8px; }

@media print {
  .match-list-panel, .print-bar { display: none; }
  .report-panel { flex: none; width: 100%; }
}
</style>
