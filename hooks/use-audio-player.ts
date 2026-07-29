"use client";

import { createContext, useContext } from "react";

export type AudioPlaybackState = {
  /** 再生中・一時停止中の行 ID。何も読み込んでいなければ null。 */
  activeRowId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  error: string | null;
};

export type AudioPlayerApi = AudioPlaybackState & {
  /** 別の行を再生すると、再生中の音声は自動的に停止する。 */
  play: (rowId: string, url: string, playbackRate?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (rowId: string, seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  /** 行が削除／差し替えされたときに読み込みを解除する。 */
  release: (rowId: string) => void;
  /**
   * 現在の再生位置を直接読む。
   * `currentTime` は timeupdate (約 4Hz) 由来で粗いため、
   * カラオケ表示のように滑らかさが要る箇所は requestAnimationFrame と
   * 組み合わせてこちらを使う (state を更新しないので再描画も起きない)。
   */
  getCurrentTime: () => number;
};

export const AudioPlayerContext = createContext<AudioPlayerApi | null>(null);

export function useAudioPlayer(): AudioPlayerApi {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used inside <AudioPlayerProvider>.");
  }
  return context;
}

/** 1 行分の再生状態だけを取り出すヘルパー。 */
export function useRowAudioPlayback(rowId: string): {
  player: AudioPlayerApi;
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number | null;
  error: string | null;
} {
  const player = useAudioPlayer();
  const isActive = player.activeRowId === rowId;
  return {
    player,
    isActive,
    isPlaying: isActive && player.isPlaying,
    isLoading: isActive && player.isLoading,
    currentTime: isActive ? player.currentTime : 0,
    duration: isActive && player.duration > 0 ? player.duration : null,
    error: isActive ? player.error : null,
  };
}
