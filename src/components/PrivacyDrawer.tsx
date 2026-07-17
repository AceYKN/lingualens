import { Cloud, Database, KeyRound, LockKeyhole, ShieldCheck, X } from 'lucide-react'
import type { ConnectionMode } from '../public-service/types'

interface Props {
  open: boolean
  mode: ConnectionMode
  onClose: () => void
}

export function PrivacyDrawer({ open, mode, onClose }: Props) {
  if (!open) return null
  const publicMode = mode === 'public'
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="drawer privacy-drawer" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <div className="drawer-header">
        <div><span className="eyebrow">PRIVACY &amp; SECURITY</span><h2 id="privacy-title">隐私与安全说明</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭隐私与安全说明"><X size={20} /></button>
      </div>

      <div className="privacy-hero"><ShieldCheck size={24} /><div><strong>{publicMode ? '公共免费模式' : '自备 Key 模式'}</strong><p>{publicMode ? '句子经受保护的 Cloudflare Function 转发，站点不保存正文或分析历史。' : '浏览器直接连接你配置的模型服务，项目方不接收文本或 API Key。'}</p></div></div>

      <div className="privacy-detail-list">
        <section><span><Cloud size={18} /></span><div><h3>数据流向</h3><p>{publicMode ? '浏览器 → Cloudflare Pages Function → DeepSeek。Cloudflare 与 DeepSeek 会按照各自的服务和隐私政策处理请求。' : '浏览器 → 你选择的 OpenAI 兼容接口。连接地址、模型和请求参数均由你控制。'}</p></div></section>
        <section><span><Database size={18} /></span><div><h3>站点保存什么</h3><p>{publicMode ? 'KV 使用访客 IP 作为额度键：分钟计数约 2 分钟后删除，每日计数最多保留 48 小时；不保存句子、模型回答或分析历史。' : '普通配置可保存到当前浏览器；API Key 默认只存在页面内存，只有你主动启用时才以明文写入浏览器本地存储。'}</p></div></section>
        <section><span>{publicMode ? <LockKeyhole size={18} /> : <KeyRound size={18} />}</span><div><h3>{publicMode ? '密钥与防滥用' : 'API Key 安全'}</h3><p>{publicMode ? '站点 Key 存在 Cloudflare 加密 Secret 中，不会发送给浏览器。每次调用都验证 Turnstile，并受分钟、每日和全站额度保护。' : '配置导入、导出与分析结果不会包含 API Key。请勿在公共或共享设备上启用“保存到当前浏览器”。'}</p></div></section>
      </div>

      <div className="privacy-warning"><LockKeyhole size={17} /><p>无论使用哪种模式，都不要输入密码、支付信息、证件号码、医疗记录或其他敏感个人信息。AI 分析仅供学习参考。</p></div>
      <button className="primary-button full" onClick={onClose}>我已了解</button>
    </aside>
  </div>
}
