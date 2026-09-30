import { ExternalLink } from 'lucide-react'
import { sourceUrl, type SearchSource } from '../../../../shared/research'

export function SourceCard({ source, compact = false }: { source: SearchSource; compact?: boolean }) {
  const href = sourceUrl(source.url)
  const content = <><span className="source-site">{href ? new URL(href).hostname : '来源链接无效'}</span><span className="source-title"><span>{source.title}</span>{href && <ExternalLink size={12} aria-hidden="true"/>}</span>{!compact && source.summary && <span className="source-summary">{source.summary}</span>}</>
  const className = `source-card${compact ? ' source-card-compact' : ''}`
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a> : <div className={className}>{content}</div>
}
