import type { AnalysisResult } from '../types/analysis'
import type { AppConfig } from '../types/config'

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const stringifyValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value, null, 2)

export function resultToMarkdown(result: AnalysisResult): string {
  const lines = [`# LinguaLens 分析结果`, '', `**语言：** ${result.metadata.detectedLanguage}`, '', `## 核心含义`, '', result.summary.meaning]
  Object.entries(result).filter(([key]) => !['metadata', 'summary'].includes(key)).forEach(([key, value]) => {
    if (value && (!Array.isArray(value) || value.length)) lines.push('', `## ${key}`, '', '```json', stringifyValue(value), '```')
  })
  return lines.join('\n')
}

export function exportConfig(config: AppConfig) { downloadFile('lingualens-config.json', JSON.stringify(config, null, 2), 'application/json') }

