import { useLayoutEffect, useRef } from "react";
export function usePublishLayout() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      if (!element.getClientRects().length) return;
      const height = `${Math.max(420, window.innerHeight - element.getBoundingClientRect().top - 20)}px`;
      if (element.style.getPropertyValue("--publish-height") !== height)
        element.style.setProperty("--publish-height", height);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return root;
}
