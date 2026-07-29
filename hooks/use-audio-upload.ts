"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { replaceAudio, uploadAudio, type UploadProgress } from "@/lib/supabase/storage";
import { updateTranslationRow } from "@/lib/supabase/translation-rows";
import { formatAppError, type AppError } from "@/types/result";
import type { TranslationRow } from "@/types/translation";

export type UploadState = {
  isUploading: boolean;
  progress: number;
  error: AppError | null;
};

const IDLE: UploadState = { isUploading: false, progress: 0, error: null };

export function useAudioUpload(options: {
  row: TranslationRow;
  onUploaded: (rowId: string, row: TranslationRow) => void;
  onBeforeReplace?: (rowId: string) => void;
}) {
  const { row, onUploaded, onBeforeReplace } = options;
  const [state, setState] = useState<UploadState>(IDLE);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  // 二重送信防止 (state 更新前に連続で呼ばれても弾く)。
  const inFlightRef = useRef(false);
  const onUploadedRef = useRef(onUploaded);
  const onBeforeReplaceRef = useRef(onBeforeReplace);

  useEffect(() => {
    onUploadedRef.current = onUploaded;
    onBeforeReplaceRef.current = onBeforeReplace;
  }, [onUploaded, onBeforeReplace]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      inFlightRef.current = false;
    };
  }, []);

  const upload = useCallback(
    async (file: File) => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      setState({ isUploading: true, progress: 0, error: null });

      const onProgress = (progress: UploadProgress) => {
        if (!mountedRef.current) return;
        setState((current) => ({ ...current, progress: progress.percent }));
      };

      const isReplace = Boolean(row.audio_path);
      if (isReplace) onBeforeReplaceRef.current?.(row.id);

      const uploaded = isReplace
        ? await replaceAudio({
            projectId: row.project_id,
            rowId: row.id,
            file,
            previousPath: row.audio_path,
            onProgress,
            signal: controller.signal,
          })
        : await uploadAudio({
            projectId: row.project_id,
            rowId: row.id,
            file,
            onProgress,
            signal: controller.signal,
          });

      if (!mountedRef.current) {
        inFlightRef.current = false;
        return false;
      }

      if (!uploaded.ok) {
        inFlightRef.current = false;
        abortRef.current = null;
        if (uploaded.error.kind === "cancelled") {
          setState(IDLE);
          toast.info("Upload cancelled");
          return false;
        }
        setState({ isUploading: false, progress: 0, error: uploaded.error });
        toast.error(formatAppError(uploaded.error));
        return false;
      }

      const metadata = "metadata" in uploaded.data ? uploaded.data.metadata : uploaded.data;
      const previousDeleted =
        "previousDeleted" in uploaded.data ? uploaded.data.previousDeleted : true;

      // DB を新しいパスへ更新する。
      const updated = await updateTranslationRow(row.id, metadata);
      if (!mountedRef.current) {
        inFlightRef.current = false;
        return false;
      }

      inFlightRef.current = false;
      abortRef.current = null;

      if (!updated.ok) {
        setState({ isUploading: false, progress: 0, error: updated.error });
        toast.error(formatAppError(updated.error));
        return false;
      }

      setState(IDLE);
      onUploadedRef.current(row.id, updated.data);

      if (!previousDeleted) {
        toast.warning("Audio replaced, but the previous file could not be removed from Storage.");
      } else {
        toast.success(isReplace ? "Audio replaced" : "Audio uploaded");
      }
      return true;
    },
    [row.audio_path, row.id, row.project_id],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  return { ...state, upload, cancel, clearError };
}
