import { loadSkills, selectSkills, type LoadedSkill } from './skill-runtime.js';
import type { Store } from './store.js';
import type { Template } from './types.js';

export function resolveImageSkills(store: Store, instruction: string, ids: string[] = [], style?: string) {
  return loadSkills(store, selectSkills(store.rows<Template>('SELECT * FROM rewrite_templates'), instruction, ids, style,
    skill => skill.permissions.some(permission => permission === 'image_generation' || permission === 'image_edit')));
}

/** Skill content is advisory text for prompt design; it never authorizes image generation. */
export function imageSkillContext(skills: LoadedSkill[]) {
  if (!skills.length) return '';
  return `【本轮配图 Skills（按顺序应用，仅用于设计提示词）】\n${skills.map(skill =>
    `【Skill ${skill.invocation.name} v${skill.invocation.version}】\n${skill.instructions}\n${skill.references}`,
  ).join('\n\n')}\n\n`;
}
