import { z } from 'zod'

const confidence = z.string().optional()
const recordArray = z.array(z.record(z.string(), z.unknown())).max(100).optional()

export const analysisResultSchema = z.object({
  metadata: z.object({
    detectedLanguage: z.string().default('Unknown'),
    explanationLanguage: z.string().optional(),
    analysisLevel: z.string().optional(),
    confidence,
  }).passthrough().default({ detectedLanguage: 'Unknown' }),
  summary: z.object({
    meaning: z.string().default(''),
    difficulty: z.string().optional(),
    keyGrammar: z.array(z.string()).max(30).optional(),
  }).passthrough().default({ meaning: '' }),
  segments: z.array(z.object({
    text: z.string(), start: z.number().int().nonnegative().optional(), end: z.number().int().nonnegative().optional(),
    type: z.string().optional(), explanation: z.string().default(''), confidence,
  }).passthrough()).max(100).optional(),
  grammar: recordArray,
  vocabulary: recordArray,
  translations: z.object({ literal: z.string().optional(), natural: z.string().optional(), process: z.string().optional() }).passthrough().optional(),
  pronunciation: recordArray,
  structure: z.record(z.string(), z.unknown()).optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  ambiguities: recordArray,
  examples: recordArray,
}).passthrough()

export function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(cleaned) } catch { /* continue */ }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
  throw new Error('模型未返回可识别的 JSON 结果。')
}

export function parseAnalysisResult(raw: string, sourceText: string) {
  if (/<\/?(?:script|iframe|object|embed)\b/i.test(raw)) throw new Error('模型结果包含不安全的可执行标记，已阻止展示。')
  const result = analysisResultSchema.parse(extractJson(raw))
  result.segments = result.segments?.map((segment) => {
    const valid = segment.start !== undefined && segment.end !== undefined && segment.start <= segment.end && segment.end <= sourceText.length
    return valid ? segment : { ...segment, start: undefined, end: undefined }
  })
  return result
}
