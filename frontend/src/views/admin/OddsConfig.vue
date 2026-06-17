<template>
  <div class="page">
    <div class="page-header">
      <div class="back-btn">
        <el-button @click="router.push('/admin/matches')">← 返回赛事列表</el-button>
      </div>
      <h2>🎲 赔率配置</h2>
      <div></div>
    </div>

    <div v-if="match" class="match-banner">
      <strong>{{ match.home_team }}</strong>
      <span class="vs">VS</span>
      <strong>{{ match.away_team }}</strong>
      <el-tag type="primary" style="margin-left:12px">赔率共 {{ odds.length }} 条</el-tag>
    </div>

    <div class="card">
      <div class="section-header" @click="scoreCollapsed = !scoreCollapsed">
        <span class="section-header-title">📊 比分赔率配置</span>
        <span class="collapse-icon">{{ scoreCollapsed ? '▶' : '▼' }}</span>
      </div>
      <div v-show="!scoreCollapsed">
      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button type="primary" :loading="generating" @click="handleGenerate">
          ⚡ 一键生成默认赔率(0)
        </el-button>
        <el-button type="success" @click="openAddDialog">+ 手动新增</el-button>
        <el-button type="info" @click="handleDownloadTemplate">📥 下载Excel模板</el-button>
        <el-upload
          ref="excelUploadRef"
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleExcelImport"
          style="display:inline-block"
        >
          <el-button type="success">
            📤 导入Excel赔率
          </el-button>
        </el-upload>
        <el-button type="warning" :loading="saving" @click="handleBatchSave">
          💾 保存全部修改
        </el-button>
      </div>

      <div class="filter-bar">
        <el-input
          v-model="scoreKeyword"
          clearable
          placeholder="筛选比分，如 2-1"
          style="width: 220px"
        />
        <el-select v-model="oddsState" style="width: 160px">
          <el-option label="全部赔率" value="all" />
          <el-option label="已配置(>0)" value="configured" />
          <el-option label="未配置(=0)" value="unconfigured" />
        </el-select>
      </div>

      <el-table :data="pagedOdds" v-loading="loading" border stripe>
        <el-table-column label="比分（主:客）" width="150">
          <template #default="{ row }">
            <span class="score-cell">{{ row.home_score }} : {{ row.away_score }}</span>
          </template>
        </el-table-column>
        <el-table-column label="赔率" min-width="220">
          <template #default="{ row }">
            <el-input-number
              v-model="row.odds_value"
              :min="0"
              :step="0.1"
              :precision="2"
              size="small"
              controls-position="right"
              style="width:160px"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="danger" @click="handleDeleteOdd(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :total="filteredOdds.length"
        />
      </div>

      <div v-if="odds.length === 0 && !loading" class="empty-tip">
        暂无赔率，请点击"一键生成默认赔率"或手动新增
      </div>
      </div>
    </div>

    <!-- 市场赔率管理 -->
    <div class="card market-card">
      <div class="section-header" @click="marketCollapsed = !marketCollapsed">
        <span class="section-header-title">🎲 市场赔率配置（独赢/让球/大小/BTTS/角球）</span>
        <span class="collapse-icon">{{ marketCollapsed ? '▶' : '▼' }}</span>
      </div>
      <div v-show="!marketCollapsed">
      <div class="toolbar">
        <el-button type="primary" @click="openGenerateDialog">
          ⚡ 生成默认市场赔率
        </el-button>
        <el-button type="info" @click="handleDownloadMarketTemplate">📥 下载市场赔率模板</el-button>
        <el-upload
          ref="marketExcelUploadRef"
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleMarketExcelImport"
          style="display:inline-block"
        >
          <el-button type="success">📤 导入市场赔率</el-button>
        </el-upload>
        <el-button type="warning" :loading="mSaving" @click="handleMarketSave">
          💾 保存市场赔率
        </el-button>
      </div>

      <div v-if="marketOdds.length === 0 && !loading" class="empty-tip">
        暂无市场赔率，请点击"生成默认市场赔率"
      </div>

      <template v-for="(group, mType) in marketOddsGrouped" :key="mType">
        <div class="market-type-header-row">
          <span class="market-type-header clickable-header" @click="toggleMarketType(mType)">
            <span class="collapse-icon-sm">{{ marketTypeCollapsed[mType] ? '▶' : '▼' }}</span>
            {{ mType }}
          </span>
          <el-button v-if="isCornersType(mType)" size="small" type="success" @click="openAddCornerDialog">
            + 新增角球线
          </el-button>
        </div>
        <el-table v-show="!marketTypeCollapsed[mType]" :data="group" border stripe size="small" style="margin-bottom:8px">
          <el-table-column label="选项名称" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.selection" size="small" />
            </template>
          </el-table-column>
          <!-- 让球值列：让球盘口专用 -->
          <el-table-column v-if="isHandicapType(mType)" label="让球值" width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row._val"
                :step="0.25"
                :precision="2"
                size="small"
                controls-position="right"
                style="width:115px"
              />
            </template>
          </el-table-column>
          <!-- 角球数列：角球盘口专用 -->
          <el-table-column v-if="isCornersType(mType)" label="角球数" width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row._val"
                :step="0.5"
                :precision="1"
                :min="0"
                size="small"
                controls-position="right"
                style="width:115px"
              />
            </template>
          </el-table-column>
          <el-table-column label="赔率" min-width="160">
            <template #default="{ row }">
              <el-input-number
                v-model="row.odds_value"
                :min="0"
                :step="0.1"
                :precision="2"
                size="small"
                controls-position="right"
                style="width:130px"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="handleDeleteMarketOdd(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
      </div>
    </div>

    <!-- 生成配置对话框 -->
    <el-dialog v-model="generateDialogVisible" title="配置市场赔率生成参数" width="440px">
      <el-form label-width="130px" size="small">
        <div class="gen-section">全场让球盘口</div>
        <el-form-item label="让球线1（收让）">
          <el-input-number v-model="genForm.ft_hc1" :step="0.25" :precision="2" :min="0" controls-position="right" style="width:150px" />
          <span class="gen-hint">主队收让 X 球</span>
        </el-form-item>
        <el-form-item label="让球线2（受让）">
          <el-input-number v-model="genForm.ft_hc2" :step="0.25" :precision="2" :min="0" controls-position="right" style="width:150px" />
          <span class="gen-hint">主队受让 X 球</span>
        </el-form-item>
        <div class="gen-section">上半场让球盘口</div>
        <el-form-item label="让球线">
          <el-input-number v-model="genForm.ht_hc1" :step="0.25" :precision="2" :min="0" controls-position="right" style="width:150px" />
          <span class="gen-hint">主队收让 X 球</span>
        </el-form-item>
        <div class="gen-section">全场比分大小盘口</div>
        <el-form-item label="大小球线1">
          <el-input-number v-model="genForm.ft_total1" :step="0.25" :precision="2" :min="0" controls-position="right" style="width:150px" />
        </el-form-item>
        <el-form-item label="大小球线2">
          <el-input-number v-model="genForm.ft_total2" :step="0.25" :precision="2" :min="0" controls-position="right" style="width:150px" />
        </el-form-item>
        <div class="gen-section">上半场比分大小盘口</div>
        <el-form-item label="大小球线">
          <el-input-number v-model="genForm.ht_total1" :step="0.25" :precision="2" :min="0" controls-position="right" style="width:150px" />
        </el-form-item>
      </el-form>
      <div class="gen-tip">注：让球/大小球盘口原有行会被清除后重新生成；独赢/BTTS/角球行保持不变。</div>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="mGenerating" @click="confirmMarketGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- 新增角球线对话框 -->
    <el-dialog v-model="addCornerDialogVisible" title="新增角球大于N线" width="340px">
      <el-form label-width="80px">
        <el-form-item label="角球数">
          <el-input-number
            v-model="addCornerForm.val"
            :step="0.5"
            :precision="1"
            :min="0"
            controls-position="right"
            style="width:160px"
          />
        </el-form-item>
        <el-form-item label="初始赔率">
          <el-input-number
            v-model="addCornerForm.odds_value"
            :min="0"
            :step="0.1"
            :precision="2"
            controls-position="right"
            style="width:160px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addCornerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addCornerSaving" @click="handleAddCorner">确认新增</el-button>
      </template>
    </el-dialog>

    <!-- 手动新增对话框 -->
    <el-dialog v-model="addDialogVisible" title="新增比分赔率" width="380px">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="90px">
        <el-form-item label="主队比分" prop="home_score">
          <el-input-number v-model="addForm.home_score" :min="0" :max="20" controls-position="right" />
        </el-form-item>
        <el-form-item label="客队比分" prop="away_score">
          <el-input-number v-model="addForm.away_score" :min="0" :max="20" controls-position="right" />
        </el-form-item>
        <el-form-item label="赔率" prop="odds_value">
          <el-input-number v-model="addForm.odds_value" :min="0" :step="0.1" :precision="2" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSaving" @click="handleAdd">确认新增</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminAPI, matchAPI } from '../../api'
import * as XLSX from 'xlsx'

const route = useRoute()
const router = useRouter()
const matchId = route.params.matchId

const match = ref(null)
const odds = ref([])
const marketOdds = ref([])
const loading = ref(false)
const generating = ref(false)
const saving = ref(false)
const mGenerating = ref(false)
const mSaving = ref(false)
const generateDialogVisible = ref(false)
const genForm = ref({ ft_hc1: 1.75, ft_hc2: 2, ht_hc1: 0.75, ft_total1: 3, ft_total2: 2.5, ht_total1: 1 })
const scoreCollapsed = ref(false)
const marketCollapsed = ref(false)
const marketTypeCollapsed = ref({})
function toggleMarketType(mType) {
  marketTypeCollapsed.value[mType] = !marketTypeCollapsed.value[mType]
}

const addCornerDialogVisible = ref(false)
const addCornerSaving = ref(false)
const addCornerForm = ref({ val: 9.5, odds_value: 0.00 })
const addDialogVisible = ref(false)
const addSaving = ref(false)
const addFormRef = ref()
const scoreKeyword = ref('')
const oddsState = ref('all')
const currentPage = ref(1)
const pageSize = ref(20)

const excelUploadRef = ref()
const addForm = ref({ home_score: 0, away_score: 0, odds_value: 0.00 })
const addRules = {
  odds_value: [{ required: true, message: '请填写赔率', trigger: 'blur' }]
}

const marketOddsGrouped = computed(() => {
  const groups = {}
  for (const item of marketOdds.value) {
    if (!groups[item.market_type]) groups[item.market_type] = []
    groups[item.market_type].push(item)
  }
  return groups
})

// 判断盘口类型
function isHandicapType(mType) { return mType.includes('让球') }
function isCornersType(mType) { return mType.includes('角球') }

// 解析让球/角球行的数值，写入 _val 供编辑
function prepareMarketRow(row) {
  const r = { ...row }
  const hm = row.selection_code.match(/^(?:ht_)?handicap_(?:home|away)_(\d+\.?\d*)$/)
  const cm = row.selection_code.match(/^corners_over_(\d+\.?\d*)$/)
  if (hm) r._val = parseFloat(hm[1])
  else if (cm) r._val = parseFloat(cm[1])
  return r
}

const filteredOdds = computed(() => {
  const keyword = scoreKeyword.value.trim().toLowerCase()
  return odds.value.filter(item => {
    if (oddsState.value === 'configured' && Number(item.odds_value) <= 0) return false
    if (oddsState.value === 'unconfigured' && Number(item.odds_value) > 0) return false

    if (!keyword) return true
    const scoreText = `${item.home_score}-${item.away_score}`.toLowerCase()
    const scoreTextColon = `${item.home_score}:${item.away_score}`.toLowerCase()
    return scoreText.includes(keyword) || scoreTextColon.includes(keyword)
  })
})

const pagedOdds = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredOdds.value.slice(start, start + pageSize.value)
})

watch([scoreKeyword, oddsState, pageSize], () => {
  currentPage.value = 1
})

async function loadData() {
  loading.value = true
  try {
    const [matchData, oddsData, marketData] = await Promise.all([
      matchAPI.getById(matchId),
      adminAPI.getOdds(matchId),
      adminAPI.getMarketOdds(matchId)
    ])
    match.value = matchData
    odds.value = oddsData
    marketOdds.value = marketData.map(prepareMarketRow)
    currentPage.value = 1
  } catch {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

async function handleGenerate() {
  await ElMessageBox.confirm('将为该赛事生成20种常见比分，并将默认赔率重置为0，确认继续？', '提示')
  generating.value = true
  try {
    odds.value = await adminAPI.generateOdds(matchId)
    currentPage.value = 1
    ElMessage.success('默认赔率生成成功')
  } catch (err) {
    ElMessage.error(err.error || '生成失败')
  } finally {
    generating.value = false
  }
}

async function handleBatchSave() {
  if (odds.value.length === 0) return
  saving.value = true
  try {
    odds.value = await adminAPI.updateOdds(matchId, odds.value)
    currentPage.value = 1
    ElMessage.success('赔率保存成功')
  } catch (err) {
    ElMessage.error(err.error || '保存失败')
  } finally {
    saving.value = false
  }
}

function openAddDialog() {
  addForm.value = { home_score: 0, away_score: 0, odds_value: 0.00 }
  addDialogVisible.value = true
}

async function handleAdd() {
  await addFormRef.value.validate()
  addSaving.value = true
  try {
    await adminAPI.addOdd(matchId, addForm.value)
    odds.value = await adminAPI.getOdds(matchId)
    currentPage.value = 1
    addDialogVisible.value = false
    ElMessage.success('新增成功')
  } catch (err) {
    ElMessage.error(err.error || '新增失败')
  } finally {
    addSaving.value = false
  }
}

async function handleDeleteOdd(id) {
  await ElMessageBox.confirm('确定删除该比分赔率吗？', '提示', { type: 'warning' })
  try {
    await adminAPI.deleteOdd(id)
    odds.value = odds.value.filter(o => o.id !== id)
    ElMessage.success('删除成功')
  } catch (err) {
    ElMessage.error(err.error || '删除失败')
  }
}

function openGenerateDialog() {
  generateDialogVisible.value = true
}

async function confirmMarketGenerate() {
  mGenerating.value = true
  try {
    marketOdds.value = (await adminAPI.generateMarketOdds(matchId, genForm.value)).map(prepareMarketRow)
    generateDialogVisible.value = false
    ElMessage.success('市场赔率生成成功')
  } catch (err) {
    ElMessage.error(err.error || '生成失败')
  } finally {
    mGenerating.value = false
  }
}

async function handleMarketSave() {
  if (marketOdds.value.length === 0) return
  mSaving.value = true
  try {
    // 把 _val 回写进 selection_code
    const toSave = marketOdds.value.map(row => {
      const r = { id: row.id, market_type: row.market_type, odds_value: row.odds_value, selection: row.selection, selection_code: row.selection_code }
      if (row._val !== undefined) {
        const hm = row.selection_code.match(/^((?:ht_)?handicap_(?:home|away)_)/)
        if (hm) r.selection_code = `${hm[1]}${row._val}`
        else if (row.selection_code.match(/^corners_over_/)) r.selection_code = `corners_over_${row._val}`
      }
      return r
    })
    marketOdds.value = (await adminAPI.updateMarketOdds(matchId, toSave)).map(prepareMarketRow)
    ElMessage.success('市场赔率保存成功')
  } catch (err) {
    ElMessage.error(err.error || '保存失败')
  } finally {
    mSaving.value = false
  }
}

function openAddCornerDialog() {
  addCornerForm.value = { val: 9.5, odds_value: 0.00 }
  addCornerDialogVisible.value = true
}

async function handleAddCorner() {
  const val = addCornerForm.value.val
  addCornerSaving.value = true
  try {
    await adminAPI.addMarketOddItem(matchId, {
      market_type: '全场角球盘口',
      selection: `全场角球大于${val}`,
      selection_code: `corners_over_${val}`,
      odds_value: addCornerForm.value.odds_value
    })
    marketOdds.value = (await adminAPI.getMarketOdds(matchId)).map(prepareMarketRow)
    addCornerDialogVisible.value = false
    ElMessage.success('新增成功')
  } catch (err) {
    ElMessage.error(err.error || '新增失败')
  } finally {
    addCornerSaving.value = false
  }
}

async function handleDeleteMarketOdd(id) {
  await ElMessageBox.confirm('确定删除该市场赔率吗？', '提示', { type: 'warning' })
  try {
    await adminAPI.deleteMarketOdd(id)
    marketOdds.value = marketOdds.value.filter(o => o.id !== id)
    ElMessage.success('删除成功')
  } catch (err) {
    ElMessage.error(err.error || '删除失败')
  }
}

// 格式化比赛时间
function formatMatchTime(matchTime) {
  if (!matchTime) return ''
  const d = new Date(matchTime)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 生成比赛信息行（前两行）
function getMatchInfoRows() {
  const m = match.value
  if (!m) return []
  return [
    [`比赛：${m.home_team} VS ${m.away_team}`, '', `日期：${formatMatchTime(m.match_time)}`],
    []
  ]
}

// 下载比分赔率Excel模板
function handleDownloadTemplate() {
  const infoRows = getMatchInfoRows()
  const header = [['主队比分', '客队比分', '赔率']]
  const examples = [
    [1, 0, 3.50],
    [2, 0, 6.00],
    [0, 0, 5.50],
    [1, 1, 4.20],
    [2, 1, 7.50],
  ]
  const wsData = [...infoRows, ...header, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }]
  if (infoRows.length > 0) ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '比分赔率')
  const filename = match.value ? `${match.value.home_team}VS${match.value.away_team}_比分赔率模板.xlsx` : '比分赔率模板.xlsx'
  XLSX.writeFile(wb, filename)
}

// 下载市场赔率Excel模板（含当前已有数据）
function handleDownloadMarketTemplate() {
  const infoRows = getMatchInfoRows()
  const header = [['盘口类型', '选项名称', '选项代码（勿修改）', '赔率']]
  let dataRows
  if (marketOdds.value.length > 0) {
    dataRows = marketOdds.value.map(o => [
      o.market_type,
      o.selection,
      o.selection_code,
      Number(o.odds_value)
    ])
  } else {
    const m = match.value
    const home = m ? m.home_team : '主队'
    const away = m ? m.away_team : '客队'
    dataRows = [
      // 独赢盘口
      ['独赢盘口', `${home}独赢`,                   'home_win',               0.00],
      ['独赢盘口', '平局',                           'draw',                   0.00],
      ['独赢盘口', `${away}独赢`,                    'away_win',               0.00],
      // 上半场独赢盘口
      ['上半场独赢盘口', `上半场${home}独赢`,        'ht_home_win',            0.00],
      ['上半场独赢盘口', '上半场平局',               'ht_draw',                0.00],
      ['上半场独赢盘口', `上半场${away}独赢`,        'ht_away_win',            0.00],
      // 全场让球盘口（两条线，让球值由生成参数决定，示例用1.75/2）
      ['全场让球盘口', `${home}让1.75球`,          'handicap_home_1.75',     0.00],
      ['全场让球盘口', `${away}让1.75球`,           'handicap_away_1.75',     0.00],
      ['全场让球盘口', `${home}让2球`,              'handicap_home_2',        0.00],
      ['全场让球盘口', `${away}让2球`,              'handicap_away_2',        0.00],
      // 上半场让球盘口
      ['上半场让球盘口', `上半场${home}让0.75球`,   'ht_handicap_home_0.75',  0.00],
      ['上半场让球盘口', `上半场${away}让0.75球`,   'ht_handicap_away_0.75',  0.00],
      // 全场比分大小盘口（两条线）
      ['全场比分大小盘口', '全场比分大于3',           'total_over_3',           0.00],
      ['全场比分大小盘口', '全场比分小于3',           'total_under_3',          0.00],
      ['全场比分大小盘口', '全场比分大于2.5',         'total_over_2.5',         0.00],
      ['全场比分大小盘口', '全场比分小于2.5',         'total_under_2.5',        0.00],
      // 上半场比分大小盘口
      ['上半场比分大小盘口', '上半场比分大于1',       'ht_total_over_1',        0.00],
      ['上半场比分大小盘口', '上半场比分小于1',       'ht_total_under_1',       0.00],
      // 双方是否进球
      ['双方是否进球', '双方均进球（是）',            'btts_yes',               0.00],
      ['双方是否进球', '双方未均进球（否）',          'btts_no',                0.00],
      // 全场角球盘口
      ['全场角球盘口', '全场角球大于9.5',             'corners_over_9.5',       0.00],
    ]
  }
  const wsData = [...infoRows, ...header, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  // 强制文本列（盘口类型/选项名称/选项代码）为字符串类型，防止 Excel 把含负号的代码误识别为公式
  const mRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:D1')
  for (let r = mRange.s.r; r <= mRange.e.r; r++) {
    for (const c of [0, 1, 2]) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (ws[addr] != null) ws[addr] = { t: 's', v: String(ws[addr].v ?? '') }
    }
  }
  ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 12 }]
  if (infoRows.length > 0) ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]

  // 说明 Sheet：解释选项代码格式
  const helpData = [
    ['选项代码说明（导入时系统按此列精确匹配，请勿修改）'],
    [],
    ['盘口类型', '选项代码格式', '说明'],
    ['独赢盘口',       'home_win',                  '主队独赢'],
    ['独赢盘口',       'draw',                       '平局'],
    ['独赢盘口',       'away_win',                   '客队独赢'],
    ['上半场独赢盘口', 'ht_home_win',                '上半场主队独赢'],
    ['上半场独赢盘口', 'ht_draw',                    '上半场平局'],
    ['上半场独赢盘口', 'ht_away_win',                '上半场客队独赢'],
    ['全场让球盘口',   'handicap_home_{让球值}',     '主队让球，示例：handicap_home_1.75（主队让1.75球）'],
    ['全场让球盘口',   'handicap_away_{让球值}',     '客队让球，示例：handicap_away_1.75（客队让1.75球）'],
    ['上半场让球盘口', 'ht_handicap_home_{让球值}',  '示例：ht_handicap_home_0.75（上半场主队让0.75球）'],
    ['上半场让球盘口', 'ht_handicap_away_{让球值}',  '示例：ht_handicap_away_0.75（上半场客队让0.75球）'],
    ['全场比分大小盘口','total_over_{球线}',          '示例：total_over_3（全场大于3球）'],
    ['全场比分大小盘口','total_under_{球线}',         '示例：total_under_3（全场小于3球）'],
    ['上半场比分大小盘口','ht_total_over_{球线}',     '示例：ht_total_over_1'],
    ['上半场比分大小盘口','ht_total_under_{球线}',    '示例：ht_total_under_1'],
    ['双方是否进球',   'btts_yes',                   '双方均进球（是）'],
    ['双方是否进球',   'btts_no',                    '双方未均进球（否）'],
    ['全场角球盘口',   'corners_over_{角球数}',      '示例：corners_over_9.5（全场角球大于9.5）'],
    [],
    ['提示：建议先在系统内点击「生成默认市场赔率」，再下载模板，选项代码会自动填好，只需填赔率列。'],
  ]
  const wsHelp = XLSX.utils.aoa_to_sheet(helpData)
  wsHelp['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 44 }]
  wsHelp['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 20, c: 0 }, e: { r: 20, c: 2 } }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '市场赔率')
  XLSX.utils.book_append_sheet(wb, wsHelp, '选项代码说明')
  const filename = match.value ? `${match.value.home_team}VS${match.value.away_team}_市场赔率模板.xlsx` : '市场赔率模板.xlsx'
  XLSX.writeFile(wb, filename)
}

// 解析导入的比分赔率Excel文件
function handleExcelImport(file) {
  const f = file.raw
  if (!f) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) {
        ElMessage.warning('Excel 内容为空，请检查文件')
        return
      }
      // 自动定位数据起始行（首列和次列都是整数的行）
      let startIdx = -1
      for (let i = 0; i < rows.length; i++) {
        const h = parseInt(rows[i][0])
        const a = parseInt(rows[i][1])
        const o = parseFloat(rows[i][2])
        if (!isNaN(h) && !isNaN(a) && !isNaN(o)) { startIdx = i; break }
      }
      if (startIdx === -1) { ElMessage.warning('未找到有效数据行，请检查文件格式'); return }
      let updated = 0, added = 0, skipped = 0
      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i]
        const homeScore = parseInt(row[0])
        const awayScore = parseInt(row[1])
        const oddsVal = parseFloat(row[2])
        if (isNaN(homeScore) || isNaN(awayScore) || isNaN(oddsVal)) {
          skipped++
          continue
        }
        if (oddsVal < 0) { skipped++; continue }
        const existing = odds.value.find(
          o => o.home_score === homeScore && o.away_score === awayScore
        )
        if (existing) {
          existing.odds_value = oddsVal
          updated++
        } else {
          odds.value.push({
            id: null,
            match_id: matchId,
            home_score: homeScore,
            away_score: awayScore,
            odds_value: oddsVal,
            _new: true
          })
          added++
        }
      }
      currentPage.value = 1
      let msg = `导入完成：更新 ${updated} 条，新增 ${added} 条`
      if (skipped > 0) msg += `，跳过无效行 ${skipped} 条`
      ElMessage.success(msg)
    } catch (err) {
      ElMessage.error('Excel 解析失败，请检查文件格式')
    }
    // 清空 upload 组件，允许重复选同一文件
    if (excelUploadRef.value) excelUploadRef.value.clearFiles()
  }
  reader.readAsArrayBuffer(f)
}

// 解析导入的市场赔率Excel文件
function handleMarketExcelImport(file) {
  const f = file.raw
  if (!f) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) {
        ElMessage.warning('Excel 内容为空，请检查文件')
        return
      }
      // 自动定位数据起始行：跳过比赛信息行和表头行（第3列为"选项代码"），找到第3列有值且非表头的行
      let startIdx = -1
      for (let i = 0; i < rows.length; i++) {
        const col2 = String(rows[i][2] || '').trim()
        if (!col2 || col2 === '选项代码') continue
        if (rows[i][0]) { startIdx = i; break }
      }
      if (startIdx === -1) { ElMessage.warning('未找到有效市场赔率数据，请检查文件格式'); return }
      let updated = 0, added = 0, skipped = 0
      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i]
        const selectionCode = String(row[2] || '').trim()
        const oddsVal = parseFloat(row[3])
        if (!selectionCode || isNaN(oddsVal)) { skipped++; continue }
        if (oddsVal < 0) { skipped++; continue }
        const existing = marketOdds.value.find(o => o.selection_code === selectionCode)
        if (existing) {
          existing.odds_value = oddsVal
          updated++
        } else {
          // 代码不存在时，用 Excel 的盘口类型+选项名称新建条目
          const marketType = String(row[0] || '').trim()
          const selection = String(row[1] || '').trim()
          if (marketType && selection) {
            marketOdds.value.push({
              id: null,
              market_type: marketType,
              selection: selection,
              selection_code: selectionCode,
              odds_value: oddsVal,
              _new: true
            })
            added++
          } else {
            skipped++
          }
        }
      }
      let msg = `市场赔率导入完成：更新 ${updated} 条，新增 ${added} 条`
      if (skipped > 0) msg += `，跳过 ${skipped} 行（数据不完整或格式错误）`
      ElMessage.success(msg)
    } catch (err) {
      ElMessage.error('Excel 解析失败，请检查文件格式')
    }
    if (marketExcelUploadRef.value) marketExcelUploadRef.value.clearFiles()
  }
  reader.readAsArrayBuffer(f)
}

onMounted(loadData)
</script>

<style scoped>
.page { padding: 32px; }
.page-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 { text-align: center; font-size: 22px; color: #1a4a1a; }
.match-banner {
  background: linear-gradient(90deg, #1a4a1a, #2d7d2d);
  color: #fff;
  border-radius: 10px;
  padding: 14px 24px;
  font-size: 18px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.vs { color: #ffd700; font-weight: 900; }
.card { background: #fff; border-radius: 12px; padding: 20px; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.pager-wrap {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
.score-cell { font-size: 18px; font-weight: 700; color: #1a4a1a; }
.empty-tip { text-align: center; color: #aaa; padding: 32px; }
.market-card { margin-top: 20px; }
.section-title { font-size: 16px; font-weight: 700; color: #1a4a1a; margin-bottom: 14px; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  cursor: pointer;
  border-bottom: 2px solid #f0f5f0;
  margin-bottom: 16px;
  user-select: none;
}
.section-header-title { font-size: 16px; font-weight: 700; color: #1a4a1a; }
.section-header:hover { background: #f8faf8; border-radius: 6px; }
.collapse-icon { color: #2d7d2d; font-size: 13px; }
.clickable-header {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 4px;
  transition: background 0.15s;
}
.clickable-header:hover { background: #dff0df; }
.collapse-icon-sm { font-size: 10px; color: #2d7d2d; }
.market-type-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 4px;
}
.market-type-header {
  background: #f0f5f0;
  padding: 5px 12px;
  font-weight: 600;
  color: #2d7d2d;
  border-radius: 4px;
  font-size: 13px;
}
.gen-section {
  font-size: 13px;
  font-weight: 700;
  color: #2d7d2d;
  background: #f0f5f0;
  padding: 4px 12px;
  border-radius: 4px;
  margin: 10px 0 6px;
}
.gen-hint { font-size: 12px; color: #aaa; margin-left: 8px; }
.gen-tip {
  font-size: 12px;
  color: #999;
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 10px;
}
</style>
