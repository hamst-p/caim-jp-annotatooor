"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pencil } from "lucide-react";

import { EditableTextCell } from "@/components/translation-manager/editable-text-cell";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildReadingSpans,
  getHighlightColor,
  HIGHLIGHT_COLORS,
} from "@/lib/utils/reading-highlight";
import type { HighlightColorId, ReadingHighlight } from "@/types/translation";

type Selection = { start: number; end: number };

/**
 * Reading 列。
 *
 * 通常はドラッグで範囲を選び、パレットで色を付けられる表示モード。
 * テキスト自体の編集は鉛筆ボタン (またはダブルクリック) で切り替える。
 * 単純なクリックで編集へ移ると範囲選択ができなくなるため、
 * Japanese 列とは切り替え方を変えている。
 */
export function ReadingCell({
  id,
  label,
  value,
  placeholder,
  disabled,
  highlights,
  onChange,
  onBlur,
  onApplyColor,
  onClearColors,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  highlights: ReadingHighlight[];
  onChange: (value: string) => void;
  onBlur: () => void;
  onApplyColor: (start: number, end: number, color: HighlightColorId | null) => void;
  onClearColors: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 範囲を選んだあと、セル外をクリックしたらパレットを閉じる。
  useEffect(() => {
    if (!selection) return;

    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      setSelection(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [selection]);

  /** DOM の選択範囲を、Reading テキスト内の文字位置へ変換する。 */
  const readSelection = useCallback(() => {
    const root = rootRef.current;
    const domSelection = window.getSelection();
    if (!root || !domSelection || domSelection.isCollapsed) {
      setSelection(null);
      return;
    }

    const range = domSelection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const anchor = offsetInText(root, range.startContainer, range.startOffset, value.length);
    const focus = offsetInText(root, range.endContainer, range.endOffset, value.length);
    if (anchor === null || focus === null) {
      setSelection(null);
      return;
    }

    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    setSelection(end > start ? { start, end } : null);
  }, [value.length]);

  if (isEditing && !disabled) {
    return (
      <EditableTextCell
        id={id}
        label={label}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        className="font-mono text-sm"
        autoFocus
        onChange={onChange}
        onBlur={() => {
          setIsEditing(false);
          onBlur();
        }}
      />
    );
  }

  const spans = buildReadingSpans(value, highlights);

  return (
    <div ref={rootRef} className="group/reading relative">
      <div
        id={id}
        aria-label={`${label}. Select text to colour it, or double-click to edit.`}
        onMouseUp={readSelection}
        onKeyUp={readSelection}
        onDoubleClick={() => !disabled && setIsEditing(true)}
        className={cn(
          "min-h-16 w-full rounded-md border border-transparent px-2 py-1.5 font-mono text-sm leading-relaxed whitespace-pre-wrap",
          "selection:bg-primary/25",
          disabled && "opacity-60",
        )}
      >
        {value ? (
          spans.map((span) => (
            <span
              key={span.offset}
              data-offset={span.offset}
              className={cn(
                "rounded-sm",
                span.color ? getHighlightColor(span.color)?.background : undefined,
              )}
            >
              {span.text}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground/70">{placeholder}</span>
        )}
      </div>

      {!disabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={`Edit ${label}`}
              className={cn(
                "absolute top-1 right-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                "group-hover/reading:opacity-100",
              )}
            >
              <Pencil className="size-3" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Edit text</TooltipContent>
        </Tooltip>
      )}

      {selection && !disabled && (
        <ColorPalette
          onPick={(color) => {
            onApplyColor(selection.start, selection.end, color);
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      {highlights.length > 0 && !selection && !disabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClearColors}
              aria-label={`Clear all colours in ${label}`}
              className={cn(
                "mt-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[0.7rem] text-muted-foreground opacity-0 transition-opacity",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                "group-hover/reading:opacity-100",
              )}
            >
              <Eraser className="size-3" aria-hidden="true" />
              Clear colours
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove every colour from this reading</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/** 選択範囲へ適用する色を選ぶパレット。 */
function ColorPalette({ onPick }: { onPick: (color: HighlightColorId | null) => void }) {
  return (
    <div
      role="group"
      aria-label="Highlight colour"
      // mousedown で選択が解除されないようにする。
      onMouseDown={(event) => event.preventDefault()}
      className="mt-1.5 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-sm"
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <Tooltip key={color.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onPick(color.id)}
              aria-label={`Highlight in ${color.label}`}
              className={cn(
                "size-5 rounded-full border border-black/10 transition-transform dark:border-white/15",
                "hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                color.swatch,
              )}
            />
          </TooltipTrigger>
          <TooltipContent>{color.label}</TooltipContent>
        </Tooltip>
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label="Remove highlight from selection"
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
            )}
          >
            <Eraser className="size-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Remove colour</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * 選択の端点 (DOM ノード + オフセット) を、テキスト全体での文字位置へ変換する。
 * 各 span に data-offset を持たせてあるので、そこからの相対位置を足すだけでよい。
 */
function offsetInText(
  root: HTMLElement,
  node: Node,
  offset: number,
  textLength: number,
): number | null {
  let element: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);

  while (element && element !== root && element.dataset.offset === undefined) {
    element = element.parentElement;
  }

  if (element?.dataset.offset !== undefined) {
    return Number(element.dataset.offset) + offset;
  }

  // セル全体が選択された場合など、span の外に端点があるケース。
  return offset === 0 ? 0 : textLength;
}
