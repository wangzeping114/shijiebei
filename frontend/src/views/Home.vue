<template>
  <div class="layout">
    <!-- 顶部导航 -->
    <header class="header">
      <div class="header-left">
        <span class="logo">⚽ 2026 世界杯模拟竞猜</span>
      </div>
      <div class="header-right">
        <el-tag type="success" size="small" class="user-tag">
          {{ userStore.user?.nickname }}
        </el-tag>
        <el-button
          v-if="userStore.isAdmin"
          text
          type="warning"
          class="admin-entry-btn"
          @click="goAdmin"
        >管理后台</el-button>
        <el-button text @click="router.push('/my-bets')">我的投注</el-button>
        <el-button text type="danger" @click="handleLogout">退出</el-button>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="main">
      <div class="page-title">
        <h2>赛事列表</h2>
        <el-tag>当前共 {{ matches.length }} 场赛事</el-tag>
      </div>

      <div v-if="loading" class="loading-wrap">
        <el-skeleton :rows="4" animated />
      </div>

      <div v-else>
        <!-- 分组展示 -->
        <div v-for="group in groupedMatches" :key="group.label" class="match-group">
          <div class="group-title">
            <el-tag :type="group.tagType" size="large">{{ group.label }}</el-tag>
          </div>
          <div v-if="group.items.length === 0" class="empty-group">暂无赛事</div>
          <div class="match-grid">
            <div
              v-for="match in group.items"
              :key="match.id"
              class="match-card"
              @click="goToMatch(match)"
            >
              <div v-if="match.round" class="match-round-tag">{{ match.round }}</div>
              <div class="match-teams">
                <span class="team home">{{ match.home_team }}</span>
                <span class="vs">VS</span>
                <span class="team away">{{ match.away_team }}</span>
              </div>
              <div class="match-info">
                <span class="match-time">
                  🕐 {{ formatTime(match.match_time) }}
                  <span v-if="match.venue" class="venue-inline">· 📍{{ match.venue }}</span>
                </span>
                <el-tag
                  :type="statusTagType(match.status)"
                  size="small"
                  class="status-tag"
                >
                  {{ statusLabel(match.status) }}
                </el-tag>
              </div>
              <div v-if="match.status === 'finished'" class="result-score">
                最终比分：{{ match.home_score }} : {{ match.away_score }}
              </div>
              <div v-if="match.status === 'upcoming'" class="bet-hint">
                点击进入投注 →
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <el-dialog
      v-model="winningDialogVisible"
      title="中奖提醒"
      width="520px"
      class="winning-dialog"
    >
      <div class="winning-summary">
        恭喜您近期有 {{ recentWinningOrders.length }} 笔中奖订单，中奖赔付合计
        <strong>¥{{ recentWinningTotal.toFixed(2) }}</strong>
      </div>
      <div class="winning-list">
        <div v-for="order in recentWinningOrders" :key="order.id" class="winning-item">
          <div class="winning-match">
            {{ order.home_team }} vs {{ order.away_team }}
          </div>
          <div class="winning-meta">
            <span>订单号：{{ order.order_no }}</span>
            <span>赔付：¥{{ Number(order.winning_amount || 0).toFixed(2) }}</span>
          </div>
          <div v-if="order.match_status === 'finished'" class="winning-score">
            最终比分：{{ order.result_home }} : {{ order.result_away }}
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="winningDialogVisible = false">稍后查看</el-button>
        <el-button type="success" @click="goMyBetsFromNotice">查看我的投注</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { betAPI, matchAPI } from '../api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()
const matches = ref([])
const loading = ref(false)
const recentWinningOrders = ref([])
const winningDialogVisible = ref(false)
let refreshTimer = null

const RECENT_WIN_DAYS = 7

function beijingDateKey(dateLike) {
  const s = String(dateLike)
  // 已存储的时间字符串直接截取日期部分
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // 当前时间 Date 对象仍用 Intl 获取北京日期
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(dateLike))
}

const todayKey = computed(() => beijingDateKey(new Date()))

const todayMatches = computed(() =>
  matches.value.filter(m => m.is_today || beijingDateKey(m.match_time) === todayKey.value)
)

const groupedMatches = computed(() => [
  {
    label: '今日赛程（北京时间）',
    tagType: 'success',
    items: todayMatches.value
  },
  {
    label: '进行中',
    tagType: 'warning',
    items: matches.value.filter(m => m.status === 'ongoing' && !todayMatches.value.some(t => t.id === m.id))
  },
  {
    label: '即将开赛',
    tagType: 'primary',
    items: matches.value.filter(m => m.status === 'upcoming' && !todayMatches.value.some(t => t.id === m.id))
  },
  {
    label: '已结束',
    tagType: 'info',
    items: matches.value.filter(m => m.status === 'finished' || m.status === 'closed')
  }
])

const recentWinningTotal = computed(() =>
  recentWinningOrders.value.reduce((sum, order) => sum + Number(order.winning_amount || 0), 0)
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
  if (!t) return ''
  const s = String(t).replace('T', ' ').replace(/\.\d+.*$/, '')
  return s.slice(0, 16).replace(/-/g, '/')
}

function goToMatch(match) {
  if (match.status === 'finished' || match.status === 'closed') {
    ElMessage.info('该赛事已结束，无法投注')
    return
  }
  router.push(`/match/${match.id}`)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

function goAdmin() {
  router.push('/admin')
}

function goMyBetsFromNotice() {
  winningDialogVisible.value = false
  router.push('/my-bets')
}

function parseMatchTimeMs(value) {
  if (!value) return 0
  const s = String(value).replace(' ', 'T').replace(/\.\d+.*$/, '')
  return new Date(`${s}+08:00`).getTime()
}

function winningNoticeKey() {
  const tokenTail = String(userStore.token || '').slice(-12)
  return `winningNoticeShown:${userStore.user?.id || 'guest'}:${tokenTail}`
}

function isRecentWinningOrder(order) {
  if (order.status !== 'won' || Number(order.winning_amount || 0) <= 0) return false
  const matchMs = parseMatchTimeMs(order.match_time)
  if (!matchMs) return false
  return Date.now() - matchMs <= RECENT_WIN_DAYS * 24 * 60 * 60 * 1000
}

async function checkRecentWinningNotice() {
  const noticeKey = winningNoticeKey()
  if (sessionStorage.getItem(noticeKey)) return

  try {
    const orders = await betAPI.getMyBets()
    recentWinningOrders.value = orders.filter(isRecentWinningOrder)
    if (recentWinningOrders.value.length > 0) {
      winningDialogVisible.value = true
      sessionStorage.setItem(noticeKey, '1')
    }
  } catch {
    // 中奖提醒不影响首页主流程，接口异常时保持静默。
  }
}

async function loadMatches(silent = false) {
  if (!silent) loading.value = true
  try {
    matches.value = await matchAPI.getAll()
  } catch {
    if (!silent) ElMessage.error('获取赛事失败')
  } finally {
    if (!silent) loading.value = false
  }
}

onMounted(async () => {
  await loadMatches()
  checkRecentWinningNotice()
  refreshTimer = setInterval(() => {
    loadMatches(true)
  }, 60000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  background: #f0f2f5;
}
.header {
  background: linear-gradient(90deg, #1a4a1a, #2d7d2d);
  padding: 0 32px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.logo {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
}
.user-tag { margin-right: 8px; }
.header-right .el-button { color: #fff; }
.header-right .el-button:hover { color: #ffe; }
.admin-entry-btn {
  font-weight: 700;
  border: 1px solid rgba(255, 215, 0, 0.65);
  border-radius: 6px;
  padding: 4px 10px;
}

.main {
  max-width: 1100px;
  margin: 32px auto;
  padding: 0 16px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.page-title h2 { font-size: 22px; color: #1a4a1a; }

.match-group { margin-bottom: 32px; }
.group-title { margin-bottom: 12px; }
.empty-group { color: #aaa; padding: 16px 0; text-align: center; }

.match-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.match-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}
.match-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(45,125,45,0.2);
  border-color: #2d7d2d;
}
.match-teams {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.team {
  font-size: 16px;
  font-weight: 700;
  color: #1a4a1a;
  flex: 1;
}
.team.home { text-align: left; }
.team.away { text-align: right; }
.vs {
  font-size: 14px;
  font-weight: 900;
  color: #e6a020;
  margin: 0 12px;
  background: #fff8e8;
  padding: 4px 10px;
  border-radius: 6px;
}
.match-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #888;
}
.result-score {
  margin-top: 10px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #c00;
  background: #fff5f5;
  border-radius: 8px;
  padding: 6px;
}
.bet-hint {
  margin-top: 10px;
  text-align: right;
  font-size: 12px;
  color: #2d7d2d;
  font-weight: 600;
}
.match-round-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #2d7d2d;
  background: #e8f5e8;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.match-time { font-size: 12px; color: #888; }
.venue-inline { color: #aaa; font-size: 11px; }
.loading-wrap { padding: 40px; background: #fff; border-radius: 12px; }

.winning-summary {
  color: #333;
  line-height: 1.7;
  margin-bottom: 14px;
}
.winning-summary strong {
  color: #c00;
  font-size: 18px;
}
.winning-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
}
.winning-item {
  border: 1px solid #d9ecc8;
  background: #f7fff3;
  border-radius: 8px;
  padding: 12px;
}
.winning-match {
  font-weight: 700;
  color: #1a4a1a;
  margin-bottom: 6px;
}
.winning-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #666;
  font-size: 13px;
  flex-wrap: wrap;
}
.winning-score {
  margin-top: 6px;
  color: #c00;
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 768px) {
  .header {
    height: auto;
    min-height: 56px;
    padding: 10px 12px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .logo {
    font-size: 16px;
    letter-spacing: 0;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .main {
    margin: 14px auto;
    padding: 0 10px;
  }
  .page-title {
    margin-bottom: 14px;
    justify-content: space-between;
  }
  .page-title h2 {
    font-size: 20px;
  }
  .match-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .match-card {
    padding: 14px;
  }
  .team {
    font-size: 18px;
  }
  .match-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .result-score {
    font-size: 16px;
  }
}

@media (max-width: 390px) {
  .header {
    padding: 8px;
  }
  .logo {
    font-size: 14px;
  }
  .header-right {
    gap: 4px;
  }
  .main {
    padding: 0 8px;
  }
  .match-card {
    padding: 12px;
  }
  .team {
    font-size: 16px;
  }
  .vs {
    margin: 0 6px;
    padding: 3px 8px;
  }
}
</style>
