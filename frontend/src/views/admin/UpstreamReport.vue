<template>
  <div class="page">
    <div class="page-header">
      <h2>📄 投注上报</h2>
    </div>

    <div class="card" v-loading="loading">
      <div class="helper">先在上方列表核对，再复制下方文案上报，避免纠纷。</div>

      <div class="filter-bar">
        <el-select v-model="orderStatus" style="width: 170px" @change="loadData">
          <el-option label="仅待开奖订单" value="pending" />
          <el-option label="全部订单" value="all" />
        </el-select>
        <el-input
          v-model="keywordInput"
          clearable
          placeholder="搜索用户/订单号/赛事/比分"
          style="width: 280px"
          @keyup.enter="applySearch"
        />
        <el-button type="primary" @click="applySearch">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
        <el-button :loading="loading" @click="loadData">刷新</el-button>
      </div>

      <el-empty v-if="reportItems.length === 0 && !loading" description="暂无可上报投注数据" />

      <template v-else>
        <div class="summary">文案汇总：共 {{ reportItems.length }} 场，合计 ¥{{ formatAmount(reportGrandTotal) }}</div>
        <div class="summary sub">核对列表：{{ detailRows.length }} 条明细（受搜索条件影响）</div>

        <el-table :data="pagedDetailRows" border stripe size="small" class="detail-table" empty-text="暂无明细">
          <el-table-column label="赛事" min-width="160">
            <template #default="{ row }">{{ row.match_name }}</template>
          </el-table-column>
          <el-table-column label="用户" min-width="130">
            <template #default="{ row }">{{ row.nickname }}（{{ row.username }}）</template>
          </el-table-column>
          <el-table-column label="订单号" min-width="190" prop="order_no" />
          <el-table-column label="比分" width="90">
            <template #default="{ row }">{{ row.home_score }}-{{ row.away_score }}</template>
          </el-table-column>
          <el-table-column label="赔率" width="90">
            <template #default="{ row }">@{{ formatOdds(row.odds_value) }}</template>
          </el-table-column>
          <el-table-column label="入" width="90">
            <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ row.status }}</template>
          </el-table-column>
          <el-table-column label="投注时间" min-width="150">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
        </el-table>

        <div class="pager-wrap">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            :total="detailRows.length"
          />
        </div>

        <div class="detail-title copy-title">可复制上报文案</div>
        <div class="copy-actions">
          <el-button type="primary" :loading="copying" @click="copyReport">复制上报文案</el-button>
        </div>
        <el-input
          v-model="reportText"
          type="textarea"
          :rows="16"
          readonly
          resize="vertical"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { adminAPI } from '../../api'

const loading = ref(false)
const copying = ref(false)
const orderStatus = ref('pending')
const keywordInput = ref('')
const appliedKeyword = ref('')
const report = ref({ items: [] })
const currentPage = ref(1)
const pageSize = ref(20)

function applySearch() {
  appliedKeyword.value = keywordInput.value.trim()
  currentPage.value = 1
}

function resetSearch() {
  keywordInput.value = ''
  appliedKeyword.value = ''
  currentPage.value = 1
}

const reportItems = computed(() => report.value.items || [])

const keywordFilteredItems = computed(() => {
  const keyword = appliedKeyword.value.trim().toLowerCase()
  if (!keyword) return reportItems.value

  const result = []

  for (const item of reportItems.value) {
    const matchText = `${item.match.home_team} ${item.match.away_team}`.toLowerCase()
    const details = (item.details || []).filter(d => {
      const rowText = [
        d.username,
        d.nickname,
        d.order_no,
        `${d.home_score}-${d.away_score}`,
        `${d.home_score}:${d.away_score}`,
        d.status,
        String(d.amount),
        String(d.odds_value),
        matchText
      ].join(' ').toLowerCase()
      return rowText.includes(keyword)
    })

    if (details.length === 0 && !matchText.includes(keyword)) continue

    // 基于筛选后的明细重新聚合行文案，确保复制文本与核对列表一致
    const lineMap = new Map()
    for (const d of details) {
      const key = `${d.home_score}-${d.away_score}-${d.odds_value}`
      if (!lineMap.has(key)) {
        lineMap.set(key, {
          home_score: d.home_score,
          away_score: d.away_score,
          odds_value: d.odds_value,
          amount: 0
        })
      }
      const line = lineMap.get(key)
      line.amount += Number(d.amount)
    }

    const lines = [...lineMap.values()]
      .sort((a, b) => (a.home_score - b.home_score) || (a.away_score - b.away_score))
      .map(l => ({ ...l, amount: Number(l.amount.toFixed(2)) }))

    const totalAmount = lines.reduce((sum, l) => sum + Number(l.amount), 0)

    result.push({
      ...item,
      lines,
      details,
      total_amount: Number(totalAmount.toFixed(2))
    })
  }

  return result
})

const reportGrandTotal = computed(() =>
  reportItems.value.reduce((sum, item) => sum + Number(item.total_amount || 0), 0)
)

const detailRows = computed(() => {
  const rows = []
  for (const item of keywordFilteredItems.value || []) {
    const matchName = `${item.match.home_team} VS${item.match.away_team}`
    for (const detail of item.details || []) {
      rows.push({ ...detail, match_name: matchName })
    }
  }
  return rows
})

const pagedDetailRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return detailRows.value.slice(start, start + pageSize.value)
})

function formatAmount(v) {
  const n = parseFloat(Number(v).toFixed(2))
  return String(n)
}

function formatOdds(v) {
  const n = parseFloat(Number(v).toFixed(2))
  return String(n)
}

function formatDateTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ').replace(/\.\d+.*$/, '')
  return s.slice(0, 16).replace(/-/g, '/')
}

const reportText = computed(() => {
  if (!reportItems.value.length) return ''

  return reportItems.value.map(item => {
    const title = `${item.match.home_team} VS${item.match.away_team}`
    const lines = item.lines.map(line =>
      `全场比分，${line.home_score}-${line.away_score} 赔率@${formatOdds(line.odds_value)}，入 ${formatAmount(line.amount)}`
    )
    const total = `合计 ${formatAmount(item.total_amount)}`
    return [title, ...lines, '', total].join('\n')
  }).join('\n\n')
})

async function loadData() {
  loading.value = true
  try {
    report.value = await adminAPI.getUpstreamReport(orderStatus.value)
    currentPage.value = 1
  } catch (err) {
    ElMessage.error(err.error || '获取上报数据失败')
  } finally {
    loading.value = false
  }
}

watch(pageSize, () => {
  currentPage.value = 1
})

async function copyReport() {
  if (!reportText.value.trim()) {
    ElMessage.warning('暂无可复制内容')
    return
  }
  copying.value = true
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('上报文案已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制文本框内容')
  } finally {
    copying.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page { padding: 32px; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}
.page-header h2 { font-size: 22px; color: #1a4a1a; }
.actions { display: flex; gap: 10px; }
.card {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.helper {
  color: #666;
  font-size: 13px;
  margin-bottom: 12px;
}
.summary {
  color: #1a4a1a;
  font-weight: 700;
  margin-bottom: 8px;
}
.summary.sub {
  color: #666;
  font-weight: 500;
  margin-bottom: 12px;
}
.detail-title {
  margin-top: 14px;
  margin-bottom: 10px;
  font-weight: 700;
  color: #1a4a1a;
}
.copy-title {
  margin-top: 20px;
}
.detail-table {
  width: 100%;
}
.pager-wrap {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
.copy-actions {
  margin-bottom: 10px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .page { padding: 12px; }
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
  .actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
  }
  .filter-bar {
    display: grid;
    grid-template-columns: 1fr;
  }
  .pager-wrap,
  .copy-actions {
    justify-content: flex-start;
  }
}
</style>
