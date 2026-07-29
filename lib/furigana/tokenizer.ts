import path from "node:path";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";

import {
  alignReading,
  hasKanji,
  katakanaToHiragana,
  mergePlainSegments,
  type FuriganaSegment,
} from "@/lib/furigana/segments";

/**
 * kuromoji の形態素解析器。**サーバー専用**。
 *
 * 辞書は 17MB あるためブラウザへは送らず、API Route 側で 1 度だけ読み込んで
 * プロセス内に保持する (Vercel では next.config.ts の
 * outputFileTracingIncludes で辞書を同梱している)。
 */

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

function getTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (tokenizerPromise) return tokenizerPromise;

  tokenizerPromise = new Promise((resolve, reject) => {
    const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
    kuromoji.builder({ dicPath }).build((error, tokenizer) => {
      if (error) {
        // 次のリクエストで再試行できるようにキャッシュを捨てる。
        tokenizerPromise = null;
        reject(error);
        return;
      }
      resolve(tokenizer);
    });
  });

  return tokenizerPromise;
}

/** 1 文にふりがなを付ける。漢字が無ければ解析せずそのまま返す。 */
export async function annotate(text: string): Promise<FuriganaSegment[]> {
  if (!text) return [];
  if (!hasKanji(text)) return [{ text }];

  const tokenizer = await getTokenizer();
  const segments: FuriganaSegment[] = [];

  for (const token of tokenizer.tokenize(text)) {
    const surface = token.surface_form;
    if (!hasKanji(surface)) {
      segments.push({ text: surface });
      continue;
    }
    const reading =
      token.reading && token.reading !== "*" ? katakanaToHiragana(token.reading) : null;
    segments.push(...alignReading(surface, reading));
  }

  return mergePlainSegments(segments);
}

/** 複数文をまとめて解析する。重複は 1 回だけ処理する。 */
export async function annotateMany(
  texts: string[],
): Promise<Record<string, FuriganaSegment[]>> {
  const unique = [...new Set(texts.filter((text) => text.length > 0))];
  const result: Record<string, FuriganaSegment[]> = {};

  for (const text of unique) {
    result[text] = await annotate(text);
  }

  return result;
}
