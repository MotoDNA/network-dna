"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { registerCanvas } from "@/lib/canvasManager";

/* ── 조절값 ── */
const TURNS = 2.6, HEIGHT = 8.4, RADIUS = 1.25, RUNGS = 22;
const APP_COLORS = [0x3182f6, 0x8fb8ff, 0x3182f6, 0xe8eef8]; // 염기쌍 색 (파랑 계열)
const HOLD_SECONDS = 0.9;       // 이만큼 누르고 있으면 완전히 풀립니다
const SCROLL_TURNS = 1.6;       // 첫 화면 구간을 다 내리는 동안 도는 바퀴 수
const SCROLL_UNZIP_FROM = 0.5;  // 이 지점부터 풀리기 시작해 끝에서 완전히 풀립니다

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private phase: number) { super(); }
  getPoint(t: number, v = new THREE.Vector3()) {
    const a = t * TURNS * Math.PI * 2 + this.phase;
    return v.set(Math.cos(a) * RADIUS, (t - 0.5) * HEIGHT, Math.sin(a) * RADIUS);
  }
}

/** progress: 히어로 구간 스크롤 진행률(0~1)을 돌려주는 함수 */
export default function DnaHelixHero({ progress }: { progress: () => number }) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = wrap.current!;
    const mobile = innerWidth < 768;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: "high-performance" }); }
    catch { host.dataset.fallback = "1"; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.55;

    // 가닥 재질: 금속 유리
    const strandMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe6f2, metalness: 1, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 3, ...(mobile ? {} : { transmission: 0.35, ior: 2.4, thickness: 0.6 }) });
    const root = new THREE.Group(); scene.add(root);
    const sides = [new THREE.Group(), new THREE.Group()]; sides.forEach((g) => root.add(g));
    const geos: THREE.BufferGeometry[] = [];
    [0, Math.PI].forEach((ph, s) => {
      const g = new THREE.TubeGeometry(new Helix(ph), mobile ? 160 : 320, 0.17, mobile ? 10 : 18, false); geos.push(g);
      sides[s].add(new THREE.Mesh(g, strandMat));
    });
    // 염기쌍: 반쪽씩 양쪽 가닥에 붙고, 4가지 앱 색이 되풀이됩니다
    const rungGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 12); rungGeo.rotateZ(Math.PI / 2); geos.push(rungGeo);
    const rungMats = APP_COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.25, clearcoat: 1 }));
    type Half = { m: THREE.Mesh; base: THREE.Vector3; drift: THREE.Vector3; spin: number };
    const halves: Half[] = [];
    for (let i = 0; i < RUNGS; i++) {
      const t = (i + 0.5) / RUNGS, a = t * TURNS * Math.PI * 2, y = (t - 0.5) * HEIGHT;
      [1, -1].forEach((dir, s) => {
        const m = new THREE.Mesh(rungGeo, rungMats[i % 4]);
        m.scale.x = RADIUS - 0.14; m.rotation.y = -a;
        const base = new THREE.Vector3(Math.cos(a) * RADIUS * 0.5 * dir, y, Math.sin(a) * RADIUS * 0.5 * dir);
        m.position.copy(base); sides[s].add(m);
        halves.push({ m, base, drift: new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.6), spin: (Math.random() - 0.5) * 3 });
      });
    }
    // 조명: 파랑 2 + 따뜻한 빛 1
    const l1 = new THREE.PointLight(0x3182f6, 90, 30), l2 = new THREE.PointLight(0x5aa0ff, 60, 30), l3 = new THREE.PointLight(0xffb070, 55, 30);
    l1.position.set(-5, 3, 4); l2.position.set(5, -3, 3); l3.position.set(2, 5, -4); scene.add(l1, l2, l3);
    // 배경 입자 (데스크톱만)
    let dust: THREE.Points | null = null;
    if (!mobile) {
      const n = 600, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 26; p[i * 3 + 1] = (Math.random() - 0.5) * 16; p[i * 3 + 2] = -Math.random() * 14 - 1; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); geos.push(g);
      dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8fb8ff, size: 0.035, transparent: true, opacity: 0.55 })); scene.add(dust);
    }

    const size = () => {
      const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.position.set(0, 0, w < 768 ? 27 : 15.5); camera.updateProjectionMatrix();
      root.position.x = w < 768 ? 0 : 3.1; root.position.y = w < 768 ? 3.4 : 0; root.rotation.z = w < 768 ? -0.28 : -0.42;
    };
    size(); const ro = new ResizeObserver(size); ro.observe(host);

    // 마우스: 시차 기울기 · 끌어 돌리기 · 길게 눌러 풀기
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0, y: 0 }; let dragging = false, lastX = 0, vel = 0, spin = 0, hold = 0, holding = false, unzip = 0;
    const move = (e: PointerEvent) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1;
      if (dragging) { vel = (e.clientX - lastX) * 0.012; spin += vel; lastX = e.clientX; if (Math.abs(vel) > 0.03) holding = false; }
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a,button")) return; // 버튼·링크 위에서는 시작하지 않음
      holding = true; if (e.pointerType === "mouse") { dragging = true; lastX = e.clientX; }
    };
    const up = () => { dragging = false; holding = false; };
    const sec = host.parentElement!;
    addEventListener("pointermove", move, { passive: true }); sec.addEventListener("pointerdown", down); addEventListener("pointerup", up); addEventListener("pointercancel", up);

    let tiltX = 0, tiltY = 0, auto = 0;
    const off = registerCanvas(host, (_t, dt) => {
      dt = Math.min(dt, 0.05);
      const p = progress();
      hold = THREE.MathUtils.clamp(hold + (holding ? dt / HOLD_SECONDS : -dt * 1.6), 0, 1);
      const target = reduce ? 0 : Math.max(hold * hold * (3 - 2 * hold), THREE.MathUtils.clamp((p - SCROLL_UNZIP_FROM) / (0.98 - SCROLL_UNZIP_FROM), 0, 1));
      unzip += (target - unzip) * 0.1;
      if (!dragging) { spin += vel; vel *= 0.94; }
      auto += ((reduce ? 0 : p * SCROLL_TURNS * Math.PI * 2) - auto) * 0.12; // 저절로 돌지 않고 스크롤만큼 돕니다
      tiltX += (mouse.y * 0.3 - tiltX) * 0.06; tiltY += (mouse.x * 0.3 - tiltY) * 0.06;
      root.rotation.y = auto + spin + tiltY; root.rotation.x = tiltX * 0.6;
      const shake = holding && hold < 1 ? Math.sin(performance.now() * 0.09) * 0.02 * hold : 0;
      sides.forEach((g, s) => { const d = s ? -1 : 1; g.position.x = d * unzip * 1.9 + shake * d; g.rotation.y = d * unzip * 1.1; g.position.z = d * unzip * 0.5; });
      halves.forEach((h) => { h.m.position.copy(h.base).addScaledVector(h.drift, unzip); h.m.rotation.z = h.spin * unzip; });
      if (dust) dust.rotation.y += dt * 0.012;
      renderer.render(scene, camera);
    });
    return () => {
      off(); ro.disconnect(); removeEventListener("pointermove", move); sec.removeEventListener("pointerdown", down); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      geos.forEach((g) => g.dispose()); strandMat.dispose(); rungMats.forEach((m) => m.dispose()); env.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [progress]);
  return <div ref={wrap} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />;
}
