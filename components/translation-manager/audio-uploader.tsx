"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { AUDIO_ACCEPT_ATTRIBUTE, MAX_AUDIO_MB } from "@/lib/validators/audio";

/**
 * Audio 列の表示部分。アップロード処理そのものは `useRowAudioActions` が持ち、
 * ここは見た目とイベントの受け渡しだけを担当する。
 */

/** 行ごとに 1 つだけ置く、非表示のファイル入力。 */
export function AudioFileInput({
  inputRef,
  disabled,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={AUDIO_ACCEPT_ATTRIBUTE}
      className="sr-only"
      tabIndex={-1}
      disabled={disabled}
      onChange={(event) => {
        onFiles(event.target.files);
        // 同じファイルを続けて選べるようにリセットする。
        event.target.value = "";
      }}
    />
  );
}

export function AudioUploadProgress({
  progress,
  onCancel,
}: {
  progress: number;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        <span>Uploading… {progress}%</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto"
              onClick={onCancel}
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

export function AudioDropzone({
  disabled,
  onBrowse,
  onFiles,
}: {
  disabled: boolean;
  onBrowse: () => void;
  onFiles: (files: FileList | null) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload MP3. Drag and drop a file here, or press Enter to browse."
      aria-disabled={disabled}
      onClick={() => !disabled && onBrowse()}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onBrowse();
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
        onFiles(event.dataTransfer.files);
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
  );
}

export function DeleteAudioDialog({
  open,
  fileName,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  fileName: string | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this audio file?</AlertDialogTitle>
          <AlertDialogDescription>
            {fileName ?? "The MP3"} will be permanently removed from Supabase Storage. The
            phrase text will be kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
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
