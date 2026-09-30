import { useMemo } from 'react'
import { diffChars } from 'diff'

/** Inert HTML parsing; displayed as text so neither streamed nor saved HTML can
 * execute scripts, event handlers, frames, or remote requests in the review. */
export function reviewText(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const read = (node: Node, depth = 0): string => {
    if (depth > 128) return node.textContent ?? ''
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (!(node instanceof Element)) return [...node.childNodes].map(child => read(child, depth + 1)).join('')
    const tag = node.tagName.toLowerCase()
    if (['script', 'style', 'iframe', 'object', 'svg', 'noscript'].includes(tag)) return ''
    const value = [...node.childNodes].map(child => read(child, depth + 1)).join('')
    if (tag === 'img') return `\n[图片：${node.getAttribute('alt') || '未填写说明'} · ${node.getAttribute('src') || ''}]\n`
    if (tag === 'video') return `\n[视频：${node.getAttribute('src') || ''}${node.getAttribute('poster') ? ` · 封面：${node.getAttribute('poster')}` : ''}]${value}\n`
    if (tag === 'source') return `[媒体地址：${node.getAttribute('src') || ''}]`
    if (tag === 'a') return `${value} [链接：${node.getAttribute('href') || ''}]`
    if (tag === 'br' || tag === 'hr') return '\n'
    if (/^h[1-4]$/.test(tag)) return `\n${'#'.repeat(Number(tag[1]))} ${value}\n`
    if (['strong', 'b'].includes(tag)) return `**${value}**`
    if (['em', 'i'].includes(tag)) return `*${value}*`
    if (tag === 'u' || tag === 's') return `[${tag === 'u' ? '下划线' : '删除线'}：${value}]`
    if (tag === 'li') return `\n• ${value}`
    if (['p', 'div', 'blockquote', 'figure', 'figcaption', 'ul', 'ol'].includes(tag)) return `\n${value}\n`
    return value
  }
  return read(template.content).replace(/\n{3,}/g, '\n\n').trim()
}

export function DiffReview({ before, after, busy = false, title = '修改对比' }: { before: string; after: string; busy?: boolean; title?: string }) {
  const result = useMemo(() => {
    if (busy) return null
    const oldText = reviewText(before), newText = reviewText(after)
    const diff = diffChars(oldText, newText, { timeout: 40, maxEditLength: 10_000 })
    const simplified = !diff || diff.length > 2000
    const changes = simplified ? [{ value: oldText, removed: true, added: false }, { value: newText, added: true, removed: false }] : diff
    return { changes, simplified, added: changes.filter(c => c.added).reduce((sum, c) => sum + [...c.value].length, 0), removed: changes.filter(c => c.removed).reduce((sum, c) => sum + [...c.value].length, 0) }
  }, [before, after, busy])
  return <section aria-label={title} className="overflow-hidden rounded-xl border border-border bg-surface">
    <header className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{busy ? '正在生成候选稿，完成后显示差异。当前正文仍可编辑。' : `新增 ${result?.added ?? 0} 字符 · 删除 ${result?.removed ?? 0} 字符。标题、格式、链接与媒体用文字标记。`}</p>
    </header>
    {result && <div className="p-4 sm:p-6">
      {result.simplified && <p className="mb-4 text-sm text-warning">改动较多，以下整块展示删除稿与新增稿，请完整核对。</p>}
      <div className="mb-4 flex flex-wrap gap-3 text-xs"><span className="rounded bg-success-soft px-2 py-1 text-success">＋ 新增（下划线）</span><span className="rounded bg-danger-soft px-2 py-1 text-danger">− 删除（删除线）</span></div>
      {!result.added && !result.removed && <p className="mb-4 text-sm text-muted-foreground">未检测到正文、链接或媒体变化。</p>}
      <div className="whitespace-pre-wrap break-words text-base leading-8 [overflow-wrap:anywhere]">{result.changes.map((change, index) => change.added
        ? <ins key={index} className="bg-success-soft text-success underline decoration-success">{change.value}</ins>
        : change.removed ? <del key={index} className="bg-danger-soft text-danger">{change.value}</del> : <span key={index}>{change.value}</span>)}</div>
    </div>}
  </section>
}
