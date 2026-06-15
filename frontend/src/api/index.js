import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || { error: '网络请求失败' })
  }
)

export const authAPI = {
  register: data => api.post('/auth/register', data),
  login: data => api.post('/auth/login', data)
}

export const matchAPI = {
  getAll: () => api.get('/matches'),
  getById: id => api.get(`/matches/${id}`)
}

export const betAPI = {
  placeBet: data => api.post('/bets', data),
  getMyBets: () => api.get('/bets/my'),
  updateBetItem: (itemId, data) => api.put(`/bets/items/${itemId}`, data),
  deleteBetItem: itemId => api.delete(`/bets/items/${itemId}`)
}

export const adminAPI = {
  // 赛事
  getMatches: () => api.get('/admin/matches'),
  createMatch: data => api.post('/admin/matches', data),
  updateMatch: (id, data) => api.put(`/admin/matches/${id}`, data),
  deleteMatch: id => api.delete(`/admin/matches/${id}`),

  // 赔率
  getOdds: matchId => api.get(`/admin/odds/${matchId}`),
  generateOdds: matchId => api.post(`/admin/odds/${matchId}/generate`),
  updateOdds: (matchId, odds) => api.put(`/admin/odds/${matchId}`, { odds }),
  addOdd: (matchId, data) => api.post(`/admin/odds/${matchId}`, data),
  deleteOdd: id => api.delete(`/admin/odds/item/${id}`),

  // 比分录入
  enterResult: (matchId, data) => api.put(`/admin/matches/${matchId}/result`, data),

  // 报表
  getReportList: () => api.get('/admin/reports'),
  getReport: matchId => api.get(`/admin/reports/${matchId}`),
  getUpstreamReport: (orderStatus = 'pending') => api.get(`/admin/upstream-report?orderStatus=${encodeURIComponent(orderStatus)}`)
}
