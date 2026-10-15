import { Input,Modal,Segmented } from "@/components/shared/controls";
import { IMAGE_STYLES } from "@/data/imageStyles";
import { useImageMaker } from "./useImageMaker";
type Props = Pick<
  ReturnType<typeof useImageMaker>,
  | "aiOpen"
  | "setAiOpen"
  | "generateAi"
  | "aiLoading"
  | "aiPrompt"
  | "setAiPrompt"
  | "aiStyle"
  | "setAiStyle"
>;
export function ImageGenerationDialog({
  aiOpen,
  setAiOpen,
  generateAi,
  aiLoading,
  aiPrompt,
  setAiPrompt,
  aiStyle,
  setAiStyle,
}: Props) {
  return (
    <Modal
      title="AI 生成背景图"
      open={aiOpen}
      onCancel={() => setAiOpen(false)}
      onOk={generateAi}
      okText="生成"
      confirmLoading={aiLoading}
    >
      <div className="form-label">画面描述</div>
      <Input.TextArea
        rows={3}
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
        placeholder="例：秋冬暖色调养生场景，一杯热茶，木质桌面，柔光，适合公众号封面"
      />
      <div className="form-label" style={{ marginTop: 12 }}>
        整体风格
      </div>
      <Segmented
        block
        value={aiStyle}
        onChange={(v) => setAiStyle(v as string)}
        options={IMAGE_STYLES.map((s) => ({ label: s.name, value: s.id }))}
      />
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        按接口实际计费，生成的图片自动存入素材库，可重复使用。注意：AI
        生图对中文文字支持差，画面中的文字请用右侧文字图层叠加（真实中文，不依赖生图）。
      </div>
    </Modal>
  );
}
