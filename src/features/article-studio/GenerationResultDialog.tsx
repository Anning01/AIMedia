import { Empty,Modal,Tag } from "@/components/shared/controls";
import { BLOCK_LABELS,FLOW_STEPS,LAYOUT_LABELS } from "./model";
import { useArticleWorkspace } from "./workspace-context";

export function GenerationResultDialog() {
  const { flowOpen, setFlowOpen, outline, blocks, template, effective } =
    useArticleWorkspace();

  return (
    <Modal
      title={
        flowOpen ? FLOW_STEPS.find((s) => s.key === flowOpen)?.label || "" : ""
      }
      open={!!flowOpen}
      onCancel={() => setFlowOpen(null)}
      footer={null}
      width={720}
    >
      {flowOpen === "outline" && (
        <pre className="gen-flow-pre">{outline || "大纲尚未生成"}</pre>
      )}
      {flowOpen === "article" && (
        <div className="gen-flow-blocks">
          {blocks.length === 0 ? (
            <Empty description="文章尚未生成" />
          ) : (
            blocks.map((b) => (
              <div key={b.id} className="gen-flow-block">
                <Tag color="blue" style={{ flexShrink: 0 }}>
                  {BLOCK_LABELS[b.type] || b.type}
                </Tag>
                <span>
                  {b.text ||
                    (b.items || []).join(" / ") ||
                    (b.src ? "（配图）" : "")}
                </span>
              </div>
            ))
          )}
        </div>
      )}
      {flowOpen === "layout" && (
        <div className="gen-flow-layout">
          <p>
            模板：{template.name}（{template.category} · {template.desc}）
          </p>
          <p>布局：{LAYOUT_LABELS[effective.layout] || effective.layout}</p>
          <p>主标题样式：{effective.title}</p>
          <p>小标题样式：{effective.h2}</p>
          <p>
            清单：{effective.list} · 卡片：{effective.card} · 引用：
            {effective.quote} · CTA：{effective.ctaStyle}
          </p>
          <p>纸张：{effective.paper}</p>
        </div>
      )}
    </Modal>
  );
}
