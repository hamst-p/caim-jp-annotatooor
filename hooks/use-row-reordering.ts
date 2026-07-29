"use client";

import { useCallback, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function useRowReordering(options: {
  onReorder: (activeId: string, overId: string) => Promise<boolean>;
  disabled: boolean;
}) {
  const { onReorder, disabled } = options;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // クリックとドラッグを区別する。
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (disabled || !over || active.id === over.id) return;

      setIsSaving(true);
      await onReorder(String(active.id), String(over.id));
      setIsSaving(false);
    },
    [disabled, onReorder],
  );

  return {
    sensors,
    activeId,
    isSaving,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
