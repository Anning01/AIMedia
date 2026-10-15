import { message } from "@/components/shared/controls";
import { imageStyleById } from "@/data/imageStyles";
import type {
NoteHistoryItem,
ProductItem,
QueueItem,
StyleAssetItem,
} from "@/data/localStore";
import {
addUsage,
listAccounts,
listNoteHistory,
listProducts,
listStyleAssets,
loadAppSettings,
removeProduct,
removeStyleAsset,
saveAsset,
saveNoteHistory,
saveProduct,
saveQueueItem,
saveStyleAsset,
uid,
} from "@/data/localStore";
import { fillTemplateText,NOTE_TEMPLATES } from "@/data/noteTemplates";
import { isDataUrl,saveImage } from "@/utils/imageStore";
import {
renderComposeCard,
renderProductCard,
} from "@/utils/renderProductCard";
import { useMemo,useRef,useState } from "react";
import {
compressImageDataUrl,
NoteCandidate,
ParseReport,
PRICES,
VisionItem,
} from "./model";

export function useNoteStudio() {
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [report, setReport] = useState<ParseReport | null>(null);
  const [link, setLink] = useState(
    "https://www.xiaohongshu.com/explore/66a8f3c1",
  );
  const [pasteText, setPasteText] = useState("");
  const [entryMode, setEntryMode] = useState<"parse" | "asset">("parse");
  const [tick, setTick] = useState(0);
  const [productId, setProductId] = useState(() => listProducts()[0]?.id || "");
  const [styleAssetId, setStyleAssetId] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productLibraryOpen, setProductLibraryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(
    null,
  );
  const [prodName, setProdName] = useState("");
  const [prodPoints, setProdPoints] = useState("");
  const [prodAudience, setProdAudience] = useState("");
  const [prodPrice, setProdPrice] = useState(39);
  const [prodMainImage, setProdMainImage] = useState("");
  const [prodSceneImages, setProdSceneImages] = useState<string[]>([]);
  const [prodAppearance, setProdAppearance] = useState("");
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [styleSaveOpen, setStyleSaveOpen] = useState(false);
  const [styleName, setStyleName] = useState("");
  const [candIndex, setCandIndex] = useState(0);
  const [candidates, setCandidates] = useState<NoteCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editParas, setEditParas] = useState("");
  const [genMode, setGenMode] = useState<"template" | "compose" | "upload">(
    "template",
  );
  const [tier, setTier] = useState("mid");
  const [retries, setRetries] = useState(1);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgDone, setImgDone] = useState(false);
  const [imgError, setImgError] = useState("");
  const [slotImages, setSlotImages] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [currentHistoryId, setCurrentHistoryId] = useState("");
  const [pubAccount, setPubAccount] = useState(() => {
    const a = listAccounts().find((x) => x.platform === "小红书" && x.cookie);
    return a?.name || "";
  });
  const [pubMode, setPubMode] = useState("定时发布");
  const [pubTime, setPubTime] = useState("10:00");
  const [aiMark, setAiMark] = useState(true);
  const [published, setPublished] = useState(false);
  const [pubMsg, setPubMsg] = useState("");
  const [fetchedNote, setFetchedNote] = useState<XhsNote | null>(null);
  const [xhsAccounts] = useState(() =>
    listAccounts().filter((a) => a.platform === "小红书" && a.cookie),
  );
  const [fetchAccountId, setFetchAccountId] = useState(
    () =>
      listAccounts().find((a) => a.platform === "小红书" && a.cookie)?.id || "",
  );
  const [importing, setImporting] = useState(false);
  const [refImageMap, setRefImageMap] = useState<Record<string, string>>({});
  const [previewImgState, setPreviewImgState] = useState<
    "idle" | "loading" | "done" | "partial" | "failed"
  >("idle");
  const [previewImgError, setPreviewImgError] = useState("");
  const [visionState, setVisionState] = useState<
    "idle" | "analyzing" | "done" | "failed"
  >("idle");
  const [visionError, setVisionError] = useState("");
  const [visionItems, setVisionItems] = useState<VisionItem[]>([]);
  const [imgProgress, setImgProgress] = useState(0);
  const [cutoutSrc, setCutoutSrc] = useState<"main" | "scene" | "custom">(
    "main",
  );
  const [customCutoutImg, setCustomCutoutImg] = useState("");
  const [cutoutDataUrl, setCutoutDataUrl] = useState("");
  const [cutoutLoading, setCutoutLoading] = useState(false);
  const [selectedTpls, setSelectedTpls] = useState<string[]>([
    NOTE_TEMPLATES[0].id,
    NOTE_TEMPLATES[1].id,
  ]);
  const [lastCutoutSrc, setLastCutoutSrc] = useState("");
  const [overallStyle, setOverallStyle] = useState("");
  const visionPromiseRef = useRef<Promise<void> | null>(null);
  const [phoneMode, setPhoneMode] = useState<"src" | "gen">("gen");
  const [messageApi, contextHolder] = message.useMessage();

  const products = useMemo(() => listProducts(), [tick]);
  const styleAssets = useMemo(() => listStyleAssets(), [tick]);
  const currentProduct = products.find((p) => p.id === productId) || null;
  const product = currentProduct?.name || "";
  const points = currentProduct?.points || "";
  const audience = currentProduct?.audience || "";
  const price = currentProduct?.price || 0;
  const selectedStyle = styleAssets.find((s) => s.id === styleAssetId) || null;

  const isSrcPreview = phoneMode === "src" && !!fetchedNote;
  const previewImages = useMemo(() => {
    if (isSrcPreview && fetchedNote) {
      const vals = Object.values(refImageMap);
      return vals.length ? vals : fetchedNote.images.slice(0, 9);
    }
    const gen = Object.values(slotImages).filter(Boolean);
    if (gen.length) return gen;
    if (fetchedNote) {
      const vals = Object.values(refImageMap);
      if (vals.length) return vals;
    }
    if (currentProduct?.mainImage) return [currentProduct.mainImage];
    return [];
  }, [isSrcPreview, fetchedNote, refImageMap, slotImages, currentProduct]);
  const previewTitle = isSrcPreview
    ? fetchedNote?.title || ""
    : candidates[candIndex]?.title ||
      fetchedNote?.title ||
      product ||
      "你的爆款笔记";
  const imgProviderTag = (() => {
    const s = loadAppSettings();
    return s.noteImageGenProvider === "seedream"
      ? { label: "Seedream · 参考图生图", color: "purple" as const }
      : { label: "MiniMax · 文生图", color: "blue" as const };
  })();
  const refImageList = Object.values(refImageMap).filter(Boolean);
  const previewParas = isSrcPreview
    ? (fetchedNote?.desc || "")
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : candidates[candIndex]?.paras || [];
  const previewTags = isSrcPreview
    ? fetchedNote?.tags || []
    : candidates[candIndex]?.tags || [];
  const previewAuthor = isSrcPreview
    ? fetchedNote?.author?.nickname || "小红书用户"
    : fetchedNote?.author?.nickname || "种草小助手";
  const previewAvatar = isSrcPreview ? fetchedNote?.author?.avatar || "" : "";
  const previewLiked = isSrcPreview ? fetchedNote?.interact?.likedCount : "";
  const previewCollected = isSrcPreview
    ? fetchedNote?.interact?.collectedCount
    : "";
  const previewComment = isSrcPreview
    ? fetchedNote?.interact?.commentCount
    : "";

  const reset = () => {
    setStep(0);
    setParsed(false);
    setReport(null);
    setCandidates([]);
    setImgDone(false);
    setImgError("");
    setSlotImages({});
    setPublished(false);
    setPasteText("");
    setFetchedNote(null);
    setRefImageMap({});
    setPreviewImgState("idle");
    setPreviewImgError("");
    setVisionState("idle");
    setVisionError("");
    setVisionItems([]);
    setOverallStyle("");
    setImgProgress(0);
    setCurrentHistoryId("");
    setCutoutDataUrl("");
    setLastCutoutSrc("");
    setCustomCutoutImg("");
    visionPromiseRef.current = null;
  };

  const nextImgKey = (prev: Record<string, string>) => {
    let max = -1;
    for (const k of Object.keys(prev)) {
      const n = Number(k.replace(/^img-/, ""));
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `img-${max + 1}`;
  };

  const addUploadImages = (imgs: string[]) => {
    setSlotImages((prev) => {
      const next = { ...prev };
      for (const d of imgs) next[nextImgKey(next)] = d;
      return next;
    });
  };

  const uploadForSlot = async (id?: string) => {
    if (!window.wangaohui) {
      messageApi.error("请通过桌面应用运行后再上传图片");
      return;
    }
    const r = await window.wangaohui.selectImage();
    if (!r?.ok || !r.dataUrl) return;
    try {
      const dataUrl = await compressImageDataUrl(r.dataUrl, 900, 0.88);
      if (id) setSlotImages((prev) => ({ ...prev, [id]: dataUrl }));
      else addUploadImages([dataUrl]);
    } catch {
      if (id) setSlotImages((prev) => ({ ...prev, [id]: r.dataUrl || "" }));
      else addUploadImages([r.dataUrl || ""]);
    }
    setImgDone(false);
    setImgError("");
  };

  const batchUpload = async () => {
    if (!window.wangaohui) {
      messageApi.error("请通过桌面应用运行后再上传图片");
      return;
    }
    const r = await window.wangaohui.selectImages({ max: 9 });
    if (!r?.ok || !r.images?.length) return;
    addUploadImages(r.images.map((img) => img.dataUrl).filter(Boolean));
    setImgDone(false);
    setImgError("");
    messageApi.success(`已添加 ${r.images.length} 张图片`);
  };

  const getCutoutSource = (): string => {
    if (cutoutSrc === "custom") return customCutoutImg;
    if (cutoutSrc === "scene") {
      return (
        currentProduct?.sceneImages?.[0] || currentProduct?.mainImage || ""
      );
    }
    return currentProduct?.mainImage || "";
  };

  const cutoutCurrentImage = async (): Promise<string> => {
    const src = getCutoutSource();
    if (!src) {
      throw new Error("请先在产品库选择产品，或上传一张产品图片");
    }
    if (cutoutDataUrl && src === lastCutoutSrc) return cutoutDataUrl;
    setCutoutLoading(true);
    try {
      const s = loadAppSettings();
      const r = await window.wangaohui?.cutoutImage({
        dataUrl: src,
        ak: s.noteCutoutAk,
        sk: s.noteCutoutSk,
      });
      if (!r?.ok || !r.dataUrl) throw new Error(r?.error || "抠图失败");
      setCutoutDataUrl(r.dataUrl);
      setLastCutoutSrc(src);
      return r.dataUrl;
    } finally {
      setCutoutLoading(false);
    }
  };

  const pickCustomCutout = async () => {
    if (!window.wangaohui) return;
    const r = await window.wangaohui.selectImage();
    if (!r?.ok || !r.dataUrl) return;
    try {
      const dataUrl = await compressImageDataUrl(r.dataUrl, 1400, 0.92);
      setCustomCutoutImg(dataUrl);
      setCutoutDataUrl("");
      setLastCutoutSrc("");
      setCutoutSrc("custom");
    } catch {
      setCustomCutoutImg(r.dataUrl || "");
    }
  };

  const toggleTpl = (id: string) => {
    setSelectedTpls((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setImgDone(false);
    setImgError("");
  };

  const runCutout = async () => {
    try {
      await cutoutCurrentImage();
      messageApi.success("抠图完成，产品已分离背景");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : String(err));
    }
  };

  const extractJson = (raw: string): unknown => {
    const cleaned = String(raw).trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("模型返回不是 JSON");
    let json = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(json);
    } catch {
      // 模型偶尔返回 JS 风格对象：属性名不带双引号 / 单引号 / 尾逗号
      json = json
        .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|[0-9]+)\s*:/g, '$1"$2":')
        .replace(/:\s*'((?:[^'\\]|\\.)*)'/g, ':"$1"')
        .replace(/(\[|,)\s*'((?:[^'\\]|\\.)*)'\s*(?=[,\]])/g, '$1"$2"')
        .replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(json);
    }
  };

  const cachePreviewImages = async (
    note: XhsNote,
    cookie: string,
  ): Promise<Record<string, string>> => {
    if (!note.images.length) return {};
    try {
      const r = await window.wangaohui?.downloadNoteImages({
        urls: note.images.slice(0, 9),
        cookie,
        referer: note.link,
      });
      if (!r?.ok) {
        setPreviewImgState("failed");
        setPreviewImgError(r?.error || "图片下载失败");
        return {};
      }
      const map: Record<string, string> = {};
      let okCount = 0;
      let failCount = 0;
      let firstError = "";
      for (const item of r.images || []) {
        if (item.ok && item.dataUrl && item.url) {
          map[item.url] = item.dataUrl;
          okCount += 1;
        } else {
          failCount += 1;
          if (!firstError) firstError = item.error || "下载失败";
        }
      }
      if (Object.keys(map).length) {
        setRefImageMap((prev) => ({ ...prev, ...map }));
        setPreviewImgState(failCount > 0 ? "partial" : "done");
      } else {
        setPreviewImgState("failed");
      }
      if (failCount > 0)
        setPreviewImgError(`有 ${failCount} 张原图下载失败：${firstError}`);
      else setPreviewImgError("");
      return map;
    } catch (err) {
      setPreviewImgState("failed");
      setPreviewImgError(err instanceof Error ? err.message : String(err));
      return {};
    }
  };

  const analyzeComposition = (map: Record<string, string>) => {
    const images = Object.values(map).slice(0, 9);
    if (!images.length) {
      setVisionState("failed");
      setVisionError("没有成功下载的爆款原图，无法进行视觉构图分析");
      return;
    }
    const promise = (async () => {
      setVisionState("analyzing");
      setVisionError("");
      setVisionItems([]);
      setOverallStyle("");
      try {
        const prepared: string[] = [];
        for (const dataUrl of images) {
          try {
            prepared.push(await compressImageDataUrl(dataUrl, 900, 0.85));
          } catch {
            prepared.push(dataUrl);
          }
        }
        const r = await window.wangaohui?.analyzeNoteImages({
          images: prepared,
        });
        if (!r?.ok) throw new Error(r?.error || "构图分析失败");
        const texts = (r.compositions || []).filter(Boolean);
        const metas = r.items || [];
        setOverallStyle(r.overallStyle || "");
        setVisionItems(
          prepared
            .map((dataUrl, i) => ({
              dataUrl,
              text: texts[i] || "",
              suggestSlot: metas[i]?.suggestSlot || "",
              borrow: metas[i]?.borrow || "",
              mustReplace: metas[i]?.mustReplace || "",
            }))
            .filter((v) => v.text),
        );
        setVisionState(texts.length ? "done" : "failed");
        if (!texts.length) setVisionError("构图分析未返回有效内容");
      } catch (err) {
        setVisionState("failed");
        setVisionError(err instanceof Error ? err.message : String(err));
      }
    })();
    visionPromiseRef.current = promise;
  };

  const startParse = async () => {
    const sourceText = pasteText.trim() || link.trim();
    if (!sourceText) {
      messageApi.warning("请先粘贴爆款链接或正文");
      return;
    }
    if (!currentProduct) {
      messageApi.warning("请先在产品库选择或创建一个产品");
      return;
    }
    const isXhsLink = /xiaohongshu\.com|xhslink\.com/i.test(sourceText);
    const cookie =
      xhsAccounts.find((a) => a.id === fetchAccountId)?.cookie ||
      xhsAccounts[0]?.cookie ||
      "";
    setParsing(true);
    try {
      let note: XhsNote | null = null;
      if (isXhsLink) {
        if (!cookie) {
          throw new Error(
            "读取小红书笔记需要登录状态：请先到「发布中心 → 账号管理」添加小红书账号并扫码登录。",
          );
        }
        const r = await window.wangaohui?.readNote({
          url: sourceText,
          cookie,
        });
        if (!r?.ok || !r.note) {
          throw new Error(r?.error || "读取小红书笔记失败");
        }
        note = r.note;
        setFetchedNote(note);
        setRefImageMap({});
        setPreviewImgState("loading");
        setPreviewImgError("");
      } else if (!pasteText.trim()) {
        throw new Error("请粘贴小红书笔记链接，或直接粘贴爆款正文");
      }

      const parseSource = note
        ? `标题：${note.title}\n\n正文：\n${note.desc}\n\n标签：${note.tags.join(" ")}\n\n配图数量：${note.images.length} 张`
        : sourceText;
      const llmPromise = window.wangaohui?.llmChat({
        provider: "deepseek",
        temperature: 0.2,
        system:
          "你是小红书爆款笔记拆解器。只拆解结构与风格，不输出原文、不搬运原文句子。只输出合法 JSON，不要任何解释文字。",
        user: `请拆解下面的爆款笔记，并输出 JSON：
{"angle":"选题角度一句话","titleFormula":"标题公式","style":"图片风格描述","composition":"图片构图与风格思路（构图方式、主体位置、光线、色调、场景氛围，用于AI配图参考）","structure":["正文结构步骤1","..."],"emotionWords":["情绪词"],"tags":["#标签"]}

我的产品：${product}（卖点：${points}，目标人群：${audience}，客单价 ${price} 元）

爆款来源：
---开始---
${parseSource}
---结束---`,
      });
      const imgPromise = note
        ? (async () => {
            const map = await cachePreviewImages(note, cookie);
            if (Object.keys(map).length) analyzeComposition(map);
          })()
        : Promise.resolve();
      const r = await llmPromise;
      if (!r?.ok || !r.reply) throw new Error(r?.error || "解析失败");
      const data = extractJson(r.reply) as ParseReport;
      if (!data || !Array.isArray(data.structure))
        throw new Error("解析结果结构异常");
      setReport({
        angle: data.angle || "",
        titleFormula: data.titleFormula || "",
        style: data.style || "",
        composition: data.composition || "",
        structure: data.structure || [],
        emotionWords: data.emotionWords || [],
        tags: data.tags || [],
      });
      setParsed(true);
      messageApi.success(
        note
          ? `已读取《${note.title.slice(0, 14)}》并完成拆解`
          : "爆款笔记解析完成，已提炼结构与风格",
      );
      await imgPromise.catch(() => {});
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  };

  const importNoteImages = async () => {
    const note = fetchedNote;
    if (!note || !note.images.length) return;
    setImporting(true);
    try {
      const cookie =
        xhsAccounts.find((a) => a.id === fetchAccountId)?.cookie ||
        xhsAccounts[0]?.cookie ||
        "";
      const r = await window.wangaohui?.downloadNoteImages({
        urls: note.images,
        cookie,
        referer: note.link,
      });
      if (!r?.ok) throw new Error(r?.error || "下载爆款原图失败");
      const okItems = (r.images || []).filter((x) => x.ok && x.dataUrl);
      const failed = (r.images || []).filter((x) => !x.ok);
      if (!okItems.length) {
        throw new Error(
          failed[0]?.error
            ? `图片下载失败：${failed[0].error}`
            : "没有可导入的图片",
        );
      }
      const map: Record<string, string> = {};
      let savedCount = 0;
      for (const item of okItems) {
        if (!item.url || !item.dataUrl) continue;
        map[item.url] = item.dataUrl;
        try {
          saveAsset({
            id: uid("asset"),
            kind: "图片",
            name: `爆款原图 · ${note.title.slice(0, 12)} ${okItems.indexOf(item) + 1}`,
            dataUrl: item.dataUrl,
            tags: ["爆款参考", "小红书"],
            createdAt: new Date().toISOString(),
          });
          savedCount += 1;
        } catch {
          break;
        }
      }
      setRefImageMap((prev) => ({ ...prev, ...map }));
      messageApi.success(
        `已存入 ${savedCount} 张爆款原图到图片库${okItems.length > savedCount ? `，${okItems.length - savedCount} 张因本地空间不足未入库` : ""}${failed.length ? `，${failed.length} 张下载失败` : ""}`,
      );
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const refreshData = () => setTick((x) => x + 1);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProdName("");
    setProdPoints("");
    setProdAudience("");
    setProdPrice(39);
    setProdMainImage("");
    setProdSceneImages([]);
    setProdAppearance("");
    setProductModalOpen(true);
  };

  const openEditProduct = (p: ProductItem) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPoints(p.points);
    setProdAudience(p.audience);
    setProdPrice(p.price);
    setProdMainImage(p.mainImage || "");
    setProdSceneImages(p.sceneImages || []);
    setProdAppearance(p.appearance || "");
    setProductModalOpen(true);
  };

  const uploadMainImage = async () => {
    const r = await window.wangaohui?.selectImage();
    if (!r?.ok || !r.dataUrl) {
      if (!r?.canceled) messageApi.error(r?.error || "选择主图失败");
      return;
    }
    try {
      const compressed = await compressImageDataUrl(r.dataUrl, 1000, 0.85);
      setProdMainImage(compressed);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : String(err));
    }
  };

  const uploadSceneImages = async () => {
    const r = await window.wangaohui?.selectImages();
    if (!r?.ok || !r.images?.length) {
      if (!r?.canceled) messageApi.error(r?.error || "选择场景图失败");
      return;
    }
    const compressed: string[] = [];
    for (const item of r.images) {
      try {
        compressed.push(await compressImageDataUrl(item.dataUrl, 1000, 0.85));
      } catch {
        /* skip bad image */
      }
    }
    setProdSceneImages((prev) => [...prev, ...compressed].slice(0, 3));
  };

  const submitProduct = () => {
    if (!prodName.trim()) {
      messageApi.warning("请填写产品名称");
      return;
    }
    if (!prodMainImage) {
      messageApi.warning("产品必须上传一张主图");
      return;
    }
    const id = editingProduct?.id || uid("prod");
    saveProduct({
      id,
      name: prodName.trim(),
      points: prodPoints.trim(),
      audience: prodAudience.trim() || "通用人群",
      price: prodPrice || 0,
      mainImage: prodMainImage,
      sceneImages: prodSceneImages,
      appearance:
        prodAppearance.trim() ||
        `${prodName.trim()}${prodPoints.trim() ? `，主打${prodPoints.trim()}` : ""}`,
      createdAt: editingProduct?.createdAt || new Date().toISOString(),
    });
    setProductId(id);
    setProductModalOpen(false);
    refreshData();
    messageApi.success(editingProduct ? "产品已更新" : "产品已加入产品库");
  };

  const removeProductItem = (id: string) => {
    removeProduct(id);
    if (productId === id) setProductId(listProducts()[0]?.id || "");
    refreshData();
    messageApi.success("产品已删除");
  };

  const styleToReport = (s: StyleAssetItem): ParseReport => ({
    angle: s.angle,
    titleFormula: s.titleFormula,
    style: s.style,
    composition: s.composition,
    structure: s.structure,
    emotionWords: s.emotionWords,
    tags: s.tags,
  });

  const openSaveStyle = async () => {
    if (visionPromiseRef.current) {
      await visionPromiseRef.current;
      visionPromiseRef.current = null;
    }
    if (!report) return;
    setStyleName(
      fetchedNote?.title
        ? `${fetchedNote.title.slice(0, 18)} · 风格`
        : "小红书爆款风格",
    );
    setStyleSaveOpen(true);
  };

  const submitStyleSave = () => {
    if (!report || !styleName.trim()) {
      messageApi.warning("请填写风格资产名称");
      return;
    }
    saveStyleAsset({
      id: uid("style"),
      name: styleName.trim(),
      sourceTitle: fetchedNote?.title || "未命名爆款",
      sourceLink: fetchedNote?.link || link,
      angle: report.angle,
      titleFormula: report.titleFormula,
      style: report.style,
      composition: report.composition,
      compositions: visionItems.map((v) => v.text),
      visionMeta: visionItems.map((v) => ({
        suggestSlot: v.suggestSlot,
        borrow: v.borrow,
        mustReplace: v.mustReplace,
      })),
      refImages: Object.values(refImageMap).filter(Boolean).slice(0, 9),
      overallStyle,
      structure: report.structure,
      emotionWords: report.emotionWords,
      tags: report.tags,
      createdAt: new Date().toISOString(),
    });
    setStyleSaveOpen(false);
    refreshData();
    messageApi.success("风格已保存到资产库");
  };

  const useStyleAsset = (s: StyleAssetItem) => {
    setStyleAssetId(s.id);
    setEntryMode("asset");
    setReport(styleToReport(s));
    setParsed(true);
    setFetchedNote(null);
    const savedRefs = (s.refImages || []).filter(Boolean);
    setRefImageMap(
      savedRefs.length
        ? Object.fromEntries(savedRefs.map((d, i) => [`saved-${i}`, d]))
        : {},
    );
    setPreviewImgState("idle");
    setPreviewImgError("");
    const metas = s.visionMeta || [];
    setVisionItems(
      (s.compositions || []).map((text, i) => ({
        dataUrl: savedRefs[i] || "",
        text,
        suggestSlot: metas[i]?.suggestSlot,
        borrow: metas[i]?.borrow,
        mustReplace: metas[i]?.mustReplace,
      })),
    );
    setOverallStyle(s.overallStyle || "");
    setVisionState(s.compositions?.length ? "done" : "idle");
    setVisionError("");
    setStyleModalOpen(false);
    messageApi.success(`已选用风格「${s.name}」`);
  };

  const removeStyleItem = (id: string) => {
    removeStyleAsset(id);
    if (styleAssetId === id) setStyleAssetId("");
    refreshData();
    messageApi.success("风格资产已删除");
  };

  const totalCost =
    genMode === "template"
      ? selectedTpls.length * 0.05
      : genMode === "compose"
        ? refImageList.length * (PRICES[tier as keyof typeof PRICES] + 0.05)
        : 0;

  const genCandidates = async (reportOverride?: ParseReport) => {
    const rep = reportOverride || report;
    if (!currentProduct) {
      messageApi.warning("请先在产品库选择或创建一个产品");
      return;
    }
    setCandLoading(true);
    try {
      const r = await window.wangaohui?.llmChat({
        provider: "deepseek",
        temperature: 0.7,
        system:
          '你是小红书爆款笔记复刻写手。只输出 3 个候选笔记的 JSON，不输出解释。核心要求：借鉴爆款的选题角度和结构，但内容必须围绕用户自己的产品全新撰写，像真实博主分享，禁止 AI 腔。输出格式：{"candidates":[{"title":"...","paras":["...","..."],"tags":["#..."]}]}',
        user: `产品：${product}
核心卖点：${points}
目标人群：${audience}
客单价：${price} 元

爆款拆解报告（必须逐项使用，不能丢掉）：
- 选题角度：${rep?.angle || "无"}
- 标题公式：${rep?.titleFormula || "无"}（新标题必须按这个公式重写，不能照搬爆款原标题，也不能只是换词）
- 正文结构（每一段按对应意图写，可以换场景、换说法、换细节）：${(rep?.structure || []).map((s, i) => `${i + 1}. ${s}`).join("\n") || "无"}
- 情绪词（自然融入，不要堆砌）：${(rep?.emotionWords || []).join("、") || "无"}
- 推荐标签：${(rep?.tags || []).join(" ") || "无"}
- 图片风格与构图：${rep?.style || ""} ${rep?.composition || ""}

写作要求（必须严格遵守）：
1. 标题：短、有具体冲突或反常识细节，让人想点开；不要感叹号堆叠，不要「震惊」「必看」这类标题党词。
2. 正文：像真实用户在小红书分享亲身经历：口语化、短句、有具体细节和数字；第一段直接给钩子（场景/痛点/反常识结果）；中间写「我本来…后来…」的真实感过程；结尾行动号召自然，不要喊口号。
3. 禁止 AI 腔：不要「首先/其次/最后/总的来说/值得注意的是/不得不说/让我们」这类词；不要三段式排比；不要总结升华；不要书面语；全文最多 1-2 个 emoji。
4. 每篇 4-5 段，标签 4-5 个。
5. 严禁搬运爆款原文句子，只能借鉴角度和结构。

请生成 3 个不同角度的候选笔记。`,
      });
      if (!r?.ok || !r.reply) throw new Error(r?.error || "生成失败");
      const data = extractJson(r.reply) as { candidates?: NoteCandidate[] };
      const list = Array.isArray(data.candidates) ? data.candidates : [];
      if (!list.length) throw new Error("没有生成有效候选");
      if (reportOverride) setReport(reportOverride);
      setCandidates(list);
      setCandIndex(0);
      setEditing(false);
      setStep(1);
      messageApi.success(`已生成 ${list.length} 个候选角度`);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCandLoading(false);
    }
  };

  const startEdit = () => {
    const c = candidates[candIndex];
    if (!c) return;
    setEditTitle(c.title);
    setEditParas(c.paras.join("\n"));
    setEditing(true);
  };

  const saveEdit = () => {
    setCandidates(
      candidates.map((c, i) =>
        i === candIndex
          ? {
              ...c,
              title: editTitle.trim() || c.title,
              paras: editParas
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : c,
      ),
    );
    setEditing(false);
    messageApi.success("已保存手动修改");
  };

  const generateImages = async () => {
    if (visionPromiseRef.current) {
      await visionPromiseRef.current;
      visionPromiseRef.current = null;
    }
    const settings = loadAppSettings();
    const noteProvider = settings.noteImageGenProvider || "seedream";
    const noteKey = settings.noteImageGenKey || "";
    const noteBaseUrl =
      settings.noteImageGenBaseUrl ||
      "https://ark.cn-beijing.volces.com/api/v3/images/generations";
    const noteModel =
      settings.noteImageGenModel || "doubao-seedream-4-5-251128";
    setImgLoading(true);
    setImgError("");
    setImgProgress(0);

    if (genMode === "upload") {
      const count = Object.values(slotImages).filter(Boolean).length;
      setImgLoading(false);
      if (!count) {
        const msg = "还没有上传图片，请先添加至少 1 张图片";
        setImgError(msg);
        messageApi.error(msg);
        return;
      }
      setImgDone(true);
      addUsage("贴图");
      await updateCurrentHistoryImages(
        Object.values(slotImages).filter(Boolean),
      );
      messageApi.success(`已确认 ${count} 张用户上传图片`);
      return;
    }

    try {
      const results: Record<string, string> = {};

      if (genMode === "template") {
        if (!selectedTpls.length) throw new Error("请至少选择一个模板");
        const cut = await cutoutCurrentImage();
        let idx = 0;
        for (const tplId of selectedTpls) {
          const tpl = NOTE_TEMPLATES.find((t) => t.id === tplId);
          if (!tpl) continue;
          const filled = fillTemplateText(tpl, { product, points, price });
          results[`img-${idx}`] = await renderProductCard(filled, cut);
          idx += 1;
        }
        setSlotImages(results);
        setImgDone(true);
        addUsage("贴图");
        await updateCurrentHistoryImages(
          Object.values(results).filter(Boolean),
        );
        messageApi.success(`已渲染 ${idx} 张模板配图（真实产品抠图）`);
        return;
      }

      // compose：AI 生成场景背景（不含产品/人物），真实产品抠图合成
      const rawRefImages = Object.values(refImageMap).filter(Boolean);
      if (!rawRefImages.length) {
        throw new Error("请先解析爆款笔记并成功下载原图，才能生成场景背景");
      }
      if (!currentProduct?.mainImage) {
        throw new Error("请先在产品库给产品上传主图");
      }
      const refRefs: string[] = [];
      for (const d of rawRefImages.slice(0, 9)) {
        try {
          refRefs.push(await compressImageDataUrl(d, 1024, 0.88));
        } catch {
          refRefs.push(d);
        }
      }
      const cut = await cutoutCurrentImage();
      const stylePhrase = imageStyleById(settings.imageStyle).phrase;
      let done = 0;
      const runBg = async (i: number) => {
        const vis = visionItems[i];
        const borrowRef = vis?.borrow
          ? `可借鉴构图：${vis.borrow}`
          : vis?.text
            ? `可借鉴构图：${vis.text}`
            : report?.composition ||
              report?.style ||
              "主体突出、画面简洁、信息层次清晰";
        const bgPrompt = `小红书笔记第 ${i + 1} 张配图背景（竖版 3:4）：只借鉴第一张参考图的构图布局、景别、机位角度、光线方向、色调关系和场景氛围：${borrowRef}；但不要复用参考图中的任何具体物品、人物、文字、水印、logo、二维码、小红书界面、博主信息；画面中不要出现任何产品、人物；主体位置留出干净空白或柔和虚化区域，方便后期放入产品。整体风格：${stylePhrase}。`;
        const r = await window.wangaohui?.generateImage({
          provider: "seedream",
          apiKey: noteKey,
          baseUrl: noteBaseUrl,
          model: noteModel,
          prompt: bgPrompt,
          size: "3:4",
          count: 1,
          referenceImages: [refRefs[i]],
        });
        if (!r?.ok || !r.images?.length) {
          throw new Error(r?.error || `第 ${i + 1} 张背景生成失败`);
        }
        const composed = await renderComposeCard(r.images[0], cut, {
          x: 0.16,
          y: 0.32,
          w: 0.68,
          h: 0.5,
        });
        results[`img-${i}`] = composed;
        done += 1;
        setImgProgress(done);
        saveAsset({
          id: uid("asset"),
          kind: "图片",
          name: `场景合成图 ${i + 1} · 对应爆款图 ${i + 1}`,
          dataUrl: composed,
          tags: ["AI生成", "产品合成"],
          createdAt: new Date().toISOString(),
        });
      };
      for (let i = 0; i < refRefs.length; i += 2) {
        const batch: Array<Promise<void>> = [];
        for (let j = i; j < Math.min(i + 2, refRefs.length); j += 1)
          batch.push(runBg(j));
        const settled = await Promise.allSettled(batch);
        const failed = settled.find((s) => s.status === "rejected");
        if (failed && failed.status === "rejected") {
          throw failed.reason instanceof Error
            ? failed.reason
            : new Error(String(failed.reason));
        }
      }
      setSlotImages(results);
      setImgDone(true);
      addUsage("贴图");
      await updateCurrentHistoryImages(Object.values(results).filter(Boolean));
      messageApi.success(
        `已生成 ${refRefs.length} 张场景合成图（真实产品 + AI 背景）`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImgError(msg);
      messageApi.error(msg);
    } finally {
      setImgLoading(false);
      setImgProgress(0);
    }
  };

  const publish = async () => {
    if (!pubAccount) {
      messageApi.warning("请先在「发布中心 → 账号管理」登录小红书账号");
      return;
    }
    const cand = candidates[candIndex] || {
      title: "未命名笔记",
      paras: [],
      tags: [],
    };
    const content = [cand.title, ...cand.paras, cand.tags.join(" ")].join(
      "\n\n",
    );
    const settings = loadAppSettings();
    const item: QueueItem = {
      id: uid("pub"),
      platform: "小红书",
      account: pubAccount,
      title: cand.title,
      status: "待发布",
      scheduledAt: pubMode === "定时发布" ? `今天 ${pubTime}` : undefined,
      createdAt: new Date().toISOString(),
    };
    let msg = `已加入发布队列：${cand.title}`;
    let ok = true;
    if (pubMode === "立即发布") {
      if (!settings.publishEndpoint) {
        msg = "未配置发布接口，已加入本地队列，配置后可在发布中心重试";
        ok = false;
      } else {
        const r = await window.wangaohui?.publishArticle({
          endpoint: settings.publishEndpoint,
          token: settings.publishToken,
          platform: "小红书",
          account: pubAccount,
          title: cand.title,
          content,
          contentType: "text",
        });
        if (r?.ok) {
          item.status = "已发布";
          msg = `已发布到「${pubAccount}」`;
        } else {
          item.status = "失败";
          item.error = r?.error || "发布失败";
          msg = `发布失败：${item.error}`;
          ok = false;
        }
      }
    }
    saveQueueItem(item);
    addUsage("发布");
    setPubMsg(msg);
    setPublished(true);
    if (ok) messageApi.success(msg);
    else messageApi.warning(msg);
  };

  const persistHistoryImages = async (images: string[]): Promise<string[]> => {
    const out: string[] = [];
    for (const src of images) {
      if (isDataUrl(src)) {
        try {
          out.push(await saveImage(src, "history"));
        } catch {
          out.push(src);
        }
      } else {
        out.push(src);
      }
    }
    return out;
  };

  const saveCurrentHistory = async (images?: string[]) => {
    const cand = candidates[candIndex];
    if (!cand || !currentProduct) return;
    const now = new Date().toISOString();
    const existing = currentHistoryId
      ? listNoteHistory().find((h) => h.id === currentHistoryId)
      : undefined;
    const item: NoteHistoryItem = {
      id: existing?.id || currentHistoryId || uid("note"),
      title: cand.title,
      paras: cand.paras,
      tags: cand.tags,
      productId: currentProduct.id,
      productName: currentProduct.name,
      sourceTitle: fetchedNote?.title,
      sourceLink: fetchedNote?.link || link,
      images: images || existing?.images || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    item.images = await persistHistoryImages(item.images);
    saveNoteHistory(item);
    setCurrentHistoryId(item.id);
    setHistoryTick((t) => t + 1);
  };

  const updateCurrentHistoryImages = async (images: string[]) => {
    if (!currentHistoryId || !images.length) return;
    const compressed: string[] = [];
    for (const d of images.slice(0, 9)) {
      try {
        compressed.push(await compressImageDataUrl(d, 640, 0.78));
      } catch {
        compressed.push(d);
      }
    }
    const list = listNoteHistory();
    const idx = list.findIndex((h) => h.id === currentHistoryId);
    if (idx < 0) return;
    const item = {
      ...list[idx],
      images: await persistHistoryImages(compressed),
      updatedAt: new Date().toISOString(),
    };
    saveNoteHistory(item);
    setHistoryTick((t) => t + 1);
  };

  const selectCandidate = async (i: number) => {
    setCandIndex(i);
    setEditing(false);
    const cand = candidates[i];
    if (cand && currentProduct) {
      const now = new Date().toISOString();
      const existing = currentHistoryId
        ? listNoteHistory().find((h) => h.id === currentHistoryId)
        : undefined;
      const item: NoteHistoryItem = {
        id: existing?.id || uid("note"),
        title: cand.title,
        paras: cand.paras,
        tags: cand.tags,
        productId: currentProduct.id,
        productName: currentProduct.name,
        sourceTitle: fetchedNote?.title,
        sourceLink: fetchedNote?.link || link,
        images: existing?.images || [],
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      item.images = await persistHistoryImages(item.images);
      saveNoteHistory(item);
      setCurrentHistoryId(item.id);
      setHistoryTick((t) => t + 1);
    }
    messageApi.success(`已采纳候选 ${i + 1}，进入配图`);
    setStep(2);
  };

  const loadHistory = (h: NoteHistoryItem) => {
    setHistoryOpen(false);
    const stillExists = listProducts().some((p) => p.id === h.productId);
    setCandidates([{ title: h.title, paras: h.paras, tags: h.tags }]);
    setCandIndex(0);
    setEditing(false);
    setSlotImages(Object.fromEntries(h.images.map((d, i) => [`img-${i}`, d])));
    setCurrentHistoryId(h.id);
    setImgDone(h.images.length > 0);
    setStep(h.images.length ? 2 : 1);
    if (stillExists) {
      setProductId(h.productId);
    } else {
      setProductId("");
    }
    refreshData();
    messageApi.success(
      stillExists
        ? "已载入历史笔记，可继续生成配图或发布"
        : "已载入历史笔记，但原产品已被删除，请重新选择产品",
    );
  };

  const publishAgain = () => {
    reset();
  };

  return {
    contextHolder,
    currentProduct,
    product,
    setHistoryOpen,
    step,
    refImageList,
    entryMode,
    setEntryMode,
    productId,
    setProductId,
    products,
    openAddProduct,
    setProductLibraryOpen,
    link,
    setLink,
    fetchAccountId,
    setFetchAccountId,
    xhsAccounts,
    pasteText,
    setPasteText,
    parsing,
    startParse,
    styleAssetId,
    setStyleAssetId,
    styleAssets,
    setStyleModalOpen,
    candLoading,
    selectedStyle,
    genCandidates,
    styleToReport,
    parsed,
    fetchedNote,
    importing,
    importNoteImages,
    previewImgState,
    previewImgError,
    refImageMap,
    visionState,
    visionError,
    analyzeComposition,
    visionItems,
    overallStyle,
    report,
    openSaveStyle,
    candidates,
    candIndex,
    setCandIndex,
    editing,
    editTitle,
    setEditTitle,
    editParas,
    setEditParas,
    saveEdit,
    setEditing,
    selectCandidate,
    startEdit,
    genMode,
    selectedTpls,
    slotImages,
    imgProviderTag,
    totalCost,
    getCutoutSource,
    setGenMode,
    setImgDone,
    setImgError,
    imgError,
    cutoutSrc,
    setCutoutSrc,
    setCutoutDataUrl,
    setLastCutoutSrc,
    cutoutDataUrl,
    pickCustomCutout,
    cutoutLoading,
    runCutout,
    toggleTpl,
    imgLoading,
    generateImages,
    setStep,
    imgDone,
    tier,
    setTier,
    retries,
    setRetries,
    imgProgress,
    uploadForSlot,
    batchUpload,
    setSlotImages,
    published,
    pubMsg,
    aiMark,
    publishAgain,
    pubAccount,
    setPubAccount,
    pubMode,
    setPubMode,
    pubTime,
    setPubTime,
    setAiMark,
    publish,
    phoneMode,
    setPhoneMode,
    previewImages,
    previewTitle,
    previewParas,
    previewTags,
    previewAuthor,
    previewAvatar,
    previewLiked,
    previewCollected,
    previewComment,
    isSrcPreview,
    productLibraryOpen,
    openEditProduct,
    removeProductItem,
    editingProduct,
    productModalOpen,
    setProductModalOpen,
    submitProduct,
    prodName,
    setProdName,
    prodMainImage,
    uploadMainImage,
    setProdMainImage,
    prodPoints,
    setProdPoints,
    prodAudience,
    setProdAudience,
    prodPrice,
    setProdPrice,
    prodSceneImages,
    setProdSceneImages,
    uploadSceneImages,
    prodAppearance,
    setProdAppearance,
    styleModalOpen,
    useStyleAsset,
    removeStyleItem,
    styleSaveOpen,
    setStyleSaveOpen,
    submitStyleSave,
    styleName,
    setStyleName,
    historyOpen,
    loadHistory,
    setHistoryTick,
  };
}
