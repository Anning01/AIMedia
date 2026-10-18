import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const GENERATION_TOAST_KEY = "creation-generation";

export interface GenerationFeedbackState {
  status: "idle" | "running" | "success" | "error";
  message: string;
  canRetry?: boolean;
  code?: string;
  dismissed?: boolean;
  startedAt?: number;
  stage?: string;
  stopping?: boolean;
}

export function generationError(
  result: Pick<AiResult, "error" | "code" | "retryable">,
  fallback: string,
) {
  return Object.assign(new Error(result.error || fallback), {
    code: result.code,
    retryable: result.retryable,
  });
}

export function useGenerationFeedback() {
  const [feedback, setFeedback] = useState<GenerationFeedbackState>({
    status: "idle",
    message: "",
  });
  const inFlight = useRef(false);
  const runId = useRef(""),
    stopped = useRef(false);
  const started = useRef(0);
  useEffect(
    () =>
      window.wangaohui?.onGenerationProgress?.((event) => {
        if (
          !inFlight.current ||
          stopped.current ||
          event.requestId !== runId.current
        )
          return;
        setFeedback({
          status: "running",
          message: event.message,
          stage: event.stage,
          startedAt: started.current,
        });
      }),
    [],
  );
  const assertActive = () => {
    if (stopped.current)
      throw Object.assign(
        new Error("已停止等待；请核对已提交请求的使用记录。"),
        { code: "QILING_CANCELLED", retryable: false },
      );
  };
  const fail = (error: unknown) => {
    const detail = error as {
      message?: string;
      code?: string;
      retryable?: boolean;
    } | null;
    setFeedback({
      status: "error",
      message: detail?.message || String(error),
      code: detail?.code,
      canRetry: detail?.retryable !== false,
    });
  };
  return {
    feedback,
    requestId: () => runId.current,
    assertActive,
    stop: async () => {
      if (!inFlight.current || stopped.current) return;
      stopped.current = true;
      setFeedback((current) => ({
        ...current,
        stopping: true,
        message:
          "正在停止等待，不再进入后续生成步骤。已提交调用的结算以器灵记录为准。",
      }));
      try {
        await window.wangaohui?.cancelGeneration?.({
          requestId: runId.current,
        });
      } catch {
        /* The active call still owns its timeout and result guard. */
      }
    },
    dismiss: () => {
      if (inFlight.current) return;
      toast.dismiss(GENERATION_TOAST_KEY);
      setFeedback((previous) => ({ ...previous, dismissed: true }));
    },
    isRunning: () => inFlight.current,
    begin: (message: string) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      stopped.current = false;
      runId.current = crypto.randomUUID();
      started.current = Date.now();
      toast.dismiss(GENERATION_TOAST_KEY);
      setFeedback({ status: "running", message, startedAt: started.current });
      return true;
    },
    progress: (message: string) => {
      assertActive();
      setFeedback({ status: "running", message, startedAt: started.current });
    },
    succeed: (message: string) => setFeedback({ status: "success", message }),
    fail,
    finish: () => {
      inFlight.current = false;
    },
  };
}
