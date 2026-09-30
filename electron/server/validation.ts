import { z } from "zod";
import { DateTime } from "luxon";
import { sanitizeHtml } from "./content.js";
import { skillPermissions, skillVersion, skillTriggers } from "./skills.js";
import { MAX_RUN_SKILLS } from "../../shared/skills.js";
export const policy = z.enum([
  "immediate",
  "daily_slots",
  "random_delay",
  "manual",
]);
const text = z.string().trim().min(1);
const optionalId = z.string().min(1).nullable().optional();
export const taskInput = z.object({
  platform: text,
  title: z.string(),
  content: z.string(),
  comments: z.array(z.unknown()).default([]),
  style: text.default("professional"),
  target_account_id: optionalId,
  publish_policy: policy.nullable().optional(),
});
export const templateInput = z.object({
  name: text.max(120),
  description: z.string().max(500).default(""),
  system_prompt: text,
  user_prompt_template: text,
  version: skillVersion.default("1.0.0"),
  enabled: z.boolean().default(true),
  permissions: skillPermissions.default(["web_search"]),
  triggers: skillTriggers.default([]),
});
export const agentEditInput = z.object({
  instruction: text.max(4000),
  revise_run_id: optionalId,
  template_id: optionalId,
  skill_ids: z.array(text).max(MAX_RUN_SKILLS).optional(),
  current_html: z.string().max(2_000_000).optional(),
  base_version_id: optionalId,
}).refine(data => !data.revise_run_id || (data.current_html === undefined && data.base_version_id !== undefined), {
  message: '继续修改候选稿时只提交候选稿标识和基准版本，不提交替换正文', path: ['revise_run_id'],
}).refine(data => data.current_html === undefined || data.base_version_id !== undefined, {
  message: '提交编辑框正文时必须同时提供基准版本', path: ['base_version_id'],
}).refine(data => !data.template_id || !data.skill_ids?.length, { message: '请勿同时提交两套 Skill 选择', path: ['skill_ids'] });
export const imageSkillSelectionInput = z.object({
  instruction: z.string().trim().max(4000).default(""),
  template_id: optionalId,
  skill_ids: z.array(text).max(MAX_RUN_SKILLS).optional(),
}).refine(data => !data.template_id || !data.skill_ids?.length, { message: '请勿同时提交两套 Skill 选择', path: ['skill_ids'] });
export const imagePromptInput = z.object({
  instruction: z.string().trim().max(4000).default(""),
  template_id: optionalId,
  skill_ids: z.array(text).max(MAX_RUN_SKILLS).optional(),
  current_html: z.string().max(2_000_000).optional(),
  base_version_id: optionalId,
}).refine(data => data.current_html === undefined || data.base_version_id !== undefined, {
  message: '提交编辑框正文时必须同时提供基准版本', path: ['base_version_id'],
}).refine(data => !data.template_id || !data.skill_ids?.length, { message: '请勿同时提交两套 Skill 选择', path: ['skill_ids'] });
const nullableHtml = z.string().transform(sanitizeHtml).nullable().optional();
export const accountInput = z.object({
  platform: text,
  name: text,
  adapter: z.enum(["browser", "webhook"]).default("webhook"),
  webhook_url: z
    .url({ protocol: /^https?$/ })
    .nullable()
    .optional(),
  entry_url: z
    .url({ protocol: /^https?$/ })
    .nullable()
    .optional(),
  credentials: z.record(z.string(), z.string()).default({}),
  status: z.enum(["active", "inactive", "disabled"]).default("active"),
  publish_policy: policy.default("manual"),
  daily_slots: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
    .default([]),
  delay_min: z.number().int().min(0).default(10),
  delay_max: z.number().int().min(0).default(30),
  branding_enabled: z.boolean().default(true),
  header_html: nullableHtml,
  footer_html: nullableHtml,
});
export const imageInput = z.object({
  task_id: optionalId,
  prompt: text,
  aspect_ratio: z.enum(["1:1", "4:3", "3:4", "16:9"]).default("16:9"),
  count: z.number().int().min(1).max(4).default(1),
  placement: z.enum(["cover", "after_section", "end"]).default("end"),
  alt_text: z.string().default(""),
});
export const articleInput = z.object({
  platform: text,
  article: z.record(z.string(), z.unknown()),
  style: text.default("professional"),
  target_account_id: optionalId,
  publish_policy: policy.nullable().optional(),
});
const endpoint = z.url({ protocol: /^https?$/ });
export const configInput = z
  .object({
    llm_model: text,
    llm_base_url: endpoint,
    rewrite_prompt: z.string(),
    openai_api_key: z.string(),
    firecrawl_api_key: z.string(),
    image_api_key: z.string(),
    github_token: z.string(),
    search_enabled: z.boolean(),
    max_search_results: z.coerce.number().int().min(1).max(10),
    timezone: text.refine((v) => DateTime.now().setZone(v).isValid, "时区无效"),
    branding_header_html: z.string().transform(sanitizeHtml),
    branding_footer_html: z.string().transform(sanitizeHtml),
    community_title: z.string(),
    community_qr_url: z.union([endpoint, z.literal("")]),
    community_contact: z.string(),
    github_repository: z.string().regex(/^(?:[\w.-]+\/[\w.-]+)?$/),
    public_base_url: z.union([endpoint, z.literal("")]),
    image_provider: z.enum(["gpt-image-2", "gptimage2", "openai", "method"]),
    image_model: text,
    image_base_url: endpoint,
    image_quality: z.enum(["auto", "low", "medium", "high"]),
    image_custom_size_quality: z.boolean(),
  })
  .partial();
export const defaults = {
  llm_model: "gpt-4o-mini",
  llm_base_url: "https://api.openai.com/v1",
  rewrite_prompt: "你是一个资深媒体编辑。",
  search_enabled: true,
  max_search_results: 3,
  timezone: "Asia/Shanghai",
  branding_header_html: "",
  branding_footer_html: "",
  community_title: "加入社群",
  community_qr_url: "",
  community_contact: "",
  github_repository: "",
  public_base_url: "",
  image_provider: "gpt-image-2",
  image_model: "gpt-image-2",
  image_base_url: "https://api.openai.com/v1",
  image_quality: "auto",
  image_custom_size_quality: true,
};
