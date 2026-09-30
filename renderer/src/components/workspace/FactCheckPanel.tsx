import { FileCheck2 } from 'lucide-react'
import { factCheckStatusLabels, verdictLabels, type FactCheckReport } from '../../../../shared/research'
import { formatTime } from '@/lib/utils'
import { SourceCard } from './SourceCard'

const verdictStyle = {
  supported: 'bg-success-soft text-success',
  contradicted: 'bg-danger-soft text-danger',
  disputed: 'bg-warning-soft text-warning',
  uncertain: 'bg-muted text-foreground',
}

export function FactCheckPanel({ report }: { report: FactCheckReport | null }) {
  return <section aria-label="事实核查结论" className="min-w-0 rounded-2xl border border-border bg-surface p-4 [overflow-wrap:anywhere]">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={16} className="shrink-0 text-primary"/>事实核查</h2>
    {!report ? <p className="mt-3 text-xs leading-5 text-muted-foreground">让 Agent 核查关键事实后，这里会逐条展示原文、结论和证据。检索到来源不等于核实完成。</p> : <>
      <p className="mt-3 text-xs font-medium">{factCheckStatusLabels[report.status]}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.note}</p>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{report.scope.input_proposal_id ? '基于本轮继续修改的候选稿，不能当作当前正文的核查结果。' : '基于发送时正文，后续编辑未重新核查。'}<br/><time dateTime={report.checked_at}>{formatTime(report.checked_at)}</time></p>
      {report.scope.article_truncated && <p className="mt-2 rounded-lg bg-warning-soft p-2 text-xs leading-5 text-warning">长文仅从前 {report.scope.input_chars.toLocaleString()} 字符提取关键事实，后续内容未核查。</p>}
      <div className="mt-3 space-y-2">{report.claims.map(claim => <details key={claim.id} className="rounded-xl border border-border">
        <summary className="min-h-11 cursor-pointer rounded-xl p-3 text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${verdictStyle[claim.verdict]}`}>{verdictLabels[claim.verdict]}</span>
          <span className="mt-2 block">{claim.excerpt}</span>
        </summary>
        <div className="space-y-3 border-t border-border p-3 text-xs leading-5">
          <p>{claim.reason}</p>
          <p className="text-muted-foreground">检索词：{claim.query}</p>
          {claim.search_status === 'failed' && <p className="text-danger">本条检索失败，需要重新核查。</p>}
          {claim.evidence.map((evidence, index) => {
            const source = report.sources.find(source => source.id === evidence.source_id)
            return source && <figure key={`${evidence.source_id}-${index}`} className="space-y-2">
              <figcaption className="text-muted-foreground">{evidence.stance === 'supports' ? '支持性证据' : '反驳性证据'} · {source.content_kind === 'page' ? '网页摘录' : '仅搜索摘要，不足以确认'}</figcaption>
              <blockquote className="border-l-2 border-info pl-2">{evidence.quote}</blockquote>
              <SourceCard source={source} compact/>
            </figure>
          })}
          {!claim.evidence.length && <p className="text-muted-foreground">暂无可对应的证据摘录。</p>}
        </div>
      </details>)}</div>
    </>}
  </section>
}
