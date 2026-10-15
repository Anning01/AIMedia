import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftFromConfig,
  validateDraft,
  type AiConfigDraft,
} from "./ai-config-model";
export function useAiConfig(active: boolean) {
  const loaded = useRef(false);
  const [info, setInfo] = useState<AiConfigInfo | null>(null);
  const [draft, setDraft] = useState<AiConfigDraft>(() =>
    draftFromConfig({ ok: true }),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => {
    if (!window.wangaohui) {
      setError("请在桌面应用中保存 AI 配置");
      return;
    }
    setLoading(true);
    try {
      const config = await window.wangaohui.readAiConfig();
      if (!config.ok) throw Error(config.error || "AI 配置读取失败");
      setInfo(config);
      setDraft(draftFromConfig(config));
      loaded.current = true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI 配置读取失败");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (active && !loaded.current) void load();
  }, [active, load]);
  const patch = (value: Partial<AiConfigDraft>) => {
    setDraft((previous) => ({ ...previous, ...value }));
    setFeedback("");
    setError("");
  };
  const save = async () => {
    const validation = validateDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    if (!window.wangaohui) return;
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const result = await window.wangaohui.saveAiConfig({
        ...draft,
        apiPath: "",
      });
      if (!result.ok) throw Error(result.error || "保存失败");
      const config = await window.wangaohui.readAiConfig();
      if (!config.ok) throw Error(config.error || "保存后读取失败");
      setInfo(config);
      setDraft(draftFromConfig(config));
      setFeedback("配置已保存，后续 AI 请求使用此接口与模型");
      window.dispatchEvent(new Event("ai-config-changed"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    const validation = validateDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    if (!window.wangaohui) return;
    setTesting(true);
    setError("");
    setFeedback("");
    try {
      const result = await window.wangaohui.testAiConfig({
        ...draft,
        apiPath: "",
      });
      if (!result.ok) throw Error(result.error || "连接失败");
      setFeedback(`连接成功：${result.reply || "AI 模型已响应"}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "连接失败");
    } finally {
      setTesting(false);
    }
  };
  return {
    draft,
    info,
    reload: load,
    patch,
    loading,
    saving,
    testing,
    error,
    feedback,
    save,
    test,
  };
}
