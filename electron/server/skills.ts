import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync, lstatSync, existsSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { load, dump, FAILSAFE_SCHEMA } from "js-yaml";
import { valid } from "semver";
import { z } from "zod";
import { Store, id } from "./store.js";
import { HttpError, now, type Template } from "./types.js";
import { MAX_SKILL_BYTES, MAX_SKILL_FILES, type SkillFile } from "../../shared/skills.js";

export const skillPermissions = z.array(z.enum([
  "web_search", "image_generation", "image_edit", "browser",
])).max(4).transform(values => [...new Set(values)]);
export const skillVersion = z.string().trim().max(40)
  .refine(value => valid(value) === value.split('+')[0], "Skill 版本须为语义化版本，例如 1.0.0");
const singleFileInput = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1).max(128 * 1024),
});
export const skillTriggers = z.array(z.string().trim().min(2).max(40)).max(20).transform(values => [...new Set(values)]);
const filesInput = z.array(z.object({ path: z.string().min(1).max(240), content: z.string().max(128 * 1024) })).min(1).max(MAX_SKILL_FILES);
export const skillImportInput = z.union([singleFileInput, z.object({ files: filesInput })]);
const metadataInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  version: skillVersion.default("1.0.0"),
  permissions: skillPermissions.default([]),
  triggers: skillTriggers.default([]),
});
type ImportInput = z.infer<typeof skillImportInput>;

export function skillKey(name: string) {
  return (
    name
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "skill"
  );
}

export function parseSkillMarkdown(filename: string, markdown: string) {
  if (!/\.md$/i.test(filename.trim()))
    throw new HttpError(415, "请选择 SKILL.md 文件");
  if (Buffer.byteLength(markdown, "utf8") > 128 * 1024)
    throw new HttpError(413, "SKILL.md 不能超过 128 KB");
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n([\s\S]*)$/.exec(normalized);
  if (!match) throw new HttpError(422, "SKILL.md 缺少有效的 YAML 头信息");
  let raw: unknown;
  try {
    // Reject duplicate keys and executable tags; reuse the installed YAML parser.
    raw = load(match[1], { schema: FAILSAFE_SCHEMA, json: false });
  } catch {
    throw new HttpError(422, "SKILL.md 头信息无效，请检查缩进、重复字段和 YAML 格式");
  }
  const parsed = metadataInput.safeParse(raw);
  if (!parsed.success) throw new HttpError(422,
    "SKILL.md 的 name、description、version 或 permissions 无效；权限必须为支持的工具列表");
  const instructions = match[2].trim();
  if (!instructions)
    throw new HttpError(422, "SKILL.md 必须包含执行说明");
  return {
    ...parsed.data,
    skill_key: skillKey(parsed.data.name),
    system_prompt: instructions,
    user_prompt_template:
      "请遵循本 Skill 的执行说明，根据用户本轮要求处理文章。\n\n标题：{title}\n\n正文：\n{content}",
    enabled: true,
    source: "file",
  };
}

/** Only text documents inside this package are accepted; no executable installers. */
export function validateSkillFiles(files: SkillFile[]): SkillFile[] {
  const checked = filesInput.parse(files).map(file => ({ ...file, path: file.path.normalize("NFC") }));
  const names = new Set<string>();
  let bytes = 0;
  for (const file of checked) {
    if ((file.path !== "SKILL.md" && !/^references\/(?:[^/]+\/)*[^/]+\.(md|txt|json)$/i.test(file.path)) ||
        file.path.includes("\\") || /[\x00-\x1f<>:"|?*]/.test(file.path) ||
        file.path.split("/").some(part => part.startsWith(".") || /[. ]$/.test(part)) || posix.normalize(file.path) !== file.path)
      throw new HttpError(422, "Skill 包只允许根目录 SKILL.md 和 references/ 下的 Markdown、文本或 JSON 文档；不接受脚本和越界路径");
    const key = file.path.toLocaleLowerCase("en-US");
    if (names.has(key)) throw new HttpError(422, "Skill 包含重复或大小写冲突的文件路径");
    names.add(key);
    const size = Buffer.byteLength(file.content, "utf8");
    if (size > 128 * 1024) throw new HttpError(413, "每个 Skill 文件不能超过 128 KB");
    bytes += size;
  }
  if (bytes > MAX_SKILL_BYTES) throw new HttpError(413, "Skill 包总大小不能超过 512 KB");
  if (!checked.some(file => file.path === "SKILL.md")) throw new HttpError(422, "Skill 包根目录缺少 SKILL.md");
  return checked.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function skillFiles(skill: Template): SkillFile[] {
  if (skill.skill_files?.length) return validateSkillFiles(skill.skill_files);
  return [{ path: "SKILL.md", content: `---\n${dump({ name: skill.name, description: skill.description || skill.name, version: skill.version, permissions: skill.permissions, triggers: skill.triggers ?? [] })}---\n${skill.system_prompt}\n\n${skill.user_prompt_template}` }];
}

export function skillReferences(files: SkillFile[]): SkillFile[] {
  const byPath = new Map(files.map(file => [file.path, file]));
  const visited = new Set<string>(["SKILL.md"]);
  const references: SkillFile[] = [];
  const scan = (file: SkillFile) => {
    for (const match of file.content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1].trim().replace(/^<|>$/g, "").split("#")[0];
      if (!target || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) continue;
      try { target = decodeURIComponent(target); } catch { throw new HttpError(422, "Skill 参考文件链接编码无效"); }
      const path = posix.join(posix.dirname(file.path), target);
      if (!path.startsWith("references/") || target.includes("\\") || target.startsWith("/")) throw new HttpError(422, "Skill 参考资料必须位于本包 references/ 目录");
      const reference = byPath.get(path);
      if (!reference) throw new HttpError(422, `Skill 缺少引用文件：${path}`);
      if (visited.has(path)) continue;
      visited.add(path); references.push(reference); scan(reference);
    }
  };
  scan(byPath.get("SKILL.md")!);
  return references;
}

/** SQLite is the confirmed package source; immutable directories are inspectable copies. */
export function persistSkillPackage(store: Store, skill: Template) {
  if (store.filename === ":memory:") return;
  const files = skillFiles(skill);
  const root = join(dirname(store.filename), "skills", skillKey(skill.skill_key));
  for (const path of [join(dirname(store.filename), "skills"), root]) {
    if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
    if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory()) throw new HttpError(409, "Skill 数据目录异常，请检查本地文件");
  }
  const revision = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  const destination = join(root, revision);
  if (existsSync(destination)) {
    if (lstatSync(destination).isSymbolicLink() || !lstatSync(destination).isDirectory()) throw new HttpError(409, "Skill 版本目录异常");
    return;
  }
  const staging = mkdtempSync(join(root, ".install-"));
  try {
    for (const file of files) {
      const path = join(staging, file.path);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, file.content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    }
    renameSync(staging, destination);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

/** The review token binds file contents and the exact installed revision. */
export class SkillInstaller {
  constructor(private store: Store, private secret: string) {}

  private resolve(input: ImportInput) {
    const files = validateSkillFiles("files" in input ? input.files : [{ path: "SKILL.md", content: input.content }]);
    const entry = files.find(file => file.path === "SKILL.md")!;
    const skill = { ...parseSkillMarkdown("filename" in input ? input.filename : "SKILL.md", entry.content), skill_files: files };
    skillReferences(files);
    const existing = this.store.rows<Template>(
      "SELECT * FROM rewrite_templates WHERE skill_key=?", skill.skill_key,
    ).at(0);
    const builtinCollision = this.store.rows<Template>(
      "SELECT * FROM rewrite_templates WHERE is_builtin=1",
    ).some(item => skillKey(item.name) === skill.skill_key);
    if (existing?.is_builtin || builtinCollision)
      throw new HttpError(409, "不能用导入文件覆盖内置 Skill");
    return { skill, existing };
  }

  private signature(input: ImportInput, existing: Template | undefined, expires: number) {
    return createHmac("sha256", this.secret)
      .update(JSON.stringify({ input, existing: existing ?? null, expires })).digest("hex");
  }

  preview(input: ImportInput) {
    const { skill, existing } = this.resolve(input);
    const expires = Date.now() + 10 * 60_000;
    return {
      skill,
      existing: existing ? {
        id: existing.id, name: existing.name, version: existing.version,
        enabled: existing.enabled, permissions: existing.permissions,
      } : null,
      added_permissions: skill.permissions.filter(value => !existing?.permissions.includes(value)),
      approval_token: `${expires}.${this.signature(input, existing, expires)}`,
    };
  }

  install(input: ImportInput, approvalToken: string) {
    return this.store.transaction(() => {
      const { skill, existing } = this.resolve(input);
      const [expiry, signature] = approvalToken.split(".");
      const expires = Number(expiry);
      if (!Number.isSafeInteger(expires) || expires <= Date.now() || !/^[a-f0-9]{64}$/.test(signature ?? "") ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(this.signature(input, existing, expires))))
        throw new HttpError(409, "安装预览已失效或 Skill 已改变，请重新选择文件并确认");
      const installed = existing
        ? this.store.update<Template>("rewrite_templates", existing.id, { ...skill, enabled: existing.enabled })!
        : this.store.insert<Template>("rewrite_templates", {
            ...skill, id: id(), style_key: null, is_builtin: false, created_at: now(), updated_at: now(),
          });
      persistSkillPackage(this.store, installed);
      return { action: existing ? "updated" : "installed", skill: installed };
    });
  }
}
