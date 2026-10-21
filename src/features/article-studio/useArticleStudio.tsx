import { saveToDraftOnly } from "@/utils/publishPolicy";
import type { LibraryImage } from "@/components/ImageLibraryModal";
import { Modal,message } from "@/components/shared/controls";
import type { TemplateDesign } from "@/data/articleTemplates";
import { ARTICLE_TEMPLATES,templatePaperBg } from "@/data/articleTemplates";
import type { ArticleHistoryItem,StoredBlock } from "@/data/localStore";
import {
addUsage,
listAccounts,
listAssets,
listDrafts,
listQueue,
loadArticleHistory,
uid as newUid,
resolveWechatAuth,
saveAccount,
saveArticleHistoryItem,
saveDraft,
saveQueueItem,
updateArticleHistoryStatus,
} from "@/data/localStore";
import type { PromptSet } from "@/data/promptSets";
import {
getPromptSet,
isDefaultPromptSet,
loadLastPromptSetId,
loadPromptSets,
makeDefaultSet,
saveLastPromptSetId,
savePromptSets,
} from "@/data/promptSets";
import type {
CoverTextZone,
CustomStickerTemplate,
StickerCoverTemplate,
} from "@/data/stickerTemplates";
import {
DEFAULT_COVER_ZONE,
STICKER_COVER_TEMPLATES,
buildCoverRenderDesign,
loadCustomStickerTemplates,
saveCustomStickerTemplates,
} from "@/data/stickerTemplates";
import type { CustomTemplate,ThemeOverrides } from "@/data/themeOverrides";
import {
effectiveTemplate,
loadCustomTemplates,
loadThemeOverrides,
saveCustomTemplates,
saveThemeOverrides,
} from "@/data/themeOverrides";
import { buildInlineHtml } from "@/utils/articleHtml";
import {
isDataUrl,
readImage,
saveBlockImages,
saveImage,
} from "@/utils/imageStore";
import { renderCoverNodeToPng } from "@/utils/renderCoverNode";
import { renderDesignPng } from "@/utils/renderDesignPng";
import { fetchImages } from "@/utils/resourceApi";
import {
looksLikePrompt,
sanitizeSourceText,
} from "@/utils/sourceClean";
import { wechatClaimConfig } from "@/utils/wechatClaim";
import { useEffect,useMemo,useRef,useState } from "react";
import {
Block,
BlockType,
LAYOUT_LABELS,
TOOLBAR,
buildStickerCards,
cleanLabelPrefix,
cleanStickerText,
escapeHtml,
isTitleDuplicate,
nextBlockUid,
nextParseUid,
normalizeTitleText,
parseArticle,
promoteFirstTitle,
} from "./model";

import { candidateBlocks, documentText } from "./remove-ai-model";
import { sameBlocks, useBlockHistory } from "./useBlockHistory";

import { GENERATION_TOAST_KEY, generationError, useGenerationFeedback } from "./useGenerationFeedback";

export function useArticleStudio({
  pendingArticle,
  onConsumePending,
}: {
  pendingArticle?: { title: string; content: string; images?: string[] } | null;
  onConsumePending?: () => void;
} = {}) {
  const [topic, setTopic] = useState("轻断食的正确打开方式，别再饿肚子了");
  const [imgMode, setImgMode] = useState<"none" | "upload" | "auto">("auto");
  const [uploadImgs, setUploadImgs] = useState<
    Array<{ name: string; dataUrl: string }>
  >([]);
  const [autoImgCount, setAutoImgCount] = useState(1);
  const [outline, setOutline] = useState("");
  const [flow, setFlow] = useState<
    Record<"outline" | "article" | "layout", "pending" | "active" | "done" | "error">
  >({
    outline: "pending",
    article: "pending",
    layout: "pending",
  });
  const [flowOpen, setFlowOpen] = useState<
    "outline" | "article" | "layout" | null
  >(null);
  const [promptSets, setPromptSets] = useState<PromptSet[]>(loadPromptSets);
  const [promptSetId, setPromptSetId] = useState<string>(() => {
    const saved = loadLastPromptSetId();
    const list = loadPromptSets();
    return list.some((s) => s.id === saved) ? saved : list[0].id;
  });
  const [promptMgrOpen, setPromptMgrOpen] = useState(false);
  const [editingPromptSet, setEditingPromptSet] = useState<PromptSet | null>(
    null,
  );
  const [pushOpen, setPushOpen] = useState(false);
  const [pushMode, setPushMode] = useState<"draft" | "publish">("draft");
  const [pushPlatform, setPushPlatform] = useState("公众号");
  const [pushAccountId, setPushAccountId] = useState("");
  const [pushWechatUsername, setPushWechatUsername] = useState("");
  const [pushLoading, setPushLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  const [libSelectedIds, setLibSelectedIds] = useState<string[]>([]);
  // 贴图模式
  const [contentType, setContentType] = useState<"article" | "sticker">(
    "article",
  );
  const [stickerPreviewOpen, setStickerPreviewOpen] = useState(false);
  const [coverTplId, setCoverTplId] = useState(STICKER_COVER_TEMPLATES[0].id);
  const [coverCat, setCoverCat] = useState("全部");
  const [customCoverTemplates, setCustomCoverTemplatesState] = useState<
    CustomStickerTemplate[]
  >(loadCustomStickerTemplates);
  const [coverDesignOpen, setCoverDesignOpen] = useState(false);
  const [coverDesign, setCoverDesign] = useState<CustomStickerTemplate>({
    ...STICKER_COVER_TEMPLATES[0],
    source: "custom",
  });
  const [coverDesignName, setCoverDesignName] = useState("");
  const [coverDesignEditingId, setCoverDesignEditingId] = useState<
    string | null
  >(null);
  const [stickerWords, setStickerWords] = useState("400 字以内");
  const [bodyCardList, setBodyCardList] = useState<
    Array<{ heading: string; text: string }>
  >([]);
  const bodyCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [stickerPreviewIdx, setStickerPreviewIdx] = useState(0);
  const [renderingCover, setRenderingCover] = useState(false);
  const coverRenderRef = useRef<HTMLDivElement | null>(null);
  const [account, setAccount] = useState("主账号 · 健康生活");
  const [style, setStyle] = useState("干货科普");
  const [words, setWords] = useState("800 字");
  const [customWords, setCustomWords] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generation = useGenerationFeedback();
  useEffect(()=>{
    if(generating&&generation.feedback.stage==='layout')setFlow({outline:'done',article:'done',layout:'active'});
  },[generating,generation.feedback.stage]);
  const { blocks, setBlocks, resetBlocks, undoBlocks, redoBlocks, canUndo, canRedo } = useBlockHistory();
  const resetDocument = (next: Block[]) => {
    resetBlocks(next);
    setEditingId(null);
    setAnchorId(null);
  };
  const stickerTitleText = useMemo(
    () => blocks.find((b) => b.type === "title")?.text?.trim() || "",
    [blocks],
  );
  const stickerText = useMemo(
    () =>
      blocks
        .filter((b) => b.type !== "title" && b.type !== "image")
        .map((b) => (b.items ? b.items.join("\n") : b.text || ""))
        .filter(Boolean)
        .join("\n\n"),
    [blocks],
  );
  const stickerImageBlocks = useMemo(
    () => blocks.filter((b) => b.type === "image"),
    [blocks],
  );
  const coverImageBlock = useMemo(
    () => blocks.find((b) => b.type === "image" && b.cover),
    [blocks],
  );
  const [history, setHistory] = useState<ArticleHistoryItem[]>(() =>
    loadArticleHistory(),
  );
  const [templateId, setTemplateId] = useState("t1");
  const [tplCat, setTplCat] = useState("全部");
  const [tplPreview, setTplPreview] = useState<TemplateDesign | null>(null);
  const [tplCustom, setTplCustom] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("wangaohui:tplCustom") || "{}");
    } catch {
      return {};
    }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("wangaohui:tplFav") || "[]");
    } catch {
      return [];
    }
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [themeOverrides, setThemeOverridesState] =
    useState<Record<string, ThemeOverrides>>(loadThemeOverrides);
  const [customTemplates, setCustomTemplatesState] =
    useState<CustomTemplate[]>(loadCustomTemplates);
  const [genOpen, setGenOpen] = useState(false);
  const [genDraft, setGenDraft] = useState<ThemeOverrides>({});
  const [genName, setGenName] = useState("");
  const [darkPreview, setDarkPreview] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const allTemplates = useMemo(
    () => [...ARTICLE_TEMPLATES, ...customTemplates],
    [customTemplates],
  );
  const template = useMemo(
    () => allTemplates.find((t) => t.id === templateId) ?? ARTICLE_TEMPLATES[0],
    [templateId, allTemplates],
  );
  const overrides = themeOverrides[template.id] || {};
  const liveOverrides = genOpen ? { ...overrides, ...genDraft } : overrides;
  const effective = useMemo(
    () => effectiveTemplate(template, liveOverrides),
    [template, liveOverrides],
  );
  const currentAccent = tplCustom[template.id] || template.accent;
  const isCustom = currentAccent !== template.accent;
  const paperStyle = {
    "--tpl-accent": currentAccent,
    "--tpl-custom-bg": templatePaperBg(effective),
    "--tpl-font-size": `${liveOverrides.fontSize ?? 15}px`,
    "--tpl-line-height": `${liveOverrides.lineHeight ?? (effective.layout === "journal" ? 2.05 : 1.9)}`,
    "--tpl-letter-spacing": `${liveOverrides.letterSpacing ?? 0}em`,
    "--tpl-indent": liveOverrides.indent ? "2em" : "0em",
    "--tpl-body-color":
      liveOverrides.bodyColor ||
      (effective.paper === "dark" ? "#c9d2df" : "#333a48"),
    "--tpl-title-color":
      liveOverrides.titleColor ||
      (effective.paper === "dark" ? "#ffffff" : "#1f2430"),
  } as React.CSSProperties;
  const visibleTemplates = useMemo(() => {
    if (tplCat === "全部") return [...ARTICLE_TEMPLATES, ...customTemplates];
    if (tplCat === "收藏") {
      return [...ARTICLE_TEMPLATES, ...customTemplates].filter((t) =>
        favorites.includes(t.id),
      );
    }
    if (tplCat === "我的模板") return customTemplates;
    return ARTICLE_TEMPLATES.filter((t) => t.category === tplCat);
  }, [tplCat, favorites, customTemplates]);
  const coverTpl = useMemo(
    () =>
      [...STICKER_COVER_TEMPLATES, ...customCoverTemplates].find(
        (t) => t.id === coverTplId,
      ) ?? STICKER_COVER_TEMPLATES[0],
    [coverTplId, customCoverTemplates],
  );
  const visibleCoverTemplates = useMemo(
    () =>
      coverCat === "全部"
        ? [...STICKER_COVER_TEMPLATES, ...customCoverTemplates]
        : coverCat === "我的模板"
          ? customCoverTemplates
          : STICKER_COVER_TEMPLATES.filter((t) => t.cat === coverCat),
    [coverCat, customCoverTemplates],
  );


  const setAccent = (color: string) => {
    const next = { ...tplCustom, [effective.id]: color };
    setTplCustom(next);
    localStorage.setItem("wangaohui:tplCustom", JSON.stringify(next));
  };

  const resetAccent = () => {
    const next = { ...tplCustom };
    delete next[effective.id];
    setTplCustom(next);
    localStorage.setItem("wangaohui:tplCustom", JSON.stringify(next));
  };

  const toggleFav = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("wangaohui:tplFav", JSON.stringify(next));
  };

  const persistOverrides = (next: Record<string, ThemeOverrides>) => {
    setThemeOverridesState(next);
    saveThemeOverrides(next);
  };

  const persistCustomTemplates = (next: CustomTemplate[]) => {
    setCustomTemplatesState(next);
    saveCustomTemplates(next);
  };

  const uploadImage = async (id: string) => {
    if (window.wangaohui?.selectImage) {
      const r = await window.wangaohui.selectImage();
      if (r.ok && r.dataUrl) {
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, src: r.dataUrl } : b)));
        return;
      }
      if (!r.canceled) messageApi.error(r.error || "选择图片失败");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setBlocks(
          (prev) => prev.map((b) =>
            b.id === id ? { ...b, src: String(reader.result) } : b,
          ),
        );
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const openGenerator = () => {
    setGenDraft({ ...overrides });
    setGenName("");
    setGenOpen(true);
  };

  const resetGen = () => setGenDraft({});

  const applyGen = () => {
    persistOverrides({
      ...themeOverrides,
      [template.id]: { ...overrides, ...genDraft },
    });
    setGenOpen(false);
    messageApi.success(`已应用自定义主题到「${template.name}」`);
  };

  const saveAsTemplate = () => {
    const name = genName.trim();
    if (!name) {
      messageApi.warning("请输入模板名称");
      return;
    }
    const id = `custom-${Date.now()}`;
    const nt: TemplateDesign = {
      id,
      name,
      category: "我的模板",
      desc: "自定义主题",
      accent: currentAccent,
      cta: effective.cta,
      paper: effective.paper,
      title: effective.title,
      h2: effective.h2,
      quote: effective.quote,
      card: effective.card,
      divider: effective.divider,
      ctaStyle: effective.ctaStyle,
      list: effective.list,
      layout: effective.layout,
      serif: effective.serif,
    };
    persistCustomTemplates([...customTemplates, nt]);
    persistOverrides({
      ...themeOverrides,
      [id]: { ...overrides, ...genDraft },
    });
    setTemplateId(id);
    setGenOpen(false);
    messageApi.success(`已另存为「${name}」，可在「我的模板」中查看`);
  };

  const removeCustomTemplate = (id: string) => {
    persistCustomTemplates(customTemplates.filter((t) => t.id !== id));
    const nextOverrides = { ...themeOverrides };
    delete nextOverrides[id];
    persistOverrides(nextOverrides);
    if (templateId === id) setTemplateId("t1");
    messageApi.success("已删除自定义模板");
  };

  const persistCustomCoverTemplates = (list: CustomStickerTemplate[]) => {
    setCustomCoverTemplatesState(list);
    saveCustomStickerTemplates(list);
  };

  const openCoverDesign = (tpl?: StickerCoverTemplate) => {
    const base = tpl || coverTpl;
    setCoverDesign({ ...base, source: "custom" });
    setCoverDesignName(base.name);
    setCoverDesignEditingId(base.id.startsWith("cus-") ? base.id : null);
    setCoverDesignOpen(true);
  };

  const patchCoverDesign = (patch: Partial<CustomStickerTemplate>) => {
    setCoverDesign((d) => ({ ...d, ...patch }));
  };

  const pickCoverImage = (field: "bgImage" | "cardBgImage") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        patchCoverDesign({
          [field]: String(reader.result || ""),
        } as Partial<CustomStickerTemplate>);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const patchCoverZone = (patch: Partial<CoverTextZone>) => {
    setCoverDesign((d) => ({
      ...d,
      coverZones: [{ ...(d.coverZones?.[0] || DEFAULT_COVER_ZONE), ...patch }],
    }));
  };

  const patchCardZone = (
    key: "heading" | "text",
    patch: Partial<CoverTextZone>,
  ) => {
    setCoverDesign((d) => ({
      ...d,
      cardZones: {
        ...d.cardZones,
        [key]: { ...(d.cardZones?.[key] || DEFAULT_COVER_ZONE), ...patch },
      },
    }));
  };

  const saveCoverDesign = async (asNew: boolean) => {
    const name = coverDesignName.trim();
    if (!name) {
      messageApi.warning("请输入模板名称");
      return;
    }
    const custom: CustomStickerTemplate = {
      ...coverDesign,
      source: "custom",
      name,
      cat: coverDesign.cat === "全部" ? "我的模板" : coverDesign.cat,
    };
    // 自定义模板背景图落盘，避免 base64 撑爆 localStorage
    for (const field of ["bgImage", "cardBgImage"] as const) {
      if (isDataUrl(custom[field])) {
        try {
          custom[field] = await saveImage(custom[field] as string, "generated");
        } catch {
          /* 落盘失败保留原图 */
        }
      }
    }
    if (asNew || !coverDesignEditingId) {
      const id = `cus-${Date.now()}`;
      persistCustomCoverTemplates([...customCoverTemplates, { ...custom, id }]);
      setCoverTplId(id);
      setCoverDesignOpen(false);
      messageApi.success(`已另存为「${name}」，可在「我的模板」中查看`);
    } else {
      persistCustomCoverTemplates(
        customCoverTemplates.map((t) =>
          t.id === coverDesignEditingId
            ? { ...custom, id: coverDesignEditingId }
            : t,
        ),
      );
      setCoverTplId(coverDesignEditingId);
      setCoverDesignOpen(false);
      messageApi.success(`已保存「${name}」`);
    }
  };

  const removeCoverTemplate = (id: string) => {
    Modal.confirm({
      title: "删除自定义模板",
      content: "删除后不可恢复，确定删除该模板吗？",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        persistCustomCoverTemplates(
          customCoverTemplates.filter((t) => t.id !== id),
        );
        if (coverTplId === id) setCoverTplId(STICKER_COVER_TEMPLATES[0].id);
        messageApi.success("已删除自定义模板");
      },
    });
  };

  const coverColor = (v?: string) =>
    /^#[0-9a-f]{6}$/i.test(v || "") ? (v as string) : "#ffffff";

  const copyToGzh = async () => {
    if (blocks.length === 0) {
      messageApi.warning("请先生成文章或添加内容");
      return;
    }
    const html = buildInlineHtml(
      blocks,
      effective,
      currentAccent,
      liveOverrides,
    );
    if (window.wangaohui) {
      const r = await window.wangaohui.copyHtml(html);
      if (r.ok) {
        messageApi.success(
          "已复制排版 HTML，粘贴到公众号后台即可（样式内联，不掉格式）",
        );
      } else {
        messageApi.error(`复制失败：${r.error || "未知错误"}`);
      }
    } else {
      try {
        await navigator.clipboard.writeText(html);
        messageApi.success("已复制（浏览器预览模式，仅纯文本）");
      } catch {
        messageApi.error("复制失败");
      }
    }
  };

  const addBlock = (
    type: BlockType,
    sample?: string,
    items?: string[],
    afterId?: string | null,
  ) => {
    const targetId = afterId !== undefined ? afterId : anchorId;
    const block: Block = {
      id: `b${nextBlockUid()}`,
      type,
      text:
        type === "divider" ||
        type === "list" ||
        type === "infoGrid" ||
        type === "badges"
          ? undefined
          : sample,
      items:
        type === "list" || type === "infoGrid" || type === "badges"
          ? items
          : undefined,
    };
    const next = [...blocks];
    if (targetId) {
      const idx = next.findIndex((b) => b.id === targetId);
      if (idx >= 0) next.splice(idx + 1, 0, block);
      else next.push(block);
    } else {
      next.push(block);
    }
    setBlocks(next);
    setAnchorId(block.id);
    setEditingId(block.id);
    setEditValue(block.text || (block.items || []).join("\n"));
  };

  const insertAfter = (id: string, type: BlockType) => {
    const tpl = TOOLBAR.find((t) => t.type === type);
    addBlock(type, tpl?.sample, tpl?.items, id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setEditingId((cur) => (cur === id ? null : cur));
  };

  const startEdit = (b: Block) => {
    setAnchorId(b.id);
    setEditingId(b.id);
    setEditValue(b.items ? b.items.join("\n") : b.text || "");
  };

  const pendingBlocks = useMemo(() => {
    if (!editingId) return blocks;
    const listTypes = new Set(["list", "infoGrid", "badges"]);
    return blocks.map((x) =>
        x.id === editingId
          ? listTypes.has(x.type)
            ? {
                ...x,
                items: editValue
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : { ...x, text: editValue }
          : x,
      );
  }, [blocks, editingId, editValue]);
  const hasPendingEdit = !sameBlocks(blocks, pendingBlocks);
  const saveEdit = () => {
    if (!editingId) return;
    setBlocks(pendingBlocks);
    setEditingId(null);
  };
  const undoEdit = () => {
    if (hasPendingEdit) setBlocks(pendingBlocks);
    if (undoBlocks()) { setEditingId(null); setAnchorId(null); }
  };
  const redoEdit = () => {
    if (hasPendingEdit) return;
    if (redoBlocks()) { setEditingId(null); setAnchorId(null); }
  };

  const removeAiText = documentText(blocks.map(block => block.id === editingId ? {...block, text:editValue, items:block.items ? editValue.split('\n') : undefined} : block));
  const editorSnapshot = useRef({text:removeAiText,blocks});
  editorSnapshot.current = {text:removeAiText,blocks};
  const adoptRemoveAi = (expected:string,candidate:string) => {
    if(editorSnapshot.current.text!==expected)return false;
    setBlocks(candidateBlocks(editorSnapshot.current.blocks,candidate));
    setEditingId(null);
    return true;
  };
  const cancelEdit = () => setEditingId(null);

  const loadSticker = (h: ArticleHistoryItem) => {
    setContentType("sticker");
    const next: Block[] = [];
    if (h.blocks && h.blocks.length) {
      next.push(...(h.blocks as Block[]));
    } else {
      if (h.title)
        next.push({ id: `b${nextBlockUid()}`, type: "title", text: h.title });
      (h.text || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((line) =>
          next.push({ id: `b${nextBlockUid()}`, type: "p", text: line }),
        );
      (h.images || []).forEach((src) =>
        next.push({ id: `b${nextBlockUid()}`, type: "image", text: "", src }),
      );
    }
    resetDocument(next);
    setGenerated(true);
    messageApi.success(`已载入贴图「${h.title}」`);
  };

  const loadArticle = (h: ArticleHistoryItem) => {
    if (h.kind === "sticker") {
      loadSticker(h);
      return;
    }
    setContentType("article");
    if (!h.blocks || !h.blocks.length) {
      messageApi.warning("该记录没有可载入的内容");
      return;
    }
    resetDocument(
      (() => {
        const loaded = (h.blocks as Block[]).map((b) =>
          b.type === "title"
            ? { ...b, text: normalizeTitleText(b.text || "") }
            : b.text
              ? { ...b, text: cleanLabelPrefix(b.text) }
              : b,
        );
        return promoteFirstTitle(loaded);
      })(),
    );
    if (h.templateId) setTemplateId(h.templateId);
    setGenerated(true);
    messageApi.success(`已载入「${h.title}」到编辑器`);
  };

  const buildDraftPayload = (status: "草稿" | "待发布") => {
    const rawTitle = blocks.find((b) => b.type === "title")?.text || topic;
    const title = normalizeTitleText(rawTitle) || rawTitle;
    const titleText = normalizeTitleText(rawTitle) || "";
    // 正文里不包含标题块（标题只走平台标题字段），并过滤与标题重复的正文段
    const contentBlocks = blocks.filter(
      (b) => b.type !== "title" && !isTitleDuplicate(b.text || "", titleText),
    );
    const content = contentBlocks
      .map((b) =>
        b.text
          ? b.type === "title"
            ? normalizeTitleText(b.text)
            : cleanLabelPrefix(b.text)
          : b.items
            ? b.items.join("\n")
            : "",
      )
      .filter(Boolean)
      .join("\n\n");
    const html = buildInlineHtml(
      contentBlocks,
      effective,
      currentAccent,
      liveOverrides,
    );
    // 对齐真实编辑器：草稿需要 sections0/compose_info0，否则微信草稿箱打开会丢样式
    const sections0 = JSON.stringify(
      blocks.map((b, i) => ({
        section_index: 1000000 + i,
        text_content: b.text || " ",
        section_type: 9,
        ad_available: false,
      })),
    );
    const composeInfo = JSON.stringify({
      list: blocks.map((b, i) => ({
        blockIdx: i + 1,
        imgList: b.type === "image" && b.src ? [{ url: b.src }] : [],
        text: b.text || "",
      })),
    });
    return { title, content, html, sections0, composeInfo };
  };

  const saveDraftLocal = () => {
    if (blocks.length === 0) {
      messageApi.warning("请先生成文章或添加内容");
      return;
    }
    const { title, content, html } = buildDraftPayload("草稿");
    saveDraft({
      id: newUid("draft"),
      platform: "公众号",
      title,
      content,
      html,
      templateId: template.id,
      status: "草稿",
      createdAt: new Date().toISOString(),
    });
    addUsage("文章");
    messageApi.success(`草稿已保存（当前共 ${listDrafts().length} 篇草稿）`);
  };

  const saveToDraftBox = () => {
    if (blocks.length === 0) {
      messageApi.warning("请先生成文章或添加内容");
      return;
    }
    const { title, content, html } = buildDraftPayload("待发布");
    saveDraft({
      id: newUid("draft"),
      platform: "公众号",
      title,
      content,
      html,
      templateId: template.id,
      status: "待发布",
      createdAt: new Date().toISOString(),
    });
    saveQueueItem({
      id: newUid("pub"),
      platform: "公众号",
      account,
      title,
      status: "待发布",
      createdAt: new Date().toISOString(),
    });
    addUsage("发布");
    messageApi.success("已加入待处理列表，可到「内容发布」推送公众号草稿箱");
  };

  const openPushModal = (mode: "draft" | "publish") => {
    setPushMode(mode);
    setPushPlatform(mode === "draft" ? "公众号" : contentType === "sticker" ? "小红书" : "头条号");
    setPushAccountId("");
    setPushWechatUsername("");
    setPushOpen(true);
  };

  const confirmPush = async () => {
    const isSticker = contentType === "sticker";
    if (isSticker) {
      if (!stickerTitleText && stickerImageBlocks.length === 0) {
        messageApi.warning("请先生成贴图，或添加标题/图片");
        return;
      }
    } else if (blocks.length === 0) {
      messageApi.warning("请先生成文章或添加内容");
      return;
    }
    const account = listAccounts().find((a) => a.id === pushAccountId);
    if (!account) {
      messageApi.warning("请选择目标账号");
      return;
    }
    if (account.authed === false) {
      messageApi.error("该账号已停用，请先在账号中心启用");
      return;
    }
    const platformMap: Record<
      string,
      "wechat" | "toutiao" | "baijiahao" | "xiaohongshu"
    > = {
      公众号: "wechat",
      头条号: "toutiao",
      百家号: "baijiahao",
      小红书: "xiaohongshu",
    };
    const platform = platformMap[account.platform];
    if (!platform) {
      messageApi.warning("该平台暂不支持推送");
      return;
    }
    if (
      contentType === "sticker" &&
      platform !== "wechat" &&
      platform !== "xiaohongshu"
    ) {
      messageApi.warning("贴图仅支持发布到公众号/小红书");
      return;
    }
    let title: string;
    let html: string;
    let stickerImages: string[] = [];
    if (isSticker) {
      title = stickerTitleText || "贴图";
      stickerImages = blocks
        .filter((b) => b.type === "image" && b.src)
        .map((b) => b.src as string);
      // 描述与话题都随正文一起发布（描述已渲染进图片，正文同样保留文字）
      const topicText = blocks
        .filter(
          (b) =>
            b.type === "p" && !!b.text?.trim() && b.text.trim().startsWith("#"),
        )
        .map((b) => b.text?.trim() || "")
        .filter(Boolean)
        .join(" ");
      // 微信话题链接：topic-id 前半段为 base36 毫秒时间戳、后半段为随机串（与官方编辑器一致）
      const topicAnchors = (topicText.match(/#[^\s#]+/g) || [])
        .map((t) => {
          const ts = Date.now().toString(36);
          const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
          return `<a class="wx_topic_link" topic-id="${ts}-${rand}" style="color: #576B95 !important;" data-topic="1" data-recommend="">${t}</a>`;
        })
        .join(" ");
      const topicHtml = topicAnchors ? `<p></p><p>${topicAnchors}</p>` : "";
      const pubDescBlock = blocks.find(
        (b) => b.type === "cta" && !!b.text?.trim(),
      );
      const pubDesc = pubDescBlock?.text?.trim() || "";
      const descHtml = pubDesc ? `<p>${escapeHtml(pubDesc)}</p>` : "";
      // 公众号：标题放正文第一行（平台标题不传），正文放发布描述+话题；
      // 小红书：标题走平台标题字段，正文放发布描述+话题（完整内容在图片里）
      html =
        platform === "wechat"
          ? `<p>${escapeHtml(title)}</p>${descHtml ? `<p></p>${descHtml}</p>` : ""}${topicHtml}`
          : `${descHtml ? `${descHtml}<p></p>` : ""}${topicHtml}`;
    } else {
      const payload = buildDraftPayload("待发布");
      title = payload.title;
      html = payload.html;
    }
    setPushLoading(true);
    try {
      let cookie = account.cookie;
      let token = account.token;
      let claimSourceType: number | undefined;
      let isUserNoClaim: number | undefined;
      let copyrightType: number | undefined;
      let wechatTarget = "";
      if (platform === "wechat") {
        wechatTarget =
          pushWechatUsername ||
          (account.wechatAccounts || []).find((w) => w.kind !== "wxa")
            ?.username ||
          "";
        const auth = resolveWechatAuth(account, wechatTarget);
        cookie = auth.cookie || account.cookie;
        token = auth.token || account.token;
        const sub = (account.wechatAccounts || []).find(
          (w) => w.username === wechatTarget,
        );
        if (sub && sub.enabled === false) {
          messageApi.error("该公众号已停用，请先在账号中心启用");
          return;
        }
        const claim = wechatClaimConfig(sub?.contentDeclaration);
        claimSourceType = claim.claimSourceType;
        isUserNoClaim = claim.isUserNoClaim;
        copyrightType = sub?.copyrightType ?? 0;
        const rr = await window.wangaohui?.wechatRefreshSession({
          token,
          cookie,
          username: wechatTarget || undefined,
          accounts: account.wechatAccounts,
          currentUsername: account.currentUsername,
          fingerprint: account.fingerprint,
        });
        if (rr?.ok && rr.cookies) {
          cookie = rr.cookies;
          token = rr.token || token;
          const nextWechatAccounts = (account.wechatAccounts || []).map((w) =>
            w.username === wechatTarget
              ? {
                  ...w,
                  appid: rr.appid || w.appid,
                  token: rr.token || token,
                  cookies: rr.cookies || cookie,
                }
              : w,
          );
          saveAccount({
            ...account,
            cookie,
            token,
            lastRefresh: rr.lastRefresh,
            currentUsername: rr.currentUsername || wechatTarget || undefined,
            wechatAccounts: nextWechatAccounts,
          });
        } else {
          updateArticleHistoryStatus(
            title,
            "发布失败",
            rr?.error || "切换公众号登录态失败",
          );
          setHistory(loadArticleHistory());
          messageApi.error(rr?.error || "切换公众号登录态失败");
          return;
        }
      }
      const pubAccountName =
        platform === "wechat"
          ? (account.wechatAccounts || []).find(
              (w) => w.username === wechatTarget,
            )?.nickname ||
            wechatTarget ||
            account.name
          : account.name;
      const coverMatch = html.match(/<img[^>]+src="([^"]+)"/);
      const r = await window.wangaohui?.platformPublish({
        platform,
        cookie,
        token,
        fingerprint: account.fingerprint,
        title: isSticker ? (platform === "xiaohongshu" ? title : "") : title,
        content: html,
        sections0: "",
        composeInfo: "",
        coverImageUrl: isSticker
          ? stickerImages[0]
          : coverMatch?.[1] || undefined,
        postType: isSticker ? "sticker" : "article",
        images: isSticker ? stickerImages : [],
        saveDraftOnly: saveToDraftOnly(pushPlatform, pushMode),
        wechatUsername: wechatTarget || undefined,
        wechatAccounts: account.wechatAccounts,
        currentUsername: account.currentUsername,
        claimExclusive: account.claimExclusive,
        contentDeclaration: account.contentDeclaration,
        bjhTtv: account.bjhTtv,
        bjhAiTts: account.bjhAiTts,
        bjhAigc: account.bjhAigc,
        xhsOriginal: account.xhsOriginal,
        xhsContentDeclaration: account.xhsContentDeclaration,
        claimSourceType,
        isUserNoClaim,
        copyrightType,
      });
      if (r?.ok && (r?.cookies || r?.token)) {
        const nextWechatAccounts = (account.wechatAccounts || []).map((w) =>
          w.username === wechatTarget
            ? {
                ...w,
                token: r.token || w.token,
                cookies: r.cookies || w.cookies,
              }
            : w,
        );
        saveAccount({
          ...account,
          cookie: r.cookies || cookie,
          token: r.token || token,
          lastRefresh: r.lastRefresh || new Date().toISOString(),
          currentUsername: wechatTarget || account.currentUsername,
          wechatAccounts: nextWechatAccounts,
        });
      }
      const existingPub = listQueue().find(
        (q) =>
          q.title === title &&
          q.platform === account.platform &&
          q.status === "待发布",
      );
      if (r?.ok) {
        if (existingPub) {
          saveQueueItem({
            ...existingPub,
            platform: account.platform,
            account: pubAccountName,
            status: saveToDraftOnly(pushPlatform, pushMode) ? "已存草稿" : "已发布",
            error: undefined,
          });
        } else {
          saveQueueItem({
            id: newUid("pub"),
            platform: account.platform,
            account: pubAccountName,
            title,
            status: saveToDraftOnly(pushPlatform, pushMode) ? "已存草稿" : "已发布",
            createdAt: new Date().toISOString(),
          });
        }
        const localDraft = listDrafts().find(
          (d) => d.title === title && d.platform === account.platform,
        );
        if (localDraft) {
          saveDraft({
            ...localDraft,
            status: saveToDraftOnly(pushPlatform, pushMode) ? "待发布" : "已发布",
          });
        }
        updateArticleHistoryStatus(
          title,
          saveToDraftOnly(pushPlatform, pushMode) ? "已存草稿" : "已发布",
        );
        setHistory(loadArticleHistory());
        if (!saveToDraftOnly(pushPlatform, pushMode)) addUsage("发布");
        setPushOpen(false);
        messageApi.success(
          saveToDraftOnly(pushPlatform, pushMode) ? "已推送到平台草稿箱" : "发布成功",
        );
      } else {
        if (existingPub) {
          saveQueueItem({
            ...existingPub,
            platform: account.platform,
            account: pubAccountName,
            status: "失败",
            error: r?.error || "发布失败",
          });
        } else {
          saveQueueItem({
            id: newUid("pub"),
            platform: account.platform,
            account: pubAccountName,
            title,
            status: "失败",
            error: r?.error || "发布失败",
            createdAt: new Date().toISOString(),
          });
        }
        updateArticleHistoryStatus(title, "发布失败", r?.error || "发布失败");
        setHistory(loadArticleHistory());
        messageApi.error(r?.error || "操作失败");
      }
    } finally {
      setPushLoading(false);
    }
  };

  const pickImages = async () => {
    const lib = listAssets();
    const ids = uploadImgs
      .map((u) => lib.find((a) => a.dataUrl === u.dataUrl)?.id)
      .filter((x): x is string => !!x);
    setLibSelectedIds(ids);
    setLibOpen(true);
  };

  const handleLibraryConfirm = (images: LibraryImage[]) => {
    setUploadImgs(images.map(({ name, dataUrl }) => ({ name, dataUrl })));
    setLibOpen(false);
    messageApi.success(`已选择 ${images.length} 张配图`);
  };

  const LEADING_WORDS = [
    "更重要的是",
    "换句话说",
    "先说结论",
    "说白了",
    "说到底",
    "回到",
    "比如",
    "例如",
    "但是",
    "可是",
    "不过",
    "所以",
    "于是",
    "其实",
    "后来",
    "而且",
    "然后",
    "还有",
    "当然",
    "可能",
    "如果",
    "因为",
    "虽然",
    "尽管",
    "那么",
    "这样",
    "那时",
    "每次",
    "很多人",
    "有些",
    "有的",
  ];

  const headingFrom = (t: string): string => {
    let s = t.trim();
    for (const w of LEADING_WORDS) {
      if (s.startsWith(w)) {
        s = s.slice(w.length).trim();
        break;
      }
    }
    s = s.replace(/^[，。！？；：、\s]+/, "");
    const m = s.match(/^[^，。！？；：、\s]{2,12}/);
    const h = m ? m[0] : s.slice(0, 12);
    return h.replace(/[，。！？；：、\s]+$/, "") || s.slice(0, 12);
  };

  const ensureSectionHeadings = (blocks: Block[]): Block[] => {
    if (blocks.some((b) => b.type === "h2")) return blocks;
    const paraCount = blocks.filter((b) => b.type === "p").length;
    if (paraCount < 4) return blocks;
    const secCount = Math.min(4, Math.max(2, Math.ceil(paraCount / 3)));
    const size = Math.ceil(paraCount / secCount);
    const next: Block[] = [];
    let group = 0;
    let idx = 0;
    for (const b of blocks) {
      if (b.type === "p") {
        const g = Math.floor(idx / size);
        if (g > group) {
          group = g;
          next.push({
            id: `b${nextBlockUid()}`,
            type: "h2",
            text: headingFrom(b.text || ""),
          });
        }
        idx += 1;
      }
      next.push(b);
    }
    return next;
  };

  const isPlaceholderTitle = (s: string) => {
    const t = String(s || "")
      .replace(/[*#>\s：:]/g, "")
      .trim();
    return (
      t === "文章主标题" ||
      t === "主标题" ||
      t === "标题" ||
      t === "这里是一级标题" ||
      t === "一级标题"
    );
  };

  const parseBoldTitle = (bold: string): string => {
    const m = String(bold).match(/^(?:文章主标题|主标题|标题)[：:]\s*(.+)$/);
    return m ? m[1].trim() : bold.trim();
  };

  const parseOutline = (
    text: string,
  ): { title: string; quote: string; sections: string[] } => {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const rawBold = text.match(/\*\*(.+?)\*\*/)?.[1]?.trim() || "";
    const bold = parseBoldTitle(rawBold);
    const fallbackLine = lines.find((l) => {
      const c = normalizeTitleText(l);
      return (
        l &&
        c &&
        !isPlaceholderTitle(c) &&
        !/^(金句|框架|核心|小段标题|配图|避雷|要点|文章风格|目标字数)/.test(
          c,
        ) &&
        !/^\*\*/.test(l) &&
        c.length <= 40
      );
    });
    const title =
      (bold && !isPlaceholderTitle(bold) ? normalizeTitleText(bold) : "") ||
      text.match(/^(?:文章主标题|主标题|标题)[：:]\s*(.+)$/m)?.[1]?.trim() ||
      (fallbackLine ? normalizeTitleText(fallbackLine) : "") ||
      "";
    const quote = text.match(/金句[：:]\s*(.+)/)?.[1]?.trim() || "";
    const sections: string[] = [];
    const secBlock = text.match(
      /小段标题[：:]\s*([\s\S]*?)(?=\n\s*配图[：:]|$)/,
    );
    if (secBlock) {
      for (const line of secBlock[1].split("\n")) {
        const m = line.match(/^\s*(?:\d+[\.、]|[-*])\s*(.+)$/);
        if (m) sections.push(m[1].trim());
      }
    }
    return { title, quote, sections };
  };

  const applyOutlineStructure = (
    blocks: Block[],
    outlineText: string,
  ): Block[] => {
    if (!outlineText.trim()) return blocks;
    const { title, quote, sections } = parseOutline(outlineText);
    let next = [...blocks];

    if (title) {
      const cleanTitle = normalizeTitleText(title);
      const titleIdx = next.findIndex((b) => b.type === "title");
      if (titleIdx >= 0) {
        next = next.map((b) =>
          b.type === "title" ? { ...b, text: cleanTitle } : b,
        );
      } else {
        next = [
          { id: `b${nextBlockUid()}`, type: "title", text: cleanTitle },
          ...next,
        ];
      }
    }

    if (quote && !next.some((b) => b.type === "quote")) {
      const idx = next.findIndex((b) => b.type === "title");
      next.splice(idx + 1, 0, {
        id: `b${nextBlockUid()}`,
        type: "quote",
        text: quote,
      });
    }

    if (sections.length) {
      const h2s = next.filter((b) => b.type === "h2");
      // 只有数量一致时才用大纲小标题覆盖模型小标题，避免标题与正文错位；不一致时保留模型小标题
      if (h2s.length === sections.length) {
        let k = 0;
        next = next.map((b) =>
          b.type === "h2" ? { ...b, text: sections[k++] } : b,
        );
      }
    }
    return next;
  };

  const cropWatermark = async (input: string): Promise<string> => {
    const src = await readImage(input);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.width;
          const h = img.height;
          const top = Math.round(h * 0.05);
          const bottom = Math.round(h * 0.15);
          const ch = Math.max(1, h - top - bottom);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(input);
            return;
          }
          ctx.drawImage(img, 0, top, w, ch, 0, 0, w, ch);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        } catch {
          resolve(input);
        }
      };
      img.onerror = () => resolve(input);
      img.src = src;
    });
  };

  const downloadOriginalImage = async (url: string): Promise<string> => {
    const httpsUrl = url.replace(/^http:\/\//, "https://");
    if (window.wangaohui?.downloadImage) {
      const r = await window.wangaohui.downloadImage({ url: httpsUrl });
      if (r.ok && r.dataUrl) return r.dataUrl;
      throw new Error(r.error || "下载失败");
    }
    const res = await fetch(httpsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.readAsDataURL(blob);
    });
  };

  const autoPickImages = async (
    blocks: Block[],
    outlineText: string,
  ): Promise<Array<{ src: string; text: string }>> => {
    // 记录最近用过的配图，避免每篇文章都选到同一张
    const RECENT_KEY = "wangaohui:recentImages";
    const loadRecent = (): string[] => {
      try {
        const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    };
    const recent = new Set(loadRecent());
    const articleText = [
      blocks.find((b) => b.type === "title")?.text,
      ...blocks.filter((b) => b.type === "h2").map((b) => b.text),
      ...blocks
        .filter((b) => b.type === "p")
        .slice(0, 8)
        .map((b) => b.text),
      outlineText,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 3000);

    // 自动配图：从资源库「图片素材」（AI 已打标的远程图库）匹配
    const pool: Array<{ url: string; tags: string[]; name?: string }> = [];
    try {
      const r = await fetchImages({ ai_tagged: true, page_size: 100 });
      const seenUrl = new Set<string>();
      for (const x of r.data || []) {
        if (!x.url || !(x.tags || []).length || seenUrl.has(x.url)) continue;
        seenUrl.add(x.url);
        pool.push({ url: x.url, tags: x.tags || [], name: x.title || "" });
      }
    } catch {
      /* 图片素材接口异常时走原文图片兜底 */
    }

    const pickedUrls: string[] = [];
    const usedUrl = new Set<string>();

    if (pool.length && window.wangaohui?.llmChat) {
      const tags = Array.from(new Set(pool.flatMap((a) => a.tags)));
      const system =
        "你是公众号文章配图选图助手。根据文章内容和大纲「配图」描述，从可用标签中选择最匹配的标签，只输出 JSON 字符串数组，不要输出任何其他内容。";
      const user = `文章内容：\n${articleText}\n\n可用标签：${tags.join("、")}\n\n请选择 ${autoImgCount} 个互不相同的标签，使每个标签下的图片最能贴合对应的配图描述，输出格式如 ["街拍","风景"]。`;
      try {
        const r = await window.wangaohui.llmChat({
          provider: "deepseek",
          temperature: 0.1,
          system,
          user,
        });
        if (r.ok && r.reply) {
          let chosenTags: string[] = [];
          const arr = r.reply.match(/\[[^\]]*\]/);
          if (arr) {
            try {
              chosenTags = JSON.parse(arr[0]).filter(
                (t: unknown) => typeof t === "string",
              );
            } catch {
              chosenTags = [];
            }
          }
          if (!chosenTags.length) {
            chosenTags = Array.from(r.reply.matchAll(/["“]([^"”]+)["”]/g)).map(
              (m) => m[1],
            );
          }
          for (const tag of chosenTags) {
            const candidates = pool.filter(
              (a) =>
                a.tags.includes(tag) &&
                !usedUrl.has(a.url) &&
                !recent.has(a.url),
            );
            const relaxed =
              candidates.length > 0
                ? candidates
                : pool.filter(
                    (a) => a.tags.includes(tag) && !usedUrl.has(a.url),
                  );
            if (relaxed.length) {
              const item = relaxed[Math.floor(Math.random() * relaxed.length)];
              usedUrl.add(item.url);
              pickedUrls.push(item.url);
            }
            if (pickedUrls.length >= autoImgCount) break;
          }
        }
      } catch {
        /* 模型失败走关键词兜底 */
      }
    }

    if (pickedUrls.length < autoImgCount) {
      const kw = articleText.toLowerCase();
      const scored = pool
        .filter((a) => !usedUrl.has(a.url))
        .map((a) => {
          const tags = a.tags.join(" ");
          const score =
            tags.split(/\s+/).filter((t) => t && kw.includes(t.toLowerCase()))
              .length +
            ((a.name || "") && kw.includes((a.name || "").toLowerCase())
              ? 1
              : 0);
          return { a, score };
        })
        .sort((x, y) => y.score - x.score);
      const remaining = scored.filter((s) => !usedUrl.has(s.a.url));
      while (pickedUrls.length < autoImgCount && remaining.length) {
        const idx = Math.floor(Math.random() * remaining.length);
        const s = remaining.splice(idx, 1)[0];
        usedUrl.add(s.a.url);
        pickedUrls.push(s.a.url);
      }
    }

    const picked: Array<{ src: string; text: string }> = [];
    for (const url of pickedUrls) {
      if (picked.length >= autoImgCount) break;
      try {
        picked.push({ src: await downloadOriginalImage(url), text: "" });
      } catch {
        /* 跳过下载失败的素材图片 */
      }
    }

    if (picked.length < autoImgCount && pendingImages.length) {
      for (const url of pendingImages) {
        if (picked.length >= autoImgCount) break;
        try {
          const raw = await downloadOriginalImage(url);
          const cropped = await cropWatermark(raw);
          picked.push({ src: cropped, text: "" });
        } catch {
          /* 跳过下载失败的原文图片 */
        }
      }
    }

    try {
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([...recent, ...Array.from(usedUrl)].slice(-30)),
      );
    } catch {
      /* ignore */
    }

    return picked.slice(0, autoImgCount);
  };

  const attachImages = async (
    blocks: Block[],
    outlineText: string,
  ): Promise<Block[]> => {
    const images: Array<{ src: string; text: string }> = [];
    if (imgMode === "upload") {
      images.push(...uploadImgs.map((u) => ({ src: u.dataUrl, text: "" })));
    } else if (imgMode === "auto") {
      images.push(...(await autoPickImages(blocks, outlineText)));
    }
    // 图片统一落盘到磁盘，生成记录/发布只引用 wgh-image:// 路径
    for (let i = 0; i < images.length; i += 1) {
      if (isDataUrl(images[i].src)) {
        try {
          images[i] = {
            ...images[i],
            src: await saveImage(images[i].src, "generated"),
          };
        } catch {
          /* 落盘失败保留原图 */
        }
      }
    }
    if (!images.length) return blocks;

    const textLen = (b: Block) =>
      (b.text?.length || 0) +
      (b.items ? b.items.reduce((s, x) => s + x.length, 0) : 0);
    const weights = blocks.map(textLen);
    const total = weights.reduce((a, b) => a + b, 0) || blocks.length;

    // 段落组聚类：连续的 p/quote/card/tip/list 视为一个段落组，
    // 图只插在段落组之间；超过 3 段的超长段落组按约 3 段一个切口近似切开（仍在整段之间）。
    const flowTypes = new Set(["p", "quote", "card", "tip", "list"]);
    const clusters: Array<{ start: number; end: number }> = [];
    let runStart = -1;
    for (let i = 0; i <= blocks.length; i += 1) {
      const isFlow = i < blocks.length && flowTypes.has(blocks[i].type);
      if (isFlow && runStart < 0) runStart = i;
      if (!isFlow && runStart >= 0) {
        clusters.push({ start: runStart, end: i });
        runStart = -1;
      }
    }

    const cum: number[] = [0];
    for (let i = 0; i < weights.length; i += 1) cum.push(cum[i] + weights[i]);

    // 可选插入点：每个段落组内每个完整段落之后（绝不插进段落中间），以及段落组结束处
    const candidates: number[] = [];
    for (const c of clusters) {
      const len = c.end - c.start;
      for (let k = 1; k < len; k += 1) {
        candidates.push(c.start + k);
      }
      candidates.push(c.end);
    }
    if (!candidates.length) {
      const ctaIdx = blocks.findIndex((b) => b.type === "cta");
      candidates.push(ctaIdx >= 0 ? ctaIdx : blocks.length);
    }
    candidates.sort((a, b) => a - b);

    const rawPositions = images.map((_, idx) => {
      const target = (total * (idx + 1)) / (images.length + 1);
      let best = candidates[0];
      let bestDist = Infinity;
      for (const pos of candidates) {
        const dist = Math.abs(cum[pos] - target);
        if (dist < bestDist || (dist === bestDist && pos > best)) {
          bestDist = dist;
          best = pos;
        }
      }
      return best;
    });

    // 位置严格递增，避免两张图挤在一起
    const positions: number[] = [];
    for (let i = 0; i < rawPositions.length; i += 1) {
      let pos = rawPositions[i];
      if (i > 0) pos = Math.max(pos, positions[i - 1] + 1);
      positions.push(Math.min(pos, blocks.length));
    }
    const next = [...blocks];
    for (let i = images.length - 1; i >= 0; i -= 1) {
      next.splice(Math.min(positions[i], next.length), 0, {
        id: `b${nextBlockUid()}`,
        type: "image",
        text: images[i].text,
        src: images[i].src,
      });
    }
    return next;
  };

  // 贴图生成：AI 直接输出标题 + 分段落描述 + 话题，文字逐段渲染成图片卡片，
  // 不再走文章去AI核心流程；发布正文只保留标题 + 话题
  const renderBodyCardImages = async (
    cards: Array<{ heading: string; text: string }>,
  ): Promise<string[]> => {
    if (!cards.length) return [];
    setBodyCardList(cards);
    await new Promise((r) => setTimeout(r, 100));
    const out: string[] = [];
    for (let i = 0; i < cards.length; i += 1) {
      const node = bodyCardRefs.current[i];
      if (!node) continue;
      try {
        out.push(await renderCoverNodeToPng(node));
      } catch {
        /* 单张内容卡失败跳过 */
      }
    }
    setBodyCardList([]);
    return out;
  };

  const generateSticker = async () => {
    if (generation.isRunning()) return false;
    const src = sanitizeSourceText(topic.trim());
    if (looksLikePrompt(src)) {
      generation.fail(new Error("输入内容看起来像提示词/指令，请在「提示词管理」里配置人设提示词；输入框请粘贴文章素材或主题"));
      messageApi.warning({content:"输入内容看起来像提示词/指令，请在「提示词管理」里配置人设提示词；输入框请粘贴文章素材或主题",key:GENERATION_TOAST_KEY});
      return;
    }
    if (!src) {
      generation.fail(new Error("请先输入贴图主题"));
      messageApi.warning({content:"请先输入贴图主题",key:GENERATION_TOAST_KEY});
      return;
    }
    if (!window.wangaohui) {
      generation.fail(new Error("请在桌面应用中使用内容生成"));
      messageApi.error({content:"请在桌面应用中使用内容生成",key:GENERATION_TOAST_KEY});
      return;
    }
    setContentType("sticker");
    if (!generation.begin("正在生成贴图文案，请稍候。")) return false;
    setGenerating(true);
    try {
      const wordLimit = parseInt(stickerWords, 10) || 400;
      const prompt = getPromptSet(promptSetId);
      const r = await window.wangaohui.llmChat({
        requestId:generation.requestId(),
        provider: "deepseek",
        temperature: 0.7,
        system: prompt.stickerSystem,
        user: prompt.stickerUser
          .replace(/\{topic\}/g, src)
          .replace(/\{words\}/g, String(wordLimit)),
      });
      generation.assertActive();
      if (!r.ok || !r.reply) throw generationError(r, "贴图生成失败");
      const lines = r.reply
        .trim()
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const title = normalizeTitleText(lines[0] || "") || topic;
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
          : [];
      const bodyEnd =
        pubDescIdx >= 0 ? pubDescIdx : topicIdx >= 0 ? topicIdx : lines.length;
      const text = lines.slice(1, bodyEnd).join("\n");
      const publishDesc =
        pubDescIdx >= 0
          ? lines
              .slice(pubDescIdx)
              .filter((l) => !/^#/.test(l))
              .map((l) => l.replace(/^发布描述[：:]\s*/, ""))
              .join("")
              .trim()
          : "";
      // 贴图文字会渲染进图片卡片，直接使用 AI 原文，不再走文章去AI核心流程
      const finalTitle = (normalizeTitleText(title) || topic).slice(0, 25);
      let finalText = cleanStickerText(text);
      if (finalText.startsWith(finalTitle)) {
        finalText = finalText.slice(finalTitle.length).trim();
      }
      const topicText = topics.join(" ");
      const bodyLimit = Math.max(60, wordLimit - (topicText.length || 0));
      const finalBody = finalText.slice(0, bodyLimit);
      const next: Block[] = [
        { id: `b${nextBlockUid()}`, type: "title", text: finalTitle },
        ...finalBody
          .split(/\n+/)
          .filter(Boolean)
          .map((line) => ({
            id: `b${nextBlockUid()}`,
            type: "p" as const,
            text: line,
          })),
        ...(publishDesc
          ? [
              {
                id: `b${nextBlockUid()}`,
                type: "cta" as const,
                text: publishDesc,
              },
            ]
          : []),
        ...(topicText
          ? [{ id: `b${nextBlockUid()}`, type: "p" as const, text: topicText }]
          : []),
        ...uploadImgs.map((u) => ({
          id: `b${nextBlockUid()}`,
          type: "image" as const,
          text: "",
          src: u.dataUrl,
        })),
      ];
      resetDocument(next);
      setGenerated(true);
      generation.progress("文案已生成，正在制作首图与内容卡。");
      // 自动排版：首图渲染标题，每个段落渲染成一张内容卡
      let finalBlocks = next;
      let coverOk = false;
      let cardsOk = false;
      let cardCount = 0;
      try {
        const paragraphs = buildStickerCards(
          finalBody
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
        cardCount = paragraphs.length;
        const bodyImgs = await renderBodyCardImages(paragraphs);
        cardsOk = bodyImgs.length > 0;
        const cardBlocks: Block[] = bodyImgs.map((src) => ({
          id: `b${nextBlockUid()}`,
          type: "image",
          text: "",
          src,
          card: true,
        }));
        await new Promise((r) => setTimeout(r, 50));
        let coverSrc: string | undefined;
        if (coverRenderRef.current) {
          try {
            coverSrc = await renderCoverNodeToPng(coverRenderRef.current);
          } catch {
            coverSrc = undefined;
          }
        }
        if (!coverSrc)
          coverSrc = await renderDesignPng(
            buildCoverRenderDesign(coverTpl, finalTitle, ""),
          );
        if (coverSrc) {
          finalBlocks = [
            {
              id: `b${nextBlockUid()}`,
              type: "image",
              text: "",
              src: coverSrc,
              cover: true,
            },
            ...cardBlocks,
            ...next,
          ];
          coverOk = true;
        } else if (cardBlocks.length) {
          finalBlocks = [...cardBlocks, ...next];
        }
      } catch {
        coverOk = false;
      }
      // 生成的贴图图片落盘，生成记录只存 wgh-image:// 路径
      finalBlocks = await saveBlockImages(finalBlocks, "generated");
      generation.assertActive();
      resetDocument(finalBlocks);
      saveArticleHistoryItem({
        id: newUid("art"),
        title: finalTitle,
        time: new Date().toISOString(),
        tag: "贴图",
        kind: "sticker",
        blocks: finalBlocks,
        images: finalBlocks
          .filter((b) => b.type === "image")
          .map((b) => b.src || ""),
        text: [finalText, publishDesc, topicText].filter(Boolean).join("\n\n"),
        status: "待发布",
      });
      setHistory(loadArticleHistory());
      const completedMessage = coverOk
        ? `贴图生成完成：首图 + ${cardsOk ? `${cardCount} 张内容卡` : "内容卡生成失败，可在编辑页重试排版"}`
        : "贴图文案已生成，首图制作失败，可在编辑页重试排版";
      generation.succeed(completedMessage);
      messageApi.success({content:completedMessage,key:GENERATION_TOAST_KEY});
      return true;
    } catch (err) {
      generation.fail(err);
      messageApi.error({content:`贴图生成失败：${err instanceof Error ? err.message : String(err)}`,key:GENERATION_TOAST_KEY});
    } finally {
      setGenerating(false);
      generation.finish();
    }
  };

  const renderStickerCards = async () => {
    const title = stickerTitleText || topic.trim();
    if (!title) {
      messageApi.warning("请先添加「标题」模块，再生成首图与内容卡");
      return;
    }
    setRenderingCover(true);
    try {
      // 内容卡：正文段落逐段渲染，话题放在最后一张
      const cards = buildStickerCards(
        blocks
          .filter(
            (b) =>
              b.type === "p" &&
              !!b.text?.trim() &&
              !b.text.trim().startsWith("#"),
          )
          .map((b) => b.text?.trim() || "")
          .filter(Boolean),
      );
      const bodyImgs = await renderBodyCardImages(cards);
      const cardBlocks: Block[] = bodyImgs.map((src) => ({
        id: `b${nextBlockUid()}`,
        type: "image",
        text: "",
        src,
        card: true,
      }));
      // 首图：标题渲染到用户选择的模板
      let coverSrc: string;
      if (coverRenderRef.current) {
        try {
          coverSrc = await renderCoverNodeToPng(coverRenderRef.current);
        } catch {
          coverSrc = await renderDesignPng(
            buildCoverRenderDesign(coverTpl, title, ""),
          );
        }
      } else {
        coverSrc = await renderDesignPng(
          buildCoverRenderDesign(coverTpl, title, ""),
        );
      }
      setBlocks((prev) => {
        const base = prev.filter(
          (b) => !(b.type === "image" && (b.cover || b.card)),
        );
        const next: Block[] = [
          {
            id: `b${nextBlockUid()}`,
            type: "image",
            text: "",
            src: coverSrc,
            cover: true,
          },
          ...cardBlocks,
          ...base,
        ];
        return next;
      });
      messageApi.success(
        `已按「${coverTpl.name}」模板生成首图 + ${cardBlocks.length} 张内容卡`,
      );
    } catch (err) {
      messageApi.error(
        `自动排版失败：${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRenderingCover(false);
    }
  };

  const openPromptMgr = () => {
    setEditingPromptSet({ ...getPromptSet(promptSetId) });
    setPromptMgrOpen(true);
  };

  const usePromptSet = (id: string) => {
    setPromptSetId(id);
    saveLastPromptSetId(id);
  };

  const patchEditingPromptSet = (patch: Partial<PromptSet>) => {
    setEditingPromptSet((d) => (d ? { ...d, ...patch } : d));
  };

  const saveEditingPromptSet = () => {
    if (!editingPromptSet) return;
    if (!editingPromptSet.name.trim()) {
      messageApi.warning("请填写备注名");
      return;
    }
    if (
      !editingPromptSet.outlineSystem.trim() ||
      !editingPromptSet.outlineUser.trim()
    ) {
      messageApi.warning("文章大纲提示词不能为空");
      return;
    }
    if (
      !editingPromptSet.stickerSystem.trim() ||
      !editingPromptSet.stickerUser.trim()
    ) {
      messageApi.warning("贴图提示词不能为空");
      return;
    }
    const saved = { ...editingPromptSet, name: editingPromptSet.name.trim() };
    const list = loadPromptSets().map((s) => (s.id === saved.id ? saved : s));
    if (!list.some((s) => s.id === saved.id)) {
      list.push(saved);
    }
    setPromptSets(list);
    savePromptSets(list);
    messageApi.success(`提示词「${saved.name}」已保存`);
  };

  const addPromptSet = () => {
    const id = `ps-${Date.now()}`;
    const next: PromptSet = {
      ...makeDefaultSet(),
      id,
      name: "新提示词",
      createdAt: new Date().toISOString(),
    };
    const list = [...loadPromptSets(), next];
    setPromptSets(list);
    savePromptSets(list);
    setEditingPromptSet(next);
  };

  const copyPromptSet = () => {
    if (!editingPromptSet) return;
    const id = `ps-${Date.now()}`;
    const next: PromptSet = {
      ...editingPromptSet,
      id,
      name: `${editingPromptSet.name} 副本`,
      createdAt: new Date().toISOString(),
    };
    const list = [...loadPromptSets(), next];
    setPromptSets(list);
    savePromptSets(list);
    setEditingPromptSet(next);
  };

  const removePromptSet = () => {
    if (!editingPromptSet || editingPromptSet.id === "default") return;
    const list = loadPromptSets().filter((s) => s.id !== editingPromptSet.id);
    setPromptSets(list);
    savePromptSets(list);
    if (promptSetId === editingPromptSet.id) usePromptSet("default");
    setEditingPromptSet({ ...getPromptSet("default") });
    messageApi.success("已删除提示词套件");
  };

  const resetEditingPromptSet = () => {
    // 把当前套件的内容恢复为默认内容，但保留当前套件（不会误改「默认」套件）
    setEditingPromptSet((d) => {
      const def = getPromptSet("default");
      return d
        ? {
            ...d,
            outlineSystem: def.outlineSystem,
            outlineUser: def.outlineUser,
            stickerSystem: def.stickerSystem,
            stickerUser: def.stickerUser,
          }
        : d;
    });
  };

  const generate = async (sourceText?: string) => {
    if (generation.isRunning()) return false;
    const src = sanitizeSourceText((sourceText ?? topic).trim());
    if (looksLikePrompt(src)) {
      generation.fail(new Error("输入内容看起来像提示词/指令，请在「提示词管理」里配置人设提示词；输入框请粘贴文章素材或主题"));
      messageApi.warning({content:"输入内容看起来像提示词/指令，请在「提示词管理」里配置人设提示词；输入框请粘贴文章素材或主题",key:GENERATION_TOAST_KEY});
      return;
    }
    if (!src) {
      generation.fail(new Error("请先输入文章主题"));
      messageApi.warning({content:"请先输入文章主题",key:GENERATION_TOAST_KEY});
      return;
    }
    if (sourceText) setTopic(sourceText.trim());
    if (!window.wangaohui) {
      generation.fail(new Error("请在桌面应用中使用内容生成"));
      messageApi.error({content:"请在桌面应用中使用内容生成",key:GENERATION_TOAST_KEY});
      return;
    }
    setContentType("article");
    if (!generation.begin("正在生成中文正文，仅调用一次模型；排版在本机完成。")) return false;
    setGenerating(true);
    setFlow({ outline: "pending", article: "active", layout: "pending" });
    try {
      const prompt=getPromptSet(promptSetId);
      const writingReference=isDefaultPromptSet(prompt)?'':`${prompt.outlineSystem}\n${prompt.outlineUser.replace(/\{topic\}/g,'原始素材见下文').replace(/\{style\}/g,style).replace(/\{words\}/g,words).replace(/\{templateNote\}/g,'结构与标题层级适合排版').replace(/\{tagNote\}/g,'配图由本机处理')}`;
      const result = await window.wangaohui.generateArticle({
        requestId:generation.requestId(),
        sourceText:src,
        words,
        writingReference,
        audience:'关注职场、关系和自我成长的成年读者',
        category:style,
      });
      generation.assertActive();
      if (!result.ok || !result.chinese) {
        throw generationError(result, "生成失败，请检查 AI 配置");
      }
      const rblocks = result.blocks;
      const structured = Array.isArray(rblocks) && rblocks.length > 0;
      const blocks = structured
        ? rblocks.map((b) => ({
            id: `b${nextParseUid()}`,
            type: b.type as BlockType,
            text: b.text,
            items: b.items,
            src: b.src,
          }))
        : parseArticle(result.chinese);
      let finalBlocks = blocks;
      const outlineText=blocks.filter(block=>block.type==='title'||block.type==='h2').map(block=>block.text||'').join('\n');
      setOutline(outlineText||'正文已直接生成，无单独的大纲调用。');
      setFlow({ outline: "done", article: "done", layout: "active" });
      generation.progress("正文已完成，正在本地排版与配图，不再调用模型。");
      let imageWarning = "";
      if (imgMode !== "none") {
        try {
          finalBlocks = await attachImages(finalBlocks, outlineText);
        } catch (err) {
          imageWarning = `配图失败：${err instanceof Error ? err.message : String(err)}，可在编辑页补充图片。`;
          messageApi.error({content:imageWarning,key:GENERATION_TOAST_KEY});
        }
      }
      generation.assertActive();
      finalBlocks = finalBlocks.map((b) =>
        b.type === "title"
          ? { ...b, text: normalizeTitleText(b.text || "") }
          : b.text
            ? { ...b, text: cleanLabelPrefix(b.text) }
            : b,
      );
      // 生成阶段：把正文开头重复的标题行提升为标题，并删除正文中的重复段
      finalBlocks = promoteFirstTitle(finalBlocks);
      if (finalBlocks.length > 0) resetDocument(finalBlocks);
      const title =
        normalizeTitleText(
          finalBlocks.find((b) => b.type === "title")?.text || "",
        ) || topic;
      saveArticleHistoryItem({
        id: newUid("art"),
        title: title || topic,
        time: new Date().toISOString(),
        tag: style,
        templateId: template.id,
        blocks: finalBlocks as unknown as StoredBlock[],
        status: "待发布",
      });
      // 自动加入发布中心待发布队列，生成记录里未发布的文章在「内容发布」可见
      const bodyBlocks = finalBlocks.filter((b) => b.type !== "title");
      const queueHtml = buildInlineHtml(
        bodyBlocks,
        effective,
        currentAccent,
        liveOverrides,
      );
      const queueText = bodyBlocks
        .map((b) => b.text || (b.items ? b.items.join("\n") : ""))
        .filter(Boolean)
        .join("\n\n");
      const alreadyQueued = listQueue().some(
        (q) =>
          q.title === title && q.platform === "公众号" && q.status === "待发布",
      );
      if (!alreadyQueued) {
        saveDraft({
          id: newUid("draft"),
          platform: "公众号",
          title,
          content: queueText,
          html: queueHtml,
          templateId: template.id,
          status: "待发布",
          createdAt: new Date().toISOString(),
        });
        saveQueueItem({
          id: newUid("pub"),
          platform: "公众号",
          account,
          title,
          status: "待发布",
          createdAt: new Date().toISOString(),
        });
      }
      setHistory(loadArticleHistory());
      setGenerated(true);
      setFlow({ outline: "done", article: "done", layout: "done" });
      const imgCount = finalBlocks.filter((b) => b.type === "image").length;
      const completedMessage = `${structured ? "文章生成完成，已本地排版" : "文章生成完成"}${imgCount ? `，已插入 ${imgCount} 张配图` : ""}${imageWarning ? `。${imageWarning}` : ""}`;
      generation.succeed(completedMessage);
      messageApi.success({content:completedMessage,key:GENERATION_TOAST_KEY});
      return true;
    } catch (err) {
      generation.fail(err);
      setFlow((prev) => {
        const next = { ...prev };
        (Object.keys(next) as Array<"outline" | "article" | "layout">).forEach(
          (k) => {
            if (next[k] === "active") next[k] = "error";
          },
        );
        return next;
      });
      messageApi.error({content:`生成失败：${err instanceof Error ? err.message : String(err)}`,key:GENERATION_TOAST_KEY});
    } finally {
      setGenerating(false);
      generation.finish();
    }
  };

  useEffect(() => {
    if (!pendingArticle) return;
    const text =
      `${pendingArticle.title}\n${pendingArticle.content || ""}`.trim();
    if (text) setTopic(text);
    if (pendingArticle.images?.length) setPendingImages(pendingArticle.images);
    onConsumePending?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingArticle]);

  return {
    removeAiText,
    adoptRemoveAi,
    contextHolder,
    topic,
    setTopic,
    contentType,
    setContentType,
    imgMode,
    setImgMode,
    autoImgCount,
    setAutoImgCount,
    flow,
    setFlowOpen,
    pickImages,
    uploadImgs,
    setUploadImgs,
    stickerWords,
    setStickerWords,
    customWords,
    words,
    setCustomWords,
    setWords,
    promptSetId,
    usePromptSet,
    promptSets,
    openPromptMgr,
    generating,
    generationFeedback: generation.feedback,
    stopGeneration: generation.stop,
    dismissGenerationFeedback: generation.dismiss,
    generateSticker,
    generate,
    tplCat,
    setTplCat,
    visibleTemplates,
    tplCustom,
    themeOverrides,
    templateId,
    setTemplateId,
    setTplPreview,
    toggleFav,
    favorites,
    removeCustomTemplate,
    currentAccent,
    setAccent,
    isCustom,
    resetAccent,
    effective,
    openGenerator,
    openCoverDesign,
    coverCat,
    setCoverCat,
    visibleCoverTemplates,
    coverTplId,
    setCoverTplId,
    stickerTitleText,
    removeCoverTemplate,
    coverTpl,
    generated,
    setStickerPreviewIdx,
    setStickerPreviewOpen,
    setPreviewOpen,
    copyToGzh,
    addBlock,
    openPushModal,
    paperStyle,
    blocks,
    uploadImage,
    editingId,
    editValue,
    setEditValue,
    saveEdit,
    undoEdit,
    redoEdit,
    canUndoEdit: canUndo || hasPendingEdit,
    canRedoEdit: canRedo && !hasPendingEdit,
    cancelEdit,
    startEdit,
    removeBlock,
    insertAfter,
    coverRenderRef,
    renderStickerCards,
    renderingCover,
    liveOverrides,
    history,
    setHistory,
    messageApi,
    loadArticle,
    previewOpen,
    darkPreview,
    setDarkPreview,
    stickerPreviewOpen,
    stickerImageBlocks,
    stickerPreviewIdx,
    stickerText,
    tplPreview,
    genOpen,
    setGenOpen,
    resetGen,
    genName,
    setGenName,
    saveAsTemplate,
    applyGen,
    genDraft,
    setGenDraft,
    libOpen,
    libSelectedIds,
    setLibOpen,
    handleLibraryConfirm,
    flowOpen,
    outline,
    template,
    promptMgrOpen,
    setPromptMgrOpen,
    editingPromptSet,
    setEditingPromptSet,
    addPromptSet,
    copyPromptSet,
    removePromptSet,
    patchEditingPromptSet,
    saveEditingPromptSet,
    resetEditingPromptSet,
    pushMode,
    pushOpen,
    setPushOpen,
    confirmPush,
    pushLoading,
    pushPlatform,
    setPushPlatform,
    setPushAccountId,
    setPushMode,
    pushAccountId,
    pushWechatUsername,
    setPushWechatUsername,
    coverDesignEditingId,
    coverDesignOpen,
    setCoverDesignOpen,
    coverDesign,
    coverDesignName,
    setCoverDesignName,
    patchCoverDesign,
    coverColor,
    pickCoverImage,
    patchCoverZone,
    setCoverDesign,
    patchCardZone,
    saveCoverDesign,
    bodyCardList,
    bodyCardRefs,
  };
}
