import type { LLMProvider } from './types'
import type { ProviderConfig } from '../types/config'
import { parseAnalysisResult } from '../analysis/schemas'
import { ProviderError, friendlyError } from './errors'

function endpoint(config: ProviderConfig) {
  const base = config.baseUrl.replace(/\/$/, '')
  const path = config.path.startsWith('/') ? config.path : `/${config.path}`
  return `${base}${path}`
}

async function send(config: ProviderConfig, apiKey: string, messages: Array<{ role: string; content: string }>, signal?: AbortSignal) {
  const timeout = new AbortController()
  const timer = window.setTimeout(() => timeout.abort(), config.timeoutMs)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const response = await fetch(endpoint(config), {
      method: 'POST', signal: timeout.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: config.model, messages, temperature: config.temperature, max_tokens: config.maxTokens, top_p: config.topP, response_format: { type: 'json_object' } }),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const details = body.slice(0, 300).replace(apiKey, '[REDACTED]')
      const map: Record<number, [string, string]> = {
        401: ['API Key 无效或无权访问该服务。', 'invalid_key'], 403: ['请求被服务商拒绝，请检查权限或浏览器访问策略。', 'forbidden'],
        404: ['API 地址、请求路径或模型不存在。', 'not_found'], 429: ['请求过于频繁、额度不足或余额不足。', 'rate_limit'],
      }
      const [message, code] = map[response.status] ?? [`API 返回错误 (${response.status})${details ? `：${details}` : ''}`, 'api_error']
      throw new ProviderError(message, code, response.status)
    }
    return response.json() as Promise<{
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }>
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export const openAICompatibleProvider: LLMProvider = {
  async testConnection(config, apiKey, signal) {
    try {
      const data = await send(config, apiKey, [{ role: 'user', content: 'Reply with exactly {"ok":true} as JSON.' }], signal)
      if (!data.choices?.[0]?.message?.content) return { ok: false, message: '连接成功，但返回格式与 OpenAI Chat Completions 不兼容。', code: 'incompatible' }
      return { ok: true, message: `连接成功，模型 ${config.model} 可以访问。` }
    } catch (error) {
      const parsed = friendlyError(error)
      return { ok: false, message: parsed.message, code: parsed.code }
    }
  },
  async analyze(request, config, apiKey, signal) {
    try {
      const data = await send(config, apiKey, [{ role: 'system', content: request.prompt }, { role: 'user', content: `<source_text>${request.text}</source_text>` }], signal)
      const raw = data.choices?.[0]?.message?.content
      if (!raw) throw new ProviderError('模型返回为空或格式不兼容。', 'empty_response')
      if (apiKey && raw.includes(apiKey)) throw new ProviderError('模型结果意外包含 API Key，已阻止展示与导出。请立即轮换该 Key。', 'credential_echo')
      const usage = data.usage?.total_tokens !== undefined ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens,
      } : undefined
      return { result: parseAnalysisResult(raw, request.text), raw, usage }
    } catch (error) { throw friendlyError(error) }
  },
}
