"use client";

import { useMemo } from "react";
import { Music } from "lucide-react";

import { AudioPlayer } from "@/components/translation-manager/audio-player";
import { AudioUploader, DeleteAudioButton } from "@/components/translation-manager/audio-uploader";
import { EditableTextCell } from "@/components/translation-manager/editable-text-cell";
import { RowActions } from "@/components/translation-manager/row-actions";
import { RowSaveIndicator } from "@/components/translation-manager/save-status";
import { Badge } from "@/components/ui/badge";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { formatDuration } from "@/lib/audio/duration";
import { getAudioUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils/sanitize-file-name";
import { getRowStatuses, ROW_STATUS_LABEL } from "@/lib/utils/row-status";
import type { AppError } from "@/types/result";
import type { EditableDraft, EditableField, RowSaveState, TranslationRow } from "@/types/translation";

/** ヘッダー行とデータ行で共有する 4 列 + 行番号 + 操作列のグリッド。 */
export const ROW_GRID_CLASS =
  "grid w-full min-w-[54rem] grid-cols-[2.75rem_minmax(11rem,1.15fr)_minmax(11rem,1fr)_minmax(10rem,0.9fr)_minmax(16rem,1fr)_2.75rem]";

export function TranslationRowItem({
  row,
  draft,
  rowNumber,
  saveState,
  saveError,
  locked,
  moveDisabled,
  canMoveUp,
  canMoveDown,
  onFieldChange,
  onFieldBlur,
  onRetrySave,
  onRowUpdated,
  onAddBelow,
  onDuplicate,
  onDelete,
  onMove,
}: {
  row: TranslationRow;
  draft: EditableDraft;
  rowNumber: number;
  saveState: RowSaveState;
  saveError: AppError | null;
  locked: boolean;
  moveDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onFieldChange: (field: EditableField, value: string) => void;
  onFieldBlur: () => void;
  onRetrySave: () => void;
  onRowUpdated: (rowId: string, next: TranslationRow) => void;
  onAddBelow: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (direction: "up" | "down") => Promise<void>;
}) {
  const player = useAudioPlayer();
  const isRowPlaying = player.activeRowId === row.id && player.isPlaying;
  const isRowLoaded = player.activeRowId === row.id;

  const effectiveRow = useMemo<TranslationRow>(() => ({ ...row, ...draft }), [row, draft]);
  const statuses = useMemo(() => getRowStatuses(effectiveRow), [effectiveRow]);

  const audioUrl = useMemo(() => getAudioUrl(row.audio_path), [row.audio_path]);

  return (
    <div
      data-row-id={row.id}
      className={cn(
        ROW_GRID_CLASS,
        "border-b transition-colors last:border-b-0",
        isRowLoaded && "bg-primary/5",
        // 再生中の行は左端のアクセントバーと背景でハッキリ区別する。
        isRowPlaying &&
          "bg-sky-500/10 shadow-[inset_4px_0_0_0_var(--color-sky-500)] dark:bg-sky-400/10 dark:shadow-[inset_4px_0_0_0_var(--color-sky-400)]",
        saveState === "saving" && "bg-muted/40",
        saveState === "error" && "bg-destructive/5",
        locked && "pointer-events-none opacity-50",
      )}
    >
      {/* 行番号 (左端に固定) */}
      <div className="sticky left-0 z-10 flex flex-col items-center gap-1 border-r bg-inherit px-1 py-2">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{rowNumber}</span>
        {isRowPlaying && (
          <Music
            className="size-3.5 animate-pulse text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Original */}
      <div className="flex flex-col gap-1 border-r px-2 py-2">
        <EditableTextCell
          id={`original-${row.id}`}
          label={`Original text, row ${rowNumber}`}
          value={draft.original}
          placeholder="Enter original English text"
          disabled={locked}
          invalid={saveState === "error"}
          onChange={(value) => onFieldChange("original", value)}
          onBlur={onFieldBlur}
        />
        <div className="flex flex-wrap items-center gap-1">
          {statuses.map((status) => (
            <Badge
              key={status}
              variant={status === "complete" ? "secondary" : "outline"}
              className={cn(
                "text-[0.7rem]",
                status === "complete" && "text-emerald-700 dark:text-emerald-300",
              )}
            >
              {ROW_STATUS_LABEL[status]}
            </Badge>
          ))}
        </div>
        <RowSaveIndicator state={saveState} onRetry={onRetrySave} />
        {saveError && saveState === "error" && (
          <p className="text-[0.7rem] text-destructive" role="alert">
            {saveError.detail ?? saveError.message}
          </p>
        )}
      </div>

      {/* Japanese */}
      <div className="border-r px-2 py-2">
        <EditableTextCell
          id={`japanese-${row.id}`}
          label={`Japanese translation, row ${rowNumber}`}
          value={draft.japanese}
          placeholder="日本語訳を入力"
          disabled={locked}
          onChange={(value) => onFieldChange("japanese", value)}
          onBlur={onFieldBlur}
        />
      </div>

      {/* Reading */}
      <div className="border-r px-2 py-2">
        <EditableTextCell
          id={`reading-${row.id}`}
          label={`Romaji reading, row ${rowNumber}`}
          value={draft.reading}
          placeholder="Enter Japanese pronunciation"
          disabled={locked}
          className="font-mono text-sm"
          onChange={(value) => onFieldChange("reading", value)}
          onBlur={onFieldBlur}
        />
      </div>

      {/* Audio */}
      <div className="flex flex-col gap-2 border-r px-2 py-2">
        {row.audio_path && audioUrl ? (
          <>
            <AudioPlayer rowId={row.id} url={audioUrl} fallbackDuration={row.audio_duration} />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="max-w-full truncate font-medium text-foreground" title={row.audio_file_name ?? ""}>
                {row.audio_file_name ?? "audio.mp3"}
              </span>
              <span>{formatFileSize(row.audio_size)}</span>
              <span>{formatDuration(row.audio_duration)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <AudioUploader row={row} variant="replace" disabled={locked} onUpdated={onRowUpdated} />
              <DeleteAudioButton row={row} disabled={locked} onUpdated={onRowUpdated} />
            </div>
          </>
        ) : row.audio_path && !audioUrl ? (
          <p className="text-xs text-destructive" role="alert">
            Could not build a playback URL. Check the Supabase configuration.
          </p>
        ) : (
          <AudioUploader row={row} variant="empty" disabled={locked} onUpdated={onRowUpdated} />
        )}
      </div>

      {/* 行操作 */}
      <div className="flex items-start justify-center px-1 py-2">
        <RowActions
          row={row}
          rowNumber={rowNumber}
          canMoveUp={canMoveUp && !moveDisabled}
          canMoveDown={canMoveDown && !moveDisabled}
          disabled={locked}
          onAddBelow={onAddBelow}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onMove={onMove}
        />
      </div>
    </div>
  );
}
