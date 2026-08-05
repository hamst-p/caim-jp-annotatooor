"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { updateTranslationRow } from "@/lib/supabase/translation-rows";
import { applyHighlight, normalizeHighlights } from "@/lib/utils/reading-highlight";
import { formatAppError } from "@/types/result";
import type { HighlightColorId, ReadingHighlight, TranslationRow } from "@/types/translation";

/**
 * Reading 列の色分けを保存する。
 *
 * 色を選んだ瞬間に反映させたいので、まず楽観的に画面へ出してから保存し、
 * 失敗したら元の値へ戻す。テキストの自動保存とは別系統 (debounce しない)。
 */
export function useReadingHighlights({
  row,
  onUpdated,
}: {
  row: TranslationRow;
  onUpdated: (rowId: string, next: TranslationRow) => void;
}) {
  const [optimistic, setOptimistic] = useState<ReadingHighlight[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const seqRef = useRef(0);

  // 列が未追加の DB でも落ちないよう、常に配列へ正規化する。
  const highlights = normalizeHighlights(
    optimistic ?? row.reading_highlights,
    row.reading.length,
  );

  const save = useCallback(
    async (next: ReadingHighlight[]) => {
      const seq = ++seqRef.current;
      setOptimistic(next);
      setIsSaving(true);

      const result = await updateTranslationRow(row.id, { reading_highlights: next });

      // 保存中に次の操作が来ていたら、この結果は捨てる。
      if (seq !== seqRef.current) return;
      setIsSaving(false);

      if (!result.ok) {
        setOptimistic(null);
        const missingColumn = result.error.detail?.includes("reading_highlights");
        toast.error(
          missingColumn
            ? "Run the reading_highlights migration in supabase/schema.sql first."
            : formatAppError(result.error),
        );
        return;
      }

      setOptimistic(null);
      onUpdated(row.id, result.data);
    },
    [onUpdated, row.id],
  );

  /** 選択範囲へ色を付ける。color が null なら消す。 */
  const applyColor = useCallback(
    (start: number, end: number, color: HighlightColorId | null) => {
      void save(applyHighlight(highlights, start, end, color, row.reading.length));
    },
    [highlights, row.reading.length, save],
  );

  const clearAll = useCallback(() => {
    if (highlights.length === 0) return;
    void save([]);
  }, [highlights.length, save]);

  return { highlights, applyColor, clearAll, isSaving };
}
