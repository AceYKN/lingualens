export type Confidence = 'high' | 'medium' | 'low' | string

export interface Segment {
  text: string
  start?: number
  end?: number
  type?: string
  explanation: string
  confidence?: Confidence
}

export interface AnalysisResult {
  metadata: {
    detectedLanguage: string
    explanationLanguage?: string
    analysisLevel?: string
    confidence?: Confidence
  }
  summary: {
    meaning: string
    difficulty?: string
    keyGrammar?: string[]
  }
  segments?: Segment[]
  grammar?: Array<Record<string, unknown>>
  vocabulary?: Array<Record<string, unknown>>
  translations?: { literal?: string; natural?: string; process?: string }
  pronunciation?: Array<Record<string, unknown>>
  structure?: Record<string, unknown>
  usage?: Record<string, unknown>
  ambiguities?: Array<Record<string, unknown>>
  examples?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export type TaskMode = 'analyze' | 'correct' | 'compare'
export type CorrectionCategory = 'grammar' | 'word-choice' | 'spelling' | 'register'

export interface CorrectionIssue {
  range?: [number, number]
  original: string
  replacement?: string
  category: CorrectionCategory
  explanation: string
}

export interface CorrectionResult {
  original: string
  corrected: string
  naturalVersion?: string
  isCorrect: boolean
  issues: CorrectionIssue[]
}

export interface ComparisonResult {
  original: string
  comparison: string
  verdict: string
  differences: Array<{ aspect: string; original: string; comparison: string; explanation: string }>
}

export type TaskResult = AnalysisResult | CorrectionResult | ComparisonResult

export function isCorrectionResult(result: TaskResult): result is CorrectionResult {
  return 'corrected' in result && 'isCorrect' in result
}

export function isComparisonResult(result: TaskResult): result is ComparisonResult {
  return 'comparison' in result && 'differences' in result
}

export interface AnalysisRequest {
  text: string
  prompt: string
  mode?: TaskMode
  comparisonText?: string
}

export interface ProviderResponse {
  result: TaskResult
  raw: string
  usage?: TokenUsage
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type TestResult = { ok: true; message: string } | { ok: false; message: string; code: string }
