import { FormDialog } from "@/components/shared/form-dialog";
import { Alert,AlertDescription,AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAccountCenterContext } from "./workspace-context";

export function AccountLoginDialog() {
  const {
    acctPlatform,
    loginOpen,
    closeLogin,
    loginStatus,
    loginSession,
    setLoginError,
    loginMessage,
    startPlatformLogin,
    loginError,
  } = useAccountCenterContext();
  const platformLabel = acctPlatform === "公众号" ? "微信账号" : acctPlatform;

  return (
    <FormDialog
      open={loginOpen}
      onOpenChange={(open) => {
        if (!open) closeLogin();
      }}
      title={`${platformLabel} · 扫码登录`}
      className="sm:max-w-md"
      footer={
        loginStatus === "done" ? (
          <Button onClick={closeLogin}>完成</Button>
        ) : (
          <Button variant="secondary" onClick={closeLogin}>
            取消
          </Button>
        )
      }
    >
      {!loginSession ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          正在创建登录会话…
        </p>
      ) : loginSession.qrDataUrl ? (
        <div className="flex flex-col items-center gap-3 py-1 text-center">
          <img
            key={loginSession.id}
            src={loginSession.qrDataUrl}
            alt="登录二维码"
            onError={() =>
              setLoginError("二维码图片加载失败，请点击「刷新二维码」重试")
            }
            className="size-[260px] rounded-xl bg-card object-contain ring-1 ring-border"
          />
          <div className="text-sm font-medium text-foreground">
            {loginMessage || "等待扫码"}
          </div>
          <p className="text-xs text-muted-foreground">
            请用{acctPlatform === "公众号" ? "微信" : "小红书"}
            扫码，并在手机上确认登录
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void startPlatformLogin()}
          >
            刷新二维码
          </Button>
        </div>
      ) : loginSession.mode === "web" ? (
        <div className="flex flex-col gap-3">
          <Alert variant="info">
            <AlertTitle>已在独立窗口打开登录页</AlertTitle>
            <AlertDescription>
              请在弹出的登录窗口完成登录（如未弹出请查看任务栏）。登录成功后这里会自动变成「登录成功」，回到账号弹窗保存即可。
            </AlertDescription>
          </Alert>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="text-sm font-medium text-foreground">
              {loginMessage || "等待登录"}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void startPlatformLogin()}
            >
              重新打开登录窗口
            </Button>
          </div>
        </div>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>登录初始化失败</AlertTitle>
          <AlertDescription>点击「重新打开登录窗口」重试。</AlertDescription>
        </Alert>
      )}
      {loginError && (
        <Alert variant="destructive">
          <AlertTitle>{loginError}</AlertTitle>
        </Alert>
      )}
      {loginStatus === "done" && (
        <Alert variant="info">
          <AlertTitle>{loginMessage || "登录成功，Cookie 已获取"}</AlertTitle>
          <AlertDescription>
            回到账号弹窗点击「保存账号」即可完成添加。
          </AlertDescription>
        </Alert>
      )}
    </FormDialog>
  );
}
