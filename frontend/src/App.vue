<template>
  <div class="app-shell">
    <main class="app-main">
      <router-view />
    </main>
    <footer class="legal-footer">
      <div class="legal-inner">
        <strong>{{ legalTitle }}</strong>
        <span>{{ legalText }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isAdminRoute = computed(() => route.path.startsWith('/admin'))

const legalTitle = computed(() => (isAdminRoute.value ? '后台法律声明：' : '前台法律声明：'))

const legalText = computed(() => (
  isAdminRoute.value
    ? '本后台仅用于赛事数据管理与模拟运营演示，不构成任何盈利承诺或投资建议；如有争议，以系统留存记录与管理员复核结果为准。'
    : '本平台仅供世界杯模拟竞猜与交流演示，不构成任何形式的投资建议或收益承诺；请遵守所在地法律法规，理性参与。'
))
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html, body, #app {
  width: 100%;
  min-height: 100%;
}
body {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f0f2f5;
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-text-size-adjust: 100%;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
}

.legal-footer {
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  padding: 10px 14px;
}

.legal-inner {
  max-width: 1200px;
  margin: 0 auto;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.legal-inner strong {
  color: #4b5563;
  margin-right: 4px;
}

@media (max-width: 768px) {
  .legal-footer {
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  }

  .legal-inner {
    font-size: 11px;
  }
}
</style>
