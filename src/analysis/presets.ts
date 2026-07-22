import { ANALYSIS_MODULES, ANALYSIS_MODULE_IDS, allModuleDepths } from './modules'
import { DEFAULT_PROMPT_TEMPLATE } from './prompt-builder'
import type { AnalysisConfig, DetailLevel, PresetId } from '../types/config'

export interface AnalysisPreset {
  label: string
  description: string
  detail: DetailLevel
  modules: Record<string, boolean>
}

const enabled = (...ids: string[]) => Object.fromEntries(ANALYSIS_MODULES.map((item) => [item.id, item.required || ids.includes(item.id)]))

export const PRESETS: Record<Exclude<PresetId, 'custom'>, AnalysisPreset> = {
  quick: {
    label: '快速理解', description: '看懂意思、关键句型和词语', detail: 'concise',
    modules: enabled('translations', 'grammar', 'structure', 'vocabulary'),
  },
  standard: {
    label: '学习拆解', description: '逐层理解成分、句型、词汇与语用', detail: 'standard',
    modules: enabled('translations', 'segments', 'grammar', 'vocabulary', 'structure', 'usage'),
  },
  deep: {
    label: '全面研究', description: '加入读音、歧义、例句与充分解释', detail: 'detailed',
    modules: enabled(...ANALYSIS_MODULE_IDS),
  },
}

export const DEFAULT_ANALYSIS: AnalysisConfig = {
  sourceLanguage: 'auto',
  explanationLanguage: 'zh-CN',
  translationLanguage: 'zh-CN',
  preset: 'standard',
  detail: PRESETS.standard.detail,
  learnerLevel: 'intermediate',
  terminology: 'explained',
  modules: { ...PRESETS.standard.modules },
  moduleDepths: {},
  customInstructions: '',
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  outputFormat: 'cards',
  maxInputLength: 2000,
  exampleCount: 2,
}

export function cloneAnalysisConfig(config: AnalysisConfig): AnalysisConfig {
  return { ...config, modules: { ...config.modules }, moduleDepths: { ...config.moduleDepths } }
}

export function activeModuleIds(config: AnalysisConfig): string[] {
  return ANALYSIS_MODULES.filter((module) => module.required || config.modules[module.id]).map((module) => module.id)
}

export function resolvedModuleDepth(config: AnalysisConfig, moduleId: string): DetailLevel {
  return config.moduleDepths[moduleId] ?? config.detail
}

export function applyPreset(config: AnalysisConfig, preset: PresetId): AnalysisConfig {
  if (preset === 'custom') return { ...cloneAnalysisConfig(config), preset }
  const definition = PRESETS[preset]
  return {
    ...cloneAnalysisConfig(config),
    preset,
    detail: definition.detail,
    modules: { ...definition.modules },
    moduleDepths: {},
  }
}

export function setGlobalDetail(config: AnalysisConfig, detail: DetailLevel): AnalysisConfig {
  return { ...cloneAnalysisConfig(config), preset: 'custom', detail }
}

function sameModules(left: Record<string, boolean>, right: Record<string, boolean>) {
  return ANALYSIS_MODULES.every((module) => Boolean(left[module.id]) === Boolean(right[module.id]))
}

function usesLegacyDefaultDepths(depths: Record<string, DetailLevel>) {
  return ANALYSIS_MODULE_IDS.every((id) => depths[id] === allModuleDepths[id]) && Object.keys(depths).length === ANALYSIS_MODULE_IDS.length
}

export function normalizeAnalysisConfig(config: AnalysisConfig): AnalysisConfig {
  const modules = Object.fromEntries(ANALYSIS_MODULES.map((module) => [module.id, module.required || Boolean(config.modules[module.id])]))
  let moduleDepths = Object.fromEntries(Object.entries(config.moduleDepths).filter(([id]) => ANALYSIS_MODULE_IDS.includes(id))) as Record<string, DetailLevel>
  let detail = config.detail

  // V1 stored a value for every module, which made the global detail control inert.
  // Treat the untouched legacy depth map as "follow global" during migration.
  if (usesLegacyDefaultDepths(moduleDepths)) {
    moduleDepths = {}
    if (config.preset !== 'custom') detail = PRESETS[config.preset].detail
  }

  let preset = config.preset
  if (preset !== 'custom') {
    const definition = PRESETS[preset]
    if (!sameModules(modules, definition.modules) || detail !== definition.detail || Object.keys(moduleDepths).length > 0) preset = 'custom'
  }

  const promptTemplate = config.promptTemplate.includes('Use this shape while omitting no enabled module:')
    ? DEFAULT_PROMPT_TEMPLATE
    : config.promptTemplate

  return { ...config, preset, detail, modules, moduleDepths, promptTemplate, translationLanguage: config.explanationLanguage }
}
