import { useEffect, useRef, useState } from "react";

export function useQilingConfig(
  active: boolean,
  onConnected: () => Promise<void>,
) {
  const [models, setModels] = useState<QilingModel[]>([]),
    [key, setKey] = useState(""),
    [model, setModel] = useState("");
  const [maxTokens, setMaxTokens] = useState<number | null>(16384);
  const [maxFee, setMaxFee] = useState("0.50");
  const [thinkingMode, setThinkingMode] = useState<QilingThinkingMode | "">("");
  const thinkingModes = models.find((item) => item.code === model)?.thinkingModes || [];
  const effectiveThinkingMode: QilingThinkingMode | "" = thinkingMode && thinkingModes.includes(thinkingMode)
    ? thinkingMode : "";
  const selectModel = (value: string) => {
    setModel(value);
    setThinkingMode("");
    const limit = models.find((item) => item.code === value)?.maxTokens;
    if (limit)
      setMaxTokens((current) =>
        current === null ? null : Math.min(current, limit),
      );
  };
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [open, setOpen] = useState(false),
    [auth, setAuth] = useState<QilingAuthState>({ status: "idle" });
  const generation = useRef(0);
  const refresh = async () => {
    const result = await window.wangaohui?.qilingModels();
    if (!result?.ok) throw Error(result?.error || "模型清单读取失败");
    setModels(result.models || []);
  };
  const cancel = async () => {
    generation.current += 1;
    setOpen(false);
    await window.wangaohui?.qilingAuthCancel();
  };
  useEffect(() => {
    if (!active) void cancel();
    return () => {
      generation.current += 1;
      void window.wangaohui?.qilingAuthCancel();
    };
  }, [active]);
  useEffect(() => {
    if (!open || auth.status !== "pending") return;
    const current = generation.current;
    const timer = setTimeout(async () => {
      const result = await window.wangaohui?.qilingAuthPoll();
      if (current !== generation.current) return;
      if (!result?.ok) {
        setAuth({ status: "failed", error: result?.error || "授权失败" });
        return;
      }
      setAuth(result);
      if (result.status === "authorized") {
        setModels(result.models || []);
        setKey("");
        setFeedback("器灵 Key 已安全保存，请选择文本模型");
        await onConnected();
      }
    }, auth.interval || 3000);
    return () => clearTimeout(timer);
  }, [open, auth, onConnected]);
  const start = async () => {
    const current = ++generation.current;
    setOpen(true);
    setAuth({ status: "starting" });
    const result = await window.wangaohui?.qilingAuthStart();
    if (current === generation.current)
      setAuth(
        result?.ok
          ? result
          : { status: "failed", error: result?.error || "授权请求失败" },
      );
  };
  const connect = async () => {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const result = await window.wangaohui?.qilingConnect({ apiKey: key });
      if (!result?.ok) throw Error(result?.error || "Key 验证失败");
      setKey("");
      setModels(result.models || []);
      setModel(result.config?.qilingModel || "");
      setThinkingMode(result.config?.qilingThinkingMode || "");
      setFeedback("器灵 Key 已安全保存，请选择文本模型");
      await onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  };
  const saveModel = async () => {
    setBusy(true);
    setError("");
    try {
      const selected = models.find((item) => item.code === model);
      if (
        !Number.isInteger(maxTokens) ||
        !maxTokens ||
        maxTokens < 1 ||
        maxTokens > (selected?.maxTokens || 100000)
      )
        throw Error(
          `最大输出量须在 1–${selected?.maxTokens || 100000} Token 之间`,
        );
      if (
        !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,9})?$/.test(maxFee) ||
        Number(maxFee) <= 0
      )
        throw Error("请填写大于 0 的单次预估费用上限");
      const result = await window.wangaohui?.qilingSelectModel({
        model,
        maxTokens,
        maxFee,
        ...(effectiveThinkingMode ? { thinkingMode: effectiveThinkingMode } : {}),
      });
      if (!result?.ok) throw Error(result?.error || "模型保存失败");
      setModels(result.models || []);
      setFeedback("器灵文本模型、思考模式与预算已保存");
      await onConnected();
      window.dispatchEvent(new Event("ai-config-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };
  const loadModels = async () => {
    setBusy(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      setBusy(false);
    }
  };
  return {
    models,
    key,
    setKey,
    model,
    setModel,
    selectModel,
    maxTokens,
    setMaxTokens,
    maxFee,
    setMaxFee,
    thinkingMode: effectiveThinkingMode,
    setThinkingMode,
    busy,
    error,
    feedback,
    open,
    auth,
    start,
    cancel,
    connect,
    saveModel,
    loadModels,
  };
}
