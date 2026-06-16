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
            <span v-if="canOperateOrder(order)" class="editable-tip">可修改/删除投注项</span>
            <span v-else class="locked-tip">已锁定</span>
          </div>

          <!-- 投注明细 -->
          <div class="items-table">
            <div class="items-header">
              <span>比分（主:客）</span>
              <span>赔率</span>
              <span>投注金额</span>
              <span>结果</span>
              <span>操作</span>
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
              <span class="item-actions">
                <el-button
                  size="small"
                  :disabled="!canOperateOrder(order)"
                  @click="openEditDialog(order, item)"
                >编辑比分</el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="!canOperateOrder(order)"
                  @click="handleDeleteItem(order, item)"
                >删错</el-button>
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

    <el-dialog
      v-model="editVisible"
      title="编辑投注比分"
      width="420px"
      :close-on-click-modal="false"
    >
      <div class="edit-form" v-loading="editLoading">
        <div class="edit-row">
          <span class="edit-label">目标比分</span>
          <el-select v-model="editForm.oddId" placeholder="请选择比分" style="width: 100%">
            <el-option
              v-for="odd in editOddsOptions"
              :key="odd.id"
              :label="`${odd.home_score} : ${odd.away_score}（×${Number(odd.odds_value).toFixed(2)}）`"
              :value="odd.id"
            />
          </el-select>
        </div>
        <div class="edit-row">
          <span class="edit-label">投注金额</span>
          <el-input-number
            v-model="editForm.amount"
            :min="1"
            :step="10"
            :precision="0"
            controls-position="right"
            style="width: 100%"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingEdit" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { betAPI, matchAPI } from '../api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()
const orders = ref([])
const loading = ref(false)
const nowMs = ref(Date.now())
let clockTimer = null

const editVisible = ref(false)
const editLoading = ref(false)
const savingEdit = ref(false)
const editingOrder = ref(null)
const editingItem = ref(null)
const editOddsOptions = ref([])
const editForm = ref({ oddId: null, amount: 10 })

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
  const s = String(t).replace('T', ' ').replace(/\.\d+.*$/, '')
  return s.slice(0, 19).replace(/-/g, '/')
}

function hasStarted(order) {
  if (!order.match_time) return false
  // 存储的是北京时间字符串，补 +08:00 后与当前 UTC 时间比较
  const s = String(order.match_time).replace(' ', 'T').replace(/\.\d+.*$/, '')
  return nowMs.value >= new Date(s + '+08:00').getTime()
}

function canOperateOrder(order) {
  if (order.status !== 'pending') return false
  if (['closed', 'finished'].includes(order.match_status)) return false
  if (hasStarted(order)) return false
  return true
}

async function loadOrders() {
  loading.value = true
  try {
    orders.value = await betAPI.getMyBets()
  } catch {
    ElMessage.error('获取投注记录失败')
  } finally {
    loading.value = false
  }
}

async function openEditDialog(order, item) {
  if (!canOperateOrder(order)) {
    ElMessage.warning('管理员已关闭接单或比赛已开始，当前不可编辑')
    return
  }

  editingOrder.value = order
  editingItem.value = item
  editVisible.value = true
  editLoading.value = true
  try {
    const match = await matchAPI.getById(order.match_id)
    editOddsOptions.value = match.odds || []
    const current = editOddsOptions.value.find(o => o.home_score === item.home_score && o.away_score === item.away_score)
    editForm.value = {
      oddId: current?.id || editOddsOptions.value[0]?.id || null,
      amount: Number(item.amount)
    }
  } catch {
    ElMessage.error('加载赔率失败')
    editVisible.value = false
  } finally {
    editLoading.value = false
  }
}

async function handleSaveEdit() {
  const order = editingOrder.value
  const item = editingItem.value
  if (!order || !item) return
  if (!canOperateOrder(order)) {
    ElMessage.warning('管理员已关闭接单或比赛已开始，当前不可编辑')
    return
  }

  const target = editOddsOptions.value.find(o => o.id === editForm.value.oddId)
  if (!target) {
    ElMessage.warning('请选择目标比分')
    return
  }
  if (Number(editForm.value.amount) <= 0) {
    ElMessage.warning('投注金额必须大于0')
    return
  }

  savingEdit.value = true
  try {
    await betAPI.updateBetItem(item.id, {
      home_score: target.home_score,
      away_score: target.away_score,
      amount: Number(editForm.value.amount)
    })
    ElMessage.success('投注项已更新')
    editVisible.value = false
    await loadOrders()
  } catch (err) {
    ElMessage.error(err.error || '更新失败')
  } finally {
    savingEdit.value = false
  }
}

async function handleDeleteItem(order, item) {
  if (!canOperateOrder(order)) {
    ElMessage.warning('管理员已关闭接单或比赛已开始，当前不可删除')
    return
  }

  await ElMessageBox.confirm(
    `确认删除投注项 ${item.home_score}:${item.away_score} 吗？`,
    '删除投注项',
    { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
  )

  try {
    await betAPI.deleteBetItem(item.id)
    ElMessage.success('已删除该投注项')
    await loadOrders()
  } catch (err) {
    ElMessage.error(err.error || '删除失败')
  }
}

onMounted(async () => {
  await loadOrders()
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
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
.editable-tip {
  font-size: 12px;
  color: #2d7d2d;
  background: #f0faf0;
  padding: 2px 8px;
  border-radius: 4px;
}
.locked-tip {
  font-size: 12px;
  color: #999;
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
}

.items-table { border: 1px solid #f0f0f0; border-radius: 8px; overflow-x: auto; overflow-y: hidden; }
.items-header, .item-row {
  display: grid;
  grid-template-columns: 1fr 100px 120px 160px 180px;
  padding: 10px 14px;
  align-items: center;
  min-width: 720px;
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
.item-actions { display: flex; gap: 8px; justify-content: flex-end; }

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

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.edit-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.edit-label {
  font-size: 13px;
  color: #666;
}

@media (max-width: 768px) {
  .header {
    height: auto;
    min-height: 52px;
    padding: 8px 10px;
    gap: 6px;
  }
  .logo {
    font-size: 15px;
  }
  .main {
    margin: 12px auto;
    padding: 0 10px;
  }
  .page-title {
    margin-bottom: 14px;
    justify-content: space-between;
  }
  .page-title h2 {
    font-size: 20px;
  }
  .order-card {
    padding: 12px;
  }
  .order-header {
    align-items: flex-start;
    gap: 8px;
    flex-direction: column;
  }
  .match-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .items-header, .item-row {
    min-width: 680px;
  }
  .order-footer {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 390px) {
  .header {
    padding: 8px;
  }
  .logo {
    font-size: 14px;
  }
  .main {
    padding: 0 8px;
  }
  .order-card {
    padding: 10px;
    border-radius: 10px;
  }
  .order-no {
    font-size: 12px;
  }
  .match-info {
    font-size: 14px;
  }
}
</style>
