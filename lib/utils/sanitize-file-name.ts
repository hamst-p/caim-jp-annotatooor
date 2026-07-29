/**
 * Supabase Storage のキーとして安全なファイル名へ変換する。
 *
 * - 拡張子を保持する
 * - ASCII 英数字と `.` `-` `_` 以外を `-` へ置換する
 * - 連続する `-` をまとめ、前後の `-` を削除する
 * - 長すぎる名前を切り詰める
 */
const MAX_BASE_LENGTH = 80;

export function sanitizeFileName(fileName: string, fallback = "audio.mp3"): string {
  const trimmed = fileName.trim();
  if (!trimmed) return fallback;

  const lastDot = trimmed.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < trimmed.length - 1;
  const rawBase = hasExtension ? trimmed.slice(0, lastDot) : trimmed;
  const rawExtension = hasExtension ? trimmed.slice(lastDot + 1) : "";

  const base = normalizeSegment(rawBase).slice(0, MAX_BASE_LENGTH) || "audio";
  const extension = normalizeSegment(rawExtension).toLowerCase() || "mp3";

  return `${base}.${extension}`;
}

function normalizeSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

/** 表示用にファイルサイズを整形する。 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
