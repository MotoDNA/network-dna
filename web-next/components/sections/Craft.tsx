"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* 날아오는 카드 — 카드가 멀리서 다가왔다가 화면 앞으로 지나갑니다. OVERLAP: 카드끼리 겹치는 정도 */
const OVERLAP = 0.55;
const CARDS = [
  ["웹사이트", "회사 소개, 제품 소개, 예약과 문의까지. 검색 노출과 모바일 최적화를 기본으로 합니다.", "M3 5h18v14H3zM3 9h18"],
  ["모바일 앱", "기획부터 개발, 출시와 배포까지 책임집니다.", "M8 2h8v20H8zM11 18h2"],
  ["업무 프로그램", "매번 손으로 하던 집계와 문서 작업을 줄입니다. 쓰시던 엑셀을 그대로 연결할 수도 있습니다.", "M4 4h16v16H4zM4 10h16M10 4v16"],
];
export default function Craft() {
  const sec = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]", sec.current);
      const tl = gsap.timeline({ scrollTrigger: { trigger: sec.current, start: "top top", end: "+=220%", pin: true, scrub: 0.6, anticipatePin: 1 } });
      cards.forEach((c, i) => {
        const ox = [-22, 18, -6][i % 3], oy = [10, -14, 6][i % 3];
        tl.fromTo(c, { z: -1500, xPercent: ox, yPercent: oy, opacity: 0, filter: "blur(12px)" }, { z: 0, xPercent: 0, yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1, ease: "power2.out" }, i * (1 + OVERLAP));
        if (i < cards.length - 1) tl.to(c, { z: 600, opacity: 0, filter: "blur(8px)", duration: 0.8, ease: "power2.in" }, i * (1 + OVERLAP) + 1.1);
      });
    });
  }, { scope: sec });
  return (
    <section ref={sec} id="work" className="relative overflow-hidden bg-night py-24 md:h-[100dvh] md:py-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_110%,#14294d_0%,#0B0D10_60%)]" aria-hidden />
      <div className="wrap relative flex h-full flex-col md:justify-center">
        <h2 className="h-sec mb-10 md:absolute md:top-[104px] md:mb-0">이런 것을 만듭니다</h2>
        <div className="grid gap-4 md:block md:[perspective:1200px]">
          {CARDS.map(([t, d, icon]) => (
            <article key={t} data-card className="rounded-3xl border border-white/15 bg-white/[0.06] p-7 backdrop-blur-md md:absolute md:left-1/2 md:top-1/2 md:-ml-[230px] md:-mt-[120px] md:w-[460px] md:p-9 md:[transform-style:preserve-3d]">
              <svg viewBox="0 0 24 24" className="mb-8 ml-auto h-8 w-8 text-point" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><path d={icon} /></svg>
              <h3 className="mb-3 text-[26px] font-bold">{t}</h3><p className="text-[15px] leading-[1.7] text-white/70">{d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
