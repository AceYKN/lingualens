import { z } from 'zod'
import { buildPrompt } from '../../src/analysis/prompt-builder'
import { LANGUAGES, EXPLANATION_LANGUAGES } from '../../src/analysis/languages'
import { ANALYSIS_MODULES, allModuleDepths } from '../../src/analysis/modules'
import { DEFAULT_ANALYSIS } from '../../src/analysis/presets'
import { parseAnalysisResult } from '../../src/analysis/schemas'
import { PUBLIC_DAILY_LIMIT, PUBLIC_INPUT_LIMIT, PUBLIC_MINUTE_LIMIT } from '../../src/public-service/types'
import type { AnalysisConfig, DetailLevel } from '../../src/types/config'
import { boundedInteger, json, publicOutputCeiling, serviceAvailability, type PagesContextLike, type PublicEnv } from '../_lib/runtime'

const sourceLanguages = LANGUAGES.map(([code]) => code)
const explanationLanguages = EXPLANATION_LANGUAGES.map(([code]) => code)
const moduleIds = ANALYSIS_MODULES.map(({ id }) => id)
const detailLevels = ['minimal', 'concise', 'standard', 'detailed', 'expert'] as const

const analysisSchema = z.object({
  sourceLanguage: z.string().refine((value) => sourceLanguages.includes(value as never)),
  explanationLanguage: z.string().refine((value) => explanationLanguages.includes(value as never)),
  translationLanguage: z.string().refine((value) => explanationLanguages.includes(value as never)),
  preset: z.enum(['quick', 'standard', 'deep', 'custom']),
  detail: z.enum(detailLevels),
  learnerLevel: z.enum(['beginner-zero', 'beginner', 'intermediate', 'advanced', 'linguist']),
  terminology: z.enum(['plain', 'explained', 'professional']),
  modules: z.record(z.string(), z.boolean()).refine((modules) => Object.keys(modules).every((id) => moduleIds.includes(id))).refine((modules) => Object.values(modules).some(Boolean)),
  moduleDepths: z.record(z.string(), z.enum(detailLevels)).refine((depths) => Object.keys(depths).every((id) => moduleIds.includes(id))),
  exampleCount: z.number().int().min(0).max(5),
}).strict()

const requestSchema = z.object({
  text: z.string().trim().min(1).max(PUBLIC_INPUT_LIMIT),
  analysis: analysisSchema,
  turnstileToken: z.string().min(1).max(4096),
}).strict()

interface ChatCompletionData {
  choices?: Array<{ finish_reason?: string | null; message?: { content?: unknown } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly headers?: HeadersInit
  constructor(message: string, code: string, status: number, headers?: HeadersInit) {
    super(message)
    this.code = code
    this.status = status
    this.headers = headers
  }
}

function safeAnalysis(input: z.infer<typeof analysisSchema>): AnalysisConfig {
  const modules = Object.fromEntries(moduleIds.map((id) => [id, Boolean(input.modules[id])]))
  const moduleDepths = Object.fromEntries(moduleIds.map((id) => [id, input.moduleDepths[id] ?? allModuleDepths[id]])) as Record<string, DetailLevel>
  return {
    ...DEFAULT_ANALYSIS,
    ...input,
    modules,
    moduleDepths,
    customInstructions: '',
    promptTemplate: DEFAULT_ANALYSIS.promptTemplate,
    outputFormat: 'cards',
    maxInputLength: PUBLIC_INPUT_LIMIT,
  }
}

function outputBudget(analysis: AnalysisConfig, env: PublicEnv) {
  const ceiling = publicOutputCeiling(env)
  if (analysis.preset === 'quick') return Math.min(5000, ceiling)
  if (analysis.preset === 'standard') return Math.min(9000, ceiling)
  if (analysis.preset === 'deep') return ceiling
  const activeModules = Object.values(analysis.modules).filter(Boolean).length
  const detailBonus = analysis.detail === 'expert' ? 3000 : analysis.detail === 'detailed' ? 1500 : 0
  return Math.min(ceiling, 4000 + activeModules * 900 + detailBonus)
}

function taipeiDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

async function readCount(env: PublicEnv, key: string) {
  const raw = await env.QUOTA_KV!.get(key)
  const count = Number(raw)
  return Number.isInteger(count) && count >= 0 ? count : 0
}

async function consumeQuota(env: PublicEnv, request: Request) {
  const ip = request.headers.get('CF-Connecting-IP')
  if (!ip) throw new ApiError('无法确认访客来源，请通过 Cloudflare 部署地址访问。', 'visitor_identity_unavailable', 503)
  const visitor = encodeURIComponent(ip)
  const day = taipeiDate()
  const minute = Math.floor(Date.now() / 60000)
  const visitorDayKey = `quota:visitor:day:${day}:${visitor}`
  const visitorMinuteKey = `quota:visitor:minute:${minute}:${visitor}`
  const globalKey = `quota:global:day:${day}`
  const globalLimit = boundedInteger(env.GLOBAL_DAILY_LIMIT, 5000, 50, 1000000)
  const [dailyCount, minuteCount, globalCount] = await Promise.all([
    readCount(env, visitorDayKey), readCount(env, visitorMinuteKey), readCount(env, globalKey),
  ])
  if (minuteCount >= PUBLIC_MINUTE_LIMIT) {
    const retryAfter = String(60 - (Math.floor(Date.now() / 1000) % 60))
    throw new ApiError(`请求过快：每分钟最多 ${PUBLIC_MINUTE_LIMIT} 次。`, 'minute_limit', 429, { 'Retry-After': retryAfter })
  }
  if (dailyCount >= PUBLIC_DAILY_LIMIT) throw new ApiError(`今日免费额度已用完（${PUBLIC_DAILY_LIMIT} 次），明天再来或使用自备 Key。`, 'daily_limit', 429)
  if (globalCount >= globalLimit) throw new ApiError('今日全站免费额度已用完，请明天再来或使用自备 Key。', 'global_daily_limit', 503)
  await Promise.all([
    env.QUOTA_KV!.put(visitorMinuteKey, String(minuteCount + 1), { expirationTtl: 120 }),
    env.QUOTA_KV!.put(visitorDayKey, String(dailyCount + 1), { expirationTtl: 172800 }),
    env.QUOTA_KV!.put(globalKey, String(globalCount + 1), { expirationTtl: 172800 }),
  ])
  return { minuteRemaining: PUBLIC_MINUTE_LIMIT - minuteCount - 1, dailyRemaining: PUBLIC_DAILY_LIMIT - dailyCount - 1 }
}

async function validateTurnstile(env: PublicEnv, request: Request, token: string) {
  const form = new FormData()
  form.set('secret', env.TURNSTILE_SECRET_KEY!)
  form.set('response', token)
  const ip = request.headers.get('CF-Connecting-IP')
  if (ip) form.set('remoteip', ip)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  if (!response.ok) throw new ApiError('安全验证服务暂时不可用，请稍后重试。', 'turnstile_unavailable', 503)
  const result = await response.json() as { success?: boolean; action?: string; hostname?: string }
  const expectedHostname = new URL(request.url).hostname
  if (!result.success || result.action !== 'analyze' || (result.hostname && result.hostname !== expectedHostname)) {
    throw new ApiError('安全验证失败或已过期，请重新验证。', 'turnstile_invalid', 403)
  }
}

function extractText(data: ChatCompletionData) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return content.map((block) => {
    if (typeof block === 'string') return block
    if (block && typeof block === 'object' && 'text' in block && typeof block.text === 'string') return block.text
    return ''
  }).join('').trim()
  return ''
}

function usageOf(responses: ChatCompletionData[]) {
  if (!responses.some((item) => item.usage)) return undefined
  return responses.reduce((usage, item) => ({
    promptTokens: usage.promptTokens + (item.usage?.prompt_tokens ?? 0),
    completionTokens: usage.completionTokens + (item.usage?.completion_tokens ?? 0),
    totalTokens: usage.totalTokens + (item.usage?.total_tokens ?? 0),
  }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
}

async function callDeepSeek(env: PublicEnv, messages: Array<{ role: string; content: string }>, maxTokens: number, requestSignal: AbortSignal) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  requestSignal.addEventListener('abort', onAbort)
  const timeout = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages,
        temperature: 0.2,
        top_p: 1,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
      }),
    })
    if (!response.ok) {
      if (response.status === 429) throw new ApiError('模型服务当前繁忙或项目额度不足，请稍后重试。', 'provider_rate_limit', 503)
      if (response.status === 401 || response.status === 403) throw new ApiError('公共模型凭据配置异常，请联系站点维护者。', 'provider_credentials', 503)
      throw new ApiError(`模型服务暂时不可用 (${response.status})。`, 'provider_error', 502)
    }
    return await response.json() as ChatCompletionData
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('模型响应超时，请稍后重试。', 'provider_timeout', 504)
    throw new ApiError('无法连接模型服务，请稍后重试。', 'provider_network', 502)
  } finally {
    clearTimeout(timeout)
    requestSignal.removeEventListener('abort', onAbort)
  }
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError('仅允许从语镜网页发起请求。', 'origin_rejected', 403)
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new ApiError('请求格式必须是 JSON。', 'invalid_content_type', 415)
}

export async function onRequestPost({ request, env }: PagesContextLike) {
  try {
    const availability = serviceAvailability(env)
    if (!availability.ready) throw new ApiError(availability.message!, 'service_not_configured', 503)
    assertSameOrigin(request)
    const declaredLength = Number(request.headers.get('Content-Length') || 0)
    if (declaredLength > 30000) throw new ApiError('请求内容过大。', 'payload_too_large', 413)
    const rawBody = await request.text()
    if (rawBody.length > 30000) throw new ApiError('请求内容过大。', 'payload_too_large', 413)
    const input = requestSchema.parse(JSON.parse(rawBody))
    await validateTurnstile(env, request, input.turnstileToken)
    const quota = await consumeQuota(env, request)
    const analysis = safeAnalysis(input.analysis)
    const maxTokens = outputBudget(analysis, env)
    const messages = [
      { role: 'system', content: buildPrompt(input.text, analysis) },
      { role: 'user', content: `<source_text>${input.text}</source_text>` },
    ]
    let data = await callDeepSeek(env, messages, maxTokens, request.signal)
    const responses = [data]
    let raw = extractText(data)
    if (!raw && (!data.choices?.[0]?.finish_reason || data.choices[0].finish_reason === 'stop')) {
      data = await callDeepSeek(env, [...messages, { role: 'user', content: 'Return one compact, complete JSON object now. Do not output whitespace, reasoning, or markdown.' }], maxTokens, request.signal)
      responses.push(data)
      raw = extractText(data)
    }
    if (!raw) throw new ApiError('模型没有生成有效结果，请重试。', 'empty_response', 502)
    if (raw.includes(env.DEEPSEEK_API_KEY!)) throw new ApiError('模型结果触发安全检查，已阻止返回。', 'response_blocked', 502)
    let result
    try { result = parseAnalysisResult(raw, input.text) } catch { throw new ApiError('模型返回格式不兼容，请重试。', 'invalid_model_response', 502) }
    return json({ result, usage: usageOf(responses), quota })
  } catch (error) {
    if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status, error.headers)
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: { code: 'invalid_request', message: '请求参数不符合公共服务规则。' } }, 400)
    return json({ error: { code: 'internal_error', message: '公共服务发生内部错误，请稍后重试。' } }, 500)
  }
}
