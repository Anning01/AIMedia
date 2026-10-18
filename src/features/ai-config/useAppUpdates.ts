import { useEffect, useState } from "react";
import { message } from "@/components/shared/controls";
export function useAppUpdates() {
  const [appVersion, setAppVersion] = useState("");
  const [updateState, setUpdateState] = useState<UpdateStatusPayload | null>(
    null,
  );
  const [updateProgress, setUpdateProgress] =
    useState<UpdateProgressPayload | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  useEffect(() => {
    const api = window.wangaohui;
    if (!api) return;
    void api
      .appVersion()
      .then(setAppVersion)
      .catch(() => undefined);
    const status = api.onUpdateStatus(setUpdateState);
    const progress = api.onUpdateProgress(setUpdateProgress);
    return () => {
      status();
      progress();
    };
  }, []);
  const checkUpdate = async () => {
    if (!window.wangaohui) return;
    setCheckingUpdate(true);
    try {
      const result = await window.wangaohui.updateCheck();
      if (!result.ok) throw Error(result.error || "检查更新失败");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "检查更新失败");
    } finally {
      setCheckingUpdate(false);
    }
  };
  const installUpdate = async () => {
    const result = await window.wangaohui?.updateInstall();
    if (result && !result.ok) message.error(result.error || "安装更新失败");
  };
  return {
    appVersion,
    updateState,
    updateProgress,
    checkingUpdate,
    checkUpdate,
    installUpdate,
  };
}
