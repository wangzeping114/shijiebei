<template>
  <div class="layout">
    <header class="header">
      <div>
        <el-button text @click="router.push('/')" style="color:#fff">← 返回赛事列表</el-button>
      </div>
      <span class="logo">⚽ 2026 世界杯模拟竞猜</span>
      <el-tag type="success" size="small">{{ userStore.user?.nickname }}</el-tag>
    </header>

    <main class="main">
      <div class="page-title">
        <h2>📋 我的投注记录</h2>
        <el-tag>共 {{ orders.length }} 笔订单</el-tag>
      </div>

      <div v-if="loading" class="loading-wrap"><el-skeleton :rows="5" animated /></div>

      <div v-else-if="orders.length === 0" class="empty-state">
        <el-empty description="暂无投注记录">
          <el-button type="primary" @click="router.push('/')">去投注</el-button>
        </el-empty>
      </div>

      <div v-else class="orders-list">
        <div v-for="order in orders" :key="order.id" class="order-card">
          <!-- 订单头部 -->
          <div class="order-header">
            <div class="order-meta">
              <span class="order-no">订单号：{{ order.order_no }}</span>
              <span class="order-time">{{ formatDateTime(order.created_at) }}</span>
            </div>
            <el-tag :type="orderTagType(order.status)" size="large">
              {{ orderLabel(order.status) }}
            </el-tag>
          </div>

          <!-- 赛事信息 -->
          <div class="match-info">
            ⚽ {{ order.home_team }} vs {{ order.away_team }}
            <span v-if="order.match_status === 'finished'" class="result">
              最终比分：{{ order.result_home }} : {{ order.result_away }}
            </span>
          </div>

          <!-- 投注明细 -->
          <div class="items-table">
            <div class="items-header">
              <span>比分（主:客）</span>
              <span>赔率</span>
              <span>投注金额</span>
              <span>结果</span>
            </div>
            <div
              v-for="item in order.items"
              :key="item.id"
              class="item-row"
              :class="{ winner: item.is_winner }"
            >
              <span class="score">{{ item.home_score }} : {{ item.away_score }}</span>
              <span>× {{ Number(item.odds_value).toFixed(2) }}</span>
              <span>¥{{ Number(item.amount).toFixed(2) }}</span>
              <span>
                <el-tag v-if="item.is_winner" type="success" size="small">中奖 +¥{{ (Number(item.amount) * Number(item.odds_value)).toFixed(2) }}</el-tag>
                <el-tag v-else-if="order.match_status === 'finished'" type="info" size="small">未中奖</el-tag>
                <el-tag v-else type="warning" size="small">待开奖</el-tag>
              </span>
            </div>
          </div>

          <!-- 订单汇总 -->
          <div class="order-footer">
            <span>总投注：<strong>¥{{ Number(order.total_amount).toFixed(2) }}</strong></span>
            <span v-if="order.winning_amount > 0" class="win-amount">
              中奖赔付：<strong>¥{{ order.winning_amount.toFixed(2) }}</strong>
            </span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { betAPI } from '../api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()
const orders = ref([])
const loading = ref(false)

function orderLabel(status) {
  const map = { pending: '待开奖', won: '已中奖', lost: '未中奖', settled: '已结算' }
  return map[status] || status
}
function orderTagType(status) {
  const map = { pending: 'warning', won: 'success', lost: 'info', settled: '' }
  return map[status] || ''
}
function formatDateTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

onMounted(async () => {
  loading.value = true
  try {
    orders.value = await betAPI.getMyBets()
  } catch {
    ElMessage.error('获取投注记录失败')
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
.page-title { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.page-title h2 { font-size: 22px; color: #1a4a1a; }
.loading-wrap { background: #fff; border-radius: 12px; padding: 40px; }

.orders-list { display: flex; flex-direction: column; gap: 16px; }
.order-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
}
.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.order-meta { display: flex; flex-direction: column; gap: 2px; }
.order-no { font-family: monospace; font-size: 13px; color: #666; }
.order-time { font-size: 12px; color: #aaa; }

.match-info {
  font-size: 15px;
  font-weight: 600;
  color: #1a4a1a;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.result { font-size: 14px; color: #c00; background: #fff5f5; padding: 2px 8px; border-radius: 4px; }

.items-table { border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; }
.items-header, .item-row {
  display: grid;
  grid-template-columns: 1fr 100px 120px 200px;
  padding: 10px 14px;
  align-items: center;
}
.items-header {
  background: #f5f7fa;
  font-size: 12px;
  color: #888;
  font-weight: 600;
}
.item-row { border-top: 1px solid #f5f5f5; font-size: 14px; }
.item-row.winner { background: #f0faf0; }
.score { font-weight: 700; font-size: 16px; color: #1a4a1a; }

.order-footer {
  display: flex;
  gap: 24px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 14px;
  color: #666;
}
.win-amount strong { color: #2d7d2d; font-size: 16px; }
</style>
