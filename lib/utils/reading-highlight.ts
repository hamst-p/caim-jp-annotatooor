import type { HighlightColorId, ReadingHighlight } from "@/types/translation";

/**
 * Reading 列の色分け。
 * 読み上げの区切り (息継ぎ・意味のまとまり) を目で追えるようにするための機能で、
 * 文字位置の範囲と色 ID を translation_rows.reading_highlights に保存する。
 */

export type HighlightColor = {
  id: HighlightColorId;
  label: string;
  /** パレットの見本に使う色。 */
  swatch: string;
  /** 本文に敷く背景色。長時間見ても疲れないよう彩度を抑えている。 */
  background: string;
};

/**
 * 5 色。彩度と明度を揃えてあるので、どれを隣り合わせても
 * 一方だけが目立つことがない。ダークモードでは不透明度を下げて発光を抑える。
 */
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  {
    id: "amber",
    label: "Amber",
    swatch: "bg-amber-300 dark:bg-amber-400/70",
    background: "bg-amber-200/60 dark:bg-amber-300/30",
  },
  {
    id: "green",
    label: "Green",
    swatch: "bg-emerald-300 dark:bg-emerald-400/70",
    background: "bg-emerald-200/60 dark:bg-emerald-300/30",
  },
  {
    id: "blue",
    label: "Blue",
    swatch: "bg-sky-300 dark:bg-sky-400/70",
    background: "bg-sky-200/60 dark:bg-sky-300/30",
  },
  {
    id: "purple",
    label: "Purple",
    swatch: "bg-violet-300 dark:bg-violet-400/70",
    background: "bg-violet-200/60 dark:bg-violet-300/30",
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "bg-rose-300 dark:bg-rose-400/70",
    background: "bg-rose-200/60 dark:bg-rose-300/30",
  },
] as const;

const COLOR_BY_ID = new Map(HIGHLIGHT_COLORS.map((color) => [color.id, color]));

export function getHighlightColor(id: HighlightColorId): HighlightColor | undefined {
  return COLOR_BY_ID.get(id);
}

/** 保存値を信用せず、テキスト長に合わせて正規化する。 */
export function normalizeHighlights(
  highlights: ReadingHighlight[] | null | undefined,
  textLength: number,
): ReadingHighlight[] {
  if (!highlights || highlights.length === 0) return [];

  const cleaned = highlights
    .filter((highlight) => COLOR_BY_ID.has(highlight.color))
    .map((highlight) => ({
      start: Math.max(0, Math.min(highlight.start, textLength)),
      end: Math.max(0, Math.min(highlight.end, textLength)),
      color: highlight.color,
    }))
    .filter((highlight) => highlight.end > highlight.start)
    .sort((a, b) => a.start - b.start);

  // 同じ色が隣接／重複していたら 1 つにまとめる。
  const merged: ReadingHighlight[] = [];
  for (const highlight of cleaned) {
    const previous = merged[merged.length - 1];
    if (previous && previous.color === highlight.color && highlight.start <= previous.end) {
      previous.end = Math.max(previous.end, highlight.end);
      continue;
    }
    merged.push({ ...highlight });
  }
  return merged;
}

/**
 * [start, end) に色を適用する。color が null なら範囲の色を消す。
 * 既存の範囲と重なる部分は削り、必要なら前後へ分割する。
 */
export function applyHighlight(
  highlights: ReadingHighlight[],
  start: number,
  end: number,
  color: HighlightColorId | null,
  textLength: number,
): ReadingHighlight[] {
  if (end <= start) return normalizeHighlights(highlights, textLength);

  const next: ReadingHighlight[] = [];

  for (const highlight of highlights) {
    // 重なりなし
    if (highlight.end <= start || highlight.start >= end) {
      next.push({ ...highlight });
      continue;
    }
    // 前側の残り
    if (highlight.start < start) {
      next.push({ start: highlight.start, end: start, color: highlight.color });
    }
    // 後ろ側の残り
    if (highlight.end > end) {
      next.push({ start: end, end: highlight.end, color: highlight.color });
    }
  }

  if (color) next.push({ start, end, color });

  return normalizeHighlights(next, textLength);
}

export type ReadingSpan = {
  text: string;
  /** 色が付いていない区間は null。 */
  color: HighlightColorId | null;
  /** テキスト全体における開始位置。DOM から選択範囲を逆算するのに使う。 */
  offset: number;
};

/** テキストを、色の付いた区間と付いていない区間へ切り分ける。 */
export function buildReadingSpans(
  text: string,
  highlights: ReadingHighlight[],
): ReadingSpan[] {
  const normalized = normalizeHighlights(highlights, text.length);
  if (text.length === 0) return [];
  if (normalized.length === 0) return [{ text, color: null, offset: 0 }];

  const spans: ReadingSpan[] = [];
  let cursor = 0;

  for (const highlight of normalized) {
    if (highlight.start > cursor) {
      spans.push({
        text: text.slice(cursor, highlight.start),
        color: null,
        offset: cursor,
      });
    }
    spans.push({
      text: text.slice(highlight.start, highlight.end),
      color: highlight.color,
      offset: highlight.start,
    });
    cursor = highlight.end;
  }

  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), color: null, offset: cursor });
  }

  return spans;
}
