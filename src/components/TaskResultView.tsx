import { ArrowDown, Check, CircleAlert, CircleCheck, Copy, GitCompare } from 'lucide-react'
import { useState } from 'react'
import type { ComparisonResult, CorrectionResult, CorrectionCategory, TokenUsage } from '../types/analysis'

const categoryLabels: Record<CorrectionCategory, string> = {
  grammar: '语法', 'word-choice': '用词', spelling: '拼写', register: '语域',
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }
  return <button className="secondary-button small" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制'}</button>
}

function DiffLine({ kind, text }: { kind: 'removed' | 'added'; text: string }) {
  return <div className={`diff-line ${kind}`}><span aria-hidden="true">{kind === 'removed' ? '−' : '+'}</span><code>{text}</code></div>
}

export function CorrectionResultView({ result, usage }: { result: CorrectionResult; usage?: TokenUsage }) {
  const changed = result.corrected.trim() !== result.original.trim()
  return <section className="task-results" aria-live="polite">
    <div className={`correction-summary ${result.isCorrect ? 'correct' : ''}`}>
      <div className="summary-top"><span className="language-pill">检查纠错</span>{usage && <span className="usage-pill">实际 · {usage.totalTokens.toLocaleString()} tokens</span>}</div>
      <div className="correction-title">{result.isCorrect ? <CircleCheck size={26} /> : <CircleAlert size={26} />}<div><span className="eyebrow light">{result.isCorrect ? '句子正确' : '发现可改进之处'}</span><h2>{result.isCorrect ? '语法没有明显错误。' : `发现 ${result.issues.length} 个值得修改的地方。`}</h2></div></div>
      <p>{result.isCorrect ? '下面仍可参考更自然的表达。' : '先看修改，再逐条理解它为什么更好。'}</p>
    </div>

    <div className="task-toolbar"><div><h3>修改对照</h3><p>用代码 Diff 的方式看清原句和修改版。</p></div><CopyButton value={result.corrected} /></div>
    <div className="diff-board">
      <DiffLine kind="removed" text={result.original} />
      {changed && <div className="diff-arrow"><ArrowDown size={18} />修改为</div>}
      <DiffLine kind="added" text={result.corrected} />
    </div>
    {result.naturalVersion && result.naturalVersion.trim() !== result.corrected.trim() && <div className="natural-version"><span>更自然的说法</span><p>{result.naturalVersion}</p><CopyButton value={result.naturalVersion} /></div>}

    <div className="task-toolbar issue-heading"><div><h3>修改说明</h3><p>{result.issues.length ? '按错误类型理解修改原因。' : '没有需要修正的错误。'}</p></div></div>
    {result.issues.length ? <div className="issue-list">{result.issues.map((issue, index) => <article key={`${issue.category}-${issue.original}-${index}`}>
      <header><span className={`issue-category ${issue.category}`}>{categoryLabels[issue.category]}</span>{issue.range && <small>位置 {issue.range[0] + 1}–{issue.range[1]}</small>}</header>
      <div className="issue-change"><code>{issue.original || '—'}</code>{issue.replacement && <><ArrowDown size={15} /><code>{issue.replacement}</code></>}</div>
      <p>{issue.explanation}</p>
    </article>)}</div> : <div className="no-issues"><CircleCheck size={19} />没有发现语法、拼写、用词或语域问题。</div>}
  </section>
}

export function ComparisonResultView({ result, usage }: { result: ComparisonResult; usage?: TokenUsage }) {
  return <section className="task-results" aria-live="polite">
    <div className="comparison-summary"><div className="summary-top"><span className="language-pill">比较表达</span>{usage && <span className="usage-pill">实际 · {usage.totalTokens.toLocaleString()} tokens</span>}</div><div className="correction-title"><GitCompare size={26} /><div><span className="eyebrow light">表达差异</span><h2>{result.verdict || '比较完成'}</h2></div></div></div>
    <div className="comparison-expressions"><div><span>表达 A</span><p>{result.original}</p><CopyButton value={result.original} /></div><div><span>表达 B</span><p>{result.comparison}</p><CopyButton value={result.comparison} /></div></div>
    <div className="task-toolbar issue-heading"><div><h3>差异说明</h3><p>从意思、语感和适用场景比较。</p></div></div>
    <div className="issue-list comparison-list">{result.differences.map((item, index) => <article key={`${item.aspect}-${index}`}><header><span className="issue-category register">{item.aspect}</span></header><div className="comparison-row"><div><small>A</small><p>{item.original}</p></div><div><small>B</small><p>{item.comparison}</p></div></div><p>{item.explanation}</p></article>)}</div>
  </section>
}
