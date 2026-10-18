import { Alert,Modal,Radio,Select } from "@/components/shared/controls";
import { listAccounts } from "@/data/localStore";
import { useArticleWorkspace } from "./workspace-context";

export function PublishDialog() {
  const {
    pushMode,
    pushOpen,
    setPushOpen,
    confirmPush,
    contentType,
    pushLoading,
    stickerTitleText,
    blocks,
    topic,
    pushPlatform,
    setPushPlatform,
    setPushAccountId,
    setPushMode,
    pushAccountId,
    pushWechatUsername,
    setPushWechatUsername,
  } = useArticleWorkspace();

  return (
    <Modal
      title={pushPlatform === "公众号" || pushMode === "draft" ? "推送草稿" : "发布内容"}
      open={pushOpen}
      onCancel={() => setPushOpen(false)}
      onOk={confirmPush}
      okText={
        pushPlatform === "公众号" || pushMode === "draft"
          ? "推送到草稿箱"
          : contentType === "sticker"
            ? "发布贴图"
            : "发布文章"
      }
      confirmLoading={pushLoading}
      width={540}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          contentType === "sticker"
            ? `贴图：${stickerTitleText || "未命名贴图"}`
            : `文章：${blocks.find((b) => b.type === "title")?.text || topic}`
        }
      />
      <div className="form-label">平台</div>
      <Select
        style={{ width: "100%" }}
        value={pushPlatform}
        onChange={(v) => {
          setPushPlatform(v);
          setPushAccountId("");
          if (v === "公众号") setPushMode("draft");
          else if (v === "小红书") setPushMode("publish");
        }}
        options={
          contentType === "sticker"
            ? [
                { value: "公众号", label: "公众号" },
                { value: "小红书", label: "小红书" },
              ]
            : [
                { value: "公众号", label: "公众号" },
                { value: "头条号", label: "头条号" },
                { value: "百家号", label: "百家号" },
              ]
        }
      />
      <div className="form-label" style={{ marginTop: 12 }}>
        账号
      </div>
      <Select
        style={{ width: "100%" }}
        placeholder={
          listAccounts().some((a) => a.platform === pushPlatform && a.authed)
            ? "选择账号"
            : "该平台暂无已认证账号"
        }
        value={pushAccountId || undefined}
        onChange={setPushAccountId}
        options={listAccounts()
          .filter((a) => a.platform === pushPlatform && a.authed)
          .map((a) => ({ value: a.id, label: `${a.platform} · ${a.name}` }))}
      />
      {(() => {
        const acc = listAccounts().find((a) => a.id === pushAccountId);
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
              value={pushWechatUsername || undefined}
              onChange={(v) => setPushWechatUsername(v || "")}
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
      {pushPlatform === "公众号" ? (
        <p className="mt-4 text-xs text-muted-foreground">仅推送到公众号草稿箱，正式发布请在公众号后台完成。</p>
      ) : <>
      <div className="form-label" style={{ marginTop: 12 }}>
        方式
      </div>
      <Radio.Group
        value={pushMode}
        onChange={(e) => setPushMode(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        options={
          pushPlatform === "小红书"
            ? [{ label: "发布笔记", value: "publish" }]
            : [
                { label: "保存到平台草稿箱", value: "draft" },
                {
                  label: contentType === "sticker" ? "发布贴图" : "发布文章",
                  value: "publish",
                },
              ]
        }
      />
      </>}
    </Modal>
  );
}
