import { Button } from './button'
import { LoadingState, Skeleton } from './loading'

type QueryState = { data?: unknown; isLoading: boolean; isFetching: boolean; isError: boolean; refetch(): unknown }

/** Read-only query feedback. It never owns, replaces, or remounts the query's content. */
export function QueryFeedback({ query, label, errorMessage }: { query: QueryState; label: string; errorMessage?: string }) {
  const hasData = query.data !== undefined
  if (query.isLoading && !hasData) return <div className="space-y-3 py-4">
    <LoadingState label={`正在读取${label}…`}/>
    <Skeleton className="h-16"/><Skeleton className="h-16"/><Skeleton className="h-16"/>
  </div>
  if (query.isError) return <div role="alert" className="rounded-xl border border-danger bg-danger-soft p-4 text-sm text-danger">
    <p>{errorMessage ?? `${label}读取失败。${hasData ? '已保留上次读取的内容。' : '请重试。'}`}</p>
    <Button variant="secondary" className="mt-3" busy={query.isFetching} onClick={() => void query.refetch()}>{`重新读取${label}`}</Button>
  </div>
  if (query.isFetching && hasData) return <LoadingState className="justify-start py-2" label={`正在刷新${label}，当前内容仍可查看…`}/>
  return null
}
