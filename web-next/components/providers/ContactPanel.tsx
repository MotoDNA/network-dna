"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSound } from "./SoundProvider";
/* 오른쪽에서 나오는 문의 창. 어디서든 open("미리 채울 내용") 으로 엽니다.
   전송은 지금 사이트와 같은 곳(Supabase site 함수, action: inquiry)으로 보냅니다. */
const FN = "https://izrtclsqhsgkuwsffifn.supabase.co/functions/v1/site";
const KEY = "sb_publishable_G5wx-YdgwUU630x1vKmZmQ_15BgxvEX";
const WANTS = [["site", "웹사이트"], ["app", "앱"], ["custom", "업무 프로그램"]];
const Ctx = createContext<{ open: (preset?: string) => void }>({ open() {} });
export const useContact = () => useContext(Ctx);

export function ContactPanelProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false), [msg, setMsg] = useState(""), [want, setWant] = useState(""), [state, setState] = useState<"idle" | "sending" | "done">("idle"), [err, setErr] = useState("");
  const panel = useRef<HTMLDivElement>(null), opener = useRef<HTMLElement | null>(null);
  const { play } = useSound();
  const open = useCallback((preset?: string) => { opener.current = document.activeElement as HTMLElement; if (preset) setMsg(preset); setErr(""); setShown(true); play("woosh"); }, [play]);
  const close = useCallback(() => { setShown(false); opener.current?.focus(); }, []);
  useEffect(() => {
    if (!shown) return;
    const el = panel.current!; el.querySelector<HTMLElement>("input,textarea,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") { const f = el.querySelectorAll<HTMLElement>("a,button,input,textarea"); const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, [shown, close]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const v = (n: string) => String(f.get(n) || "").trim();
    if (!v("name") || !v("contact") || !msg.trim()) return setErr("성함, 연락받으실 곳, 내용을 적어 주세요.");
    if (!f.get("agreed")) return setErr("개인정보 수집·이용에 동의해 주셔야 보낼 수 있습니다.");
    setState("sending"); setErr("");
    try {
      const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY }, body: JSON.stringify({ action: "inquiry", agreed: true, name: v("name"), company: v("company"), contact: v("contact"), want, people: "", message: msg.trim(), website: v("website"), source: "/" }) });
      const j = await r.json(); if (!j?.ok) throw new Error(j?.error || "보내지 못했습니다."); setState("done");
    } catch (x) { setState("idle"); setErr(((x as Error).message || "보내지 못했습니다.") + " hello@dnalabs.kr 로 보내 주셔도 됩니다."); }
  }
  const inp = "w-full rounded-xl border border-[#d5dae0] bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-point";
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <div className={`fixed inset-0 z-[70] ${shown ? "" : "pointer-events-none"}`} aria-hidden={!shown}>
        <div onClick={close} className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-0"}`} />
        <div ref={panel} role="dialog" aria-modal="true" aria-label="문의하기" data-lenis-prevent className={`absolute right-0 top-0 h-full w-full max-w-[34rem] overflow-y-auto overscroll-contain bg-paper p-6 text-ink shadow-2xl transition-transform duration-500 ease-out md:p-10 ${shown ? "translate-x-0" : "translate-x-full"}`} {...(shown ? {} : { inert: true })}>
          <div className="mb-8 flex items-center justify-between"><p className="label text-ink3">문의하기</p><button type="button" onClick={close} className="label min-h-[44px] px-2 text-ink">닫기 ✕</button></div>
          {state === "done" ? (
            <div><h2 className="mb-3 text-[28px] font-extrabold">보냈습니다</h2><p className="leading-[1.7] text-ink2">영업일 기준 하루 안에 답을 드립니다. 급하시면 010-4642-3477 로 전화 주세요.</p></div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">만들고 싶은 것을<br />알려 주세요</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-semibold">성함 *<input name="name" autoComplete="name" maxLength={40} className={inp + " mt-1"} /></label>
                <label className="block text-[13px] font-semibold">회사<input name="company" autoComplete="organization" maxLength={60} className={inp + " mt-1"} /></label>
              </div>
              <label className="block text-[13px] font-semibold">연락받으실 곳 *<input name="contact" placeholder="메일 또는 전화" maxLength={120} className={inp + " mt-1"} /></label>
              <div><p className="mb-2 text-[13px] font-semibold">관심 분야</p><div className="flex flex-wrap gap-2">{WANTS.map(([k, t]) => <button key={k} type="button" aria-pressed={want === k} onClick={() => { setWant(want === k ? "" : k); play("tick"); }} className={`min-h-[44px] rounded-full border px-4 text-[14px] font-semibold transition-colors ${want === k ? "border-point bg-point text-white" : "border-[#c9d0d8] bg-white"}`}>{t}</button>)}</div></div>
              <label className="block text-[13px] font-semibold">하시는 일과 궁금한 점 *<textarea name="message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} maxLength={2000} placeholder="지금 어떻게 일하고 계신지 적어 주시면 그것부터 봅니다." className={inp + " mt-1 resize-y"} /></label>
              <label className="absolute -left-[9999px]" aria-hidden>이 칸은 비워 두세요<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <label className="flex gap-3 text-[13px] leading-[1.6] text-ink2"><input type="checkbox" name="agreed" className="mt-1 h-5 w-5 shrink-0" /><span>답변을 위해 성함 · 연락처 · 문의 내용을 받습니다. 180일 뒤 지웁니다. (<a href="/privacy.html" className="underline">개인정보 처리방침</a>)</span></label>
              {err && <p role="alert" className="text-[14px] font-semibold text-os">{err}</p>}
              <button type="submit" disabled={state === "sending"} className="min-h-[52px] w-full rounded-full bg-point text-[16px] font-bold text-white transition-colors hover:bg-point-hover disabled:opacity-60">{state === "sending" ? "보내는 중…" : "보내기"}</button>
              <p className="text-center text-[13px] text-ink3">아직 정리되지 않은 생각이어도 괜찮습니다</p>
            </form>
          )}
        </div>
      </div>
    </Ctx.Provider>
  );
}
