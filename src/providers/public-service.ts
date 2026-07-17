import { parseAnalysisResult, parseComparisonResult, parseCorrectionResult } from '../analysis/schemas'
import type { PublicAnalysisOptions, PublicAnalysisResponse, PublicServiceConfig, PublicTaskOptions } from '../public-service/types'
import { ProviderError, friendlyError } from './errors'

export function toPublicAnalysisOptions(analysis: PublicAnalysisOptions): PublicAnalysisOptions {
  const {
    sourceLanguage,
    explanationLanguage,
    translationLanguage,
    preset,
    detail,
    learnerLevel,
    terminology,
    modules,
    moduleDepths,
    exampleCount,
  } = analysis

  return {
    sourceLanguage,
    explanationLanguage,
    translationLanguage,
    preset,
    detail,
    learnerLevel,
    terminology,
    modules: { ...modules },
    moduleDepths: { ...moduleDepths },
    exampleCount,
  }
}

async function jsonOrThrow(response: Response) {
  const data = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
  if (!response.ok) {
    throw new ProviderError(data?.error?.message ?? `公共服务暂时不可用 (${response.status})。`, data?.error?.code ?? 'public_service_error', response.status)
  }
  return data
}

export async function loadPublicServiceConfig(signal?: AbortSignal): Promise<PublicServiceConfig> {
  const response = await fetch('/api/config', { signal, headers: { Accept: 'application/json' } })
  return await jsonOrThrow(response) as unknown as PublicServiceConfig
}

export async function analyzeWithPublicService(
  text: string,
  analysis: PublicAnalysisOptions,
  turnstileToken: string,
  task: PublicTaskOptions = { mode: 'analyze' },
  signal?: AbortSignal,
): Promise<PublicAnalysisResponse> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text, analysis: toPublicAnalysisOptions(analysis), turnstileToken, ...task }),
    })
    const data = await jsonOrThrow(response) as unknown as PublicAnalysisResponse
    const raw = JSON.stringify(data.result)
    const result = task.mode === 'correct' ? parseCorrectionResult(raw, text)
      : task.mode === 'compare' ? parseComparisonResult(raw, text, task.comparisonText ?? '')
        : parseAnalysisResult(raw, text)
    return { ...data, result }
  } catch (error) {
    throw friendlyError(error)
  }
}
