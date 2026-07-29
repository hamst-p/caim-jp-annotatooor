import { z } from "zod";

import { fail, ok, type Result } from "@/types/result";

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_AUDIO_MB = 20;

export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mpeg3",
  "audio/x-mpeg-3",
] as const;

export const AUDIO_ACCEPT_ATTRIBUTE = ".mp3,audio/mpeg";

/** MP3 かどうか。ブラウザが MIME を付けない場合があるため拡張子も見る。 */
export function isMp3File(file: File): boolean {
  const byMime = (ACCEPTED_AUDIO_MIME_TYPES as readonly string[]).includes(
    file.type.toLowerCase(),
  );
  const byExtension = file.name.toLowerCase().endsWith(".mp3");
  return byMime || byExtension;
}

export const audioFileSchema = z
  .custom<File>((value) => typeof File !== "undefined" && value instanceof File, {
    message: "No file was provided.",
  })
  .refine((file) => file.size > 0, {
    message: "The file is empty.",
  })
  .refine(isMp3File, {
    message: "Only MP3 files can be uploaded.",
  })
  .refine((file) => file.size <= MAX_AUDIO_BYTES, {
    message: `The file is larger than ${MAX_AUDIO_MB}MB.`,
  });

/** アップロード前のファイル検証。UI から直接呼べるよう Result で返す。 */
export function validateAudioFile(file: File): Result<File> {
  const parsed = audioFileSchema.safeParse(file);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "This file cannot be uploaded.";
    return fail("validation", message, file.name);
  }
  return ok(parsed.data);
}
