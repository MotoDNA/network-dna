"use client";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import TextRotator from "@/components/motion/TextRotator";
import WordShiftButton from "@/components/motion/WordShiftButton";
import AskButton from "@/components/AskButton";

const DnaHelixHero = dynamic(() => import("@/components/three/DnaHelixHero"), { ssr: false });
const WORDS = ["3D를", "움직임을", "소리를", "이야기를"];
const COLORS = ["#3182F6", "#5AA0FF", "#8FB8FF", "#3182F6"];

export default function Hero() {
  const sec = useRef<HTMLElement>(null);
  const [, setI] = useState(0);
  const progress = useCallback(() => { const el = sec.current; if (!el) return 0; return Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - innerHeight))); }, []);
  return (
    <section ref={sec} className="relative h-[260vh] bg-night motion-reduce:h-auto" aria-label="소개">
      {/* 화면은 고정되고, 스크롤한 만큼 나선이 돌다가 풀립니다 */}
      <div className="sticky top-0 h-[100dvh] min-h-[640px] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#16294a_0%,#0B0D10_62%)]" aria-hidden />
      <DnaHelixHero progress={progress} />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-night via-night/90 to-transparent md:hidden" aria-hidden />
      <div className="wrap relative flex h-full flex-col justify-end pb-10 md:justify-center md:pb-0 pointer-events-none">
        <h1 className="h-hero max-w-[11em]">
          홈페이지에<br /><TextRotator texts={WORDS} colors={COLORS} onChange={setI} /><br />담아 드립니다
        </h1>
        <p className="mt-6 max-w-[34em] text-[15px] leading-[1.7] text-white/75 md:text-[16px]">보기만 하는 홈페이지가 아니라 만져 보는 홈페이지를 만듭니다. 이 페이지의 모든 효과는 실제로 넣어 드릴 수 있는 기능입니다. 내려가며 직접 써 보세요.</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 pointer-events-auto">
          <AskButton />
          <WordShiftButton href="#features">기능 둘러보기</WordShiftButton>
        </div>
      </div>
      </div>
    </section>
  );
}
