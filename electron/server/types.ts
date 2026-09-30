import type { SkillFile, SkillInvocation } from "../../shared/skills.js";
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export type Row = Record<string, any>;
export type Policy = "manual" | "immediate" | "daily_slots" | "random_delay";
export interface Task {
  id: string;
  platform: string;
  original_title: string;
  original_content: string;
  original_comments: Json[];
  style: string;
  generation_status: string;
  publish_status: string;
  active_version_id: string | null;
  target_account_id: string | null;
  publish_policy_override: Policy | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  html: string;
}
export interface Run {
  id: string;
  task_id: string | null;
  source_task_id: string | null;
  template_id: string | null;
  tool_permissions: string[];
  skill_snapshot: SkillInvocation[];
  base_version_id: string | null;
  base_html: string | null;
  parent_run_id: string | null;
  kind: string;
  status: string;
  system_prompt: string;
  user_prompt: string;
  partial_html: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}
export interface Asset {
  id: string;
  task_id: string | null;
  media_type: "image" | "video";
  url: string | null;
  local_path: string | null;
  mime_type: string | null;
  alt_text: string;
  status: string;
  metadata_json: Row;
  created_at: string;
}
export interface Template {
  id: string;
  skill_key: string;
  name: string;
  description: string;
  style_key: string | null;
  system_prompt: string;
  user_prompt_template: string;
  is_builtin: boolean;
  enabled: boolean;
  version: string;
  source: string;
  permissions: string[];
  skill_files?: SkillFile[];
  triggers?: string[];
  created_at: string;
  updated_at: string;
}
export interface Account {
  id: string;
  platform: string;
  name: string;
  adapter: string;
  webhook_url: string | null;
  entry_url: string | null;
  credentials: Record<string, string>;
  status: string;
  publish_policy: Policy;
  daily_slots: string[];
  delay_min: number;
  delay_max: number;
  branding_enabled: boolean;
  header_html: string | null;
  footer_html: string | null;
  created_at: string;
  updated_at: string;
}
export interface Schedule {
  id: string;
  task_id: string;
  account_id: string;
  version_id: string | null;
  account_revision: string | null;
  title_snapshot: string | null;
  policy: Policy;
  status: string;
  scheduled_at: string;
  idempotency_key: string;
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
export interface GenerationEvent {
  id: number;
  task_id: string | null;
  run_id: string | null;
  event_type: string;
  payload: Row;
  created_at: string;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const now = () => new Date().toISOString();
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
