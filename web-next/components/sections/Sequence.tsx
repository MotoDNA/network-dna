"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* 스크롤로 재생되는 영상 — 프레임 사진을 스크롤 진행률대로 캔버스에 그립니다.
   PC: public/seq-hd (1920×1080, 132장) · 휴대폰: public/seq-m (960×540, 66장)
   이웃한 두 장을 섞어 그려서(블렌딩) 장면 사이가 끊기지 않게 합니다. */
const HOLD = 0.16; // 조립이 끝난 뒤 그대로 머무는 구간 (전체 재생 길이 1 기준, 휠 한두 칸)
export default function Sequence() {
  const sec = useRef<HTMLElement>(null), cv = useRef<HTMLCanvasElement>(null);
  // 다른 고정 섹션과 같은 순서로 만들어져야 위치 계산이 맞습니다 (useGSAP 사용)
  useGSAP(() => {
    const c = cv.current!, cx = c.getContext("2d")!, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = innerWidth < 768, N = mobile ? 66 : 132, dir = mobile ? "seq-m" : "seq-hd";
    c.width = mobile ? 960 : 1920; c.height = mobile ? 540 : 1080;
    const imgs: HTMLImageElement[] = []; let lastKey = ""; const st = { f: 0 };
    const ok = (i: number) => imgs[i]?.complete && imgs[i].naturalWidth > 0;
    const draw = () => {
      let a = Math.floor(st.f); const frac = st.f - a; while (a > 0 && !ok(a)) a--; // 아직 못 받은 장은 가장 가까운 앞 장으로
      if (!ok(a)) return; const b = a + 1, blend = frac > 0.02 && b < N && ok(b);
      const key = a + (blend ? ":" + frac.toFixed(2) : ""); if (key === lastKey) return; lastKey = key;
      cx.globalAlpha = 1; cx.drawImage(imgs[a], 0, 0, c.width, c.height);
      if (blend) { cx.globalAlpha = frac; cx.drawImage(imgs[b], 0, 0, c.width, c.height); cx.globalAlpha = 1; }
    };
    const load = (i: number) => { const im = new Image(); im.decoding = "async"; im.onload = draw; im.src = `/${dir}/f${String(i + 1).padStart(3, "0")}.webp`; imgs[i] = im; };
    if (reduce) { st.f = N - 1; load(N - 1); return; }
    load(0);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { for (let i = 1; i < N; i++) load(i); io.disconnect(); } }, { rootMargin: "250% 0px" });
    io.observe(sec.current!);
    const tl = gsap.timeline({ scrollTrigger: { trigger: sec.current, start: "top top", end: ScrollTrigger.isTouch ? "+=175%" : "+=232%", pin: true, scrub: 0.6, anticipatePin: 1 } });
    tl.to(st, { f: N - 1, ease: "none", duration: 1, onUpdate: draw }, 0);
    tl.to({}, { duration: HOLD }, 1); // 완성된 화면에서 잠시 멈춤
    return () => { io.disconnect(); };
  }, { scope: sec });
  return (
    <section ref={sec} className="relative h-[100dvh] overflow-hidden bg-[#000]">
      <canvas ref={cv} width={1920} height={1080} aria-hidden className="absolute left-1/2 top-1/2 w-[min(118%,150vh)] max-w-none -translate-x-1/2 -translate-y-1/2 md:w-[max(100%,177.78vh)]" />
      <h2 className="sr-only">기기가 조립되는 장면</h2>
    </section>
  );
}
