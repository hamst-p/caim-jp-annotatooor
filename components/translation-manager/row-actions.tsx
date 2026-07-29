"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TranslationRow } from "@/types/translation";

export function RowActions({
  row,
  rowNumber,
  canMoveUp,
  canMoveDown,
  disabled,
  onAddBelow,
  onDuplicate,
  onDelete,
  onMove,
}: {
  row: TranslationRow;
  rowNumber: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onAddBelow: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (direction: "up" | "down") => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
    setConfirmOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
                aria-label={`Actions for row ${rowNumber}`}
              >
                <MoreVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Row actions</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => void onAddBelow()}>
            <Plus aria-hidden="true" />
            Add below
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void onDuplicate()}>
            <Copy aria-hidden="true" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canMoveUp} onSelect={() => void onMove("up")}>
            <ArrowUp aria-hidden="true" />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveDown} onSelect={() => void onMove("down")}>
            <ArrowDown aria-hidden="true" />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete row {rowNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              {row.audio_path
                ? "This phrase and its MP3 file will be permanently deleted."
                : "This phrase will be permanently deleted."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Delete row
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
