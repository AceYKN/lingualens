import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronRight, CircleStop, Download, ExternalLink, FileUp, Heart, Languages, LoaderCircle, LockKeyhole, Menu, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, WandSparkles } from 'lucide-react'
import type { AnalysisResult, Segment, TestResult, TokenUsage } from './types/analysis'
import type { AnalysisConfig, AppConfig, PresetId, ProviderConfig } from './types/config'
import { DEFAULT_ANALYSIS, PRESETS, applyPreset } from './analysis/presets'
import { EXPLANATION_LANGUAGES, LANGUAGES, detectLanguageLocally, isRtlLanguage } from './analysis/languages'
import { buildPrompt } from './analysis/prompt-builder'
import { openAICompatibleProvider } from './providers/openai-compatible'
import { friendlyError } from './providers/errors'
import { clearAllData, defaultAppConfig, loadConnectionMode, loadSavedApiKey, loadSettings, parseImportedConfig, saveApiKey, saveConnectionMode, saveSettings } from './storage/settings-storage'
import { exportConfig } from './utils/export'
import { ProviderDrawer } from './components/ProviderDrawer'
import { AdvancedSettings } from './components/AdvancedSettings'
import { SourceHighlight } from './components/SourceHighlight'
import { ResultView } from './components/ResultView'
import { compactTokens, estimateAnalysisTokens } from './utils/token-estimate'
import { analyzeWithPublicService, loadPublicServiceConfig } from './providers/public-service'
import type { ConnectionMode, PublicQuota, PublicServiceConfig } from './public-service/types'
import { PUBLIC_INPUT_LIMIT } from './public-service/types'
import { TurnstileWidget } from './components/TurnstileWidget'
import { PrivacyDrawer } from './components/PrivacyDrawer'
import './index.css'

const samples = [
  { label: '日语', text: '忙しいのに、彼は時間を作って来てくれた。' },
  { label: '英语', text: 'Had I known about the delay, I would have taken a different route.' },
  { label: '西语', text: 'Aunque hubiera tenido más tiempo, no habría cambiado de opinión.' },
]

function validProvider(config: ProviderConfig, apiKey: string) {
  if (!apiKey.trim()) return '请先在模型设置中输入 API Key。'
  if (!config.model.trim()) return '请填写模型名称。'
  try {
    const url = new URL(config.baseUrl)
    const local = ['localhost', '127.0.0.1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return '出于安全考虑，只允许 HTTPS 接口；本地开发可使用 localhost。'
  } catch { return 'API Base URL 格式不正确。' }
  return null
}

function App() {
  const [appConfig, setAppConfig] = useState<AppConfig>(() => loadSettings())
  const [apiKey, setApiKey] = useState(() => loadSavedApiKey())
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => loadConnectionMode())
  const [publicConfig, setPublicConfig] = useState<PublicServiceConfig | null>(null)
  const [publicQuota, setPublicQuota] = useState<PublicQuota | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [text, setText] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [lastUsage, setLastUsage] = useState<TokenUsage | undefined>()
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null)
  const [providerOpen, setProviderOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(true)
  const [privacyDetailsOpen, setPrivacyDetailsOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const requestController = useRef<AbortController | null>(null)
  const analysis = appConfig.analysis
  const provider = appConfig.provider
  const detectedLanguage = useMemo(() => detectLanguageLocally(text), [text])
  const direction = isRtlLanguage(analysis.sourceLanguage === 'auto' ? detectedLanguage : analysis.sourceLanguage) ? 'rtl' : 'ltr'
  const activeCount = Object.values(analysis.modules).filter(Boolean).length
  const publicMode = connectionMode === 'public'
  const inputLimit = publicMode ? (publicConfig?.inputLimit ?? PUBLIC_INPUT_LIMIT) : analysis.maxInputLength
  const outputLimit = publicMode ? (publicConfig?.maxOutputTokens ?? 16000) : provider.maxTokens
  const effectiveAnalysis = useMemo(() => analysis.sourceLanguage === 'auto' ? { ...analysis, sourceLanguage: detectedLanguage === 'auto' ? 'auto' : detectedLanguage } : analysis, [analysis, detectedLanguage])
  const tokenEstimate = useMemo(() => estimateAnalysisTokens(text.trim(), effectiveAnalysis, outputLimit), [text, effectiveAnalysis, outputLimit])

  useEffect(() => {
    const controller = new AbortController()
    loadPublicServiceConfig(controller.signal).then(setPublicConfig).catch(() => setPublicConfig({
      available: false, model: 'deepseek-v4-flash', turnstileSiteKey: '', inputLimit: PUBLIC_INPUT_LIMIT,
      maxOutputTokens: 16000, minuteLimit: 10, dailyLimit: 50, message: '无法连接公共服务接口，请使用自备 Key 模式。',
    }))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (provider.rememberKey) saveApiKey(apiKey)
    else saveApiKey('')
  }, [apiKey, provider.rememberKey])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const updateProvider = (next: ProviderConfig) => setAppConfig((current) => ({ ...current, provider: next }))
  const updateAnalysis = (next: AnalysisConfig) => setAppConfig((current) => ({ ...current, analysis: next }))
  const changeConnectionMode = (mode: ConnectionMode) => {
    setConnectionMode(mode); saveConnectionMode(mode); setError(''); setTurnstileToken(''); setTurnstileResetKey((value) => value + 1)
  }
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])
  const handleTurnstileError = useCallback((message: string) => setError(message), [])

  const testConnection = async () => {
    const invalid = validProvider(provider, apiKey)
    if (invalid) { setTestResult({ ok: false, message: invalid, code: 'validation' }); return }
    setTesting(true); setTestResult(null)
    const controller = new AbortController()
    const outcome = await openAICompatibleProvider.testConnection(provider, apiKey, controller.signal)
    setTestResult(outcome); setTesting(false)
  }

  const analyze = async () => {
    const trimmed = text.trim()
    if (!trimmed) { setError('请输入需要分析的句子或短文本。'); return }
    if (trimmed.length > inputLimit) { setError(`文本超过 ${inputLimit.toLocaleString()} 字符限制，请缩短后重试。`); return }
    if (publicMode) {
      if (!publicConfig?.available) { setError(publicConfig?.message ?? '公共服务尚未就绪。'); setProviderOpen(true); return }
      if (!turnstileToken) { setError('请先完成按钮上方的安全验证。'); return }
    } else {
      const invalid = validProvider(provider, apiKey)
      if (invalid) { setError(invalid); setProviderOpen(true); return }
    }
    if (!activeCount) { setError('请至少启用一个分析模块。'); setAdvancedOpen(true); return }
    setError(''); setResult(null); setLastUsage(undefined); setActiveSegment(null); setLoading(true)
    const controller = new AbortController(); requestController.current = controller
    try {
      if (publicMode) {
        const response = await analyzeWithPublicService(trimmed, effectiveAnalysis, turnstileToken, controller.signal)
        setResult(response.result); setLastUsage(response.usage); setPublicQuota(response.quota)
      } else {
        const response = await openAICompatibleProvider.analyze({ text: trimmed, prompt: buildPrompt(trimmed, effectiveAnalysis) }, provider, apiKey, controller.signal)
        setResult(response.result); setLastUsage(response.usage)
      }
    } catch (caught) { setError(friendlyError(caught).message) }
    finally {
      if (publicMode) { setTurnstileToken(''); setTurnstileResetKey((value) => value + 1) }
      setLoading(false); requestController.current = null
    }
  }

  const clearEverything = () => {
    if (!window.confirm('确定清除 API Key、已保存配置及当前页面数据吗？')) return
    clearAllData(); setAppConfig(defaultAppConfig()); setApiKey(''); setConnectionMode('public'); setText(''); setResult(null); setLastUsage(undefined); setTestResult(null); setProviderOpen(false); setNotice('本地应用数据已清除')
  }

  const handleImport = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { try { const imported = parseImportedConfig(String(reader.result)); setAppConfig(imported); setNotice('配置已导入（不含 API Key）') } catch { setError('配置文件结构无效，已拒绝导入。') } }
    reader.readAsText(file)
  }

  const selectPreset = (preset: PresetId) => updateAnalysis(applyPreset(analysis, preset))
  const sourceLabel = LANGUAGES.find(([code]) => code === detectedLanguage)?.[1] ?? '未知'

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="语镜首页"><span className="brand-mark"><Languages size={22} /></span><span><strong>语镜</strong><small>LINGUALENS</small></span></a>
      <nav className="top-actions" aria-label="应用操作">
        <button className="nav-button mobile-hide" onClick={() => { saveSettings(appConfig); setNotice('非敏感配置已保存到浏览器') }}><Check size={16} />保存配置</button>
        <button className="nav-button mobile-hide" onClick={() => exportConfig(appConfig)}><Download size={16} />导出配置</button>
        <button className="nav-button mobile-hide" onClick={() => importRef.current?.click()}><FileUp size={16} />导入配置</button>
        <button className={`model-button ${(publicMode && publicConfig?.available) || (!publicMode && apiKey) ? 'connected' : ''}`} onClick={() => setProviderOpen(true)}><span className="status-dot" />{publicMode ? '免费公共服务' : apiKey ? provider.model : '配置模型'}<Settings2 size={16} /></button>
        <button className="icon-button mobile-only" onClick={() => setProviderOpen(true)} aria-label="模型设置"><Menu size={20} /></button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => handleImport(e.target.files?.[0])} />
      </nav>
    </header>

    <main id="top">
      <section className="intro-bar">
        <div><span className="eyebrow">MULTILINGUAL SENTENCE ANALYZER</span><h1>读懂一句话，<em>从结构开始。</em></h1><p>保留每种语言自己的逻辑，按你需要的深度逐层拆解。</p></div>
        <div className="intro-trust"><span><ShieldCheck size={16} />{publicMode ? '受保护的免费服务' : '纯前端直连'}</span><small>{publicMode ? 'Cloudflare 代理 · 无需提交 API Key' : '文本与 Key 不经过项目方服务器'}</small></div>
      </section>

      {privacyOpen && <aside className="privacy-strip"><ShieldCheck size={20} /><div><strong>隐私与数据流</strong><span>{publicMode ? '公共模式会经本项目的 Cloudflare Function 转发至 DeepSeek；项目不保存句子正文或分析历史。请勿输入密码、证件号码等敏感信息。' : '自备 Key 模式由浏览器直接请求所选 LLM 服务；项目方不接收文本或 Key。请勿输入敏感信息。'}</span></div><button onClick={() => setPrivacyOpen(false)}>我知道了</button></aside>}

      <section className="workspace-grid">
        <div className="composer-card">
          <div className="card-heading"><div><span className="step-number">01</span><div><h2>输入你想读懂的句子</h2><p>支持多语言、混合语言与 Unicode 标点</p></div></div><span className="char-count">{text.length.toLocaleString()} / {inputLimit.toLocaleString()}</span></div>
          <textarea className="sentence-input" dir={direction} value={text} onChange={(e) => { setText(e.target.value); setError('') }} maxLength={inputLimit + 1000} placeholder="粘贴或输入任意语言的句子…" aria-label="待分析文本" />
          <div className="sample-row"><span>试试：</span>{samples.map((sample) => <button key={sample.label} onClick={() => setText(sample.text)}>{sample.label}<ChevronRight size={13} /></button>)}</div>
          <div className="language-controls">
            <label className="field"><span>原文语言</span><select value={analysis.sourceLanguage} onChange={(e) => updateAnalysis({ ...analysis, sourceLanguage: e.target.value })}>{LANGUAGES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select>{analysis.sourceLanguage === 'auto' && text && <small className="detection"><Sparkles size={12} />本地初步识别：{sourceLabel}（可手动修正）</small>}</label>
            <span className="language-arrow"><ArrowRight size={18} /></span>
            <label className="field"><span>解释语言</span><select value={analysis.explanationLanguage} onChange={(e) => updateAnalysis({ ...analysis, explanationLanguage: e.target.value })}>{EXPLANATION_LANGUAGES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label>
            <label className="field"><span>翻译为</span><select value={analysis.translationLanguage} onChange={(e) => updateAnalysis({ ...analysis, translationLanguage: e.target.value })}>{EXPLANATION_LANGUAGES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label>
          </div>
        </div>

        <aside className="control-card">
          <div className="card-heading compact-heading"><div><span className="step-number">02</span><div><h2>选择分析视角</h2><p>随时可以重新调整</p></div></div></div>
          <div className="preset-list">{(Object.entries(PRESETS) as Array<[Exclude<PresetId, 'custom'>, typeof PRESETS.quick]>).map(([id, item]) => <button className={analysis.preset === id ? 'active' : ''} key={id} onClick={() => selectPreset(id)}><span className="radio-mark" /><span><strong>{item.label}分析</strong><small>{item.description}</small></span>{id === 'standard' && <em>推荐</em>}</button>)}</div>
          <button className={`custom-preset ${analysis.preset === 'custom' ? 'active' : ''}`} onClick={() => setAdvancedOpen(true)}><SlidersHorizontal size={18} /><span><strong>自定义分析</strong><small>{activeCount} 个模块已开启</small></span><ChevronRight size={17} /></button>
          <div className="model-summary"><span className="status-dot" /><div><small>{publicMode ? '免费公共服务' : '自备模型'}</small><strong>{publicMode ? publicConfig?.model ?? '正在检查…' : apiKey ? provider.model : '尚未配置'}</strong></div><button onClick={() => setProviderOpen(true)}>设置</button></div>
          <div className={`token-estimate ${text.trim() ? '' : 'empty'}`}>
            <div><span>本次 Token 预估</span>{text.trim() ? <strong>≈ {compactTokens(tokenEstimate.totalLow)}–{compactTokens(tokenEstimate.totalHigh)}</strong> : <strong>等待输入</strong>}</div>
            {text.trim() && <p><span>输入约 {compactTokens(tokenEstimate.input)}</span><i /> <span>输出约 {compactTokens(tokenEstimate.outputLow)}–{compactTokens(tokenEstimate.outputHigh)}</span></p>}
            <small>字符启发式估算；实际计费以模型 usage 为准</small>
          </div>
          {publicMode && publicConfig?.available && <TurnstileWidget siteKey={publicConfig.turnstileSiteKey} resetKey={turnstileResetKey} onToken={handleTurnstileToken} onError={handleTurnstileError} />}
          {loading ? <button className="analyze-button stop" onClick={() => requestController.current?.abort()}><CircleStop size={20} />取消请求</button> : <button className="analyze-button" onClick={analyze}><WandSparkles size={21} />开始解构<span><ArrowRight size={18} /></span></button>}
          <p className="cost-note"><LockKeyhole size={13} />{publicMode ? `每分钟 ${publicConfig?.minuteLimit ?? 10} 次 · 每天 ${publicConfig?.dailyLimit ?? 50} 次` : '长文本与深度分析会增加 API 消耗'}</p>
        </aside>
      </section>

      {error && <div className="error-banner" role="alert"><AlertTriangle size={20} /><span>{error}</span><button onClick={() => setError('')}>关闭</button></div>}
      {loading && <section className="loading-state"><div className="analysis-loader"><LoaderCircle className="spin" size={28} /></div><div><h3>正在辨认结构与语义关系…</h3><p>{publicMode ? '请求经 Cloudflare 安全代理发往 DeepSeek' : `请求直接发往 ${provider.baseUrl.replace(/^https?:\/\//, '').split('/')[0]}`}</p></div></section>}

      {(result || text) && <section className="source-panel"><div className="source-panel-label"><span>原文</span>{activeSegment && <small>正在定位：{activeSegment.text}</small>}</div><SourceHighlight text={text} active={activeSegment} direction={direction} /></section>}
      {result && <ResultView result={result} enabled={analysis.modules} usage={lastUsage} onSegmentHover={setActiveSegment} />}

      {!result && !loading && <section className="empty-showcase"><div className="empty-icon"><Sparkles size={28} /></div><div><span className="eyebrow">HOW IT UNFOLDS</span><h2>从意思，到结构，再到语感</h2><p>结果会先给出一句话的核心，再逐层展开分词、语法、词汇、语序和使用场景。你只看自己需要的部分。</p></div><div className="unfold-steps"><span><b>1</b>整体含义</span><i /><span><b>2</b>语言结构</span><i /><span><b>3</b>迁移运用</span></div></section>}
    </main>

    <footer>
      <span className="footer-love">Built with <Heart size={13} fill="currentColor" aria-hidden="true" /> for curious language learners.</span>
      <nav className="footer-links" aria-label="Footer links"><button onClick={() => setPrivacyDetailsOpen(true)}>Privacy &amp; Security</button><a href="https://github.com/AceYKN/lingualens" target="_blank" rel="noreferrer"><ExternalLink size={13} />GitHub</a></nav>
      <span>LinguaLens · Open source</span>
    </footer>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    <ProviderDrawer open={providerOpen} mode={connectionMode} publicConfig={publicConfig} publicQuota={publicQuota} config={provider} apiKey={apiKey} testing={testing} testResult={testResult} onClose={() => setProviderOpen(false)} onModeChange={changeConnectionMode} onConfigChange={updateProvider} onApiKeyChange={setApiKey} onTest={testConnection} onClearKey={() => { setApiKey(''); saveApiKey(''); setTestResult(null); setNotice('API Key 已清除') }} onClearAll={clearEverything} />
    <AdvancedSettings open={advancedOpen} publicMode={publicMode} config={analysis} onClose={() => setAdvancedOpen(false)} onChange={updateAnalysis} onReset={() => { updateAnalysis(DEFAULT_ANALYSIS); setNotice('分析设置已恢复默认') }} />
    <PrivacyDrawer open={privacyDetailsOpen} mode={connectionMode} onClose={() => setPrivacyDetailsOpen(false)} />
  </div>
}

export default App
