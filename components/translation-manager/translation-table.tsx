"use client";

import { AlertTriangle, Eye, EyeOff, Inbox, Loader2, Plus, RefreshCw } from "lucide-react";

import {
  ROW_GRID_CLASS,
  TranslationRowItem,
} from "@/components/translation-manager/translation-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FuriganaSegment } from "@/lib/furigana/segments";
import { cn } from "@/lib/utils";
import type { AppError } from "@/types/result";
import type {
  EditableDraft,
  EditableField,
  LoadState,
  RowSaveState,
  TranslationRow,
} from "@/types/translation";

export type TranslationTableProps = {
  rows: TranslationRow[];
  allRowIds: string[];
  status: LoadState;
  error: AppError | null;
  lockedRowIds: ReadonlySet<string>;
  getDraft: (row: TranslationRow) => EditableDraft;
  getFurigana: (text: string) => FuriganaSegment[] | null;
  getSaveState: (rowId: string) => RowSaveState;
  getSaveError: (rowId: string) => AppError | null;
  onFieldChange: (row: TranslationRow, field: EditableField, value: string) => void;
  onFieldBlur: (row: TranslationRow) => void;
  onRetrySave: (row: TranslationRow) => void;
  onRowUpdated: (rowId: string, next: TranslationRow) => void;
  onAddBelow: (row: TranslationRow) => Promise<void>;
  onDuplicate: (row: TranslationRow) => Promise<void>;
  onDelete: (row: TranslationRow) => Promise<void>;
  onMove: (row: TranslationRow, direction: "up" | "down") => Promise<void>;
  onRetryLoad: () => void;
  onAddPhrase: () => void;
  /** 追加処理の実行中はボタンを止める。 */
  addDisabled: boolean;
  showFurigana: boolean;
  onToggleFurigana: () => void;
};

export function TranslationTable(props: TranslationTableProps) {
  const {
    rows,
    allRowIds,
    status,
    error,
    lockedRowIds,
    getDraft,
    getFurigana,
    getSaveState,
    getSaveError,
    onFieldChange,
    onFieldBlur,
    onRetrySave,
    onRowUpdated,
    onAddBelow,
    onDuplicate,
    onDelete,
    onMove,
    onRetryLoad,
    onAddPhrase,
    addDisabled,
    showFurigana,
    onToggleFurigana,
  } = props;

  if (status === "loading") {
    return <TableSkeleton />;
  }

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>{error?.message ?? "Failed to load phrases"}</AlertTitle>
        <AlertDescription>
          <p>{error?.detail ?? "Check your Supabase configuration and network connection."}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onRetryLoad}>
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col rounded-xl border bg-background shadow-sm">
      {status === "refreshing" && (
        <div
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-2 rounded-t-xl bg-primary/10 py-1 text-xs"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Refreshing…
        </div>
      )}

      {/* 残りの画面高を使い、縦横のスクロールはテーブル内に収める。 */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl">
        <div className="min-w-full">
          <TableHeader showFurigana={showFurigana} onToggleFurigana={onToggleFurigana} />

          {rows.length === 0 ? (
            <EmptyState onAddPhrase={onAddPhrase} />
          ) : (
            <div role="rowgroup">
              {rows.map((row) => {
                const index = allRowIds.indexOf(row.id);
                return (
                  <TranslationRowItem
                    key={row.id}
                    row={row}
                    draft={getDraft(row)}
                    rowNumber={index + 1}
                    saveState={getSaveState(row.id)}
                    saveError={getSaveError(row.id)}
                    furigana={showFurigana ? getFurigana(getDraft(row).japanese) : null}
                    locked={lockedRowIds.has(row.id)}
                    canMoveUp={index > 0}
                    canMoveDown={index < allRowIds.length - 1}
                    onFieldChange={(field, value) => onFieldChange(row, field, value)}
                    onFieldBlur={() => onFieldBlur(row)}
                    onRetrySave={() => onRetrySave(row)}
                    onRowUpdated={onRowUpdated}
                    onAddBelow={() => onAddBelow(row)}
                    onDuplicate={() => onDuplicate(row)}
                    onDelete={() => onDelete(row)}
                    onMove={(direction) => onMove(row, direction)}
                  />
                );
              })}
            </div>
          )}

          {rows.length > 0 && (
            <AddPhraseFooter onAddPhrase={onAddPhrase} disabled={addDisabled} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Japanese 列のふりがな表示を切り替える。 */
function FuriganaToggle({
  showFurigana,
  onToggle,
}: {
  showFurigana: boolean;
  onToggle: () => void;
}) {
  const label = showFurigana ? "Hide furigana" : "Show furigana";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={showFurigana}
          aria-label={label}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            "hover:bg-background focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
            showFurigana
              ? "border-border text-foreground"
              : "border-transparent text-muted-foreground",
          )}
        >
          {showFurigana ? (
            <Eye className="size-3" aria-hidden="true" />
          ) : (
            <EyeOff className="size-3" aria-hidden="true" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** 最終行の下に置く、フレーズ追加ボタン。 */
function AddPhraseFooter({
  onAddPhrase,
  disabled,
}: {
  onAddPhrase: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-w-full justify-center border-t px-2 py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onAddPhrase}
            disabled={disabled}
            aria-label="Add a new phrase at the end"
            className={cn(
              "flex size-8 items-center justify-center rounded-full border text-muted-foreground transition-colors",
              "hover:border-ring hover:bg-muted hover:text-foreground",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Add phrase</TooltipContent>
      </Tooltip>
    </div>
  );
}

function TableHeader({
  showFurigana = true,
  onToggleFurigana,
}: {
  showFurigana?: boolean;
  onToggleFurigana?: () => void;
}) {
  return (
    <div
      role="row"
      className={cn(
        ROW_GRID_CLASS,
        "sticky top-0 z-20 border-b bg-muted/95 text-sm font-bold backdrop-blur",
      )}
    >
      <div className="sticky left-0 z-10 border-r bg-muted/95 px-2 py-2 text-center text-muted-foreground">
        #
      </div>
      <div className="border-r px-2 py-2">Original</div>
      <div className="flex items-center gap-1.5 border-r px-2 py-2">
        Japanese
        {onToggleFurigana && (
          <FuriganaToggle showFurigana={showFurigana} onToggle={onToggleFurigana} />
        )}
      </div>
      <div className="border-r px-2 py-2">Reading</div>
      <div className="border-r px-2 py-2">Audio</div>
      <div className="px-2 py-2 text-center text-muted-foreground">
        <span className="sr-only">Row actions</span>
        <span aria-hidden="true">⋯</span>
      </div>
    </div>
  );
}

function EmptyState({ onAddPhrase }: { onAddPhrase: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">No phrases yet</p>
        <p className="text-sm text-muted-foreground">
          Add a single phrase, or paste a whole script with Bulk Import.
        </p>
      </div>
      <Button size="sm" onClick={onAddPhrase}>
        Add Phrase
      </Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-background shadow-sm">
      {/* 読み込み中も完成後と同じ高さを使い、レイアウトのずれを防ぐ。 */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl">
        <div className="min-w-full">
          <TableHeader />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={cn(ROW_GRID_CLASS, "border-b last:border-b-0")}>
              <div className="border-r px-2 py-3">
                <Skeleton className="mx-auto h-4 w-4" />
              </div>
              {Array.from({ length: 3 }).map((__, cell) => (
                <div key={cell} className="border-r px-2 py-3">
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
              <div className="border-r px-2 py-3">
                <Skeleton className="h-16 w-full" />
              </div>
              <div className="px-2 py-3">
                <Skeleton className="mx-auto h-6 w-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
