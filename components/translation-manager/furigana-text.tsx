import { Fragment } from "react";

import type { FuriganaSegment } from "@/lib/furigana/segments";

/**
 * 漢字の上にふりがなを小さく表示する。
 * segments が未取得 (null) のあいだは、素のテキストをそのまま表示する。
 */
export function FuriganaText({
  text,
  segments,
}: {
  text: string;
  segments: FuriganaSegment[] | null;
}) {
  if (!segments || segments.length === 0) return <>{text}</>;

  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={`${index}-${segment.text}`}>
          {segment.ruby ? (
            <ruby>
              {segment.text}
              {/* ルビ非対応ブラウザでは括弧付きで表示される */}
              <rp>(</rp>
              <rt>{segment.ruby}</rt>
              <rp>)</rp>
            </ruby>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </>
  );
}
