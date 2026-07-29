"use client";

import { Check, FileAudio, Languages, SpellCheck, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROW_STATUS_LABEL } from "@/lib/utils/row-status";
import { cn } from "@/lib/utils";
import type { RowStatus } from "@/types/translation";

const STATUS_ICON: Record<RowStatus, LucideIcon> = {
  complete: Check,
  "original-missing": Type,
  "translation-missing": Languages,
  "reading-missing": SpellCheck,
  "audio-missing": FileAudio,
};

/** 不足項目は同じ色に揃え、アイコンとツールチップで種類を区別する。 */
const STATUS_TONE: Record<RowStatus, string> = {
  complete:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-300",
  "original-missing": "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "translation-missing": "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "reading-missing": "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "audio-missing": "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

/**
 * 行番号の下に並べる、丸で囲んだステータスアイコン。
 * ラベルはツールチップと aria-label でのみ提示する。
 */
export function RowStatusIndicator({
  statuses,
  rowNumber,
  className,
}: {
  statuses: RowStatus[];
  rowNumber: number;
  className?: string;
}) {
  if (statuses.length === 0) return null;

  return (
    <div
      className={cn("grid grid-cols-2 justify-items-center gap-0.5", className)}
      role="group"
      aria-label={`Status of row ${rowNumber}`}
    >
      {statuses.map((status) => {
        const Icon = STATUS_ICON[status];
        const label = ROW_STATUS_LABEL[status];

        return (
          <Tooltip key={status}>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                role="img"
                aria-label={label}
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  STATUS_TONE[status],
                  // Complete のときは 1 つだけなので中央に大きく置く。
                  status === "complete" && "col-span-2",
                )}
              >
                <Icon className="size-3" aria-hidden="true" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
