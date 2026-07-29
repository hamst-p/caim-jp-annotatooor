"use client";

import { AudioLines, CircleCheck, FileAudio, ListMusic, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SummaryCounts } from "@/lib/utils/row-status";

type SummaryItem = {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  icon: LucideIcon;
  tone: string;
};

/**
 * 進捗サマリー。縦の表示領域をテーブルへ譲るため、
 * 画面上部のカードではなく折りたたみ可能な右サイドバーに置く。
 * 畳んだ状態でもアイコンと件数だけは見えるようにしている。
 */
export function SummarySidebar({
  counts,
  isLoading,
  open,
  onToggle,
}: {
  counts: SummaryCounts;
  isLoading: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const items: SummaryItem[] = [
    {
      key: "total",
      label: "Total phrases",
      shortLabel: "Total",
      value: counts.total,
      icon: ListMusic,
      tone: "text-foreground",
    },
    {
      key: "completed",
      label: "Completed translations",
      shortLabel: "Completed",
      value: counts.completed,
      icon: CircleCheck,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "audio-uploaded",
      label: "Audio uploaded",
      shortLabel: "Audio",
      value: counts.audioUploaded,
      icon: AudioLines,
      tone: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "audio-missing",
      label: "Audio missing",
      shortLabel: "Missing",
      value: counts.audioMissing,
      icon: FileAudio,
      tone: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <aside
      aria-label="Project summary"
      className={cn(
        "flex shrink-0 flex-col border-l bg-background transition-[width] duration-200",
        // 狭い画面では開いていても細いレールのままにして、テーブルの幅を確保する。
        open ? "w-12 lg:w-52" : "w-12",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-b px-2 py-2",
          open ? "justify-center lg:justify-between" : "justify-center",
        )}
      >
        {open && (
          <span className="hidden text-xs font-medium text-muted-foreground lg:inline">
            Summary
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={open ? "Collapse summary sidebar" : "Expand summary sidebar"}
            >
              {open ? (
                <PanelRightClose aria-hidden="true" />
              ) : (
                <PanelRightOpen aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{open ? "Collapse" : "Expand summary"}</TooltipContent>
        </Tooltip>
      </div>

      {/* 展開表示と細いレールの両方を描画し、表示の切り替えは CSS に任せる
          (サーバー描画時に画面幅を知る必要がなくなる)。 */}
      <div
        className={cn(
          "flex-1 flex-col gap-2 overflow-y-auto p-2",
          open ? "hidden lg:flex" : "hidden",
        )}
      >
        {items.map((item) => (
          <ExpandedStat key={item.key} item={item} isLoading={isLoading} />
        ))}
      </div>

      <div
        className={cn(
          "flex-1 flex-col items-center gap-4 overflow-y-auto py-3",
          open ? "flex lg:hidden" : "flex",
        )}
      >
        {items.map((item) => (
          <CollapsedStat key={item.key} item={item} isLoading={isLoading} />
        ))}
      </div>
    </aside>
  );
}

function ExpandedStat({ item, isLoading }: { item: SummaryItem; isLoading: boolean }) {
  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{item.label}</span>
        <item.icon className={cn("size-3.5 shrink-0", item.tone)} aria-hidden="true" />
      </div>
      {isLoading ? (
        <Skeleton className="mt-1 h-7 w-10" />
      ) : (
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">{item.value}</p>
      )}
    </div>
  );
}

function CollapsedStat({ item, isLoading }: { item: SummaryItem; isLoading: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          role="img"
          aria-label={`${item.label}: ${item.value}`}
          className="flex flex-col items-center gap-0.5 rounded-md px-1 py-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <item.icon className={cn("size-4", item.tone)} aria-hidden="true" />
          {isLoading ? (
            <Skeleton className="h-3 w-5" />
          ) : (
            <span className="text-xs font-semibold tabular-nums">{item.value}</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">
        {item.label}: {item.value}
      </TooltipContent>
    </Tooltip>
  );
}
