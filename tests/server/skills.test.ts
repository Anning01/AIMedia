import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSkillMarkdown, SkillInstaller, skillReferences, validateSkillFiles } from '../../electron/server/skills.js';
import { assertSkillGrants, loadSkills, selectSkills } from '../../electron/server/skill-runtime.js';
import { Store } from '../../electron/server/store.js';
import type { Template } from '../../electron/server/types.js';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = (header = '', body = '只修改用户指定的内容。') => ({
  filename: 'SKILL.md',
  content: `---\nname: fact-check\ndescription: 核实事实\n${header}---\n${body}`,
});

test('Skill YAML supports multiline descriptions, quotes and comments without dropping permissions', () => {
  const content = '\uFEFF---\r\nname: "中文 skill"\r\ndescription: >-\r\n  多行说明\r\n  和第二行\r\nversion: 1.0.0-beta.1+build.2\r\npermissions: [web_search] # 权限\r\n---\r\n正文';
  const parsed = parseSkillMarkdown('SKILL.md', content);
  assert.equal(parsed.description, '多行说明 和第二行');
  assert.equal(parsed.name, '中文 skill');
  assert.deepEqual(parsed.permissions, ['web_search']);
  assert.equal(parsed.version, '1.0.0-beta.1+build.2');
});

test('Skill parser rejects duplicate fields, bad types, unknown permissions, unsafe tags and invalid versions', () => {
  for (const header of [
    'name: overwritten\n', 'permissions: web_search\n', 'permissions: [shell]\n',
    'permissions: [web_search\n', 'permissions: {browser: yes}\n',
    'version: 01.0.0\n', 'version: 1.0.0-01\n', 'version: banana\n',
    'extra: !!js/function "function () {}"\n',
  ]) assert.throws(() => parseSkillMarkdown('SKILL.md', file(header).content));
  assert.throws(() => parseSkillMarkdown('SKILL.md', file('', ' ').content));
  assert.throws(() => parseSkillMarkdown('file.exe', file().content));
  assert.throws(() => parseSkillMarkdown('SKILL.md', file('', '中'.repeat(50_000)).content));
  assert.deepEqual(parseSkillMarkdown('SKILL.md', file().content).permissions, []);
});

test('Skill install requires an unmodified review and detects concurrent replacement', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const installer = new SkillInstaller(store, 'private-preview-key');
  const input = file('permissions: [web_search]\n');
  const before = store.rows('SELECT * FROM rewrite_templates');
  const review = installer.preview(input);
  assert.deepEqual(store.rows('SELECT * FROM rewrite_templates'), before);
  assert.equal(review.existing, null);
  assert.deepEqual(review.added_permissions, ['web_search']);
  assert.throws(() => installer.install(input, 'fake'), /预览已失效/);
  assert.throws(() => installer.install({ ...input, content: input.content + '隐藏变化' }, review.approval_token), /预览已失效/);
  const result = installer.install(input, review.approval_token);
  assert.equal(result.action, 'installed');
  assert.throws(() => installer.install(input, review.approval_token), /预览已失效/);
  const updatedInput = file('version: 2.0.0\npermissions: [web_search, browser]\n');
  const updateReview = installer.preview(updatedInput);
  assert.deepEqual(updateReview.added_permissions, ['browser']);
  store.update('rewrite_templates', result.skill.id, { enabled: false });
  assert.throws(() => installer.install(updatedInput, updateReview.approval_token), /预览已失效/);
  assert.equal(store.get<Template>('rewrite_templates', result.skill.id)?.version, '1.0.0');
  const fresh = installer.preview(updatedInput);
  const updated = installer.install(updatedInput, fresh.approval_token);
  assert.equal(updated.skill.id, result.skill.id);
  assert.equal(updated.skill.enabled, false);
  assert.equal(updated.skill.version, '2.0.0');
  for (const name of ['专业', 'professional']) {
    assert.throws(() => installer.preview({ ...input, content: input.content.replace('fact-check', name) }), /内置/);
  }
});

test('an expired Skill review cannot grant permissions', t => {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const installer = new SkillInstaller(store, 'preview-secret');
  const input = file('permissions: [browser]\n');
  const preview = installer.preview(input);
  const expiredAt = Date.now() + 11 * 60_000;
  t.mock.method(Date, 'now', () => expiredAt);
  assert.throws(() => installer.install(input, preview.approval_token), /预览已失效/);
  assert.equal(store.rows('SELECT id FROM rewrite_templates WHERE is_builtin=0').length, 0);
});

test('Skill packages load only linked references and reject scripts, traversal and missing files', () => {
  const files = validateSkillFiles([
    { path: 'references/deep/facts.json', content: '{"confirmed":true}' },
    { path: 'SKILL.md', content: `${file().content}\n\n[方法](references/method.md)` },
    { path: 'references/unused.txt', content: '不应加载' },
    { path: 'references/method.md', content: '使用资料：[事实](deep/facts.json)' },
  ]);
  assert.deepEqual(files.map(item => item.path), ['SKILL.md', 'references/deep/facts.json', 'references/method.md', 'references/unused.txt']);
  assert.deepEqual(skillReferences(files).map(item => item.path), ['references/method.md', 'references/deep/facts.json']);
  for (const bad of [
    [{ path: 'SKILL.md', content: `${file().content}\n[越界](../secret.txt)` }],
    [{ path: 'SKILL.md', content: `${file().content}\n[缺失](references/missing.md)` }],
    [{ path: 'SKILL.md', content: file().content }, { path: 'scripts/run.sh', content: 'echo unsafe' }],
    [{ path: 'SKILL.md', content: file().content }, { path: 'references/../escape.md', content: 'unsafe' }],
  ]) assert.throws(() => skillReferences(validateSkillFiles(bad)), /参考资料|只允许|缺少引用/);
});

test('directory Skills persist outside app code and routing is deterministic and permission-safe', t => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-media-skill-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new Store(join(dir, 'app.db'));
  t.after(() => store.close());
  const installer = new SkillInstaller(store, 'package-secret');
  const input = { files: [
    { path: 'SKILL.md', content: '---\nname: 地方新闻核查\ndescription: 核实地方新闻来源\nversion: 2.0.0\npermissions: [web_search]\ntriggers: [地方线索, 本地台账]\n---\n依据[检查表](references/check.md)逐条核实。' },
    { path: 'references/check.md', content: '无法验证时标记为不确定。' },
  ] };
  const installed = installer.install(input, installer.preview(input).approval_token).skill;
  const revisions = readdirSync(join(dir, 'skills', installed.skill_key));
  assert.equal(revisions.length, 1);
  assert.equal(readFileSync(join(dir, 'skills', installed.skill_key, revisions[0], 'references/check.md'), 'utf8'), '无法验证时标记为不确定。');

  const selected = selectSkills(store.rows<Template>('SELECT * FROM rewrite_templates'), '请按地方线索和本地台账核实这条报道');
  assert.equal(selected[0].skill.id, installed.id);
  assert.match(selected[0].reason, /关键词匹配/);
  const explicit = selectSkills(store.rows<Template>('SELECT * FROM rewrite_templates'), `请先 $${installed.skill_key} 再处理`, ['builtin-creative']);
  assert.deepEqual(explicit.map(item => item.skill.id), ['builtin-creative', installed.id]);
  const loaded = loadSkills(store, selected);
  assert.deepEqual(loaded[0].invocation.references, ['references/check.md']);
  assert.match(loaded[0].references, /无法验证时标记为不确定/);
  const builtins = selectSkills(store.rows<Template>('SELECT * FROM rewrite_templates'), '请为微信公众号优化标题');
  assert.deepEqual(builtins.map(item => item.skill.id), ['builtin-wechat', 'builtin-headline']);

  const run = store.createRun({ kind: 'agent_edit', user_prompt: 'request', system_prompt: 'system',
    tool_permissions: ['web_search'], skill_snapshot: loaded.map(item => item.invocation) });
  assert.doesNotThrow(() => assertSkillGrants(store, run));
  store.update('rewrite_templates', installed.id, { permissions: [] });
  assert.throws(() => assertSkillGrants(store, run), /撤回权限/);
  store.update('rewrite_templates', installed.id, { enabled: false, permissions: ['web_search'] });
  assert.throws(() => selectSkills(store.rows<Template>('SELECT * FROM rewrite_templates'), `$${installed.skill_key}`), /已停用/);
});
