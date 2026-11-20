"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* 흩어진 글자가 스크롤에 따라 제자리로 모입니다. lines: 줄 단위 문장 */
const rnd = (seed: number) => { const x = Math.sin(seed * 99.13) * 43758.5453; return x - Math.floor(x); };
export default function ScatterText({ lines, className = "", as: Tag = "h2" }: { lines: string[]; className?: string; as?: "h2" | "p" }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const cs = ref.current!.querySelectorAll<HTMLElement>("[data-c]");
      gsap.fromTo(cs, { x: (i) => (rnd(i + 1) - 0.5) * innerWidth * 0.7, y: (i) => (rnd(i + 7) - 0.5) * innerHeight * 0.55, rotation: (i) => (rnd(i + 13) - 0.5) * 180, scale: (i) => 0.6 + rnd(i + 21) * 0.8, opacity: (i) => (rnd(i + 3) > 0.6 ? 0.3 : 0.8) },
        { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, ease: "power2.out", stagger: { each: 0.02, from: "random" }, scrollTrigger: { trigger: ref.current, start: "top 95%", end: "top 30%", scrub: 1 } });
    });
  }, { scope: ref });
  let n = 0;
  return (
    <div ref={ref}><Tag className={className} aria-label={lines.join(" ")}>
      {lines.map((l, li) => <span key={li} className="block" aria-hidden>{l.split(" ").map((w, wi) => <span key={wi} className="mr-[0.25em] inline-block whitespace-nowrap">{[...w].map((c) => <span key={n} data-c={n++} className="inline-block will-change-transform">{c}</span>)}</span>)}</span>)}
    </Tag></div>
  );
}
