import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from '../../functions/api/config'
import { onRequestPost } from '../../functions/api/analyze'

const kv = {
  async get() { return null },
  async put() { /* test double */ },
}

afterEach(() => vi.unstubAllGlobals())

describe('public service boundary', () => {
  it('fails closed when production bindings are incomplete', async () => {
    const response = await onRequestGet({ request: new Request('https://example.com/api/config'), env: {} })
    const body = await response.json() as { available: boolean; dailyLimit: number; minuteLimit: number }
    expect(body.available).toBe(false)
    expect(body.minuteLimit).toBe(10)
    expect(body.dailyLimit).toBe(50)
  })

  it('rejects attempts to inject a model before calling external services', async () => {
    const response = await onRequestPost({
      request: new Request('https://example.com/api/analyze', {
        method: 'POST',
        headers: { Origin: 'https://example.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
        body: JSON.stringify({
          text: 'A short sentence.',
          turnstileToken: 'test-token',
          analysis: {
            sourceLanguage: 'en', explanationLanguage: 'zh-CN', translationLanguage: 'zh-CN', preset: 'quick', detail: 'concise',
            learnerLevel: 'intermediate', terminology: 'explained', modules: { summary: true }, moduleDepths: { summary: 'concise' }, exampleCount: 1,
            model: 'attacker-controlled-model',
          },
        }),
      }),
      env: {
        DEEPSEEK_API_KEY: 'server-only', TURNSTILE_SECRET_KEY: 'server-only', TURNSTILE_SITE_KEY: 'public-site-key',
        QUOTA_KV: kv,
      },
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_request' } })
  })

  it('accepts an allowlisted request and completes the Turnstile and DeepSeek flow', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/turnstile/v0/siteverify')) {
        return new Response(JSON.stringify({ success: true, action: 'analyze', hostname: 'example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === 'https://api.deepseek.com/chat/completions') {
        return new Response(JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
            metadata: { detectedLanguage: 'English' },
            summary: { meaning: '一个简短的句子。' },
          }) } }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost({
      request: new Request('https://example.com/api/analyze', {
        method: 'POST',
        headers: { Origin: 'https://example.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
        body: JSON.stringify({
          text: 'A short sentence.',
          turnstileToken: 'valid-token',
          analysis: {
            sourceLanguage: 'en', explanationLanguage: 'zh-CN', translationLanguage: 'zh-CN', preset: 'quick', detail: 'concise',
            learnerLevel: 'intermediate', terminology: 'explained', modules: { summary: true }, moduleDepths: { summary: 'concise' }, exampleCount: 1,
          },
        }),
      }),
      env: {
        DEEPSEEK_API_KEY: 'server-only', TURNSTILE_SECRET_KEY: 'server-only', TURNSTILE_SITE_KEY: 'public-site-key',
        QUOTA_KV: kv,
      },
    })
    const body = await response.json() as { result: { summary: { meaning: string } }; usage: { totalTokens: number }; quota: { dailyRemaining: number } }

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(body.result.summary.meaning).toBe('一个简短的句子。')
    expect(body.usage.totalTokens).toBe(120)
    expect(body.quota.dailyRemaining).toBe(49)
  })
})
