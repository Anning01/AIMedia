import type { TemplateDesign } from './articleTemplates';

/**
 * 主题生成器的覆盖配置。
 * 与 doocs/md 的“每主题独立设置”思路一致：每个模板可保存一套自定义参数，
 * 预览与导出共用同一份配置，保证所见即所得。
 */
export interface ThemeOverrides {
  fontSize?: number; // px，13-20
  lineHeight?: number; // 1.5-2.2
  letterSpacing?: number; // em，0-0.25
  indent?: boolean; // 段落首行缩进 2em
  bodyColor?: string;
  titleColor?: string;
  title?: TemplateDesign['title'];
  h2?: TemplateDesign['h2'];
  quote?: TemplateDesign['quote'];
  card?: TemplateDesign['card'];
  divider?: TemplateDesign['divider'];
  ctaStyle?: TemplateDesign['ctaStyle'];
  list?: TemplateDesign['list'];
  layout?: TemplateDesign['layout'];
  customCSS?: string;
}

export interface CustomTemplate extends TemplateDesign {
  overrides?: ThemeOverrides;
}

const THEME_KEY = 'wangaohui:tplTheme';
const CUSTOM_TEMPLATE_KEY = 'wangaohui:tplCustomTemplates';

export function loadThemeOverrides(): Record<string, ThemeOverrides> {
  try {
    return JSON.parse(localStorage.getItem(THEME_KEY) || '{}') as Record<string, ThemeOverrides>;
  } catch {
    return {};
  }
}

export function saveThemeOverrides(map: Record<string, ThemeOverrides>): void {
  localStorage.setItem(THEME_KEY, JSON.stringify(map));
}

export function loadCustomTemplates(): CustomTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TEMPLATE_KEY) || '[]') as CustomTemplate[];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(list: CustomTemplate[]): void {
  localStorage.setItem(CUSTOM_TEMPLATE_KEY, JSON.stringify(list));
}

const VARIANT_KEYS: (keyof ThemeOverrides)[] = [
  'title',
  'h2',
  'quote',
  'card',
  'divider',
  'ctaStyle',
  'list',
  'layout',
];

/** 把某套覆盖合并到基础模板上，得到“生效模板” */
export function effectiveTemplate(
  t: TemplateDesign,
  overrides?: ThemeOverrides,
): TemplateDesign {
  if (!overrides) return t;
  const merged: TemplateDesign = { ...t };
  for (const key of VARIANT_KEYS) {
    const v = overrides[key];
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[key] = v;
  }
  return merged;
}
