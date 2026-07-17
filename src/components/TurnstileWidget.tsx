import { useEffect, useRef, useState } from 'react'

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

interface Props {
  siteKey: string
  resetKey: number
  onToken: (token: string) => void
  onError: (message: string) => void
}

const scriptId = 'cloudflare-turnstile-script'

function loadTurnstileScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) { resolve(); return }
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('安全验证组件加载失败。')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('安全验证组件加载失败。'))
    document.head.appendChild(script)
  })
}

export function TurnstileWidget({ siteKey, resetKey, onToken, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let disposed = false
    let widgetId = ''
    setLoading(true)
    onToken('')
    loadTurnstileScript().then(() => {
      if (disposed || !containerRef.current || !window.turnstile) return
      containerRef.current.replaceChildren()
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        size: 'flexible',
        language: 'zh-cn',
        action: 'analyze',
        callback: (token: string) => { setLoading(false); onToken(token) },
        'expired-callback': () => { onToken(''); onError('安全验证已过期，请重新验证。') },
        'error-callback': () => { setLoading(false); onToken(''); onError('安全验证失败，请刷新后重试。') },
      })
    }).catch((error: Error) => { setLoading(false); onError(error.message) })
    return () => {
      disposed = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey, resetKey, onToken, onError])

  return <div className="turnstile-wrap"><div ref={containerRef} />{loading && <small>正在准备安全验证…</small>}</div>
}
