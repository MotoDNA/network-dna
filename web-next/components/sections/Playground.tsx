"use client";
import { useEffect, useRef, useState } from "react";
import { useContact } from "@/components/providers/ContactPanel";
import { useSound } from "@/components/providers/SoundProvider";
/* 실제로 작동하는 기능 4가지 — 비교 슬라이더, 기능 고르기, 상담 시간 고르기, 소리 */
const card = "rounded-3xl border border-[#dde2e8] bg-white p-6 md:p-8";
const chip = (on: boolean) => `min-h-[44px] rounded-full border px-4 text-[14px] font-semibold transition-colors ${on ? "border-point bg-point text-white" : "border-[#c9d0d8] bg-white text-ink hover:border-ink"}`;

function Compare() {
  const [v, setV] = useState(50);
  return (
    <div className={card + " md:col-span-2"}>
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "16/9" }}>
        <img src="/compare/after.webp" alt="조립된 기기" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <img src="/compare/before.webp" alt="분해된 기기" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }} loading="lazy" />
        <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white" style={{ left: `${v}%` }}><span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[13px] font-bold text-ink shadow-lg">↔</span></div>
        <span className="label absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-white">Before</span><span className="label absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-white">After</span>
        <input type="range" min={0} max={100} value={v} onChange={(e) => setV(+e.target.value)} aria-label="전후 비교 위치" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
    </div>
  );
}
const KINDS = ["웹사이트", "모바일 앱", "업무 프로그램"];
const OPTS = ["3D·움직임 효과", "문의·예약 받기", "직접 고치는 관리 화면", "다국어", "온라인 결제", "기존 엑셀 연결"];
function Picker() {
  const [kind, setKind] = useState(KINDS[0]), [opts, setOpts] = useState<string[]>([]);
  const { open } = useContact(); const { play } = useSound();
  const text = `[만들고 싶은 것] ${kind}\n[필요한 기능] ${opts.length ? opts.join(", ") : "아직 모르겠음"}\n\n`;
  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap gap-2">{KINDS.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); play("tick"); }} className={chip(kind === k)}>{k}</button>)}</div>
      <div className="flex flex-wrap gap-2">{OPTS.map((o) => { const on = opts.includes(o); return <button key={o} type="button" aria-pressed={on} onClick={() => { setOpts(on ? opts.filter((x) => x !== o) : [...opts, o]); play("tick"); }} className={chip(on)}>{on ? "✓ " : "+ "}{o}</button>; })}</div>
      <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-paper p-4 font-mono text-[13px] leading-[1.7] text-ink2" aria-live="polite">{text.trim()}</pre>
      <button type="button" onClick={() => open(text)} className="mt-4 min-h-[48px] w-full rounded-full bg-ink text-[15px] font-bold text-white transition-colors hover:bg-point">이 내용으로 문의하기 →</button>
    </div>
  );
}
function Booking() {
  const [days, setDays] = useState<{ key: string; label: string }[]>([]), [d, setD] = useState(""), [t, setT] = useState("");
  const { open } = useContact(); const { play } = useSound();
  useEffect(() => { // 오늘 다음 날부터 평일 5일
    const out: { key: string; label: string }[] = []; const now = new Date();
    for (let i = 1; out.length < 5; i++) { const x = new Date(now); x.setDate(now.getDate() + i); if (x.getDay() % 6 === 0) continue; out.push({ key: x.toDateString(), label: `${x.getMonth() + 1}/${x.getDate()} (${"일월화수목금토"[x.getDay()]})` }); }
    setDays(out);
  }, []);
  const TIMES = ["오전 10시", "오후 2시", "오후 4시", "저녁 7시"];
  const pick = days.find((x) => x.key === d)?.label;
  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap gap-2">{days.map((x) => <button key={x.key} type="button" aria-pressed={d === x.key} onClick={() => { setD(x.key); play("tick"); }} className={chip(d === x.key)}>{x.label}</button>)}</div>
      <div className="flex flex-wrap gap-2">{TIMES.map((x) => <button key={x} type="button" aria-pressed={t === x} onClick={() => { setT(x); play("tick"); }} className={chip(t === x)}>{x}</button>)}</div>
      <button type="button" disabled={!pick || !t} onClick={() => open(`[상담 희망 시간] ${pick} ${t}\n\n`)} className="mt-5 min-h-[48px] w-full rounded-full bg-ink text-[15px] font-bold text-white transition-colors hover:bg-point disabled:bg-[#c9d0d8]">{pick && t ? `${pick} ${t}에 상담 요청하기 →` : "상담 요청하기 →"}</button>
      <p className="mt-3 text-[13px] text-ink3">요청을 보내시면 가능한 시간인지 확인해 답을 드립니다.</p>
    </div>
  );
}
const NOTES = [196, 220, 247, 294, 330, 392, 440, 494];
function Sound() {
  const { on, toggle, play } = useSound(); const [hit, setHit] = useState(-1); const tm = useRef<ReturnType<typeof setTimeout>>(undefined);
  const press = (i: number) => { play("note", NOTES[i]); setHit(i); clearTimeout(tm.current); tm.current = setTimeout(() => setHit(-1), 250); };
  return (
    <div className={card + " md:col-span-2"}>
      <div className="flex flex-wrap items-end justify-between gap-4"><span />
        <button type="button" onClick={toggle} aria-pressed={on} className={chip(on)}>{on ? "Sound on" : "Sound off"}</button></div>
      <div className="mt-6 flex h-36 items-end gap-2 md:h-44">{NOTES.map((n, i) => <button key={n} type="button" onPointerDown={() => press(i)} onMouseEnter={(e) => e.buttons === 0 && on && press(i)} aria-label={`${i + 1}번 음`} className={`flex-1 rounded-t-xl transition-[height,background-color] duration-200 ${hit === i ? "bg-point" : "bg-ink"}`} style={{ height: `${(hit === i ? 100 : 42 + i * 7)}%` }} />)}</div>
    </div>
  );
}
export default function Playground() {
  return (
    <section className="bg-paper pb-14 pt-20 text-ink md:pb-20 md:pt-28">
      <div className="wrap">
        <h2 className="sr-only">직접 써 보는 기능</h2>
        <div className="grid gap-5 md:grid-cols-2"><Compare /><Picker /><Booking /><Sound /></div>
      </div>
    </section>
  );
}
