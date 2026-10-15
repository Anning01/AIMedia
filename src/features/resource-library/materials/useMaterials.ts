import { message } from "@/components/shared/controls";
import type { MaterialGroup, MaterialItem } from "@/data/localStore";
import {
  listMaterialGroups,
  removeMaterialGroup,
  saveMaterialGroups,
  uid,
  updateMaterial,
  upsertMaterialGroup,
} from "@/data/localStore";
import { fetchArticles } from "@/utils/resourceApi";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AI_SYSTEM,
  DEFAULT_AI_USER,
  DEFAULT_OUTLINE_FRAMEWORK,
  DEFAULT_POSITION,
  callWithRetry,
  loadPrompt,
  parseMaterialJsonArray,
  parseTxt,
  repairJsonStringNewlines,
  savePrompt,
  withTimeout,
} from "./model";
export function useMaterials() {
  const messageApi = message;
  const [groups, setGroups] = useState<MaterialGroup[]>(() =>
    listMaterialGroups(),
  );
  const [activeId, setActiveId] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importSep, setImportSep] = useState<"---" | "【标题】">("---");
  const [importName, setImportName] = useState("");
  const importPreview = useMemo(
    () => parseTxt(importText, importSep),
    [importText, importSep],
  );

  const [aiOpen, setAiOpen] = useState(false);
  const [aiName, setAiName] = useState("");
  const [aiPosition, setAiPosition] = useState("");
  const [aiCount, setAiCount] = useState(30);
  const [aiTarget, setAiTarget] = useState("new");
  const [aiLoading, setAiLoading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptSystem, setPromptSystem] = useState(DEFAULT_AI_SYSTEM);
  const [promptUser, setPromptUser] = useState(DEFAULT_AI_USER);
  const [editTarget, setEditTarget] = useState<{
    groupId: string;
    material: MaterialItem;
  } | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    const iv = window.setInterval(() => setGroups(listMaterialGroups()), 3000);
    return () => window.clearInterval(iv);
  }, []);

  const refresh = () => setGroups(listMaterialGroups());
  const active = groups.find((g) => g.id === activeId) || groups[0];

  const saveGroup = (g: MaterialGroup) => {
    upsertMaterialGroup(g);
    refresh();
    setActiveId(g.id);
  };

  const confirmImport = () => {
    if (!importPreview.length) {
      messageApi.warning("没有解析到素材，请检查分隔格式");
      return;
    }
    const g: MaterialGroup = {
      id: uid("mg"),
      name:
        importName.trim() ||
        `导入素材 · ${new Date().toLocaleDateString("zh-CN")}`,
      source: "txt",
      materials: importPreview.map((p) => ({
        id: uid("mat"),
        title: p.title,
        content: p.content,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
    };
    saveGroup(g);
    setImportOpen(false);
    setImportText("");
    setImportName("");
    messageApi.success(`已导入 ${g.materials.length} 篇素材`);
  };

  const pickFile = async () => {
    if (!window.wangaohui?.selectTextFile) {
      messageApi.error("请通过桌面应用运行后使用文件导入");
      return;
    }
    const r = await window.wangaohui.selectTextFile();
    if (r.ok && r.content) {
      setImportText(r.content);
      setImportFileName(r.name || "");
    } else if (!r.canceled) {
      messageApi.error(r.error || "读取文件失败");
    }
  };

  const generateAi = async () => {
    if (!window.wangaohui) {
      messageApi.error("请通过桌面应用运行后使用 AI 生成");
      return;
    }
    const targetGroup =
      aiTarget !== "new" ? groups.find((g) => g.id === aiTarget) : undefined;
    const position = aiPosition.trim() || DEFAULT_POSITION;
    const history = targetGroup
      ? targetGroup.materials
          .slice(-30)
          .map((m) => `- ${m.title}\n${m.content.slice(0, 200)}`)
          .join("\n")
      : "（暂无）";
    const cfg = loadPrompt();
    setAiLoading(true);
    try {
      // 自动拉取真实热点/微信爆文作为参考，避免素材凭空编造、过不了 AI 率
      let realRefText = "";
      try {
        const [hotRes, wechatRes] = await Promise.allSettled([
          withTimeout(
            fetchArticles({ source_type: "newsnow", page_size: 5 }),
            6000,
          ),
          withTimeout(
            fetchArticles({ platform: "微信24小时热榜", page_size: 5 }),
            6000,
          ),
        ]);
        const refs: string[] = [];
        for (const r of [hotRes, wechatRes]) {
          if (r.status !== "fulfilled") continue;
          const list = (r.value.data || []).slice(0, 5);
          for (const a of list) {
            if (!a.title) continue;
            const body = String(a.content_text || a.summary || "")
              .replace(/\s+/g, " ")
              .slice(0, 500);
            refs.push(`标题：${a.title}\n内容：${body}`);
          }
        }
        realRefText = refs.join("\n\n").slice(0, 6000);
      } catch {
        /* 拉取失败不阻塞生成 */
      }

      let user = cfg.user
        .replace(/\{position\}/g, position)
        .replace(/\{count\}/g, String(aiCount))
        .replace(/\{history\}/g, history);
      if (realRefText) {
        user += `\n\n【真实素材参考（facts 和 story 必须来自以下内容或基于其改写，禁止编造）】\n${realRefText}`;
      } else {
        user +=
          "\n\n（本次未获取到真实素材参考：可以生成选题大纲，但 facts/story 只能作为示例，不能当作真实信息。）";
      }
      // 无论自定义提示词是什么，都强制注入爆款大纲框架（只按结构，不照抄内容）
      user += `\n\n【大纲结构模板（只按此结构组织 outline，禁止照抄模板里的具体内容）】\n${DEFAULT_OUTLINE_FRAMEWORK}\n请严格按照模板中的六段结构生成每个素材的 outline：一段对应“开篇痛点切入”、二段对应“矛盾层层拆解”、三段对应“核心观点”、四段对应“分段落地”、五段对应“结尾升华”、六段对应“标题模板”；每一段的内容必须结合账号定位重新写，禁止照搬模板中的例子、金句和标题。`;
      const r = await callWithRetry(async () => {
        const api = window.wangaohui;
        if (!api) throw new Error("请通过桌面应用运行后使用 AI 生成");
        return api.llmChat({
          provider: "deepseek",
          temperature: 0.7,
          system: cfg.system,
          user,
        });
      });
      if (!r.ok || !r.reply) throw new Error(r.error || "AI 生成失败");
      const raw = r.reply.trim();
      let arr = parseMaterialJsonArray(raw) || [];
      if (!arr.length) {
        // 整个数组解析失败时，按对象逐条解析
        const objs = raw.match(/\{[^{}]*\}/g) || [];
        const list: Array<{
          title?: string;
          outline?: string;
          facts?: string;
          story?: string;
        }> = [];
        for (const o of objs) {
          const repaired = repairJsonStringNewlines(o).replace(
            /,\s*([}\]])/g,
            "$1",
          );
          const one = parseMaterialJsonArray(`[${repaired}]`);
          if (one && one[0]) list.push(one[0]);
        }
        arr = list;
      }
      if (!arr.length) {
        throw new Error(
          "AI 返回内容无法解析为素材列表，请重试或调整素材生成提示词",
        );
      }
      const materials: MaterialItem[] = arr
        .filter((x) => x.title && x.outline)
        .slice(0, Math.max(1, aiCount))
        .map((x) => {
          const parts: string[] = [];
          if (String(x.facts || "").trim())
            parts.push(`【核心事实】\n${String(x.facts).trim()}`);
          if (String(x.story || "").trim())
            parts.push(`【场景案例】\n${String(x.story).trim()}`);
          parts.push(`【大纲】\n${String(x.outline).trim()}`);
          return {
            id: uid("mat"),
            title: String(x.title).trim(),
            content: parts.join("\n\n"),
            isOutline: true,
            status: "pending" as const,
            createdAt: new Date().toISOString(),
          };
        });
      if (!materials.length) throw new Error("未能解析 AI 返回的大纲");
      if (targetGroup) {
        saveGroup({
          ...targetGroup,
          accountNote: position,
          materials: [...targetGroup.materials, ...materials],
        });
        messageApi.success(
          `已追加 ${materials.length} 篇大纲到「${targetGroup.name}」`,
        );
      } else {
        saveGroup({
          id: uid("mg"),
          name:
            aiName.trim() || `${position.slice(0, 12)} · ${materials.length}篇`,
          source: "ai",
          accountNote: position,
          materials,
          createdAt: new Date().toISOString(),
        });
        messageApi.success(`已生成 ${materials.length} 篇大纲素材`);
      }
      setAiOpen(false);
      setAiName("");
      setAiPosition("");
    } catch (err) {
      messageApi.error(
        `AI 生成失败：${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setAiLoading(false);
    }
  };

  const resetMaterial = (groupId: string, m: MaterialItem) => {
    updateMaterial(groupId, m.id, { status: "pending", usedAt: undefined });
    refresh();
    messageApi.success(`「${m.title}」已重置为未使用`);
  };

  const openEdit = (groupId: string, m: MaterialItem) => {
    setEditTarget({ groupId, material: m });
    setEditTitle(m.title);
    setEditContent(m.content);
  };

  const saveEdit = () => {
    if (!editTarget) return;
    if (!editTitle.trim()) {
      messageApi.warning("标题不能为空");
      return;
    }
    updateMaterial(editTarget.groupId, editTarget.material.id, {
      title: editTitle.trim(),
      content: editContent.trim(),
    });
    setEditTarget(null);
    refresh();
    messageApi.success("素材已更新");
  };

  const openPromptCfg = () => {
    const cfg = loadPrompt();
    setPromptSystem(cfg.system);
    setPromptUser(cfg.user);
    setPromptOpen(true);
  };

  const deleteGroup = (id: string) => {
    removeMaterialGroup(id);
    setActiveId("");
    refresh();
  };
  const deleteMaterial = (groupId: string, id: string) => {
    saveMaterialGroups(
      listMaterialGroups().map((group) =>
        group.id === groupId
          ? {
              ...group,
              materials: group.materials.filter((item) => item.id !== id),
            }
          : group,
      ),
    );
    refresh();
  };
  const resetPromptCfg = () => {
    setPromptSystem(DEFAULT_AI_SYSTEM);
    setPromptUser(DEFAULT_AI_USER);
  };
  const savePromptCfg = () => {
    savePrompt({ system: promptSystem.trim(), user: promptUser.trim() });
    setPromptOpen(false);
    messageApi.success("AI 提示词已保存");
  };
  return {
    resetPromptCfg,
    savePromptCfg,
    deleteGroup,
    deleteMaterial,
    setImportOpen,
    setAiOpen,
    openPromptCfg,
    groups,
    setActiveId,
    active,
    refresh,
    resetMaterial,
    openEdit,
    importOpen,
    confirmImport,
    importPreview,
    importSep,
    setImportSep,
    importName,
    setImportName,
    pickFile,
    importFileName,
    importText,
    setImportText,
    aiOpen,
    generateAi,
    aiLoading,
    aiTarget,
    setAiTarget,
    aiName,
    setAiName,
    aiCount,
    setAiCount,
    aiPosition,
    setAiPosition,
    promptOpen,
    setPromptOpen,
    setPromptSystem,
    setPromptUser,
    promptSystem,
    promptUser,
    messageApi,
    editTarget,
    setEditTarget,
    saveEdit,
    editTitle,
    setEditTitle,
    editContent,
    setEditContent,
  };
}
