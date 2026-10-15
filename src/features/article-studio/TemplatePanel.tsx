import { ArticleTemplateGallery } from "./creation/ArticleTemplateGallery";
import { StickerTemplateGallery } from "./creation/StickerTemplateGallery";
import { useArticleWorkspace } from "./workspace-context";
export function TemplatePanel() {
  const { contentType } = useArticleWorkspace();
  return (
    <section className="creation-template-panel">
      {contentType === "article" ? (
        <ArticleTemplateGallery />
      ) : (
        <StickerTemplateGallery />
      )}
    </section>
  );
}
