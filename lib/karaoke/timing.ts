import type { FuriganaSegment } from "@/lib/furigana/segments";

/**
 * カラオケ表示用のタイミング推定。
 *
 * 音声とテキストの正確な対応 (強制アライメント) は行っていない。
 * 日本語はモーラがほぼ等間隔で発話されるという性質を利用して、
 * 各区切りのモーラ数に比例させて再生時間を按分している。
 * ナレーションのように一定のテンポで読まれる音声ではよく合うが、
 * 長い間や読み上げ速度の変化があるとずれる。
 */

export type Cue = {
  /** 表示するテキスト。 */
  text: string;
  /** 漢字に振るふりがな (Japanese 側のみ)。 */
  ruby?: string;
  /** 再生開始からの秒数。 */
  start: number;
  end: number;
};

/** 拗音の小書き仮名。直前の字と合わせて 1 モーラになる。 */
const SMALL_KANA = /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/g;
const SMALL_KANA_CHAR = /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮー]/;
const ALNUM = /[A-Za-z0-9]/;
const KANA = /[ぁ-んァ-ヶー]/g;

/** かな文字列のモーラ数を数える。 */
export function countMora(kana: string): number {
  const kanaOnly = kana.match(KANA)?.join("") ?? "";
  if (!kanaOnly) return 0;
  const small = kanaOnly.match(SMALL_KANA)?.length ?? 0;
  return Math.max(0, kanaOnly.length - small);
}

/**
 * 区切りの「長さの重み」。
 * かなが無い区切り (英字・数字など) は文字数で代用する。
 */
function weightOf(reading: string, text: string): number {
  const mora = countMora(reading);
  if (mora > 0) return mora;

  // 記号だけの区切りは、句読点として少しだけ間を取る。
  const meaningful = text.replace(/[\s、。，．「」『』（）()!?！？…・]/g, "");
  if (!meaningful) return text.length > 0 ? 0.5 : 0;

  return Math.max(1, meaningful.length);
}

/**
 * かな列を 1 モーラずつに割る。
 * 小書き仮名と長音符は直前の字にくっつけ、英数字は 1 語にまとめる。
 */
function splitIntoMora(text: string): string[] {
  const chunks: string[] = [];

  for (const char of text) {
    const previous = chunks[chunks.length - 1];

    if (previous && SMALL_KANA_CHAR.test(char)) {
      chunks[chunks.length - 1] = previous + char;
      continue;
    }
    if (previous && ALNUM.test(char) && ALNUM.test(previous[previous.length - 1])) {
      chunks[chunks.length - 1] = previous + char;
      continue;
    }
    chunks.push(char);
  }

  return chunks;
}

/**
 * 漢字の区切りはそのまま、かなの区切りはモーラ単位へ細かく割る。
 * 区切りが長いと highlight が 1 秒以上止まって見えるため。
 */
function explodeForKaraoke(segments: FuriganaSegment[]): FuriganaSegment[] {
  const exploded: FuriganaSegment[] = [];

  for (const segment of segments) {
    if (segment.ruby) {
      // 漢字とその読みは対応が崩れるので分割しない。
      exploded.push(segment);
      continue;
    }
    for (const chunk of splitIntoMora(segment.text)) {
      exploded.push({ text: chunk });
    }
  }

  return exploded;
}

/** 重みの配列を、合計が duration になるよう開始・終了秒へ変換する。 */
function distribute<T>(
  items: T[],
  weights: number[],
  duration: number,
): (T & { start: number; end: number })[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || duration <= 0) {
    return items.map((item) => ({ ...item, start: 0, end: 0 }));
  }

  let elapsed = 0;
  return items.map((item, index) => {
    const start = (elapsed / total) * duration;
    elapsed += weights[index];
    const end = (elapsed / total) * duration;
    return { ...item, start, end };
  });
}

/**
 * Japanese 列のふりがな区切りから Cue を作る。
 * ふりがな未取得のときは 1 つの Cue として扱う。
 */
export function buildJapaneseCues(
  text: string,
  segments: FuriganaSegment[] | null,
  duration: number,
): Cue[] {
  if (!text) return [];

  const source = explodeForKaraoke(
    segments && segments.length > 0 ? segments : [{ text }],
  );

  const weights = source.map((segment) => weightOf(segment.ruby ?? segment.text, segment.text));
  return distribute(source, weights, duration).map((cue) => ({
    text: cue.text,
    ruby: cue.ruby,
    start: cue.start,
    end: cue.end,
  }));
}

/**
 * Reading 列 (ローマ字) を単語単位で Cue にする。
 * 重みは母音の数 + 単独の n で、日本語のモーラ数に近似させる。
 */
export function buildReadingCues(reading: string, duration: number): Cue[] {
  if (!reading.trim()) return [];

  // 空白を含めて分割し、単語と空白を交互に保持する (表示時に原文をそのまま再現できる)。
  const parts = reading.split(/(\s+)/).filter((part) => part.length > 0);
  const weights = parts.map((part) => (/^\s+$/.test(part) ? 0 : romajiWeight(part)));

  return distribute(
    parts.map((part) => ({ text: part })),
    weights,
    duration,
  );
}

function romajiWeight(word: string): number {
  const lower = word.toLowerCase();
  const vowels = lower.match(/[aeiou]/g)?.length ?? 0;
  // 母音を伴わない撥音 (…n) も 1 モーラ数える。
  const finalN = /[^aeiou]n\b/.test(lower) ? 1 : 0;
  const weight = vowels + finalN;
  if (weight > 0) return weight;

  const meaningful = lower.replace(/[^a-z0-9]/g, "");
  return meaningful.length > 0 ? meaningful.length : 0.5;
}

/** 現在の再生位置に対応する Cue の位置を返す。 */
export function findActiveCueIndex(cues: Cue[], time: number): number {
  if (cues.length === 0) return -1;
  for (let index = 0; index < cues.length; index += 1) {
    if (time < cues[index].end) return index;
  }
  return cues.length - 1;
}

/** Cue 内での進捗 (0-1)。ワイプ表現に使う。 */
export function cueProgress(cue: Cue, time: number): number {
  const span = cue.end - cue.start;
  if (span <= 0) return time >= cue.end ? 1 : 0;
  return Math.min(1, Math.max(0, (time - cue.start) / span));
}
