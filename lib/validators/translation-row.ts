import { z } from "zod";

import { fail, ok, type Result } from "@/types/result";
import type { TranslationRowInsert, TranslationRowUpdate } from "@/types/translation";

/** テキスト 1 セルの最大文字数。 */
export const MAX_CELL_LENGTH = 5000;

const cellSchema = z.string().max(MAX_CELL_LENGTH, {
  message: `Text must be ${MAX_CELL_LENGTH} characters or fewer.`,
});

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Project name is required." })
  .max(120, { message: "Project name must be 120 characters or fewer." });

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(500, { message: "Description must be 500 characters or fewer." });

export const translationRowInsertSchema = z.object({
  project_id: z.uuid({ message: "A valid project must be selected." }),
  original: cellSchema.optional(),
  japanese: cellSchema.optional(),
  reading: cellSchema.optional(),
  audio_path: z.string().nullable().optional(),
  audio_file_name: z.string().nullable().optional(),
  audio_size: z.number().int().nonnegative().nullable().optional(),
  audio_duration: z.number().nonnegative().nullable().optional(),
  position: z.number().int().nonnegative(),
});

export const translationRowUpdateSchema = z.object({
  original: cellSchema.optional(),
  japanese: cellSchema.optional(),
  reading: cellSchema.optional(),
  audio_path: z.string().nullable().optional(),
  audio_file_name: z.string().nullable().optional(),
  audio_size: z.number().int().nonnegative().nullable().optional(),
  audio_duration: z.number().nonnegative().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
});

export function validateTranslationRowInsert(
  input: TranslationRowInsert,
): Result<TranslationRowInsert> {
  const parsed = translationRowInsertSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid row data.");
  }
  return ok(parsed.data as TranslationRowInsert);
}

export function validateTranslationRowUpdate(
  input: TranslationRowUpdate,
): Result<TranslationRowUpdate> {
  const parsed = translationRowUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message ?? "Invalid row data.");
  }
  return ok(parsed.data as TranslationRowUpdate);
}

/** Bulk Import 用: 3 つのテキストエリアを行単位で解析する。 */
export type BulkImportParseResult = {
  originals: string[];
  japaneses: string[];
  readings: string[];
  /** 3 列のうち最も長い行数 (プレビュー行数)。 */
  lineCount: number;
  /** 行数が揃っていない場合 true。 */
  mismatched: boolean;
  counts: { original: number; japanese: number; reading: number };
};

export function splitBulkLines(value: string): string[] {
  const normalized = value.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  // 末尾の空行だけは無視する (テキストエリアの改行対策)。
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.map((line) => line.trim());
}

export function parseBulkImport(
  original: string,
  japanese: string,
  reading: string,
): BulkImportParseResult {
  const originals = splitBulkLines(original);
  const japaneses = splitBulkLines(japanese);
  const readings = splitBulkLines(reading);

  const counts = {
    original: originals.length,
    japanese: japaneses.length,
    reading: readings.length,
  };
  const nonEmptyCounts = [counts.original, counts.japanese, counts.reading].filter(
    (count) => count > 0,
  );
  const lineCount = Math.max(0, ...nonEmptyCounts);
  const mismatched =
    nonEmptyCounts.length > 1 && new Set(nonEmptyCounts).size > 1;

  return { originals, japaneses, readings, lineCount, mismatched, counts };
}
