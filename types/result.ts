/**
 * データアクセス層の戻り値。
 * 例外を投げずに「成功データ」または「型付きエラー」を返す。
 */

export type AppErrorKind =
  | "config"
  | "network"
  | "database"
  | "storage"
  | "validation"
  | "not_found"
  | "cancelled"
  | "unknown";

export type AppError = {
  kind: AppErrorKind;
  /** 画面にそのまま出せる短いメッセージ。 */
  message: string;
  /** 追加情報 (Supabase のエラーメッセージなど)。 */
  detail?: string;
  cause?: unknown;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  kind: AppErrorKind,
  message: string,
  detail?: string,
  cause?: unknown,
): Result<T> {
  return { ok: false, error: { kind, message, detail, cause } };
}

/** unknown な例外を AppError へ正規化する。 */
export function toAppError(kind: AppErrorKind, message: string, cause: unknown): AppError {
  if (cause instanceof Error) {
    return { kind, message, detail: cause.message, cause };
  }
  if (typeof cause === "string") {
    return { kind, message, detail: cause, cause };
  }
  return { kind, message, cause };
}

/** Toast などに表示する 1 行のメッセージを組み立てる。 */
export function formatAppError(error: AppError): string {
  return error.detail ? `${error.message}: ${error.detail}` : error.message;
}
