"use client";
import Link from "next/link";
/* 글자가 하나씩 위로 굴러 바뀌는 버튼. variant: solid(채움) | line(밑줄형) */
type P = { children: string; href?: string; onClick?: () => void; variant?: "solid" | "line"; className?: string };
export default function WordShiftButton({ children, href, onClick, variant = "line", className = "" }: P) {
  const chars = [...children];
  const layer = (clone: boolean) => (
    <span className={clone ? "absolute inset-0" : ""} aria-hidden={clone}>
      {chars.map((c, i) => (
        <span key={i} className={`inline-block whitespace-pre transition-transform duration-300 ease-out motion-reduce:transition-none ${clone ? "translate-y-full group-hover:translate-y-0" : "group-hover:-translate-y-full"}`} style={{ transitionDelay: `${i * 20}ms` }}>{c}</span>
      ))}
    </span>
  );
  const cls = `group relative inline-flex items-center gap-2 min-h-[48px] text-[15px] font-bold ${variant === "solid" ? "px-6 rounded-full bg-point text-white hover:bg-point-hover transition-colors" : "px-1"} ${className}`;
  const body = (
    <>
      <span className="relative block overflow-hidden leading-[1.4]">{layer(false)}{layer(true)}</span>
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      {variant === "line" && <span aria-hidden className="absolute left-1 right-1 bottom-2 h-px bg-current origin-left transition-transform duration-500 group-hover:scale-x-0 group-hover:origin-right" />}
    </>
  );
  if (href?.startsWith("/") && !href.includes(".") && !href.startsWith("/reservice")) return <Link href={href} className={cls}>{body}</Link>;
  if (href) return <a href={href} className={cls}>{body}</a>;
  return <button type="button" onClick={onClick} className={cls}>{body}</button>;
}
