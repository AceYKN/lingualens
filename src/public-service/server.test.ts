import { describe, expect, it } from 'vitest'
import { onRequestGet } from '../../functions/api/config'
import { onRequestPost } from '../../functions/api/analyze'

const kv = {
  async get() { return null },
  async put() { /* test double */ },
}

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
})
