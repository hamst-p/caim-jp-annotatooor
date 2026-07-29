"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAudioUpload } from "@/hooks/use-audio-upload";
import { deleteAudio } from "@/lib/supabase/storage";
import { updateTranslationRow } from "@/lib/supabase/translation-rows";
import { cn } from "@/lib/utils";
import { AUDIO_ACCEPT_ATTRIBUTE, MAX_AUDIO_MB, validateAudioFile } from "@/lib/validators/audio";
import { formatAppError } from "@/types/result";
import type { TranslationRow } from "@/types/translation";

export function AudioUploader({
  row,
  variant,
  disabled,
  onUpdated,
}: {
  row: TranslationRow;
  variant: "empty" | "replace";
  disabled: boolean;
  onUpdated: (rowId: string, next: TranslationRow) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const player = useAudioPlayer();

  const { isUploading, progress, error, upload, cancel, clearError } = useAudioUpload({
    row,
    onUploaded: onUpdated,
    // 差し替え前に再生を停止して、古い URL を掴んだままにしない。
    onBeforeReplace: (rowId) => player.release(rowId),
  });

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

  const openPicker = () => inputRef.current?.click();

  const hiddenInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={AUDIO_ACCEPT_ATTRIBUTE}
      className="sr-only"
      disabled={disabled || isUploading}
      onChange={(event) => {
        handleFiles(event.target.files);
        // 同じファイルを続けて選べるようにリセットする。
        event.target.value = "";
      }}
    />
  );

  if (isUploading) {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        {hiddenInput}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          <span>Uploading… {progress}%</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                className="ml-auto"
                onClick={cancel}
                aria-label="Cancel upload"
              >
                <X aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancel upload</TooltipContent>
          </Tooltip>
        </div>
        <Progress value={progress} aria-label="Upload progress" />
      </div>
    );
  }

  if (variant === "replace") {
    return (
      <>
        {hiddenInput}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={openPicker} disabled={disabled}>
              <RefreshCw aria-hidden="true" />
              Replace Audio
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload a different MP3 for this phrase</TooltipContent>
        </Tooltip>
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {formatAppError(error)}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hiddenInput}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload MP3. Drag and drop a file here, or press Enter to browse."
        aria-disabled={disabled}
        onClick={() => !disabled && openPicker()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          if (disabled) return;
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
          "hover:border-ring hover:bg-muted/40",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
          isDragOver && "border-ring bg-muted/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">Upload MP3</span>
        <span className="text-xs text-muted-foreground">
          Drag &amp; drop, or click to browse · MP3 only · max {MAX_AUDIO_MB}MB
        </span>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {formatAppError(error)}
        </p>
      )}
    </div>
  );
}

export function DeleteAudioButton({
  row,
  disabled,
  onUpdated,
}: {
  row: TranslationRow;
  disabled: boolean;
  onUpdated: (rowId: string, next: TranslationRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const player = useAudioPlayer();

  const handleDelete = async () => {
    if (!row.audio_path) return;
    setIsDeleting(true);
    player.release(row.id);

    // 1. Storage を先に削除する。失敗したら DB は更新しない。
    const removed = await deleteAudio(row.audio_path);
    if (!removed.ok) {
      setIsDeleting(false);
      toast.error(formatAppError(removed.error));
      return;
    }

    // 2. DB の音声カラムを null へ戻す。
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
    setOpen(false);
    toast.success("Audio deleted");
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled}
            onClick={() => setOpen(true)}
            aria-label="Delete audio for this phrase"
          >
            <Trash2 aria-hidden="true" />
            Delete Audio
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove the MP3 from Storage</TooltipContent>
      </Tooltip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this audio file?</AlertDialogTitle>
          <AlertDialogDescription>
            {row.audio_file_name ?? "The MP3"} will be permanently removed from Supabase
            Storage. The phrase text will be kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
          >
            {isDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Delete audio
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
