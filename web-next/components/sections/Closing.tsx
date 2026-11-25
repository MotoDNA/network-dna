"use client";
import { useEffect, useState } from "react";
import WordShiftButton from "@/components/motion/WordShiftButton";
import Logo from "@/components/Logo";
import AskButton from "@/components/AskButton";
import LineWordmark from "@/components/motion/LineWordmark";
export default function Closing() {
  const [t, setT] = useState("");
  useEffect(() => { const f = () => setT(new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())); f(); const id = setInterval(f, 15000); return () => clearInterval(id); }, []);
  return (
    <footer id="ask" className="bg-night pb-10 pt-14 md:pt-20">
      <div className="wrap">
        {/* 선으로 그린 로고 — 작동하는 기능 섹션과 문의 사이 */}
        <div className="mb-16 text-white md:mb-24"><LineWordmark /></div>
        <p className="label mb-6 text-ink3">문의</p>
        <h2 className="h-hero">만들고 싶은 것이<br />있으신가요</h2>
        <p className="mt-6 max-w-[32em] text-[16px] leading-[1.75] text-white/70">아직 정리되지 않은 생각이어도 괜찮습니다. 지금 업무를 어떻게 하고 계신지부터 듣겠습니다. 만들 필요가 없다면 그렇게 말씀드립니다.</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <AskButton />
          <WordShiftButton href="mailto:hello@dnalabs.kr?subject=프로젝트 문의">hello@dnalabs.kr</WordShiftButton>
          <WordShiftButton href="tel:010-4642-3477">010-4642-3477</WordShiftButton>
        </div>
        <div className="mt-20 flex flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-8">
          <Logo className="h-7 text-white" />
          <p className="label text-ink3">Seoul → <span className="text-white">{t}</span></p>
        </div>
        <div className="mt-8 space-y-1 text-[13px] leading-relaxed text-ink3">
          <p>디엔에이랩스 (DNA Labs) · 대표 최환준 · 사업자등록번호 119-37-01707 · 통신판매업신고 2026-경기파주-3695</p>
          <p>경기도 파주시 문발로 140, 301-D57호 · 개인정보 보호책임자 최환준</p>
          <p className="flex flex-wrap gap-x-4"><a href="/terms.html" className="underline">이용약관</a><a href="/privacy.html" className="underline">개인정보 처리방침</a><a href="/refund.html" className="underline">환불정책</a><a href="/reservice" className="underline">고객 로그인</a></p>
          <p>© 2026 DNA Labs. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
