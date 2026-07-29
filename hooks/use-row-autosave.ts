"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { updateTranslationRow } from "@/lib/supabase/translation-rows";
import type { AppError } from "@/types/result";
import {
  EDITABLE_FIELDS,
  type EditableDraft,
  type EditableField,
  type GlobalSaveState,
  type RowSaveState,
  type TranslationRow,
} from "@/types/translation";

/** 入力が止まってから保存するまでの待ち時間 (ms)。 */
export const AUTOSAVE_DEBOUNCE_MS = 600;

type RowEntry = {
  draft: EditableDraft;
  /** 最後にサーバーへ保存できた値。 */
  saved: EditableDraft;
  state: RowSaveState;
  error: AppError | null;
  /** 編集ごとに増える。古いレスポンスで新しい入力を上書きしないための世代番号。 */
  seq: number;
  /** 保存を開始したときの seq。 */
  savingSeq: number | null;
};

export type UseRowAutosaveResult = {
  getValue: (row: TranslationRow, field: EditableField) => string;
  getDraft: (row: TranslationRow) => EditableDraft;
  getState: (rowId: string) => RowSaveState;
  getError: (rowId: string) => AppError | null;
  setValue: (row: TranslationRow, field: EditableField, value: string) => void;
  retry: (row: TranslationRow) => void;
  flush: (row: TranslationRow) => void;
  discardRow: (rowId: string) => void;
  globalState: GlobalSaveState;
  hasUnsavedChanges: boolean;
  savingRowCount: number;
  failedRowIds: string[];
};

function toDraft(row: TranslationRow): EditableDraft {
  return { original: row.original, japanese: row.japanese, reading: row.reading };
}

function sameDraft(a: EditableDraft, b: EditableDraft): boolean {
  return EDITABLE_FIELDS.every((field) => a[field] === b[field]);
}

export function useRowAutosave(options: {
  onSaved: (rowId: string, row: TranslationRow) => void;
  debounceMs?: number;
}): UseRowAutosaveResult {
  const { onSaved, debounceMs = AUTOSAVE_DEBOUNCE_MS } = options;

  const [entries, setEntries] = useState<Record<string, RowEntry>>({});
  const entriesRef = useRef<Record<string, RowEntry>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mountedRef = useRef(true);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      // debounce タイマーを必ず解放する。
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const updateEntry = useCallback(
    (rowId: string, updater: (entry: RowEntry | undefined) => RowEntry | null) => {
      setEntries((current) => {
        const next = updater(current[rowId]);
        if (next === null) {
          if (!(rowId in current)) return current;
          const copy = { ...current };
          delete copy[rowId];
          entriesRef.current = copy;
          return copy;
        }
        const copy = { ...current, [rowId]: next };
        entriesRef.current = copy;
        return copy;
      });
    },
    [],
  );

  const save = useCallback(
    async (row: TranslationRow) => {
      const entry = entriesRef.current[row.id];
      if (!entry) return;
      if (sameDraft(entry.draft, entry.saved)) {
        updateEntry(row.id, () => null);
        return;
      }

      const seq = entry.seq;
      const payload: EditableDraft = { ...entry.draft };

      updateEntry(row.id, (current) =>
        current ? { ...current, state: "saving", savingSeq: seq, error: null } : current ?? null,
      );

      const result = await updateTranslationRow(row.id, payload);
      if (!mountedRef.current) return;

      const latest = entriesRef.current[row.id];
      // 保存中に新しい入力があった場合は、この結果を UI へ反映しない。
      const isStale = !latest || latest.seq !== seq;

      if (!result.ok) {
        updateEntry(row.id, (current) =>
          current ? { ...current, state: "error", error: result.error, savingSeq: null } : current ?? null,
        );
        return;
      }

      onSavedRef.current(row.id, result.data);

      if (isStale) {
        // 新しい入力が残っているので saved だけ更新し、dirty のままにしておく。
        updateEntry(row.id, (current) =>
          current
            ? { ...current, saved: payload, state: "unsaved", error: null, savingSeq: null }
            : current ?? null,
        );
        return;
      }

      updateEntry(row.id, () => null);
    },
    [updateEntry],
  );

  const scheduleSave = useCallback(
    (row: TranslationRow, delay: number) => {
      const existing = timersRef.current.get(row.id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        timersRef.current.delete(row.id);
        void save(row);
      }, delay);
      timersRef.current.set(row.id, timer);
    },
    [save],
  );

  const setValue = useCallback(
    (row: TranslationRow, field: EditableField, value: string) => {
      updateEntry(row.id, (current) => {
        const base: RowEntry = current ?? {
          draft: toDraft(row),
          saved: toDraft(row),
          state: "saved",
          error: null,
          seq: 0,
          savingSeq: null,
        };
        const draft: EditableDraft = { ...base.draft, [field]: value };
        return {
          ...base,
          draft,
          state: "unsaved",
          error: null,
          seq: base.seq + 1,
        };
      });

      scheduleSave(row, debounceMs);
    },
    [debounceMs, scheduleSave, updateEntry],
  );

  const retry = useCallback(
    (row: TranslationRow) => {
      const timer = timersRef.current.get(row.id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(row.id);
      }
      void save(row);
    },
    [save],
  );

  const flush = useCallback(
    (row: TranslationRow) => {
      const entry = entriesRef.current[row.id];
      if (!entry || entry.state !== "unsaved") return;
      const timer = timersRef.current.get(row.id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(row.id);
      }
      void save(row);
    },
    [save],
  );

  /** 行が削除されたときなど、下書きを破棄する。 */
  const discardRow = useCallback(
    (rowId: string) => {
      const timer = timersRef.current.get(rowId);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(rowId);
      }
      updateEntry(rowId, () => null);
    },
    [updateEntry],
  );

  const getValue = useCallback(
    (row: TranslationRow, field: EditableField) => entries[row.id]?.draft[field] ?? row[field],
    [entries],
  );

  const getDraft = useCallback(
    (row: TranslationRow) => entries[row.id]?.draft ?? toDraft(row),
    [entries],
  );

  const getState = useCallback(
    (rowId: string): RowSaveState => entries[rowId]?.state ?? "saved",
    [entries],
  );

  const getError = useCallback(
    (rowId: string): AppError | null => entries[rowId]?.error ?? null,
    [entries],
  );

  const { globalState, savingRowCount, failedRowIds, hasUnsavedChanges } = useMemo(() => {
    const values = Object.entries(entries);
    const failed = values.filter(([, entry]) => entry.state === "error").map(([rowId]) => rowId);
    const saving = values.filter(([, entry]) => entry.state === "saving").length;
    const unsaved = values.some(([, entry]) => entry.state === "unsaved");

    let state: GlobalSaveState = "saved";
    if (failed.length > 0) state = "error";
    else if (saving > 0) state = "saving";
    else if (unsaved) state = "unsaved";

    return {
      globalState: state,
      savingRowCount: saving,
      failedRowIds: failed,
      hasUnsavedChanges: unsaved || saving > 0 || failed.length > 0,
    };
  }, [entries]);

  // 未保存のまま離脱しようとしたら警告する。
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  return {
    getValue,
    getDraft,
    getState,
    getError,
    setValue,
    retry,
    flush,
    discardRow,
    globalState,
    hasUnsavedChanges,
    savingRowCount,
    failedRowIds,
  };
}
