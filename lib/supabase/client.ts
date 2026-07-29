import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { fail, ok, toAppError, type Result } from "@/types/result";

/**
 * ブラウザから利用する Supabase クライアント。
 *
 * - Anon Key のみを使用する (Service Role Key は絶対にクライアントへ渡さない)。
 * - モジュールスコープで throw するとページ全体が真っ白になるため、
 *   生成は遅延させ、未設定時は `isSupabaseConfigured()` で判定できるようにしている。
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export class MissingSupabaseEnvError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Supabase environment variables are missing: ${missing.join(", ")}. ` +
        "Create .env.local from .env.local.example and restart the dev server.",
    );
    this.name = "MissingSupabaseEnvError";
    this.missing = missing;
  }
}

/** 未設定の環境変数名を返す。すべて揃っていれば空配列。 */
export function getMissingSupabaseEnvKeys(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return getMissingSupabaseEnvKeys().length === 0;
}

/** Storage への直接アップロード (XHR) 用に URL / Anon Key を取り出す。 */
export function getSupabaseEnv(): SupabaseEnv {
  const missing = getMissingSupabaseEnvKeys();
  if (missing.length > 0 || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new MissingSupabaseEnvError(missing);
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * シングルトンの Supabase クライアントを返す。
 * 環境変数が無い場合は `MissingSupabaseEnvError` を投げる。
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseEnv();
  cachedClient = createClient<Database>(url, anonKey, {
    auth: {
      // 認証機能を使わないため、セッション永続化は行わない。
      // 将来 Supabase Auth を導入する際は persistSession: true へ変更する。
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cachedClient;
}

/**
 * 接続確認。プロジェクトテーブルへ 1 件だけ問い合わせる。
 * RLS 有効 + ポリシー未設定でも 200 が返るため、通信可否の確認に使う。
 */
export async function checkSupabaseConnection(): Promise<Result<true>> {
  const missing = getMissingSupabaseEnvKeys();
  if (missing.length > 0) {
    return fail(
      "config",
      "Supabase environment variables are missing",
      missing.join(", "),
    );
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("projects")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      return fail("network", "Could not reach Supabase", error.message, error);
    }
    return ok(true);
  } catch (cause) {
    return { ok: false, error: toAppError("network", "Could not reach Supabase", cause) };
  }
}
