import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Download, Copy, HardDrive } from 'lucide-react'
import { api } from '@/lib/api'
import { messages } from '@/lib/messages'
import { Button } from './ui/button'
import { Card, CardTitle } from './ui/card'
import { QueryFeedback } from './ui/query-feedback'

export function DesktopSettings() {
  const [busy, setBusy] = useState(false)
  const info = useQuery({ queryKey: ['desktop-info'], queryFn: () => api<{ data_dir: string; version: string; integration_url: string }>('/api/desktop/info') })
  const importData = async () => {
    setBusy(true)
    try {
      const result = await window.desktop!.importData()
      if (result) messages.success(`已导入 ${result.tasks} 个任务、${result.media} 个媒体${result.missing_media ? `；${result.missing_media} 个媒体需要重新上传` : ''}`)
    } catch (error) { messages.error(error instanceof Error ? error.message : '导入失败') }
    finally { setBusy(false) }
  }
  const copyToken = async () => {
    try {
      const result = await api<{ value: string }>('/api/desktop/integration-token')
      await navigator.clipboard.writeText(result.value)
      messages.success('接入令牌已复制')
    } catch { messages.error('无法复制接入令牌') }
  }
  return <Card className="settings-desktop-panel">
    <div className="settings-section-heading"><span className="settings-section-icon"><HardDrive size={21}/></span><div className="flex-1"><CardTitle>桌面应用</CardTitle><p>文章、版本和媒体保存在本机。</p></div>{info.data?.version && <span className="text-xs text-muted-foreground">v{info.data.version}</span>}</div>
    <QueryFeedback query={info} label="本机信息"/>
    <p className="mt-4 text-xs leading-6 text-muted-foreground">应用运行期间执行生成和定时发布；完全退出后暂停。</p>
    {info.data && <div className="desktop-integration"><p className="studio-field-label">AiMaster 接入地址</p><code className="block select-all break-all text-sm">{info.data.integration_url}</code><p className="mt-2 text-xs leading-6 text-muted-foreground">请求头填写 Authorization: Bearer 接入令牌。端口被占用时地址可能改变。</p></div>}
    <div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={copyToken}><Copy size={15}/>复制接入令牌</Button><Button variant="secondary" busy={busy} onClick={importData}><Download size={15}/>导入数据</Button><Button variant="ghost" onClick={() => { void window.desktop!.openDataDirectory().catch(() => messages.error('无法打开数据文件夹')) }}><FolderOpen size={15}/>打开数据文件夹</Button></div>
    {info.data?.data_dir && <p className="mt-4 break-all text-xs leading-6 text-muted-foreground">数据位置 · {info.data.data_dir}</p>}
  </Card>
}
