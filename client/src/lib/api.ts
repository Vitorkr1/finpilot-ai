import axios from 'axios'

function createSessionApi(refreshEndpoint: string, eventName: string) {
  const instance = axios.create({ baseURL: '/api', withCredentials: true })
  let accessToken: string | null = null
  let generation = 0
  let refreshPromise: Promise<string | null> | null = null
  function setToken(token: string | null) { generation++; accessToken = token }
  function expire() {
    setToken(null)
    window.dispatchEvent(new Event(eventName))
  }
  instance.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
    ;(config as typeof config & { _authGeneration?: number })._authGeneration = generation
    return config
  })
  async function refresh(): Promise<string | null> {
    const started = generation
    try {
      const { data } = await instance.post(refreshEndpoint)
      if (generation !== started) return null
      accessToken = data.accessToken
      return accessToken
    } catch {
      if (generation === started) expire()
      return null
    }
  }
  instance.interceptors.response.use((response) => response, async (error) => {
    const original = error.config
    if (error.response?.status === 401 && original && !original.url?.startsWith('/auth/')) {
      if (original._authGeneration !== generation) return Promise.reject(error)
      if (original._retry) { expire(); return Promise.reject(error) }
      original._retry = true
      refreshPromise ||= refresh()
      const token = await refreshPromise
      refreshPromise = null
      if (token) { original.headers.Authorization = `Bearer ${token}`; return instance(original) }
    }
    return Promise.reject(error)
  })
  return { api: instance, setToken }
}

const tenant = createSessionApi('/auth/refresh', 'criaos:tenant-session-ended')
const admin = createSessionApi('/auth/admin-refresh', 'criaos:admin-session-ended')
export const api = tenant.api
export const setAccessToken = tenant.setToken
export const adminApi = admin.api
export const setAdminAccessToken = admin.setToken
