"use client";
import { useEffect, useRef } from "react";
import { registerCanvas } from "@/lib/canvasManager";
import { useSound } from "@/components/providers/SoundProvider";
/* 가로선 LINES 개로 그린 워드마크. 올리면 선이 출렁이고(7), 누르면 더 크게(11), 소리가 켜져 있으면 음이 납니다. */
const LINES = 34, W = 1200, H = 260, NOTES = [196, 220, 247, 294, 330, 392, 440, 494];
export default function LineWordmark({ text = "DNA LABS" }: { text?: string }) {
  const svg = useRef<SVGSVGElement>(null); const { play } = useSound(); const playRef = useRef(play); playRef.current = play;
  useEffect(() => {
    const el = svg.current!, paths = [...el.querySelectorAll<SVGPathElement>("[data-l]")];
    const amp = new Float32Array(LINES), ph = new Float32Array(LINES); let lastHit = -1;
    const y = (i: number) => 8 + (i * (H - 16)) / (LINES - 1);
    const hit = (e: PointerEvent, power: number) => {
      const r = el.getBoundingClientRect(), i = Math.round((((e.clientY - r.top) / r.height) * H - 8) / ((H - 16) / (LINES - 1)));
      if (i < 0 || i >= LINES) return;
      for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < LINES) amp[j] = Math.max(amp[j], power * (1 - Math.abs(k) * 0.3)); }
      if (i !== lastHit || power > 8) { playRef.current("note", NOTES[i % NOTES.length]); lastHit = i; }
    };
    const move = (e: PointerEvent) => hit(e, 7), down = (e: PointerEvent) => hit(e, 11);
    el.addEventListener("pointermove", move); el.addEventListener("pointerdown", down);
    const off = registerCanvas(el, (_t, dt) => {
      for (let i = 0; i < LINES; i++) {
        if (amp[i] < 0.05) { if (amp[i] !== 0) { amp[i] = 0; paths[i].setAttribute("d", `M0,${y(i)}H${W}`); } continue; } // 가만한 선은 건너뜁니다
        ph[i] += dt * 14; amp[i] *= Math.pow(0.12, dt);
        const a = Math.sin(ph[i]) * amp[i], yy = y(i);
        paths[i].setAttribute("d", `M0,${yy}Q${W * 0.25},${yy + a} ${W * 0.5},${yy}T${W},${yy}`);
      }
    });
    return () => { off(); el.removeEventListener("pointermove", move); el.removeEventListener("pointerdown", down); };
  }, []);
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair touch-pan-y select-none" role="img" aria-label={text}>
      <defs><clipPath id="lw-clip"><text x={16} y={H - 28} textLength={W - 32} lengthAdjust="spacingAndGlyphs" fontSize="250" fontWeight="900" style={{ fontFamily: "var(--font-pretendard), sans-serif" }}>{text}</text></clipPath></defs>
      <rect width={W} height={H} fill="transparent" />
      <g clipPath="url(#lw-clip)" stroke="currentColor" strokeWidth="3.4" fill="none">{Array.from({ length: LINES }).map((_, i) => <path key={i} data-l d={`M0,${8 + (i * (H - 16)) / (LINES - 1)}H${W}`} />)}</g>
    </svg>
  );
}
