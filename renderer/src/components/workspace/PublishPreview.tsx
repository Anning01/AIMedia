import { reviewText } from '@/components/workspace/DiffReview'

export type PublishPreviewData = {
  account: { name: string; platform: string }
  article: { title: string; html: string; image_count: number; version_id?: string }
}

export function PublishPreview({ account, article, bodyLimit = 320 }: PublishPreviewData & { bodyLimit?: number }) {
  const body = reviewText(article.html)
  return <div className="space-y-2 rounded-xl bg-surface p-3 text-xs leading-5">
    <p><strong>平台：</strong>{account.platform}</p>
    <p><strong>账号：</strong>{account.name}</p>
    <p><strong>标题：</strong>{article.title}</p>
    <p><strong>正文：</strong>{body.slice(0, bodyLimit)}{body.length > bodyLimit ? '…' : ''}</p>
    <p><strong>图片：</strong>{article.image_count} 张</p>
    {article.version_id && <p className="text-muted-foreground">已锁定文章版本：{article.version_id.slice(0, 8)}</p>}
  </div>
}
