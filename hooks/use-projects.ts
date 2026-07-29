"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "@/lib/supabase/projects";
import { DEFAULT_PROJECT_NAME, type Project } from "@/types/project";
import { formatAppError, type AppError } from "@/types/result";
import type { LoadState } from "@/types/translation";

/** 翻訳データではなく「最後に選んだプロジェクト ID」だけを localStorage に保存する。 */
const SELECTED_PROJECT_STORAGE_KEY = "tam:selected-project-id";

function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredProjectId(projectId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (projectId) {
      window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
    } else {
      window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
    }
  } catch {
    // プライベートブラウジングなどで失敗しても機能は継続する
  }
}

export type UseProjectsResult = {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  status: LoadState;
  error: AppError | null;
  selectProject: (projectId: string) => void;
  refresh: () => Promise<void>;
  addProject: (name: string, description: string) => Promise<Project | null>;
  renameProject: (
    projectId: string,
    name: string,
    description: string,
  ) => Promise<Project | null>;
  removeProject: (projectId: string) => Promise<boolean>;
  isMutating: boolean;
};

export function useProjects(enabled: boolean): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // 読み込み状態は state から導出する (effect 内で同期的に setState しない)。
  const status: LoadState = !enabled
    ? "idle"
    : error
      ? "error"
      : !hasLoaded
        ? "loading"
        : isRefreshing
          ? "refreshing"
          : "loaded";

  const mountedRef = useRef(true);
  const bootstrappingRef = useRef(false);
  const projectsRef = useRef<Project[]>([]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!enabled) return;
      if (mode === "refresh") setIsRefreshing(true);

      const result = await getProjects();
      if (!mountedRef.current) return;

      if (!result.ok) {
        setIsRefreshing(false);
        setError(result.error);
        return;
      }

      let list = result.data;

      // プロジェクトが 1 件も無ければ初期プロジェクトを作成する。
      if (list.length === 0 && !bootstrappingRef.current) {
        bootstrappingRef.current = true;
        const created = await createProject({ name: DEFAULT_PROJECT_NAME });
        bootstrappingRef.current = false;
        if (!mountedRef.current) return;

        if (created.ok) {
          list = [created.data];
          toast.success(`Created "${DEFAULT_PROJECT_NAME}"`);
        } else {
          setIsRefreshing(false);
          setError(created.error);
          return;
        }
      }

      setError(null);
      setIsRefreshing(false);
      setProjects(list);
      setHasLoaded(true);

      setSelectedProjectId((current) => {
        const stored = current ?? readStoredProjectId();
        const exists = stored && list.some((project) => project.id === stored);
        const next = exists ? stored : (list[0]?.id ?? null);
        if (next !== stored) writeStoredProjectId(next);
        return next;
      });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    // マウント時のデータ取得。set-state-in-effect は「setState を含む関数の呼び出し」を
    // 一律に警告するが、ここは外部システム (Supabase) から取得した結果を state へ
    // 反映するための意図的な副作用。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("initial");
  }, [enabled, load]);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    writeStoredProjectId(projectId);
  }, []);

  const refresh = useCallback(async () => {
    await load("refresh");
  }, [load]);

  const addProject = useCallback(async (name: string, description: string) => {
    setIsMutating(true);
    const result = await createProject({ name, description });
    if (!mountedRef.current) return null;
    setIsMutating(false);

    if (!result.ok) {
      toast.error(formatAppError(result.error));
      return null;
    }

    setProjects((current) => [...current, result.data]);
    setSelectedProjectId(result.data.id);
    writeStoredProjectId(result.data.id);
    toast.success(`Project "${result.data.name}" created`);
    return result.data;
  }, []);

  const renameProject = useCallback(
    async (projectId: string, name: string, description: string) => {
      setIsMutating(true);
      const result = await updateProject(projectId, { name, description });
      if (!mountedRef.current) return null;
      setIsMutating(false);

      if (!result.ok) {
        toast.error(formatAppError(result.error));
        return null;
      }

      setProjects((current) =>
        current.map((project) => (project.id === projectId ? result.data : project)),
      );
      toast.success("Project updated");
      return result.data;
    },
    [],
  );

  const removeProject = useCallback(async (projectId: string) => {
    setIsMutating(true);
    const result = await deleteProject(projectId);
    if (!mountedRef.current) return false;
    setIsMutating(false);

    if (!result.ok) {
      toast.error(formatAppError(result.error));
      return false;
    }

    const remaining = projectsRef.current.filter((project) => project.id !== projectId);
    const nextSelected = remaining[0]?.id ?? null;

    setProjects(remaining);
    setSelectedProjectId((current) => {
      if (current !== projectId) return current;
      writeStoredProjectId(nextSelected);
      return nextSelected;
    });

    toast.success(
      result.data.deletedAudio > 0
        ? `Project deleted (${result.data.deletedAudio} audio file(s) removed)`
        : "Project deleted",
    );
    return true;
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  return {
    projects,
    selectedProjectId,
    selectedProject,
    status,
    error,
    selectProject,
    refresh,
    addProject,
    renameProject,
    removeProject,
    isMutating,
  };
}
