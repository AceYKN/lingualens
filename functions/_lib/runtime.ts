export interface KVNamespaceLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export interface PublicEnv {
  DEEPSEEK_API_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  TURNSTILE_SITE_KEY?: string
  QUOTA_KV?: KVNamespaceLike
  DEEPSEEK_MODEL?: string
  PUBLIC_MAX_OUTPUT_TOKENS?: string
  GLOBAL_DAILY_LIMIT?: string
}

export interface PagesContextLike {
  request: Request
  env: PublicEnv
}

export const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...Object.fromEntries(new Headers(extraHeaders)) } })
}

export function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

export function serviceAvailability(env: PublicEnv) {
  const ready = Boolean(env.DEEPSEEK_API_KEY && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.QUOTA_KV)
  return {
    ready,
    message: ready ? undefined : '公共服务尚未完成 DeepSeek、Turnstile 或 KV 配置，请暂时使用自备 Key 模式。',
  }
}

export function publicOutputCeiling(env: PublicEnv) {
  return boundedInteger(env.PUBLIC_MAX_OUTPUT_TOKENS, 16000, 4000, 32000)
}
