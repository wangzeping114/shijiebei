<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <span class="ball-icon">⚽</span>
        <h1>注册账号</h1>
        <p>2026 世界杯模拟竞猜系统</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名（3-20个字符）"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="nickname">
          <el-input
            v-model="form.nickname"
            placeholder="昵称（显示用）"
            prefix-icon="Avatar"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码（至少6位）"
            prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="确认密码"
            prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleRegister"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="submit-btn"
            @click="handleRegister"
          >
            注 册
          </el-button>
        </el-form-item>
      </el-form>
      <div class="auth-footer">
        已有账号？
        <router-link to="/login">立即登录</router-link>
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

const form = ref({ username: '', nickname: '', password: '', confirmPassword: '' })

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.value.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在3-20个字符之间', trigger: 'blur' }
  ],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

async function handleRegister() {
  await formRef.value.validate()
  loading.value = true
  try {
    const { confirmPassword, ...payload } = form.value
    const data = await authAPI.register(payload)
    userStore.setAuth(data)
    ElMessage.success('注册成功！')
    router.push('/')
  } catch (err) {
    ElMessage.error(err.error || '注册失败')
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
.ball-icon { font-size: 48px; }
.auth-header h1 {
  font-size: 22px;
  color: #1d4e1d;
  margin: 8px 0 4px;
  font-weight: 700;
}
.auth-header p { color: #999; font-size: 13px; }
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
.auth-footer a { color: #2d7d2d; font-weight: 600; text-decoration: none; }

@media (max-width: 768px) {
  .auth-container {
    padding: calc(12px + env(safe-area-inset-top)) 10px calc(12px + env(safe-area-inset-bottom));
    align-items: stretch;
  }
  .auth-card {
    width: 100%;
    max-width: 520px;
    margin: auto;
    padding: 24px 16px;
    border-radius: 14px;
  }
  .auth-header {
    margin-bottom: 18px;
  }
  .ball-icon {
    font-size: 38px;
  }
  .auth-header h1 {
    font-size: 20px;
  }
}
</style>
