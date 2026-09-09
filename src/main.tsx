import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Tema: aplica el guardado antes del primer render (taberna por defecto).
try {
  const t = localStorage.getItem('porra-theme')
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t
  } else {
    document.documentElement.dataset.theme = 'taberna'
  }
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: registra el service worker (habilita "Instalar app" y uso offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
