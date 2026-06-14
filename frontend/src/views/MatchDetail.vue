<template>
  <div class="layout">
    <header class="header">
      <div class="header-left">
        <el-button text @click="router.push('/')" style="color:#fff;font-size:16px">
          ← 返回赛事列表
        </el-button>
      </div>
      <div class="header-center">
        <span class="logo">⚽ 2026 世界杯模拟竞猜</span>
      </div>
      <div class="header-right">
        <el-tag type="success" size="small">{{ userStore.user?.nickname }}</el-tag>
      </div>
    </header>

    <main class="main" v-if="match">
      <!-- 赛事信息卡 -->
      <div class="match-banner">
        <div class="team-block">
          <div class="team-name">{{ match.home_team }}</div>
          <div class="team-label">主队</div>
        </div>
        <div class="vs-block">
          <div class="vs-text">VS</div>
          <div class="match-time">{{ formatTime(match.match_time) }}</div>
          <el-tag :type="statusTagType(match.status)" size="large">{{ statusLabel(match.status) }}</el-tag>
        </div>
        <div class="team-block">
          <div class="team-name">{{ match.away_team }}</div>
          <div class="team-label">客队</div>
        </div>
      </div>

      <!-- 投注区域 -->
      <div class="bet-section">
        <div class="section-header">
          <h3>🎯 选择比分 & 填写投注金额</h3>
          <span class="hint">每个比分可独立填写金额，金额为0则不参与投注</span>
        </div>

        <div class="odds-table">
          <div class="odds-header">
            <span class="col-score">比分（主:客）</span>
            <span class="col-odds">赔率</span>
            <span class="col-amount">投注金额（元）</span>
            <span class="col-payout">预计赔付</span>
          </div>
          <div
            v-for="odd in match.odds"
            :key="odd.id"
            class="odds-row"
            :class="{ selected: betAmounts[odd.id] > 0 }"
          >
            <span class="col-score score-label">
              {{ odd.home_score }} : {{ odd.away_score }}
            </span>
            <span class="col-odds odds-value">× {{ odd.odds_value }}</span>
            <span class="col-amount">
              <el-input-number
                v-model="betAmounts[odd.id]"
                :min="0"
                :step="10"
                :precision="0"
                size="small"
                controls-position="right"
                placeholder="0"
              />
            </span>
            <span class="col-payout">
              <template v-if="betAmounts[odd.id] > 0">
                ¥{{ (betAmounts[odd.id] * odd.odds_value).toFixed(2) }}
              </template>
              <span v-else class="empty-payout">—</span>
            </span>
          </div>
        </div>

        <div v-if="match.odds.length === 0" class="no-odds">
          暂无赔率配置，请联系管理员
        </div>

        <!-- 汇总 & 提交 -->
        <div class="bet-summary" v-if="selectedItems.length > 0">
          <div class="summary-info">
            <span>已选 <strong>{{ selectedItems.length }}</strong> 个比分</span>
            <span>总投注额：<strong class="total-amount">¥{{ totalAmount.toFixed(2) }}</strong></span>
          </div>
          <el-button
            type="success"
            size="large"
            :loading="submitting"
            @click="handleSubmit"
            class="submit-btn"
          >
            确认投注
          </el-button>
        </div>
      </div>
    </main>

    <div v-else-if="loading" class="loading-wrap">
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 投注单弹窗 -->
    <el-dialog
      v-model="showSlip"
      title=""
      width="480px"
      :close-on-click-modal="false"
      class="slip-dialog"
    >
      <BetSlip :order="lastOrder" :match="match" />
      <template #footer>
        <el-button @click="showSlip = false">关闭</el-button>
        <el-button type="primary" @click="printSlip">🖨️ 打印投注单</el-button>
        <el-button type="success" @click="router.push('/my-bets')">查看我的投注</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { matchAPI, betAPI } from '../api'
import { useUserStore } from '../stores/user'
import BetSlip from '../components/BetSlip.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const match = ref(null)
const loading = ref(false)
const submitting = ref(false)
const showSlip = ref(false)
const lastOrder = ref(null)
const betAmounts = reactive({})

const selectedItems = computed(() =>
  match.value?.odds.filter(o => betAmounts[o.id] > 0) || []
)

const totalAmount = computed(() =>
  selectedItems.value.reduce((sum, o) => sum + (betAmounts[o.id] || 0), 0)
)

function statusLabel(status) {
  const map = { upcoming: '即将开赛', ongoing: '进行中', finished: '已结束', closed: '已关闭' }
  return map[status] || status
}
function statusTagType(status) {
  const map = { upcoming: 'primary', ongoing: 'warning', finished: 'info', closed: 'danger' }
  return map[status] || ''
}
function formatTime(t) {
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

async function handleSubmit() {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请至少选择一个比分并填写金额')
    return
  }
  submitting.value = true
  try {
    const items = selectedItems.value.map(o => ({
      home_score: o.home_score,
      away_score: o.away_score,
      odds_value: o.odds_value,
      amount: betAmounts[o.id]
    }))
    const result = await betAPI.placeBet({ match_id: match.value.id, items })
    lastOrder.value = result.order
    showSlip.value = true
    // 清空金额
    Object.keys(betAmounts).forEach(k => { betAmounts[k] = 0 })
    ElMessage.success('投注成功！')
  } catch (err) {
    ElMessage.error(err.error || '投注失败')
  } finally {
    submitting.value = false
  }
}

function printSlip() {
  window.print()
}

onMounted(async () => {
  loading.value = true
  try {
    const data = await matchAPI.getById(route.params.id)
    match.value = data
    data.odds.forEach(o => { betAmounts[o.id] = 0 })
  } catch {
    ElMessage.error('获取赛事详情失败')
    router.push('/')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.layout { min-height: 100vh; background: #f0f2f5; }
.header {
  background: linear-gradient(90deg, #1a4a1a, #2d7d2d);
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo { color: #fff; font-size: 18px; font-weight: 700; }

.main { max-width: 900px; margin: 28px auto; padding: 0 16px; }

.match-banner {
  background: linear-gradient(135deg, #1a4a1a, #2d7d2d);
  border-radius: 16px;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  margin-bottom: 24px;
}
.team-block { text-align: center; flex: 1; }
.team-name { font-size: 26px; font-weight: 800; }
.team-label { font-size: 13px; opacity: 0.7; margin-top: 4px; }
.vs-block { text-align: center; }
.vs-text { font-size: 28px; font-weight: 900; color: #ffd700; }
.match-time { font-size: 13px; opacity: 0.8; margin: 6px 0; }

.bet-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.section-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}
.section-header h3 { font-size: 18px; color: #1a4a1a; }
.hint { font-size: 12px; color: #999; }

.odds-table { border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
.odds-header, .odds-row {
  display: grid;
  grid-template-columns: 1fr 100px 180px 130px;
  align-items: center;
  padding: 12px 16px;
}
.odds-header {
  background: #f5f7fa;
  font-size: 13px;
  color: #666;
  font-weight: 600;
}
.odds-row {
  border-top: 1px solid #f0f0f0;
  transition: background 0.15s;
}
.odds-row.selected { background: #f0faf0; }
.score-label { font-size: 18px; font-weight: 700; color: #1a4a1a; }
.odds-value { font-size: 16px; font-weight: 600; color: #e6a020; }
.empty-payout { color: #ccc; }

.no-odds { text-align: center; color: #aaa; padding: 40px; }

.bet-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding: 16px 20px;
  background: #f0faf0;
  border-radius: 10px;
  border: 1px solid #b7e4b7;
}
.summary-info { display: flex; gap: 24px; font-size: 15px; }
.total-amount { font-size: 20px; color: #c00; }
.submit-btn {
  min-width: 140px;
  height: 44px;
  font-size: 16px;
  background: linear-gradient(90deg, #2d7d2d, #1a6b1a);
  border: none;
}
.loading-wrap { max-width: 900px; margin: 40px auto; padding: 40px; background: #fff; border-radius: 12px; }

@media print {
  .header, .match-banner, .bet-section { display: none; }
}
</style>
