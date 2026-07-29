"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { hasKanji, type FuriganaSegment } from "@/lib/furigana/segments";

/**
 * 表示中の日本語テキストに対するふりがなを、まとめて取得してキャッシュする。
 *
 * - 同じ文言は 1 度しか問い合わせない
 * - 入力中に毎打鍵で送らないよう debounce する
 * - 取得できなかった場合は素のテキストを表示する (機能は止めない)
 */

const DEBOUNCE_MS = 400;
const BATCH_LIMIT = 200;

// 行をまたいで共有するキャッシュ。プロジェクトを切り替えても再利用できる。
const cache = new Map<string, FuriganaSegment[]>();

// 取得中の文言。StrictMode の二重マウントなどで同じ文言を二重に問い合わせない
// よう、フックのインスタンスではなくモジュール単位で共有する。
const pending = new Set<string>();

/** テキスト自体には現れない区切り文字。 */
const SEPARATOR = "\u0000";

export type UseFuriganaResult = {
  /** 未取得なら null を返す (呼び出し側は素のテキストを表示する)。 */
  getSegments: (text: string) => FuriganaSegment[] | null;
  isLoading: boolean;
  error: string | null;
};

export function useFurigana(texts: string[], enabled = true): UseFuriganaResult {
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 漢字を含み、まだ取得していない文言だけを対象にする。
  const missingKey = texts
    .filter((text) => text.length > 0 && hasKanji(text) && !cache.has(text))
    .join(SEPARATOR);

  const fetchMissing = useCallback(async (batch: string[]) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/furigana", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts: batch }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const body: unknown = await response.json();
      const results =
        body && typeof body === "object" && "results" in body
          ? (body as { results: Record<string, FuriganaSegment[]> }).results
          : {};

      for (const text of batch) {
        // 返ってこなかった文言も「解析不要」として記録し、再問い合わせを防ぐ。
        cache.set(text, results[text] ?? [{ text }]);
        pending.delete(text);
      }

      if (!mountedRef.current) return;
      setError(null);
      setVersion((current) => current + 1);
    } catch (cause) {
      for (const text of batch) pending.delete(text);
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "Failed to load furigana.");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || missingKey.length === 0) return;

    const timer = window.setTimeout(() => {
      const batch = missingKey
        .split(SEPARATOR)
        .filter((text) => text.length > 0 && !cache.has(text) && !pending.has(text))
        .slice(0, BATCH_LIMIT);

      if (batch.length === 0) return;
      for (const text of batch) pending.add(text);
      void fetchMissing(batch);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, fetchMissing, missingKey]);

  const getSegments = useCallback(
    (text: string): FuriganaSegment[] | null => {
      // version はキャッシュ更新時にこの関数を作り直すためだけに参照している。
      void version;
      if (!text) return null;
      if (!hasKanji(text)) return [{ text }];
      return cache.get(text) ?? null;
    },
    [version],
  );

  return { getSegments, isLoading, error };
}
