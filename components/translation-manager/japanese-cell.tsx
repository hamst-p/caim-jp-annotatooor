"use client";

import { useState } from "react";

import { EditableTextCell } from "@/components/translation-manager/editable-text-cell";
import { FuriganaText } from "@/components/translation-manager/furigana-text";
import { cn } from "@/lib/utils";
import type { FuriganaSegment } from "@/lib/furigana/segments";

/**
 * Japanese 列。
 *
 * textarea の中には <ruby> を描画できないため、
 * 「通常はふりがな付きの表示、クリック / フォーカスで編集」に切り替える。
 */
export function JapaneseCell({
  id,
  label,
  value,
  placeholder,
  disabled,
  segments,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  segments: FuriganaSegment[] | null;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing && !disabled) {
    return (
      <EditableTextCell
        id={id}
        label={label}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus
        onChange={onChange}
        onBlur={() => {
          setIsEditing(false);
          onBlur();
        }}
      />
    );
  }

  return (
    <div
      id={id}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label}. Press Enter to edit.`}
      aria-disabled={disabled}
      onClick={() => !disabled && setIsEditing(true)}
      onFocus={() => !disabled && setIsEditing(true)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
      className={cn(
        "block min-h-16 w-full cursor-text rounded-md border border-transparent px-2 py-1.5 text-sm whitespace-pre-wrap",
        // ルビのぶん行間を広げ、ふりがなは小さく淡く表示する。
        "leading-[2.1] [&_rt]:text-[0.55em] [&_rt]:font-normal [&_rt]:text-muted-foreground",
        "hover:border-border",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {value ? (
        <FuriganaText text={value} segments={segments} />
      ) : (
        <span className="text-muted-foreground/70">{placeholder}</span>
      )}
    </div>
  );
}
