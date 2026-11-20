"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { useContact } from "./providers/ContactPanel";
import { useSound } from "./providers/SoundProvider";
/* 고정 머리. mix-blend-difference 로 어두운·밝은 배경 모두에서 보입니다. 내리면 숨고 올리면 나타납니다. */
const MENU = [["기능", "/#features"], ["만든 것", "/#works"], ["일하는 태도", "/#attitude"], ["고객 로그인", "/reservice"]];
export default function Header() {
  const [hide, setHide] = useState(false);
  const { open } = useContact(); const { on, toggle } = useSound();
  useEffect(() => {
    let last = 0;
    const f = () => { const y = scrollY; setHide(y > last && y > 120); last = y; };
    addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-transform duration-500 ${hide ? "-translate-y-full" : ""}`}>
      <div className="wrap flex h-[72px] items-center justify-between gap-4">
        <Link href="/" className="flex min-h-[44px] items-center text-white mix-blend-difference" aria-label="DNA Labs 홈"><Logo className="h-[20px] md:h-[24px]" /></Link>
        <nav aria-label="주 메뉴" className="hidden md:flex gap-8 text-[14px] font-semibold text-white mix-blend-difference">
          {MENU.map(([t, h]) => <a key={h} href={h} className="py-3 opacity-80 transition-[opacity,filter] hover:opacity-100 hover:blur-[0.6px]">{t}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggle} aria-pressed={on} aria-label="소리 켜고 끄기" className="label hidden min-h-[44px] rounded-full border border-white/25 px-3 text-white mix-blend-difference sm:inline-flex sm:items-center">Sound {on ? "on" : "off"}</button>
          <button type="button" onClick={() => open()} className="inline-flex min-h-[44px] items-center rounded-full bg-point px-5 text-[13px] font-bold text-white transition-colors hover:bg-point-hover">문의하기</button>
        </div>
      </div>
    </header>
  );
}
