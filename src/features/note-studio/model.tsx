import { isWghUrl,readImage } from "@/utils/imageStore";

export const PRICES = { low: 0.06, mid: 0.2, pro: 0.3 };

export function formatCount(v?: string | number) {
  const n = Number(v);
  if (
    v === undefined ||
    v === null ||
    v === "" ||
    !Number.isFinite(n) ||
    n <= 0
  ) {
    return "";
  }
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}千`;
  return String(n);
}

export async function compressImageDataUrl(
  src: string,
  maxSize = 900,
  quality = 0.85,
): Promise<string> {
  const dataUrl = isWghUrl(src) ? await readImage(src) : src;
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("图片读取失败"));
    img.src = dataUrl;
  });
}

export interface NoteCandidate {
  title: string;
  paras: string[];
  tags: string[];
}

export interface ParseReport {
  angle: string;
  titleFormula: string;
  style: string;
  composition: string;
  structure: string[];
  emotionWords: string[];
  tags: string[];
}

export interface VisionItem {
  dataUrl: string;
  text: string;
  suggestSlot?: string;
  borrow?: string;
  mustReplace?: string;
}
