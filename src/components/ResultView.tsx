import {
  AudioLines, BookOpenText, Braces, Check, Copy, Download, FileJson, FileText,
  GitBranch, Info, Languages, Lightbulb, MessageCircleMore, Sparkles, TextSearch, TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { AnalysisResult, Segment, TokenUsage } from '../types/analysis'
import { ANALYSIS_MODULES } from '../analysis/modules'
import { downloadFile, resultToMarkdown } from '../utils/export'

interface Props { result: AnalysisResult; enabled: Record<string, boolean>; usage?: TokenUsage; onSegmentHover: (segment: Segment | null) => void }
type RecordItem = Record<string, unknown>

const moduleMeta: Record<string, { label: string; hint: string; icon: LucideIcon }> = {
  translations: { label: '意思与翻译', hint: '从原文结构到自然表达', icon: Languages },
  segments: { label: '成分拆解', hint: '看清句子如何组成', icon: Braces },
  grammar: { label: '语法与句型', hint: '形式、功能与判断依据', icon: BookOpenText },
  vocabulary: { label: '词语与搭配', hint: '语境义、词形和搭配', icon: TextSearch },
  structure: { label: '语序结构', hint: '语序、修饰范围与省略', icon: GitBranch },
  pronunciation: { label: '读音提示', hint: '读音与标注体系', icon: AudioLines },
  usage: { label: '语气与场景', hint: '语域、礼貌和适用场合', icon: MessageCircleMore },
  ambiguities: { label: '歧义与上下文', hint: '其他解释和判断条件', icon: TriangleAlert },
  examples: { label: '迁移例句', hint: '把目标结构用到新句子', icon: Lightbulb },
}

const keyLabels: Record<string, string> = {
  literal: '保留结构的直译', natural: '自然表达', process: '转换思路', overview: '结构总览', wordOrder: '语序说明',
  omissions: '省略成分', register: '语域', tone: '语气', contexts: '使用场景', notes: '补充说明',
  interpretation: '可能解释', reason: '判断依据', reading: '读音', system: '标注体系', text: '词语', lemma: '原形',
  partOfSpeech: '词性', meaning: '当前含义', form: '形式', function: '功能', explanation: '说明', example: '例句',
  source: '原文', translation: '翻译', note: '学习提示', type: '类型',
}

const isPresent = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
const asText = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const confidenceLabel = (value?: unknown) => value === 'high' ? '确定' : value === 'low' ? '需要上下文' : value === 'medium' ? '可能' : null
const records = (value: unknown): RecordItem[] => Array.isArray(value) ? value.filter((item): item is RecordItem => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []

function Confidence({ value }: { value?: unknown }) {
  const label = confidenceLabel(value)
  return label ? <span className={`confidence ${String(value)}`}>{label}</span> : null
}

function Chips({ values }: { values: unknown[] }) {
  return <div className="data-chips">{values.filter(isPresent).map((value, index) => <span key={`${String(value)}-${index}`}>{asText(value) || JSON.stringify(value)}</span>)}</div>
}

function SmartValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <Chips values={value} />
  if (value && typeof value === 'object') return <GenericPanel value={value as RecordItem} />
  return <p>{asText(value)}</p>
}

function GenericPanel({ value }: { value: RecordItem }) {
  const entries = Object.entries(value).filter(([key, item]) => key !== 'confidence' && isPresent(item))
  return <div className="fact-grid">{entries.map(([key, item]) => <div className="fact" key={key}><span>{keyLabels[key] ?? key}</span><SmartValue value={item} /></div>)}</div>
}

function TranslationPanel({ translations, summary }: { translations: AnalysisResult['translations']; summary: string }) {
  if (!translations) return null
  const rows = [
    translations.literal && { label: keyLabels.literal, value: translations.literal, kind: 'literal' },
    translations.natural && translations.natural.trim() !== summary.trim() && { label: keyLabels.natural, value: translations.natural, kind: 'natural' },
    translations.process && { label: keyLabels.process, value: translations.process, kind: 'process' },
  ].filter(Boolean) as Array<{ label: string; value: string; kind: string }>
  return <div className="translation-flow">{rows.map((row, index) => <div className={`translation-step ${row.kind}`} key={row.kind}><span className="flow-dot">{index + 1}</span><div><span className="data-label">{row.label}</span><p>{row.value}</p></div></div>)}</div>
}

function SegmentPanel({ segments, onHover }: { segments: Segment[]; onHover: Props['onSegmentHover'] }) {
  return <div className="segment-board">{segments.map((segment, index) => <button key={`${segment.text}-${index}`} className="segment-tile" onMouseEnter={() => onHover(segment)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(segment)} onBlur={() => onHover(null)}>
    <span className="segment-token">{segment.text}</span>{segment.type && <span className="segment-type">{segment.type.replaceAll('_', ' ')}</span>}<p>{segment.explanation}</p><Confidence value={segment.confidence} />
  </button>)}</div>
}

function GrammarPanel({ items }: { items: RecordItem[] }) {
  return <div className="grammar-grid">{items.map((item, index) => <article className="grammar-card" key={index}>
    <div className="grammar-card-head"><div><span className="data-label">语法形式</span><h4>{asText(item.form) || `语法点 ${index + 1}`}</h4></div><Confidence value={item.confidence} /></div>
    {isPresent(item.function) && <span className="function-pill">{asText(item.function)}</span>}
    {isPresent(item.explanation) && <p>{asText(item.explanation)}</p>}
    {isPresent(item.example) && <div className="example-line"><span>例</span>{asText(item.example)}</div>}
  </article>)}</div>
}

function VocabularyPanel({ items }: { items: RecordItem[] }) {
  return <div className="vocab-table"><div className="vocab-row vocab-head"><span>词语</span><span>当前含义</span><span>原形 · 词性</span><span>补充</span></div>{items.map((item, index) => <div className="vocab-row" key={index}>
    <div className="vocab-token"><strong>{asText(item.text) || asText(item.lemma)}</strong><Confidence value={item.confidence} /></div>
    <p><span className="mobile-data-label">当前含义</span>{asText(item.meaning)}</p><p><span className="mobile-data-label">原形 · 词性</span>{[asText(item.lemma), asText(item.partOfSpeech)].filter(Boolean).join(' · ')}</p><p><span className="mobile-data-label">补充</span>{asText(item.notes)}</p>
  </div>)}</div>
}

function PronunciationPanel({ items }: { items: RecordItem[] }) {
  return <div className="pronunciation-list">{items.map((item, index) => <div key={index}><strong>{asText(item.text)}</strong><span>{asText(item.reading)}</span>{isPresent(item.system) ? <small>{asText(item.system)}</small> : null}</div>)}</div>
}

function AmbiguityPanel({ items }: { items: RecordItem[] }) {
  return items.length ? <div className="ambiguity-list">{items.map((item, index) => <article key={index}><div><TriangleAlert size={17} /><strong>{asText(item.interpretation) || `解释 ${index + 1}`}</strong><Confidence value={item.confidence} /></div>{isPresent(item.reason) ? <p>{asText(item.reason)}</p> : null}</article>)}</div> : <div className="empty-module"><Check size={18} /><span>当前句子没有明显歧义</span></div>
}

function ExamplesPanel({ items }: { items: RecordItem[] }) {
  return <div className="example-grid">{items.map((item, index) => <article key={index}><span className="example-number">{String(index + 1).padStart(2, '0')}</span><h4>{asText(item.source)}</h4><p>{asText(item.translation)}</p>{isPresent(item.note) ? <small>{asText(item.note)}</small> : null}</article>)}</div>
}

function renderModule(key: string, result: AnalysisResult, onSegmentHover: Props['onSegmentHover']): ReactNode {
  if (key === 'translations') return <TranslationPanel translations={result.translations} summary={result.summary.meaning} />
  if (key === 'segments') return <SegmentPanel segments={result.segments ?? []} onHover={onSegmentHover} />
  if (key === 'grammar') return <GrammarPanel items={records(result.grammar)} />
  if (key === 'vocabulary') return <VocabularyPanel items={records(result.vocabulary)} />
  if (key === 'pronunciation') return <PronunciationPanel items={records(result.pronunciation)} />
  if (key === 'ambiguities') return <AmbiguityPanel items={records(result.ambiguities)} />
  if (key === 'examples') return <ExamplesPanel items={records(result.examples)} />
  const value = result[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? <GenericPanel value={value as RecordItem} /> : <SmartValue value={value} />
}

export function ResultView({ result, enabled, usage, onSegmentHover }: Props) {
  const available = ANALYSIS_MODULES.map((module) => module.id).filter((key) => key !== 'summary' && enabled[key] && isPresent(result[key]))
  const [active, setActive] = useState(available[0] ?? '')
  const [copied, setCopied] = useState('')
  useEffect(() => { if (!available.includes(active)) setActive(available[0] ?? '') }, [active, available])
  const copy = async (key: string, value: unknown) => { await navigator.clipboard.writeText(typeof value === 'string' ? value : JSON.stringify(value, null, 2)); setCopied(key); setTimeout(() => setCopied(''), 1500) }
  const current = moduleMeta[active]

  return <section className="results" aria-live="polite">
    <div className="result-summary">
      <div className="result-summary-copy"><div className="summary-top"><span className="language-pill">{result.metadata.detectedLanguage || '未知语言'}</span>{result.summary.difficulty && <span className="difficulty">{result.summary.difficulty}</span>}{usage && <span className="usage-pill">{usage.totalTokens.toLocaleString()} tokens</span>}<Confidence value={result.metadata.confidence} /></div><span className="eyebrow light"><Sparkles size={14} />分析结论</span><h2>{result.summary.meaning || result.translations?.natural || '分析完成'}</h2>
        {result.translations?.natural && result.translations.natural.trim() !== result.summary.meaning.trim() && <div className="summary-translation"><span>自然表达</span><p>{result.translations.natural}</p></div>}
        {result.summary.keyGrammar?.length ? <div className="tag-list">{result.summary.keyGrammar.map((item) => <span key={item}>{item}</span>)}</div> : null}
      </div>
    </div>

    <div className="result-toolbar"><div className="toolbar-actions">
      <button className="secondary-button small" onClick={() => copy('all', result)}>{copied === 'all' ? <Check size={16} /> : <Copy size={16} />}复制全部</button>
      <button className="secondary-button small" onClick={() => downloadFile('lingualens-analysis.md', resultToMarkdown(result), 'text/markdown')}><FileText size={16} />Markdown</button>
      <button className="secondary-button small" onClick={() => downloadFile('lingualens-analysis.json', JSON.stringify(result, null, 2), 'application/json')}><FileJson size={16} />JSON</button>
      <button className="secondary-button small" onClick={() => downloadFile('lingualens-analysis.txt', resultToMarkdown(result).replace(/[#*`]/g, ''), 'text/plain')}><Download size={16} />文本</button>
    </div></div>

    {active && current && <div className="analysis-workbench">
      <nav className="module-rail" aria-label="分析模块">{available.map((key) => { const meta = moduleMeta[key]; if (!meta) return null; const Icon = meta.icon; return <button className={active === key ? 'active' : ''} onClick={() => { setActive(key); onSegmentHover(null) }} aria-current={active === key ? 'page' : undefined} aria-label={`${meta.label}：${meta.hint}`} key={key}><Icon size={18} /><span><strong>{meta.label}</strong></span></button> })}</nav>
      <div className="module-stage">
        <header><div className="stage-title"><span className="stage-icon">{(() => { const Icon = current.icon; return <Icon size={20} /> })()}</span><div><h3>{current.label}</h3></div></div><button className="copy-module" onClick={() => copy(active, result[active])}>{copied === active ? <Check size={16} /> : <Copy size={16} />}{copied === active ? '已复制' : '复制本模块'}</button></header>
        <div className="module-content" key={active}>{renderModule(active, result, onSegmentHover)}</div>
      </div>
    </div>}
    <div className="accuracy-note"><Info size={16} /><span>AI 生成的语法、翻译与发音信息可能存在错误。低置信度内容需要结合上下文核实。</span></div>
  </section>
}
