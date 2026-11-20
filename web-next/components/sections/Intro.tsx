import FadeOnScroll from "@/components/motion/FadeOnScroll";
import InfiniteMarquee from "@/components/motion/InfiniteMarquee";
const APPS = [{ text: "Design" }, { text: "Motion", color: "#3182F6" }, { text: "3D" }, { text: "Sound", color: "#3182F6" }];
export default function Intro() {
  return (
    <section id="features" className="bg-night pb-24 pt-28 md:pb-36 md:pt-44">
      <div className="wrap"><FadeOnScroll className="h-sec max-w-[19em] md:pl-[8.33%]" text="홈페이지는 회사의 첫인상입니다. 글자가 나타나는 속도, 버튼이 반응하는 느낌, 스크롤을 따라 움직이는 화면까지 하나하나 직접 만듭니다." /></div>
      <InfiniteMarquee items={APPS} className="mt-24 text-[clamp(44px,8vw,124px)] font-extrabold leading-none tracking-[-0.04em] md:mt-36" />
    </section>
  );
}
