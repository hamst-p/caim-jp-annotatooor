"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createTranslationRow,
  createTranslationRows,
  deleteTranslationRow,
  diffPositions,
  duplicateTranslationRow,
  getMaxPosition,
  getTranslationRows,
  normalizePositions,
  updateRowPositions,
} from "@/lib/supabase/translation-rows";
import { formatAppError, type AppError } from "@/types/result";
import type {
  LoadState,
  TranslationRow,
  TranslationRowInsert,
} from "@/types/translation";

export type UseTranslationRowsResult = {
  rows: TranslationRow[];
  status: LoadState;
  error: AppError | null;
  /** 削除中・移動中などで編集を止めたい行 ID。 */
  lockedRowIds: ReadonlySet<string>;
  isMutating: boolean;
  refresh: () => Promise<void>;
  patchRow: (rowId: string, patch: Partial<TranslationRow>) => void;
  addPhrase: () => Promise<TranslationRow | null>;
  addRowBelow: (row: TranslationRow) => Promise<TranslationRow | null>;
  duplicateRow: (row: TranslationRow) => Promise<TranslationRow | null>;
  removeRow: (row: TranslationRow) => Promise<boolean>;
  moveRow: (rowId: string, direction: "up" | "down") => Promise<boolean>;
  bulkInsertRows: (
    entries: Omit<TranslationRowInsert, "project_id" | "position">[],
  ) => Promise<TranslationRow[] | null>;
};

export function useTranslationRows(
  projectId: string | null,
  enabled: boolean,
): UseTranslationRowsResult {
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<AppError | null>(null);
  const [lockedRowIds, setLockedRowIds] = useState<Set<string>>(new Set());
  const [isMutating, setIsMutating] = useState(false);

  const mountedRef = useRef(true);
  const rowsRef = useRef<TranslationRow[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const lockRow = useCallback((rowId: string, locked: boolean) => {
    setLockedRowIds((current) => {
      const next = new Set(current);
      if (locked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!enabled || !projectId) {
        setRows([]);
        setStatus("idle");
        return;
      }

      const requestId = ++requestIdRef.current;
      setStatus(mode === "initial" ? "loading" : "refreshing");
      setError(null);

      const result = await getTranslationRows(projectId);
      // 古いリクエストの結果で新しい状態を上書きしない。
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }

      setRows(result.data);
      setStatus("loaded");
    },
    [enabled, projectId],
  );

  useEffect(() => {
    // マウント時のデータ取得。set-state-in-effect は「setState を含む関数の呼び出し」を
    // 一律に警告するが、ここは外部システム (Supabase) から取得した結果を state へ
    // 反映するための意図的な副作用。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("initial");
  }, [load]);

  const refresh = useCallback(async () => {
    await load("refresh");
  }, [load]);

  const patchRow = useCallback((rowId: string, patch: Partial<TranslationRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }, []);

  /** 並び順を 0..n-1 へ振り直して保存する。失敗したら元へ戻す。 */
  const persistOrder = useCallback(
    async (nextRows: TranslationRow[], previousRows: TranslationRow[]) => {
      const normalized = normalizePositions(nextRows);
      const changes = diffPositions(previousRows, normalized);

      setRows(normalized);
      if (changes.length === 0) return true;

      const result = await updateRowPositions(changes);
      if (!mountedRef.current) return result.ok;

      if (!result.ok) {
        setRows(previousRows);
        toast.error(formatAppError(result.error));
        return false;
      }
      return true;
    },
    [],
  );

  const insertAt = useCallback(
    async (created: TranslationRow, targetIndex: number) => {
      const previous = rowsRef.current;
      const next = [...previous];
      const clampedIndex = Math.max(0, Math.min(targetIndex, next.length));
      next.splice(clampedIndex, 0, created);
      await persistOrder(next, [...previous, created]);
    },
    [persistOrder],
  );

  const createAtEnd = useCallback(
    async (
      values: Omit<TranslationRowInsert, "project_id" | "position">,
    ): Promise<TranslationRow | null> => {
      if (!projectId) {
        toast.error("Select a project first.");
        return null;
      }

      setIsMutating(true);
      const maxPosition = await getMaxPosition(projectId);
      if (!mountedRef.current) return null;

      if (!maxPosition.ok) {
        setIsMutating(false);
        toast.error(formatAppError(maxPosition.error));
        return null;
      }

      const result = await createTranslationRow({
        project_id: projectId,
        original: values.original ?? "",
        japanese: values.japanese ?? "",
        reading: values.reading ?? "",
        position: maxPosition.data + 1,
      });
      if (!mountedRef.current) return null;
      setIsMutating(false);

      if (!result.ok) {
        toast.error(formatAppError(result.error));
        return null;
      }
      return result.data;
    },
    [projectId],
  );

  const addPhrase = useCallback(async () => {
    const created = await createAtEnd({});
    if (!created) return null;
    setRows((current) => [...current, created]);
    toast.success("Phrase added");
    return created;
  }, [createAtEnd]);

  const addRowBelow = useCallback(
    async (row: TranslationRow) => {
      const created = await createAtEnd({});
      if (!created) return null;
      const index = rowsRef.current.findIndex((item) => item.id === row.id);
      await insertAt(created, index >= 0 ? index + 1 : rowsRef.current.length);
      toast.success("Phrase added below");
      return created;
    },
    [createAtEnd, insertAt],
  );

  const duplicateRow = useCallback(
    async (row: TranslationRow) => {
      if (!projectId) return null;

      setIsMutating(true);
      const maxPosition = await getMaxPosition(projectId);
      if (!mountedRef.current) return null;
      if (!maxPosition.ok) {
        setIsMutating(false);
        toast.error(formatAppError(maxPosition.error));
        return null;
      }

      // 音声はコピーしない (テキスト 3 列のみ複製)。
      const result = await duplicateTranslationRow(row, maxPosition.data + 1);
      if (!mountedRef.current) return null;
      setIsMutating(false);

      if (!result.ok) {
        toast.error(formatAppError(result.error));
        return null;
      }

      const index = rowsRef.current.findIndex((item) => item.id === row.id);
      await insertAt(result.data, index >= 0 ? index + 1 : rowsRef.current.length);
      toast.success("Phrase duplicated (audio was not copied)");
      return result.data;
    },
    [insertAt, projectId],
  );

  const removeRow = useCallback(
    async (row: TranslationRow) => {
      lockRow(row.id, true);
      setIsMutating(true);

      const result = await deleteTranslationRow(row);
      if (!mountedRef.current) return result.ok;

      setIsMutating(false);
      lockRow(row.id, false);

      if (!result.ok) {
        toast.error(formatAppError(result.error));
        return false;
      }

      const remaining = rowsRef.current.filter((item) => item.id !== row.id);
      await persistOrder(remaining, rowsRef.current);
      toast.success("Phrase deleted");
      return true;
    },
    [lockRow, persistOrder],
  );

  const moveRow = useCallback(
    async (rowId: string, direction: "up" | "down") => {
      const previous = rowsRef.current;
      const index = previous.findIndex((row) => row.id === rowId);
      if (index < 0) return false;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= previous.length) return false;

      const next = [...previous];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return persistOrder(next, previous);
    },
    [persistOrder],
  );

  const bulkInsertRows = useCallback(
    async (entries: Omit<TranslationRowInsert, "project_id" | "position">[]) => {
      if (!projectId) {
        toast.error("Select a project first.");
        return null;
      }
      if (entries.length === 0) return [];

      setIsMutating(true);
      const maxPosition = await getMaxPosition(projectId);
      if (!mountedRef.current) return null;
      if (!maxPosition.ok) {
        setIsMutating(false);
        toast.error(formatAppError(maxPosition.error));
        return null;
      }

      const payload: TranslationRowInsert[] = entries.map((entry, index) => ({
        project_id: projectId,
        original: entry.original ?? "",
        japanese: entry.japanese ?? "",
        reading: entry.reading ?? "",
        position: maxPosition.data + 1 + index,
      }));

      const result = await createTranslationRows(payload);
      if (!mountedRef.current) return null;
      setIsMutating(false);

      if (!result.ok) {
        toast.error(formatAppError(result.error));
        return null;
      }

      const inserted = [...result.data].sort((a, b) => a.position - b.position);
      setRows((current) => [...current, ...inserted]);
      toast.success(`Imported ${inserted.length} phrase(s)`);
      return inserted;
    },
    [projectId],
  );

  return {
    rows,
    status,
    error,
    lockedRowIds,
    isMutating,
    refresh,
    patchRow,
    addPhrase,
    addRowBelow,
    duplicateRow,
    removeRow,
    moveRow,
    bulkInsertRows,
  };
}
