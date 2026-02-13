import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'
import './styles/ignite-theme.css'
import './utils/fontAwesome'

// 👇 Force supabaseClient.js to initialize
import './lib/supabaseClient'

// Feature-flagged: Sentry monitoring (frontend)
try {
  // eslint-disable-next-line no-undef
  const enable = String(import.meta.env?.VITE_ENABLE_SENTRY || 'false').toLowerCase() === 'true'
  // eslint-disable-next-line no-undef
  const dsn = import.meta.env?.VITE_SENTRY_DSN
  if (enable && dsn) {
    Sentry.init({ dsn, environment: import.meta.env?.MODE || 'development', tracesSampleRate: 0.1 })
    // eslint-disable-next-line no-console
    console.log('[Monitoring] Sentry (frontend) enabled')
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
