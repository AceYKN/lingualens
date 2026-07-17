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

export interface AnalysisRequest {
  text: string
  prompt: string
}

export interface ProviderResponse {
  result: AnalysisResult
  raw: string
  usage?: TokenUsage
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type TestResult = { ok: true; message: string } | { ok: false; message: string; code: string }
