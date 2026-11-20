"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
/* 긴 문장이 스크롤에 따라 앞 단어부터 차례로 진해집니다. */
export default function FadeOnScroll({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(ref.current!.querySelectorAll("span"), { opacity: 0.15, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0px)", stagger: 0.1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top 80%", end: "bottom 45%", scrub: true } });
    });
  }, { scope: ref });
  return <p ref={ref} className={className} aria-label={text}>{text.split(" ").map((w, i) => <span key={i} aria-hidden className="inline-block mr-[0.28em]">{w}</span>)}</p>;
}
