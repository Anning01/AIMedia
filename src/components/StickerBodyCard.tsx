import type { CoverTextZone,CustomStickerTemplate,StickerCoverTemplate } from '../data/stickerTemplates';

const FONTS: Record<string, string> = {
  smiley: `'Smiley Sans','Microsoft YaHei',sans-serif`,
  sans: `'PingFang SC','Microsoft YaHei',sans-serif`,
  serif: `'SimSun','Songti SC',serif`,
  kaiti: `'KaiTi','STKaiti','SimSun',serif`,
  type: `'Courier New','SimSun',serif`,
};

function contrastText(hex: string): string {
  const m = (hex || '#FFD60A').replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return r * 0.299 + g * 0.587 + b * 0.114 > 170 ? '#1a1a1a' : '#ffffff';
}

function luminance(hex: string): number {
  const m = (hex || '').replace('#', '');
  if (!m) return 255;
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (full.length < 6) return 255;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function pickTextOnLight(hex: string, fallback: string): string {
  return luminance(hex) < 170 ? hex : fallback;
}

function pickAccent(hex: string): string {
  const l = luminance(hex);
  return l >= 90 && l <= 230 ? hex : '#FFD60A';
}

function fitBodySize(text: string): number {
  const contentW = 128;
  const contentH = 148;
  let size = 7.6;
  while (size > 5.4) {
    const perLine = Math.max(1, Math.floor(contentW / size));
    const lines = Math.max(1, Math.ceil(text.length / perLine));
    if (lines * size * 1.7 <= contentH) return size;
    size -= 0.3;
  }
  return size;
}

export default function StickerBodyCard({
  tpl,
  page,
  total,
  text,
  heading,
}: {
  tpl: StickerCoverTemplate;
  page: number;
  total: number;
  text: string;
  heading?: string;
}) {
  const w = 168;
  const sz = (p: number) => (w * p) / 100;
  const badgeBg = tpl.accent || '#FFD60A';
  const frame = tpl.frame || '';
  const innerBg = luminance(frame) >= 150 ? frame : '#FFFDF5';
  const bodyColor = pickTextOnLight(tpl.textColor, '#3a3f4a');
  const headingColor = pickTextOnLight(tpl.titleColor, '#1a1a1a');
  const accent = pickAccent(tpl.accent);
  const headingFont = FONTS[tpl.titleFont || 'smiley'] || FONTS.smiley;
  const bodySize = fitBodySize(text);
  const custom = tpl as CustomStickerTemplate;
  const cardZones = custom.cardZones || {};
  const useCustomCard = !!(cardZones.heading || cardZones.text);

  if (useCustomCard) {
    const zoneDiv = (key: 'heading' | 'text', content: string, z?: CoverTextZone) => {
      if (!z || !content) return null;
      return (
        <div
          className="sticker-card-zone"
          style={{
            position: 'absolute',
            left: `${z.x}%`,
            top: `${z.y}%`,
            width: `${z.w}%`,
            height: `${z.h}%`,
            fontSize: Math.max(8, (z.size * 168) / 900),
            color: z.color,
            fontWeight: z.bold ? 800 : 500,
            textAlign: z.align,
            fontFamily: key === 'heading' ? headingFont : FONTS.sans,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: z.maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap',
            zIndex: 2,
          }}
        >
          {content}
        </div>
      );
    };
    return (
      <div
        style={{
          width: 168,
          aspectRatio: '3 / 4',
          position: 'relative',
          borderRadius: 10.4,
          overflow: 'hidden',
          backgroundImage: `url(${custom.cardBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxSizing: 'border-box',
        }}
      >
        {custom.customCSS ? <style>{custom.customCSS}</style> : null}
        {zoneDiv('heading', heading || '', cardZones.heading)}
        {zoneDiv('text', text, cardZones.text)}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 168,
        aspectRatio: '3 / 4',
        background: custom.cardBgImage ? undefined : tpl.bg,
        backgroundImage: custom.cardBgImage ? `url(${custom.cardBgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: 10.4,
        borderRadius: 10.4,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {custom.customCSS ? <style>{custom.customCSS}</style> : null}
      <div
        style={{
          flex: 1,
          background: innerBg,
          borderRadius: 7.2,
          padding: '12px 12.8px 9.6px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              background: badgeBg,
              color: contrastText(badgeBg),
              fontSize: 5.6,
              fontWeight: 700,
              lineHeight: 1,
              padding: '2px 5.6px',
              borderRadius: 999,
              letterSpacing: '0.14em',
              fontFamily: FONTS.sans,
            }}
          >
            {tpl.badge || '语录'}
          </span>
          <span
            style={{
              color: bodyColor,
              fontSize: 5.2,
              fontWeight: 600,
              opacity: 0.75,
              letterSpacing: '0.08em',
              fontFamily: FONTS.sans,
            }}
          >
            {String(page).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 5.6,
            minHeight: 0,
          }}
        >
          {heading ? (
            <div
              style={{
                color: headingColor,
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1.4,
                textAlign: 'center',
                paddingBottom: 4.8,
                borderBottom: `1.6px solid ${accent}`,
                alignSelf: 'center',
                maxWidth: '92%',
                fontFamily: headingFont,
                letterSpacing: '0.02em',
              }}
            >
              {heading}
            </div>
          ) : null}
          {text ? (
            <div
              style={{
                color: bodyColor,
                fontSize: bodySize,
                fontWeight: 500,
                lineHeight: 1.78,
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                maxHeight: '100%',
                overflow: 'hidden',
                fontFamily: FONTS.sans,
                letterSpacing: '0.02em',
              }}
            >
              {text}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5.6 }}>
          <span style={{ color: bodyColor, fontSize: 4.8, opacity: 0.7, fontFamily: FONTS.sans }}>
            {String(page).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          {tpl.showArrow !== false && (
            <span style={{ color: accent, fontSize: 10.4, fontWeight: 800, lineHeight: 1 }}>›</span>
          )}
        </div>
      </div>
    </div>
  );
}
