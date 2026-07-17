import { ANALYSIS_MODULES, allModuleDepths } from './modules'
import type { AnalysisConfig, PresetId } from '../types/config'
import { DEFAULT_PROMPT_TEMPLATE } from '../types/config'

const enabled = (...ids: string[]) => Object.fromEntries(ANALYSIS_MODULES.map((item) => [item.id, ids.includes(item.id)]))

export const PRESETS: Record<Exclude<PresetId, 'custom'>, { label: string; description: string; modules: Record<string, boolean> }> = {
  quick: { label: '快速', description: '先看懂，再深入', modules: enabled('summary', 'translations', 'grammar', 'vocabulary') },
  standard: { label: '标准', description: '学习者的均衡选择', modules: enabled('summary', 'translations', 'segments', 'grammar', 'vocabulary', 'structure', 'usage') },
  deep: { label: '深度', description: '完整语言学视角', modules: enabled(...ANALYSIS_MODULES.map((item) => item.id)) },
}

export const DEFAULT_ANALYSIS: AnalysisConfig = {
  sourceLanguage: 'auto',
  explanationLanguage: 'zh-CN',
  translationLanguage: 'zh-CN',
  preset: 'standard',
  detail: 'standard',
  learnerLevel: 'intermediate',
  terminology: 'explained',
  modules: PRESETS.standard.modules,
  moduleDepths: allModuleDepths,
  customInstructions: '',
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  outputFormat: 'cards',
  maxInputLength: 2000,
  exampleCount: 2,
}

export function applyPreset(config: AnalysisConfig, preset: PresetId): AnalysisConfig {
  if (preset === 'custom') return { ...config, preset }
  return { ...config, preset, modules: { ...PRESETS[preset].modules } }
}

