import { z } from 'zod'
import type { AppConfig } from '../types/config'
import { DEFAULT_PROVIDER } from '../types/config'
import { DEFAULT_ANALYSIS } from '../analysis/presets'
import type { ConnectionMode } from '../public-service/types'

const SETTINGS_KEY = 'lingualens:settings:v1'
const API_KEY = 'lingualens:api-key:v1'
const CONNECTION_MODE = 'lingualens:connection-mode:v1'

export const defaultAppConfig = (): AppConfig => ({ version: 1, provider: { ...DEFAULT_PROVIDER }, analysis: { ...DEFAULT_ANALYSIS, modules: { ...DEFAULT_ANALYSIS.modules }, moduleDepths: { ...DEFAULT_ANALYSIS.moduleDepths } } })

const importedSchema = z.object({
  version: z.literal(1),
  provider: z.object({
    baseUrl: z.string().url(), path: z.string(), model: z.string(), temperature: z.number().min(0).max(2), maxTokens: z.number().int().min(1).max(200000),
    topP: z.number().min(0).max(1), timeoutMs: z.number().int().min(1000).max(300000), rememberKey: z.boolean(),
  }).strict(),
  analysis: z.object({
    sourceLanguage: z.string(), explanationLanguage: z.string(), translationLanguage: z.string(), preset: z.enum(['quick', 'standard', 'deep', 'custom']),
    detail: z.enum(['minimal', 'concise', 'standard', 'detailed', 'expert']), learnerLevel: z.enum(['beginner-zero', 'beginner', 'intermediate', 'advanced', 'linguist']),
    terminology: z.enum(['plain', 'explained', 'professional']), modules: z.record(z.string(), z.boolean()), moduleDepths: z.record(z.string(), z.enum(['minimal', 'concise', 'standard', 'detailed', 'expert'])),
    customInstructions: z.string().max(10000), promptTemplate: z.string().max(30000), outputFormat: z.enum(['cards', 'markdown', 'json', 'text']),
    maxInputLength: z.number().int().min(1).max(50000), exampleCount: z.number().int().min(0).max(10),
  }).strict(),
}).strict()

export function loadSettings(): AppConfig {
  try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? importedSchema.parse(JSON.parse(raw)) : defaultAppConfig() } catch { return defaultAppConfig() }
}

export function saveSettings(config: AppConfig) {
  const safe = structuredClone(config)
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe))
}

export function loadSavedApiKey() { return localStorage.getItem(API_KEY) ?? '' }
export function saveApiKey(key: string) { if (key) localStorage.setItem(API_KEY, key); else localStorage.removeItem(API_KEY) }
export function loadConnectionMode(): ConnectionMode { return localStorage.getItem(CONNECTION_MODE) === 'byok' ? 'byok' : 'public' }
export function saveConnectionMode(mode: ConnectionMode) { localStorage.setItem(CONNECTION_MODE, mode) }
export function clearAllData() { localStorage.removeItem(SETTINGS_KEY); localStorage.removeItem(API_KEY); localStorage.removeItem(CONNECTION_MODE) }
export function parseImportedConfig(raw: string): AppConfig { return importedSchema.parse(JSON.parse(raw)) }
