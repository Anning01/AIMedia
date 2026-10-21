import { saveToDraftOnly } from "@/utils/publishPolicy";
import { message, Modal, Tag } from "@/components/shared/controls";
import { Form } from "@/components/shared/task-form";
import type { TemplateDesign } from "@/data/articleTemplates";
import { ARTICLE_TEMPLATES } from "@/data/articleTemplates";
import type { HostTaskItem } from "@/data/localStore";
import {
  addConsumed,
  addUsage,
  listAccounts,
  listConsumed,
  listHostTasks,
  listMaterialGroups,
  saveHostTasks,
  saveQueueItem,
  saveWechatSession,
  uid,
  updateConsumed,
  updateMaterial,
} from "@/data/localStore";
import { getPromptSet, isDefaultPromptSet } from "@/data/promptSets";
import type { StickerCoverTemplate } from "@/data/stickerTemplates";
import { allCoverTemplates } from "@/data/stickerTemplates";
import { buildInlineHtml } from "@/utils/articleHtml";
import { renderCoverNodeToPng } from "@/utils/renderCoverNode";
import { fetchArticles, fetchCategories } from "@/utils/resourceApi";
import {
  cleanOutlineForArticle,
  looksLikePrompt,
  sanitizeSourceText,
} from "@/utils/sourceClean";
import { useEffect, useMemo, useRef, useState } from "react";
import { TaskRowActions } from "./TaskRowActions";
import { TaskStatusBadge } from "./TaskStatusBadge";
import {
  buildStickerCards,
  escapeHtml,
  firstRunAt,
  insertImages,
  nextDayAt,
  nextPaint,
  nowTime,
  parseTopicAnchors,
  pickImages,
  sleep,
  WECHAT_PLATFORM,
  withRetry,
} from "./model";
import { isTaskEnabled } from "./task-state";

export function useTaskCenter({ active = true }: { active?: boolean }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [tasks, setTasks] = useState<HostTaskItem[]>(() => listHostTasks());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HostTaskItem | null>(null);
  const [logTask, setLogTask] = useState<HostTaskItem | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const runningRef = useRef(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTplId, setPreviewTplId] = useState("");
  const [previewAccent, setPreviewAccent] = useState("#2F54EB");
  const [cardList, setCardList] = useState<
    Array<{ heading: string; text: string }>
  >([]);
  const [renderTplId, setRenderTplId] = useState("");
  const [renderCoverTitle, setRenderCoverTitle] = useState("");
  const [tick, setTick] = useState(0);
  const coverRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const accounts = useMemo(listAccounts, [tasks, tick]);

  // 页面常驻挂载（display:none），切回自动托管时重新读取账号，避免下拉框为空
  useEffect(() => {
    if (active) setTick((x) => x + 1);
  }, [active]);

  useEffect(() => {
    saveHostTasks(tasks);
  }, [tasks]);

  // 所有任务修改都基于 localStorage 最新数据做读-改-写，
  // 避免旧内存快照覆盖新状态（编辑后不持久化/日志乱序）。
  const persistTasks = (next: HostTaskItem[]) => {
    saveHostTasks(next);
    setTasks(next);
  };

  useEffect(() => {
    fetchCategories()
      .then((r) =>
        setCategories(
          (r.data || [])
            .map((c) => c.category)
            .filter((c) => c && c !== "待分类"),
        ),
      )
      .catch(() => undefined);
  }, []);

  const patchTask = (id: string, patch: Partial<HostTaskItem>) => {
    persistTasks(
      listHostTasks().map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const pushLog = (t: HostTaskItem, text: string): HostTaskItem => ({
    ...t,
    log: [...t.log, `[${nowTime()}] ${text}`],
  });

  const toggleTask = (task: HostTaskItem) => {
    const current = listHostTasks().find((item) => item.id === task.id);
    if (!current) return;
    if (current.status === "执行中" || runningId === current.id) {
      messageApi.warning("任务正在执行，请稍候");
      return;
    }
    const enabled = !isTaskEnabled(current);
    persistTasks(
      listHostTasks().map((item) =>
        item.id === current.id
          ? {
              ...item,
              enabled,
              status: enabled ? "运行中" : "已暂停",
              log: [
                ...item.log,
                `[${nowTime()}] ${enabled ? "任务已恢复" : "任务已暂停"}`,
              ],
            }
          : item,
      ),
    );
  };

  const removeTask = (t: HostTaskItem) => {
    persistTasks(listHostTasks().filter((x) => x.id !== t.id));
  };

  const saveTask = (values: Record<string, unknown>) => {
    try {
      const platform = String(values.platform || "");
      const account = accounts.find(
        (a) => a.id === values.accountId && a.platform === platform,
      );
      if (!account) {
        messageApi.warning("请选择账号");
        return;
      }
      const wechatUsername =
        platform === "公众号" ? String(values.wechatUsername || "") : "";
      if (platform === "公众号" && !wechatUsername) {
        messageApi.warning("公众号任务请选择具体的公众号");
        return;
      }
      const contentType =
        values.contentType === "sticker" ? "sticker" : "article";
      if (
        contentType === "sticker" &&
        platform !== "公众号" &&
        platform !== "小红书"
      ) {
        messageApi.warning("贴图任务仅支持公众号/小红书");
        return;
      }
      const frequency = values.frequency === "once" ? "once" : "daily";
      const name =
        (values.name as string) ||
        `${account.name} · ${contentType === "sticker" ? "贴图" : "文章"}`;
      const nextRunAt = firstRunAt(String(values.startTime || "09:00"));
      if (editingTask) {
        // 用最新存储的任务做基底，避免编辑弹窗打开期间任务执行过而丢失状态
        const current =
          listHostTasks().find((x) => x.id === editingTask.id) || editingTask;
        const next: HostTaskItem = {
          ...current,
          name,
          accountId: account.id,
          platform,
          wechatUsername: wechatUsername || undefined,
          contentType,
          promptSetId: String(values.promptSetId || ""),
          sourceType: values.sourceType as HostTaskItem["sourceType"],
          sourceKey: String(values.sourceKey || ""),
          templateId: String(values.templateId || ""),
          accent: (values.accent as string) || undefined,
          imageSource: values.imageSource === "library" ? "library" : "auto",
          imageCount: Number(values.imageCount) || 1,
          perRunCount: Number(values.perRunCount) || 1,
          frequency,
          startTime: String(values.startTime || "09:00"),
          intervalMinutes:
            frequency === "daily" ? Number(values.intervalMinutes) || 1440 : 0,
          publishMode: platform === "公众号" ? "draft" : values.publishMode === "publish" ? "publish" : "draft",
          retry: values.retry !== false,
          nextRunAt,
          log: [
            ...current.log,
            `[${nowTime()}] 任务已编辑，下次执行 ${nextRunAt}`,
          ],
        };
        persistTasks(
          listHostTasks().map((t) => (t.id === editingTask.id ? next : t)),
        );
        console.log("[TaskCenter] 任务已保存", {
          id: editingTask.id,
          name,
          perRunCount: next.perRunCount,
        });
        messageApi.success(`任务「${name}」已保存`);
      } else {
        const t: HostTaskItem = {
          id: uid("task"),
          name,
          accountId: account.id,
          platform,
          wechatUsername: wechatUsername || undefined,
          contentType,
          promptSetId: String(values.promptSetId || ""),
          sourceType: values.sourceType as HostTaskItem["sourceType"],
          sourceKey: String(values.sourceKey || ""),
          templateId: String(values.templateId || ""),
          accent: (values.accent as string) || undefined,
          imageSource: values.imageSource === "library" ? "library" : "auto",
          imageCount: Number(values.imageCount) || 1,
          perRunCount: Number(values.perRunCount) || 1,
          frequency,
          startTime: String(values.startTime || "09:00"),
          intervalMinutes:
            frequency === "daily" ? Number(values.intervalMinutes) || 1440 : 0,
          publishMode: platform === "公众号" ? "draft" : values.publishMode === "publish" ? "publish" : "draft",
          retry: values.retry !== false,
          enabled: true,
          status: "运行中",
          nextRunAt,
          log: [`[${nowTime()}] 任务已创建，下次执行 ${nextRunAt}`],
          createdAt: new Date().toISOString(),
        };
        persistTasks([t, ...listHostTasks()]);
        messageApi.success(`任务「${name}」已创建`);
      }
      setCreateOpen(false);
      setEditingTask(null);
      form.resetFields();
    } catch (err) {
      console.error("[TaskCenter] 保存任务失败", err);
      messageApi.error(
        `保存任务失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const openEdit = (t: HostTaskItem) => {
    setEditingTask(t);
    form.setFieldsValue({
      name: t.name,
      platform: t.platform,
      accountId: t.accountId,
      wechatUsername: t.wechatUsername || "",
      contentType: t.contentType,
      promptSetId: t.promptSetId || "",
      sourceType: t.sourceType,
      sourceKey: t.sourceKey,
      templateId: t.templateId,
      accent: t.accent,
      imageSource: t.imageSource,
      imageCount: t.imageCount,
      perRunCount: t.perRunCount,
      frequency: t.frequency,
      startTime: t.startTime,
      intervalMinutes: t.intervalMinutes || 1440,
      publishMode: saveToDraftOnly(t.platform, t.publishMode) ? "draft" : "publish",
      retry: t.retry,
    });
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setEditingTask(null);
    form.resetFields();
  };

  const pickItems = async (
    t: HostTaskItem,
    count: number,
  ): Promise<
    Array<{
      key: string;
      title: string;
      content: string;
      isOutline: boolean;
      groupId?: string;
      materialId?: string;
    }>
  > => {
    if (t.sourceType === "material") {
      const group = listMaterialGroups().find((g) => g.id === t.sourceKey);
      if (!group) return [];
      return group.materials
        .filter((m) => m.status === "pending")
        .slice(0, count)
        .map((m) => ({
          key: m.id,
          title: m.title,
          content: m.content,
          isOutline: !!m.isOutline,
          groupId: group.id,
          materialId: m.id,
        }));
    }
    try {
      const r = await fetchArticles({
        source_type: t.sourceType === "hot" ? "newsnow" : undefined,
        platform: t.sourceType === "wechat" ? WECHAT_PLATFORM : undefined,
        classified: true,
        category: t.sourceKey || undefined,
        page: 1,
        page_size: 50,
      });
      const done = new Set(
        listConsumed()
          .filter(
            (c) =>
              c.taskId === t.id &&
              c.sourceType === t.sourceType &&
              c.status === "done",
          )
          .map((c) => c.itemKey),
      );
      return (r.data || [])
        .filter((a) => !done.has(String(a.id)))
        .slice(0, count)
        .map((a) => ({
          key: String(a.id),
          title: a.title,
          content: a.content_text || a.summary || "",
          isOutline: true,
        }));
    } catch {
      return [];
    }
  };

  const publish = async (
    t: HostTaskItem,
    payload: {
      title: string;
      content: string;
      images?: string[];
      coverImageUrl?: string;
      postType?: "article" | "sticker";
    },
  ) => {
    const account = listAccounts().find((a) => a.id === t.accountId);
    if (!account || !account.authed)
      return { ok: false, error: "账号不存在或未认证" };
    let cookie = account.cookie;
    let token = account.token;
    let wechatUsername = "";
    if (t.platform === "公众号") {
      wechatUsername = t.wechatUsername || "";
      const target = (account.wechatAccounts || []).find((w) => w.username === wechatUsername);
      if (!target || target.kind === "wxa" || target.enabled === false)
        return { ok: false, error: "目标公众号不存在或已停用，请重新配置托管任务" };
    }
    const r = await window.wangaohui?.platformPublish({
      platform:
        t.platform === "公众号"
          ? "wechat"
          : t.platform === "头条号"
            ? "toutiao"
            : t.platform === "小红书"
              ? "xiaohongshu"
              : "baijiahao",
      cookie,
      token,
      fingerprint: account.fingerprint,
      title: payload.title,
      content: payload.content,
      postType: payload.postType,
      images: payload.images || [],
      coverImageUrl: payload.coverImageUrl,
      saveDraftOnly: saveToDraftOnly(t.platform, t.publishMode),
      wechatUsername: wechatUsername || undefined,
      wechatAccounts: account.wechatAccounts,
      currentUsername: account.currentUsername,
      claimExclusive: account.claimExclusive,
      contentDeclaration: account.contentDeclaration,
      bjhTtv: account.bjhTtv,
      bjhAiTts: account.bjhAiTts,
      bjhAigc: account.bjhAigc,
      xhsOriginal: account.xhsOriginal,
      xhsContentDeclaration: account.xhsContentDeclaration,
    });
    if (r && r.ok) {
      if (t.platform === "公众号" && r.cookies) {
        const latest = listAccounts().find((a) => a.id === account.id);
        if (latest) saveWechatSession(latest, wechatUsername, r.token, r.cookies, r.currentUsername || wechatUsername);
      }
      return { ok: true as const, cookies: r.cookies, token: r.token };
    }
    return { ok: false as const, error: r?.error || "发布失败" };
  };

  const generateArticleHtml = async (t: HostTaskItem, sourceText: string) => {
    sourceText = sanitizeSourceText(sourceText);
    if (looksLikePrompt(sourceText)) {
      throw new Error(
        "素材内容看起来像提示词/指令，已跳过（请把提示词放到「提示词管理」，素材框只放文章素材）",
      );
    }
    const set = getPromptSet(t.promptSetId);
    const writingReference=isDefaultPromptSet(set)?'':`${set.outlineSystem}\n${set.outlineUser.replace(/\{topic\}/g,'原始素材见下文').replace(/\{style\}/g,'').replace(/\{words\}/g,'800 字').replace(/\{templateNote\}/g,'').replace(/\{tagNote\}/g,'')}`;
    const result = await withRetry(async () => {
      const r = await window.wangaohui?.generateArticle({
        sourceText,
        writingReference,
        words:800,
        audience: "公众号读者",
        category: "",
      });
      if (!r?.ok || !r.chinese) throw Object.assign(new Error(r?.error || "文章生成失败"),{retryable:r?.retryable});
      return r;
    });
    if (!result || !result.chinese) throw new Error("文章生成失败");
    let blocks: Array<{
      id: string;
      type: string;
      text?: string;
      items?: string[];
      src?: string;
    }> = [];
    if (Array.isArray(result.blocks) && result.blocks.length) {
      blocks = result.blocks.map((b) => ({
        id: uid("b"),
        type: b.type || "p",
        text: b.text,
        items: b.items,
        src: b.src,
      }));
    } else {
      const lines = result.chinese
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      blocks = lines.map((l, i) => ({
        id: uid("b"),
        type: i === 0 ? "title" : "p",
        text: l,
      }));
    }
    const title =
      blocks.find((b) => b.type === "title")?.text?.trim() || "未命名";
    const images = await pickImages(
      t.imageSource,
      t.imageCount,
      `${title}\n${result.chinese}`,
    );
    insertImages(blocks, images);
    const tpl =
      ARTICLE_TEMPLATES.find((x) => x.id === t.templateId) ||
      ARTICLE_TEMPLATES[0];
    const html = buildInlineHtml(
      blocks.filter((b) => b.type !== "title") as never[],
      tpl,
      t.accent || tpl.accent,
    );
    return {
      title,
      html,
      coverImageUrl: images[0] || blocks.find((b) => b.type === "image")?.src,
    };
  };

  const generateStickerImages = async (t: HostTaskItem, sourceText: string) => {
    sourceText = sanitizeSourceText(sourceText);
    if (looksLikePrompt(sourceText)) {
      throw new Error(
        "素材内容看起来像提示词/指令，已跳过（请把提示词放到「提示词管理」，素材框只放文章素材）",
      );
    }
    const set = getPromptSet(t.promptSetId);
    setRenderTplId(t.templateId);
    const r = await withRetry(async () => {
      const rr = await window.wangaohui?.llmChat({
        provider: "deepseek",
        temperature: 0.7,
        system: set.stickerSystem,
        user: set.stickerUser
          .replace(/\{topic\}/g, sourceText)
          .replace(/\{words\}/g, "400 字以内"),
      });
      if (!rr || !rr.ok || !rr.reply)
        throw Object.assign(new Error(rr?.error || "贴图生成失败"),{retryable:rr?.retryable});
      return rr;
    });
    if (!r || !r.reply) throw new Error("贴图生成失败");
    const lines = r.reply
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const title = lines[0] || "贴图";
    const pubDescIdx = lines.findIndex(
      (l, i) => i > 0 && /^发布描述[：:]/.test(l),
    );
    const topicIdx = lines.findIndex((l, i) => i > 0 && /^#/.test(l));
    const topics =
      topicIdx >= 0
        ? lines
            .slice(topicIdx)
            .filter((l) => /^#/.test(l))
            .slice(0, 5)
            .join(" ")
        : "";
    const bodyEnd =
      pubDescIdx >= 0 ? pubDescIdx : topicIdx >= 0 ? topicIdx : lines.length;
    const body = lines.slice(1, bodyEnd).join("\n");
    const publishDesc =
      pubDescIdx >= 0
        ? lines
            .slice(pubDescIdx)
            .filter((l) => !/^#/.test(l))
            .map((l) => l.replace(/^发布描述[：:]\s*/, ""))
            .join("")
            .trim()
        : "";
    const cards = buildStickerCards(
      body
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
    setRenderCoverTitle(title);
    setCardList(cards);
    await nextPaint();
    await sleep(200);
    const renderImages = async (): Promise<string[]> => {
      const imgs: string[] = [];
      if (coverRef.current)
        imgs.push(await renderCoverNodeToPng(coverRef.current));
      for (let i = 0; i < cards.length; i += 1) {
        const n = cardRefs.current[i];
        if (n) imgs.push(await renderCoverNodeToPng(n));
      }
      return imgs;
    };
    let imgs: string[] = [];
    try {
      imgs = await renderImages();
    } catch (err) {
      // 应用刚启动/窗口未就绪时渲染可能为空，稍等后重试一次
      console.warn("贴图渲染未就绪，重试一次：", err);
      await sleep(1000);
      await nextPaint();
      imgs = await renderImages();
    }
    if (!imgs.length) throw new Error("贴图渲染失败：未生成任何图片");
    setCardList([]);
    setRenderCoverTitle("");
    setRenderTplId("");
    const topicHtml = parseTopicAnchors(topics);
    return {
      title,
      content: `<p>${escapeHtml(title)}</p>${publishDesc ? `<p></p><p>${escapeHtml(publishDesc)}</p>` : ""}${topicHtml ? `<p></p><p>${topicHtml}</p>` : ""}`,
      images: imgs,
    };
  };

  const executeTask = async (t: HostTaskItem, manual = false) => {
    // 全局串行执行：贴图渲染共用隐藏 DOM，多个任务并发会互相覆盖
    if (runningRef.current) {
      if (manual) messageApi.warning("已有任务正在执行，请稍候");
      return;
    }
    runningRef.current = true;
    setRunningId(t.id);
    const started = Date.now();
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // 用最新存储的任务做执行基底，避免旧快照把编辑后的配置/日志覆盖掉
    const fresh = listHostTasks().find((x) => x.id === t.id) || t;
    // 下次执行基准：手动执行从当前时间起算；定时执行取“上次计划时间/当前时间”较新者
    const nextBase = manual
      ? Date.now()
      : Math.max(
          fresh.nextRunAt ? new Date(fresh.nextRunAt).getTime() : Date.now(),
          Date.now(),
        );
    const nextInterval = () =>
      new Date(
        nextBase + Math.max(1, fresh.intervalMinutes || 60) * 60000,
      ).toISOString();
    const periodKey = fresh.frequency === "once" ? "once" : localDate;
    let doneCount = fresh.periodKey === periodKey ? fresh.doneCount || 0 : 0;
    const remaining = Math.max(0, fresh.perRunCount - doneCount);
    let current = pushLog(
      { ...fresh, status: "执行中" },
      `开始执行：${fresh.name}${fresh.frequency === "once" ? "" : `（今日已完成 ${doneCount}/${fresh.perRunCount}）`}`,
    );
    patchTask(t.id, current);
    try {
      if (remaining <= 0) {
        current = pushLog(
          current,
          t.frequency === "once" ? "任务已完成" : "今日目标已完成，明天再执行",
        );
        patchTask(t.id, {
          status: t.frequency === "once" ? "已完成" : "运行中",
          enabled: t.frequency === "once" ? false : true,
          periodKey,
          doneCount,
          nextRunAt:
            t.frequency === "once" ? t.nextRunAt : nextDayAt(t.startTime),
          log: current.log,
        });
        return;
      }
      // 每次执行只发布 1 篇：成功数未达每日目标时，按执行间隔继续跑，
      // 达到目标后当天跳过，次日再按开始时间恢复。
      const items = await pickItems(t, 1);
      if (!items.length) {
        current = pushLog(current, "素材池为空，本次跳过");
        patchTask(t.id, {
          status: t.frequency === "once" ? "已完成" : "运行中",
          enabled: t.frequency === "once" ? false : true,
          periodKey,
          doneCount,
          nextRunAt: t.frequency === "once" ? t.nextRunAt : nextInterval(),
          log: current.log,
        });
        return;
      }
      for (const rawItem of items) {
        const item = { ...rawItem };
        let consId = "";
        try {
          // 发布前先占位：素材标记“使用中”，热点/爆文先写入消费记录，
          // 避免执行中途重启后同一素材被再次选中重复发布。
          if (item.groupId && item.materialId) {
            updateMaterial(item.groupId, item.materialId, { status: "using" });
          } else {
            consId = uid("cons");
            addConsumed({
              id: consId,
              taskId: t.id,
              sourceType: t.sourceType,
              itemKey: item.key,
              status: "done",
              createdAt: new Date().toISOString(),
            });
          }
          if (t.contentType === "sticker") {
            const g = await generateStickerImages(
              t,
              `${item.title}\n${item.content}`,
            );
            const p = await publish(t, {
              title: t.platform === "小红书" ? g.title : "",
              content: g.content,
              images: g.images,
              postType: "sticker",
            });
            if (!p.ok) throw new Error(p.error);
            current = pushLog(
              current,
              `贴图已${saveToDraftOnly(t.platform, t.publishMode) ? "存入草稿" : "发布"}：${item.title}`,
            );
            doneCount += 1;
          } else {
            const a = await generateArticleHtml(
              t,
              `${item.title}\n${item.content}`,
            );
            const p = await publish(t, {
              title: a.title,
              content: a.html,
              coverImageUrl: a.coverImageUrl,
            });
            if (!p.ok) throw new Error(p.error);
            current = pushLog(
              current,
              `文章已${saveToDraftOnly(t.platform, t.publishMode) ? "存入草稿" : "发布"}：${a.title}`,
            );
            doneCount += 1;
          }
          if (item.groupId && item.materialId) {
            updateMaterial(item.groupId, item.materialId, {
              status: "used",
              usedAt: new Date().toISOString(),
            });
          }
          const pubAccount = listAccounts().find((a) => a.id === t.accountId);
          const pubWechat = t.wechatUsername
            ? (pubAccount?.wechatAccounts || []).find(
                (w) => w.username === t.wechatUsername,
              )
            : undefined;
          saveQueueItem({
            id: uid("pub"),
            platform: t.platform,
            account: pubWechat?.nickname || pubAccount?.name || t.accountId,
            title: item.title,
            status: saveToDraftOnly(t.platform, t.publishMode) ? "已存草稿" : "已发布",
            createdAt: new Date().toISOString(),
          });
          addUsage(t.contentType === "sticker" ? "贴图" : "文章");
          // 每成功一条立即落盘任务状态，避免重启后丢失已完成记录
          patchTask(t.id, { periodKey, doneCount, log: current.log });
        } catch (err) {
          current = pushLog(
            current,
            `素材「${item.title}」执行失败：${err instanceof Error ? err.message : String(err)}`,
          );
          if (item.groupId && item.materialId) {
            updateMaterial(
              item.groupId,
              item.materialId,
              t.retry ? { status: "failed" } : { status: "pending" },
            );
          } else if (consId) {
            updateConsumed(consId, { status: "failed" });
          }
          patchTask(t.id, { periodKey, doneCount, log: current.log });
          if (err && typeof err === 'object' && 'retryable' in err && err.retryable === false) {
            current=pushLog(current,'器灵调用已停止自动重试，请核对使用记录后手动恢复');
            throw err;
          }
        }
      }
      const reached = doneCount >= t.perRunCount;
      current = pushLog(
        current,
        reached
          ? `目标完成（${doneCount}/${t.perRunCount}），用时 ${((Date.now() - started) / 1000).toFixed(0)}s`
          : `本次执行完成（${doneCount}/${t.perRunCount}），用时 ${((Date.now() - started) / 1000).toFixed(0)}s`,
      );
      patchTask(t.id, {
        status: reached && t.frequency === "once" ? "已完成" : "运行中",
        enabled: reached && t.frequency === "once" ? false : true,
        periodKey,
        doneCount,
        lastRunAt: new Date().toISOString(),
        nextRunAt: reached
          ? t.frequency === "once"
            ? t.nextRunAt
            : nextDayAt(t.startTime)
          : nextInterval(),
        log: current.log,
      });
    } catch (err) {
      current = pushLog(
        current,
        `任务执行失败：${err instanceof Error ? err.message : String(err)}`,
      );
      patchTask(t.id, {
        enabled: err && typeof err === "object" && "retryable" in err && err.retryable === false ? false : t.enabled,
        status: err && typeof err === "object" && "retryable" in err && err.retryable === false ? "已暂停" : "运行中",
        periodKey,
        doneCount,
        nextRunAt: nextInterval(),
        log: current.log,
      });
    } finally {
      runningRef.current = false;
      setRunningId(null);
    }
  };

  const checkDue = async () => {
    if (runningRef.current) return;
    const due = listHostTasks().filter(
      (t) =>
        t.enabled &&
        t.status !== "已暂停" &&
        new Date(t.nextRunAt).getTime() <= Date.now(),
    );
    if (!due.length) return;
    for (const t of due) await executeTask(t);
  };

  useEffect(() => {
    // 应用启动后先等窗口/渲染区稳定，再检查到期任务。
    // 否则首条贴图会在布局未就绪时渲染出空图（“图片内容为空”）。
    const t0 = window.setTimeout(() => {
      checkDue();
    }, 15000);
    const iv = window.setInterval(() => {
      checkDue();
    }, 30000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewTpl = (): TemplateDesign | StickerCoverTemplate | undefined => {
    const v = form.getFieldValue("contentType");
    return v === "sticker"
      ? allCoverTemplates().find((x) => x.id === previewTplId) ||
          allCoverTemplates()[0]
      : ARTICLE_TEMPLATES.find((x) => x.id === previewTplId) ||
          ARTICLE_TEMPLATES[0];
  };

  const openPreview = () => {
    const v = form.getFieldValue("templateId");
    setPreviewTplId(String(v || ""));
    setPreviewAccent(form.getFieldValue("accent") || "#2F54EB");
    setPreviewOpen(true);
  };

  const columns = [
    {
      title: "任务名称",
      dataIndex: "name",
      key: "name",
      width: 140,
      ellipsis: true,
    },
    {
      title: "目标账号",
      key: "account",
      width: 150,
      render: (_: unknown, t: HostTaskItem) => {
        const a = accounts.find((x) => x.id === t.accountId);
        const mp = t.wechatUsername
          ? (a?.wechatAccounts || []).find(
              (w) => w.username === t.wechatUsername,
            )
          : undefined;
        return (
          <span>
            {a ? `${a.platform} · ${a.name}` : t.accountId}
            {mp ? `（${mp.nickname || t.wechatUsername}）` : ""}
          </span>
        );
      },
    },
    {
      title: "类型",
      key: "type",
      width: 70,
      render: (_: unknown, t: HostTaskItem) => (
        <Tag color={t.contentType === "sticker" ? "purple" : "blue"}>
          {t.contentType === "sticker" ? "贴图" : "文章"}
        </Tag>
      ),
    },
    {
      title: "内容源",
      key: "source",
      width: 130,
      render: (_: unknown, t: HostTaskItem) => {
        const label =
          t.sourceType === "material"
            ? "我的素材"
            : t.sourceType === "hot"
              ? "今日热点"
              : "微信爆文";
        const key =
          t.sourceType === "material"
            ? listMaterialGroups().find((g) => g.id === t.sourceKey)?.name ||
              t.sourceKey
            : t.sourceKey || "全部";
        return (
          <span>
            {label} · {key}
          </span>
        );
      },
    },
    {
      title: "目标篇数",
      dataIndex: "perRunCount",
      key: "perRunCount",
      width: 80,
    },
    {
      title: "频率",
      key: "frequency",
      width: 60,
      render: (_: unknown, t: HostTaskItem) =>
        t.frequency === "once" ? "一次" : "每天",
    },
    {
      title: "下次运行",
      key: "nextRun",
      width: 150,
      render: (_: unknown, task: HostTaskItem) =>
        isTaskEnabled(task) ? (
          new Date(task.nextRunAt).toLocaleString("zh-CN", { hour12: false })
        ) : (
          <span
            className="task-next-paused"
            title={
              task.status === "已完成"
                ? "任务已完成"
                : `原计划 ${new Date(task.nextRunAt).toLocaleString("zh-CN", { hour12: false })}`
            }
          >
            {task.status === "已完成" ? "已完成" : "已暂停调度"}
          </span>
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (_: unknown, task: HostTaskItem) => (
        <TaskStatusBadge task={task} executing={runningId === task.id} />
      ),
    },
    {
      title: "操作",
      key: "op",
      width: 210,
      render: (_: unknown, task: HostTaskItem) => (
        <TaskRowActions
          task={task}
          executing={runningId === task.id}
          onEdit={() => openEdit(task)}
          onToggle={() => toggleTask(task)}
          onLogs={() => setLogTask(task)}
          onDelete={() =>
            Modal.confirm({
              title: "删除该任务？",
              okText: "删除",
              okType: "danger",
              cancelText: "取消",
              onOk: () => removeTask(task),
            })
          }
        />
      ),
    },
  ];

  const sourceOptions = [
    { value: "hot", label: "今日热点" },
    { value: "wechat", label: "微信爆文" },
    { value: "material", label: "我的素材" },
  ];

  return {
    contextHolder,
    tasks,
    setCreateOpen,
    columns,
    editingTask,
    createOpen,
    closeCreate,
    form,
    saveTask,
    accounts,
    sourceOptions,
    categories,
    openPreview,
    previewOpen,
    setPreviewOpen,
    previewTpl,
    previewAccent,
    previewTplId,
    setPreviewTplId,
    setPreviewAccent,
    logTask,
    setLogTask,
    coverRef,
    renderTplId,
    renderCoverTitle,
    cardList,
    cardRefs,
  };
}
