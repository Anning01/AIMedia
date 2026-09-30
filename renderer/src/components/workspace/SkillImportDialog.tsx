import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { api, type RewriteTemplate } from '@/lib/api'
import { getErrorMessage } from '@/lib/messages'
import { permissionLabels } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { ApprovalCard } from './ApprovalCard'
import { SkillReferences } from './SkillReferences'
import { MAX_SKILL_BYTES, MAX_SKILL_FILES, type SkillFile } from '../../../../shared/skills'

type SkillInput = { filename: string; content: string } | { files: SkillFile[] }
type Preview = {
  skill: Pick<RewriteTemplate, 'name' | 'version' | 'description' | 'permissions' | 'system_prompt' | 'skill_files' | 'triggers'>
  existing: Pick<RewriteTemplate, 'name' | 'version' | 'enabled'> | null
  added_permissions: string[]
  approval_token: string
}

export function SkillImportDialog({ onInstalled }: { onInstalled(skill: RewriteTemplate): void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const directoryRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<SkillInput | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const prepare = async (candidate: SkillInput) => {
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      setPreview(await api<Preview>('/api/skills/import/preview', { method: 'POST', body: JSON.stringify(candidate) }))
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>, directory = false) => {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!selected.length || busy) return
    setFile(null)
    setPreview(null)
    setError('')
    setOpen(true)
    setBusy(true)
    try {
      if (selected.length > MAX_SKILL_FILES) throw new Error(`Skill 包最多包含 ${MAX_SKILL_FILES} 个文件`)
      if (selected.some(file => file.size > 128 * 1024)) throw new Error('每个 Skill 文件不能超过 128 KB')
      if (selected.reduce((size, file) => size + file.size, 0) > MAX_SKILL_BYTES) throw new Error('Skill 包不能超过 512 KB')
      const candidate: SkillInput = directory ? { files: await Promise.all(selected.map(async file => ({
        path: file.webkitRelativePath.slice(file.webkitRelativePath.indexOf('/') + 1), content: await file.text(),
      }))) } : { filename: selected[0].name, content: await selected[0].text() }
      setFile(candidate)
      await prepare(candidate)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  const install = async () => {
    if (!file || !preview || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ skill: RewriteTemplate }>('/api/skills/import', {
        method: 'POST', body: JSON.stringify({ ...file, approval_token: preview.approval_token }),
      })
      setOpen(false)
      onInstalled(result.skill)
    } catch (cause) {
      setError(getErrorMessage(cause))
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }
  return <>
    <input ref={inputRef} aria-label="选择 SKILL.md" type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={event => selectFile(event)}/>
    <input ref={node => { directoryRef.current = node; if (node) node.webkitdirectory = true }} aria-label="选择 Skill 文件夹" type="file" multiple className="hidden" onChange={event => selectFile(event, true)}/>
    <Dialog.Root open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <Dialog.Trigger asChild><Button disabled={busy}><FileUp size={15}/>导入</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-dialog-overlay fixed inset-0 z-40 bg-overlay"/>
        <Dialog.Content className="ui-dialog-center fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-surface p-5">
          <Dialog.Title className="text-lg font-semibold">检查 Skill 安装内容</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-sm text-muted-foreground">请仅安装可信来源的 Skill。确认前不会写入或修改已安装内容。</Dialog.Description>
          <div className="mb-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>选择 SKILL.md</Button><Button variant="secondary" onClick={() => directoryRef.current?.click()} disabled={busy}>选择 Skill 文件夹</Button></div>
          <p className="mb-4 text-xs text-muted-foreground">文件夹需包含 SKILL.md，可携带 references/ 下的 .md、.txt、.json 资料。最多 {MAX_SKILL_FILES} 个文件、合计 512 KB，不支持脚本或压缩包。</p>
          {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          {preview ? <ApprovalCard
            title={preview.existing ? '确认更新 Skill' : '确认安装 Skill'}
            description={preview.existing ? `将替换“${preview.existing.name}”的指令和权限，保留当前${preview.existing.enabled ? '启用' : '停用'}状态。` : '将安装并启用以下 Skill，图片生成和真实发布仍需逐次确认。'}
            confirmLabel={preview.existing ? '确认更新' : '确认安装'} busy={busy} onConfirm={install} onCancel={() => setOpen(false)}
          >
            <h3 className="font-semibold">{preview.skill.name}</h3>
            <p className="mt-1 text-sm text-foreground">{preview.skill.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">版本：{preview.existing ? `${preview.existing.version} → ` : ''}{preview.skill.version}</p>
            <h4 className="mt-4 text-sm font-medium">声明的工具权限</h4>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {preview.skill.permissions.map(permission => <li key={permission}>{permissionLabels[permission] ?? permission}{preview.existing && preview.added_permissions.includes(permission) ? '（新增权限）' : ''}</li>)}
              {!preview.skill.permissions.length && <li>无额外工具权限</li>}
            </ul>
            <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">查看 Skill 指令</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-6">{preview.skill.system_prompt}</pre></details>
            <div className="mt-4"><SkillReferences files={preview.skill.skill_files}/></div>
          </ApprovalCard> : <div className="flex items-center gap-2">
            {busy ? <p role="status" className="text-sm">正在校验 Skill…</p> : <>{file && <Button onClick={() => prepare(file)}>重新预览</Button>}<Button variant="secondary" onClick={() => setOpen(false)}>取消</Button></>}
          </div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
