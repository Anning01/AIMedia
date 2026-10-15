import type { Block } from "./model";
import { parseArticle } from "./model";

export function documentText(blocks: Block[]) {
  return blocks
    .filter((block) => block.type !== "image" && block.type !== "divider")
    .map((block) => {
      if (block.items) return block.items.map((item) => "- " + item).join("\n");
      const prefix =
        block.type === "title"
          ? "# "
          : block.type === "h2"
            ? "## "
            : block.type === "quote"
              ? "> "
              : "";
      return block.text ? prefix + block.text : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
export function candidateBlocks(current: Block[], candidate: string) {
  const next = parseArticle(candidate).filter(
    (block) => block.type !== "image",
  );
  if (!next.length) throw Error("候选文案为空");
  // Keep local images and separators at their relative position; template settings stay outside blocks.
  let textBefore = 0;
  const textCount = current.filter(
    (block) => block.type !== "image" && block.type !== "divider",
  ).length;
  const attachments = current.flatMap((block) => {
    if (block.type === "image" || block.type === "divider")
      return [
        {
          block,
          index: Math.round(
            (textBefore / Math.max(1, textCount)) * next.length,
          ),
        },
      ];
    textBefore++;
    return [];
  });
  for (const item of attachments.reverse())
    next.splice(item.index, 0, item.block);
  return next;
}
