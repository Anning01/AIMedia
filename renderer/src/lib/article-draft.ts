import { useEffect, useRef, useState, type SetStateAction } from 'react'
import type { Task } from './api'
import { API_BASE } from './api'
import { withSourceMediaPreviews } from './source-media'
import { escapeHtml } from './utils'

type Draft = { html: string; savedHtml: string; versionId: string | null }
// Retain unsaved drafts across in-app navigation. Clean drafts are not cached.
// This is not a replacement for persistent saved versions.
const pendingDrafts = new Map<string, Draft>()
export function useUnsavedDraftWarning() {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!pendingDrafts.size) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
}
export const taskEditorHtml = (task: Task) => withSourceMediaPreviews(
  task.active_version_id ? task.html : task.html || `<h1>${escapeHtml(task.original_title)}</h1>${task.original_content.split(/\n\n+/).map(text => `<p>${escapeHtml(text)}</p>`).join('')}`,
  task.media ?? [], API_BASE,
)

export function useArticleDraft(articleId: string, task?: Task) {
  const [draft, setDraft] = useState<Draft | undefined>(() => pendingDrafts.get(articleId))
  const current = useRef(draft)
  const update = (next: Draft) => {
    current.current = next
    if (next.html !== next.savedHtml) pendingDrafts.set(articleId, next)
    else pendingDrafts.delete(articleId)
    setDraft(next)
  }
  useEffect(() => {
    if (!task) return
    const previous = current.current
    // Refetches may update status, media, or a remotely saved version. Never
    // replace a dirty editor as a side effect of receiving that data.
    if (!previous || previous.html === previous.savedHtml) {
      const html = taskEditorHtml(task)
      update({ html, savedHtml: html, versionId: task.active_version_id ?? null })
    }
  }, [task])
  const dirty = !!draft && draft.html !== draft.savedHtml
  return {
    html: draft?.html ?? '', dirty, versionId: draft?.versionId ?? null,
    conflict: !!task && !!draft && (task.active_version_id ?? null) !== draft.versionId,
    currentHtml: () => current.current?.html ?? '',
    setHtml(value: SetStateAction<string>) {
      if (!current.current) return
      update({ ...current.current, html: typeof value === 'function' ? value(current.current.html) : value })
    },
    saved(saved: Task, submitted: string) {
      const html = taskEditorHtml(saved)
      update({ html: current.current?.html === submitted ? html : current.current?.html ?? html, savedHtml: html, versionId: saved.active_version_id ?? null })
    },
    useSavedVersion() {
      if (!task) return
      const html = taskEditorHtml(task)
      update({ html, savedHtml: html, versionId: task.active_version_id ?? null })
    },
  }
}
