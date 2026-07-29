export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectInsert = {
  name: string;
  description?: string | null;
};

export type ProjectUpdate = {
  name?: string;
  description?: string | null;
};

/** プロジェクトが 1 件も無いときに自動作成する初期プロジェクト名。 */
export const DEFAULT_PROJECT_NAME = "CAIM1 Translation Project";
