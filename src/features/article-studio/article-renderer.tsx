import CoverThumb from "@/components/CoverThumb";
import {
Button,
Col,
Dropdown,
Empty,
InputNumber,
Row,
Select,
Switch,
Tooltip,
} from "@/components/shared/controls";
import {
DeleteOutlined,
PictureOutlined,
PlusOutlined,
} from "@/components/shared/icons";
import type { TemplateDesign } from "@/data/articleTemplates";
import type {
CoverTextZone,
StickerCoverTemplate,
} from "@/data/stickerTemplates";
import { DEFAULT_COVER_ZONE } from "@/data/stickerTemplates";
import { useEffect,useRef } from "react";
import { Block,BlockType,buildLayoutGroups,TOOLBAR } from "./model";
export function BlockView({ block, accent }: { block: Block; accent: string }) {
  switch (block.type) {
    case "title":
      return <h1 className="ae-title">{block.text}</h1>;
    case "subtitle":
      return <div className="ae-subtitle">{block.text}</div>;
    case "h2":
      return <div className="ae-h2">{block.text}</div>;
    case "p":
      return <p className="ae-p">{block.text}</p>;
    case "quote":
      return <div className="ae-quote">{block.text}</div>;
    case "card":
      return <div className="ae-card">{block.text}</div>;
    case "list":
      return (
        <ul className="ae-list">
          {block.items?.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "infoGrid": {
      const items = block.items ?? [];
      const cells: React.ReactNode[] = [];
      for (let i = 0; i < items.length; i += 2) {
        cells.push(
          <div className="ig-cell" key={i}>
            <p className="ig-label">{items[i]}</p>
            <p className="ig-value">{items[i + 1] || ""}</p>
          </div>,
        );
      }
      return <div className="ae-info-grid">{cells}</div>;
    }
    case "badges":
      return (
        <div className="ae-badges">
          {(block.items ?? []).map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      );
    case "tip":
      return (
        <div className="ae-tip">
          <span className="ae-tip-mark">提示</span>
          <span>{block.text}</span>
        </div>
      );
    case "image":
      return block.src ? (
        <div className="ae-image-block">
          <img
            className="ae-image-img"
            src={block.src}
            alt={block.text || ""}
          />
          {block.text ? <div className="ae-image-cap">{block.text}</div> : null}
        </div>
      ) : (
        <div className="ae-image">
          🖼 {block.text || "图片占位：插入你的图片"}
        </div>
      );
    case "follow":
      return (
        <div className="ae-follow">
          <span className="ae-follow-text">{block.text}</span>
          <span className="ae-follow-btn">关注我们</span>
        </div>
      );
    case "divider":
      return <div className="ae-divider" />;
    case "cta":
      return <div className="ae-cta">{block.text}</div>;
    default:
      return null;
  }
}

export function InlineEditable({
  initial,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.textContent !== initial) {
      ref.current.textContent = initial;
    }
    // 只在挂载时写入初始内容，避免输入时光标跳动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      className="ae-inline-edit"
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange(e.currentTarget.textContent || "")}
      onBlur={onSave}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (
          (e.key === "Backspace" || e.key === "Delete") &&
          !(ref.current?.textContent || "").trim()
        ) {
          e.preventDefault();
          onDelete();
        }
      }}
    />
  );
}

export function renderArticleBody(
  blocks: Block[],
  template: TemplateDesign,
  onUploadImage?: (id: string) => void,
  edit?: InlineEditController,
) {
  const wrap = (b: Block) => {
    const isEditing = edit?.editingId === b.id;
    return (
      <div
        className={`ae-block${isEditing ? " ae-block-editing" : ""}`}
        key={b.id}
      >
        {b.type === "image" && onUploadImage && !isEditing && (
          <Tooltip title={b.src ? "更换图片" : "选择图片"}>
            <Button
              type="text"
              size="small"
              className="block-img"
              icon={<PictureOutlined />}
              onClick={() => onUploadImage(b.id)}
            />
          </Tooltip>
        )}
        {edit && !isEditing && b.type !== "divider" && (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: TOOLBAR.filter((t) => t.type !== "divider").map((t) => ({
                key: t.type,
                label: t.label,
              })),
              onClick: ({ key }) => edit.onInsertAfter(b.id, key as BlockType),
            }}
          >
            <Tooltip title="在此插入模块">
              <Button
                type="text"
                size="small"
                className="block-add"
                icon={<PlusOutlined />}
              />
            </Tooltip>
          </Dropdown>
        )}
        <div
          className="ae-editable"
          onClick={() => {
            if (!isEditing && edit && b.type !== "divider") edit.onStart(b);
          }}
        >
          {isEditing ? (
            ["list", "infoGrid", "badges"].includes(b.type) ? (
              <textarea
                className="ae-inline-edit"
                autoFocus
                value={edit?.value || ""}
                onChange={(e) => edit?.onChange(e.target.value)}
                onBlur={() => edit?.onSave()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    edit?.onCancel();
                  } else if (
                    (e.key === "Backspace" || e.key === "Delete") &&
                    !(edit?.value || "").trim()
                  ) {
                    e.preventDefault();
                    edit?.onDelete(b.id);
                  }
                }}
              />
            ) : (
              <InlineEditable
                initial={edit?.value || ""}
                onChange={(v) => edit?.onChange(v)}
                onSave={() => edit?.onSave()}
                onCancel={() => edit?.onCancel()}
                onDelete={() => edit?.onDelete(b.id)}
              />
            )
          ) : (
            <BlockView block={b} accent={template.accent} />
          )}
        </div>
      </div>
    );
  };

  if (template.layout === "cards" || template.layout === "faq") {
    const { lead, groups } = buildLayoutGroups(blocks, "cards");
    return (
      <>
        {lead.map(wrap)}
        {groups.map((g, i) => (
          <div
            className={template.layout === "faq" ? "layout-faq" : "layout-card"}
            key={`card${i}`}
          >
            {g.map(wrap)}
          </div>
        ))}
      </>
    );
  }

  if (template.layout === "toc") {
    const toc = blocks.filter((b) => b.type === "h2");
    return (
      <>
        {toc.length > 0 && (
          <div className="layout-toc">
            <div className="toc-title">📑 本文目录</div>
            <div className="toc-sub">
              共 {toc.length} 节，按序阅读或直达你最关心的部分
            </div>
            {toc.map((b, i) => (
              <div className="toc-item" key={b.id}>
                <span className="toc-num">{i + 1}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        )}
        {blocks.map(wrap)}
      </>
    );
  }

  if (template.layout === "timeline") {
    const { lead, groups } = buildLayoutGroups(blocks, "cards");
    return (
      <>
        {lead.map(wrap)}
        {groups.map((g, i) => (
          <div key={`tl${i}`}>
            <div className="layout-timeline">
              {g.filter((b) => b.type !== "list").map(wrap)}
            </div>
            {g.filter((b) => b.type === "list").map(wrap)}
          </div>
        ))}
      </>
    );
  }

  if (template.layout === "banner") {
    const banner: Block[] = [];
    const rest: Block[] = [];
    let inBanner = true;
    for (const b of blocks) {
      if (inBanner && (b.type === "title" || b.type === "subtitle")) {
        banner.push(b);
        continue;
      }
      inBanner = false;
      rest.push(b);
    }
    return (
      <>
        {banner.length > 0 && (
          <div className="layout-banner">{banner.map(wrap)}</div>
        )}
        {rest.map(wrap)}
      </>
    );
  }

  return <>{blocks.map(wrap)}</>;
}

export function ZoneEditor({
  title,
  zone,
  onChange,
}: {
  title: string;
  zone?: CoverTextZone;
  onChange: (patch: Partial<CoverTextZone>) => void;
}) {
  const z = zone || DEFAULT_COVER_ZONE;
  const color = /^#[0-9a-f]{6}$/i.test(z.color) ? z.color : "#1A1A1A";
  return (
    <>
      <div className="form-label" style={{ marginTop: 8 }}>
        {title}
      </div>
      <Row gutter={[8, 6]}>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            X %
          </div>
          <InputNumber
            size="small"
            min={0}
            max={100}
            value={z.x}
            onChange={(v) => onChange({ x: Number(v) || 0 })}
            style={{ width: "100%" }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            Y %
          </div>
          <InputNumber
            size="small"
            min={0}
            max={100}
            value={z.y}
            onChange={(v) => onChange({ y: Number(v) || 0 })}
            style={{ width: "100%" }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            宽 %
          </div>
          <InputNumber
            size="small"
            min={1}
            max={100}
            value={z.w}
            onChange={(v) => onChange({ w: Number(v) || 10 })}
            style={{ width: "100%" }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            高 %
          </div>
          <InputNumber
            size="small"
            min={1}
            max={100}
            value={z.h}
            onChange={(v) => onChange({ h: Number(v) || 10 })}
            style={{ width: "100%" }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            字号 px
          </div>
          <InputNumber
            size="small"
            min={10}
            max={200}
            value={z.size}
            onChange={(v) => onChange({ size: Number(v) || 40 })}
            style={{ width: "100%" }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            最大行数
          </div>
          <InputNumber
            size="small"
            min={1}
            max={20}
            value={z.maxLines}
            onChange={(v) => onChange({ maxLines: Number(v) || 2 })}
            style={{ width: "100%" }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            颜色
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => onChange({ color: e.target.value })}
            style={{
              width: "100%",
              height: 24,
              border: "1px solid #d9d9d9",
              borderRadius: 4,
              padding: 1,
              cursor: "pointer",
            }}
          />
        </Col>
        <Col span={6}>
          <div className="muted" style={{ fontSize: 11 }}>
            对齐
          </div>
          <Select
            size="small"
            style={{ width: "100%" }}
            value={z.align}
            onChange={(v) => onChange({ align: v })}
            options={[
              { value: "left", label: "左" },
              { value: "center", label: "中" },
              { value: "right", label: "右" },
            ]}
          />
        </Col>
        <Col span={12}>
          <Switch
            checked={z.bold}
            onChange={(v) => onChange({ bold: v })}
            size="small"
          />{" "}
          加粗
        </Col>
      </Row>
    </>
  );
}

export function renderStickerBody(
  blocks: Block[],
  coverTpl: StickerCoverTemplate,
  coverTitle: string,
  coverText: string,
  onUploadImage?: (id: string) => void,
  edit?: InlineEditController,
  coverRef?: React.Ref<HTMLDivElement>,
  onRenderCover?: () => void,
  renderingCover?: boolean,
) {
  const imageBlocks = blocks.filter((b) => b.type === "image");
  const coverBlock = imageBlocks.find((b) => b.cover);
  const otherImages = imageBlocks.filter((b) => !b.cover);
  const textBlocks = blocks.filter((b) => b.type !== "image");
  return (
    <div style={{ padding: "18px 20px" }}>
      <div
        className="form-label"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        轮播图（首图 + {otherImages.length} 张）
        {onRenderCover && (
          <Button
            size="small"
            icon={<PictureOutlined />}
            loading={renderingCover}
            onClick={onRenderCover}
          >
            自动排版
          </Button>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 10,
        }}
      >
        {coverBlock ? (
          <div
            key={coverBlock.id}
            style={{
              position: "relative",
              width: 128,
              height: Math.round((128 * 4) / 3),
              flexShrink: 0,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #d0d7e4",
              background: "#f7f8fc",
              cursor: "pointer",
            }}
            onClick={() => onUploadImage?.(coverBlock.id)}
          >
            <img
              src={coverBlock.src}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <span
              style={{
                position: "absolute",
                left: 4,
                top: 4,
                background: "#2F54EB",
                color: "#fff",
                fontSize: 10,
                lineHeight: 1,
                padding: "3px 6px",
                borderRadius: 6,
              }}
            >
              首图 · {coverTpl.name}
            </span>
            {edit && (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  background: "rgba(255,255,255,.85)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  edit.onDelete(coverBlock.id);
                }}
              />
            )}
          </div>
        ) : (
          <div ref={coverRef} style={{ width: 128, flexShrink: 0 }}>
            <CoverThumb tpl={coverTpl} title={coverTitle} text="" />
          </div>
        )}
        {otherImages.map((b) => (
          <div
            key={b.id}
            style={{
              position: "relative",
              width: 128,
              height: Math.round((128 * 4) / 3),
              flexShrink: 0,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
              background: "#f7f8fc",
              cursor: "pointer",
            }}
            onClick={() => onUploadImage?.(b.id)}
          >
            {b.src ? (
              <img
                src={b.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8a93a6",
                  fontSize: 12,
                  gap: 6,
                }}
              >
                <PictureOutlined />
                点击上传
              </div>
            )}
            {b.card && (
              <span
                style={{
                  position: "absolute",
                  left: 4,
                  top: 4,
                  background: "#7C3AED",
                  color: "#fff",
                  fontSize: 10,
                  lineHeight: 1,
                  padding: "3px 6px",
                  borderRadius: 6,
                }}
              >
                内容卡
              </span>
            )}
            {edit && (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  background: "rgba(255,255,255,.85)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  edit.onDelete(b.id);
                }}
              />
            )}
          </div>
        ))}
        {otherImages.length === 0 && !coverBlock && (
          <div
            style={{
              width: 128,
              height: Math.round((128 * 4) / 3),
              flexShrink: 0,
              borderRadius: 10,
              border: "1px dashed #c9d0dc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8a93a6",
              fontSize: 12,
            }}
          >
            暂无图片
          </div>
        )}
      </div>

      <div className="form-label" style={{ marginTop: 16 }}>
        内容排版（最终效果）
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "24px 18px",
          boxShadow: "0 2px 10px rgba(0,0,0,.06)",
        }}
      >
        {textBlocks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="点击上方工具栏添加「标题」「正文」「图片」，或直接生成贴图"
            style={{ margin: "16px 0" }}
          />
        ) : (
          textBlocks.map((b) => {
            const isEditing = edit?.editingId === b.id;
            const isTitle = b.type === "title";
            const text = b.items ? b.items.join("\n") : b.text || "";
            return (
              <div
                key={b.id}
                className={`ae-block${isEditing ? " ae-block-editing" : ""}`}
                style={{ marginBottom: isTitle ? 16 : 22 }}
              >
                {edit && !isEditing && b.type !== "divider" && (
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: TOOLBAR.filter((t) => t.type !== "divider").map(
                        (t) => ({
                          key: t.type,
                          label: t.label,
                        }),
                      ),
                      onClick: ({ key }) =>
                        edit.onInsertAfter(b.id, key as BlockType),
                    }}
                  >
                    <Tooltip title="在此插入模块">
                      <Button
                        type="text"
                        size="small"
                        className="block-add"
                        icon={<PlusOutlined />}
                      />
                    </Tooltip>
                  </Dropdown>
                )}
                <div
                  className="ae-editable"
                  onClick={() => {
                    if (!isEditing && edit && b.type !== "divider")
                      edit.onStart(b);
                  }}
                >
                  {isEditing ? (
                    ["list", "infoGrid", "badges"].includes(b.type) ? (
                      <textarea
                        className="ae-inline-edit"
                        autoFocus
                        value={edit?.value || ""}
                        onChange={(e) => edit?.onChange(e.target.value)}
                        onBlur={() => edit?.onSave()}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            edit?.onCancel();
                          } else if (
                            (e.key === "Backspace" || e.key === "Delete") &&
                            !(edit?.value || "").trim()
                          ) {
                            e.preventDefault();
                            edit?.onDelete(b.id);
                          }
                        }}
                      />
                    ) : (
                      <InlineEditable
                        initial={edit?.value || ""}
                        onChange={(v) => edit?.onChange(v)}
                        onSave={() => edit?.onSave()}
                        onCancel={() => edit?.onCancel()}
                        onDelete={() => edit?.onDelete(b.id)}
                      />
                    )
                  ) : (
                    <div
                      style={{
                        fontSize: isTitle ? 22 : 15,
                        fontWeight: isTitle ? 800 : 400,
                        textAlign: isTitle ? "center" : "left",
                        color: "#1a1a1a",
                        lineHeight: 1.8,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        fontFamily: isTitle
                          ? `'Smiley Sans','Microsoft YaHei',sans-serif`
                          : `'Microsoft YaHei',sans-serif`,
                      }}
                    >
                      {text || "（空内容，点击编辑）"}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export interface InlineEditController {
  editingId: string | null;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStart: (b: Block) => void;
  onDelete: (id: string) => void;
  onInsertAfter: (id: string, type: BlockType) => void;
}

export const COVER_HIGHLIGHT_OPTIONS = [
  "marker",
  "color",
  "underline",
  "circle",
  "correction",
  "block",
  "ink",
  "circleUnderline",
  "none",
].map((v) => ({ value: v, label: v === "none" ? "无" : v }));

export const COVER_FONT_OPTIONS = [
  "smiley",
  "sans",
  "serif",
  "kaiti",
  "type",
].map((v) => ({ value: v, label: v }));
