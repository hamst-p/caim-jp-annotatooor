"use client";

import { useMemo, useState } from "react";
import { Gauge, Pause, Play, Square, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRowAudioPlayback } from "@/hooks/use-audio-player";
import { formatDuration } from "@/lib/audio/duration";
import { cn } from "@/lib/utils";

/**
 * 音声プレイヤー。URL は props で受け取り、
 * Storage の URL 生成 (`getAudioUrl`) はこのコンポーネントの外で行う。
 */
export function AudioPlayer({
  rowId,
  url,
  fallbackDuration,
}: {
  rowId: string;
  url: string;
  fallbackDuration: number | null;
}) {
  const { player, isActive, isPlaying, isLoading, currentTime, duration, error } =
    useRowAudioPlayback(rowId);

  const totalDuration = duration ?? fallbackDuration ?? 0;
  // シーク中の一時的な値。行が非アクティブなら無視する (state のリセットは不要)。
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  const displayedTime = isActive ? (scrubbing ?? currentTime) : 0;
  const progressValue = useMemo(() => {
    if (totalDuration <= 0) return 0;
    return Math.min(100, (displayedTime / totalDuration) * 100);
  }, [displayedTime, totalDuration]);

  const isNormalSpeed = isActive && player.playbackRate === 1;
  const isThreeQuarterSpeed = isActive && player.playbackRate === 0.75;
  const isHalfSpeed = isActive && player.playbackRate === 0.5;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant={isPlaying && isNormalSpeed ? "default" : "outline"}
              onClick={() => {
                setScrubbing(null);
                player.play(rowId, url, 1);
              }}
              aria-label="Play at normal speed"
            >
              <Play aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play 1x</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={isPlaying && isThreeQuarterSpeed ? "default" : "outline"}
              onClick={() => {
                setScrubbing(null);
                player.play(rowId, url, 0.75);
              }}
              aria-label="Play at 0.75x speed"
            >
              <Gauge aria-hidden="true" />
              0.75x
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play slowly (0.75x)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={isPlaying && isHalfSpeed ? "default" : "outline"}
              onClick={() => {
                setScrubbing(null);
                player.play(rowId, url, 0.5);
              }}
              aria-label="Play at 0.5x speed"
            >
              <Gauge aria-hidden="true" />
              0.5x
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play slowly (0.5x)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => player.pause()}
              disabled={!isPlaying}
              aria-label="Pause playback"
            >
              <Pause aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pause</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => {
                setScrubbing(null);
                player.stop();
              }}
              disabled={!isActive}
              aria-label="Stop playback"
            >
              <Square aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>

        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {formatDuration(displayedTime)} / {formatDuration(totalDuration || null)}
        </span>
      </div>

      <Slider
        value={[progressValue]}
        min={0}
        max={100}
        step={0.1}
        disabled={!isActive || totalDuration <= 0}
        aria-label="Seek"
        onValueChange={([next]) => setScrubbing((next / 100) * totalDuration)}
        onValueCommit={([next]) => {
          const seconds = (next / 100) * totalDuration;
          player.seek(rowId, seconds);
          setScrubbing(null);
        }}
      />

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => player.setVolume(player.volume > 0 ? 0 : 1)}
              aria-label={player.volume > 0 ? "Mute" : "Unmute"}
            >
              {player.volume > 0 ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Volume</TooltipContent>
        </Tooltip>
        <Slider
          value={[player.volume * 100]}
          min={0}
          max={100}
          step={1}
          aria-label="Volume"
          className="max-w-28"
          onValueChange={([next]) => player.setVolume(next / 100)}
        />
        {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
