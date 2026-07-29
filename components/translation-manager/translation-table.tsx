"use client";

import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AlertTriangle, Inbox, Loader2, RefreshCw, Search } from "lucide-react";

import {
  ROW_GRID_CLASS,
  TranslationRowItem,
} from "@/components/translation-manager/translation-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRowReordering } from "@/hooks/use-row-reordering";
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
  dragDisabled: boolean;
  isFiltered: boolean;
  getDraft: (row: TranslationRow) => EditableDraft;
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
  onReorder: (activeId: string, overId: string) => Promise<boolean>;
  onRetryLoad: () => void;
  onAddPhrase: () => void;
};

export function TranslationTable(props: TranslationTableProps) {
  const {
    rows,
    allRowIds,
    status,
    error,
    lockedRowIds,
    dragDisabled,
    isFiltered,
    getDraft,
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
    onReorder,
    onRetryLoad,
    onAddPhrase,
  } = props;

  const { sensors, activeId, isSaving, handleDragStart, handleDragEnd, handleDragCancel } =
    useRowReordering({ onReorder, disabled: dragDisabled });

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
      {(status === "refreshing" || isSaving) && (
        <div
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-2 rounded-t-xl bg-primary/10 py-1 text-xs"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {isSaving ? "Saving new order…" : "Refreshing…"}
        </div>
      )}

      {/* 残りの画面高を使い、縦横のスクロールはテーブル内に収める。 */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl">
        <div className="min-w-full">
          <TableHeader />

          {rows.length === 0 ? (
            <EmptyState isFiltered={isFiltered} onAddPhrase={onAddPhrase} />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragStart={handleDragStart}
              onDragEnd={(event) => void handleDragEnd(event)}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={allRowIds} strategy={verticalListSortingStrategy}>
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
                        locked={lockedRowIds.has(row.id)}
                        dragDisabled={dragDisabled}
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
              </SortableContext>
              <DragOverlay>{activeId ? <div className="h-2" /> : null}</DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}

function TableHeader() {
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
      <div className="border-r px-2 py-2">Japanese</div>
      <div className="border-r px-2 py-2">Reading</div>
      <div className="border-r px-2 py-2">Audio</div>
      <div className="px-2 py-2 text-center text-muted-foreground">
        <span className="sr-only">Row actions</span>
        <span aria-hidden="true">⋯</span>
      </div>
    </div>
  );
}

function EmptyState({
  isFiltered,
  onAddPhrase,
}: {
  isFiltered: boolean;
  onAddPhrase: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {isFiltered ? (
        <>
          <Search className="size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">No phrases match the current search or filter</p>
            <p className="text-sm text-muted-foreground">
              Clear the search box or switch the filter back to “All”.
            </p>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
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
