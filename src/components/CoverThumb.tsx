import type { CSSProperties,ReactNode } from 'react';
import { useEffect,useRef,useState } from 'react';
import type { CustomStickerTemplate,StickerCoverTemplate } from '../data/stickerTemplates';
import { coverThumbStyle } from '../data/stickerTemplates';

const FONTS: Record<string, string> = {
  smiley: `'Smiley Sans','Microsoft YaHei',sans-serif`,
  sans: `'Microsoft YaHei','PingFang SC',sans-serif`,
  serif: `'SimSun','Songti SC',serif`,
  kaiti: `'KaiTi','STKaiti','SimSun',serif`,
  type: `'Courier New','SimSun',serif`,
};

function HighlightTail({ tpl, tail, fontSize }: { tpl: StickerCoverTemplate; tail: string; fontSize: number }) {
  const mode = tpl.highlight || 'none';
  const common: CSSProperties = { fontWeight: 800 };
  switch (mode) {
    case 'marker':
      return (
        <span
          style={{
            ...common,
            background: `linear-gradient(transparent 52%, ${tpl.accent} 52%)`,
            color: tpl.titleColor,
            padding: '0 0.08em',
          }}
        >
          {tail}
        </span>
      );
    case 'color':
      return (
        <span
          style={{
            ...common,
            color: tpl.accent,
            textShadow: tpl.glow
              ? `0 0 ${fontSize * 0.35}px ${tpl.glow}, 0 0 ${fontSize * 0.7}px ${tpl.glow}`
              : `0 0 ${fontSize * 0.3}px rgba(255,255,255,.55)`,
          }}
        >
          {tail}
        </span>
      );
    case 'underline':
      return (
        <span style={{ ...common, borderBottom: `${Math.max(2, fontSize * 0.09)}px solid ${tpl.accent}` }}>
          {tail}
        </span>
      );
    case 'circle':
      return (
        <span
          style={{
            ...common,
            border: `${Math.max(2, fontSize * 0.08)}px solid ${tpl.accent}`,
            borderRadius: '0.55em',
            padding: '0.02em 0.16em',
            display: 'inline-block',
          }}
        >
          {tail}
        </span>
      );
    case 'block':
      return (
        <span
          style={{
            ...common,
            background: 'rgba(255,255,255,.38)',
            color: tpl.titleColor,
            padding: '0.02em 0.2em',
            borderRadius: '0.14em',
          }}
        >
          {tail}
        </span>
      );
    case 'ink':
      return (
        <span
          style={{
            ...common,
            background: '#1A1A1A',
            color: '#FFD60A',
            padding: '0.02em 0.18em',
            borderRadius: '0.1em',
          }}
        >
          {tail}
        </span>
      );
    case 'circleUnderline':
      return (
        <span
          style={{
            ...common,
            boxShadow: `inset 0 0 0 ${Math.max(2, fontSize * 0.09)}px ${tpl.accent}`,
            borderRadius: '50%',
            padding: '0.02em 0.18em',
            textDecoration: 'underline',
            textDecorationColor: tpl.accent,
            textDecorationThickness: Math.max(2, fontSize * 0.09),
            textUnderlineOffset: '0.06em',
          }}
        >
          {tail}
        </span>
      );
    case 'correction':
      return (
        <span style={{ ...common, position: 'relative', color: '#E63946', zIndex: 1 }}>
          <span
            style={{
              position: 'absolute',
              inset: '-0.14em -0.08em',
              background: '#FFFFFF',
              borderRadius: '0.14em',
              zIndex: -1,
            }}
          />
          {tail}
        </span>
      );
    default:
      return <>{tail}</>;
  }
}

function TitleBlock({
  tpl,
  title,
  fontSize,
  color,
  font,
  align = 'center',
  extra,
}: {
  tpl: StickerCoverTemplate;
  title: string;
  fontSize: number;
  color?: string;
  font?: string;
  align?: 'center' | 'left';
  extra?: CSSProperties;
}) {
  const t = title || '贴图标题';
  const hl = tpl.highlight && tpl.highlight !== 'none' ? Math.min(2, t.length) : 0;
  const head = hl ? t.slice(0, -hl) : t;
  const tail = hl ? t.slice(-hl) : '';
  const fs = Math.max(11, fontSize);
  return (
    <div
      style={{
        width: '100%',
        fontSize: fs,
        lineHeight: 1.28,
        fontWeight: 800,
        textAlign: align,
        color: color || tpl.titleColor,
        fontFamily: FONTS[font || tpl.titleFont || 'smiley'],
        overflowWrap: 'anywhere',
        letterSpacing: '0.01em',
        ...extra,
      }}
    >
      {head}
      {tail ? <HighlightTail tpl={tpl} tail={tail} fontSize={fontSize} /> : null}
    </div>
  );
}

function DescBlock({
  tpl,
  text,
  fontSize,
  color,
  align = 'center',
  clamp = 2,
  extra,
}: {
  tpl: StickerCoverTemplate;
  text: string;
  fontSize: number;
  color?: string;
  align?: 'center' | 'left';
  clamp?: number;
  extra?: CSSProperties;
}) {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const desc = lines.slice(0, 2).join(' ');
  if (!desc) return null;
  const fs = Math.max(9, fontSize);
  return (
    <div
      style={{
        width: '100%',
        fontSize: fs,
        lineHeight: 1.5,
        color: color || tpl.textColor,
        textAlign: align,
        fontFamily: FONTS.sans,
        opacity: 0.94,
        display: '-webkit-box',
        WebkitLineClamp: clamp,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        ...extra,
      }}
    >
      {desc || '用一张图，讲清楚一件事'}
    </div>
  );
}

function Badge({ tpl, fontSize }: { tpl: StickerCoverTemplate; fontSize: number }) {
  if (!tpl.badge) return null;
  return (
    <span
      style={{
        alignSelf: 'center',
        background: tpl.accent,
        color: '#fff',
        fontSize,
        lineHeight: 1,
        padding: '0.55em 1em',
        borderRadius: 999,
        fontFamily: FONTS.smiley,
        letterSpacing: '0.1em',
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,.12)',
      }}
    >
      {tpl.badge}
    </span>
  );
}

function CenterContent({
  tpl,
  title,
  text,
  pad,
  titleSize,
  textSize,
  titleExtra,
}: {
  tpl: StickerCoverTemplate;
  title: string;
  text: string;
  pad: number;
  titleSize: number;
  textSize: number;
  titleExtra?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: pad,
        gap: Math.max(6, pad * 0.12),
      }}
    >
      <Badge tpl={tpl} fontSize={Math.max(9, titleSize * 0.3)} />
      <TitleBlock tpl={tpl} title={title} fontSize={titleSize} extra={titleExtra} />
      <DescBlock tpl={tpl} text={text} fontSize={textSize} />
    </div>
  );
}

function PagePill({ w }: { w: number }) {
  const sz = (p: number) => (w * p) / 100;
  return (
    <div
      style={{
        position: 'absolute',
        right: sz(2.6),
        bottom: sz(2.6),
        background: 'rgba(255,255,255,.88)',
        color: '#333',
        fontSize: sz(2.6),
        lineHeight: 1,
        padding: `${sz(1)} ${sz(2.2)}`,
        borderRadius: 999,
        letterSpacing: 1,
        zIndex: 5,
        boxShadow: '0 1px 6px rgba(0,0,0,.12)',
      }}
    >
      1/2
    </div>
  );
}

function SwipeArrow({ w }: { w: number }) {
  const sz = (p: number) => (w * p) / 100;
  return (
    <div
      style={{
        position: 'absolute',
        right: sz(2),
        top: '50%',
        transform: 'translateY(-50%)',
        width: sz(6.5),
        height: sz(6.5),
        borderRadius: '50%',
        background: 'rgba(255,255,255,.88)',
        color: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: sz(4.4),
        lineHeight: 1,
        zIndex: 5,
        boxShadow: '0 1px 8px rgba(0,0,0,.14)',
      }}
    >
      ›
    </div>
  );
}

export default function CoverThumb({
  tpl,
  title,
  text,
  style,
}: {
  tpl: StickerCoverTemplate;
  title: string;
  text: string;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(168);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setW(el.offsetWidth || 168);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sz = (p: number) => (w * p) / 100;
  const titleSize = sz(tpl.titleSize);
  const textSize = sz(tpl.textSize);
  const center = (pad = 12, titleExtra?: CSSProperties) => (
    <CenterContent
      tpl={tpl}
      title={title}
      text={text}
      pad={pad}
      titleSize={titleSize}
      textSize={textSize}
      titleExtra={titleExtra}
    />
  );

  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const t = title || '贴图标题';

  let body: ReactNode;
  const custom = tpl as CustomStickerTemplate;
  if (custom.bgImage || (custom.coverZones && custom.coverZones.length)) {
    const zones = custom.coverZones || [];
    body = (
      <>
        {custom.bgImage ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${custom.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : null}
        {zones.length ? (
          zones.map((z, i) => {
            const content = i === 0 ? title : lines[0] || '';
            if (!content) return null;
            return (
              <div
                key={i}
                className="sticker-cover-zone"
                style={{
                  position: 'absolute',
                  left: `${z.x}%`,
                  top: `${z.y}%`,
                  width: `${z.w}%`,
                  height: `${z.h}%`,
                  fontSize: Math.max(10, (z.size * w) / 900),
                  color: z.color,
                  fontWeight: z.bold ? 800 : 500,
                  textAlign: z.align,
                  fontFamily: FONTS[tpl.titleFont || 'sans'] || FONTS.sans,
                  lineHeight: 1.35,
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
          })
        ) : (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <CenterContent
              tpl={tpl}
              title={title}
              text={text}
              pad={12}
              titleSize={titleSize}
              textSize={textSize}
            />
          </div>
        )}
      </>
    );
  } else {
  switch (tpl.variant) {
    case 'border':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, padding: sz(7) }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                background: tpl.frame,
                borderRadius: sz(1),
                boxShadow: '0 4px 14px rgba(0,0,0,.12)',
              }}
            >
              {center(8)}
            </div>
          </div>
        </>
      );
      break;
    case 'doubleFrame':
      body = (
        <>
          <div style={{ position: 'absolute', inset: sz(6), border: `${sz(0.8)}px solid ${tpl.frame}` }} />
          <div style={{ position: 'absolute', inset: sz(11), border: `${sz(0.8)}px solid ${tpl.frame2}`, transform: `translate(${sz(2.5)}px, -${sz(1.8)}px)` }} />
          {center(15)}
        </>
      );
      break;
    case 'gradientBorder':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              inset: sz(4),
              borderWidth: sz(1),
              borderStyle: 'solid',
              borderColor: 'transparent',
              borderImage: `linear-gradient(135deg,${tpl.frame},${tpl.frame2}) 1`,
            }}
          />
          {center(12)}
        </>
      );
      break;
    case 'dashedFrame':
      body = (
        <>
          <div style={{ position: 'absolute', inset: sz(4), border: `${sz(0.55)}px dashed ${tpl.frame}`, borderRadius: sz(1.2) }} />
          <div
            style={{
              position: 'absolute',
              top: sz(1),
              right: sz(7),
              width: sz(19),
              height: sz(5.5),
              background: 'rgba(255,214,10,.62)',
              transform: 'rotate(12deg)',
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: sz(1),
              left: sz(5),
              width: sz(19),
              height: sz(5.5),
              background: 'rgba(255,107,107,.5)',
              transform: 'rotate(-16deg)',
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            }}
          />
          {center(13)}
        </>
      );
      break;
    case 'bubble':
      body = (
        <>
          <div style={{ position: 'absolute', left: '10%', right: '10%', top: '15%', bottom: '19%', background: tpl.frame, borderRadius: sz(4), boxShadow: '0 6px 18px rgba(0,0,0,.08)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: '13.5%', width: sz(3.5), height: sz(3.5), background: tpl.frame, transform: 'translateX(-50%) rotate(45deg)' }} />
          {center(17)}
        </>
      );
      break;
    case 'patchwork':
      body = (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: sz(2), background: tpl.frame }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: sz(2), background: tpl.frame2 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: sz(2), background: tpl.frame3 }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: sz(2), background: tpl.frame4 }} />
          {center(12)}
        </>
      );
      break;
    case 'seal':
      body = (
        <>
          <div style={{ position: 'absolute', inset: sz(4), border: `${sz(1)}px solid ${tpl.frame}`, borderRadius: sz(1.2), transform: 'rotate(-2deg)' }} />
          <div
            style={{
              position: 'absolute',
              right: sz(7),
              top: sz(7),
              width: sz(9),
              height: sz(9),
              borderRadius: '50%',
              border: `${sz(0.55)}px solid ${tpl.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tpl.accent,
              fontSize: sz(3.2),
              fontFamily: FONTS.smiley,
              transform: 'rotate(8deg)',
            }}
          >
            {(tpl.badge || '必').slice(0, 1)}
          </div>
          {center(12)}
        </>
      );
      break;
    case 'nested':
      body = (
        <>
          <div style={{ position: 'absolute', inset: sz(3), border: `${sz(0.7)}px solid ${tpl.frame}` }} />
          <div style={{ position: 'absolute', inset: sz(7), border: `${sz(0.7)}px solid ${tpl.frame2}` }} />
          <div style={{ position: 'absolute', inset: sz(11), background: '#fff', borderRadius: sz(1) }} />
          {center(14)}
        </>
      );
      break;
    case 'wavy':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: sz(5),
              background: '#fff',
              borderRadius: sz(3),
              boxShadow: `0 0 0 ${sz(0.8)}px ${tpl.frame}, 0 6px 18px rgba(0,0,0,.08)`,
            }}
          >
            {center(11)}
          </div>
        </>
      );
      break;
    case 'tornPaper':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: sz(3.5),
              background: tpl.frame,
              borderRadius: '16px 5px 20px 7px / 9px 18px 6px 15px',
              boxShadow: '0 6px 18px rgba(0,0,0,.14)',
            }}
          />
          {center(12)}
        </>
      );
      break;
    case 'speedline':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-conic-gradient(from 0deg at 50% 46%, rgba(0,0,0,.11) 0deg 2deg, transparent 2deg 12deg)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, rgba(255,255,255,.96) 0 30%, transparent 64%)' }} />
          {center(12)}
        </>
      );
      break;
    case 'halftone':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '54%',
              height: '100%',
              backgroundImage: `radial-gradient(circle, ${tpl.frame}66 1.7px, transparent 1.7px)`,
              backgroundSize: '13px 13px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '66%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: `0 ${sz(4)}`,
              gap: sz(1.4),
            }}
          >
            <Badge tpl={tpl} fontSize={Math.max(9, titleSize * 0.3)} />
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} />
            <DescBlock tpl={tpl} text={text} fontSize={textSize} />
          </div>
        </>
      );
      break;
    case 'comicGrid': {
      const half = Math.ceil(t.length / 2);
      const cells = [t.slice(0, half), t.slice(half), lines[0] || '第一要点', lines[1] || tpl.badge || '第二要点'];
      const cellBg = ['#FFD60A', '#A8E6CF', '#FFB3BA', '#BAFFC9'];
      body = (
        <div
          style={{
            position: 'absolute',
            inset: sz(3),
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: sz(0.8),
            background: tpl.frame,
            padding: sz(0.8),
            borderRadius: sz(1.2),
          }}
        >
          {cells.map((c, i) => (
            <div
              key={i}
              style={{
                background: cellBg[i],
                padding: sz(2.2),
                display: 'flex',
                alignItems: i < 2 ? 'center' : 'flex-start',
                justifyContent: 'center',
                fontSize: i < 2 ? sz(3.6) : sz(3),
                fontWeight: i < 2 ? 800 : 500,
                color: '#1A1A1A',
                fontFamily: FONTS.smiley,
                textAlign: 'center',
                overflow: 'hidden',
              }}
            >
              {c}
            </div>
          ))}
        </div>
      );
      break;
    }
    case 'explosion':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: sz(64),
              height: sz(64),
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              background: `repeating-conic-gradient(from 0deg at 50% 50%, ${tpl.frame} 0 8deg, transparent 8deg 16deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: sz(44),
              height: sz(44),
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              background: tpl.frame,
              boxShadow: '0 0 24px rgba(255,214,10,.45)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: sz(16), gap: sz(1.2) }}>
            <Badge tpl={tpl} fontSize={Math.max(9, titleSize * 0.3)} />
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} color="#1A1A1A" />
            <DescBlock tpl={tpl} text={text} fontSize={textSize} color="#6b5b00" />
          </div>
        </>
      );
      break;
    case 'onomatopoeia':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: sz(46), color: 'rgba(255,107,107,.17)', fontWeight: 900, fontFamily: FONTS.smiley, transform: 'rotate(-8deg)' }}>
              哇！
            </div>
          </div>
          {center(12)}
        </>
      );
      break;
    case 'tiltStripes':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              inset: '-12%',
              background: `repeating-linear-gradient(-50deg, ${tpl.frame} 0 ${sz(1.4)}, transparent ${sz(1.4)} ${sz(4.2)})`,
              transform: 'rotate(-5deg)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', transform: 'rotate(5deg)' }}>
            {center(13)}
          </div>
        </>
      );
      break;
    case 'speechBubble':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              left: '11%',
              right: '11%',
              top: '16%',
              bottom: '17%',
              background: '#fff',
              border: `${sz(0.5)}px solid #1A1A1A`,
              borderRadius: '10% 14% 12% 16% / 14% 11% 16% 12%',
              boxShadow: '0 8px 20px rgba(0,0,0,.1)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '18%',
              bottom: '13.6%',
              width: sz(3),
              height: sz(3),
              background: '#fff',
              borderRight: `${sz(0.45)}px solid #1A1A1A`,
              borderBottom: `${sz(0.45)}px solid #1A1A1A`,
              transform: 'rotate(45deg)',
            }}
          />
          {center(15)}
        </>
      );
      break;
    case 'hSpeed':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(180deg, ${tpl.frame} 0 ${sz(0.9)}, transparent ${sz(0.9)} ${sz(2.7)})`,
              opacity: 0.85,
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(26,26,26,.32) 0 42%, transparent 78%)' }} />
          <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: sz(12), gap: sz(1.4) }}>
            <Badge tpl={tpl} fontSize={Math.max(9, titleSize * 0.3)} />
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} extra={{ textShadow: `0 0 ${sz(1)}px rgba(0,0,0,.8)` }} />
            <DescBlock tpl={tpl} text={text} fontSize={textSize} />
          </div>
        </>
      );
      break;
    case 'silhouette':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(45,52,54,.12) 1.5px, transparent 1.5px)',
              backgroundSize: `${sz(2.6)}px ${sz(2.6)}px`,
            }}
          />
          <div style={{ position: 'absolute', right: '5%', top: '14%', width: sz(30), height: sz(30), borderRadius: '50%', background: tpl.frame, opacity: 0.13 }} />
          <div
            style={{
              position: 'absolute',
              right: '2%',
              bottom: '4%',
              width: sz(38),
              height: sz(52),
              borderRadius: '50% 50% 0 0 / 38% 38% 0 0',
              backgroundImage: `radial-gradient(${tpl.frame} 1.6px, transparent 1.6px)`,
              backgroundSize: '13px 13px',
              opacity: 0.85,
            }}
          />
          {center(14)}
        </>
      );
      break;
    case 'arrow':
      body = (
        <>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100">
            <path d="M14 84 C 30 70, 40 42, 76 26" stroke={tpl.frame} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeDasharray="0.3 3" />
            <path d="M68 16 L81 21 L75 33" stroke={tpl.frame} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {center(13)}
        </>
      );
      break;
    case 'sunset':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          {center(12, {
            textShadow: '1px 1px 2px rgba(0,0,0,.3)',
            WebkitTextStroke: '1px rgba(0,0,0,.12)',
          })}
        </>
      );
      break;
    case 'neon':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(255,0,110,.38) 0%, rgba(131,56,236,.22) 40%, transparent 70%)',
            }}
          />
          {center(12, {
            textShadow: `0 0 ${sz(1)}px rgba(255,0,110,.8), 0 0 ${sz(2.5)}px rgba(131,56,236,.5)`,
          })}
        </>
      );
      break;
    case 'morandi':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          {center(12)}
        </>
      );
      break;
    case 'diagonalSplit':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#FF6B6B 50%,#4ECDC4 50%)' }} />
          {center(12, { textShadow: '0 2px 10px rgba(0,0,0,.22)' })}
        </>
      );
      break;
    case 'glass':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              top: '18%',
              bottom: '18%',
              background: 'rgba(255,255,255,.42)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,.7)',
              borderRadius: sz(4),
              boxShadow: '0 8px 30px rgba(0,0,0,.14)',
            }}
          />
          {center(16)}
        </>
      );
      break;
    case 'noise':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(26,26,26,.16) 1px, transparent 1px)', backgroundSize: '7px 7px' }} />
          {center(12)}
        </>
      );
      break;
    case 'stripeBg':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              top: '27%',
              bottom: '27%',
              background: 'rgba(255,255,255,.95)',
              borderRadius: sz(2),
              boxShadow: '0 6px 22px rgba(0,0,0,.22)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: sz(6),
              gap: sz(1.3),
            }}
          >
            <Badge tpl={tpl} fontSize={Math.max(9, titleSize * 0.3)} />
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} />
            <DescBlock tpl={tpl} text={text} fontSize={textSize} />
          </div>
        </>
      );
      break;
    case 'newspaper':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              top: sz(4.5),
              left: sz(7),
              right: sz(7),
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: sz(3),
              color: '#1A1A1A',
              fontFamily: FONTS.serif,
              borderBottom: `${sz(0.4)}px solid #1A1A1A`,
              paddingBottom: sz(1),
            }}
          >
            <span>万稿汇 · 深度</span>
            <span>2026.08.14</span>
          </div>
          {center(14)}
          <div
            style={{
              position: 'absolute',
              right: sz(8),
              bottom: sz(7),
              width: sz(9),
              height: sz(9),
              borderRadius: '50%',
              border: `${sz(0.55)}px solid ${tpl.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tpl.accent,
              fontSize: sz(2.8),
              fontFamily: FONTS.serif,
              transform: 'rotate(-10deg)',
            }}
          >
            深度
          </div>
        </>
      );
      break;
    case 'receipt':
      body = (
        <>
          <div style={{ position: 'absolute', left: '12%', right: '12%', top: '14%', bottom: '15%', background: '#FFF8E7', border: `${sz(0.4)}px dashed ${tpl.frame}`, borderRadius: sz(0.8), boxShadow: '0 4px 14px rgba(0,0,0,.08)' }} />
          <div style={{ position: 'absolute', left: '15%', right: '15%', top: '16.5%', display: 'flex', justifyContent: 'space-between', fontSize: sz(3), color: tpl.frame, fontFamily: FONTS.type }}>
            <span>NO.0001</span>
            <span>2026.08.14</span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              bottom: '14.2%',
              height: sz(2.8),
              backgroundImage:
                'repeating-linear-gradient(45deg, #FFF8E7 0 4px, transparent 4px 8px), repeating-linear-gradient(-45deg, #FFF8E7 0 4px, transparent 4px 8px)',
            }}
          />
          {center(16)}
        </>
      );
      break;
    case 'magazine':
      body = (
        <>
          <div style={{ position: 'absolute', top: sz(4), left: sz(5), background: tpl.accent, color: '#fff', fontSize: sz(3), fontWeight: 700, padding: `${sz(1)} ${sz(2)}`, borderRadius: sz(0.4), fontFamily: FONTS.smiley }}>
            {tpl.badge || 'FEATURE'}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              textAlign: 'left',
              padding: `${sz(14)} ${sz(9)}`,
              gap: sz(1.4),
            }}
          >
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} align="left" />
            <DescBlock tpl={tpl} text={text} fontSize={textSize} align="left" />
          </div>
          <div
            style={{
              position: 'absolute',
              right: sz(6),
              bottom: sz(5),
              width: sz(18),
              height: sz(8),
              backgroundImage: 'repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)',
            }}
          />
          <div style={{ position: 'absolute', left: sz(6), bottom: sz(6), fontSize: sz(2.8), color: '#999', fontFamily: FONTS.sans }}>NO.2026 / 08</div>
        </>
      );
      break;
    case 'tape':
      body = (
        <>
          <div style={{ position: 'absolute', left: '10%', right: '10%', top: '12%', bottom: '12%', background: '#fff', borderRadius: sz(0.8), transform: 'rotate(-1.5deg)', boxShadow: '0 4px 14px rgba(0,0,0,.09)' }} />
          <div style={{ position: 'absolute', left: '7%', top: '8%', width: sz(24), height: sz(3.6), background: 'rgba(255,107,107,.62)', transform: 'rotate(-18deg)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', right: '7%', top: '8%', width: sz(22), height: sz(3.4), background: 'rgba(78,205,196,.56)', transform: 'rotate(14deg)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: '12%', bottom: '8%', width: sz(20), height: sz(3.2), background: 'rgba(255,217,61,.56)', transform: 'rotate(10deg)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', right: '12%', bottom: '8%', width: sz(22), height: sz(3.4), background: 'rgba(168,230,207,.62)', transform: 'rotate(-12deg)', borderRadius: 2 }} />
          {center(16)}
        </>
      );
      break;
    case 'typewriter':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${sz(3.4)}, rgba(45,52,54,.06) ${sz(3.4)} ${sz(3.5)})`,
            }}
          />
          {center(14)}
        </>
      );
      break;
    case 'postage':
      body = (
        <>
          <div style={{ position: 'absolute', left: '12%', right: '12%', top: '14%', bottom: '14%', background: '#fff', border: `${sz(0.5)}px dotted ${tpl.frame}`, boxShadow: '0 4px 14px rgba(0,0,0,.2)', transform: 'rotate(-1.5deg)' }} />
          <div style={{ position: 'absolute', left: '14.5%', top: '16%', border: `${sz(0.4)}px solid ${tpl.frame}`, padding: `${sz(0.7)} ${sz(1.4)}`, fontSize: sz(3.4), fontWeight: 800, fontFamily: FONTS.sans, background: '#fff' }}>
            8分
          </div>
          {center(17)}
        </>
      );
      break;
    case 'bigType':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sz(8), textAlign: 'center' }}>
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} />
          </div>
          {lines[0] ? (
            <div style={{ position: 'absolute', bottom: sz(6), left: 0, right: 0, textAlign: 'center', padding: `0 ${sz(10)}` }}>
              <DescBlock tpl={tpl} text={text} fontSize={textSize} />
            </div>
          ) : null}
        </>
      );
      break;
    case 'monoReverse':
      body = center(14);
      break;
    case 'bigNumber':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: sz(12), gap: sz(1.4) }}>
            <div style={{ fontSize: sz(20), fontWeight: 900, color: tpl.accent, fontFamily: FONTS.smiley, lineHeight: 1 }}>
              {tpl.badge || '01'}
            </div>
            <TitleBlock tpl={tpl} title={title} fontSize={titleSize} />
            <DescBlock tpl={tpl} text={text} fontSize={textSize} />
          </div>
        </>
      );
      break;
    case 'gridSystem':
      body = (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg,#eee 1px, transparent 1px)',
              backgroundSize: `${sz(15)}px ${sz(15)}px`,
            }}
          />
          <div style={{ position: 'absolute', left: sz(6), top: sz(6), background: '#FFD60A', color: '#1A1A1A', fontSize: sz(2.6), padding: `${sz(1)} ${sz(2)}`, fontWeight: 700 }}>
            {tpl.badge || '数据'}
          </div>
          {center(14)}
        </>
      );
      break;
    case 'negativeSpace':
      body = (
        <>
          <div style={{ position: 'absolute', right: '-3%', top: '-8%', fontSize: sz(58), color: 'rgba(26,26,26,.09)', fontWeight: 900, fontFamily: FONTS.smiley }}>
            ？
          </div>
          {center(13)}
        </>
      );
      break;
    case 'neonFrame':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: sz(4),
              border: `${sz(0.7)}px solid ${tpl.frame}`,
              borderRadius: sz(2),
              boxShadow: `0 0 ${sz(1.5)}px ${tpl.frame}, 0 0 ${sz(3)}px ${tpl.frame}, inset 0 0 ${sz(1.5)}px ${tpl.frame}, inset 0 0 ${sz(3)}px ${tpl.frame}`,
            }}
          />
          {center(12, { textShadow: `0 0 ${sz(1)}px ${tpl.frame}` })}
        </>
      );
      break;
    case 'banner':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              left: '5%',
              right: '5%',
              top: '30%',
              bottom: '40%',
              background: tpl.frame,
              clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(0,0,0,.16)',
            }}
          >
            <div style={{ width: '100%', padding: `0 ${sz(8)}`, textAlign: 'center' }}>
              <TitleBlock tpl={tpl} title={title} fontSize={titleSize} color="#FFFFFF" />
            </div>
          </div>
          {lines[0] ? (
            <div style={{ position: 'absolute', bottom: sz(8), left: 0, right: 0, textAlign: 'center', padding: `0 ${sz(10)}` }}>
              <DescBlock tpl={tpl} text={text} fontSize={textSize} />
            </div>
          ) : null}
        </>
      );
      break;
    case 'waveLines':
      body = (
        <>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            {[0, 1, 2, 3, 4].map((i) => (
              <path
                key={i}
                d={`M0 ${40 + i * 5} Q 12 ${34 + i * 5} 25 ${40 + i * 5} T 50 ${40 + i * 5} T 75 ${40 + i * 5} T 100 ${40 + i * 5}`}
                stroke={tpl.frame}
                strokeWidth={0.7}
                fill="none"
                opacity={0.9 - i * 0.16}
              />
            ))}
          </svg>
          {center(12)}
        </>
      );
      break;
    case 'inkSplash':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: sz(72),
              height: sz(56),
              transform: 'translate(-50%,-50%)',
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(26,26,26,.10) 0 30%, transparent 60%), radial-gradient(circle at 25% 30%, rgba(230,57,70,.12) 0 18%, transparent 40%), radial-gradient(circle at 78% 65%, rgba(26,26,26,.08) 0 20%, transparent 42%)',
              filter: 'blur(2px)',
            }}
          />
          {center(12)}
        </>
      );
      break;
    case 'aurora':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: '-10%',
              background:
                'radial-gradient(ellipse at 30% 30%, rgba(0,229,255,.35) 0 18%, transparent 45%), radial-gradient(ellipse at 70% 25%, rgba(113,242,168,.3) 0 16%, transparent 42%), radial-gradient(ellipse at 55% 75%, rgba(168,85,247,.32) 0 20%, transparent 48%)',
              filter: 'blur(6px)',
            }}
          />
          {center(12, { textShadow: '0 0 10px rgba(0,229,255,.5)' })}
        </>
      );
      break;
    case 'candy':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.72) 2.5px, transparent 2.5px)',
              backgroundSize: '34px 34px',
            }}
          />
          {center(12)}
        </>
      );
      break;
    case 'cinemaTicket':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div style={{ position: 'absolute', left: '12%', right: '12%', top: '16%', bottom: '16%', background: '#FFFDF5', borderRadius: sz(0.8), boxShadow: '0 6px 18px rgba(0,0,0,.14)' }} />
          <div style={{ position: 'absolute', left: '28%', top: '16%', bottom: '16%', borderLeft: `${sz(0.4)}px dashed ${tpl.frame}` }} />
          <div style={{ position: 'absolute', left: '14%', right: '12%', top: '17.5%', display: 'flex', justifyContent: 'space-between', fontSize: sz(3), color: tpl.frame }}>
            <span>影 · 票</span>
            <span>NO.2026</span>
          </div>
          <div style={{ position: 'absolute', left: '15%', right: '13%', top: '34%', bottom: '22%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sz(1.2) }}>
            <TitleBlock tpl={tpl} title={title} fontSize={sz(7)} align="left" />
            <DescBlock tpl={tpl} text={text} fontSize={sz(3.4)} align="left" color={tpl.frame} />
          </div>
          <div style={{ position: 'absolute', left: '15%', right: '13%', bottom: '18%', display: 'flex', justifyContent: 'space-between', fontSize: sz(2.8), color: '#a89880' }}>
            <span>座：7排3号</span>
            <span>场次：20:30</span>
          </div>
        </>
      );
      break;
    case 'scrapCollage':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div style={{ position: 'absolute', left: '7%', top: '14%', width: '48%', height: '30%', background: '#fff', borderTop: `${sz(1)}px solid ${tpl.frame}`, boxShadow: '0 3px 10px rgba(0,0,0,.12)', transform: 'rotate(-4deg)', padding: sz(2), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sz(3.6), fontWeight: 600, color: '#333', textAlign: 'center' }}>
            {lines[0] || '剪报'}
          </div>
          <div style={{ position: 'absolute', right: '7%', top: '24%', width: '46%', height: '28%', background: '#FBF6E9', borderTop: `${sz(1)}px solid ${tpl.frame2}`, boxShadow: '0 3px 10px rgba(0,0,0,.1)', transform: 'rotate(3deg)', padding: sz(2), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: sz(3.4), color: '#555', textAlign: 'center' }}>
            {lines[1] || tpl.badge || ''}
          </div>
          <div style={{ position: 'absolute', left: '19%', right: '19%', top: '38%', height: '34%', background: '#fff', borderTop: `${sz(1)}px solid ${tpl.accent}`, boxShadow: '0 5px 16px rgba(0,0,0,.14)', transform: 'rotate(-1deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${sz(4)}`, textAlign: 'center' }}>
            <TitleBlock tpl={tpl} title={title} fontSize={sz(6)} />
          </div>
        </>
      );
      break;
    case 'glowText':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sz(8) }}>
            <TitleBlock
              tpl={tpl}
              title={title}
              fontSize={sz(13)}
              extra={{ textShadow: `0 0 ${sz(2)}px ${tpl.frame}, 0 0 ${sz(5)}px ${tpl.frame}, 0 0 ${sz(10)}px ${tpl.frame}` }}
            />
          </div>
          {lines[0] ? (
            <div style={{ position: 'absolute', bottom: sz(6), left: 0, right: 0, textAlign: 'center', padding: `0 ${sz(10)}` }}>
              <DescBlock tpl={tpl} text={text} fontSize={textSize} />
            </div>
          ) : null}
        </>
      );
      break;
    case 'blockGrid':
      body = (
        <>
          <div style={{ position: 'absolute', top: sz(4), left: sz(4), width: sz(13), height: sz(13), background: '#FF6B6B', borderRadius: sz(1) }} />
          <div style={{ position: 'absolute', top: sz(4), right: sz(4), width: sz(9), height: sz(9), background: '#FFD60A', borderRadius: sz(1) }} />
          <div style={{ position: 'absolute', bottom: sz(4), left: sz(4), width: sz(9), height: sz(9), background: '#4ECDC4', borderRadius: sz(1) }} />
          <div style={{ position: 'absolute', bottom: sz(4), right: sz(4), width: sz(13), height: sz(13), background: '#A8E6CF', borderRadius: sz(1) }} />
          {center(13)}
        </>
      );
      break;
    case 'outlineText':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sz(8) }}>
            <TitleBlock
              tpl={tpl}
              title={title}
              fontSize={sz(14)}
              color="transparent"
              extra={{ WebkitTextStroke: `${sz(0.5)}px ${tpl.titleColor}` }}
            />
          </div>
          {lines[0] ? (
            <div style={{ position: 'absolute', bottom: sz(6), left: 0, right: 0, textAlign: 'center', padding: `0 ${sz(10)}` }}>
              <DescBlock tpl={tpl} text={text} fontSize={textSize} />
            </div>
          ) : null}
        </>
      );
      break;
    case 'blueprint':
      body = (
        <>
          <div style={{ position: 'absolute', inset: 0, background: tpl.bg }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
              backgroundSize: `${sz(9)}px ${sz(9)}px`,
            }}
          />
          <div style={{ position: 'absolute', top: sz(5), left: sz(6), fontSize: sz(3), color: 'rgba(255,255,255,.55)', fontFamily: FONTS.type, letterSpacing: 2 }}>
            DWG-2026-08
          </div>
          {center(13, { textShadow: '0 0 8px rgba(0,229,255,.35)' })}
        </>
      );
      break;
    default:
      body = center(12);
  }
  }

  return (
    <div ref={rootRef} style={{ ...coverThumbStyle(tpl), ...style }}>
      {custom.customCSS ? <style>{custom.customCSS}</style> : null}
      {body}
      {tpl.showPage && <PagePill w={w} />}
      {tpl.showArrow && <SwipeArrow w={w} />}
    </div>
  );
}
