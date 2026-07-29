"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  AudioPlayerContext,
  type AudioPlaybackState,
  type AudioPlayerApi,
} from "@/hooks/use-audio-player";

const INITIAL_STATE: AudioPlaybackState = {
  activeRowId: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  error: null,
};

/**
 * アプリ全体で HTMLAudioElement を 1 つだけ保持する。
 * これにより「同時に再生できる音声は 1 つだけ」が構造的に保証される。
 */
export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRowIdRef = useRef<string | null>(null);
  const [state, setState] = useState<AudioPlaybackState>(INITIAL_STATE);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "metadata";
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    const audio = getAudio();

    const onTimeUpdate = () =>
      setState((current) => ({ ...current, currentTime: audio.currentTime }));
    const onLoadedMetadata = () =>
      setState((current) => ({
        ...current,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        isLoading: false,
      }));
    const onPlay = () =>
      setState((current) => ({ ...current, isPlaying: true, isLoading: false, error: null }));
    const onPause = () => setState((current) => ({ ...current, isPlaying: false }));
    const onEnded = () =>
      setState((current) => ({ ...current, isPlaying: false, currentTime: 0 }));
    const onWaiting = () => setState((current) => ({ ...current, isLoading: true }));
    const onPlaying = () => setState((current) => ({ ...current, isLoading: false }));
    const onError = () =>
      setState((current) => ({
        ...current,
        isPlaying: false,
        isLoading: false,
        error: "Could not load this audio file. It may have been removed from Storage.",
      }));

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [getAudio]);

  const play = useCallback(
    (rowId: string, url: string, playbackRate = 1) => {
      const audio = getAudio();
      const isSameRow = activeRowIdRef.current === rowId;

      if (!isSameRow) {
        // 別の行を再生する前に、現在の再生を止める。
        audio.pause();
        audio.src = url;
        audio.currentTime = 0;
        activeRowIdRef.current = rowId;
        setState((current) => ({
          ...current,
          activeRowId: rowId,
          currentTime: 0,
          duration: 0,
          isLoading: true,
          error: null,
          playbackRate,
        }));
      } else {
        setState((current) => ({ ...current, playbackRate, error: null }));
      }

      audio.playbackRate = playbackRate;
      audio.volume = state.volume;

      void audio.play().catch(() => {
        setState((current) => ({
          ...current,
          isPlaying: false,
          isLoading: false,
          error: "Playback failed. The audio file may be unavailable.",
        }));
      });
    },
    [getAudio, state.volume],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setState((current) => ({ ...current, isPlaying: false, currentTime: 0 }));
  }, []);

  const seek = useCallback((rowId: string, seconds: number) => {
    const audio = audioRef.current;
    if (!audio || activeRowIdRef.current !== rowId) return;
    audio.currentTime = seconds;
    setState((current) => ({ ...current, currentTime: seconds }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setState((current) => ({ ...current, playbackRate: rate }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.min(1, Math.max(0, volume));
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
    setState((current) => ({ ...current, volume: clamped }));
  }, []);

  const release = useCallback((rowId: string) => {
    if (activeRowIdRef.current !== rowId) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    activeRowIdRef.current = null;
    setState((current) => ({
      ...current,
      activeRowId: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      error: null,
    }));
  }, []);

  const value = useMemo<AudioPlayerApi>(
    () => ({
      ...state,
      play,
      pause,
      stop,
      seek,
      setPlaybackRate,
      setVolume,
      release,
    }),
    [state, play, pause, stop, seek, setPlaybackRate, setVolume, release],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}
