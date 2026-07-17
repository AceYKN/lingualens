import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ANALYSIS } from '../analysis/presets'
import { analyzeWithPublicService, toPublicAnalysisOptions } from './public-service'

afterEach(() => vi.unstubAllGlobals())

describe('public service request serialization', () => {
  it('removes private-mode configuration fields from the public request', () => {
    const serialized = toPublicAnalysisOptions(DEFAULT_ANALYSIS)

    expect(Object.keys(serialized)).toEqual([
      'sourceLanguage',
      'explanationLanguage',
      'translationLanguage',
      'preset',
      'detail',
      'learnerLevel',
      'terminology',
      'modules',
      'moduleDepths',
      'exampleCount',
    ])
    expect(serialized).not.toHaveProperty('customInstructions')
    expect(serialized).not.toHaveProperty('promptTemplate')
    expect(serialized).not.toHaveProperty('outputFormat')
    expect(serialized).not.toHaveProperty('maxInputLength')
  })

  it('sends only the public allowlist through the actual fetch boundary', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { analysis: Record<string, unknown> }
      expect(Object.keys(body.analysis)).toEqual(Object.keys(toPublicAnalysisOptions(DEFAULT_ANALYSIS)))
      expect(body.analysis).not.toHaveProperty('customInstructions')
      return new Response(JSON.stringify({
        result: { metadata: { detectedLanguage: 'English' }, summary: { meaning: '测试' } },
        quota: { minuteRemaining: 9, dailyRemaining: 49 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await analyzeWithPublicService('Test.', DEFAULT_ANALYSIS, 'turnstile-token')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(response.result.summary.meaning).toBe('测试')
  })
})
