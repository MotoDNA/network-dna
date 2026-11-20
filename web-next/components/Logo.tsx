/* 점으로 찍은 DNA LABS 로고. 색은 글자색(currentColor)을 따라갑니다. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-2 -2 586 100" className={className} role="img" aria-label="DNA Labs" fill="currentColor">
      <circle cx="6" cy="6" r="5.2" /><circle cx="20" cy="6" r="5.2" /><circle cx="34" cy="6" r="5.2" /><circle cx="48" cy="6" r="5.2" /><circle cx="6" cy="20" r="5.2" /><circle cx="62" cy="20" r="5.2" /><circle cx="6" cy="34" r="5.2" /><circle cx="62" cy="34" r="5.2" /><circle cx="6" cy="48" r="5.2" /><circle cx="62" cy="48" r="5.2" /><circle cx="6" cy="62" r="5.2" /><circle cx="62" cy="62" r="5.2" /><circle cx="6" cy="76" r="5.2" /><circle cx="62" cy="76" r="5.2" /><circle cx="6" cy="90" r="5.2" /><circle cx="20" cy="90" r="5.2" /><circle cx="34" cy="90" r="5.2" /><circle cx="48" cy="90" r="5.2" /><circle cx="92" cy="6" r="5.2" /><circle cx="148" cy="6" r="5.2" /><circle cx="92" cy="20" r="5.2" /><circle cx="106" cy="20" r="5.2" opacity=".5"/><circle cx="148" cy="20" r="5.2" /><circle cx="92" cy="34" r="5.2" /><circle cx="120" cy="34" r="5.2" opacity=".5"/><circle cx="148" cy="34" r="5.2" /><circle cx="92" cy="48" r="5.2" /><circle cx="134" cy="48" r="5.2" opacity=".5"/><circle cx="148" cy="48" r="5.2" /><circle cx="92" cy="62" r="5.2" /><circle cx="148" cy="62" r="5.2" /><circle cx="92" cy="76" r="5.2" /><circle cx="148" cy="76" r="5.2" /><circle cx="92" cy="90" r="5.2" /><circle cx="148" cy="90" r="5.2" /><circle cx="192" cy="6" r="5.2" /><circle cx="206" cy="6" r="5.2" /><circle cx="220" cy="6" r="5.2" /><circle cx="178" cy="20" r="5.2" /><circle cx="234" cy="20" r="5.2" /><circle cx="178" cy="34" r="5.2" /><circle cx="234" cy="34" r="5.2" /><circle cx="178" cy="48" r="5.2" /><circle cx="192" cy="48" r="5.2" /><circle cx="206" cy="48" r="5.2" /><circle cx="220" cy="48" r="5.2" /><circle cx="234" cy="48" r="5.2" /><circle cx="178" cy="62" r="5.2" /><circle cx="234" cy="62" r="5.2" /><circle cx="178" cy="76" r="5.2" /><circle cx="234" cy="76" r="5.2" /><circle cx="178" cy="90" r="5.2" /><circle cx="234" cy="90" r="5.2" />
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M290,6V90H330" /><path d="M362,90L394,6L426,90M373,62H415" />
        <path d="M458,6V90H488A22,22 0 0 0 488,46H458M484,46A20,20 0 0 0 484,6H458" />
        <path d="M574,24C569,2 531,2 532,27C533,50 575,44 577,68C579,94 535,96 529,72" />
      </g>
    </svg>
  );
}
