import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let accessToken: string | null = null
// Qual rota de refresh usar quando o token expira no meio de uma sessão —
// tenant e super admin têm cookies e endpoints de refresh separados
// (Seção 6: sessões completamente independentes).
let refreshEndpoint: '/auth/refresh' | '/auth/admin-refresh' = '/auth/refresh'

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setRefreshEndpoint(endpoint: '/auth/refresh' | '/auth/admin-refresh') {
  refreshEndpoint = endpoint
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await api.post(refreshEndpoint)
    setAccessToken(data.accessToken)
    return data.accessToken as string
  } catch {
    setAccessToken(null)
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry && !original.url?.startsWith('/auth/')) {
      original._retry = true
      refreshPromise ||= refreshAccessToken()
      const token = await refreshPromise
      refreshPromise = null
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
    }
    return Promise.reject(error)
  }
)
