"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* 어두운 화면 → 밝은 화면. 가로 막대 bars 개가 아래부터 차례로 덮입니다. color = 다음 섹션 배경색 */
export default function StripeTransition({ color = "#F2F4F6", from = "#0B0D10", bars = 5, label }: { color?: string; from?: string; bars?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(ref.current!.querySelectorAll("i"), { scaleY: 0 }, { scaleY: 1, ease: "none", stagger: { each: 0.3, from: "end" }, scrollTrigger: { trigger: ref.current, start: "top 85%", end: "bottom bottom", scrub: 0.6 } });
    });
  }, { scope: ref });
  return (
    <div ref={ref} className="relative flex h-[45vh] flex-col md:h-[60vh]" style={{ background: from }} aria-hidden>
      {label && <p className="label absolute left-5 top-6 z-10 text-ink3 mix-blend-difference md:left-12">{label}</p>}
      {Array.from({ length: bars }).map((_, i) => <i key={i} className="block flex-1 origin-center motion-reduce:!scale-100" style={{ background: color, marginBottom: -1 }} />)}
    </div>
  );
}
