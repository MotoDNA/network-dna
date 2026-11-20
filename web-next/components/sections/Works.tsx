"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* 만든 것 — 세로 스크롤이 가로 이동으로 바뀌는 갤러리. 휴대폰에서는 손으로 옆으로 넘깁니다. */
const W = [["액티바코리아", "웹사이트", "activa"], ["광야교회", "웹사이트", "midbar"], ["BKT", "웹사이트", "bkt"], ["린앤제이", "제작 중", "linnj"], ["종이담다", "웹사이트", "paperdamda"], ["DNA Kids Lab", "웹사이트", "kidslab"], ["MotoDNA", "앱", "motodna"], ["그로위", "앱", "growi"], ["한판만", "앱", "hanpanman"], ["댕냥사진관", "앱", "petid"], ["동행", "앱", "donghaeng"]];
export default function Works() {
  const sec = useRef<HTMLElement>(null), track = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const dist = () => track.current!.scrollWidth - innerWidth;
      gsap.to(track.current, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: sec.current, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true } });
    });
  }, { scope: sec });
  return (
    <section ref={sec} id="works" className="overflow-hidden bg-paper text-ink md:h-[100dvh]">
      <div className="flex h-full flex-col justify-center py-20 md:py-0">
        <div className="wrap mb-8 w-full md:mb-10">
          <h2 className="h-sec">Portfolio</h2>
        </div>
        <div ref={track} className="flex w-max gap-5 px-5 max-md:w-full max-md:snap-x max-md:overflow-x-auto md:gap-8 md:px-12">
          {W.map(([name, type, img], i) => (
            <figure key={img} className="group shrink-0 snap-center">
              <div className="h-[46vh] max-h-[420px] min-h-[300px] rounded-[30px] bg-gradient-to-br from-[#3a3d44] via-[#15171b] to-[#2b2e34] p-[7px] shadow-[0_24px_50px_-18px_rgba(25,31,40,.55)] transition-transform duration-500 group-hover:-translate-y-2" style={{ aspectRatio: "9/19" }}>
                {/* 교체: public/work/이름.jpg (600×1300) */}
                <img src={`/work/${img}.jpg`} alt={`${name} 화면`} loading="lazy" className="h-full w-full rounded-[24px] object-cover object-top" />
              </div>
              <figcaption className="mt-4 flex items-baseline gap-2"><span className="label text-ink3">{String(i + 1).padStart(2, "0")}</span><span className="text-[17px] font-bold">{name}</span><span className="text-[13px] text-ink3">{type}</span></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
