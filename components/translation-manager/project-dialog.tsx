"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  projectDescriptionSchema,
  projectNameSchema,
} from "@/lib/validators/translation-row";
import type { Project } from "@/types/project";

export type ProjectDialogMode = "create" | "edit";

export function ProjectDialog({
  open,
  mode,
  project,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: ProjectDialogMode;
  project: Project | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}) {
  // 親が開くたびに key を変えて再マウントするため、初期値はマウント時に確定する。
  const [name, setName] = useState(() => (mode === "edit" ? (project?.name ?? "") : ""));
  const [description, setDescription] = useState(() =>
    mode === "edit" ? (project?.description ?? "") : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedName = projectNameSchema.safeParse(name);
    if (!parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? "Invalid project name.");
      return;
    }
    const parsedDescription = projectDescriptionSchema.safeParse(description);
    if (!parsedDescription.success) {
      setError(parsedDescription.error.issues[0]?.message ?? "Invalid description.");
      return;
    }

    setError(null);
    await onSubmit(parsedName.data, parsedDescription.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New project" : "Rename project"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Phrases belong to a project. Create one project per script or episode."
                : "Update the project name and description."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="CAIM1 Translation Project"
                autoFocus
                required
                aria-invalid={error !== null}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Narration script for the CAIM1 video"
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {mode === "create" ? "Create project" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
