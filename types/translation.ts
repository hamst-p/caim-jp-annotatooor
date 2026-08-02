export type TranslationRow = {
  id: string;
  project_id: string;
  original: string;
  japanese: string;
  reading: string;
  audio_path: string | null;
  audio_file_name: string | null;
  audio_size: number | null;
  audio_duration: number | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type TranslationRowInsert = {
  project_id: string;
  original?: string;
  japanese?: string;
  reading?: string;
  audio_path?: string | null;
  audio_file_name?: string | null;
  audio_size?: number | null;
  audio_duration?: number | null;
  position: number;
};

export type TranslationRowUpdate = Partial<
  Omit<TranslationRow, "id" | "project_id" | "created_at" | "updated_at">
>;

/** 自動保存の対象になるテキスト 3 列。 */
export type EditableField = "original" | "japanese" | "reading";

export const EDITABLE_FIELDS: readonly EditableField[] = [
  "original",
  "japanese",
  "reading",
] as const;

export type EditableDraft = Record<EditableField, string>;

/** 音声メタデータをまとめて更新するためのペイロード。 */
export type AudioMetadata = {
  audio_path: string;
  audio_file_name: string;
  audio_size: number;
  audio_duration: number | null;
};

/** 並び替え保存時に送る最小ペイロード。 */
export type RowPosition = {
  id: string;
  project_id: string;
  position: number;
};

/** 行に表示するステータスバッジ。 */
export type RowStatus =
  | "complete"
  | "original-missing"
  | "translation-missing"
  | "reading-missing"
  | "audio-missing";

/** 行ごとの保存状態。 */
export type RowSaveState = "saved" | "unsaved" | "saving" | "error";

/** 画面ヘッダーに出す全体の保存状態。 */
export type GlobalSaveState = "saved" | "unsaved" | "saving" | "error";

/** 一覧データの読み込み状態。 */
export type LoadState = "idle" | "loading" | "refreshing" | "loaded" | "error";
