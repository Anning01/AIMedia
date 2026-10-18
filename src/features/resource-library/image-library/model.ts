export const FALLBACK_IMG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="#f0f2f7"/></svg>',
  );

export function timeText(s?: string): string {
  if (!s) return "";
  return s.replace("T", " ").replace("Z", "").slice(0, 16);
}

export interface Props {
  selectable?: boolean;
  maxCount?: number;
  selectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
  refreshKey?: number;
}

export const EMPTY_SELECTION: string[] = [];
