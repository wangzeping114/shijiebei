<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span>⚽</span>
        <div>
          <div class="sidebar-title">竞猜管理后台</div>
          <div class="sidebar-sub">2026 世界杯</div>
        </div>
      </div>

      <nav class="nav">
        <router-link to="/admin/matches" class="nav-item" active-class="active">
          🏟️ 赛事管理
        </router-link>
        <router-link to="/admin/results" class="nav-item" active-class="active">
          📝 比分录入
        </router-link>
        <router-link to="/admin/upstream-report" class="nav-item" active-class="active">
          📄 投注上报
        </router-link>
        <router-link to="/admin/reports" class="nav-item" active-class="active">
          📊 统计报表
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="admin-info">
          <el-tag type="warning" size="small">管理员</el-tag>
          {{ userStore.user?.nickname }}
        </div>
        <el-button text size="small" type="danger" @click="handleLogout">退出</el-button>
      </div>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'

const router = useRouter()
const userStore = useUserStore()

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 220px;
  background: linear-gradient(180deg, #1a3a1a, #0d2d0d);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 20px 20px;
  font-size: 24px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.sidebar-title { color: #fff; font-size: 15px; font-weight: 700; }
.sidebar-sub { color: rgba(255,255,255,0.5); font-size: 11px; }

.nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: block;
  padding: 12px 16px;
  border-radius: 10px;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
}
.nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
.nav-item.active { background: #2d7d2d; color: #fff; font-weight: 600; }

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
}
.admin-info { display: flex; align-items: center; gap: 6px; }

.content { flex: 1; background: #f0f2f5; overflow-y: auto; }
</style>
