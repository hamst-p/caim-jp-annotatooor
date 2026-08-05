import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeHighlights } from "@/lib/utils/reading-highlight";
import { deleteAudioFiles } from "@/lib/supabase/storage";
import {
  validateTranslationRowInsert,
  validateTranslationRowUpdate,
} from "@/lib/validators/translation-row";
import type { Database } from "@/types/database";
import { fail, ok, toAppError, type Result } from "@/types/result";
import type {
  ReadingHighlight,
  RowPosition,
  TranslationRow,
  TranslationRowInsert,
  TranslationRowUpdate,
} from "@/types/translation";

type DbTranslationRow = Database["public"]["Tables"]["translation_rows"]["Row"];

/**
 * jsonb の中身は DB 側では保証されないので、アプリへ渡す前に検証する。
 * reading_highlights 列がまだ無い DB でも空配列として扱えるようにしている。
 */
function toTranslationRow(row: DbTranslationRow): TranslationRow {
  const raw: unknown = row.reading_highlights;
  const candidates: ReadingHighlight[] = Array.isArray(raw)
    ? (raw.filter(
        (item): item is ReadingHighlight =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ReadingHighlight).start === "number" &&
          typeof (item as ReadingHighlight).end === "number" &&
          typeof (item as ReadingHighlight).color === "string",
      ) as ReadingHighlight[])
    : [];

  return {
    ...row,
    reading_highlights: normalizeHighlights(candidates, row.reading.length),
  };
}

/** 選択中プロジェクトの行を position 昇順で取得する。 */
export async function getTranslationRows(
  projectId: string,
): Promise<Result<TranslationRow[]>> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("translation_rows")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return fail("database", "Failed to load phrases", error.message, error);
    }
    return ok((data ?? []).map(toTranslationRow));
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to load phrases", cause) };
  }
}

/** 現在の最大 position を返す。行が無ければ -1。 */
export async function getMaxPosition(projectId: string): Promise<Result<number>> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("translation_rows")
      .select("position")
      .eq("project_id", projectId)
      .order("position", { ascending: false })
      .limit(1);

    if (error) {
      return fail("database", "Failed to read the current order", error.message, error);
    }
    const max = data && data.length > 0 ? data[0].position : -1;
    return ok(max);
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to read the current order", cause) };
  }
}

export async function createTranslationRow(
  input: TranslationRowInsert,
): Promise<Result<TranslationRow>> {
  const validated = validateTranslationRowInsert(input);
  if (!validated.ok) return validated;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("translation_rows")
      .insert(validated.data)
      .select()
      .single();

    if (error) {
      return fail("database", "Failed to add the phrase", error.message, error);
    }
    return ok(toTranslationRow(data));
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to add the phrase", cause) };
  }
}

/** Bulk Import 用の一括 insert。 */
export async function createTranslationRows(
  inputs: TranslationRowInsert[],
): Promise<Result<TranslationRow[]>> {
  if (inputs.length === 0) return ok([]);

  for (const input of inputs) {
    const validated = validateTranslationRowInsert(input);
    if (!validated.ok) return validated;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("translation_rows")
      .insert(inputs)
      .select();

    if (error) {
      return fail("database", "Bulk import failed", error.message, error);
    }
    return ok((data ?? []).map(toTranslationRow));
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Bulk import failed", cause) };
  }
}

export async function updateTranslationRow(
  rowId: string,
  input: TranslationRowUpdate,
): Promise<Result<TranslationRow>> {
  const validated = validateTranslationRowUpdate(input);
  if (!validated.ok) return validated;

  if (Object.keys(validated.data).length === 0) {
    return fail("validation", "There is nothing to save.");
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("translation_rows")
      .update(validated.data)
      .eq("id", rowId)
      .select()
      .single();

    if (error) {
      return fail("database", "Failed to save changes", error.message, error);
    }
    return ok(toTranslationRow(data));
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to save changes", cause) };
  }
}

/**
 * 行を削除する。音声がある場合は Storage を先に削除し、
 * Storage の削除に失敗したら DB は触らない。
 */
export async function deleteTranslationRow(row: TranslationRow): Promise<Result<true>> {
  if (row.audio_path) {
    const removed = await deleteAudioFiles([row.audio_path]);
    if (!removed.ok) return removed;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("translation_rows").delete().eq("id", row.id);
    if (error) {
      return fail("database", "Failed to delete the phrase", error.message, error);
    }
    return ok(true);
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to delete the phrase", cause) };
  }
}

/** テキスト 3 列だけを複製する (音声は複製しない)。 */
export async function duplicateTranslationRow(
  row: TranslationRow,
  position: number,
): Promise<Result<TranslationRow>> {
  return createTranslationRow({
    project_id: row.project_id,
    original: row.original,
    japanese: row.japanese,
    reading: row.reading,
    position,
  });
}

/**
 * 並び順をまとめて保存する。
 *
 * PostgREST の upsert は「payload に含まれる列だけ」を更新するため、
 * id / project_id / position の 3 列だけを送れば他の列は保持される。
 * 1 リクエストで完結するので、行ごとの update より競合が起きにくい。
 */
export async function updateRowPositions(
  positions: RowPosition[],
): Promise<Result<true>> {
  if (positions.length === 0) return ok(true);

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("translation_rows")
      .upsert(positions, { onConflict: "id" });

    if (error) {
      return fail("database", "Failed to save the new order", error.message, error);
    }
    return ok(true);
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to save the new order", cause) };
  }
}

/** 配列の並びから position 0..n-1 を振り直す。重複 position を防ぐ。 */
export function normalizePositions(rows: TranslationRow[]): TranslationRow[] {
  return rows.map((row, index) => (row.position === index ? row : { ...row, position: index }));
}

/** normalizePositions 後、実際に変更があった行だけを抽出する。 */
export function diffPositions(
  previous: TranslationRow[],
  next: TranslationRow[],
): RowPosition[] {
  const previousById = new Map(previous.map((row) => [row.id, row.position]));
  const changed: RowPosition[] = [];
  for (const row of next) {
    if (previousById.get(row.id) !== row.position) {
      changed.push({ id: row.id, project_id: row.project_id, position: row.position });
    }
  }
  return changed;
}
