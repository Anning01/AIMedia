import type { SkillFile } from '../../../../shared/skills'

export function SkillReferences({ files = [] }: { files?: SkillFile[] }) {
  const references = files.filter(file => file.path !== 'SKILL.md')
  if (!references.length) return null
  return <section aria-label="Skill 参考资料" className="space-y-2 text-sm">
    <h4 className="font-medium">参考资料（{references.length}）</h4>
    <p className="text-xs text-muted-foreground">执行时仅加载说明及其链接引用的文件，不运行脚本。</p>
    {references.map(file => <details key={file.path} className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer break-all font-medium">{file.path}</summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-6">{file.content}</pre>
    </details>)}
  </section>
}
