import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Attach JWT token to requests
api.interceptors.request.use(config => {
  try {
    const stored = JSON.parse(localStorage.getItem('theboard-storage') || '{}')
    if (stored.state?.token) {
      config.headers.Authorization = `Bearer ${stored.state.token}`
    }
  } catch (e) {}
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('theboard-storage')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
