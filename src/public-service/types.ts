import type { AnalysisConfig } from '../types/config'
import type { AnalysisResult, TaskMode, TokenUsage } from '../types/analysis'

export const PUBLIC_INPUT_LIMIT = 500
export const PUBLIC_MINUTE_LIMIT = 10
export const PUBLIC_DAILY_LIMIT = 50

export type ConnectionMode = 'public' | 'byok'

export interface PublicServiceConfig {
  available: boolean
  model: string
  turnstileSiteKey: string
  inputLimit: number
  maxOutputTokens: number
  minuteLimit: number
  dailyLimit: number
  message?: string
}

export type PublicAnalysisOptions = Pick<AnalysisConfig,
  'sourceLanguage' | 'explanationLanguage' | 'translationLanguage' | 'preset' | 'detail' |
  'learnerLevel' | 'terminology' | 'modules' | 'moduleDepths' | 'exampleCount'
>

export interface PublicQuota {
  minuteRemaining: number
  dailyRemaining: number
}

export interface PublicAnalysisResponse {
  result: AnalysisResult
  usage?: TokenUsage
  quota: PublicQuota
}

export interface PublicTaskOptions { mode: TaskMode; comparisonText?: string }
