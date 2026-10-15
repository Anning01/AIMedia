import { ReloadIcon } from "@radix-ui/react-icons";
import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountCenterContext } from "./workspace-context";

export function AccountSettingsDialog() {
  const {
    accountModal,
    addOpen,
    setAddOpen,
    saveAccountModal,
    acctPlatform,
    acctName,
    setAcctName,
    loginLoading,
    startPlatformLogin,
  } = useAccountCenterContext();
  const platformLabel = acctPlatform === "公众号" ? "微信账号" : acctPlatform;

  return (
    <FormDialog
      open={addOpen}
      onOpenChange={(open) => setAddOpen(open)}
      title={accountModal ? "配置账号" : "添加账号"}
      description={`当前平台：${platformLabel}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => setAddOpen(false)}>
            取消
          </Button>
          <Button onClick={saveAccountModal}>保存账号</Button>
        </>
      }
    >
      {acctPlatform === "公众号" ? (
        <Field
          label="账号备注名"
          hint="扫码登录成功后会自动获取 Cookie 与名下公众号，并自动保存账号。"
        >
          <Input
            value={acctName}
            aria-label="账号备注名"
            onChange={(event) => setAcctName(event.target.value)}
            placeholder="例：主账号 · 健康生活"
          />
        </Field>
      ) : (
        <Field
          label={`${platformLabel}登录`}
          hint="无需填写备注，点击下方按钮打开登录窗口；登录成功后自动使用平台昵称保存账号。"
        >
          <div className="text-xs text-muted-foreground">—</div>
        </Field>
      )}
      <Button
        className="w-full"
        disabled={loginLoading}
        onClick={() => void startPlatformLogin()}
      >
        {loginLoading && (
          <ReloadIcon className="animate-spin" aria-hidden="true" />
        )}
        {loginLoading
          ? "处理中…"
          : acctPlatform === "公众号"
            ? "微信扫码登录"
            : acctPlatform === "小红书"
              ? "小红书扫码登录"
              : `${acctPlatform}网页登录`}
      </Button>
    </FormDialog>
  );
}
