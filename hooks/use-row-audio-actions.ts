"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAudioUpload } from "@/hooks/use-audio-upload";
import { deleteAudio } from "@/lib/supabase/storage";
import { updateTranslationRow } from "@/lib/supabase/translation-rows";
import { validateAudioFile } from "@/lib/validators/audio";
import { formatAppError, type AppError } from "@/types/result";
import type { TranslationRow } from "@/types/translation";

/**
 * 1 行分の音声操作 (アップロード / 差し替え / 削除) をまとめたフック。
 *
 * ドロップゾーンと「⋮」メニューの両方から同じ処理を呼べるように、
 * ファイル input の参照と操作関数をここで一元管理する。
 */
export function useRowAudioActions({
  row,
  onUpdated,
}: {
  row: TranslationRow;
  onUpdated: (rowId: string, next: TranslationRow) => void;
}) {
  const player = useAudioPlayer();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { isUploading, progress, error, upload, cancel, clearError } = useAudioUpload({
    row,
    onUploaded: onUpdated,
    // 差し替え前に再生を停止して、古い URL を掴んだままにしない。
    onBeforeReplace: (rowId) => player.release(rowId),
  });

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;

      const validated = validateAudioFile(file);
      if (!validated.ok) {
        toast.error(formatAppError(validated.error));
        return;
      }
      clearError();
      void upload(file);
    },
    [clearError, upload],
  );

  /** Storage の削除に成功した場合のみ DB を null へ更新する。 */
  const confirmDelete = useCallback(async () => {
    if (!row.audio_path) return;

    setIsDeleting(true);
    player.release(row.id);

    const removed = await deleteAudio(row.audio_path);
    if (!removed.ok) {
      setIsDeleting(false);
      toast.error(formatAppError(removed.error));
      return;
    }

    const updated = await updateTranslationRow(row.id, {
      audio_path: null,
      audio_file_name: null,
      audio_size: null,
      audio_duration: null,
    });
    setIsDeleting(false);

    if (!updated.ok) {
      toast.error(formatAppError(updated.error));
      return;
    }

    onUpdated(row.id, updated.data);
    setDeleteDialogOpen(false);
    toast.success("Audio deleted");
  }, [onUpdated, player, row.audio_path, row.id]);

  return {
    inputRef,
    openFilePicker,
    handleFiles,
    isUploading,
    progress,
    uploadError: error as AppError | null,
    cancelUpload: cancel,
    isDeleting,
    deleteDialogOpen,
    setDeleteDialogOpen,
    confirmDelete,
    /** アップロード中・削除中は音声操作を止める。 */
    isBusy: isUploading || isDeleting,
  };
}
