/**
 * ふりがな表示用のテキスト分割。
 * 形態素解析には依存しない純粋な関数だけを置く (サーバー / クライアント共用)。
 */

export type FuriganaSegment = {
  /** 元の表記。 */
  text: string;
  /** 漢字部分の読み (ひらがな)。かなだけの部分では undefined。 */
  ruby?: string;
};

const KANJI_PATTERN = /[一-鿿㐀-䶿々〆豈-﫿]/;

export function isKanji(char: string): boolean {
  return KANJI_PATTERN.test(char);
}

export function hasKanji(text: string): boolean {
  return [...text].some(isKanji);
}

/** カタカナ読みをひらがなへ変換する。 */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

type Run = { text: string; kanji: boolean };

/** 表記を「漢字の連続」と「かなの連続」に分ける。 */
function splitRuns(surface: string): Run[] {
  const runs: Run[] = [];
  let buffer = "";
  let bufferIsKanji = false;

  for (const char of surface) {
    const kanji = isKanji(char);
    if (buffer.length === 0) {
      buffer = char;
      bufferIsKanji = kanji;
      continue;
    }
    if (kanji === bufferIsKanji) {
      buffer += char;
    } else {
      runs.push({ text: buffer, kanji: bufferIsKanji });
      buffer = char;
      bufferIsKanji = kanji;
    }
  }

  if (buffer.length > 0) runs.push({ text: buffer, kanji: bufferIsKanji });
  return runs;
}

/**
 * 1 形態素の表記と読みを突き合わせ、漢字部分にだけ読みを割り当てる。
 *
 * 送り仮名を手がかりに位置合わせするので
 * 「引き出し」→ 引(ひ)き出(だ)し、「大人しい」→ 大人(おとな)しい のように分割できる。
 * 位置合わせに失敗した場合は、形態素全体に読みを振ってフォールバックする。
 */
export function alignReading(surface: string, reading: string | null): FuriganaSegment[] {
  if (!surface) return [];
  if (!hasKanji(surface)) return [{ text: surface }];
  if (!reading || reading === surface) return [{ text: surface }];

  const runs = splitRuns(surface);
  const segments: FuriganaSegment[] = [];
  const fallback: FuriganaSegment[] = [{ text: surface, ruby: reading }];
  let cursor = 0;

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];

    if (!run.kanji) {
      // かな部分は読みの中にそのまま現れるはず。
      const at = reading.indexOf(run.text, cursor);
      if (at < 0) return fallback;
      cursor = at + run.text.length;
      segments.push({ text: run.text });
      continue;
    }

    // 次のかな部分が始まる位置までが、この漢字部分の読み。
    const next = runs[index + 1];
    let end: number;
    if (!next) {
      end = reading.length;
    } else {
      const at = reading.indexOf(next.text, cursor + 1);
      if (at < 0) return fallback;
      end = at;
    }

    const ruby = reading.slice(cursor, end);
    if (!ruby) return fallback;
    segments.push({ text: run.text, ruby });
    cursor = end;
  }

  return segments;
}

/** 連続するルビ無しセグメントをまとめて、DOM ノード数を減らす。 */
export function mergePlainSegments(segments: FuriganaSegment[]): FuriganaSegment[] {
  const merged: FuriganaSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (!segment.ruby && previous && !previous.ruby) {
      previous.text += segment.text;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}
