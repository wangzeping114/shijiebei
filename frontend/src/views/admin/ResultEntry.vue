<template>
  <div class="page">
    <div class="page-header">
      <h2>📝 比分录入 & 自动结算</h2>
    </div>

    <div class="card" v-loading="loading">
      <div class="filter-bar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="筛选球队名称"
          style="width: 260px"
        />
        <el-select v-model="statusFilter" style="width: 160px">
          <el-option label="全部状态" value="all" />
          <el-option label="即将开赛" value="upcoming" />
          <el-option label="进行中" value="ongoing" />
          <el-option label="已关闭" value="closed" />
        </el-select>
      </div>

      <el-empty v-if="filteredMatches.length === 0" description="暂无待录入的赛事" />

      <div v-for="match in pagedMatches" :key="match.id" class="match-item">
        <div class="match-info">
          <div class="teams">
            <strong>{{ match.home_team }}</strong>
            <span class="vs">VS</span>
            <strong>{{ match.away_team }}</strong>
          </div>
          <div class="meta">
            <el-tag :type="statusTagType(match.status)">{{ statusLabel(match.status) }}</el-tag>
            <span class="time">{{ formatTime(match.match_time) }}</span>
          </div>
        </div>

        <div class="result-area">
          <template v-if="match.status === 'finished'">
            <div class="final-score">
              最终比分：<span class="score">{{ match.home_score }} : {{ match.away_score }}</span>
            </div>
            <el-tag type="success">已结算</el-tag>
          </template>
          <template v-else>
            <div class="input-section">
              <!-- 上半场比分 -->
              <div class="input-block">
                <span class="block-label">上半场：</span>
                <div class="input-area">
                  <span class="team-label">{{ match.home_team }}</span>
                  <el-input-number
                    v-model="resultForms[match.id].htHome"
                    :min="0"
                    :max="20"
                    size="small"
                    controls-position="right"
                    style="width:90px"
                  />
                  <span class="colon">:</span>
                  <el-input-number
                    v-model="resultForms[match.id].htAway"
                    :min="0"
                    :max="20"
                    size="small"
                    controls-position="right"
                    style="width:90px"
                  />
                  <span class="team-label">{{ match.away_team }}</span>
                  <el-button
                    size="small"
                    type="info"
                    :loading="htSubmitting[match.id]"
                    :disabled="resultForms[match.id].htDone"
                    @click="handleHtSubmit(match)"
                  >
                    {{ resultForms[match.id].htDone ? '✓ 上半场已录入' : '录入上半场' }}
                  </el-button>
                </div>
              </div>
              <!-- 全场比分 -->
              <div class="input-block">
                <span class="block-label">全场：</span>
                <div class="input-area">
                  <span class="team-label">{{ match.home_team }}</span>
                  <el-input-number
                    v-model="resultForms[match.id].home"
                    :min="0"
                    :max="20"
                    size="small"
                    controls-position="right"
                    style="width:90px"
                  />
                  <span class="colon">:</span>
                  <el-input-number
                    v-model="resultForms[match.id].away"
                    :min="0"
                    :max="20"
                    size="small"
                    controls-position="right"
                    style="width:90px"
                  />
                  <span class="team-label">{{ match.away_team }}</span>
                  <el-button
                    type="primary"
                    size="small"
                    :loading="submitting[match.id]"
                    @click="handleSubmit(match)"
                  >
                    确认录入 & 自动结算
                  </el-button>
                </div>
              </div>
              <!-- 角球数（选填，用于结算角球盘口） -->
              <div class="input-block">
                <span class="block-label" style="color:#888">角球（选填）：</span>
                <div class="input-area corners-area">
                  <span class="team-label">{{ match.home_team }}</span>
                  <el-input-number
                    v-model="resultForms[match.id].homeCorners"
                    :min="0"
                    :max="30"
                    size="small"
                    controls-position="right"
                    style="width:80px"
                    placeholder="—"
                  />
                  <span class="colon">:</span>
                  <el-input-number
                    v-model="resultForms[match.id].awayCorners"
                    :min="0"
                    :max="30"
                    size="small"
                    controls-position="right"
                    style="width:80px"
                    placeholder="—"
                  />
                  <span class="team-label">{{ match.away_team }}</span>
                  <span class="corner-tip">不填则不结算角球盘口</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div v-if="filteredMatches.length > 0" class="pager-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :total="filteredMatches.length"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminAPI } from '../../api'

const matches = ref([])
const loading = ref(false)
const resultForms = reactive({})
const submitting = reactive({})
const htSubmitting = reactive({})
const keyword = ref('')
const statusFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(20)

const filteredMatches = computed(() => {
  const keywordValue = keyword.value.trim().toLowerCase()
  return matches.value.filter(match => {
    const statusOk = statusFilter.value === 'all' || match.status === statusFilter.value
    if (!statusOk) return false
    if (!keywordValue) return true
    const text = `${match.home_team} ${match.away_team}`.toLowerCase()
    return text.includes(keywordValue)
  })
})

const pagedMatches = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredMatches.value.slice(start, start + pageSize.value)
})

watch([keyword, statusFilter, pageSize], () => {
  currentPage.value = 1
})

function statusLabel(s) {
  return { upcoming: '即将开赛', ongoing: '进行中', finished: '已结束', closed: '已关闭' }[s] || s
}
function statusTagType(s) {
  return { upcoming: 'primary', ongoing: 'warning', finished: 'success', closed: 'danger' }[s] || ''
}
function formatTime(t) {
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

async function handleHtSubmit(match) {
  const { htHome, htAway } = resultForms[match.id]
  await ElMessageBox.confirm(
    `确认录入上半场比分 "${match.home_team} ${htHome} : ${htAway} ${match.away_team}" 吗？\n系统将结算上半场市场投注。`,
    '确认录入上半场',
    { type: 'warning' }
  )
  htSubmitting[match.id] = true
  try {
    await adminAPI.enterHtResult(match.id, { ht_home_score: htHome, ht_away_score: htAway })
    resultForms[match.id].htDone = true
    ElMessage.success('上半场比分录入成功，上半场市场投注已结算！')
  } catch (err) {
    ElMessage.error(err.error || '录入失败')
  } finally {
    htSubmitting[match.id] = false
  }
}

async function handleSubmit(match) {
  const { home, away, homeCorners, awayCorners } = resultForms[match.id]
  await ElMessageBox.confirm(
    `确认录入 "${match.home_team} ${home} : ${away} ${match.away_team}" 吗？\n系统将自动完成结算，此操作不可撤销！`,
    '确认录入',
    { type: 'warning', dangerouslyUseHTMLString: false }
  )
  submitting[match.id] = true
  try {
    const data = { home_score: home, away_score: away }
    if (homeCorners != null && awayCorners != null) {
      data.home_corners = homeCorners
      data.away_corners = awayCorners
    }
    await adminAPI.enterResult(match.id, data)
    ElMessage.success('比分录入成功，已完成自动结算！')
    await loadMatches()
  } catch (err) {
    ElMessage.error(err.error || '录入失败')
  } finally {
    submitting[match.id] = false
  }
}

async function loadMatches() {
  loading.value = true
  try {
    const all = await adminAPI.getMatches()
    matches.value = all.filter(m => m.status !== 'finished')
    currentPage.value = 1
    matches.value.forEach(m => {
      if (!resultForms[m.id]) {
        resultForms[m.id] = { home: 0, away: 0, htHome: 0, htAway: 0, htDone: false, homeCorners: null, awayCorners: null }
        submitting[m.id] = false
        htSubmitting[m.id] = false
      }
    })
  } catch {
    ElMessage.error('获取赛事失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadMatches)
</script>

<style scoped>
.page { padding: 32px; }
.page-header { margin-bottom: 24px; }
.page-header h2 { font-size: 22px; color: #1a4a1a; }
.card { background: #fff; border-radius: 12px; padding: 16px; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pager-wrap {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

.match-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  gap: 20px;
}
.match-item:last-child { border-bottom: none; }

.match-info { min-width: 200px; }
.teams {
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.vs { color: #e6a020; font-weight: 900; }
.meta { display: flex; align-items: center; gap: 10px; }
.time { font-size: 12px; color: #aaa; }

.result-area { flex: 1; display: flex; align-items: center; justify-content: flex-end; }

.final-score {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: #666;
}
.score { font-size: 20px; font-weight: 700; color: #c00; }

.input-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-block {
  display: flex;
  align-items: center;
  gap: 8px;
}
.block-label {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  min-width: 56px;
}

.input-area {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f9f9f9;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px dashed #ddd;
}
.team-label { font-size: 14px; font-weight: 600; color: #333; }
.colon { font-size: 20px; font-weight: 900; color: #333; }
.corners-area { background: #f5f5f5; border-color: #e0e0e0; }
.corner-tip { font-size: 12px; color: #aaa; white-space: nowrap; }
</style>
