import { buildPrompt, buildSourceMessage } from '../analysis/prompt-builder'
import type { TaskMode } from '../types/analysis'
import type { AnalysisConfig } from '../types/config'

const depthWeight: Record<string, number> = { minimal: 0.5, concise: 0.72, standard: 1, detailed: 1.42, expert: 1.9 }
const moduleBase: Record<string, number> = {
  summary: 110, translations: 210, segments: 80, grammar: 230, vocabulary: 190,
  structure: 135, pronunciation: 95, usage: 120, ambiguities: 100, examples: 145,
}

export interface TokenEstimate {
  input: number
  outputLow: number
  outputHigh: number
  totalLow: number
  totalHigh: number
}

export function estimateTextTokens(value: string): number {
  if (!value.trim()) return 0
  const cjk = value.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/gu)?.length ?? 0
  const withoutCjk = value.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/gu, ' ')
  const wordTokens = (withoutCjk.match(/[\p{L}\p{N}]+/gu) ?? []).reduce((sum, word) => sum + Math.max(1, Math.ceil(word.length / 4)), 0)
  const punctuation = withoutCjk.match(/[^\p{L}\p{N}\s]/gu)?.length ?? 0
  return Math.max(1, Math.ceil(cjk * 1.08 + wordTokens + punctuation * 0.35))
}

export function estimateAnalysisTokens(
  text: string,
  config: AnalysisConfig,
  maxOutputTokens: number,
  mode: TaskMode = 'analyze',
  comparisonText = '',
): TokenEstimate {
  const prompt = buildPrompt(text, config, mode)
  const sourceContent = buildSourceMessage(text, mode, comparisonText)
  const input = estimateTextTokens(`${prompt}\n${sourceContent}`) + 8
  const sourceTokens = estimateTextTokens(mode === 'compare' ? `${text}\n${comparisonText}` : text)
  const lengthFactor = Math.min(4, Math.max(0.8, 0.78 + sourceTokens / 90))
  const analysisExpected = Object.entries(config.modules).reduce((sum, [id, active]) => {
    if (!active) return sum
    const depth = config.moduleDepths[id] ?? config.detail
    return sum + (moduleBase[id] ?? 100) * (depthWeight[depth] ?? 1)
  }, 0)
  const taskExpected = mode === 'correct' ? 420 : 620
  const expected = (mode === 'analyze' ? analysisExpected : taskExpected) * lengthFactor * (0.85 + (depthWeight[config.detail] ?? 1) * 0.15)
  const outputHigh = Math.max(1, Math.min(maxOutputTokens, Math.ceil(expected * 1.25)))
  const outputLow = Math.min(outputHigh, Math.max(1, Math.ceil(expected * 0.68)))
  return { input, outputLow, outputHigh, totalLow: input + outputLow, totalHigh: input + outputHigh }
}

export function compactTokens(value: number): string {
  if (value < 1000) return String(value)
  const digits = value < 10000 ? 1 : 0
  return `${(value / 1000).toFixed(digits)}k`
}
