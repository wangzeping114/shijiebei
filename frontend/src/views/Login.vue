<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <span class="ball-icon">⚽</span>
        <h1>2026 世界杯模拟竞猜</h1>
        <p>线下门店专用系统</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            prefix-icon="User"
            size="large"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="submit-btn"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="auth-footer">
        还没有账号？
        <router-link to="/register">立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authAPI } from '../api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = ref({ username: '', password: '' })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  await formRef.value.validate()
  loading.value = true
  try {
    const data = await authAPI.login(form.value)
    userStore.setAuth(data)
    ElMessage.success(`欢迎回来，${data.user.nickname}！`)
    router.push(data.user.role === 'admin' ? '/admin' : '/')
  } catch (err) {
    ElMessage.error(err.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a3a1a 0%, #0d4d0d 50%, #1a6b1a 100%);
}
.auth-card {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.auth-header {
  text-align: center;
  margin-bottom: 32px;
}
.ball-icon {
  font-size: 48px;
}
.auth-header h1 {
  font-size: 22px;
  color: #1d4e1d;
  margin: 8px 0 4px;
  font-weight: 700;
}
.auth-header p {
  color: #999;
  font-size: 13px;
}
.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  background: linear-gradient(90deg, #2d7d2d, #1a6b1a);
  border: none;
}
.auth-footer {
  text-align: center;
  color: #666;
  font-size: 14px;
  margin-top: 16px;
}
.auth-footer a {
  color: #2d7d2d;
  font-weight: 600;
  text-decoration: none;
}

@media (max-width: 768px) {
  .auth-container {
    padding: calc(12px + env(safe-area-inset-top)) 10px calc(12px + env(safe-area-inset-bottom));
    align-items: stretch;
  }
  .auth-card {
    width: 100%;
    max-width: 480px;
    margin: auto;
    padding: 24px 16px;
    border-radius: 14px;
  }
  .auth-header {
    margin-bottom: 20px;
  }
  .ball-icon {
    font-size: 38px;
  }
  .auth-header h1 {
    font-size: 20px;
  }
}
</style>
