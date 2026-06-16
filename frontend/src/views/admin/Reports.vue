<template>
  <div class="page">
    <div class="page-header">
      <h2>📊 统计报表</h2>
    </div>

    <div class="layout-wrap">
      <!-- 左侧：赛事列表 -->
      <div class="match-list-panel">
        <div class="panel-title">已结束赛事</div>
        <el-input
          v-model="matchKeyword"
          clearable
          placeholder="筛选赛事"
          size="small"
          class="panel-filter"
        />
        <div v-if="loadingList" class="loading-block"><el-skeleton :rows="3" animated /></div>
        <div v-else-if="filteredFinishedMatches.length === 0" class="empty-tip">暂无已结束赛事</div>
        <div
          v-for="m in pagedFinishedMatches"
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
        <el-pagination
          v-if="filteredFinishedMatches.length > 0"
          v-model:current-page="matchPage"
          v-model:page-size="matchPageSize"
          :page-sizes="[5, 10, 20]"
          layout="total, sizes, prev, next"
          :total="filteredFinishedMatches.length"
          small
          class="panel-pager"
        />
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
            <div class="section-tools">
              <el-input
                v-model="winningKeyword"
                clearable
                placeholder="筛选用户名/昵称"
                size="small"
                style="width: 220px"
              />
            </div>
            <el-table :data="pagedWinningUsers" border stripe empty-text="本场无中奖用户">
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
            <div v-if="filteredWinningUsers.length > 0" class="section-pager">
              <el-pagination
                v-model:current-page="winningPage"
                v-model:page-size="winningPageSize"
                :page-sizes="[10, 20, 50]"
                layout="total, sizes, prev, pager, next"
                :total="filteredWinningUsers.length"
              />
            </div>
          </div>

          <!-- 所有用户投注明细 -->
          <div class="section">
            <h3>📋 所有用户投注明细</h3>
            <div class="section-tools">
              <el-input
                v-model="detailKeyword"
                clearable
                placeholder="筛选用户/订单号/比分"
                size="small"
                style="width: 260px"
              />
            </div>
            <el-table :data="pagedDetailRows" border size="small" class="detail-table" empty-text="暂无明细">
              <el-table-column label="用户" min-width="150">
                <template #default="{ row }">{{ row.nickname }}（{{ row.username }}）</template>
              </el-table-column>
              <el-table-column label="订单号" width="200">
                <template #default="{ row }">
                  <span class="order-no">{{ row.order_no }}</span>
                </template>
              </el-table-column>
              <el-table-column label="投注项" width="180">
                <template #default="{ row }">
                  <el-tag v-if="row.bet_type === 'market' || row.market_label" size="small" type="warning" style="margin-right:4px">盘口</el-tag>
                  <span class="score">{{ (row.bet_type === 'market' || row.market_label) ? row.market_label : (row.home_score + ' : ' + row.away_score) }}</span>
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
            <div v-if="filteredDetailRows.length > 0" class="section-pager">
              <el-pagination
                v-model:current-page="detailPage"
                v-model:page-size="detailPageSize"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                :total="filteredDetailRows.length"
              />
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
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminAPI } from '../../api'

const finishedMatches = ref([])
const selectedMatch = ref(null)
const report = ref(null)
const loadingList = ref(false)
const loadingReport = ref(false)
const matchKeyword = ref('')
const matchPage = ref(1)
const matchPageSize = ref(10)
const winningKeyword = ref('')
const winningPage = ref(1)
const winningPageSize = ref(10)
const detailKeyword = ref('')
const detailPage = ref(1)
const detailPageSize = ref(20)

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

const filteredFinishedMatches = computed(() => {
  const keyword = matchKeyword.value.trim().toLowerCase()
  if (!keyword) return finishedMatches.value

  return finishedMatches.value.filter(m => {
    const text = `${m.home_team} ${m.away_team} ${formatDate(m.match_time)}`.toLowerCase()
    return text.includes(keyword)
  })
})

const pagedFinishedMatches = computed(() => {
  const start = (matchPage.value - 1) * matchPageSize.value
  return filteredFinishedMatches.value.slice(start, start + matchPageSize.value)
})

const filteredWinningUsers = computed(() => {
  const users = report.value?.winning_users || []
  const keyword = winningKeyword.value.trim().toLowerCase()
  if (!keyword) return users
  return users.filter(u => `${u.username} ${u.nickname}`.toLowerCase().includes(keyword))
})

const pagedWinningUsers = computed(() => {
  const start = (winningPage.value - 1) * winningPageSize.value
  return filteredWinningUsers.value.slice(start, start + winningPageSize.value)
})

const detailRows = computed(() => {
  const users = report.value?.user_details || []
  const rows = []
  for (const user of users) {
    for (const order of user.orders || []) {
      for (const item of order.items || []) {
        rows.push({
          ...item,
          username: user.username,
          nickname: user.nickname,
          order_no: order.order_no,
          created_at: order.created_at
        })
      }
    }
  }
  return rows
})

const filteredDetailRows = computed(() => {
  const keyword = detailKeyword.value.trim().toLowerCase()
  if (!keyword) return detailRows.value

  return detailRows.value.filter(row => {
    const itemLabel = (row.bet_type === 'market' || row.market_label)
      ? (row.market_label || '')
      : `${row.home_score}-${row.away_score}`
    const text = [
      row.username,
      row.nickname,
      row.order_no,
      itemLabel,
      String(row.amount),
      String(row.odds_value)
    ].join(' ').toLowerCase()
    return text.includes(keyword)
  })
})

const pagedDetailRows = computed(() => {
  const start = (detailPage.value - 1) * detailPageSize.value
  return filteredDetailRows.value.slice(start, start + detailPageSize.value)
})

watch([matchKeyword, matchPageSize], () => {
  matchPage.value = 1
})

watch([winningKeyword, winningPageSize], () => {
  winningPage.value = 1
})

watch([detailKeyword, detailPageSize], () => {
  detailPage.value = 1
})

async function selectMatch(match) {
  selectedMatch.value = match
  loadingReport.value = true
  try {
    report.value = await adminAPI.getReport(match.id)
    winningPage.value = 1
    detailPage.value = 1
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
.panel-filter { margin-bottom: 10px; }
.empty-tip { color: #aaa; text-align: center; padding: 20px; font-size: 13px; }
.loading-block { padding: 12px; }
.panel-pager { margin-top: 10px; }

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
.section-tools { margin-bottom: 12px; display: flex; justify-content: flex-end; }
.section-pager { margin-top: 12px; display: flex; justify-content: flex-end; }

.win-amount { font-weight: 700; color: #27ae60; font-size: 15px; }

.detail-table { border-radius: 8px; }
.order-no { font-size: 11px; font-family: monospace; color: #888; }
.score { font-weight: 700; font-size: 15px; color: #1a4a1a; }

.print-bar { text-align: right; margin-top: 8px; }

@media print {
  .match-list-panel, .print-bar { display: none; }
  .report-panel { flex: none; width: 100%; }
}
</style>
