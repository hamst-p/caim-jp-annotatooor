"use client";

import { AlertTriangle, Check, Loader2, PencilLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GlobalSaveState, RowSaveState } from "@/types/translation";

const LABEL: Record<GlobalSaveState, string> = {
  saved: "Saved",
  saving: "Saving",
  unsaved: "Unsaved changes",
  error: "Save failed",
};

export function SaveStatus({
  state,
  savingRowCount,
  failedRowCount,
}: {
  state: GlobalSaveState;
  savingRowCount: number;
  failedRowCount: number;
}) {
  const detail =
    state === "saving"
      ? `${savingRowCount} row(s) saving`
      : state === "error"
        ? `${failedRowCount} row(s) failed to save`
        : LABEL[state];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={state === "error" ? "destructive" : state === "saved" ? "outline" : "secondary"}
          aria-live="polite"
          aria-label={`Save status: ${LABEL[state]}`}
        >
          <SaveStatusIcon state={state} />
          <span className="hidden sm:inline">{LABEL[state]}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}

function SaveStatusIcon({ state }: { state: GlobalSaveState }) {
  if (state === "saving") return <Loader2 className="animate-spin" aria-hidden="true" />;
  if (state === "error") return <AlertTriangle aria-hidden="true" />;
  if (state === "unsaved") return <PencilLine aria-hidden="true" />;
  return <Check aria-hidden="true" />;
}

/** 行ごとのインジケーター。 */
export function RowSaveIndicator({
  state,
  onRetry,
  className,
}: {
  state: RowSaveState;
  onRetry: () => void;
  className?: string;
}) {
  if (state === "saved") return null;

  if (state === "error") {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-destructive", className)}>
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        <span>Save failed</span>
        <button
          type="button"
          onClick={onRetry}
          className="font-medium underline underline-offset-2 focus-visible:ring-3 focus-visible:ring-destructive/40 focus-visible:outline-none"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {state === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          <span>Saving…</span>
        </>
      ) : (
        <>
          <PencilLine className="size-3.5" aria-hidden="true" />
          <span>Unsaved changes</span>
        </>
      )}
    </div>
  );
}
