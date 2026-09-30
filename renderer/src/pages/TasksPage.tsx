import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDownWideNarrow, ArrowRight, FilePlus2, FileText, Plus, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { api, API_BASE, type Task } from '@/lib/api'
import { messages } from '@/lib/messages'
import { promptText } from '@/lib/prompt'
import { articleSourceLabel, cn, formatTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QueryFeedback } from '@/components/ui/query-feedback'

type ArticleFilter = 'all' | 'unpublished' | 'published'
const filters: { value: ArticleFilter; label: string }[] = [
  { value: 'all', label: '全部文章' }, { value: 'unpublished', label: '未发布' }, { value: 'published', label: '已发布' },
]

export function TasksPage() {
  const client = useQueryClient()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ArticleFilter>('all')
  const [creating, setCreating] = useState(false)
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/api/tasks') })
  useEffect(() => {
    const stream = new EventSource(API_BASE + '/api/tasks/events', { withCredentials: true })
    const refresh = () => client.invalidateQueries({ queryKey: ['tasks'] })
    ;['status', 'completed', 'error', 'media'].forEach(name => stream.addEventListener(name, refresh))
    return () => stream.close()
  }, [client])
  const shown = useMemo(() => (tasks.data ?? []).filter(task => {
    const matchesStatus = filter === 'all' || (filter === 'published' ? task.publish_status === 'published' : task.publish_status !== 'published')
    const searchable = [task.original_title, task.original_content, task.platform, articleSourceLabel(task.platform)].join(' ').toLowerCase()
    return matchesStatus && searchable.includes(query.trim().toLowerCase())
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [query, filter, tasks.data])
  const createArticle = async () => {
    if (creating) return
    const title = await promptText('文章标题')
    if (!title) return
    setCreating(true)
    try {
      await messages.promise(api('/api/tasks', { method: 'POST', body: JSON.stringify({ platform: 'manual', title, content: title }) }), { loading: '正在创建文章…', success: '文章已创建' })
      await tasks.refetch()
    } catch {
      // Global feedback already reports the error.
    } finally {
      setCreating(false)
    }
  }
  const resetFilters = () => { setQuery(''); setFilter('all') }
  const filtered = Boolean(query.trim()) || filter !== 'all'

  return <div className="article-library">
    <header className="studio-page-heading">
      <div><h1 className="studio-page-title">文章工作台</h1></div>
      <div className="studio-page-actions"><Button onClick={createArticle} busy={creating}><Plus size={17}/>新建文章</Button></div>
    </header>

    <section className="article-library-content" aria-label="文章管理">
      <div className="article-toolbar">
        <div className="article-filters" role="group" aria-label="文章筛选">
          {filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} className={cn('article-filter', filter === item.value && 'article-filter--active')} onClick={() => setFilter(item.value)}>
            {item.label}{item.value === 'all' && tasks.data && <span className="article-count">{tasks.data.length}</span>}
          </button>)}
        </div>
        <div className="article-search-tools">
          <div className="article-search"><Search size={16} aria-hidden="true"/><Input aria-label="搜索文章" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、正文或来源" className={query ? 'pr-12' : undefined}/>{query && <Button type="button" variant="ghost" size="icon" className="article-search-clear" aria-label="清空搜索" onClick={() => setQuery('')}><X size={15}/></Button>}</div>
          <Button variant="ghost" size="icon" busy={tasks.isFetching} onClick={() => tasks.refetch()} aria-label="刷新" title="刷新文章"><RefreshCw size={17}/></Button>
        </div>
      </div>

      <QueryFeedback query={tasks} label="文章列表"/>
      {(shown.length > 0 || tasks.isSuccess) && <div className="article-list" aria-label="文章列表">
        {shown.length > 0 && <div className="article-list-heading" aria-hidden="true"><span>文章</span><span>编辑 / 发布状态</span><span className="flex items-center gap-1.5"><ArrowDownWideNarrow size={13}/>最近更新</span><span/></div>}
        {shown.map(task => <Link key={task.id} to="/articles/$articleId" params={{ articleId: task.id }} className="article-row group">
          <span className="article-file-icon" aria-hidden="true"><FileText size={21} strokeWidth={1.5}/></span>
          <span className="article-row-main">
            <strong className="article-row-title">{task.original_title || '无标题文章'}</strong>
            <span className="article-row-summary"><span className="article-row-source">{articleSourceLabel(task.platform)}</span><span className="article-summary-divider" aria-hidden="true">·</span><span className="article-row-excerpt">{task.original_content?.replace(/\s+/g, ' ').slice(0, 220) || '尚未添加正文，打开文章开始创作。'}</span></span>
          </span>
          <span className="article-row-status"><span><span className="sr-only">编辑状态：</span><Badge value={task.generation_status}/></span><span><span className="sr-only">发布状态：</span><Badge value={task.publish_status} label={task.publish_status === 'draft' ? '未发布' : undefined}/></span></span>
          <span className="article-row-updated"><span className="article-updated-label">最近更新 </span><time dateTime={task.updated_at}>{formatTime(task.updated_at)}</time></span>
          <ArrowRight size={17} className="article-row-arrow" aria-hidden="true"/>
        </Link>)}
        {tasks.isSuccess && !shown.length && <div className="studio-empty-state article-empty-state">
          <div className="empty-document-scene" aria-hidden="true"><span className="empty-document-back"/><span className="empty-document-front"><FileText size={23}/><i/><i/><i/></span><span className="empty-document-spark"><Sparkles size={18}/></span></div>
          <h2>{filtered ? '没有匹配的文章' : '从第一篇文章开始'}</h2>
          <p>{filtered ? '试试其他关键词，或查看全部文章。' : '写下一个标题，把接下来的求实、改稿和配图交给 Agent 协作。'}</p>
          {filtered ? <Button variant="secondary" onClick={resetFilters}>查看全部文章</Button> : <Button variant="secondary" onClick={createArticle} busy={creating}><FilePlus2 size={16}/>创建第一篇文章</Button>}
        </div>}
        {shown.length > 0 && <div className="article-list-footer"><span>{filtered ? '找到 ' : '共 '}{shown.length} 篇文章</span><span>打开文章，继续创作<ArrowRight size={12}/></span></div>}
      </div>}
    </section>
  </div>
}
