import type { Segment } from '../types/analysis'

interface Props { text: string; active?: Segment | null; direction?: 'ltr' | 'rtl' }

export function SourceHighlight({ text, active, direction = 'ltr' }: Props) {
  const valid = active?.start !== undefined && active.end !== undefined && active.start >= 0 && active.end <= text.length && active.start < active.end
  if (!valid || !active) return <p className="source-display" dir={direction}>{text || '在上方输入一个句子，分析结果会在这里与你的原文联动。'}</p>
  return <p className="source-display" dir={direction}>{text.slice(0, active.start)}<mark>{text.slice(active.start, active.end)}</mark>{text.slice(active.end)}</p>
}

