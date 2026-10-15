import { Input, Segmented } from "@/components/shared/controls";
import { CreationImages } from "./creation/CreationImages";
import { CreationSettings } from "./creation/CreationSettings";
import { GenerationProgress } from "./creation/GenerationProgress";
import { useArticleWorkspace } from "./workspace-context";
export function GenerationPanel() {
  const { topic, setTopic, contentType, setContentType, generating } =
    useArticleWorkspace();
  return (
    <div className="creation-prepare-layout">
      <section className="creation-topic-panel">
        <div className="creation-section-heading">
          <h2>主题 / 素材</h2>
          <fieldset disabled={generating} className="m-0 min-w-0 border-0 p-0">
            <Segmented
              value={contentType}
              onChange={(value) =>
                setContentType(value as "article" | "sticker")
              }
              options={[
                { label: "文章", value: "article" },
                { label: "贴图", value: "sticker" },
              ]}
            />
          </fieldset>
        </div>
        <Input.TextArea
          id="creation-topic"
          aria-label="主题或素材"
          value={topic}
          disabled={generating}
          onChange={(event) => setTopic(event.target.value)}
          placeholder={
            contentType === "sticker"
              ? "输入贴图主题或素材描述"
              : "输入文章主题或素材描述，可直接粘贴整篇素材文档"
          }
        />
      </section>
      <aside className="creation-config-panel">
        <fieldset
          disabled={generating}
          aria-label="生成配置"
          className="m-0 min-w-0 border-0 p-0"
        >
          <section className="creation-config-section">
            <h3>生成设置</h3>
            <CreationSettings />
          </section>
          <CreationImages />
        </fieldset>
        <section className="creation-config-section creation-progress-section">
          <h3>生成进度</h3>
          <GenerationProgress />
        </section>
      </aside>
    </div>
  );
}
