import type { LLMProvider } from './types'
import type { ProviderConfig } from '../types/config'
import { parseAnalysisResult, parseComparisonResult, parseCorrectionResult } from '../analysis/schemas'
import { buildSourceMessage } from '../analysis/prompt-builder'
import { ProviderError, friendlyError } from './errors'

interface ChatCompletionData {
  choices?: Array<{
    finish_reason?: string | null
    text?: string | null
    message?: { content?: unknown; reasoning_content?: string | null }
  }>
  output_text?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

export function extractResponseText(data: ChatCompletionData): string {
  const choice = data.choices?.[0]
  const content = choice?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return content.map((block) => {
    if (typeof block === 'string') return block
    if (block && typeof block === 'object' && 'text' in block && typeof block.text === 'string') return block.text
    return ''
  }).join('').trim()
  if (typeof choice?.text === 'string') return choice.text.trim()
  return typeof data.output_text === 'string' ? data.output_text.trim() : ''
}

function emptyResponseError(data: ChatCompletionData, afterRetry = false) {
  const choice = data.choices?.[0]
  const reason = choice?.finish_reason
  if (reason === 'length') return new ProviderError('模型输出达到 Max Tokens，JSON 未能完成。请提高最大输出长度或减少分析模块。', 'output_truncated')
  if (reason === 'content_filter') return new ProviderError('模型服务商过滤了本次输出，请修改文本或自定义指令后重试。', 'content_filtered')
  if (reason === 'insufficient_system_resource') return new ProviderError('模型服务暂时资源不足，请稍后重试。', 'provider_overloaded')
  if (choice?.message?.reasoning_content && !choice.message.content) return new ProviderError('模型只返回了思考内容，没有生成最终 JSON。系统已关闭思考模式，请重试；若仍失败可换用其他模型。', 'reasoning_without_answer')
  return new ProviderError(afterRetry ? '模型连续两次返回空内容。DeepSeek JSON 模式偶尔会出现此问题，请重试或提高 Max Tokens。' : '模型返回为空。', 'empty_response')
}

function collectUsage(responses: ChatCompletionData[]) {
  const usable = responses.filter((item) => item.usage?.total_tokens !== undefined)
  if (!usable.length) return undefined
  return usable.reduce((total, item) => ({
    promptTokens: total.promptTokens + (item.usage?.prompt_tokens ?? 0),
    completionTokens: total.completionTokens + (item.usage?.completion_tokens ?? 0),
    totalTokens: total.totalTokens + (item.usage?.total_tokens ?? 0),
  }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
}

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
    const body: Record<string, unknown> = { model: config.model, messages, temperature: config.temperature, max_tokens: config.maxTokens, top_p: config.topP, response_format: { type: 'json_object' } }
    if (config.baseUrl.includes('api.deepseek.com')) body.thinking = { type: 'disabled' }
    const response = await fetch(endpoint(config), {
      method: 'POST', signal: timeout.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const details = body.slice(0, 300).replaceAll(apiKey, '[REDACTED]')
      const map: Record<number, [string, string]> = {
        401: ['API Key 无效或无权访问该服务。', 'invalid_key'], 403: ['请求被服务商拒绝，请检查权限或浏览器访问策略。', 'forbidden'],
        404: ['API 地址、请求路径或模型不存在。', 'not_found'], 429: ['请求过于频繁、额度不足或余额不足。', 'rate_limit'],
      }
      const [message, code] = map[response.status] ?? [`API 返回错误 (${response.status})${details ? `：${details}` : ''}`, 'api_error']
      throw new ProviderError(message, code, response.status)
    }
    return response.json() as Promise<ChatCompletionData>
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export const openAICompatibleProvider: LLMProvider = {
  async testConnection(config, apiKey, signal) {
    try {
      const data = await send(config, apiKey, [{ role: 'user', content: 'Reply with exactly {"ok":true} as JSON.' }], signal)
      if (!extractResponseText(data)) return { ok: false, message: emptyResponseError(data).message, code: 'incompatible' }
      return { ok: true, message: `连接成功，模型 ${config.model} 可以访问。` }
    } catch (error) {
      const parsed = friendlyError(error)
      return { ok: false, message: parsed.message, code: parsed.code }
    }
  },
  async analyze(request, config, apiKey, signal) {
    try {
      const sourceContent = buildSourceMessage(request.text, request.mode ?? 'analyze', request.comparisonText)
      const messages = [{ role: 'system', content: request.prompt }, { role: 'user', content: sourceContent }]
      let data = await send(config, apiKey, messages, signal)
      const responses = [data]
      let raw = extractResponseText(data)
      if (!raw) {
        const reason = data.choices?.[0]?.finish_reason
        if (reason && reason !== 'stop') throw emptyResponseError(data)
        data = await send(config, apiKey, [...messages, { role: 'user', content: 'The previous response was empty. Return one compact, complete JSON object now. Do not output whitespace, reasoning, or markdown.' }], signal)
        responses.push(data)
        raw = extractResponseText(data)
      }
      if (!raw) throw emptyResponseError(data, true)
      if (apiKey && raw.includes(apiKey)) throw new ProviderError('模型结果意外包含 API Key，已阻止展示与导出。请立即轮换该 Key。', 'credential_echo')
      const usage = collectUsage(responses)
      const result = request.mode === 'correct'
        ? parseCorrectionResult(raw, request.text)
        : request.mode === 'compare'
          ? parseComparisonResult(raw, request.text, request.comparisonText ?? '')
          : parseAnalysisResult(raw, request.text)
      return { result, raw, usage }
    } catch (error) { throw friendlyError(error) }
  },
}
