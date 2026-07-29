import { getSupabaseClient } from "@/lib/supabase/client";
import { deleteAudioFiles } from "@/lib/supabase/storage";
import { projectDescriptionSchema, projectNameSchema } from "@/lib/validators/translation-row";
import type { Project, ProjectInsert, ProjectUpdate } from "@/types/project";
import { fail, ok, toAppError, type Result } from "@/types/result";

/** プロジェクト一覧を作成日の新しい順で取得する。 */
export async function getProjects(): Promise<Result<Project[]>> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return fail("database", "Failed to load projects", error.message, error);
    }
    return ok(data ?? []);
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to load projects", cause) };
  }
}

export async function createProject(input: ProjectInsert): Promise<Result<Project>> {
  const name = projectNameSchema.safeParse(input.name);
  if (!name.success) {
    return fail("validation", name.error.issues[0]?.message ?? "Invalid project name.");
  }

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    const parsed = projectDescriptionSchema.safeParse(input.description);
    if (!parsed.success) {
      return fail("validation", parsed.error.issues[0]?.message ?? "Invalid description.");
    }
    description = parsed.data.length > 0 ? parsed.data : null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: name.data, description })
      .select()
      .single();

    if (error) {
      return fail("database", "Failed to create the project", error.message, error);
    }
    return ok(data);
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to create the project", cause) };
  }
}

export async function updateProject(
  projectId: string,
  input: ProjectUpdate,
): Promise<Result<Project>> {
  const payload: ProjectUpdate = {};

  if (input.name !== undefined) {
    const name = projectNameSchema.safeParse(input.name);
    if (!name.success) {
      return fail("validation", name.error.issues[0]?.message ?? "Invalid project name.");
    }
    payload.name = name.data;
  }

  if (input.description !== undefined) {
    if (input.description === null) {
      payload.description = null;
    } else {
      const parsed = projectDescriptionSchema.safeParse(input.description);
      if (!parsed.success) {
        return fail("validation", parsed.error.issues[0]?.message ?? "Invalid description.");
      }
      payload.description = parsed.data.length > 0 ? parsed.data : null;
    }
  }

  if (Object.keys(payload).length === 0) {
    return fail("validation", "There is nothing to update.");
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      return fail("database", "Failed to update the project", error.message, error);
    }
    return ok(data);
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to update the project", cause) };
  }
}

/**
 * プロジェクトを削除する。
 *
 * translation_rows は FK の ON DELETE CASCADE で消えるが、Storage は連動しないため
 * 先に音声ファイルを列挙して削除する。
 */
export async function deleteProject(projectId: string): Promise<Result<{ deletedAudio: number }>> {
  try {
    const supabase = getSupabaseClient();

    const { data: rows, error: rowsError } = await supabase
      .from("translation_rows")
      .select("audio_path")
      .eq("project_id", projectId)
      .not("audio_path", "is", null);

    if (rowsError) {
      return fail(
        "database",
        "Failed to list the audio files for this project",
        rowsError.message,
        rowsError,
      );
    }

    const paths = (rows ?? [])
      .map((row) => row.audio_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    if (paths.length > 0) {
      const removed = await deleteAudioFiles(paths);
      if (!removed.ok) return removed;
    }

    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      return fail("database", "Failed to delete the project", error.message, error);
    }

    return ok({ deletedAudio: paths.length });
  } catch (cause) {
    return { ok: false, error: toAppError("database", "Failed to delete the project", cause) };
  }
}
