"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { cn } from "@/lib/utils";

/**
 * 音量はプレイヤー 1 つ分しか存在しないため、行ごとではなく画面に 1 つだけ置く。
 */
export function VolumeControl({ className }: { className?: string }) {
  const player = useAudioPlayer();
  const percent = Math.round(player.volume * 100);
  const isMuted = player.volume === 0;

  const Icon = isMuted ? VolumeX : player.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => player.setVolume(isMuted ? 1 : 0)}
            aria-label={isMuted ? "Unmute playback" : "Mute playback"}
          >
            <Icon aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isMuted ? "Unmute" : "Mute"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Slider
            value={[percent]}
            min={0}
            max={100}
            step={1}
            aria-label="Playback volume"
            className="w-24"
            onValueChange={([next]) => player.setVolume(next / 100)}
          />
        </TooltipTrigger>
        <TooltipContent>Volume {percent}%</TooltipContent>
      </Tooltip>
    </div>
  );
}
