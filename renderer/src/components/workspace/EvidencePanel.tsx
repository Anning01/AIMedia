import { Clock3, FileSearch, Image as ImageIcon, Upload } from 'lucide-react'
import type { TaskMedia, Version } from '@/lib/api'
import { formatTime } from '@/lib/utils'
import type { FactCheckReport, SearchSource } from '../../../../shared/research'
import { FactCheckPanel } from './FactCheckPanel'
import { SourceCard } from './SourceCard'

export type EvidenceSource = SearchSource

export function EvidencePanel({ sources, report = null, versions, media, activeVersionId, mediaBusy, onActivateVersion, onUpload }: {
  sources: EvidenceSource[]
  report?: FactCheckReport | null
  versions: Version[]
  media: TaskMedia[]
  activeVersionId?: string
  mediaBusy: boolean
  onActivateVersion(version: Version): void
  onUpload(event: React.ChangeEvent<HTMLInputElement>): void
}) {
  return <aside className="workspace-evidence bg-surface" aria-label="文章资料">
    <FactCheckPanel report={report}/>
    <section>
      <div className="evidence-section-title"><FileSearch size={16}/><h2>求实来源</h2><span>{sources.length}</span></div>
      <div className="evidence-sources">{sources.map((source, index) => <SourceCard key={`${source.url}-${index}`} source={source}/>)}{!sources.length && <p className="evidence-empty">尚无检索来源。</p>}</div>
    </section>
    <section>
      <div className="evidence-section-title"><Clock3 size={16}/><h2>历史版本</h2><span>{versions.length}</span></div>
      <div className="mt-3 space-y-1">{versions.slice(0, 8).map(version => <button type="button" key={version.id} onClick={() => onActivateVersion(version)} aria-current={version.id === activeVersionId ? 'true' : undefined} className="evidence-version studio-row">
        <span className="evidence-version-dot" aria-hidden="true"/><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{version.source === 'agent' ? 'Agent 修改' : version.source === 'manual' ? '手动保存' : 'AI 生成'}</span>{version.id === activeVersionId && <span className="text-xs text-primary">当前</span>}</span><time className="mt-1 block text-xs text-muted-foreground" dateTime={version.created_at}>{formatTime(version.created_at)}</time></span>
      </button>)}{!versions.length && <p className="evidence-empty">暂无版本</p>}</div>
    </section>
    <section>
      <div className="evidence-section-title"><ImageIcon size={16}/><h2>媒体</h2><span>{media.length}</span></div>
      <label className="evidence-upload" aria-busy={mediaBusy}><Upload size={14} aria-hidden="true"/>{mediaBusy ? '处理中…' : '上传图片或视频'}<input className="sr-only" type="file" aria-label="上传图片或视频" accept="image/*,video/*" disabled={mediaBusy} onChange={onUpload}/></label>
    </section>
  </aside>
}
