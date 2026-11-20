import Logo from "./Logo";
/* 첫 로딩 화면 — 로고와 네 모서리 + 표시가 나타났다가 위로 걷힙니다. 한 번 본 뒤에는(같은 창) 건너뜁니다.
   움직임은 CSS 만으로 하므로 자바스크립트가 꺼져도 1.6초 뒤 저절로 사라집니다. */
export default function Preloader() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("dna-seen"))document.documentElement.classList.add("seen");sessionStorage.setItem("dna-seen","1")}catch(e){}` }} />
      <div className="preloader" aria-hidden>
        {["left-5 top-5", "right-5 top-5", "left-5 bottom-5", "right-5 bottom-5"].map((p) => <span key={p} className={`absolute ${p} font-mono text-[20px] text-ink3`}>+</span>)}
        <Logo className="pl-logo h-8 text-white md:h-11" />
      </div>
    </>
  );
}
