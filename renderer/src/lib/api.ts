import type { SkillFile } from '../../../shared/skills'
export const API_BASE = window.desktop?.apiBase || (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000')

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...init, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(body.detail ?? '请求失败')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export type Task = {
  id: string; platform: string; original_title: string; original_content: string; style: string
  generation_status: string; publish_status: string; active_version_id?: string; html: string
  error?: string; created_at: string; updated_at: string; media?: TaskMedia[]
}
export type TaskMedia = {
  id: string; media_type: 'image' | 'video'; status: string; url: string | null
  preview_url: string | null; poster_url: string | null; alt_text: string
  origin: string; error: string | null; paragraph_index: number | null
  source_order: number | null
}
export type Version = { id: string; task_id: string; html: string; source: string; prompt?: string; created_at: string }
export type Account = {
  id: string; platform: string; name: string; adapter: string; webhook_url?: string; entry_url?: string; credentials: Record<string, boolean>
  status: string; publish_policy: string; daily_slots: string[]; delay_min: number; delay_max: number
  branding_enabled: boolean; header_html?: string; footer_html?: string
}
export type Schedule = { id: string; task_id: string; account_id: string; policy: string; status: string; scheduled_at: string; last_error?: string; attempt_count: number; latest_attempt_id?: string; account_adapter?: string; account_platform?: string; requires_outcome_review?: boolean }
export type RewriteTemplate = {
  id: string; skill_key: string; name: string; style_key: string | null; description: string
  system_prompt: string; user_prompt_template: string; is_builtin: boolean
  enabled: boolean; version: string; source: string; permissions: string[]
  skill_files?: SkillFile[]; triggers?: string[]
  created_at: string; updated_at: string
}
export type GenerationEvent = {
  id: number; task_id: string | null; run_id: string | null; event_type: string
  payload: Record<string, unknown>; created_at: string
}
