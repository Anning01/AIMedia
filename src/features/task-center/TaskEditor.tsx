import {
Button,
Col,
ColorPicker,
Input,
InputNumber,
Modal,
Radio,
Row,
Select,
Space,
Switch,
} from "@/components/shared/controls";
import { EyeOutlined } from "@/components/shared/icons";
import { Form } from "@/components/shared/task-form";
import { ARTICLE_TEMPLATES } from "@/data/articleTemplates";
import { listMaterialGroups } from "@/data/localStore";
import { loadPromptSets } from "@/data/promptSets";
import { allCoverTemplates } from "@/data/stickerTemplates";
import { useTaskCenter } from "./useTaskCenter";
type Props = Pick<
  ReturnType<typeof useTaskCenter>,
  | "editingTask"
  | "createOpen"
  | "closeCreate"
  | "form"
  | "saveTask"
  | "accounts"
  | "sourceOptions"
  | "categories"
  | "openPreview"
>;
export function TaskEditor({
  editingTask,
  createOpen,
  closeCreate,
  form,
  saveTask,
  accounts,
  sourceOptions,
  categories,
  openPreview,
}: Props) {
  return (
    <Modal
      title={editingTask ? "编辑托管任务" : "新建托管任务"}
      open={createOpen}
      onCancel={closeCreate}
      onOk={() => form.submit()}
      okText={editingTask ? "保存修改" : "创建任务"}
      width={720}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={saveTask}
        initialValues={{
          platform: "",
          accountId: "",
          wechatUsername: "",
          contentType: "article",
          promptSetId: "",
          sourceType: "material",
          imageSource: "auto",
          imageCount: 1,
          perRunCount: 1,
          frequency: "daily",
          startTime: "09:00",
          intervalMinutes: 1440,
          publishMode: "draft",
          retry: true,
        }}
      >
        <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
          <span className="text-[13px] font-semibold text-foreground">基础信息</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Form.Item
          name="name"
          label="任务名称"
          rules={[{ required: true, message: "请输入任务名称" }]}
        >
          <Input placeholder="例：星座号 · 每日贴图" />
        </Form.Item>
        <Form.Item
          name="contentType"
          label="内容类型"
          style={{ maxWidth: 360 }}
        >
          <Select
            options={[
              { value: "article", label: "文章" },
              { value: "sticker", label: "贴图" },
            ]}
            onChange={() =>
              form.setFieldsValue({
                sourceKey: undefined,
                templateId: undefined,
                platform: undefined,
                accountId: undefined,
                wechatUsername: undefined,
              })
            }
          />
        </Form.Item>
        <Form.Item
          name="promptSetId"
          label="提示词套件"
          style={{ maxWidth: 360 }}
        >
          <Select
            allowClear
            placeholder="默认"
            options={loadPromptSets().map((s) => ({
              value: s.id,
              label: s.name,
            }))}
          />
        </Form.Item>
        <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
          <span className="text-[13px] font-semibold text-foreground">账号与平台</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const ct = getFieldValue("contentType");
            const allowedPlatforms =
              ct === "sticker"
                ? ["公众号", "小红书"]
                : ["公众号", "头条号", "百家号"];
            const platforms = allowedPlatforms;
            const platform = getFieldValue("platform");
            const accountOpts = accounts.filter(
              (a) => a.authed && a.platform === platform,
            );
            const accountId = getFieldValue("accountId");
            const mpOpts =
              platform === "公众号"
                ? (
                    accounts.find((a) => a.id === accountId)?.wechatAccounts ||
                    []
                  )
                    .filter((w) => w.kind !== "wxa" && w.enabled !== false)
                    .map((w) => ({
                      value: w.username,
                      label: w.nickname || w.username,
                    }))
                : [];
            return (
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="platform"
                    label="平台"
                    rules={[{ required: true, message: "请选择平台" }]}
                  >
                    <Select
                      placeholder="平台"
                      options={platforms.map((p) => ({ value: p, label: p }))}
                      onChange={(value: string) =>
                        form.setFieldsValue({
                          accountId: undefined,
                          wechatUsername: undefined,
                          publishMode: value === "公众号" ? "draft" : form.getFieldValue("publishMode"),
                        })
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={platform === "公众号" ? 8 : 16}>
                  <Form.Item
                    name="accountId"
                    label="账号"
                    rules={[{ required: true, message: "请选择账号" }]}
                  >
                    <Select
                      placeholder={
                        accountOpts.length ? "选择账号" : "该平台暂无已认证账号"
                      }
                      options={accountOpts.map((a) => ({
                        value: a.id,
                        label: a.name,
                      }))}
                      onChange={() =>
                        form.setFieldsValue({ wechatUsername: undefined })
                      }
                    />
                  </Form.Item>
                </Col>
                {platform === "公众号" && (
                  <Col span={8}>
                    <Form.Item
                      name="wechatUsername"
                      label="公众号"
                      rules={[{ required: true, message: "请选择公众号" }]}
                    >
                      <Select placeholder="公众号" options={mpOpts} />
                    </Form.Item>
                  </Col>
                )}
              </Row>
            );
          }}
        </Form.Item>
        <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
          <span className="text-[13px] font-semibold text-foreground">素材与模板</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <Form.Item name="sourceType" label="内容来源">
                  <Select
                    options={sourceOptions}
                    onChange={() =>
                      form.setFieldsValue({ sourceKey: undefined })
                    }
                  />
                </Form.Item>
              )}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => {
                const st = getFieldValue("sourceType");
                const opts =
                  st === "material"
                    ? listMaterialGroups().map((g) => ({
                        value: g.id,
                        label: g.name,
                      }))
                    : [
                        { value: "", label: "全部分类" },
                        ...categories.map((c) => ({ value: c, label: c })),
                      ];
                return (
                  <Form.Item
                    name="sourceKey"
                    label={st === "material" ? "素材组" : "分类"}
                  >
                    <Select
                      options={opts}
                      placeholder={
                        st === "material" ? "选择素材组" : "选择分类"
                      }
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => {
                const ct = getFieldValue("contentType");
                const tpls =
                  ct === "sticker"
                    ? allCoverTemplates().map((x) => ({
                        value: x.id,
                        label: x.name,
                      }))
                    : ARTICLE_TEMPLATES.map((x) => ({
                        value: x.id,
                        label: x.name,
                      }));
                return (
                  <Form.Item
                    name="templateId"
                    label={ct === "sticker" ? "首图模板" : "排版模板"}
                  >
                    <Select options={tpls} placeholder="选择模板" />
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Col>
          <Col
            span={12}
            style={{
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: 24,
            }}
          >
            <Space>
              <Button icon={<EyeOutlined />} onClick={openPreview}>
                预览模板
              </Button>
              {form.getFieldValue("contentType") !== "sticker" && (
                <Form.Item name="accent" noStyle>
                  <ColorPicker
                    size="small"
                    onChange={(c) =>
                      form.setFieldsValue({ accent: c.toHexString() })
                    }
                  />
                </Form.Item>
              )}
            </Space>
          </Col>
        </Row>
        <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
          <span className="text-[13px] font-semibold text-foreground">图片与数量</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) =>
            getFieldValue("contentType") !== "sticker" ? (
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="imageSource" label="图片来源">
                    <Select
                      options={[
                        { value: "auto", label: "自动配图" },
                        { value: "library", label: "我的图库" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="imageCount" label="图片数量">
                    <InputNumber min={1} max={3} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="perRunCount"
                    label={
                      form.getFieldValue("frequency") === "once"
                        ? "总成功篇数（篇）"
                        : "每天成功篇数（篇）"
                    }
                  >
                    <InputNumber min={1} max={10} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="perRunCount"
                    label={
                      form.getFieldValue("frequency") === "once"
                        ? "总成功篇数（篇）"
                        : "每天成功篇数（篇）"
                    }
                  >
                    <InputNumber min={1} max={10} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            )
          }
        </Form.Item>
        <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
          <span className="text-[13px] font-semibold text-foreground">执行计划</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => (
            <Row gutter={12}>
              <Col span={6}>
                <Form.Item name="frequency" label="任务频率">
                  <Select
                    options={[
                      { value: "daily", label: "每天" },
                      { value: "once", label: "一次" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="startTime"
                  label="开始执行时间"
                  rules={[{ required: true, message: "请输入时间" }]}
                >
                  <Input placeholder="HH:mm，如 09:00" />
                </Form.Item>
              </Col>
              {getFieldValue("frequency") !== "once" && (
                <Col span={6}>
                  <Form.Item name="intervalMinutes" label="执行间隔">
                    <Select
                      options={[
                        { value: 30, label: "30 分钟" },
                        { value: 60, label: "1 小时" },
                        { value: 120, label: "2 小时" },
                        { value: 360, label: "6 小时" },
                        { value: 720, label: "12 小时" },
                        { value: 1440, label: "24 小时" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              )}
              <Col span={getFieldValue("frequency") === "once" ? 12 : 6}>
                <Form.Item name="publishMode" label="发布方式">
                  <Radio.Group
                    optionType="button"
                    options={getFieldValue("platform") === "公众号" ? [
                      { label: "推送草稿箱", value: "draft" },
                    ] : [
                      { label: "存草稿", value: "draft" },
                      { label: "自动发布", value: "publish" },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form.Item>
        <div
          className="muted"
          style={{ fontSize: 12, marginTop: -8, marginBottom: 8 }}
        >
          公众号任务仅推送草稿箱。当天完成设定篇数后停止，第二天继续；一次任务达到篇数后结束。
        </div>
        <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
          <span className="text-[13px] font-semibold text-foreground">失败处理</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Form.Item
          name="retry"
          label="失败后素材标记失败（不重复使用）"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
