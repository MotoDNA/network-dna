import ScatterText from "@/components/motion/ScatterText";
import RollingCounter from "@/components/motion/RollingCounter";
const PTS = [
  ["01", "현장에서 시작합니다", "화상 회의로 끝내지 않습니다. 현장에 몇 시간씩 머물며 실제 업무가 어떻게 흘러가는지 직접 봅니다."],
  ["02", "목적부터 정확히 묻습니다", "운영하며 겪는 고충, 풀고 싶은 문제, 이 서비스를 정말 어디에 쓰려는지. 이것을 파악한 뒤에야 첫 시안을 만듭니다."],
  ["03", "시작은 신중하게, 제작은 빠르게", "착수에는 시간을 씁니다. 대신 자료가 모이면 그다음은 빠릅니다."],
];
export default function Attitude() {
  return (
    <section id="attitude" className="overflow-hidden bg-paper py-20 text-ink md:py-28">
      <div className="wrap">
        <ScatterText className="h-hero" lines={["기술보다 먼저,", "알맹이를 봅니다."]} />
        <p className="mt-8 max-w-[34em] text-[16px] leading-[1.75] text-ink2 md:text-[18px]">기술이 좋고 디자인이 뛰어나도 그 회사의 핵심을 모르면 껍데기에 그칩니다. 그래서 만들기 전에 먼저 듣고, 직접 봅니다.</p>
        <ol className="mt-16 grid border-t-2 border-ink md:mt-24 md:grid-cols-3">
          {PTS.map(([n, t, d]) => (
            <li key={n} className="border-b border-[#d5dae0] py-7 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0">
              <span className="label text-ink3">{n}</span><h3 className="mb-3 mt-4 text-[22px] font-bold leading-tight md:mt-10">{t}</h3><p className="text-[15px] leading-[1.7] text-ink2">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-2">
          <div><p className="label mb-3 text-ink3">자료 수집 후 첫 시안까지</p><p className="text-[clamp(64px,10vw,150px)] font-extrabold tracking-[-0.04em] text-point"><RollingCounter value="3~4" /><span className="ml-2 text-[0.3em] text-ink">일</span></p></div>
          <div><p className="label mb-3 text-ink3">완성까지 빠르면</p><p className="text-[clamp(64px,10vw,150px)] font-extrabold tracking-[-0.04em] text-point"><RollingCounter value="2" /><span className="ml-2 text-[0.3em] text-ink">일</span></p></div>
        </div>
        <p className="mt-16 text-[clamp(20px,2.6vw,34px)] font-bold tracking-[-0.02em]">그래서 처음 의도가 결과물에 그대로 담깁니다.</p>
      </div>
    </section>
  );
}
