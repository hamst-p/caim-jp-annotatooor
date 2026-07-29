"use client";

import { AudioLines, CircleCheck, FileAudio, ListMusic } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SummaryCounts } from "@/lib/utils/row-status";

export function SummaryCards({
  counts,
  isLoading,
}: {
  counts: SummaryCounts;
  isLoading: boolean;
}) {
  const items: {
    key: string;
    label: string;
    value: number;
    icon: LucideIcon;
    tone: string;
  }[] = [
    {
      key: "total",
      label: "Total phrases",
      value: counts.total,
      icon: ListMusic,
      tone: "text-foreground",
    },
    {
      key: "completed",
      label: "Completed translations",
      value: counts.completed,
      icon: CircleCheck,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "audio-uploaded",
      label: "Audio uploaded",
      value: counts.audioUploaded,
      icon: AudioLines,
      tone: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "audio-missing",
      label: "Audio missing",
      value: counts.audioMissing,
      icon: FileAudio,
      tone: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.key} className="gap-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <item.icon className={cn("size-4 shrink-0", item.tone)} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-12" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tabular-nums">{item.value}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
