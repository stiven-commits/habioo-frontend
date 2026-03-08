import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { API_BASE_URL, PROD_API_BASE_URL } from './config/api'

if (typeof window !== 'undefined') {
  window.__HABIOO_API_BASE__ = API_BASE_URL
}

if (API_BASE_URL !== PROD_API_BASE_URL && typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith(PROD_API_BASE_URL)) {
      return originalFetch(input.replace(PROD_API_BASE_URL, API_BASE_URL), init)
    }

    if (input instanceof Request && input.url.startsWith(PROD_API_BASE_URL)) {
      const replaced = new Request(input.url.replace(PROD_API_BASE_URL, API_BASE_URL), input)
      return originalFetch(replaced, init)
    }

    return originalFetch(input, init)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
