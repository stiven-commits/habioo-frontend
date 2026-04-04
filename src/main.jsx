import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { API_BASE_URL, PROD_API_BASE_URL } from './config/api'

if (typeof window !== 'undefined') {
  window.__HABIOO_API_BASE__ = API_BASE_URL
  const originalFetch = window.fetch.bind(window)
  let sessionEndEventDispatched = false

  const getTargetErrorPath = (status) => {
    if (status === 403) return '/error-403'
    if (status === 500) return '/error-500'
    if (status === 503) return '/error-503'
    return ''
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
      if (errorPath && window.location.pathname !== errorPath) {
        window.location.replace(errorPath)
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
