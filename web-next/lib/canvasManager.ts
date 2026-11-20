import gsap from "gsap";

/* 모든 캔버스 그리기를 gsap.ticker 하나로 돌립니다.
   화면 밖이거나 탭이 숨겨지면 그 캔버스는 건너뜁니다. */
type Entry = { el: Element; draw: (t: number, dt: number) => void; visible: boolean };
const list = new Set<Entry>();
let io: IntersectionObserver | null = null;
let running = false;

function loop(time: number, delta: number) {
  if (document.hidden) return;
  list.forEach((e) => e.visible && e.draw(time, delta / 1000));
}
export function registerCanvas(el: Element, draw: Entry["draw"]) {
  const entry: Entry = { el, draw, visible: true };
  if (!io) io = new IntersectionObserver((xs) => xs.forEach((x) => list.forEach((e) => { if (e.el === x.target) e.visible = x.isIntersecting; })));
  io.observe(el); list.add(entry);
  if (!running) { gsap.ticker.add(loop); running = true; }
  return () => { io?.unobserve(el); list.delete(entry); if (!list.size) { gsap.ticker.remove(loop); running = false; } };
}
export const prefersReducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
