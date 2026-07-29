"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { MAX_CELL_LENGTH } from "@/lib/validators/translation-row";

/** 内容に合わせて高さが伸びるテキストエリア。 */
export function EditableTextCell({
  id,
  label,
  value,
  placeholder,
  disabled,
  invalid,
  className,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  invalid?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [resize, value]);

  // 列幅が変わると折り返し位置も変わるため、要素サイズの変化に追従する。
  useEffect(() => {
    // 自分自身ではなく親を監視する (自分を監視すると高さ変更で再帰する)。
    const container = textareaRef.current?.parentElement;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      rows={1}
      maxLength={MAX_CELL_LENGTH}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => {
        onChange(event.target.value);
        resize();
      }}
      onBlur={onBlur}
      className={cn(
        "block min-h-16 w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm leading-relaxed",
        "placeholder:text-muted-foreground/70",
        "hover:border-border focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/40 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        invalid && "border-destructive/60",
        className,
      )}
    />
  );
}
