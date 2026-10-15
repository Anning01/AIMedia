import { useEffect, useRef, useState } from "react";

export function useRemoveAi(
  text: string,
  onAdopt: (source: string, candidate: string) => boolean,
) {
  const [open, setOpen] = useState(false),
    [job, setJob] = useState<QilingRemoveJob | null>(null),
    [price, setPrice] = useState<QilingPrice | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [allowSplit, setAllowSplit] = useState(false),
    [replaceChanged, setReplaceChanged] = useState(false);
  useEffect(() => setReplaceChanged(false), [text]);
  const live = useRef(true),
    openRef = useRef(false),
    jobRef = useRef(job);
  jobRef.current = job;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      void window.wangaohui?.qilingRemovePause({ id: jobRef.current?.id });
    };
  }, []);
  const show = async () => {
    setOpen(true);
    openRef.current = true;
    setError("");
    setReplaceChanged(false);
    setAllowSplit(false);
    setBusy(true);
    try {
      const current = await window.wangaohui?.qilingRemoveGet({});
      if (!current?.ok) throw Error(current?.error || "任务读取失败");
      setJob(current.job || null);
      const response = await window.wangaohui?.qilingRemovePrice();
      if (!response?.ok) throw Error(response?.error || "去 AI 服务不可用");
      setPrice(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const close = async () => {
    openRef.current = false;
    setOpen(false);
    const result = await window.wangaohui?.qilingRemovePause({
      id: jobRef.current?.id,
    });
    if (result?.ok && live.current) setJob(result.job || null);
  };
  useEffect(() => {
    if (!open || job?.state !== "running") return;
    const timer = setTimeout(async () => {
      try {
        const result = await window.wangaohui?.qilingRemovePoll({ id: job.id });
        if (!openRef.current || !live.current) return;
        if (result?.ok) setJob(result.job || null);
        else {
          const reason = result?.error || "查询失败，请稍后继续查询原任务";
          setError(reason);
          setJob({ ...job, state: "paused", error: reason });
          await window.wangaohui?.qilingRemovePause({ id: job.id });
        }
      } catch {
        if (openRef.current && live.current) {
          setError("查询连接中断，原任务号已保留");
          setJob({ ...job, state: "paused" });
        }
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [open, job]);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await window.wangaohui?.qilingRemoveStart({
        text,
        allowSplit,
      });
      if (!result?.ok) throw Error(result?.error || "提交失败，请检查使用记录");
      if (openRef.current) setJob(result.job || null);
      else await window.wangaohui?.qilingRemovePause({ id: result.job?.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
      const result = await window.wangaohui?.qilingRemoveGet({});
      if (result?.ok) setJob(result.job || null);
    } finally {
      setBusy(false);
    }
  };
  const resume = async () => {
    if (!job) return;
    const result = await window.wangaohui?.qilingRemoveResume({ id: job.id });
    if (result?.ok) {
      setError("");
      setJob(result.job || null);
    } else setError(result?.error || "继续查询失败");
  };
  const pause = async () => {
    if (!job) return;
    const result = await window.wangaohui?.qilingRemovePause({ id: job.id });
    if (result?.ok) setJob(result.job || null);
  };
  const adopt = async () => {
    if (!job?.candidate) return;
    if (text !== job.source && !replaceChanged) {
      setError("正文已变化，请先确认覆盖当前文案");
      return;
    }
    if (!onAdopt(text, job.candidate)) {
      setError("正文又发生变化，请重新确认后采用");
      return;
    }
    const result = await window.wangaohui?.qilingRemoveAdopt({ id: job.id });
    if (!result?.ok) {
      setError(result?.error || "采用状态保存失败");
      return;
    }
    setJob(null);
    setOpen(false);
    openRef.current = false;
  };
  const discard = async () => {
    if (!job) return;
    const result = await window.wangaohui?.qilingRemoveAdopt({ id: job.id });
    if (result?.ok) {
      setJob(null);
      setError("");
      setPrice(null);
      await show();
    } else setError(result?.error || "候选关闭失败");
  };
  return {
    open,
    show,
    close,
    job,
    price,
    busy,
    error,
    allowSplit,
    setAllowSplit,
    replaceChanged,
    setReplaceChanged,
    start,
    resume,
    pause,
    adopt,
    discard,
    count: Math.ceil(Array.from(text).length / 2000),
    changed: !!job && text !== job.source,
  };
}
