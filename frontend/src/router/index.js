import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/login',
    component: () => import('../views/Login.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/register',
    component: () => import('../views/Register.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/match/:id',
    component: () => import('../views/MatchDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/my-bets',
    component: () => import('../views/MyBets.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/matches' },
      { path: 'matches', component: () => import('../views/admin/MatchManage.vue') },
      { path: 'odds/:matchId', component: () => import('../views/admin/OddsConfig.vue') },
      { path: 'results', component: () => import('../views/admin/ResultEntry.vue') },
      { path: 'reports', component: () => import('../views/admin/Reports.vue') }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  } else if (to.meta.requiresAdmin && !userStore.isAdmin) {
    next('/')
  } else if (to.meta.guestOnly && userStore.isLoggedIn) {
    next('/')
  } else {
    next()
  }
})

export default router
