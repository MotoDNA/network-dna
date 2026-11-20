"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { useScrollState } from "@/components/providers/LenisProvider";
import { prefersReducedMotion } from "@/lib/canvasManager";
gsap.registerPlugin(Draggable, InertiaPlugin);
/* 끊김 없이 흐르는 큰 글자. 잡아 끌 수 있고, 올리면 멈추고, 스크롤 속도를 따라 빨라집니다. speed: 초당 이동(px÷60) */
export default function InfiniteMarquee({ items, speed = 0.8, className = "" }: { items: { text: string; color?: string }[]; speed?: number; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const { state } = useScrollState();
  useEffect(() => {
    const el = track.current!; if (prefersReducedMotion()) return;
    let x = 0, hover = 1, target = 1, dragging = false, on = true;
    const half = () => el.scrollWidth / 2;
    const wrap = (v: number) => { const h = half(); return ((v % h) - h) % h; };
    const tick = () => {
      if (!on || dragging) return;
      hover += (target - hover) * 0.08;
      const v = state.current?.velocity ?? 0;
      x = wrap(x - (speed + Math.min(Math.abs(v) * 0.25, 14)) * hover * (v < 0 ? -1 : 1));
      gsap.set(el, { x });
    };
    gsap.ticker.add(tick);
    const proxy = document.createElement("div");
    const d = Draggable.create(proxy, { type: "x", trigger: el, inertia: true, onPress() { dragging = true; gsap.set(proxy, { x }); }, onDrag() { x = wrap(this.x); gsap.set(el, { x }); }, onThrowUpdate() { x = wrap(this.x); gsap.set(el, { x }); }, onThrowComplete() { dragging = false; }, onRelease() { if (!this.tween) dragging = false; } })[0];
    const io = new IntersectionObserver(([e]) => (on = e.isIntersecting)); io.observe(el);
    const enter = () => (target = 0), leave = () => (target = 1);
    el.addEventListener("mouseenter", enter); el.addEventListener("mouseleave", leave);
    return () => { gsap.ticker.remove(tick); d.kill(); io.disconnect(); el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
  }, [speed, state]);
  const row = (hidden: boolean) => items.map((it, i) => (
    <span key={(hidden ? "b" : "a") + i} aria-hidden={hidden} className="flex items-center">
      <span style={{ color: it.color }}>{it.text}</span>
      <span aria-hidden className="mx-[0.35em] text-[0.5em] font-light text-ink3">+</span>
    </span>
  ));
  return <div className={`overflow-hidden select-none ${className}`}><div ref={track} className="flex w-max cursor-grab active:cursor-grabbing will-change-transform">{row(false)}{row(true)}</div></div>;
}
