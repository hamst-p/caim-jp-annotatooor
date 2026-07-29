"use client";

import { useState } from "react";
import { FolderOpen, Loader2, Pencil, Trash2 } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Project } from "@/types/project";

export function ProjectSelector({
  projects,
  selectedProjectId,
  isLoading,
  isMutating,
  onSelect,
  onEdit,
  onDelete,
}: {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  isMutating: boolean;
  onSelect: (projectId: string) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selected = projects.find((project) => project.id === selectedProjectId) ?? null;

  if (isLoading && projects.length === 0) {
    return <Skeleton className="h-8 w-56" />;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
    setConfirmOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

      <Select
        value={selectedProjectId ?? undefined}
        onValueChange={onSelect}
        disabled={projects.length === 0}
      >
        <SelectTrigger className="w-44 sm:w-56" aria-label="Select project">
          <SelectValue placeholder="No project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            disabled={!selected || isMutating}
            aria-label="Rename current project"
          >
            <Pencil aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Rename project</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={!selected || isMutating}
            aria-label="Delete current project"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete project</TooltipContent>
      </Tooltip>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{selected?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Every phrase in this project will be deleted, and all of its MP3 files will be
              removed from Supabase Storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
