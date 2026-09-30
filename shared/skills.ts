export const skillPermissionLabels = {
  web_search: "网络搜索", image_generation: "图片生成", image_edit: "图片编辑", browser: "浏览器",
} as const;
export type SkillPermission = keyof typeof skillPermissionLabels;
export type SkillFile = { path: string; content: string };
export const MAX_SKILL_FILES = 32;
export const MAX_SKILL_BYTES = 512 * 1024;
export const MAX_RUN_SKILLS = 3;
export type SkillInvocation = {
  id: string; skill_key: string; name: string; version: string; source: string;
  permissions: string[]; reason: string; references: string[];
};
