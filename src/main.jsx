import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const PROD_API_BASE = 'https://auth.habioo.cloud'
const LOCAL_API_BASE = import.meta.env.VITE_API_BASE_URL

if (LOCAL_API_BASE && typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith(PROD_API_BASE)) {
      return originalFetch(input.replace(PROD_API_BASE, LOCAL_API_BASE), init)
    }

    if (input instanceof Request && input.url.startsWith(PROD_API_BASE)) {
      const replaced = new Request(input.url.replace(PROD_API_BASE, LOCAL_API_BASE), input)
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
