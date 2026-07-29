"use client";

import { useEffect, useMemo, useState } from "react";
import { Music, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { FuriganaSegment } from "@/lib/furigana/segments";
import {
  buildJapaneseCues,
  buildReadingCues,
  findActiveCueIndex,
  type Cue,
} from "@/lib/karaoke/timing";
import { cn } from "@/lib/utils";
import type { TranslationRow } from "@/types/translation";

/**
 * 再生中の行を大きく表示し、進行に合わせて Japanese / Reading をなぞる。
 *
 * タイミングは音声とテキストの強制アライメントではなく、
 * モーラ数から按分した推定値 (lib/karaoke/timing.ts を参照)。
 */
export function NowPlayingPanel({
  rows,
  getFurigana,
  showFurigana,
}: {
  rows: TranslationRow[];
  getFurigana: (text: string) => FuriganaSegment[] | null;
  showFurigana: boolean;
}) {
  const player = useAudioPlayer();
  const [time, setTime] = useState(0);

  // 再生中の行はここで解決する。親に持たせると、再生位置の更新のたびに
  // テーブル全体が再描画されてしまう。
  const activeIndex = player.activeRowId
    ? rows.findIndex((item) => item.id === player.activeRowId)
    : -1;
  const row = activeIndex >= 0 ? rows[activeIndex] : null;
  const rowNumber = activeIndex >= 0 ? activeIndex + 1 : null;
  const segments = row ? getFurigana(row.japanese) : null;

  const isActive = row !== null;
  const isPlaying = isActive && player.isPlaying;

  // timeupdate は約 4Hz と粗いので、再生中だけ rAF で滑らかに追従する。
  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    const tick = () => {
      setTime(player.getCurrentTime());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, player]);

  // 一時停止・シーク時は state 側の値を使う。
  const currentTime = isPlaying ? time : player.currentTime;
  const duration = player.duration > 0 ? player.duration : (row?.audio_duration ?? 0);

  const japaneseCues = useMemo(
    () => (row ? buildJapaneseCues(row.japanese, segments, duration) : []),
    [row, segments, duration],
  );
  const readingCues = useMemo(
    () => (row ? buildReadingCues(row.reading, duration) : []),
    [row, duration],
  );

  if (!row || !isActive) return null;

  const japaneseIndex = findActiveCueIndex(japaneseCues, currentTime);
  const readingIndex = findActiveCueIndex(readingCues, currentTime);

  return (
    <section
      aria-label="Now playing"
      className="shrink-0 rounded-xl border bg-card px-4 py-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <Music
          className={cn(
            "size-3.5 shrink-0 text-sky-600 dark:text-sky-400",
            isPlaying && "animate-pulse",
          )}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-muted-foreground">
          {rowNumber !== null ? `Row ${rowNumber}` : "Now playing"}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground/80">
          {row.original}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto"
              onClick={() => player.release(row.id)}
              aria-label="Close now playing"
            >
              <X aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>

      {row.japanese && (
        <p
          className={cn(
            "text-xl leading-[2.2] font-medium break-words sm:text-2xl",
            "[&_rt]:text-[0.45em] [&_rt]:font-normal",
          )}
        >
          {japaneseCues.map((cue, index) => (
            <CueSpan key={`ja-${index}`} cue={cue} index={index} activeIndex={japaneseIndex}>
              {showFurigana && cue.ruby ? (
                <ruby>
                  {cue.text}
                  <rp>(</rp>
                  <rt>{cue.ruby}</rt>
                  <rp>)</rp>
                </ruby>
              ) : (
                cue.text
              )}
            </CueSpan>
          ))}
        </p>
      )}

      {row.reading && (
        <p className="mt-1 font-mono text-sm leading-relaxed break-words sm:text-base">
          {readingCues.map((cue, index) => (
            <CueSpan key={`ro-${index}`} cue={cue} index={index} activeIndex={readingIndex}>
              {cue.text}
            </CueSpan>
          ))}
        </p>
      )}
    </section>
  );
}

/** 発話済み / 発話中 / 未発話で見た目を変える。 */
function CueSpan({
  cue,
  index,
  activeIndex,
  children,
}: {
  cue: Cue;
  index: number;
  activeIndex: number;
  children: React.ReactNode;
}) {
  const isCurrent = index === activeIndex;
  const isDone = index < activeIndex;

  return (
    <span
      data-start={cue.start.toFixed(2)}
      className={cn(
        "transition-colors duration-100",
        isCurrent && "rounded bg-sky-500/20 text-sky-700 dark:bg-sky-400/25 dark:text-sky-200",
        isDone && "text-foreground",
        !isCurrent && !isDone && "text-muted-foreground/45",
      )}
    >
      {children}
    </span>
  );
}
