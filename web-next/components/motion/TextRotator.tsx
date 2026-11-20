"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/canvasManager";
/* prefix 뒤 단어가 interval 마다 글자 단위로 굴러 바뀝니다. colors 를 주면 단어마다 색이 따라갑니다. */
type P = { texts: string[]; colors?: string[]; interval?: number; onChange?: (i: number) => void };
export default function TextRotator({ texts, colors, interval = 3000, onChange }: P) {
  const [i, setI] = useState(0);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const el = box.current; if (!el) return;
      gsap.to(el.querySelectorAll("i"), { yPercent: -100, opacity: 0, stagger: 0.03, duration: 0.35, ease: "power2.in", onComplete: () => setI((v) => (v + 1) % texts.length) });
    }, interval);
    return () => clearInterval(id);
  }, [texts.length, interval]);
  useEffect(() => {
    onChange?.(i);
    const el = box.current; if (!el || prefersReducedMotion()) return;
    gsap.fromTo(el.querySelectorAll("i"), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.03, duration: 0.5, ease: "power3.out" });
  }, [i]); // eslint-disable-line
  const longest = texts.reduce((a, b) => (b.length > a.length ? b : a));
  return (
    <span className="relative inline-block overflow-hidden align-bottom" aria-live="polite">
      <span className="invisible" aria-hidden>{longest}</span>
      <span ref={box} className="absolute left-0 top-0 whitespace-nowrap" style={{ color: colors?.[i] }}>
        {[...texts[i]].map((c, k) => <i key={i + "-" + k} className="inline-block not-italic">{c}</i>)}
      </span>
    </span>
  );
}
