import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { API_BASE_URL, PROD_API_BASE_URL } from './config/api'

if (typeof window !== 'undefined') {
  window.__HABIOO_API_BASE__ = API_BASE_URL
  const originalFetch = window.fetch.bind(window)
  let sessionEndEventDispatched = false
  const LAST_ERROR_STORAGE_KEY = 'habioo:last-http-error'
  const MAX_ERROR_MESSAGE_LENGTH = 500

  const refreshSessionFromHeaders = (response) => {
    const refreshedToken = response.headers.get('x-habioo-refreshed-token')
    if (!refreshedToken) return

    localStorage.setItem('habioo_token', refreshedToken)
    const refreshedExpiresAt = response.headers.get('x-habioo-session-expires-at')
    if (!refreshedExpiresAt) return

    const rawSession = localStorage.getItem('habioo_session')
    let session = {}
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession)
        if (parsed && typeof parsed === 'object') session = parsed
      } catch {
        session = {}
      }
    }
    localStorage.setItem('habioo_session', JSON.stringify({
      ...session,
      expires_at: refreshedExpiresAt,
    }))
  }

  const getTargetErrorPath = (status) => {
    if (status === 403) return '/error-403'
    if (status === 500) return '/error-500'
    if (status === 503) return '/error-503'
    return ''
  }

  const safeTrim = (value) => String(value || '').trim().slice(0, MAX_ERROR_MESSAGE_LENGTH)

  const extractRequestId = (response) => (
    response.headers.get('x-request-id')
    || response.headers.get('x-correlation-id')
    || response.headers.get('x-trace-id')
    || ''
  )

  const saveLastHttpError = async ({ response, status, url, method }) => {
    try {
      const requestId = safeTrim(extractRequestId(response))
      let message = ''
      try {
        const cloned = response.clone()
        const contentType = String(cloned.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
          const json = await cloned.json()
          message = safeTrim(json?.message || json?.error || '')
        } else {
          const text = await cloned.text()
          message = safeTrim(text)
        }
      } catch {
        message = ''
      }

      const payload = {
        status,
        method: safeTrim(method),
        url: safeTrim(url),
        requestId,
        message,
        timestamp: new Date().toISOString(),
      }
      sessionStorage.setItem(LAST_ERROR_STORAGE_KEY, JSON.stringify(payload))
      return requestId
    } catch {
      return ''
    }
  }

  const isExpectedHierarchy403 = (status, effectiveUrl) => {
    if (status !== 403 || !effectiveUrl) return false
    try {
      const parsed = new URL(effectiveUrl, window.location.origin)
      const path = parsed.pathname || ''
      const expected403Paths = [
        '/pagos/pendientes-aprobacion',
        '/recibos-historial',
        '/propiedades-admin',
        '/admin-resumen',
        '/admin-graficos',
        '/admin-movimientos',
        '/cuentas-por-cobrar',
        '/alquileres/reservaciones',
      ]
      if (expected403Paths.includes(path)) return true
      if (/^\/recibos\/\d+\/aviso$/i.test(path)) return true
      if (/^\/encuestas(\/\d+)?$/i.test(path)) return true
      return false
    } catch {
      return false
    }
  }

  window.fetch = async (input, init) => {
    let requestInput = input
    let requestUrl = typeof input === 'string' ? input : (input instanceof Request ? input.url : '')
    const requestMethod = String(
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()

    if (API_BASE_URL !== PROD_API_BASE_URL) {
      if (typeof requestUrl === 'string' && requestUrl.startsWith(PROD_API_BASE_URL)) {
        const rewrittenUrl = requestUrl.replace(PROD_API_BASE_URL, API_BASE_URL)
        requestInput = typeof input === 'string'
          ? rewrittenUrl
          : new Request(rewrittenUrl, input)
        requestUrl = rewrittenUrl
      }
    }

    const response = await originalFetch(requestInput, init)

    const effectiveUrl = response.url || requestUrl
    const isApiCall = typeof effectiveUrl === 'string'
      && (effectiveUrl.startsWith(API_BASE_URL) || effectiveUrl.startsWith(PROD_API_BASE_URL))

    if (isApiCall) {
      refreshSessionFromHeaders(response)
      if (response.status === 401) {
        const hasToken = Boolean(localStorage.getItem('habioo_token'))
        if (hasToken && !sessionEndEventDispatched) {
          sessionEndEventDispatched = true
          window.dispatchEvent(new CustomEvent('habioo:session-ended', {
            detail: {
              reason: 'unauthorized',
              status: 401,
              url: effectiveUrl,
            },
          }))
        }
        return response
      }
      if (isExpectedHierarchy403(response.status, effectiveUrl)) {
        return response
      }
      const errorPath = getTargetErrorPath(response.status)
      const shouldRedirectOnError = requestMethod === 'GET' || requestMethod === 'HEAD'
      if (errorPath && shouldRedirectOnError && window.location.pathname !== errorPath) {
        const requestId = await saveLastHttpError({
          response,
          status: response.status,
          url: effectiveUrl,
          method: requestMethod,
        })
        const target = requestId
          ? `${errorPath}?rid=${encodeURIComponent(requestId)}`
          : errorPath
        window.location.replace(target)
      }
    }

    return response
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
