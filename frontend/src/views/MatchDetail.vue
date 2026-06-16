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
        <el-button v-if="userStore.isAdmin" text class="admin-entry-btn" @click="router.push('/admin')">
          管理后台
        </el-button>
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
          <div v-if="match.round" class="round-label">{{ match.round }}</div>
          <div class="match-time">{{ formatTime(match.match_time) }}</div>
          <div v-if="match.venue" class="venue-label">📍 {{ match.venue }}</div>
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
          <span class="hint">每个比分可独立填写金额，金额为0则不参与投注；赔率为0表示未开盘</span>
          <span v-if="userStore.isAdmin" class="hint admin-hint">管理员可点击比分进入赔率编辑页</span>
        </div>

        <div v-if="isBetLocked" class="bet-locked-tip">
          {{ lockReason }}，当前页面已锁定，无法进行投注相关操作
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
            :class="{ selected: betAmounts[odd.id] > 0, disabled: Number(odd.odds_value) <= 0 }"
          >
            <span
              class="col-score score-label"
              :class="{ 'score-editable': userStore.isAdmin }"
              @click="goToOddsConfig"
            >
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
                :disabled="isBetLocked || Number(odd.odds_value) <= 0"
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

        <!-- 市场盘口 -->
        <template v-if="match.market_odds && match.market_odds.length > 0">
          <div class="section-header" style="margin-top:24px">
            <h3>🎲 市场盘口投注</h3>
            <span class="hint">独赢/让球/大小盘口；赔率为0表示未开盘</span>
          </div>
          <template v-for="(group, mType) in marketOddsGrouped" :key="mType">
            <div class="market-type-header">{{ mType }}</div>
            <div class="odds-table">
              <div class="odds-header">
                <span class="col-score">选项</span>
                <span class="col-odds">赔率</span>
                <span class="col-amount">投注金额（元）</span>
                <span class="col-payout">预计赔付</span>
              </div>
              <div
                v-for="mo in group"
                :key="`mo-${mo.id}`"
                class="odds-row"
                :class="{ selected: marketAmounts[mo.id] > 0, disabled: Number(mo.odds_value) <= 0 }"
              >
                <span class="col-score score-label">{{ mo.selection }}</span>
                <span class="col-odds odds-value">× {{ mo.odds_value }}</span>
                <span class="col-amount">
                  <el-input-number
                    v-model="marketAmounts[mo.id]"
                    :min="0"
                    :step="10"
                    :precision="0"
                    size="small"
                    controls-position="right"
                    placeholder="0"
                    :disabled="isBetLocked || Number(mo.odds_value) <= 0"
                  />
                </span>
                <span class="col-payout">
                  <template v-if="marketAmounts[mo.id] > 0">
                    ¥{{ (marketAmounts[mo.id] * mo.odds_value).toFixed(2) }}
                  </template>
                  <span v-else class="empty-payout">—</span>
                </span>
              </div>
            </div>
          </template>
        </template>

        <div v-if="selectedItems.length > 0" class="selected-panel">
          <div class="selected-title">🧾 已选投注比分（支持修改/删除）</div>
          <div class="selected-list">
            <div v-for="odd in selectedItems" :key="`selected-${odd.id}`" class="selected-item">
              <div class="selected-score-line">
                <span class="selected-team">{{ match?.home_team }}</span>
                <span class="selected-score">{{ odd.home_score }} : {{ odd.away_score }}</span>
                <span class="selected-team">{{ match?.away_team }}</span>
              </div>
              <span class="selected-meta">赔率 × {{ Number(odd.odds_value).toFixed(2) }}</span>
              <span class="selected-meta">金额 ¥{{ Number(betAmounts[odd.id] || 0).toFixed(2) }}</span>
              <span class="selected-meta payout">赔付 ¥{{ (Number(betAmounts[odd.id] || 0) * Number(odd.odds_value)).toFixed(2) }}</span>
              <div class="selected-actions">
                <el-button size="small" :disabled="isBetLocked" @click="openEditSelected(odd)">修改</el-button>
                <el-button size="small" type="danger" plain :disabled="isBetLocked" @click="removeSelected(odd.id)">删除</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 汇总 & 提交 -->
        <div class="bet-summary" v-if="selectedItems.length > 0 || selectedMarketItems.length > 0">
          <div class="summary-info">
            <span>已选 <strong>{{ selectedItems.length + selectedMarketItems.length }}</strong> 个投注项</span>
            <span>总投注额：<strong class="total-amount">¥{{ totalAmount.toFixed(2) }}</strong></span>
          </div>
          <el-button
            type="success"
            size="large"
            :loading="submitting"
            :disabled="isBetLocked"
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

    <el-dialog
      v-model="editDialogVisible"
      title="修改投注比分"
      width="420px"
      :close-on-click-modal="false"
      class="edit-bet-dialog"
    >
      <div class="edit-form">
        <div class="edit-row">
          <span class="edit-label">目标比分</span>
          <el-select v-model="editForm.targetOddId" placeholder="请选择比分" style="width: 100%">
            <el-option
              v-for="odd in match?.odds || []"
              :key="odd.id"
              :label="`${odd.home_score} : ${odd.away_score}（× ${Number(odd.odds_value).toFixed(2)}）`"
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
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditSelected">保存修改</el-button>
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
const marketAmounts = reactive({})
const editDialogVisible = ref(false)
const editingOddId = ref(null)
const editForm = reactive({ targetOddId: null, amount: 10 })

const selectedItems = computed(() =>
  match.value?.odds.filter(o => betAmounts[o.id] > 0) || []
)

const selectedMarketItems = computed(() =>
  (match.value?.market_odds || []).filter(o => marketAmounts[o.id] > 0)
)

const marketOddsGrouped = computed(() => {
  const groups = {}
  for (const mo of (match.value?.market_odds || [])) {
    if (!groups[mo.market_type]) groups[mo.market_type] = []
    groups[mo.market_type].push(mo)
  }
  return groups
})

const isBetLocked = computed(() =>
  ['closed', 'finished'].includes(match.value?.status)
)

const lockReason = computed(() =>
  match.value?.status === 'closed' ? '管理员已关闭接单' : '赛事已结束'
)

const totalAmount = computed(() =>
  selectedItems.value.reduce((sum, o) => sum + (betAmounts[o.id] || 0), 0) +
  selectedMarketItems.value.reduce((sum, o) => sum + (marketAmounts[o.id] || 0), 0)
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

async function handleSubmit() {
  if (isBetLocked.value) {
    ElMessage.warning('当前赛事不可投注')
    return
  }
  if (selectedItems.value.length === 0 && selectedMarketItems.value.length === 0) {
    ElMessage.warning('请至少选择一个投注项并填写金额')
    return
  }
  submitting.value = true
  try {
    const items = selectedItems.value.map(o => ({
      home_score: o.home_score,
      away_score: o.away_score,
      odds_value: o.odds_value,
      amount: Math.round(betAmounts[o.id])
    }))
    const market_items = selectedMarketItems.value.map(o => ({
      market_odds_id: o.id,
      amount: Math.round(marketAmounts[o.id])
    }))
    const result = await betAPI.placeBet({ match_id: match.value.id, items, market_items })
    lastOrder.value = result.order
    showSlip.value = true
    Object.keys(betAmounts).forEach(k => { betAmounts[k] = 0 })
    Object.keys(marketAmounts).forEach(k => { marketAmounts[k] = 0 })
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

function goToOddsConfig() {
  if (!userStore.isAdmin || !match.value?.id || isBetLocked.value) return
  router.push(`/admin/odds/${match.value.id}`)
}

function openEditSelected(odd) {
  if (isBetLocked.value) {
    ElMessage.warning('当前赛事已锁定，无法修改')
    return
  }
  editingOddId.value = odd.id
  editForm.targetOddId = odd.id
  editForm.amount = Number(betAmounts[odd.id] || 0)
  editDialogVisible.value = true
}

function removeSelected(oddId) {
  if (isBetLocked.value) {
    ElMessage.warning('当前赛事已锁定，无法删除')
    return
  }
  betAmounts[oddId] = 0
  ElMessage.success('已删除该投注比分')
}

function saveEditSelected() {
  if (isBetLocked.value) {
    ElMessage.warning('当前赛事已锁定，无法修改')
    return
  }
  if (!editingOddId.value) {
    ElMessage.warning('未找到要修改的投注项')
    return
  }
  if (!editForm.targetOddId) {
    ElMessage.warning('请选择目标比分')
    return
  }
  if (Number(editForm.amount) <= 0) {
    ElMessage.warning('投注金额必须大于0')
    return
  }

  const sourceId = editingOddId.value
  const targetId = editForm.targetOddId
  const targetOdd = match.value?.odds?.find(o => o.id === targetId)
  if (!targetOdd || Number(targetOdd.odds_value) <= 0) {
    ElMessage.warning('目标比分赔率未开盘，无法修改到该比分')
    return
  }
  const targetAlreadyHasAmount = targetId !== sourceId && Number(betAmounts[targetId] || 0) > 0

  betAmounts[sourceId] = 0
  betAmounts[targetId] = Math.round(Number(editForm.amount))

  editDialogVisible.value = false
  editingOddId.value = null

  if (targetAlreadyHasAmount) {
    ElMessage.success('目标比分原有金额已被新金额覆盖')
    return
  }
  ElMessage.success('投注比分修改成功')
}

onMounted(async () => {
  loading.value = true
  try {
    const data = await matchAPI.getById(route.params.id)
    match.value = data
    data.odds.forEach(o => { betAmounts[o.id] = 0 })
    ;(data.market_odds || []).forEach(o => { marketAmounts[o.id] = 0 })
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
.admin-entry-btn {
  color: #ffd700;
  font-weight: 700;
  margin-right: 8px;
  border: 1px solid rgba(255, 215, 0, 0.65);
  border-radius: 6px;
  padding: 4px 10px;
}

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
.round-label { font-size: 12px; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.15); padding: 2px 10px; border-radius: 10px; margin: 4px 0; }
.match-time { font-size: 13px; opacity: 0.8; margin: 6px 0; }
.venue-label { font-size: 12px; opacity: 0.75; margin-top: 2px; }

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
.admin-hint { color: #1a6b1a; font-weight: 600; }

.odds-table { border: 1px solid #eee; border-radius: 8px; overflow-x: auto; overflow-y: hidden; }
.odds-header, .odds-row {
  display: grid;
  grid-template-columns: 1fr 100px 180px 130px;
  align-items: center;
  padding: 12px 16px;
  min-width: 620px;
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
.odds-row.disabled { background: #fafafa; }
.col-score,
.col-odds,
.score-label,
.odds-value {
  white-space: nowrap;
}
.score-label { font-size: 18px; font-weight: 700; color: #1a4a1a; }
.score-editable { cursor: pointer; text-decoration: underline; text-decoration-style: dashed; }
.score-editable:hover { color: #2d7d2d; }
.odds-value { font-size: 16px; font-weight: 600; color: #e6a020; }
.empty-payout { color: #ccc; }

.no-odds { text-align: center; color: #aaa; padding: 40px; }

.bet-locked-tip {
  margin-bottom: 14px;
  background: #fff4e5;
  color: #ad6800;
  border: 1px solid #ffd591;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
}

.selected-panel {
  margin-top: 18px;
  background: #fafdf7;
  border: 1px solid #d9ecc8;
  border-radius: 10px;
  padding: 14px;
}
.selected-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a4a1a;
  margin-bottom: 10px;
}
.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selected-item {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 110px 130px 130px auto;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #edf3e8;
}
.selected-score-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.selected-team {
  font-size: 13px;
  color: #456;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.selected-score {
  font-size: 16px;
  font-weight: 700;
  color: #1a4a1a;
  white-space: nowrap;
}
.selected-meta {
  font-size: 13px;
  color: #666;
}
.selected-meta.payout {
  font-weight: 700;
  color: #2d7d2d;
}
.selected-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

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
  .header-left .el-button {
    font-size: 13px !important;
  }
  .logo {
    font-size: 15px;
  }
  .main {
    margin: 12px auto;
    padding: 0 10px;
  }
  .match-banner {
    padding: 16px 12px;
    border-radius: 12px;
    gap: 8px;
  }
  .team-name {
    font-size: 26px;
    line-height: 1.05;
  }
  .team-label,
  .match-time,
  .venue-label,
  .round-label {
    font-size: 11px;
  }
  .vs-text {
    font-size: 20px;
  }
  .bet-section {
    padding: 14px 10px;
    border-radius: 12px;
  }
  .section-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }
  .section-header h3 {
    font-size: 16px;
  }
  .hint {
    font-size: 12px;
  }
  .odds-table {
    overflow: hidden;
  }
  .odds-header, .odds-row {
    min-width: 0;
    padding: 10px;
    grid-template-columns: 86px 74px minmax(130px, 1fr);
  }
  .col-payout {
    display: none;
  }
  .score-label {
    font-size: 16px;
    line-height: 1;
  }
  .odds-value {
    font-size: 14px;
  }
  .selected-item {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px;
  }
  .selected-actions {
    justify-content: flex-start;
  }
  .summary-info {
    gap: 8px;
    flex-direction: column;
    align-items: flex-start;
    font-size: 14px;
  }
  .total-amount {
    font-size: 18px;
  }
  .bet-summary {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .submit-btn {
    width: 100%;
  }

  :deep(.edit-bet-dialog) {
    width: calc(100vw - 16px) !important;
    margin: 8px auto 0 !important;
    border-radius: 14px;
  }
  :deep(.edit-bet-dialog .el-dialog__header) {
    padding: 14px 14px 8px;
  }
  :deep(.edit-bet-dialog .el-dialog__title) {
    font-size: 18px;
    font-weight: 700;
  }
  :deep(.edit-bet-dialog .el-dialog__body) {
    padding: 10px 14px 12px;
  }
  :deep(.edit-bet-dialog .el-dialog__footer) {
    padding: 10px 14px calc(12px + env(safe-area-inset-bottom));
    display: flex;
    gap: 10px;
  }
  :deep(.edit-bet-dialog .el-dialog__footer .el-button) {
    flex: 1;
    min-width: 0;
    margin-left: 0 !important;
    height: 42px;
  }

  :deep(.slip-dialog) {
    width: calc(100vw - 16px) !important;
    margin: 8px auto 0 !important;
    border-radius: 14px;
  }
  :deep(.slip-dialog .el-dialog__body) {
    padding: 10px 10px 8px;
  }
  :deep(.slip-dialog .el-dialog__footer) {
    padding: 10px 10px calc(12px + env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  :deep(.slip-dialog .el-dialog__footer .el-button) {
    width: 100%;
    margin-left: 0 !important;
    height: 42px;
  }
}

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

.market-type-header {
  background: #f0f5f0;
  padding: 6px 14px;
  font-weight: 700;
  color: #2d7d2d;
  border-radius: 6px;
  margin: 14px 0 6px;
  font-size: 13px;
}

@media print {
  .header, .match-banner, .bet-section { display: none; }
}
</style>
