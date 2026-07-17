import { CheckCircle2, Cloud, Eye, EyeOff, KeyRound, LoaderCircle, PlugZap, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { ProviderConfig } from '../types/config'
import type { TestResult } from '../types/analysis'
import type { ConnectionMode, PublicQuota, PublicServiceConfig } from '../public-service/types'

interface Props {
  open: boolean
  mode: ConnectionMode
  publicConfig: PublicServiceConfig | null
  publicQuota: PublicQuota | null
  config: ProviderConfig
  apiKey: string
  testing: boolean
  testResult: TestResult | null
  onClose: () => void
  onModeChange: (mode: ConnectionMode) => void
  onConfigChange: (config: ProviderConfig) => void
  onApiKeyChange: (key: string) => void
  onTest: () => void
  onClearKey: () => void
  onClearAll: () => void
}

export function ProviderDrawer(props: Props) {
  const { open, mode, publicConfig, publicQuota, config, apiKey, testing, testResult } = props
  const [showKey, setShowKey] = useState(false)
  const update = <K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) => props.onConfigChange({ ...config, [key]: value })
  const providerId = config.baseUrl.includes('api.deepseek.com') ? 'deepseek' : config.baseUrl.includes('api.openai.com') ? 'openai' : 'custom'
  const chooseProvider = (value: string) => {
    if (value === 'deepseek') props.onConfigChange({ ...config, baseUrl: 'https://api.deepseek.com', path: '/chat/completions', model: 'deepseek-v4-flash' })
    else if (value === 'openai') props.onConfigChange({ ...config, baseUrl: 'https://api.openai.com/v1', path: '/chat/completions', model: 'gpt-4.1-mini' })
    else props.onConfigChange({ ...config, baseUrl: '', path: '/chat/completions', model: '' })
  }
  if (!open) return null

  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="provider-title">
      <div className="drawer-header">
        <div><span className="eyebrow">CONNECTION MODE</span><h2 id="provider-title">模型连接</h2></div>
        <button className="icon-button" onClick={props.onClose} aria-label="关闭模型设置"><X size={20} /></button>
      </div>

      <div className="connection-tabs" role="tablist" aria-label="连接方式">
        <button className={mode === 'public' ? 'active' : ''} onClick={() => props.onModeChange('public')}><Cloud size={18} /><span><strong>免费公共服务</strong><small>无需 API Key</small></span></button>
        <button className={mode === 'byok' ? 'active' : ''} onClick={() => props.onModeChange('byok')}><KeyRound size={18} /><span><strong>自备 Key</strong><small>浏览器直接连接</small></span></button>
      </div>

      {mode === 'public' ? <>
        <div className={`public-service-card ${publicConfig?.available ? 'ready' : ''}`}>
          <span className="service-icon">{publicConfig?.available ? <ShieldCheck size={22} /> : <Cloud size={22} />}</span>
          <div><strong>{publicConfig?.available ? '公共服务可用' : publicConfig ? '公共服务尚未配置' : '正在检查公共服务…'}</strong><p>{publicConfig?.available ? `由 Cloudflare 安全代理连接 ${publicConfig.model}；服务端固定模型与分析提示，不保存句子正文。` : publicConfig?.message ?? '正在读取运行状态。'}</p></div>
        </div>
        <div className="quota-grid">
          <div><small>每分钟</small><strong>{publicQuota ? `${publicQuota.minuteRemaining} 次剩余` : `${publicConfig?.minuteLimit ?? 10} 次`}</strong></div>
          <div><small>每天</small><strong>{publicQuota ? `${publicQuota.dailyRemaining} 次剩余` : `${publicConfig?.dailyLimit ?? 50} 次`}</strong></div>
          <div><small>单次文本</small><strong>{publicConfig?.inputLimit ?? 500} 字符</strong></div>
          <div><small>深度输出上限</small><strong>{Math.round((publicConfig?.maxOutputTokens ?? 16000) / 1000)}K Tokens</strong></div>
        </div>
        <div className="privacy-callout compact"><ShieldCheck size={18} /><div><strong>公开模式的数据边界</strong><p>句子会经过本项目的 Cloudflare Function 转发至 DeepSeek。项目不保存正文或分析历史；访客 IP 仅作为短期额度键，Cloudflare 与 DeepSeek 仍会按各自政策处理请求。</p></div></div>
        {!publicConfig?.available && <button className="secondary-button full" onClick={() => props.onModeChange('byok')}><KeyRound size={17} />改用自备 Key</button>}
      </> : <>
        <div className="privacy-callout compact"><KeyRound size={18} /><div><strong>你的 Key，你的连接</strong><p>默认仅保存在当前页面内存中，并由浏览器直接发送到下方 API 地址。</p></div></div>

        <div className="form-stack">
          <label className="field"><span>服务提供商</span><select value={providerId} onChange={(e) => chooseProvider(e.target.value)}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="custom">自定义 OpenAI 兼容接口</option></select></label>
          <label className="field"><span>API Base URL</span><input value={config.baseUrl} onChange={(e) => update('baseUrl', e.target.value)} inputMode="url" placeholder="https://api.openai.com/v1" /></label>
          {config.baseUrl.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(config.baseUrl) && <p className="field-warning">非 HTTPS 接口可能泄露 Key，请勿在不可信网络中使用。</p>}
          <label className="field"><span>请求路径</span><input value={config.path} onChange={(e) => update('path', e.target.value)} placeholder="/chat/completions" /></label>
          <label className="field"><span>模型名称</span><input value={config.model} onChange={(e) => update('model', e.target.value)} placeholder="gpt-4.1-mini" /></label>
          <label className="field"><span>API Key</span><span className="input-with-action"><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => props.onApiKeyChange(e.target.value)} autoComplete="off" spellCheck={false} placeholder="sk-••••••••••••" /><button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}>{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          <label className="check-row warning-check"><input type="checkbox" checked={config.rememberKey} onChange={(e) => update('rememberKey', e.target.checked)} /><span><strong>保存到当前浏览器</strong><small>公共电脑或共享设备请勿启用。Key 将以明文保存在浏览器存储中。</small></span></label>

          <details className="advanced-block"><summary>模型参数</summary><div className="parameter-grid">
            <label className="field"><span>Temperature</span><input type="number" min="0" max="2" step="0.1" value={config.temperature} onChange={(e) => update('temperature', Number(e.target.value))} /></label>
            <label className="field"><span>Top P</span><input type="number" min="0" max="1" step="0.1" value={config.topP} onChange={(e) => update('topP', Number(e.target.value))} /></label>
            <label className="field"><span>Max Tokens</span><input type="number" min="1" value={config.maxTokens} onChange={(e) => update('maxTokens', Number(e.target.value))} /></label>
            <label className="field"><span>超时（秒）</span><input type="number" min="1" max="300" value={config.timeoutMs / 1000} onChange={(e) => update('timeoutMs', Number(e.target.value) * 1000)} /></label>
          </div></details>
        </div>

        {testResult && <div className={`status-message ${testResult.ok ? 'success' : 'error'}`}>{testResult.ok ? <CheckCircle2 size={18} /> : <PlugZap size={18} />}<span>{testResult.message}</span></div>}
        <button className="primary-button full" disabled={testing || !apiKey || !config.model} onClick={props.onTest}>{testing ? <LoaderCircle className="spin" size={18} /> : <PlugZap size={18} />}{testing ? '正在测试…' : '测试连接'}</button>
      </>}

      <div className="danger-actions">
        {mode === 'byok' && <button className="text-button" onClick={props.onClearKey}><Trash2 size={16} />清除 API Key</button>}
        <button className="text-button" onClick={props.onClearAll}><RotateCcw size={16} />清除全部本地数据</button>
      </div>
    </aside>
  </div>
}
