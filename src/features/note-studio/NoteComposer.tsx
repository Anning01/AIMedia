import {
Alert,
Button,
Card,
Col,
Descriptions,
Divider,
Empty,
Image,
Input,
Radio,
Result,
Row,
Segmented,
Select,
Slider,
Space,
Steps,
Switch,
Tabs,
Tag,
Timeline,
} from "@/components/shared/controls";
import {
CheckOutlined,
DeleteOutlined,
EditOutlined,
FireOutlined,
FolderOpenOutlined,
HistoryOutlined,
PictureOutlined,
PlusOutlined,
SaveOutlined,
SyncOutlined,
ThunderboltOutlined,
UploadOutlined,
} from "@/components/shared/icons";
import { NOTE_TEMPLATES } from "@/data/noteTemplates";
import { PRICES } from "./model";
import { useNoteWorkspace } from "./workspace-context";
export function NoteComposer() {
  const {
    currentProduct,
    product,
    setHistoryOpen,
    step,
    refImageList,
    entryMode,
    setEntryMode,
    productId,
    setProductId,
    products,
    openAddProduct,
    setProductLibraryOpen,
    link,
    setLink,
    fetchAccountId,
    setFetchAccountId,
    xhsAccounts,
    pasteText,
    setPasteText,
    parsing,
    startParse,
    styleAssetId,
    setStyleAssetId,
    styleAssets,
    setStyleModalOpen,
    candLoading,
    selectedStyle,
    genCandidates,
    styleToReport,
    parsed,
    fetchedNote,
    importing,
    importNoteImages,
    previewImgState,
    previewImgError,
    refImageMap,
    visionState,
    visionError,
    analyzeComposition,
    visionItems,
    overallStyle,
    report,
    openSaveStyle,
    candidates,
    candIndex,
    setCandIndex,
    editing,
    editTitle,
    setEditTitle,
    editParas,
    setEditParas,
    saveEdit,
    setEditing,
    selectCandidate,
    startEdit,
    genMode,
    selectedTpls,
    slotImages,
    imgProviderTag,
    totalCost,
    getCutoutSource,
    setGenMode,
    setImgDone,
    setImgError,
    imgError,
    cutoutSrc,
    setCutoutSrc,
    setCutoutDataUrl,
    setLastCutoutSrc,
    cutoutDataUrl,
    pickCustomCutout,
    cutoutLoading,
    runCutout,
    toggleTpl,
    imgLoading,
    generateImages,
    setStep,
    imgDone,
    tier,
    setTier,
    retries,
    setRetries,
    imgProgress,
    uploadForSlot,
    batchUpload,
    setSlotImages,
    published,
    pubMsg,
    aiMark,
    publishAgain,
    pubAccount,
    setPubAccount,
    pubMode,
    setPubMode,
    pubTime,
    setPubTime,
    setAiMark,
    publish,
  } = useNoteWorkspace();
  return (
    <Col xs={24} xl={15}>
      <Card
        style={{ marginBottom: 16 }}
        title="复刻流程"
        extra={
          <Space size={8}>
            {currentProduct ? (
              <Tag color="blue">固定产品：{product}</Tag>
            ) : null}
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => setHistoryOpen(true)}
            >
              历史生成
            </Button>
          </Space>
        }
      >
        <Steps
          current={step}
          items={[
            { title: "输入与拆解", description: "爆款链接 / 粘贴正文" },
            { title: "生成笔记", description: "3 个候选角度" },
            {
              title: "生成配图",
              description: refImageList.length
                ? `${refImageList.length} 张 · 模板/合成/上传`
                : "模板/合成/上传",
            },
            { title: "发布", description: "立即或定时" },
          ]}
        />
      </Card>

      {step === 0 && (
        <>
          <Card
            title="1 · 选择生成方式与产品"
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Segmented
              block
              value={entryMode}
              onChange={(v) => setEntryMode(v as "parse" | "asset")}
              options={[
                { label: "解析新爆款", value: "parse" },
                { label: "从风格资产生成", value: "asset" },
              ]}
            />
            <div className="form-label" style={{ marginTop: 12 }}>
              你的产品（产品库）
            </div>
            <Space.Compact style={{ width: "100%" }}>
              <Select
                style={{ flex: 1 }}
                value={productId}
                onChange={setProductId}
                placeholder="选择产品"
                options={products.map((p) => ({
                  value: p.id,
                  label: (
                    <Space size={6}>
                      {p.mainImage ? (
                        <img
                          src={p.mainImage}
                          alt={p.name}
                          style={{
                            width: 20,
                            height: 20,
                            objectFit: "cover",
                            borderRadius: 4,
                          }}
                        />
                      ) : null}
                      {p.name}
                    </Space>
                  ),
                }))}
              />
              <Button icon={<PlusOutlined />} onClick={openAddProduct} />
              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => setProductLibraryOpen(true)}
              />
            </Space.Compact>
            {products.length === 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                message="还没有产品"
                description="点「+」创建你的产品（名称、卖点、人群、客单价），之后所有复刻都从产品库取。"
              />
            )}
            {entryMode === "parse" ? (
              <>
                <div className="form-label" style={{ marginTop: 14 }}>
                  爆款笔记链接
                </div>
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="粘贴小红书笔记链接"
                />
                <div className="form-label" style={{ marginTop: 12 }}>
                  读取账号（小红书 Cookie）
                </div>
                <Select
                  style={{ width: "100%" }}
                  value={fetchAccountId}
                  onChange={setFetchAccountId}
                  placeholder={
                    xhsAccounts.length
                      ? "选择已配置 Cookie 的账号"
                      : "暂无可用账号"
                  }
                  options={xhsAccounts.map((a) => ({
                    value: a.id,
                    label: a.name || "小红书账号",
                  }))}
                />
                {xhsAccounts.length === 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="读取笔记需要登录 Cookie"
                    description="请先到「发布中心 → 账号管理」添加小红书账号并扫码登录；链接最好带 xsec_token。"
                  />
                )}
                <div className="form-label" style={{ marginTop: 12 }}>
                  或直接粘贴爆款正文
                </div>
                <Input.TextArea
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="标题、正文、标签都可以粘贴进来，解析器会结构化拆解"
                />
                <Button
                  type="primary"
                  block
                  style={{ marginTop: 16 }}
                  icon={<ThunderboltOutlined />}
                  loading={parsing}
                  onClick={startParse}
                >
                  解析并拆解
                </Button>
              </>
            ) : (
              <>
                <div className="form-label" style={{ marginTop: 14 }}>
                  风格资产
                </div>
                <Space.Compact style={{ width: "100%" }}>
                  <Select
                    style={{ flex: 1 }}
                    value={styleAssetId}
                    onChange={setStyleAssetId}
                    placeholder="选择风格资产"
                    options={styleAssets.map((s) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                  />
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={() => setStyleModalOpen(true)}
                  />
                </Space.Compact>
                {styleAssets.length === 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="还没有风格资产"
                    description="先在「解析新爆款」里拆解一篇笔记，拆解报告可以保存为风格资产，以后直接复用。"
                  />
                )}
                <Button
                  type="primary"
                  block
                  style={{ marginTop: 16 }}
                  icon={<ThunderboltOutlined />}
                  loading={candLoading}
                  disabled={!selectedStyle || !productId}
                  onClick={() => {
                    if (selectedStyle)
                      void genCandidates(styleToReport(selectedStyle));
                  }}
                >
                  用这个风格 + 产品生成笔记
                </Button>
              </>
            )}
          </Card>

          {!parsed ? (
            <Card style={{ marginTop: 16 }}>
              <Alert
                type="info"
                showIcon
                message="解析后会得到什么？"
                description="选题角度、标题公式、正文结构（钩子→痛点→卖点→场景→行动号召）、情绪词、标签、图片风格与构图思路。拆解结果可保存为你的风格资产，后续直接复用。"
              />
            </Card>
          ) : (
            <Card
              title="拆解报告"
              extra={<Tag color="red">来自爆款：{link.slice(-8)}</Tag>}
              size="small"
              style={{ marginTop: 16 }}
            >
              {fetchedNote && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    borderRadius: 10,
                    background: "#fff7f2",
                    border: "1px solid #ffe0d1",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {fetchedNote.title || "未命名笔记"}
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 4 }}
                      >
                        {fetchedNote.author?.nickname || "未知作者"} ·{" "}
                        {fetchedNote.images.length} 张图
                        {fetchedNote.interact?.likedCount
                          ? ` · 赞 ${fetchedNote.interact.likedCount}`
                          : ""}
                      </div>
                    </div>
                    <Button
                      size="small"
                      loading={importing}
                      icon={<PictureOutlined />}
                      onClick={importNoteImages}
                    >
                      原图入库
                    </Button>
                  </div>
                  {fetchedNote.desc && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#5a6478",
                        marginTop: 8,
                        maxHeight: 64,
                        overflow: "hidden",
                      }}
                    >
                      {fetchedNote.desc}
                    </div>
                  )}
                  {previewImgState === "loading" && (
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 8 }}
                    >
                      原图加载中…
                    </div>
                  )}
                  {previewImgError && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 8 }}
                      message={previewImgError}
                    />
                  )}
                  {fetchedNote.images.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {fetchedNote.images.slice(0, 9).map((u, i) => (
                        <Image
                          key={`${u}-${i}`}
                          src={refImageMap[u] || u}
                          alt={`原图 ${i + 1}`}
                          width={54}
                          height={54}
                          style={{
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid #eee",
                          }}
                          preview={{ mask: "查看" }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 8 }}
                    >
                      该笔记没有返回图片，或图片解析失败
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    {fetchedNote.tags.slice(0, 8).map((t) => (
                      <Tag key={t} color="orange" style={{ marginRight: 4 }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <div className="form-label">构图分析（视觉）</div>
                {visionState === "analyzing" && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="正在用视觉模型分析每张爆款图的构图、光线、色调与适用槽位…"
                  />
                )}
                {visionState === "failed" && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    message={
                      visionError || "构图分析不可用，将回退到文字风格描述"
                    }
                    action={
                      Object.keys(refImageMap).length > 0 ? (
                        <Button
                          size="small"
                          onClick={() => analyzeComposition(refImageMap)}
                        >
                          重试
                        </Button>
                      ) : undefined
                    }
                  />
                )}
                {visionState === "done" && visionItems.length > 0 && (
                  <>
                    {overallStyle && (
                      <Tag color="purple" style={{ marginTop: 8 }}>
                        整体视觉风格：{overallStyle}
                      </Tag>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      {visionItems.map((v, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                            background: "#fafafa",
                            borderRadius: 8,
                            padding: 8,
                          }}
                        >
                          {v.dataUrl ? (
                            <Image
                              src={v.dataUrl}
                              width={48}
                              height={48}
                              style={{
                                objectFit: "cover",
                                borderRadius: 6,
                                flexShrink: 0,
                              }}
                              preview={{ mask: "查看" }}
                            />
                          ) : null}
                          <div
                            style={{
                              fontSize: 12,
                              color: "#444",
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {v.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="选题角度">
                  {report?.angle}
                </Descriptions.Item>
                <Descriptions.Item label="标题公式">
                  {report?.titleFormula}
                </Descriptions.Item>
                <Descriptions.Item label="图片风格">
                  {report?.style}
                </Descriptions.Item>
                <Descriptions.Item label="构图与风格思路">
                  {report?.composition}
                </Descriptions.Item>
              </Descriptions>
              <Divider style={{ margin: "12px 0" }} />
              <div className="form-label">正文结构</div>
              <Timeline
                style={{ marginTop: 8 }}
                items={(report?.structure || []).map((s) => ({
                  children: s,
                }))}
              />
              <div className="form-label">情绪词</div>
              <div className="chips" style={{ margin: "8px 0 12px" }}>
                {(report?.emotionWords || []).map((w) => (
                  <Tag key={w} color="magenta">
                    {w}
                  </Tag>
                ))}
              </div>
              <div className="form-label">标签</div>
              <div className="chips" style={{ margin: "8px 0 12px" }}>
                {(report?.tags || []).map((t) => (
                  <Tag key={t} color="blue">
                    {t}
                  </Tag>
                ))}
              </div>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  loading={candLoading}
                  onClick={() => void genCandidates()}
                >
                  下一步：生成笔记（3 个候选）
                </Button>
                <Button block icon={<SaveOutlined />} onClick={openSaveStyle}>
                  保存为风格资产
                </Button>
              </Space>
            </Card>
          )}
        </>
      )}

      {step === 1 && (
        <Card
          title="2 · 生成笔记（3 个候选角度）"
          extra={
            <Button
              icon={<SyncOutlined />}
              loading={candLoading}
              onClick={() => void genCandidates()}
            >
              换一批
            </Button>
          }
        >
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 14 }}
            message="复刻的是结构与风格，正文已按你的产品重新撰写；平台对原文搬运会限流，请勿直接复制爆款原文。"
          />
          {candidates.length === 0 ? (
            <Empty description="还没有候选笔记">
              <Button
                type="primary"
                loading={candLoading}
                onClick={() => void genCandidates()}
              >
                生成候选
              </Button>
            </Empty>
          ) : (
            <Tabs
              activeKey={String(candIndex)}
              onChange={(k) => setCandIndex(Number(k))}
              items={candidates.map((c, i) => ({
                key: String(i),
                label: `候选 ${i + 1} · ${c.title.slice(0, 14)}…`,
                children:
                  editing && i === candIndex ? (
                    <div>
                      <div className="form-label">标题</div>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <div className="form-label" style={{ marginTop: 10 }}>
                        正文（每段一行）
                      </div>
                      <Input.TextArea
                        rows={6}
                        value={editParas}
                        onChange={(e) => setEditParas(e.target.value)}
                      />
                      <Space style={{ marginTop: 12 }}>
                        <Button
                          type="primary"
                          icon={<CheckOutlined />}
                          onClick={saveEdit}
                        >
                          保存修改
                        </Button>
                        <Button onClick={() => setEditing(false)}>取消</Button>
                      </Space>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 600 }}>
                        {c.title}
                      </h3>
                      {c.paras.map((p, pi) => (
                        <p
                          key={pi}
                          style={{
                            fontSize: 14,
                            lineHeight: 1.9,
                            color: "#333a48",
                          }}
                        >
                          {p}
                        </p>
                      ))}
                      <Space wrap style={{ marginTop: 6 }}>
                        {c.tags.map((t) => (
                          <Tag key={t} color="red">
                            {t}
                          </Tag>
                        ))}
                      </Space>
                      <Divider />
                      <Space>
                        <Button
                          type="primary"
                          icon={<CheckOutlined />}
                          onClick={() => selectCandidate(i)}
                        >
                          采纳并生成配图
                        </Button>
                        <Button icon={<EditOutlined />} onClick={startEdit}>
                          手动微调
                        </Button>
                      </Space>
                    </div>
                  ),
              }))}
            />
          )}
        </Card>
      )}

      {step === 2 && (
        <Card
          title={`3 · 生成配图（${
            genMode === "template"
              ? selectedTpls.length
              : genMode === "compose"
                ? refImageList.length
                : Object.keys(slotImages).filter((k) => slotImages[k]).length
          } 张）`}
          extra={
            <Space size={8} wrap>
              <Tag color={imgProviderTag.color}>{imgProviderTag.label}</Tag>
              <span
                className="num"
                style={{ fontWeight: 600, color: "#2F54EB" }}
              >
                本组成本：¥{totalCost.toFixed(2)}
              </span>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 14 }}
            message={
              genMode === "template"
                ? "模板出图：产品用真实图片 AI 抠图后，套进内置模板渲染，产品 100% 真实一致，秒级出图。"
                : genMode === "compose"
                  ? "爆款场景合成：AI 只生成场景背景（参考爆款构图，不含产品与人物），再把真实产品抠图合成进去。"
                  : "全部用户上传：不限制张数，从本机自由添加图片，不调用 AI，成本 0 元。"
            }
          />
          {(genMode === "template" || genMode === "compose") && (
            <Space wrap size={6} style={{ marginBottom: 12 }}>
              <Tag color="blue">固定产品：{product || "未选择"}</Tag>
              <Tag color={currentProduct?.mainImage ? "success" : "warning"}>
                产品图：{getCutoutSource() ? "已就绪" : "未上传"}
              </Tag>
              {genMode === "compose" && (
                <Tag
                  color={
                    Object.keys(refImageMap).length ? "success" : "warning"
                  }
                >
                  爆款原图：
                  {Object.keys(refImageMap).length
                    ? `${Object.keys(refImageMap).length} 张已就绪`
                    : "未下载"}
                </Tag>
              )}
            </Space>
          )}
          <Segmented
            block
            style={{ marginBottom: 14 }}
            value={genMode}
            onChange={(v) => {
              setGenMode(v as "template" | "compose" | "upload");
              setImgDone(false);
              setImgError("");
            }}
            options={[
              { label: "模板出图", value: "template" },
              { label: "爆款场景合成", value: "compose" },
              { label: "全部用户上传", value: "upload" },
            ]}
          />
          {imgError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 14 }}
              message={imgError}
            />
          )}
          {genMode !== "upload" && (
            <div
              style={{
                border: "1px solid #edf0f7",
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div className="form-label">产品图片来源</div>
              <Segmented
                value={cutoutSrc}
                onChange={(v) => {
                  setCutoutSrc(v as "main" | "scene" | "custom");
                  setCutoutDataUrl("");
                  setLastCutoutSrc("");
                  setImgDone(false);
                }}
                options={[
                  { label: "产品主图", value: "main" },
                  { label: "场景图", value: "scene" },
                  { label: "本地上传", value: "custom" },
                ]}
              />
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <Image
                    src={getCutoutSource() || ""}
                    width={72}
                    height={96}
                    style={{
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid #eee",
                    }}
                    preview={{ mask: "原图" }}
                  />
                  <div className="muted" style={{ fontSize: 11 }}>
                    原图
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Image
                    src={cutoutDataUrl || ""}
                    width={72}
                    height={96}
                    style={{
                      objectFit: "contain",
                      borderRadius: 8,
                      border: "1px solid #eee",
                      background:
                        "repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px",
                    }}
                    preview={{ mask: "抠图" }}
                  />
                  <div className="muted" style={{ fontSize: 11 }}>
                    {cutoutDataUrl ? "抠图结果" : "未抠图"}
                  </div>
                </div>
                {cutoutSrc === "custom" && (
                  <Button
                    size="small"
                    icon={<UploadOutlined />}
                    onClick={pickCustomCutout}
                  >
                    选择产品图
                  </Button>
                )}
                {cutoutDataUrl ? (
                  <Button
                    size="small"
                    loading={cutoutLoading}
                    onClick={runCutout}
                  >
                    重新抠图
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    loading={cutoutLoading}
                    onClick={runCutout}
                  >
                    AI 抠图
                  </Button>
                )}
              </div>
            </div>
          )}
          {genMode === "template" && (
            <>
              <div className="form-label" style={{ marginBottom: 8 }}>
                选择模板（可多选，每套出一张）
              </div>
              <Row gutter={[10, 10]}>
                {NOTE_TEMPLATES.map((tpl) => {
                  const active = selectedTpls.includes(tpl.id);
                  return (
                    <Col xs={12} md={8} key={tpl.id}>
                      <div
                        onClick={() => toggleTpl(tpl.id)}
                        style={{
                          border: active
                            ? "2px solid #2F54EB"
                            : "1px solid #edf0f7",
                          borderRadius: 10,
                          padding: 10,
                          cursor: "pointer",
                          background: active ? "#f0f5ff" : "#fff",
                        }}
                      >
                        <div
                          style={{
                            height: 70,
                            borderRadius: 8,
                            background:
                              tpl.bg.type === "radial"
                                ? `radial-gradient(circle at 50% 45%, ${tpl.bg.colors.join(", ")})`
                                : `linear-gradient(${tpl.bg.angle || 135}deg, ${tpl.bg.colors.join(", ")})`,
                          }}
                        />
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            marginTop: 6,
                          }}
                        >
                          {tpl.name}
                          {active ? (
                            <Tag color="blue" style={{ marginLeft: 4 }}>
                              已选
                            </Tag>
                          ) : null}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {tpl.desc}
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
              <Button
                type="primary"
                block
                size="large"
                icon={<PictureOutlined />}
                style={{ marginTop: 14 }}
                loading={imgLoading || cutoutLoading}
                onClick={generateImages}
              >
                渲染模板配图（{selectedTpls.length} 张）
              </Button>
            </>
          )}
          {genMode === "compose" && (
            <>
              {refImageList.length === 0 ? (
                <Empty description="还没有爆款原图，请先回到第一步解析爆款笔记">
                  <Button type="primary" onClick={() => setStep(0)}>
                    返回解析
                  </Button>
                </Empty>
              ) : (
                <Row gutter={[10, 10]}>
                  {refImageList.map((ref, i) => {
                    const key = `img-${i}`;
                    const done = !!slotImages[key];
                    return (
                      <Col xs={12} md={8} key={key}>
                        <div
                          className={`cost-chip ${imgDone ? "selected" : ""}`}
                          style={{
                            width: "100%",
                            flexDirection: "column",
                            alignItems: "stretch",
                          }}
                        >
                          <div
                            style={{
                              height: 74,
                              borderRadius: 8,
                              background: "#f6f8ff",
                              border: "1px solid #edf0f7",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            <Image
                              src={done ? slotImages[key] : ref}
                              alt={`合成图 ${i + 1}`}
                              width="100%"
                              height="100%"
                              style={{ objectFit: "cover" }}
                              preview={{ mask: done ? "查看" : "爆款" }}
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 6,
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                              爆款图 {i + 1}
                            </span>
                            <Tag
                              color={done ? "green" : "default"}
                              style={{ marginLeft: 6 }}
                            >
                              {done ? "已合成" : "待生成"}
                            </Tag>
                          </div>
                          <div
                            className="muted"
                            style={{ fontSize: 12, marginTop: 4 }}
                          >
                            AI 背景 · ¥
                            {(
                              PRICES[tier as keyof typeof PRICES] + 0.05
                            ).toFixed(2)}
                          </div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              )}
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <div className="form-label">背景档位</div>
                  <Segmented
                    block
                    value={tier}
                    onChange={(v) => setTier(v as string)}
                    options={[
                      { label: "低价 0.06", value: "low" },
                      { label: "主流 0.20", value: "mid" },
                      { label: "旗舰 0.30", value: "pro" },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div className="form-label">AI 平均重试：{retries} 次</div>
                  <Slider
                    min={0}
                    max={3}
                    value={retries}
                    onChange={(v) => setRetries(v)}
                  />
                </Col>
                <Col
                  span={8}
                  style={{ display: "flex", alignItems: "flex-end" }}
                >
                  <Button
                    type="primary"
                    block
                    icon={<PictureOutlined />}
                    loading={imgLoading || cutoutLoading}
                    onClick={generateImages}
                  >
                    {imgLoading && imgProgress > 0
                      ? `生成中 ${imgProgress}/${refImageList.length}`
                      : "生成场景合成图"}
                  </Button>
                </Col>
              </Row>
            </>
          )}
          {genMode === "upload" && (
            <Space style={{ marginBottom: 10 }}>
              <Button icon={<UploadOutlined />} onClick={() => uploadForSlot()}>
                添加图片
              </Button>
              <Button icon={<UploadOutlined />} onClick={batchUpload}>
                批量添加（一次最多 9 张）
              </Button>
            </Space>
          )}
          {genMode === "upload" &&
            (Object.keys(slotImages).length === 0 ? (
              <Empty description="还没有上传图片，添加至少 1 张" />
            ) : (
              <Row gutter={[10, 10]}>
                {Object.entries(slotImages).map(([key, dataUrl]) => (
                  <Col xs={12} md={8} key={key}>
                    <div
                      className="cost-chip"
                      style={{
                        width: "100%",
                        flexDirection: "column",
                        alignItems: "stretch",
                      }}
                    >
                      <div
                        style={{
                          height: 74,
                          borderRadius: 8,
                          background: "#f6f8ff",
                          border: "1px solid #edf0f7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <Image
                          src={dataUrl}
                          alt={`上传图 ${Number(key.replace("img-", "")) + 1}`}
                          width="100%"
                          height="100%"
                          style={{ objectFit: "cover" }}
                          preview={{ mask: "查看" }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 6,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          图片 {Number(key.replace("img-", "")) + 1}
                        </span>
                        <Tag color="green">已上传</Tag>
                      </div>
                      <Button
                        size="small"
                        block
                        icon={<DeleteOutlined />}
                        style={{ marginTop: 4 }}
                        onClick={() =>
                          setSlotImages((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          })
                        }
                      >
                        移除
                      </Button>
                    </div>
                  </Col>
                ))}
              </Row>
            ))}

          {genMode === "upload" && (
            <Button
              type="primary"
              block
              size="large"
              icon={<CheckOutlined />}
              style={{ marginTop: 16 }}
              loading={imgLoading}
              onClick={generateImages}
            >
              确认上传配图（
              {Object.keys(slotImages).filter((k) => slotImages[k]).length} 张）
            </Button>
          )}

          <Button
            type="primary"
            block
            size="large"
            style={{ marginTop: 18 }}
            onClick={() => setStep(3)}
          >
            下一步：发布
          </Button>
        </Card>
      )}

      {step === 3 && (
        <Card title="4 · 发布">
          {published ? (
            <Result
              status="success"
              title="笔记已加入发布队列"
              subTitle={`${pubMsg}${aiMark ? "；已标注含 AI 内容" : ""}`}
              extra={[
                <Button
                  type="primary"
                  key="again"
                  icon={<FireOutlined />}
                  onClick={publishAgain}
                >
                  再复刻一条
                </Button>,
              ]}
            />
          ) : (
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <div className="form-label">发布账号</div>
                <Select
                  style={{ width: "100%" }}
                  value={pubAccount}
                  onChange={setPubAccount}
                  placeholder={
                    xhsAccounts.length
                      ? "选择发布账号"
                      : "暂无已登录的小红书账号"
                  }
                  options={xhsAccounts.map((a) => ({
                    value: a.name,
                    label: a.name,
                  }))}
                />
                {xhsAccounts.length === 0 && (
                  <Alert
                    style={{ marginTop: 8 }}
                    type="warning"
                    showIcon
                    message="还没有可发布的小红书账号，请先到「发布中心 → 账号管理」扫码登录。"
                  />
                )}
                <div className="form-label" style={{ marginTop: 12 }}>
                  发布方式
                </div>
                <Radio.Group
                  value={pubMode}
                  onChange={(e) => setPubMode(e.target.value)}
                >
                  <Radio value="立即发布">立即发布</Radio>
                  <Radio value="定时发布">定时发布</Radio>
                </Radio.Group>
                {pubMode === "定时发布" && (
                  <Select
                    style={{ width: 140, marginTop: 10 }}
                    value={pubTime}
                    onChange={setPubTime}
                    options={[
                      "08:00",
                      "10:00",
                      "12:00",
                      "14:00",
                      "18:00",
                      "20:00",
                    ].map((t) => ({ value: t, label: t }))}
                  />
                )}
                <div style={{ marginTop: 16 }}>
                  <Space>
                    <Switch checked={aiMark} onChange={setAiMark} />
                    <span style={{ fontSize: 13 }}>标注「含 AI 生成内容」</span>
                  </Space>
                </div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                  message="小红书无官方发布 API，自动发布通过浏览器自动化实现，请控制发布频率并保持内容原创性。"
                />
                <Button
                  type="primary"
                  block
                  size="large"
                  style={{ marginTop: 18 }}
                  onClick={publish}
                >
                  确认发布
                </Button>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="发布前检查">
                  <Space direction="vertical">
                    <Tag color="green">标题 24 字以内，含关键词</Tag>
                    <Tag color="green">正文 ≥ 200 字，含 1 个行动号召</Tag>
                    <Tag color="green">配图 6 张，封面为 3:4</Tag>
                    <Tag color="blue">标签 5 个，覆盖人群 + 场景 + 品类</Tag>
                  </Space>
                </Card>
              </Col>
            </Row>
          )}
        </Card>
      )}
    </Col>
  );
}
