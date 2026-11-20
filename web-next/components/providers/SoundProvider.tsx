"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
/* 소리 — 기본은 꺼짐. 녹음 파일 없이 브라우저가 직접 소리를 만듭니다(Web Audio). */
type Kind = "tick" | "woosh" | "note";
const Ctx = createContext<{ on: boolean; toggle: () => void; play: (k: Kind, freq?: number) => void }>({ on: false, toggle() {}, play() {} });
export const useSound = () => useContext(Ctx);
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const ac = useRef<AudioContext | null>(null);
  useEffect(() => { try { setOn(localStorage.getItem("dna-sound") === "1"); } catch {} }, []);
  useEffect(() => { const f = () => { if (document.hidden) ac.current?.suspend(); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
  const ctx = () => { if (!ac.current) { const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ac.current = new A(); } if (ac.current.state !== "running") ac.current.resume(); return ac.current; };
  const play = useCallback((k: Kind, freq = 440, force = false) => {
    if (!on && !force) return;
    try {
      const a = ctx(), t = a.currentTime, g = a.createGain(); g.connect(a.destination);
      const o = a.createOscillator(); o.connect(g);
      if (k === "tick") { o.type = "square"; o.frequency.value = 1400; g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); o.start(t); o.stop(t + 0.05); }
      if (k === "note") { o.type = "triangle"; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.start(t); o.stop(t + 1); }
      if (k === "woosh") { o.type = "sine"; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(720, t + 0.25); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.start(t); o.stop(t + 0.32); }
    } catch {}
  }, [on]);
  const toggle = () => setOn((v) => { const n = !v; try { localStorage.setItem("dna-sound", n ? "1" : "0"); } catch {} if (n) setTimeout(() => (play as (k: Kind, f?: number, force?: boolean) => void)("note", 523, true), 0); return n; });
  return <Ctx.Provider value={{ on, toggle, play }}>{children}</Ctx.Provider>;
}
