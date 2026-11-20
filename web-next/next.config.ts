import type { NextConfig } from "next";

// 정적 파일로 내보냅니다(out 폴더). Vercel 이 그대로 올립니다.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};
export default nextConfig;
