import { templatePaperBg } from '../data/articleTemplates';
import type { TemplateDesign } from '../data/articleTemplates';
import type { ThemeOverrides } from '../data/themeOverrides';

interface HtmlBlock {
  type: string;
  text?: string;
  items?: string[];
  src?: string;
}

/**
 * 万稿汇文章导出层
 *
 * 对齐 doocs/md 的核心思路：预览与导出来自同一套“主题变量 + 组件样式”，
 * 复制到公众号的 HTML 必须是全内联样式（不含 var()/class），
 * 且要处理微信编辑器的粘贴兼容问题。
 */

const SERIF_FONT = "'Songti SC','SimSun','STSong',serif";

function mix(hex: string, base: string, ratio: number): string {
  const toRgb = (h: string) => {
    const v = h.replace('#', '');
    return [
      parseInt(v.slice(0, 2), 16),
      parseInt(v.slice(2, 4), 16),
      parseInt(v.slice(4, 6), 16),
    ];
  };
  const a = toRgb(hex);
  const b = toRgb(base);
  const m = (x: number, y: number) => Math.round(x * (1 - ratio) + y * ratio);
  return `rgb(${m(a[0], b[0])}, ${m(a[1], b[1])}, ${m(a[2], b[2])})`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupCards(blocks: HtmlBlock[]): { lead: HtmlBlock[]; groups: HtmlBlock[][] } {
  const lead: HtmlBlock[] = [];
  const groups: HtmlBlock[][] = [];
  let current: HtmlBlock[] = [];
  let seenH2 = false;
  for (const b of blocks) {
    if (b.type === 'h2') {
      if (seenH2 && current.length) {
        groups.push(current);
        current = [];
      }
      seenH2 = true;
      current.push(b);
    } else if (seenH2) {
      current.push(b);
    } else {
      lead.push(b);
    }
  }
  if (current.length) groups.push(current);
  return { lead, groups };
}

export function buildInlineHtml(
  blocks: HtmlBlock[],
  template: TemplateDesign,
  accent: string,
  opts: ThemeOverrides = {},
): string {
  const dark = template.paper === 'dark';
  const serif = template.serif === true;
  const paperBg = templatePaperBg(template);
  const isCustom = accent !== template.accent;

  const text = dark ? '#c9d2df' : '#333a48';
  const bodyText = opts.bodyColor || text;
  const title = opts.titleColor || (dark ? '#ffffff' : isCustom ? accent : '#1f2430');
  const h2Text = opts.titleColor || (dark ? '#ffffff' : isCustom ? accent : '#1f2430');
  const borderLight = dark ? '#2a3446' : '#eef0f6';
  const serifFont = serif ? `font-family:${SERIF_FONT};` : '';
  const fontPx = opts.fontSize ?? 15;
  const fontSize = `${fontPx}px`;
  const lineHeight = opts.lineHeight ?? (template.layout === 'journal' ? 2.05 : 1.9);
  const letterSpacing = opts.letterSpacing ? `${opts.letterSpacing}em` : '0em';
  const indentStyle = opts.indent ? 'text-indent:2em;' : '';

  /** accent 占 share（0~1），其余混合到 base，等价于 color-mix(in srgb, accent share%, base) */
  const tint = (share: number, base: string = paperBg) => mix(accent, base, 1 - share);
  const accentGradient = `linear-gradient(135deg,${accent},${mix(accent, '#ffffff', 0.4)})`;

  let stepNo = 0;
  let firstP = true;

  const renderTitle = (t: string, inBanner?: boolean): string => {
    const c = inBanner ? '#ffffff' : title;
    const base = `font-size:${Math.round(fontPx * 1.53)}px;font-weight:700;line-height:1.45;margin:0 0 8px;color:${c};${serifFont}`;
    switch (template.title) {
      case 'bar-left':
        return `<h1 style="${base};padding-left:14px;border-left:4px solid ${accent};">${esc(t)}</h1>`;
      case 'center-deco':
        return `<h1 style="${base};text-align:center;letter-spacing:3px;"><span style="display:inline-block;width:26px;height:2px;background:${accent};vertical-align:middle;margin:0 12px;"></span>${esc(t)}<span style="display:inline-block;width:26px;height:2px;background:${accent};vertical-align:middle;margin:0 12px;"></span></h1>`;
      case 'badge':
        return `<h1 style="${base}"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${accent};margin-right:10px;vertical-align:middle;"></span>${esc(t)}</h1>`;
      case 'underline':
        return `<h1 style="${base};text-align:center;padding-bottom:12px;">${esc(t)}<span style="display:block;width:64px;height:3px;border-radius:2px;background:${accent};margin:10px auto 0;"></span></h1>`;
      default:
        return `<h1 style="${base}">${esc(t)}</h1>`;
    }
  };

  const renderH2 = (t: string, inCard?: boolean): string => {
    const isSteps = template.layout === 'steps';
    const isTimeline = template.layout === 'timeline';
    const numbered = isSteps || template.h2 === 'number';
    const no = numbered ? ++stepNo : 0;
    let inner = esc(t);
    let style = `font-size:${Math.round(fontPx * 1.13)}px;font-weight:600;margin:22px 0 10px;color:${h2Text};`;
    let connector = '';

    if (isTimeline) {
      style += 'position:relative;border-left:none;background:transparent;';
      inner =
        `<span style="position:absolute;left:-34px;top:6px;width:12px;height:12px;border-radius:50%;background:${accent};box-shadow:0 0 0 3px ${tint(0.14)};"></span>` +
        inner;
    } else if (isSteps) {
      style += 'position:relative;padding-left:44px;border-left:none;background:transparent;';
      inner =
        `<span style="position:absolute;left:0;top:0;color:${accent};font-weight:700;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">${String(no).padStart(2, '0')}</span>` +
        inner;
      connector = `<span style="display:block;width:2px;height:26px;background:${tint(0.3)};margin:6px 0 0 8px;"></span>`;
    } else {
      switch (template.h2) {
        case 'number':
          style += 'border-left:none;background:transparent;padding:0;';
          inner =
            `<span style="color:${accent};font-weight:700;font-size:20px;margin-right:10px;font-family:'Segoe UI',Arial,sans-serif;">${String(no).padStart(2, '0')}</span>` +
            inner;
          break;
        case 'bar-left':
          style += `border-left:4px solid ${accent};background:${tint(0.07)};padding:8px 12px;border-radius:0 8px 8px 0;`;
          break;
        case 'pill':
          style += `display:inline-block;border-left:none;background:${tint(0.1)};padding:6px 16px;border-radius:999px;`;
          break;
        case 'center-dot':
          style += 'border-left:none;text-align:center;background:transparent;';
          inner = `<span style="color:${accent};margin:0 10px;">·</span>${inner}<span style="color:${accent};margin:0 10px;">·</span>`;
          break;
        case 'underline':
          style += `border-left:none;border-bottom:2px solid ${accent};padding:0 0 8px;`;
          break;
        default:
          style += `border-left:4px solid ${accent};background:${tint(0.07)};padding:8px 12px;border-radius:0 8px 8px 0;`;
      }
    }

    if (template.layout === 'faq') {
      inner =
        `<span style="display:inline-block;background:${accent};color:#fff;font-size:12px;font-weight:600;padding:2px 9px;border-radius:6px;margin-right:10px;line-height:20px;">问</span>` +
        inner;
    }

    if (inCard) style = style.replace('margin:22px 0 10px', 'margin:0 0 10px');
    return `<div style="${style}">${inner}</div>${connector}`;
  };

  const renderQuote = (t: string): string => {
    const q = esc(t);
    switch (template.quote) {
      case 'big-quote':
        return `<div style="border-left:none;background:${tint(0.06)};position:relative;padding:20px 16px 12px 22px;border-radius:0 8px 8px 0;margin:14px 0;font-size:${fontSize};color:${bodyText};${serifFont}"><span style="float:left;font-size:44px;color:${accent};font-family:Georgia,serif;line-height:1;margin:-4px 6px 0 -6px;">“</span>${q}</div>`;
      case 'bubble':
        return `<div style="border-left:none;border-radius:14px;background:${tint(0.08)};border:1px solid ${tint(0.22)};padding:10px 14px;margin:14px 0;font-size:${fontSize};color:${bodyText};${serifFont}">${q}</div>`;
      case 'bracket':
        return `<div style="border:1px solid ${mix(accent, '#ffffff', 0.75)};border-left:3px solid ${accent};background:${mix(accent, '#faf3e8', 0.94)};padding:10px 14px;border-radius:0 8px 8px 0;margin:14px 0;font-size:${fontSize};color:${bodyText};${serifFont}">${q}</div>`;
      default:
        return `<div style="border-left:3px solid ${accent};background:${tint(0.06)};padding:10px 14px;border-radius:0 8px 8px 0;color:${mix(accent, '#333333', 0.52)};margin:14px 0;font-size:${fontSize};${serifFont}">${q}</div>`;
    }
  };

  const renderCard = (t: string): string => {
    switch (template.card) {
      case 'side-bar':
        return `<div style="border:1px solid ${tint(0.18)};border-left:4px solid ${accent};background:${tint(0.07)};border-radius:0 10px 10px 0;padding:12px 16px;margin:14px 0;font-size:${fontSize};color:${bodyText};">${esc(t)}</div>`;
      case 'top-bar':
        return `<div style="border:1px solid ${tint(0.16)};border-top:4px solid ${accent};background:${tint(0.06)};border-radius:10px;padding:12px 16px;margin:14px 0;font-size:${fontSize};color:${bodyText};">${esc(t)}</div>`;
      case 'dashed':
        return `<div style="border:1px dashed ${mix(accent, '#ffffff', 0.58)};background:${tint(0.05)};border-radius:10px;padding:12px 16px;margin:14px 0;font-size:${fontSize};color:${bodyText};">${esc(t)}</div>`;
      case 'glass':
        return `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);color:${dark ? '#c9d2df' : bodyText};border-radius:10px;padding:12px 16px;margin:14px 0;font-size:${fontSize};">${esc(t)}</div>`;
      default:
        return `<div style="background:${tint(0.07)};border:1px solid ${tint(0.18)};border-radius:10px;padding:12px 16px;margin:14px 0;font-size:${fontSize};color:${bodyText};">${esc(t)}</div>`;
    }
  };

  const renderDivider = (): string => {
    switch (template.divider) {
      case 'line':
        return `<div style="border-top:1px solid #d9dce3;margin:18px 0;"></div>`;
      case 'dashed':
        return `<div style="border-top:2px dashed ${mix(accent, '#ffffff', 0.55)};margin:18px 0;"></div>`;
      case 'gradient':
        return `<div style="height:3px;background:linear-gradient(90deg,${accent},${mix(accent, '#ffffff', 0.4)});border-radius:2px;margin:18px 0;"></div>`;
      case 'icon':
        return `<div style="border-top:1px solid ${tint(0.34)};margin:18px 0;text-align:center;position:relative;"><span style="position:relative;top:-9px;background:${paperBg};color:${accent};font-size:13px;padding:0 8px;">✦</span></div>`;
      default:
        return `<div style="height:1px;background:#e8ebf2;margin:18px 0;position:relative;"><span style="position:absolute;left:50%;top:-3px;width:6px;height:6px;border-radius:50%;background:${accent};transform:translateX(-50%);"></span></div>`;
    }
  };

  const renderCta = (t: string): string => {
    const base = 'text-align:center;padding:14px 18px;margin-top:20px;font-size:15px;font-weight:500;';
    switch (template.ctaStyle) {
      case 'pill':
        return `<div style="${base};background:${accentGradient};color:#fff;border-radius:999px;">${esc(t)}</div>`;
      case 'dark':
        return `<div style="${base};background:#1f2430;color:#fff;border-radius:10px;">${esc(t)}</div>`;
      case 'outline':
        return `<div style="${base};background:transparent;border:1px solid ${accent};color:${accent};border-radius:10px;">${esc(t)}</div>`;
      default:
        return `<div style="${base};background:${accentGradient};color:#fff;border-radius:10px;">${esc(t)}</div>`;
    }
  };

  const renderList = (items: string[] = []): string => {
    const lis = items
      .map((item, i) => {
        if (template.list === 'number') {
          return `<li style="position:relative;padding:6px 0 6px 30px;font-size:${fontSize};line-height:${lineHeight};color:${bodyText};"><span style="position:absolute;left:0;top:9px;width:18px;height:18px;border-radius:50%;background:${accent};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;">${i + 1}</span>${esc(item)}</li>`;
        }
        if (template.list === 'check') {
          return `<li style="position:relative;padding:6px 0 6px 26px;font-size:${fontSize};line-height:${lineHeight};color:${bodyText};"><span style="position:absolute;left:2px;top:7px;color:${accent};font-weight:700;">✓</span>${esc(item)}</li>`;
        }
        return `<li style="position:relative;padding:6px 0 6px 26px;font-size:${fontSize};line-height:${lineHeight};color:${bodyText};"><span style="position:absolute;left:6px;top:16px;width:8px;height:8px;border-radius:50%;background:${accent};"></span>${esc(item)}</li>`;
      })
      .join('');
    return `<ul style="margin:12px 0;padding:0;list-style:none;">${lis}</ul>`;
  };

  const renderInfoGrid = (items: string[] = []): string => {
    // items 为 [label, value] 交替，先把每对渲染成一个格
    const pairs: string[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const label = items[i] || '';
      const value = items[i + 1] || '';
      pairs.push(
        `<section style="display:table-cell;width:50%;padding:10px 14px;vertical-align:top;box-sizing:border-box;"><p style="margin:0 0 2px;font-size:11px;color:${dark ? '#8fa0b8' : '#8a93a6'};text-transform:uppercase;letter-spacing:0.5px;">${esc(label)}</p><p style="margin:0;font-size:${fontSize};font-weight:500;color:${bodyText};">${esc(value)}</p></section>`,
      );
    }
    // 每 2 格一行，避免全部挤在单行里被压窄
    const rows: string[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const isLast = i + 2 >= pairs.length;
      const cells = pairs.slice(i, i + 2);
      const withBorder = cells
        .map((cell, ci) =>
          ci < cells.length - 1
            ? cell.replace('display:table-cell', `display:table-cell;border-right:1px solid ${borderLight}`)
            : cell,
        )
        .join('');
      rows.push(
        `<section style="display:table-row;${isLast ? '' : `border-bottom:1px solid ${borderLight};`}">${withBorder}</section>`,
      );
    }
    return `<section style="margin:14px 0;border:1px solid ${borderLight};border-radius:8px;overflow:hidden;background:${dark ? '#1d2532' : '#ffffff'};"><section style="display:table;width:100%;border-collapse:collapse;">${rows.join('')}</section></section>`;
  };

  const renderBadges = (items: string[] = []): string => {
    const chips = items
      .map(
        (item) =>
          `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:13px;font-weight:500;background:${tint(0.1)};color:${accent};border:1px solid ${mix(accent, '#ffffff', 0.75)};">${esc(item)}</span>`,
      )
      .join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">${chips}</div>`;
  };

  const blockHtml = (b: HtmlBlock, ctx: { inBanner?: boolean; inCard?: boolean } = {}): string => {
    switch (b.type) {
      case 'title':
        return renderTitle(b.text || '', ctx.inBanner);
      case 'subtitle': {
        const c = ctx.inBanner ? 'rgba(255,255,255,0.85)' : '#8a93a6';
        return `<div style="color:${c};font-size:13px;margin-bottom:18px;${serif ? 'text-align:center;' : ''}">${esc(b.text || '')}</div>`;
      }
      case 'h2':
        return renderH2(b.text || '', ctx.inCard);
      case 'p': {
        if (template.layout === 'journal' && firstP) {
          firstP = false;
          const t = b.text || '';
          if (t.length > 0) {
            const first = t[0];
            const rest = t.slice(1);
            return `<p style="font-size:${fontSize};line-height:${lineHeight};letter-spacing:${letterSpacing};${indentStyle}color:${bodyText};margin:0 0 18px;text-align:justify;${serifFont}"><span style="float:left;font-size:46px;line-height:1;font-weight:700;color:${accent};margin:6px 8px 0 0;">${esc(first)}</span>${esc(rest)}</p>`;
          }
        }
        return `<p style="font-size:${fontSize};line-height:${lineHeight};letter-spacing:${letterSpacing};${indentStyle}color:${bodyText};margin:0 0 12px;text-align:justify;${serifFont}">${esc(b.text || '')}</p>`;
      }
      case 'quote':
        return renderQuote(b.text || '');
      case 'card':
        return renderCard(b.text || '');
      case 'list':
        return renderList(b.items);
      case 'infoGrid':
        return renderInfoGrid(b.items);
      case 'badges':
        return renderBadges(b.items);
      case 'tip':
        return `<div style="display:flex;gap:10px;align-items:flex-start;background:${dark ? '#1d2532' : tint(0.08)};border:1px solid ${dark ? '#3a4659' : tint(0.28)};border-radius:10px;padding:12px 14px;margin:14px 0;font-size:${fontSize};line-height:${lineHeight};color:${bodyText};"><span style="background:${accent};color:#fff;font-size:12px;padding:2px 8px;border-radius:6px;flex-shrink:0;line-height:20px;">提示</span><span>${esc(b.text || '')}</span></div>`;
      case 'image':
        if (b.src) {
          const cap = b.text
            ? `<figcaption style="color:${dark ? '#8fa0b8' : '#8a93a6'};font-size:12px;text-align:center;margin-top:6px;">${esc(b.text)}</figcaption>`
            : '';
          return `<figure style="margin:14px 0;text-align:center;"><img src="${b.src}" alt="${esc(b.text || '')}" style="max-width:100%;border-radius:8px;display:block;margin:0 auto;"/>${cap}</figure>`;
        }
        return `<div style="border:1px dashed ${dark ? '#3a4659' : '#c9d0dc'};border-radius:10px;background:${dark ? '#1d2532' : '#f7f8fc'};color:${dark ? '#8fa0b8' : '#8a93a6'};text-align:center;padding:26px 12px;font-size:13px;margin:14px 0;">🖼 ${esc(b.text || '图片占位：插入你的图片')}</div>`;
      case 'follow':
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:${dark ? '#1d2532' : tint(0.08)};border:1px solid ${dark ? '#3a4659' : tint(0.22)};border-radius:12px;padding:14px 16px;margin-top:22px;"><span style="font-size:${fontSize};color:${bodyText};line-height:${lineHeight};">${esc(b.text || '喜欢本文，记得点赞、在看，关注不迷路')}</span><span style="flex-shrink:0;background:${accent};color:#fff;border-radius:999px;padding:7px 18px;font-size:13px;white-space:nowrap;">关注我们</span></div>`;
      case 'divider':
        return renderDivider();
      case 'cta':
        return renderCta(b.text || '');
      default:
        return `<p style="font-size:${fontSize};line-height:${lineHeight};color:${bodyText};margin:0 0 12px;">${esc(b.text || '')}</p>`;
    }
  };

  let body: string;
  if (template.layout === 'cards' || template.layout === 'faq') {
    const isFaq = template.layout === 'faq';
    const { lead, groups } = groupCards(blocks);
    body =
      lead.map((b) => blockHtml(b)).join('') +
      groups
        .map(
          (g) =>
            `<div style="border:1px solid ${dark ? '#2a3446' : tint(isFaq ? 0.18 : 0.16)};${isFaq ? `border-left:4px solid ${accent};` : ''}background:${dark ? '#1d2532' : tint(0.05)};border-radius:${isFaq ? '12px' : '14px'};padding:${isFaq ? '16px 18px' : '18px 20px'};margin:0 0 16px;">${g
              .map((b) => blockHtml(b, { inCard: true }))
              .join('')}</div>`,
        )
        .join('');
    if (isFaq && groups.length === 0) {
      // 没有小标题分组时也保持问答卡氛围
      body = `<div style="border:1px solid ${tint(0.18)};border-left:4px solid ${accent};background:${tint(0.05)};border-radius:12px;padding:16px 18px;margin:0 0 16px;">${body}</div>`;
    }
  } else if (template.layout === 'timeline') {
    const { lead, groups } = groupCards(blocks);
    const groupHtml = (g: HtmlBlock[]) => {
      const rail = g.filter((b) => b.type !== 'list');
      const lists = g.filter((b) => b.type === 'list');
      return (
        `<div style="position:relative;padding-left:28px;border-left:2px solid ${dark ? '#2a3446' : tint(0.28)};margin:0 0 6px;">${rail
          .map((b) => blockHtml(b, { inCard: true }))
          .join('')}</div>` + lists.map((b) => blockHtml(b)).join('')
      );
    };
    body = lead.map((b) => blockHtml(b)).join('') + groups.map(groupHtml).join('');
  } else if (template.layout === 'banner') {
    const banner: HtmlBlock[] = [];
    const rest: HtmlBlock[] = [];
    let inBanner = true;
    for (const b of blocks) {
      if (inBanner && (b.type === 'title' || b.type === 'subtitle')) {
        banner.push(b);
        continue;
      }
      inBanner = false;
      rest.push(b);
    }
    body =
      (banner.length
        ? `<div style="background:${accentGradient};border-radius:14px;padding:34px 24px;margin-bottom:24px;color:#fff;">${banner
            .map((b) => blockHtml(b, { inBanner: true }))
            .join('')}</div>`
        : '') + rest.map((b) => blockHtml(b)).join('');
  } else if (template.layout === 'toc') {
    const tocItems = blocks
      .filter((b) => b.type === 'h2')
      .map(
        (b, i) =>
          `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed ${tint(0.16)};font-size:14px;color:${bodyText};"><span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:${tint(0.12)};color:${accent};display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${i + 1}</span><span>${esc(b.text || '')}</span></div>`,
      )
      .join('');
    const tocHtml =
      tocItems.length > 0
        ? `<div style="border:1px solid ${tint(0.16)};border-radius:12px;background:${tint(0.04)};padding:14px 16px;margin:0 0 20px;"><div style="font-size:15px;font-weight:700;color:${title};margin-bottom:2px;">📑 本文目录</div><div style="font-size:12px;color:${dark ? '#8fa0b8' : '#8a93a6'};margin-bottom:8px;">共 ${tocItems.length} 节，按序阅读或直达你最关心的部分</div>${tocItems}</div>`
        : '';
    body = tocHtml + blocks.map((b) => blockHtml(b)).join('');
  } else {
    body = blocks.map((b) => blockHtml(b)).join('');
  }

  // 微信粘贴兼容：首尾各放一个零尺寸空段，避免公众号编辑器把首个节点样式重置
  const pad = `<p style="font-size:0;line-height:0;margin:0">&nbsp;</p>`;
  const customStyle = opts.customCSS && opts.customCSS.trim()
    ? `<style>${opts.customCSS}</style>`
    : '';
  return `<div style="display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;background:${paperBg};padding:20px 0;${serifFont}">${pad}${body}${customStyle}${pad}</div>`;
}
