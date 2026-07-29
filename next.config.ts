import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ふりがな生成 (kuromoji) は形態素解析辞書をファイルとして読み込む。
  // Vercel などのサーバーレス環境では自動追跡されないため、明示的に同梱する。
  outputFileTracingIncludes: {
    "/api/furigana": ["./node_modules/kuromoji/dict/**"],
  },
};

export default nextConfig;
