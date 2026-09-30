import { MAX_RUN_SKILLS, type SkillInvocation } from "../../shared/skills.js";
import type { Store } from "./store.js";
import { HttpError, type Run, type Template } from "./types.js";
import { skillFiles, skillReferences, persistSkillPackage } from "./skills.js";

type SelectedSkill = { skill: Template; reason: string };
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("en-US");
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
const generic = new Set(["文章", "内容", "修改", "用户", "要求", "使用", "进行", "可以", "需要", "说明", "skill", "适合"]);

/** Keyword routing is deterministic, inspectable, and never grants undeclared tools. */
export function selectSkills(all: Template[], instruction: string, ids: string[] = [], style?: string, autoEligible: (skill: Template) => boolean = () => true): SelectedSkill[] {
  const explicit = new Map<string, SelectedSkill>();
  const add = (skill: Template | undefined, reason: string) => {
    if (!skill || !skill.enabled) throw new HttpError(422, "明确指定的 Skill 不存在或已停用，请检查本轮选择和 $标识");
    if (!explicit.has(skill.id)) explicit.set(skill.id, { skill, reason });
  };
  for (const id of ids) add(all.find(skill => skill.id === id), "用户在选择器中指定");
  for (const mention of instruction.matchAll(/(?:^|\s)\$([\p{L}\p{N}-]+)/gu))
    add(all.find(skill => normalize(skill.skill_key) === normalize(mention[1])), `用户明确调用 $${mention[1]}`);
  if (explicit.size > MAX_RUN_SKILLS) throw new HttpError(422, `每轮最多调用 ${MAX_RUN_SKILLS} 个 Skills`);
  if (explicit.size) return [...explicit.values()];

  const request = normalize(instruction);
  const enabled = all.filter(skill => skill.enabled && autoEligible(skill));
  const matches = enabled.map(skill => {
    const keywords = skill.triggers?.length ? skill.triggers : [skill.name, ...Array.from(segmenter.segment(skill.description), word => word.isWordLike ? word.segment : "")];
    const matched = [...new Set(keywords.map(normalize))].filter(word => word.length >= 2 && !generic.has(word) && request.includes(word));
    return { skill, matched };
  }).filter(item => item.matched.length).sort((a, b) => b.matched.length - a.matched.length || (a.skill.skill_key < b.skill.skill_key ? -1 : a.skill.skill_key > b.skill.skill_key ? 1 : a.skill.id.localeCompare(b.skill.id)));
  if (matches.length) return matches.slice(0, MAX_RUN_SKILLS).map(({ skill, matched }) => ({ skill, reason: `关键词匹配：${matched.join("、")}` }));
  const fallback = enabled.find(skill => skill.is_builtin && skill.style_key === style) ?? enabled.find(skill => skill.id === "builtin-professional");
  return fallback ? [{ skill: fallback, reason: "未命中关键词，使用文章默认风格" }] : [];
}

export function loadSkills(store: Store, selected: SelectedSkill[]) {
  const loaded = selected.map(({ skill, reason }) => {
    const files = skillFiles(skill);
    const references = skillReferences(files);
    persistSkillPackage(store, skill);
    const invocation: SkillInvocation = { id: skill.id, skill_key: skill.skill_key, name: skill.name, version: skill.version, source: skill.source,
      permissions: skill.permissions, reason, references: references.map(file => file.path) };
    return { invocation, instructions: skill.system_prompt, method: skill.user_prompt_template,
      references: references.map(file => `【参考文件 ${file.path}】\n${file.content}`).join("\n\n") };
  });
  if (loaded.reduce((size, skill) => size + skill.instructions.length + skill.method.length + skill.references.length, 0) > 128_000)
    throw new HttpError(413, "本轮 Skill 指令和引用内容超过 128,000 字符，请精简参考资料或减少调用数量");
  return loaded;
}
export type LoadedSkill = ReturnType<typeof loadSkills>[number];

/** Saved instructions do not change mid-run; revoked grants cannot authorize a new request. */
export function assertSkillGrants(store: Store, run: Run) {
  assertSkillSnapshot(store, run.skill_snapshot, '改稿');
}

export function assertSkillSnapshot(store: Store, snapshots: SkillInvocation[], action: string) {
  for (const snapshot of snapshots) {
    const current = store.get<Template>("rewrite_templates", snapshot.id);
    if (!current?.enabled || snapshot.permissions.some(permission => !current.permissions.includes(permission)))
      throw new HttpError(409, `Skill「${snapshot.name}」已停用、卸载或撤回权限，请重新发起${action}`);
  }
}
