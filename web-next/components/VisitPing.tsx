"use client";
import { useEffect } from "react";
/* 방문 세기 — 기존 site.js 와 같은 곳으로 같은 값을 보냅니다(날짜 × 경로 횟수만, 개인정보 없음). 실패해도 조용히 넘어갑니다. */
const FN = "https://izrtclsqhsgkuwsffifn.supabase.co/functions/v1/site";
const KEY = "sb_publishable_G5wx-YdgwUU630x1vKmZmQ_15BgxvEX";
export default function VisitPing() {
  useEffect(() => {
    try {
      const path = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "") || "/";
      fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY }, body: JSON.stringify({ action: "hit", path }) }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
