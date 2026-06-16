<template>
  <div class="slip-wrap" ref="slipRef">
    <div class="slip">
      <div class="slip-border top"></div>
      <div class="slip-header">
        <div class="slip-title">⚽ 2026 世界杯模拟竞猜投注单</div>
        <div class="slip-subtitle">仅供线下门店内部模拟使用</div>
      </div>
      <div class="slip-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

      <div class="slip-field">
        <span class="label">赛　事：</span>
        <span class="value bold">{{ match?.home_team }} vs {{ match?.away_team }}</span>
      </div>
      <div class="slip-field">
        <span class="label">玩　法：</span>
        <span class="value">{{ betTypes }}</span>
      </div>
      <div class="slip-field">
        <span class="label">开赛时间：</span>
        <span class="value">{{ formatTime(match?.match_time) }}</span>
      </div>

      <div class="slip-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

      <div class="items-header">
        <span class="ic-label">投注项</span>
        <span class="ic-odds">赔率</span>
        <span class="ic-amount">投注金额</span>
      </div>
      <div class="slip-divider thin">- - - - - - - - - - - - - - - - - - - - - -</div>

      <div v-for="item in order?.items" :key="item.id" class="bet-item">
        <span class="ic-label">
          <template v-if="item.bet_type === 'market' || item.market_label">{{ item.market_label }}</template>
          <template v-else>{{ item.home_score }} : {{ item.away_score }}</template>
        </span>
        <span class="ic-odds">× {{ Number(item.odds_value).toFixed(2) }}</span>
        <span class="ic-amount">¥{{ Number(item.amount).toFixed(2) }}</span>
      </div>

      <div class="slip-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

      <div class="slip-field total-line">
        <span class="label">订单总投注额：</span>
        <span class="value total-amount">¥{{ Number(order?.total_amount).toFixed(2) }}</span>
      </div>
      <div class="slip-field">
        <span class="label">订单编号：</span>
        <span class="value mono">{{ order?.order_no }}</span>
      </div>
      <div class="slip-field">
        <span class="label">投注时间：</span>
        <span class="value">{{ formatDateTime(order?.created_at) }}</span>
      </div>

      <div class="slip-divider bottom-div">━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="slip-footer">中奖请凭此单到门店窗口兑奖</div>
      <div class="slip-border bottom"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  order: Object,
  match: Object
})

const betTypes = computed(() => {
  if (!props.order?.items) return '—'
  const hasScore = props.order.items.some(i => i.bet_type !== 'market' && !i.market_label)
  const hasMarket = props.order.items.some(i => i.bet_type === 'market' || i.market_label)
  if (hasScore && hasMarket) return '比分 + 市场盘口'
  if (hasMarket) return '市场盘口'
  return '全场固定比分'
})

function formatTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ').replace(/\.\d+.*$/, '')
  return s.slice(0, 16).replace(/-/g, '/')
}

function formatDateTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ').replace(/\.\d+.*$/, '')
  return s.slice(0, 19).replace(/-/g, '/')
}
</script>

<style scoped>
.slip-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.slip {
  width: min(360px, 100%);
  background: #fffdf5;
  border: 1px dashed #c8b560;
  border-radius: 4px;
  padding: 16px 20px;
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 14px;
  color: #1a1a1a;
  line-height: 1.8;
}
.slip-border.top {
  height: 6px;
  background: repeating-linear-gradient(90deg, #2d7d2d 0 8px, transparent 8px 14px);
  margin-bottom: 14px;
  border-radius: 2px;
}
.slip-border.bottom {
  height: 6px;
  background: repeating-linear-gradient(90deg, #2d7d2d 0 8px, transparent 8px 14px);
  margin-top: 14px;
  border-radius: 2px;
}
.slip-header { text-align: center; margin-bottom: 6px; }
.slip-title { font-size: 15px; font-weight: 800; color: #1a4a1a; letter-spacing: 1px; }
.slip-subtitle { font-size: 11px; color: #999; }
.slip-divider {
  color: #bbb;
  font-size: 12px;
  text-align: center;
  margin: 6px 0;
  letter-spacing: 1px;
}
.slip-divider.thin { color: #ddd; }
.slip-field {
  display: flex;
  align-items: baseline;
  margin: 4px 0;
}
.label { color: #666; min-width: 90px; flex-shrink: 0; }
.value { color: #111; }
.value.bold { font-weight: 700; }
.value.mono { font-family: monospace; font-size: 12px; color: #555; }
.total-line { margin-top: 8px; }
.total-amount { font-size: 18px; font-weight: 900; color: #c00; }

.items-header {
  display: grid;
  grid-template-columns: 1fr 90px 100px;
  gap: 8px;
  font-size: 12px;
  color: #888;
  margin: 4px 0;
}
.bet-item {
  display: grid;
  grid-template-columns: 1fr 90px 100px;
  gap: 8px;
  align-items: center;
  margin: 2px 0;
  font-weight: 600;
}
.ic-label { font-size: 14px; color: #1a4a1a; word-break: break-all; }
.ic-odds { color: #c47900; }
.ic-amount { color: #333; text-align: right; }

.bottom-div { margin-top: 10px; }
.slip-footer { text-align: center; font-size: 11px; color: #aaa; margin-top: 4px; }

@media (max-width: 768px) {
  .slip-wrap {
    padding: 4px 0;
  }
  .slip {
    width: 100%;
    padding: 12px 12px;
    font-size: 13px;
    line-height: 1.65;
  }
  .slip-title {
    font-size: 14px;
    letter-spacing: 0;
  }
  .label {
    min-width: 78px;
  }
  .items-header,
  .bet-item {
    grid-template-columns: 1fr 78px 88px;
    gap: 6px;
  }
  .ic-label {
    font-size: 13px;
  }
}
</style>
