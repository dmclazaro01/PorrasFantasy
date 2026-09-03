import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Tema: aplica el claro antes del primer render si el usuario lo eligió (oscuro por defecto).
try {
  if (localStorage.getItem('porra-theme') === 'light') {
    document.documentElement.dataset.theme = 'light'
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
