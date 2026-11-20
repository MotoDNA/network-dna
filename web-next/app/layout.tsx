import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import LenisProvider from "@/components/providers/LenisProvider";
import Header from "@/components/Header";
import Preloader from "@/components/Preloader";
import VisitPing from "@/components/VisitPing";
import { ContactPanelProvider } from "@/components/providers/ContactPanel";
import { SoundProvider } from "@/components/providers/SoundProvider";

const pretendard = localFont({ src: "./fonts/PretendardVariable.woff2", variable: "--font-pretendard", weight: "100 900", display: "swap" });
const jbmono = localFont({ src: "./fonts/JetBrainsMono.ttf", variable: "--font-jbmono", weight: "100 800", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dnalabs.kr"),
  title: "DNA Labs — 만져 보는 홈페이지를 만듭니다",
  description: "3D, 움직임, 소리까지 담은 홈페이지와 앱, 업무 프로그램을 만드는 디엔에이랩스.",
  openGraph: { title: "DNA Labs — 만져 보는 홈페이지를 만듭니다", description: "이 페이지의 모든 효과는 실제로 넣어 드릴 수 있는 기능입니다.", url: "https://dnalabs.kr/", siteName: "DNA Labs", type: "website", images: ["/og-dnalabs.png"] },
  icons: { icon: "/logo/dnalabs-mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${jbmono.variable}`}>
      <body className="bg-night text-white font-sans">
        <Preloader />
        <VisitPing />
        <LenisProvider>
          <SoundProvider>
            <ContactPanelProvider>
              <Header />
              {children}
            </ContactPanelProvider>
          </SoundProvider>
        </LenisProvider>
      </body>
    </html>
  );
}
