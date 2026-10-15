export const PROMPT_KEY = "wangaohui:materialAiPromptV2";

export const LEGACY_DEFAULT_AI_SYSTEM =
  '你是资深公众号内容策划。根据账号定位生成指定数量的内容大纲。只输出 JSON 数组，每个元素格式为 {"title":"标题","outline":"大纲内容"}，不要输出任何其他说明。';

export const DEFAULT_OUTLINE_FRAMEWORK = `女性成长类文章通用爆款大纲（可直接套用）
一、开篇：痛点切入（3秒抓人、引发共鸣）
核心逻辑：不鸡汤、先戳真实困境，用日常场景带入，让女生一眼代入自己。
可选切入角度：
- 情绪痛点：习惯性内耗、讨好型人格、不敢拒绝、过度共情
- 成长痛点：习惯性自我否定、总觉得自己不够好、不敢争取
- 生活痛点：被家庭、感情、外界声音捆绑，活得小心翼翼
- 认知痛点：习惯性迁就别人、优先别人、最后委屈自己
开篇金句模板：真正困住女人的，从来不是年龄，而是不肯放过自己的执念。
二、矛盾展开：大部分女生的通病（层层拆解问题）
核心逻辑：把“情绪问题”转化为“认知问题”，告诉读者：你不是矫情，是成长模式错了。
三层递进拆解：
- 第一层：习惯性懂事 —— 从小被教育要温柔、要体谅、要顾全大局，慢慢弄丢自我
- 第二层：过度共情内耗 —— 别人一句话反复琢磨，小事反复纠结，消耗自己所有精力
- 第三层：不敢优先自己 —— 习惯付出、习惯让步、习惯妥协，以为善良是成全别人，实则透支自己
三、核心观点：女性真正的成长，到底是什么？（文章升华核心）
避开烂大街鸡汤，主打清醒、落地、独立，三个核心立意任选其一或组合：
- 成长不是变得强势，而是变得清醒有边界
- 成长不是取悦所有人，而是允许自己不被喜欢
- 成长不是拼命内卷，而是稳住内核、自洽从容
- 女人最好的成长：停止内耗、收回期待、专注自己
四、分段落地：普通人可执行的成长方法（干货部分）
不空谈大道理，全部是女生能立刻做到的小事，增强收藏价值。
四大落地维度：
- 情绪成长：戒掉内耗
  - 不反复回想别人的话
  - 不预判未发生的烦恼
  - 允许一切发生，接纳不完美
- 认知成长：建立边界
  - 学会拒绝，不用不好意思
  - 收回对他人的高期待
  - 你的善良，必须带点锋芒
- 生活成长：专注自我
  - 把讨好别人的时间用来滋养自己
  - 读书、运动、搞钱、独处
  - 慢慢戒掉情绪依赖、人际依赖
- 心态成长：与自己和解
  - 接受自己普通，但不敷衍生活
  - 原谅过去的敏感、懦弱、笨拙
  - 慢慢来，稳一点，比快更重要
五、结尾升华+治愈收尾（适合转发、收藏）
核心基调：温柔且有力量，不焦虑、不鸡汤。
收尾逻辑：
女人的一生，不是为了迎合世界，而是为了活出自己。不必急着成熟，不必强迫完美。慢慢清空内耗，慢慢建立内核，慢慢变得笃定、从容、独立。
最好的成长，是终身自愈，终身向阳。
六、适配爆款标题模板（直接用）
- 真正厉害的女人，从戒掉“内耗”开始
- 女生越早通透越好：成长，是一场自我治愈
- 停止讨好、停止纠结、停止内耗，你会活得很高级
- 女人最高级的活法：内核稳定，温柔有锋芒`;

export const DEFAULT_AI_SYSTEM =
  "你是资深公众号内容策划。根据账号定位生成指定数量的高信息密度素材包，每个素材必须能直接支撑一篇有细节、有真实感的公众号文章。" +
  "只输出 JSON 数组，每个元素格式为：" +
  '{"title":"标题","facts":"3-5条具体事实、数字或细节（真实可信、可直接引用，禁止空话）","story":"1个具体场景或案例（有人物、动作、对话，能用作文章开头或段落）","outline":"严格按爆款大纲框架生成的结构化大纲"}。' +
  "outline 必须严格遵循输入中【大纲必须严格遵循的爆款框架】的六段结构、层次、落地维度和收尾逻辑，内容按账号定位填充具体场景与细节，禁止只写标题或空话。" +
  "如果输入中提供了【真实素材参考】，facts 和 story 必须来自参考内容或基于参考改写，不得编造事实、数字和人物；参考内容与账号定位无关时，选择最接近的题材。" +
  "不要输出任何其他说明。";

export const DEFAULT_POSITION =
  "公众号/小红书工具推广账号，推广“万稿汇”——AI 内容创作与多平台发布工具，主要功能包括热点与爆文素材库、AI 写文章/贴图与模板排版、自动配图、多平台账号管理与发布、自动托管。内容要求：不要太营销、不要硬广告，符合平台规则，先建立用户信任，再慢慢吸引用户来咨询。";

export const DEFAULT_AI_USER = `账号定位：{position}
数量：{count} 篇
该账号已经生成过以下大纲，请保持人设和风格连续，避免重复或高度相似：
{history}
要求：
1. 标题有吸引力；
2. facts 必须是具体的事实、数字、细节，禁止“很多人、大多数、越来越”这类没有信息量的空话；
3. story 必须是一个可感知的场景：有具体人物、动作、对话或环境，能直接写进文章；
4. outline 必须按六段式爆款结构组织：开篇痛点切入（具体场景+金句）→ 矛盾层层拆解（三层递进）→ 核心观点（清醒落地）→ 分段落地（可执行小事）→ 结尾升华（温柔有力）→ 标题模板（3-5个）；
5. outline 每一段都要写清楚“写什么”，不能只写标题；整体要像真人策划写出的爆款大纲，而不是 AI 模板；
6. 素材后续既要能展开成文章，也要能改写成贴图内容。`;

export interface AiPromptCfg {
  system: string;
  user: string;
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]);
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  times = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < times; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (err && typeof err === "object" && "retryable" in err && err.retryable === false) throw err;
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

export function repairJsonStringNewlines(s: string): string {
  return s.replace(/"((?:[^"\\]|\\.)*)"/g, (m, inner: string) =>
    /[\r\n]/.test(inner)
      ? '"' + inner.replace(/\r\n/g, "\\n").replace(/[\r\n]/g, "\\n") + '"'
      : m,
  );
}

export function parseMaterialJsonArray(raw: string): Array<{
  title?: string;
  outline?: string;
  facts?: string;
  story?: string;
}> | null {
  const s = String(raw || "")
    .replace(/```(?:json)?/gi, "")
    .trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  const json = s.slice(start, end + 1);
  const candidates = [
    json,
    json.replace(/,\s*([}\]])/g, "$1"),
    repairJsonStringNewlines(json),
    repairJsonStringNewlines(json).replace(/,\s*([}\]])/g, "$1"),
  ];
  for (const c of candidates) {
    try {
      const arr = JSON.parse(c);
      if (Array.isArray(arr)) {
        return arr as Array<{
          title?: string;
          outline?: string;
          facts?: string;
          story?: string;
        }>;
      }
    } catch {
      /* 尝试下一种修复 */
    }
  }
  return null;
}

export function loadPrompt(): AiPromptCfg {
  try {
    const raw = JSON.parse(
      localStorage.getItem(PROMPT_KEY) || "{}",
    ) as Partial<AiPromptCfg>;
    if ((raw.system || "") === LEGACY_DEFAULT_AI_SYSTEM) {
      const next = { system: DEFAULT_AI_SYSTEM, user: DEFAULT_AI_USER };
      savePrompt(next);
      return next;
    }
    return {
      system: raw.system || DEFAULT_AI_SYSTEM,
      user: raw.user || DEFAULT_AI_USER,
    };
  } catch {
    return { system: DEFAULT_AI_SYSTEM, user: DEFAULT_AI_USER };
  }
}

export function savePrompt(cfg: AiPromptCfg): void {
  localStorage.setItem(PROMPT_KEY, JSON.stringify(cfg));
}

export function parseTxt(
  text: string,
  sep: "---" | "【标题】",
): Array<{ title: string; content: string }> {
  const norm = text.replace(/\r\n/g, "\n").trim();
  if (!norm) return [];
  if (sep === "---") {
    return norm
      .split(/\n\s*---+\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => {
        const lines = p.split("\n");
        const title =
          (lines[0] || "").replace(/^#+\s*/, "").trim() || "未命名素材";
        const content = lines.slice(1).join("\n").trim();
        return { title, content };
      });
  }
  return norm
    .split(/(?=【[^】]+】)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^【([^】]+)】/);
      const title = m ? m[1].trim() : "未命名素材";
      const content = m ? p.slice(m[0].length).trim() : p;
      return { title, content };
    });
}
