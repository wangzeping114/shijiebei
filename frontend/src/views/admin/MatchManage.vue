<template>
  <div class="page">
    <div class="page-header">
      <h2>🏟️ 赛事管理</h2>
      <el-button type="primary" @click="openCreateDialog">+ 新增赛事</el-button>
    </div>

    <div class="table-wrap">
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
          <el-option label="已结束" value="finished" />
          <el-option label="已关闭" value="closed" />
        </el-select>
      </div>

      <el-table :data="pagedMatches" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="赛事" min-width="200">
          <template #default="{ row }">
            <strong>{{ row.home_team }}</strong> <span class="vs">vs</span> <strong>{{ row.away_team }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="开赛时间" width="180">
          <template #default="{ row }">{{ formatTime(row.match_time) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最终比分" width="110">
          <template #default="{ row }">
            <span v-if="row.status === 'finished'" class="score-result">
              {{ row.home_score }} : {{ row.away_score }}
            </span>
            <span v-else class="pending-score">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="420">
          <template #default="{ row }">
            <el-button size="small" :disabled="isFinished(row)" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              size="small"
              type="warning"
              :disabled="!canConfigOdds(row)"
              @click="goOddsConfig(row)"
            >赔率配置</el-button>
            <el-button
              size="small"
              type="info"
              :disabled="!canCloseOrders(row)"
              @click="handleCloseOrders(row)"
            >关闭接单</el-button>
            <el-button
              v-if="canRestore(row)"
              size="small"
              type="success"
              @click="handleRestore(row)"
            >恢复赛事</el-button>
            <el-button
              size="small"
              type="danger"
              :disabled="isFinished(row)"
              @click="handleDelete(row.id)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :total="filteredMatches.length"
        />
      </div>
    </div>

    <!-- 新增/编辑 对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑赛事' : '新增赛事'"
      width="460px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="主队" prop="home_team">
          <el-input v-model="form.home_team" placeholder="如：法国" />
        </el-form-item>
        <el-form-item label="客队" prop="away_team">
          <el-input v-model="form.away_team" placeholder="如：阿根廷" />
        </el-form-item>
        <el-form-item label="开赛时间" prop="match_time">
          <el-date-picker
            v-model="form.match_time"
            type="datetime"
            placeholder="选择日期时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item v-if="isEditing" label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="即将开赛" value="upcoming" />
            <el-option label="进行中" value="ongoing" />
            <el-option label="已结束" value="finished" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminAPI } from '../../api'

const router = useRouter()
const matches = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const formRef = ref()
const editId = ref(null)
const nowMs = ref(Date.now())
const keyword = ref('')
const statusFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(20)
let clockTimer = null

const form = ref({ home_team: '', away_team: '', match_time: '', status: 'upcoming' })

const rules = {
  home_team: [{ required: true, message: '请输入主队名称', trigger: 'blur' }],
  away_team: [{ required: true, message: '请输入客队名称', trigger: 'blur' }],
  match_time: [{ required: true, message: '请选择开赛时间', trigger: 'change' }]
}

function statusLabel(s) {
  return { upcoming: '即将开赛', ongoing: '进行中', finished: '已结束', closed: '已关闭' }[s] || s
}
function statusTagType(s) {
  return { upcoming: 'primary', ongoing: 'warning', finished: 'info', closed: 'danger' }[s] || ''
}
function formatTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ').replace(/\.\d+.*$/, '')
  return s.slice(0, 16).replace(/-/g, '/')
}

function beijingDateKey(dateLike) {
  const s = String(dateLike)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(dateLike))
}

const todayKey = computed(() => beijingDateKey(nowMs.value))

function isTodayMatch(row) {
  return beijingDateKey(row.match_time) === todayKey.value
}

const sortedMatches = computed(() => {
  const list = [...matches.value]
  list.sort((a, b) => {
    const aToday = isTodayMatch(a)
    const bToday = isTodayMatch(b)
    if (aToday !== bToday) return aToday ? -1 : 1
    return new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
  })
  return list
})

const filteredMatches = computed(() => {
  const keywordValue = keyword.value.trim().toLowerCase()

  return sortedMatches.value.filter(match => {
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

function hasStarted(row) {
  return nowMs.value >= new Date(row.match_time).getTime()
}

function isFinished(row) {
  return row.status === 'finished'
}

function canConfigOdds(row) {
  return !isFinished(row) && !hasStarted(row)
}

function canCloseOrders(row) {
  return !isFinished(row) && !hasStarted(row) && row.status !== 'closed'
}

function canRestore(row) {
  return row.status === 'finished' || row.status === 'closed'
}

function openCreateDialog() {
  isEditing.value = false
  form.value = { home_team: '', away_team: '', match_time: '', status: 'upcoming' }
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEditing.value = true
  editId.value = row.id
  form.value = {
    home_team: row.home_team,
    away_team: row.away_team,
    match_time: row.match_time,
    status: row.status
  }
  dialogVisible.value = true
}

function goOddsConfig(row) {
  if (!canConfigOdds(row)) {
    ElMessage.warning('当前时间或赛事状态不允许修改赔率')
    return
  }
  router.push(`/admin/odds/${row.id}`)
}

async function handleCloseOrders(row) {
  if (!canCloseOrders(row)) {
    ElMessage.warning('当前时间或赛事状态不允许关闭接单')
    return
  }

  await ElMessageBox.confirm(
    `确认关闭该场赛事接单吗？\n${row.home_team} vs ${row.away_team}`,
    '关闭接单',
    { type: 'warning', confirmButtonText: '确认关闭', cancelButtonText: '取消' }
  )

  try {
    await adminAPI.updateMatch(row.id, { status: 'closed' })
    ElMessage.success('已关闭接单')
    await loadMatches()
  } catch (err) {
    ElMessage.error(err.error || '关闭接单失败')
  }
}

async function handleSave() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (isEditing.value) {
      await adminAPI.updateMatch(editId.value, form.value)
      ElMessage.success('赛事更新成功')
    } else {
      await adminAPI.createMatch(form.value)
      ElMessage.success('赛事创建成功')
    }
    dialogVisible.value = false
    await loadMatches()
  } catch (err) {
    ElMessage.error(err.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleRestore(row) {
  await ElMessageBox.confirm(
    `确认将该赛事恢复为"即将开赛"状态？\n${row.home_team} vs ${row.away_team}\n\n注意：已录入的比分不会清除，投注状态不变。`,
    '恢复赛事',
    { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' }
  )
  try {
    await adminAPI.updateMatch(row.id, { status: 'upcoming' })
    ElMessage.success('赛事已恢复为即将开赛')
    await loadMatches()
  } catch (err) {
    ElMessage.error(err.error || '恢复失败')
  }
}

async function handleDelete(id) {
  await ElMessageBox.confirm('确定要删除该赛事吗？关联的赔率和投注数据也将一并删除！', '警告', {
    type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消'
  })
  try {
    await adminAPI.deleteMatch(id)
    ElMessage.success('删除成功')
    await loadMatches()
  } catch (err) {
    ElMessage.error(err.error || '删除失败')
  }
}

async function loadMatches() {
  loading.value = true
  try {
    matches.value = await adminAPI.getMatches()
  } catch {
    ElMessage.error('获取赛事失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadMatches()
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<style scoped>
.page { padding: 32px; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-header h2 { font-size: 22px; color: #1a4a1a; }
.table-wrap { background: #fff; border-radius: 12px; padding: 16px; }
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
.vs { color: #e6a020; margin: 0 6px; font-weight: 600; }
.score-result { font-size: 16px; font-weight: 700; color: #c00; }
.pending-score { color: #ccc; }
</style>
