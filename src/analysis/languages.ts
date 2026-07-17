import { franc } from 'franc-min'

export const LANGUAGES = [
  ['auto', '自动检测'], ['mixed', '混合语言'], ['en', '英语'], ['zh-CN', '中文'], ['ja', '日语'], ['ko', '韩语'],
  ['fr', '法语'], ['de', '德语'], ['es', '西班牙语'], ['it', '意大利语'], ['pt', '葡萄牙语'], ['ru', '俄语'], ['ar', '阿拉伯语'],
] as const

export const EXPLANATION_LANGUAGES = LANGUAGES.filter(([code]) => !['auto', 'mixed'].includes(code))

const strategies: Record<string, string> = {
  en: 'Focus on clause roles, tense/aspect, voice, non-finite constructions, collocations, reference, and logical connectors.',
  ja: 'Focus on segmentation, kanji readings, particles, conjugation, modifier scope, omitted arguments, honorifics, sentence-final forms, contractions, and nuance.',
  ko: 'Focus on stems and endings, particles, speech levels, tense/aspect, connective endings, modifiers, omission, and formality.',
  'zh-CN': 'Focus on topic-comment and subject-predicate structure, serial verbs, pivotal constructions, 把/被 patterns, complements, contextual omission, idioms, and pragmatics.',
  fr: 'Focus on conjugation, gender/number agreement, articles, mood, tense, clitic placement, liaison where useful, and register.',
  es: 'Focus on conjugation, gender/number agreement, mood, tense/aspect, pronoun placement, pro-drop, and register.',
  de: 'Focus on case, gender, agreement, verb position, separable verbs, clause structure, and word-order effects.',
  ru: 'Focus on case, aspect, inflection, agreement, flexible word order, motion verbs, and information structure.',
  ar: 'Focus on roots and patterns, morphology, agreement, case/mood where expressed, clitics, diglossia, and right-to-left presentation.',
  mixed: 'Identify language switches and analyze each span with the grammar system appropriate to that language.',
  auto: 'First identify the language cautiously, then apply its native grammatical framework and explicitly note uncertainty.',
}

export function getLanguageStrategy(code: string): string {
  return strategies[code] ?? 'Use the source language’s own grammatical tradition and explain language-specific morphology, syntax, semantics, and pragmatics.'
}

const francLanguageMap: Record<string, string> = {
  eng: 'en', cmn: 'zh-CN', jpn: 'ja', kor: 'ko', fra: 'fr', deu: 'de', spa: 'es', ita: 'it', por: 'pt', rus: 'ru', arb: 'ar',
}

const francSupportedLanguages = Object.keys(francLanguageMap)

export function detectLanguageLocally(text: string): string {
  if (!text.trim()) return 'auto'
  const scripts = [
    ['ja', /[\u3040-\u30ff]/u], ['ko', /[\uac00-\ud7af]/u], ['ar', /[\u0600-\u06ff]/u], ['ru', /[\u0400-\u04ff]/u], ['zh-CN', /[\u3400-\u9fff]/u],
  ] as const
  const matched = scripts.filter(([, regex]) => regex.test(text)).map(([code]) => code)
  if (matched.includes('ja')) return 'ja'
  if (matched.length > 1) return 'mixed'
  if (matched.length === 1) return matched[0]

  // Script alone cannot distinguish languages written with Latin letters.  Use
  // franc's character-trigram models, constrained to the languages available
  // in the UI, and leave very short/ambiguous input for the model to decide.
  const letters = text.match(/\p{L}/gu)?.length ?? 0
  if (letters < 10) return 'auto'
  return francLanguageMap[franc(text, { only: francSupportedLanguages, minLength: 10 })] ?? 'auto'
}

export function isRtlLanguage(code: string): boolean {
  return ['ar', 'he', 'fa', 'ur'].includes(code)
}
