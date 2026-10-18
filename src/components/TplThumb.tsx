import { ReactNode,useEffect,useRef,useState } from 'react';

/**
 * 模板缩略图：把 620px 宽的模板画布按容器实际宽度自适应缩放，
 * 让内容填满卡片，避免右侧大片空白。
 */
export default function TplThumb({
  className,
  style,
  children,
}: {
  className: string;
  style: React.CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.22);

  useEffect(() => {
    const el = ref.current;
    if (!el?.parentElement) return;
    const frame=el.parentElement;
    const measure = () => {
      if (frame.clientWidth > 0) setScale(frame.clientWidth / 620);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`tpl-preview ${className}`}
      style={{ ...style, transform: `scale(${scale})`, transformOrigin: '0 0' }}
    >
      {children}
    </div>
  );
}
