import { getSupabaseClient, getSupabaseEnv } from "@/lib/supabase/client";
import { sanitizeFileName } from "@/lib/utils/sanitize-file-name";
import { validateAudioFile } from "@/lib/validators/audio";
import { readAudioDuration } from "@/lib/audio/duration";
import { AUDIO_BUCKET } from "@/types/database";
import { fail, ok, toAppError, type Result } from "@/types/result";
import type { AudioMetadata } from "@/types/translation";

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0-100 */
  percent: number;
};

export type UploadAudioOptions = {
  projectId: string;
  rowId: string;
  file: File;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/** `projects/{projectId}/{rowId}/{uuid}-{sanitizedName}` を組み立てる。 */
export function buildAudioStoragePath(
  projectId: string,
  rowId: string,
  fileName: string,
): string {
  const sanitized = sanitizeFileName(fileName);
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `projects/${projectId}/${rowId}/${unique}-${sanitized}`;
}

/**
 * 保存済みの `audio_path` から再生用 URL を生成する。
 * Public Bucket 前提。Private Bucket へ移行する場合は
 * `createSignedAudioUrl` へ差し替えるだけでよい。
 */
export function getAudioUrl(audioPath: string | null | undefined): string | null {
  if (!audioPath) return null;
  try {
    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** 将来 Private Bucket + Auth へ移行するときに使う署名付き URL。 */
export async function createSignedAudioUrl(
  audioPath: string,
  expiresInSeconds = 60 * 60,
): Promise<Result<string>> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(audioPath, expiresInSeconds);

    if (error || !data) {
      return fail("storage", "Failed to create a playback URL", error?.message, error);
    }
    return ok(data.signedUrl);
  } catch (cause) {
    return { ok: false, error: toAppError("storage", "Failed to create a playback URL", cause) };
  }
}

/**
 * 音声をアップロードし、DB へ保存するメタデータを返す。
 *
 * 進捗表示とキャンセルのため、Storage の REST エンドポイントへ XHR で送信する。
 * (supabase-js の `upload()` は進捗イベントと AbortSignal に対応していないため。)
 * 認証情報は Anon Key のみを使用する。
 */
export async function uploadAudio(
  options: UploadAudioOptions,
): Promise<Result<AudioMetadata>> {
  const { projectId, rowId, file, onProgress, signal } = options;

  // 1. 形式チェック / 2. サイズチェック
  const validated = validateAudioFile(file);
  if (!validated.ok) return validated;

  // 3. 音声の長さを取得 (失敗しても null で継続)
  const duration = await readAudioDuration(file);

  if (signal?.aborted) {
    return fail("cancelled", "Upload cancelled");
  }

  // 4. 一意な保存パスを生成
  const storagePath = buildAudioStoragePath(projectId, rowId, file.name);

  // 5. Supabase Storage へアップロード
  const uploaded = await putObject(storagePath, file, onProgress, signal);
  if (!uploaded.ok) return uploaded;

  return ok({
    audio_path: storagePath,
    audio_file_name: file.name,
    audio_size: file.size,
    audio_duration: duration,
  });
}

/**
 * 差し替え。新しいファイルのアップロードが成功した場合のみ、古いファイルを削除する。
 * 古いファイルの削除に失敗しても、新しい音声のメタデータは返す (孤児ファイルは警告のみ)。
 */
export async function replaceAudio(
  options: UploadAudioOptions & { previousPath: string | null },
): Promise<Result<{ metadata: AudioMetadata; previousDeleted: boolean }>> {
  const uploaded = await uploadAudio(options);
  if (!uploaded.ok) return uploaded;

  let previousDeleted = true;
  if (options.previousPath && options.previousPath !== uploaded.data.audio_path) {
    const removed = await deleteAudioFiles([options.previousPath]);
    previousDeleted = removed.ok;
  }

  return ok({ metadata: uploaded.data, previousDeleted });
}

/** Storage から音声を 1 件削除する。 */
export async function deleteAudio(audioPath: string): Promise<Result<true>> {
  return deleteAudioFiles([audioPath]);
}

/** Storage から音声をまとめて削除する。 */
export async function deleteAudioFiles(paths: string[]): Promise<Result<true>> {
  const targets = paths.filter((path) => path.length > 0);
  if (targets.length === 0) return ok(true);

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(targets);
    if (error) {
      return fail("storage", "Failed to delete the audio file", error.message, error);
    }
    return ok(true);
  } catch (cause) {
    return { ok: false, error: toAppError("storage", "Failed to delete the audio file", cause) };
  }
}

/** XHR による PUT。進捗とキャンセルをサポートする。 */
function putObject(
  storagePath: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<Result<true>> {
  let env: { url: string; anonKey: string };
  try {
    env = getSupabaseEnv();
  } catch (cause) {
    return Promise.resolve({
      ok: false,
      error: toAppError("config", "Supabase is not configured", cause),
    });
  }

  if (typeof XMLHttpRequest === "undefined") {
    return uploadWithSupabaseClient(storagePath, file);
  }

  return new Promise<Result<true>>((resolve) => {
    const endpoint = `${env.url.replace(/\/$/, "")}/storage/v1/object/${AUDIO_BUCKET}/${storagePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    const xhr = new XMLHttpRequest();
    let settled = false;

    const settle = (result: Result<true>) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const onAbort = () => {
      xhr.abort();
      settle(fail("cancelled", "Upload cancelled"));
    };

    if (signal) {
      if (signal.aborted) {
        settle(fail("cancelled", "Upload cancelled"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${env.anonKey}`);
    xhr.setRequestHeader("apikey", env.anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("content-type", file.type || "audio/mpeg");

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      const percent = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
      onProgress({ loaded: event.loaded, total, percent });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        settle(ok(true));
        return;
      }
      settle(
        fail(
          "storage",
          "Failed to upload the audio file",
          describeStorageError(xhr.status, xhr.responseText),
        ),
      );
    };

    xhr.onerror = () =>
      settle(
        fail(
          "storage",
          "Failed to upload the audio file",
          "The network request failed. Check the Supabase URL and your connection.",
        ),
      );

    xhr.ontimeout = () =>
      settle(fail("storage", "Failed to upload the audio file", "The request timed out."));

    xhr.onabort = () => settle(fail("cancelled", "Upload cancelled"));

    xhr.send(file);
  });
}

/** XHR が使えない環境向けのフォールバック (進捗・キャンセルなし)。 */
async function uploadWithSupabaseClient(
  storagePath: string,
  file: File,
): Promise<Result<true>> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || "audio/mpeg",
      upsert: false,
    });
    if (error) {
      return fail("storage", "Failed to upload the audio file", error.message, error);
    }
    return ok(true);
  } catch (cause) {
    return { ok: false, error: toAppError("storage", "Failed to upload the audio file", cause) };
  }
}

function describeStorageError(status: number, body: string): string {
  if (status === 404) {
    return `Bucket "${AUDIO_BUCKET}" was not found. Create it in the Supabase dashboard.`;
  }
  if (status === 400 || status === 401 || status === 403) {
    return `HTTP ${status}. Check that the bucket is public and that storage policies allow uploads. ${safeMessage(body)}`;
  }
  if (status === 413) {
    return "The file exceeds the Supabase Storage upload limit.";
  }
  return `HTTP ${status}. ${safeMessage(body)}`;
}

function safeMessage(body: string): string {
  if (!body) return "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    // JSON でなければそのまま扱う
  }
  return body.slice(0, 200);
}
