import { Alert, Modal, Radio, Select } from "@/components/shared/controls";
import { usePublishWorkspace } from "./workspace-context";
export function PlatformPublishDialog() {
  const {
    pubOpen,
    setPubOpen,
    confirmPlatformPublish,
    pubMode,
    pubLoading,
    pubItem,
    pubPlatform,
    setPubPlatform,
    setPubAccountId,
    accounts,
    pubAccountId,
    pubWechatUsername,
    setPubWechatUsername,
    setPubMode,
  } = usePublishWorkspace();
  return (
    <Modal
      title={pubPlatform === "公众号" ? "推送到公众号草稿箱" : "发布到平台"}
      open={pubOpen}
      onCancel={() => {
        if (!pubLoading) setPubOpen(false);
      }}
      onOk={confirmPlatformPublish}
      okText={pubPlatform === "公众号" ? "推送到草稿箱" : pubMode === "draft" ? "保存草稿" : "存草稿并发布"}
      confirmLoading={pubLoading}
      width={520}
    >
      {pubItem && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={pubItem.title}
        />
      )}
      <div className="form-label">平台</div>
      <Select
        style={{ width: "100%" }}
        disabled={pubLoading}
        value={pubPlatform}
        onChange={(v) => {
          setPubPlatform(v);
          setPubAccountId("");
          setPubWechatUsername("");
          setPubMode(v === "公众号" ? "draft" : "publish");
        }}
        options={[
          { value: "公众号", label: "公众号" },
          { value: "头条号", label: "头条号" },
          { value: "百家号", label: "百家号" },
        ]}
      />
      <div className="form-label" style={{ marginTop: 12 }}>
        账号
      </div>
      <Select
        style={{ width: "100%" }}
        placeholder={
          accounts.some((a) => a.platform === pubPlatform && a.authed)
            ? "选择账号"
            : "该平台暂无已认证账号"
        }
        disabled={pubLoading}
        value={pubAccountId || undefined}
        onChange={(value: string) => {
          setPubAccountId(value);
          setPubWechatUsername("");
        }}
        options={accounts
          .filter((a) => a.platform === pubPlatform && a.authed)
          .map((a) => ({ value: a.id, label: `${a.platform} · ${a.name}` }))}
      />
      {(() => {
        const acc = accounts.find((a) => a.id === pubAccountId);
        if (
          !acc ||
          acc.platform !== "公众号" ||
          !(acc.wechatAccounts || []).length
        ) {
          return null;
        }
        return (
          <>
            <div className="form-label" style={{ marginTop: 12 }}>
              公众号子账号（推送草稿前自动切换并续期）
            </div>
            <Select
              style={{ width: "100%" }}
              allowClear
              placeholder="不选则用主账号"
              disabled={pubLoading}
              value={pubWechatUsername || undefined}
              onChange={(v) => setPubWechatUsername(v || "")}
              options={(acc.wechatAccounts || [])
                .filter((w) => w.kind !== "wxa" && w.enabled !== false)
                .map((w) => ({
                  value: w.username,
                  label: w.nickname || w.username,
                }))}
            />
          </>
        );
      })()}
      {pubPlatform === "公众号" ? (
        <p className="mt-4 text-xs text-muted-foreground">仅推送到公众号草稿箱，正式发布请在公众号后台完成。</p>
      ) : <>
      <div className="form-label" style={{ marginTop: 12 }}>
        发布方式
      </div>
      <Radio.Group
        disabled={pubLoading}
        value={pubMode}
        onChange={(e) => setPubMode(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        options={[
          { label: "存草稿并发布", value: "publish" },
          { label: "仅保存到草稿箱", value: "draft" },
        ]}
      />
      </>}
    </Modal>
  );
}
