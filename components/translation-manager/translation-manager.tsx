"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, FolderPlus, Plus, RefreshCw, Upload } from "lucide-react";

import { AudioPlayerProvider } from "@/components/translation-manager/audio-player-provider";
import {
  BulkImportDialog,
  type BulkImportEntry,
} from "@/components/translation-manager/bulk-import-dialog";
import { ConnectionStatus } from "@/components/translation-manager/connection-status";
import { MissingEnvNotice } from "@/components/translation-manager/missing-env-notice";
import {
  ProjectDialog,
  type ProjectDialogMode,
} from "@/components/translation-manager/project-dialog";
import { ProjectSelector } from "@/components/translation-manager/project-selector";
import { SaveStatus } from "@/components/translation-manager/save-status";
import { SearchFilters } from "@/components/translation-manager/search-filters";
import { SummaryCards } from "@/components/translation-manager/summary-cards";
import { ThemeToggle } from "@/components/translation-manager/theme-toggle";
import { TranslationTable } from "@/components/translation-manager/translation-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjects } from "@/hooks/use-projects";
import { useFurigana } from "@/hooks/use-furigana";
import { useRowAutosave } from "@/hooks/use-row-autosave";
import { useTranslationRows } from "@/hooks/use-translation-rows";
import { getMissingSupabaseEnvKeys } from "@/lib/supabase/client";
import { matchesFilter, matchesQuery, summarizeRows } from "@/lib/utils/row-status";
import type {
  EditableField,
  RowFilter,
  TranslationRow,
} from "@/types/translation";

export function TranslationManager() {
  const missingEnv = getMissingSupabaseEnvKeys();
  if (missingEnv.length > 0) {
    return <MissingEnvNotice missing={missingEnv} />;
  }
  return (
    <AudioPlayerProvider>
      <ManagerBody />
    </AudioPlayerProvider>
  );
}

function ManagerBody() {
  const projects = useProjects(true);
  const rowsApi = useTranslationRows(projects.selectedProjectId, true);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<ProjectDialogMode>("create");
  const [bulkOpen, setBulkOpen] = useState(false);
  // ダイアログを開くたびに key を進めて再マウントし、入力内容をリセットする。
  const [dialogInstance, setDialogInstance] = useState(0);

  const openProjectDialog = useCallback((mode: ProjectDialogMode) => {
    setProjectDialogMode(mode);
    setDialogInstance((current) => current + 1);
    setProjectDialogOpen(true);
  }, []);

  const openBulkDialog = useCallback(() => {
    setDialogInstance((current) => current + 1);
    setBulkOpen(true);
  }, []);

  const handleSaved = useCallback(
    (rowId: string, row: TranslationRow) => rowsApi.patchRow(rowId, row),
    [rowsApi],
  );

  const autosave = useRowAutosave({ onSaved: handleSaved });

  // 未保存の下書きを反映した「表示上の行」。検索・フィルター・集計はこれを使う。
  const effectiveRows = useMemo(
    () => rowsApi.rows.map((row) => ({ ...row, ...autosave.getDraft(row) })),
    [rowsApi.rows, autosave],
  );

  const visibleRows = useMemo(
    () =>
      effectiveRows.filter((row) => matchesFilter(row, filter) && matchesQuery(row, query)),
    [effectiveRows, filter, query],
  );

  const summary = useMemo(() => summarizeRows(effectiveRows), [effectiveRows]);

  // Japanese 列のふりがな。表示中の文言をまとめて 1 リクエストで取得する。
  const japaneseTexts = useMemo(
    () => effectiveRows.map((row) => row.japanese),
    [effectiveRows],
  );
  const furigana = useFurigana(japaneseTexts);

  const allRowIds = useMemo(() => rowsApi.rows.map((row) => row.id), [rowsApi.rows]);
  const isFiltered = query.trim().length > 0 || filter !== "all";

  const handleDeleteRow = useCallback(
    async (row: TranslationRow) => {
      const deleted = await rowsApi.removeRow(row);
      if (deleted) autosave.discardRow(row.id);
    },
    [autosave, rowsApi],
  );

  const handleProjectSubmit = useCallback(
    async (name: string, description: string) => {
      const result =
        projectDialogMode === "create"
          ? await projects.addProject(name, description)
          : projects.selectedProjectId
            ? await projects.renameProject(projects.selectedProjectId, name, description)
            : null;
      if (result) setProjectDialogOpen(false);
    },
    [projectDialogMode, projects],
  );

  const handleBulkImport = useCallback(
    async (entries: BulkImportEntry[]) => {
      const inserted = await rowsApi.bulkInsertRows(entries);
      if (inserted) setBulkOpen(false);
    },
    [rowsApi],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([projects.refresh(), rowsApi.refresh()]);
  }, [projects, rowsApi]);

  const isBusy = rowsApi.isMutating || projects.isMutating;
  const noProject = projects.status === "loaded" && projects.projects.length === 0;

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="z-40 shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="flex w-full flex-col gap-3 px-3 py-3 sm:px-4 xl:flex-row xl:items-center xl:gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-base font-semibold whitespace-nowrap">
              Translation Audio Manager
            </h1>
            <div className="ml-auto flex items-center gap-2 xl:hidden">
              <ConnectionStatus />
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ProjectSelector
              projects={projects.projects}
              selectedProjectId={projects.selectedProjectId}
              isLoading={projects.status === "loading"}
              isMutating={projects.isMutating}
              onSelect={projects.selectProject}
              onEdit={() => openProjectDialog("edit")}
              onDelete={async () => {
                if (!projects.selectedProjectId) return;
                await projects.removeProject(projects.selectedProjectId);
              }}
            />

            <HeaderButton
              label="New Project"
              tooltip="Create a new project"
              icon={<FolderPlus aria-hidden="true" />}
              onClick={() => openProjectDialog("create")}
              disabled={projects.isMutating}
            />
            <HeaderButton
              label="Add Phrase"
              tooltip="Append an empty row"
              icon={<Plus aria-hidden="true" />}
              onClick={() => void rowsApi.addPhrase()}
              disabled={!projects.selectedProjectId || isBusy}
            />
            <HeaderButton
              label="Bulk Import"
              tooltip="Paste multiple lines at once"
              icon={<Upload aria-hidden="true" />}
              onClick={openBulkDialog}
              disabled={!projects.selectedProjectId || isBusy}
            />
            <HeaderButton
              label="Refresh"
              tooltip="Reload projects and phrases from Supabase"
              icon={
                <RefreshCw
                  className={rowsApi.status === "refreshing" ? "animate-spin" : undefined}
                  aria-hidden="true"
                />
              }
              onClick={() => void handleRefresh()}
              disabled={rowsApi.status === "refreshing"}
            />
          </div>

          <div className="hidden items-center gap-2 xl:ml-auto xl:flex">
            <SaveStatus
              state={autosave.globalState}
              savingRowCount={autosave.savingRowCount}
              failedRowCount={autosave.failedRowIds.length}
            />
            <ConnectionStatus />
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 xl:hidden">
            <SaveStatus
              state={autosave.globalState}
              savingRowCount={autosave.savingRowCount}
              failedRowCount={autosave.failedRowIds.length}
            />
          </div>
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        <SummaryCards counts={summary} isLoading={rowsApi.status === "loading"} />

        {projects.status === "error" && projects.error && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>{projects.error.message}</AlertTitle>
            <AlertDescription>
              <p>{projects.error.detail ?? "Check the Supabase URL and anon key."}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void projects.refresh()}>
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {noProject ? (
          <Alert>
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>No project selected</AlertTitle>
            <AlertDescription>
              Create a project to start adding phrases.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <SearchFilters
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              visibleCount={visibleRows.length}
              totalCount={effectiveRows.length}
            />

            <TranslationTable
              rows={visibleRows}
              allRowIds={allRowIds}
              status={rowsApi.status}
              error={rowsApi.error}
              lockedRowIds={rowsApi.lockedRowIds}
              moveDisabled={isFiltered}
              isFiltered={isFiltered}
              getDraft={autosave.getDraft}
              getFurigana={furigana.getSegments}
              getSaveState={autosave.getState}
              getSaveError={autosave.getError}
              onFieldChange={(row: TranslationRow, field: EditableField, value: string) =>
                autosave.setValue(row, field, value)
              }
              onFieldBlur={autosave.flush}
              onRetrySave={autosave.retry}
              onRowUpdated={rowsApi.patchRow}
              onAddBelow={async (row) => {
                await rowsApi.addRowBelow(row);
              }}
              onDuplicate={async (row) => {
                await rowsApi.duplicateRow(row);
              }}
              onDelete={handleDeleteRow}
              onMove={async (row, direction) => {
                await rowsApi.moveRow(row.id, direction);
              }}
              onRetryLoad={() => void rowsApi.refresh()}
              onAddPhrase={() => void rowsApi.addPhrase()}
            />
          </>
        )}
      </main>

      <ProjectDialog
        key={`project-dialog-${dialogInstance}`}
        open={projectDialogOpen}
        mode={projectDialogMode}
        project={projects.selectedProject}
        isSubmitting={projects.isMutating}
        onOpenChange={setProjectDialogOpen}
        onSubmit={handleProjectSubmit}
      />

      <BulkImportDialog
        key={`bulk-dialog-${dialogInstance}`}
        open={bulkOpen}
        isSubmitting={rowsApi.isMutating}
        onOpenChange={setBulkOpen}
        onImport={handleBulkImport}
      />
    </div>
  );
}

function HeaderButton({
  label,
  tooltip,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={onClick} disabled={disabled} aria-label={label}>
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
