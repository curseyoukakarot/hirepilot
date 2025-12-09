/* global __APP_BUILD_ID__ */
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

const CURRENT_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined'
    ? __APP_BUILD_ID__
    : import.meta?.env?.VITE_APP_VERSION || 'dev'

const CHECK_INTERVAL_MS = 60_000

// Watches for new deployments and chunk-load failures, then prompts the user
// to refresh instead of showing a hard error screen.
export default function useVersionNotifier() {
  const toastIdRef = useRef(null)
  const promptedRef = useRef(false)

  useEffect(() => {
    const showRefreshPrompt = () => {
      if (promptedRef.current) return
      promptedRef.current = true
      toastIdRef.current = toast.custom(
        (t) => (
          <div className="bg-slate-900 text-white shadow-xl rounded-lg p-4 border border-slate-700 max-w-sm">
            <div className="font-semibold">A new version is available</div>
            <div className="text-sm text-slate-200 mt-1">
              We just shipped an update. Refresh to stay in sync.
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 rounded-md bg-purple-500 text-white hover:bg-purple-600 transition"
              >
                Refresh now
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 transition"
              >
                Later
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'app-version-update' }
      )
    }

    const handleChunkError = (event) => {
      const message = event?.message || ''
      const target = event?.target
      const isChunkError =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('ChunkLoadError') ||
        (target?.tagName === 'SCRIPT' && target?.src && target.src.includes('/assets/'))
      if (isChunkError) showRefreshPrompt()
    }

    const handleRejection = (event) => {
      const reason = event?.reason
      const msg = typeof reason === 'string' ? reason : reason?.message || ''
      if (msg && msg.includes('Failed to fetch dynamically imported module')) {
        showRefreshPrompt()
      }
    }

    const controller = new AbortController()

    const checkForNewBuild = async () => {
      try {
        const res = await fetch(`/build-meta.json?ts=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (json?.buildId && json.buildId !== CURRENT_BUILD_ID) {
          showRefreshPrompt()
        }
      } catch {
        // Ignore transient network errors; we'll try again on the next tick
      }
    }

    window.addEventListener('error', handleChunkError)
    window.addEventListener('unhandledrejection', handleRejection)

    const intervalId = window.setInterval(checkForNewBuild, CHECK_INTERVAL_MS)
    checkForNewBuild()

    return () => {
      window.removeEventListener('error', handleChunkError)
      window.removeEventListener('unhandledrejection', handleRejection)
      window.clearInterval(intervalId)
      controller.abort()
      if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    }
  }, [])
}

