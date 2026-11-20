"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* "3~4" 같은 글자를 받아 숫자 자리마다 0~9 띠를 굴립니다. 숫자가 아닌 글자는 그대로 둡니다. */
export default function RollingCounter({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ref.current!.querySelectorAll<HTMLElement>("[data-d]").forEach((el, i) => {
        gsap.fromTo(el, { yPercent: 0 }, { yPercent: -(+el.dataset.d! * 10), duration: 1.6, delay: i * 0.15, ease: "power3.out", scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } });
      });
    });
  }, { scope: ref });
  return (
    <span ref={ref} className={`inline-flex tabular-nums leading-none ${className}`} aria-label={value}>
      {[...value].map((c, i) => /\d/.test(c) ? (
        <span key={i} aria-hidden className="inline-block h-[1em] overflow-hidden">
          <span data-d={c} className="block motion-reduce:hidden">{Array.from({ length: 10 }).map((_, n) => <span key={n} className="block h-[1em]">{n}</span>)}</span>
          <span className="hidden motion-reduce:block">{c}</span>
        </span>
      ) : <span key={i} aria-hidden>{c}</span>)}
    </span>
  );
}
