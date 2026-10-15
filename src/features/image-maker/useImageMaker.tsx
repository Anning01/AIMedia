import { message } from "@/components/shared/controls";
import {
imageStyleById,
NO_TEXT_REQUIREMENT,
PEOPLE_REQUIREMENT,
} from "@/data/imageStyles";
import {
addUsage,
listAssets,
loadAppSettings,
saveAsset,
uid,
} from "@/data/localStore";
import { renderDesignPng } from "@/utils/renderDesignPng";
import { useMemo,useRef,useState } from "react";
import { buildLayers,CATEGORIES,Layer,TEMPLATES,Tmpl } from "./model";

export function useImageMaker() {
  const [cat, setCat] = useState("cover");
  const [tmplId, setTmplId] = useState("c1");
  const [bg, setBg] = useState(TEMPLATES[0].bg);
  const [layers, setLayers] = useState<Layer[]>(() =>
    buildLayers(TEMPLATES[0]),
  );
  const [selectedId, setSelectedId] = useState(layers[0]?.id ?? "");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState(
    () => loadAppSettings().imageStyle || "viral",
  );
  const [aiLoading, setAiLoading] = useState(false);
  const dragRef = useRef<{
    id: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const catInfo = useMemo(() => CATEGORIES.find((c) => c.key === cat)!, [cat]);
  const tmpls = useMemo(() => TEMPLATES.filter((t) => t.cat === cat), [cat]);
  const selected = layers.find((l) => l.id === selectedId) ?? layers[0];

  const pickTemplate = (t: Tmpl) => {
    setTmplId(t.id);
    setBg(t.bg);
    const next = buildLayers(t);
    setLayers(next);
    setSelectedId(next[0].id);
  };

  const patchLayer = (id: string, patch: Partial<Layer>) => {
    setLayers(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const startDrag = (e: React.MouseEvent, layer: Layer) => {
    setSelectedId(layer.id);
    dragRef.current = {
      id: layer.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: layer.x,
      oy: layer.y,
    };
  };

  const moveDrag = (e: React.MouseEvent) => {
    const d = dragRef.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.min(
      90,
      Math.max(10, d.ox + ((e.clientX - d.sx) / rect.width) * 100),
    );
    const ny = Math.min(
      94,
      Math.max(6, d.oy + ((e.clientY - d.sy) / rect.height) * 100),
    );
    patchLayer(d.id, { x: nx, y: ny });
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const downloadPng = async (name: string) => {
    const dataUrl = await renderDesignPng({
      width: catInfo.w,
      height: catInfo.h,
      bg,
      layers: layers.map((l) => ({
        text: l.text,
        x: l.x,
        y: l.y,
        size: l.size,
        color: l.color,
        bold: l.bold,
      })),
    });
    if (window.wangaohui?.saveFile) {
      const r = await window.wangaohui.saveFile({ defaultName: name, dataUrl });
      if (r.ok) messageApi.success(`已导出 PNG：${r.path}`);
      else if (!r.canceled) messageApi.error(r.error || "导出失败");
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = name;
      a.click();
      messageApi.success("已导出 PNG（浏览器模式）");
    }
  };

  const uploadBg = () => {
    const apply = (dataUrl: string) => {
      setBg(`url(${dataUrl})`);
      messageApi.success("本地图片已设为背景");
    };
    if (window.wangaohui?.selectImage) {
      window.wangaohui.selectImage().then((r) => {
        if (r.ok && r.dataUrl) apply(r.dataUrl);
        else if (!r.canceled) messageApi.error(r.error || "选择图片失败");
      });
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => apply(String(reader.result));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const saveToAssets = async () => {
    let dataUrl: string | undefined;
    try {
      dataUrl = await renderDesignPng({
        width: catInfo.w,
        height: catInfo.h,
        bg,
        layers: layers.map((l) => ({
          text: l.text,
          x: l.x,
          y: l.y,
          size: l.size,
          color: l.color,
          bold: l.bold,
        })),
      });
    } catch {
      dataUrl = undefined;
    }
    saveAsset({
      id: uid("asset"),
      kind: "设计",
      name: `${catInfo.label} · ${layers[0]?.text || "未命名"}`,
      dataUrl,
      design: { width: catInfo.w, height: catInfo.h, bg, layers },
      createdAt: new Date().toISOString(),
    });
    addUsage("贴图");
    messageApi.success(`已存入素材库（当前共 ${listAssets().length} 项）`);
  };

  const generateAi = async () => {
    if (!aiPrompt.trim()) {
      messageApi.warning("请输入画面描述");
      return;
    }
    const settings = loadAppSettings();
    let hasKey = !!settings.imageGenKey;
    if (!hasKey) {
      const aiCfg = await window.wangaohui?.readAiConfig();
      hasKey = !!(aiCfg?.hasImageKey || aiCfg?.hasMinimaxKey || aiCfg?.hasArkKey);
    }
    if (!hasKey) {
      messageApi.error(
        "未配置图片生成 Key，请到「AI 配置 → 图片生成」设置",
      );
      return;
    }
    setAiLoading(true);
    try {
      const r = await window.wangaohui?.generateImage({
        provider: settings.imageGenProvider,
        apiKey: settings.imageGenKey,
        baseUrl: settings.imageGenBaseUrl,
        model: settings.imageGenModel,
        prompt: `${aiPrompt}。整体风格：${imageStyleById(aiStyle).phrase}。${PEOPLE_REQUIREMENT}${NO_TEXT_REQUIREMENT}（文字请用右侧图层叠加）。`,
        size: catInfo.ratio === "3:4" ? "3:4" : "4:3",
        count: 1,
      });
      if (!r || !r.ok || !r.images?.length) {
        throw new Error(r?.error || "生成失败");
      }
      setBg(`url(${r.images[0]})`);
      saveAsset({
        id: uid("asset"),
        kind: "图片",
        name: `AI 背景 · ${aiPrompt.slice(0, 18)}`,
        dataUrl: r.images[0],
        tags: ["AI生成"],
        createdAt: new Date().toISOString(),
      });
      addUsage("贴图");
      setAiOpen(false);
      messageApi.success("AI 背景图已生成并存入素材库");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  return {
    contextHolder,
    catInfo,
    cat,
    setCat,
    pickTemplate,
    tmpls,
    tmplId,
    downloadPng,
    canvasRef,
    bg,
    moveDrag,
    dragRef,
    layers,
    selectedId,
    startDrag,
    setSelectedId,
    selected,
    patchLayer,
    setBg,
    setAiOpen,
    uploadBg,
    saveToAssets,
    aiOpen,
    generateAi,
    aiLoading,
    aiPrompt,
    setAiPrompt,
    aiStyle,
    setAiStyle,
  };
}
