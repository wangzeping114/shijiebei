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
      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button type="primary" :loading="generating" @click="handleGenerate">
          ⚡ 一键生成默认赔率(0)
        </el-button>
        <el-button type="success" @click="openAddDialog">+ 手动新增</el-button>
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

const route = useRoute()
const router = useRouter()
const matchId = route.params.matchId

const match = ref(null)
const odds = ref([])
const loading = ref(false)
const generating = ref(false)
const saving = ref(false)
const addDialogVisible = ref(false)
const addSaving = ref(false)
const addFormRef = ref()
const scoreKeyword = ref('')
const oddsState = ref('all')
const currentPage = ref(1)
const pageSize = ref(20)

const addForm = ref({ home_score: 0, away_score: 0, odds_value: 0.00 })
const addRules = {
  odds_value: [{ required: true, message: '请填写赔率', trigger: 'blur' }]
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
    const [matchData, oddsData] = await Promise.all([
      matchAPI.getById(matchId),
      adminAPI.getOdds(matchId)
    ])
    match.value = matchData
    odds.value = oddsData
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
</style>
