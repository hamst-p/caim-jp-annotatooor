import type { RowStatus, TranslationRow } from "@/types/translation";

/** 下書き (未保存の入力) を反映した「見た目上の行」。 */
export type EffectiveRow = TranslationRow;

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasAudio(row: EffectiveRow): boolean {
  return typeof row.audio_path === "string" && row.audio_path.length > 0;
}

export function isComplete(row: EffectiveRow): boolean {
  return (
    filled(row.original) && filled(row.japanese) && filled(row.reading) && hasAudio(row)
  );
}

/** 行に表示するステータスバッジ。不足が複数あれば複数返す。 */
export function getRowStatuses(row: EffectiveRow): RowStatus[] {
  if (isComplete(row)) return ["complete"];

  const statuses: RowStatus[] = [];
  if (!filled(row.original)) statuses.push("original-missing");
  if (!filled(row.japanese)) statuses.push("translation-missing");
  if (!filled(row.reading)) statuses.push("reading-missing");
  if (!hasAudio(row)) statuses.push("audio-missing");
  return statuses;
}

export const ROW_STATUS_LABEL: Record<RowStatus, string> = {
  complete: "Complete",
  "original-missing": "Original missing",
  "translation-missing": "Translation missing",
  "reading-missing": "Reading missing",
  "audio-missing": "Audio missing",
};

export type SummaryCounts = {
  total: number;
  completed: number;
  audioUploaded: number;
  audioMissing: number;
};

export function summarizeRows(rows: EffectiveRow[]): SummaryCounts {
  let completed = 0;
  let audioUploaded = 0;

  for (const row of rows) {
    if (isComplete(row)) completed += 1;
    if (hasAudio(row)) audioUploaded += 1;
  }

  return {
    total: rows.length,
    completed,
    audioUploaded,
    audioMissing: rows.length - audioUploaded,
  };
}
