export type PresetId = 'quick' | 'standard' | 'deep' | 'custom'
export type DetailLevel = 'minimal' | 'concise' | 'standard' | 'detailed' | 'expert'
export type LearnerLevel = 'beginner-zero' | 'beginner' | 'intermediate' | 'advanced' | 'linguist'
export type TerminologyLevel = 'plain' | 'explained' | 'professional'
export type OutputFormat = 'cards' | 'markdown' | 'json' | 'text'

export interface ProviderConfig {
  baseUrl: string
  path: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  timeoutMs: number
  rememberKey: boolean
}

export interface AnalysisConfig {
  sourceLanguage: string
  explanationLanguage: string
  translationLanguage: string
  preset: PresetId
  detail: DetailLevel
  learnerLevel: LearnerLevel
  terminology: TerminologyLevel
  modules: Record<string, boolean>
  moduleDepths: Record<string, DetailLevel>
  customInstructions: string
  promptTemplate: string
  outputFormat: OutputFormat
  maxInputLength: number
  exampleCount: number
}

export interface AppConfig {
  version: 1
  provider: ProviderConfig
  analysis: AnalysisConfig
}

export const DEFAULT_PROVIDER: ProviderConfig = {
  baseUrl: 'https://api.openai.com/v1',
  path: '/chat/completions',
  model: 'gpt-4.1-mini',
  temperature: 0.2,
  maxTokens: 3000,
  topP: 1,
  timeoutMs: 60000,
  rememberKey: false,
}
