import type { DetailLevel } from '../types/config'

export interface AnalysisModule {
  id: string
  label: string
  shortLabel: string
  description: string
  defaultDepth: DetailLevel
}

export const ANALYSIS_MODULES: AnalysisModule[] = [
  { id: 'summary', label: '核心含义', shortLabel: '含义', description: '整体意思与句子难度', defaultDepth: 'concise' },
  { id: 'translations', label: '翻译分析', shortLabel: '翻译', description: '直译、自然翻译与转换过程', defaultDepth: 'standard' },
  { id: 'segments', label: '分词与分句', shortLabel: '分段', description: '按目标语言规则切分结构', defaultDepth: 'standard' },
  { id: 'grammar', label: '语法结构', shortLabel: '语法', description: '语法点、句法关系与例句', defaultDepth: 'detailed' },
  { id: 'vocabulary', label: '词汇与短语', shortLabel: '词汇', description: '原形、词性、搭配和语境义', defaultDepth: 'standard' },
  { id: 'structure', label: '语序与省略', shortLabel: '语序', description: '语序、修饰范围与省略成分', defaultDepth: 'standard' },
  { id: 'pronunciation', label: '发音信息', shortLabel: '发音', description: 'IPA、拼音、假名或罗马字', defaultDepth: 'concise' },
  { id: 'usage', label: '语气与场景', shortLabel: '语用', description: '语域、礼貌、情绪和使用场景', defaultDepth: 'standard' },
  { id: 'ambiguities', label: '歧义分析', shortLabel: '歧义', description: '不同解释与不确定性来源', defaultDepth: 'detailed' },
  { id: 'examples', label: '相似例句', shortLabel: '例句', description: '使用相同结构的迁移练习', defaultDepth: 'standard' },
]

export const allModuleDepths = Object.fromEntries(ANALYSIS_MODULES.map((item) => [item.id, item.defaultDepth]))

