"use client";
import { createContext, useContext, useEffect, useRef } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/canvasManager";

gsap.registerPlugin(ScrollTrigger);
type State = { scroll: number; velocity: number };
const Ctx = createContext<{ state: React.RefObject<State>; lenis: React.RefObject<Lenis | null> } | null>(null);
/** 다른 부품이 지금 스크롤 값과 속도를 읽을 때 씁니다 */
export const useScrollState = () => useContext(Ctx)!;
const HEADER = 72;

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const state = useRef<State>({ scroll: 0, velocity: 0 });
  const lenis = useRef<Lenis | null>(null);
  useEffect(() => {
    // 글꼴·이미지가 다 뜬 뒤 고정 섹션 위치를 다시 계산합니다
    const re = () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); };
    document.fonts?.ready.then(re); addEventListener("load", re);
    return () => removeEventListener("load", re);
  }, []);
  useEffect(() => {
    if (prefersReducedMotion() || ScrollTrigger.isTouch === 1) return; // 터치 기기·움직임 줄이기: 기본 스크롤
    const l = new Lenis({ lerp: 0.1, anchors: { offset: -HEADER } });
    lenis.current = l;
    l.on("scroll", (e: Lenis) => { state.current = { scroll: e.scroll, velocity: e.velocity }; ScrollTrigger.update(); });
    const raf = (t: number) => l.raf(t * 1000);
    gsap.ticker.add(raf); gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); l.destroy(); lenis.current = null; };
  }, []);
  return <Ctx.Provider value={{ state, lenis }}>{children}</Ctx.Provider>;
}
