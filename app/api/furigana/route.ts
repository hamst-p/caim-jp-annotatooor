import { NextResponse } from "next/server";
import { z } from "zod";

import { annotateMany } from "@/lib/furigana/tokenizer";

/**
 * 日本語テキストにふりがな (ルビ) を付けて返す。
 *
 * 形態素解析辞書が 17MB あるためクライアントでは動かさず、ここで処理する。
 * Supabase には触れないので、認証を追加した後もそのまま使える。
 */

// kuromoji はファイルシステムから辞書を読むので Node.js ランタイムが必要。
export const runtime = "nodejs";

const MAX_TEXTS = 200;
const MAX_LENGTH = 5000;

const requestSchema = z.object({
  texts: z.array(z.string().max(MAX_LENGTH)).max(MAX_TEXTS),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const results = await annotateMany(parsed.data.texts);
    return NextResponse.json({ results });
  } catch (cause) {
    console.error("[furigana] tokenizer failed", cause);
    return NextResponse.json(
      { error: "Could not generate furigana on the server." },
      { status: 500 },
    );
  }
}
