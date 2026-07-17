import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { ANALYSIS_MODULES } from '../analysis/modules'
import type { AnalysisConfig, DetailLevel, LearnerLevel, TerminologyLevel } from '../types/config'
import { DEFAULT_PROMPT_TEMPLATE } from '../types/config'

interface Props { open: boolean; config: AnalysisConfig; onClose: () => void; onChange: (config: AnalysisConfig) => void; onReset: () => void }
const detailOptions: Array<[DetailLevel, string]> = [['minimal', '极简'], ['concise', '简洁'], ['standard', '标准'], ['detailed', '详细'], ['expert', '专家']]

export function AdvancedSettings({ open, config, onClose, onChange, onReset }: Props) {
  if (!open) return null
  const update = <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => onChange({ ...config, [key]: value })
  const updateModule = (id: string, checked: boolean) => onChange({ ...config, preset: 'custom', modules: { ...config.modules, [id]: checked } })
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="drawer wide" role="dialog" aria-modal="true" aria-labelledby="advanced-title">
      <div className="drawer-header"><div><span className="eyebrow">ANALYSIS CONTROL</span><h2 id="advanced-title">高级分析设置</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭高级设置"><X size={20} /></button></div>
      <section className="settings-section"><h3>解释方式</h3><div className="parameter-grid three">
        <label className="field"><span>学习者水平</span><select value={config.learnerLevel} onChange={(e) => update('learnerLevel', e.target.value as LearnerLevel)}><option value="beginner-zero">零基础</option><option value="beginner">初级</option><option value="intermediate">中级</option><option value="advanced">高级</option><option value="linguist">语言学专业</option></select></label>
        <label className="field"><span>全局精细程度</span><select value={config.detail} onChange={(e) => update('detail', e.target.value as DetailLevel)}>{detailOptions.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
        <label className="field"><span>术语使用</span><select value={config.terminology} onChange={(e) => update('terminology', e.target.value as TerminologyLevel)}><option value="plain">尽量不用术语</option><option value="explained">术语并解释</option><option value="professional">直接使用术语</option></select></label>
      </div></section>

      <section className="settings-section"><div className="section-heading"><div><h3>分析模块</h3><p>关闭模块后，Prompt 和结果区都不会要求或展示它。</p></div><span className="count-badge">{Object.values(config.modules).filter(Boolean).length} / {ANALYSIS_MODULES.length}</span></div>
        <div className="module-settings">{ANALYSIS_MODULES.map((module) => <div className={`module-setting ${config.modules[module.id] ? 'active' : ''}`} key={module.id}>
          <label><input type="checkbox" checked={Boolean(config.modules[module.id])} onChange={(e) => updateModule(module.id, e.target.checked)} /><span><strong>{module.label}</strong><small>{module.description}</small></span></label>
          <select aria-label={`${module.label}深度`} disabled={!config.modules[module.id]} value={config.moduleDepths[module.id]} onChange={(e) => update('moduleDepths', { ...config.moduleDepths, [module.id]: e.target.value as DetailLevel })}>{detailOptions.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select>
        </div>)}</div>
      </section>

      <section className="settings-section"><h3>自定义要求</h3><label className="field"><span>补充指令</span><textarea rows={4} value={config.customInstructions} onChange={(e) => update('customInstructions', e.target.value)} placeholder="例如：重点解释日语助词；所有语法点给出两个例句。" /></label></section>
      <details className="advanced-block prompt-editor"><summary><SlidersHorizontal size={17} />系统 Prompt 模板</summary><p className="help-text">可用变量：{'{{sourceLanguage}}、{{explanationLanguage}}、{{translationLanguage}}、{{learnerLevel}}、{{detail}}、{{terminology}}、{{modules}}、{{languageStrategy}}、{{customInstructions}}'}</p><textarea rows={14} value={config.promptTemplate} onChange={(e) => update('promptTemplate', e.target.value)} /><div className="prompt-footer"><span>{config.promptTemplate.length.toLocaleString()} 字符 · Prompt V2.0</span><button className="text-button" onClick={() => update('promptTemplate', DEFAULT_PROMPT_TEMPLATE)}><RotateCcw size={15} />恢复默认模板</button></div></details>
      <div className="drawer-footer"><button className="secondary-button" onClick={onReset}><RotateCcw size={17} />恢复默认分析设置</button><button className="primary-button" onClick={onClose}>完成设置</button></div>
    </aside>
  </div>
}

