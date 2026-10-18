import {
  Alert,
  Button,
  Card,
  Progress,
  Space,
} from "@/components/shared/controls";
import { CloudDownloadOutlined } from "@/components/shared/icons";
import { useAppUpdates } from "./useAppUpdates";
type Props = Pick<
  ReturnType<typeof useAppUpdates>,
  | "appVersion"
  | "updateState"
  | "installUpdate"
  | "checkingUpdate"
  | "checkUpdate"
  | "updateProgress"
>;
export function AppUpdates({
  appVersion,
  updateState,
  installUpdate,
  checkingUpdate,
  checkUpdate,
  updateProgress,
}: Props) {
  return (
    <Card className="mt-4" title="软件更新">
      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          当前版本：
          <span className="font-semibold">{appVersion || "-"}</span>
        </div>
        {updateState?.status === "downloaded" ? (
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            onClick={installUpdate}
          >
            重启安装
          </Button>
        ) : (
          <Button
            icon={<CloudDownloadOutlined />}
            loading={checkingUpdate}
            onClick={checkUpdate}
          >
            检查更新
          </Button>
        )}
        {updateState?.status === "checking" && (
          <div className="muted">正在检查更新…</div>
        )}
        {updateState?.status === "available" && (
          <div className="muted">
            发现新版本 {updateState.version}，正在后台下载…
          </div>
        )}
        {updateState?.status === "manual" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              发现新版本 {updateState.version}。macOS 自签名版本请下载后安装。
            </span>
            <Button
              onClick={() =>
                window.open(
                  "https://github.com/Anning01/AIMedia/releases",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              前往 GitHub 下载
            </Button>
          </div>
        )}
        {updateState?.status === "not-available" && (
          <div className="muted">已是最新版本</div>
        )}
        {updateState?.status === "error" && (
          <Alert type="error" showIcon message={updateState.error} />
        )}
        {updateProgress?.percent != null &&
          updateProgress.percent > 0 &&
          updateProgress.percent < 100 && (
            <Progress percent={updateProgress.percent} size="small" />
          )}
      </Space>
    </Card>
  );
}
