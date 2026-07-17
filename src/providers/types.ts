import type { AnalysisRequest, ProviderResponse, TestResult } from '../types/analysis'
import type { ProviderConfig } from '../types/config'

export interface LLMProvider {
  testConnection(config: ProviderConfig, apiKey: string, signal?: AbortSignal): Promise<TestResult>
  analyze(request: AnalysisRequest, config: ProviderConfig, apiKey: string, signal?: AbortSignal): Promise<ProviderResponse>
}

