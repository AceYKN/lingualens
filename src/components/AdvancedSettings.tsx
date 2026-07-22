import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RotateCcw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { ANALYSIS_FOCUSES } from '../analysis/modules'
import { DEFAULT_ANALYSIS, cloneAnalysisConfig, setGlobalDetail } from '../analysis/presets'
import { DEFAULT_PROMPT_TEMPLATE, PROMPT_TEMPLATE_VARIABLES, unknownPromptVariables } from '../analysis/prompt-builder'
import type { AnalysisConfig, DetailLevel } from '../types/config'

interface Props {
  open: boolean
  publicMode: boolean
  config: AnalysisConfig
  onClose: () => void
  onApply: (config: AnalysisConfig) => void
}

type ExplanationStyle = 'plain' | 'learning' | 'professional'
type VisibleDetail = 'concise' | 'standard' | 'detailed'

const explanationStyles: Array<[ExplanationStyle, string, string]> = [
  ['plain', '通俗直白', '少用术语，从基本概念讲起'],
  ['learning', '学习讲解', '使用常见术语，并随用随解释'],
  ['professional', '专业分析', '使用语言学术语，减少基础铺垫'],
]

const visibleDetails: Array<[VisibleDetail, string, string]> = [
  ['concise', '简短', '每项只保留结论和关键依据'],
  ['standard', '适中', '解释原因，并给必要例子'],
  ['detailed', '充分', '包含细节、例外和替代解释'],
]

function explanationStyleOf(config: AnalysisConfig): ExplanationStyle {
  if (config.terminology === 'professional' || config.learnerLevel === 'linguist') return 'professional'
  if (config.terminology === 'plain' || ['beginner-zero', 'beginner'].includes(config.learnerLevel)) return 'plain'
  return 'learning'
}

function visibleDetailOf(detail: DetailLevel): VisibleDetail {
  if (detail === 'minimal' || detail === 'concise') return 'concise'
  if (detail === 'expert' || detail === 'detailed') return 'detailed'
  return 'standard'
}

function withExplanationStyle(config: AnalysisConfig, style: ExplanationStyle): AnalysisConfig {
  if (style === 'plain') return { ...cloneAnalysisConfig(config), preset: 'custom', learnerLevel: 'beginner', terminology: 'plain' }
  if (style === 'professional') return { ...cloneAnalysisConfig(config), preset: 'custom', learnerLevel: 'linguist', terminology: 'professional' }
  return { ...cloneAnalysisConfig(config), preset: 'custom', learnerLevel: 'intermediate', terminology: 'explained' }
}

function withVisibleDetail(config: AnalysisConfig, detail: VisibleDetail): AnalysisConfig {
  const emphasizedIds = Object.keys(config.moduleDepths)
  const next = setGlobalDetail(config, detail)
  next.moduleDepths = Object.fromEntries(emphasizedIds.map((id) => [id, detail === 'detailed' ? 'expert' : 'detailed']))
  return next
}

function withFocus(config: AnalysisConfig, moduleIds: string[], active: boolean): AnalysisConfig {
  const modules = { ...config.modules }
  moduleIds.forEach((id) => { modules[id] = active })
  return { ...cloneAnalysisConfig(config), preset: 'custom', modules }
}

function withEmphasis(config: AnalysisConfig, moduleIds: string[], emphasized: boolean): AnalysisConfig {
  const moduleDepths = { ...config.moduleDepths }
  moduleIds.forEach((id) => {
    if (emphasized) moduleDepths[id] = config.detail === 'detailed' || config.detail === 'expert' ? 'expert' : 'detailed'
    else delete moduleDepths[id]
  })
  return { ...cloneAnalysisConfig(config), preset: 'custom', moduleDepths }
}

function resetAnalysisPreferences(config: AnalysisConfig): AnalysisConfig {
  return {
    ...cloneAnalysisConfig(DEFAULT_ANALYSIS),
    sourceLanguage: config.sourceLanguage,
    explanationLanguage: config.explanationLanguage,
    translationLanguage: config.translationLanguage,
    maxInputLength: config.maxInputLength,
  }
}

export function AdvancedSettings({ open, publicMode, config, onClose, onApply }: Props) {
  const [draft, setDraft] = useState(() => cloneAnalysisConfig(config))
  useEffect(() => { if (open) setDraft(cloneAnalysisConfig(config)) }, [open, config])

  const selectedFocusCount = ANALYSIS_FOCUSES.filter((focus) => focus.moduleIds.some((id) => draft.modules[id])).length
  const unknownVariables = useMemo(() => unknownPromptVariables(draft.promptTemplate), [draft.promptTemplate])
  const dirty = JSON.stringify(draft) !== JSON.stringify(config)
  const examplesEnabled = Boolean(draft.modules.examples)

  if (!open) return null

  const update = <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => setDraft((current) => ({ ...current, preset: 'custom', [key]: value }))

  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="drawer wide" role="dialog" aria-modal="true" aria-labelledby="advanced-title">
      <div className="drawer-header"><h2 id="advanced-title">高级分析设置</h2><button className="icon-button" onClick={onClose} aria-label="关闭高级设置"><X size={20} /></button></div>

      <section className="settings-section"><h3>回答方式</h3><div className="choice-grid">
        <fieldset className="choice-group"><legend>怎么讲</legend>{explanationStyles.map(([value, label, description]) => <label className={explanationStyleOf(draft) === value ? 'active' : ''} key={value}><input type="radio" name="explanation-style" checked={explanationStyleOf(draft) === value} onChange={() => setDraft((current) => withExplanationStyle(current, value))} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>
        <fieldset className="choice-group"><legend>讲多细</legend>{visibleDetails.map(([value, label, description]) => <label className={visibleDetailOf(draft.detail) === value ? 'active' : ''} key={value}><input type="radio" name="answer-detail" checked={visibleDetailOf(draft.detail) === value} onChange={() => setDraft((current) => withVisibleDetail(current, value))} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>
      </div></section>

      <section className="settings-section"><div className="section-heading"><div><h3>想看哪些内容</h3><p>“核心含义”始终保留。对最关心的项目开启“重点讲解”即可，无需理解抽象深度等级。</p></div><span className="count-badge">{selectedFocusCount} 项</span></div>
        <div className="focus-settings">{ANALYSIS_FOCUSES.map((focus) => {
          const enabledCount = focus.moduleIds.filter((id) => draft.modules[id]).length
          const active = enabledCount > 0
          const partial = active && enabledCount < focus.moduleIds.length
          const emphasized = focus.moduleIds.some((id) => Boolean(draft.moduleDepths[id]))
          return <div className={`focus-setting ${active ? 'active' : ''}`} key={focus.id}>
            <label className="focus-toggle"><input type="checkbox" checked={active} onChange={(e) => setDraft((current) => withFocus(current, focus.moduleIds, e.target.checked))} /><span><strong>{focus.label}</strong><small>{focus.description}{partial ? '（当前仅部分开启）' : ''}</small></span></label>
            <label className="focus-emphasis"><input type="checkbox" disabled={!active} checked={active && emphasized} onChange={(e) => setDraft((current) => withEmphasis(current, focus.moduleIds, e.target.checked))} />重点讲解</label>
          </div>
        })}</div>
        {examplesEnabled && <label className="example-count-control"><span><strong>生成几个迁移例句？</strong><small>数量越多，回答越长。</small></span><select value={draft.exampleCount} onChange={(e) => update('exampleCount', Number(e.target.value))}>{[1, 2, 3, 4, 5].map((count) => <option value={count} key={count}>{count} 个</option>)}</select></label>}
      </section>

      {publicMode ? <div className="privacy-callout compact"><ShieldCheck size={18} /><div><strong>公共模式使用受保护的系统 Prompt</strong><p>上面的回答方式、内容范围、重点项目与例句数量都会生效；公共服务不会接收自由文本指令。</p></div></div> : <details className="advanced-block optional-preferences"><summary>个性化要求（可选）</summary><label className="field"><span>还需要模型特别注意什么？</span><textarea maxLength={600} rows={3} value={draft.customInstructions} onChange={(e) => update('customInstructions', e.target.value)} placeholder="例如：我是日语学习者，请特别解释助词在这里为何不能互换。" /><small className="field-help">只写学习偏好；安全规则和结果格式由应用固定控制。{draft.customInstructions.length} / 600</small></label><details className="developer-prompt"><summary><SlidersHorizontal size={15} />开发者选项：基础 Prompt</summary><p className="help-text">通常无需修改。可用变量：{PROMPT_TEMPLATE_VARIABLES.map((key) => `{{${key}}}`).join('、')}。JSON 输出结构和输入隔离规则始终由应用追加。</p><textarea rows={12} value={draft.promptTemplate} onChange={(e) => update('promptTemplate', e.target.value)} />{unknownVariables.length > 0 && <p className="prompt-warning"><AlertTriangle size={14} />无法识别：{unknownVariables.map((key) => `{{${key}}}`).join('、')}</p>}<div className="prompt-footer"><span>{draft.promptTemplate.length.toLocaleString()} 字符 · Prompt V3</span><button className="text-button" onClick={() => update('promptTemplate', DEFAULT_PROMPT_TEMPLATE)}><RotateCcw size={15} />恢复默认</button></div></details></details>}

      <div className="drawer-footer"><button className="secondary-button" onClick={() => setDraft((current) => resetAnalysisPreferences(current))}><RotateCcw size={17} />恢复默认</button><div className="drawer-footer-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!dirty} onClick={() => onApply(cloneAnalysisConfig(draft))}>应用设置</button></div></div>
    </aside>
  </div>
}
