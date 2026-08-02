import { VolumeControl } from "@/components/translation-manager/volume-control";

export function PhraseListToolbar({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {/* 音量はプレイヤー共通なので、行ごとではなくここに 1 つだけ置く。 */}
      <VolumeControl className="shrink-0" />
      <p className="text-xs whitespace-nowrap text-muted-foreground" aria-live="polite">
        {totalCount} phrase{totalCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
