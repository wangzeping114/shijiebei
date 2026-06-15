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

      <el-table :data="odds" v-loading="loading" border stripe>
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
import { ref, onMounted } from 'vue'
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

const addForm = ref({ home_score: 0, away_score: 0, odds_value: 0.00 })
const addRules = {
  odds_value: [{ required: true, message: '请填写赔率', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const [matchData, oddsData] = await Promise.all([
      matchAPI.getById(matchId),
      adminAPI.getOdds(matchId)
    ])
    match.value = matchData
    odds.value = oddsData
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
.score-cell { font-size: 18px; font-weight: 700; color: #1a4a1a; }
.empty-tip { text-align: center; color: #aaa; padding: 32px; }
</style>
