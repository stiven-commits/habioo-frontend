export const PROD_API_BASE_URL = 'https://auth.habioo.cloud'

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

export const API_BASE_URL = configuredBaseUrl || (isLocalHost ? 'http://localhost:3000' : PROD_API_BASE_URL)

