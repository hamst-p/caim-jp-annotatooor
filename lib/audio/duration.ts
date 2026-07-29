/**
 * 音声ファイルの長さ (秒) をブラウザ上で取得する。
 * 取得できない場合は例外ではなく null を返し、アップロードは継続できるようにする。
 */
const DURATION_TIMEOUT_MS = 10_000;

export function readAudioDuration(file: File): Promise<number | null> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      audio.src = "";
      URL.revokeObjectURL(objectUrl);
    };

    const settle = (value: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onLoaded = () => {
      const duration = audio.duration;
      settle(Number.isFinite(duration) && duration > 0 ? duration : null);
    };

    const onError = () => settle(null);

    const timeoutId = window.setTimeout(() => settle(null), DURATION_TIMEOUT_MS);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.preload = "metadata";
    audio.src = objectUrl;
  });
}

/** 秒を mm:ss 表記へ整形する。 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
