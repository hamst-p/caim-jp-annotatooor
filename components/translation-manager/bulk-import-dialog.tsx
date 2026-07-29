"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseBulkImport } from "@/lib/validators/translation-row";

export type BulkImportEntry = {
  original: string;
  japanese: string;
  reading: string;
};

const PLACEHOLDER_ORIGINAL = `Today, artificial intelligence can generate almost anything.
How do we know what is actually real?`;

const PLACEHOLDER_JAPANESE = `現在、人工知能はほとんど何でも作り出せます。
何が本物なのかを、どう判断すればよいのでしょうか？`;

const PLACEHOLDER_READING = `Genzai, jinkou chinou wa hotondo nandemo tsukuridasemasu.
Nani ga honmono nano ka o, dou handan sureba yoi no deshou ka?`;

export function BulkImportDialog({
  open,
  isSubmitting,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (entries: BulkImportEntry[]) => Promise<void>;
}) {
  const [original, setOriginal] = useState("");
  const [japanese, setJapanese] = useState("");
  const [reading, setReading] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  // 親が開くたびに key を変えて再マウントするため、閉じたときのリセット処理は不要。

  const parsed = useMemo(
    () => parseBulkImport(original, japanese, reading),
    [original, japanese, reading],
  );

  const entries = useMemo<BulkImportEntry[]>(() => {
    const rows: BulkImportEntry[] = [];
    for (let index = 0; index < parsed.lineCount; index += 1) {
      rows.push({
        original: parsed.originals[index] ?? "",
        japanese: parsed.japaneses[index] ?? "",
        reading: parsed.readings[index] ?? "",
      });
    }
    return rows;
  }, [parsed]);

  const canImport = entries.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-4xl">
        <DialogHeader className="pb-2">
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>
            Paste one sentence or phrase per line. Line 1 of each box becomes row 1, line 2
            becomes row 2, and so on. Blank lines are allowed and create empty cells.
          </DialogDescription>
        </DialogHeader>

        {/* 本文だけをスクロールさせ、ヘッダーとフッターは常に見える状態にする。 */}
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
        <div className="grid gap-4 py-4 lg:grid-cols-3">
          <BulkField
            id="bulk-original"
            label="Original"
            count={parsed.counts.original}
            value={original}
            placeholder={PLACEHOLDER_ORIGINAL}
            onChange={setOriginal}
          />
          <BulkField
            id="bulk-japanese"
            label="Japanese"
            count={parsed.counts.japanese}
            value={japanese}
            placeholder={PLACEHOLDER_JAPANESE}
            onChange={setJapanese}
          />
          <BulkField
            id="bulk-reading"
            label="Reading"
            count={parsed.counts.reading}
            value={reading}
            placeholder={PLACEHOLDER_READING}
            onChange={setReading}
          />
        </div>

        {parsed.mismatched && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Line counts do not match</AlertTitle>
            <AlertDescription>
              Original: {parsed.counts.original}, Japanese: {parsed.counts.japanese}, Reading:{" "}
              {parsed.counts.reading}. Missing lines will be imported as empty cells.
            </AlertDescription>
          </Alert>
        )}

        {showPreview && entries.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-12 px-3 py-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Original
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Japanese
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Reading
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index} className="border-t align-top">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2">{entry.original || <Empty />}</td>
                    <td className="px-3 py-2">{entry.japanese || <Empty />}</td>
                    <td className="px-3 py-2">{entry.reading || <Empty />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        </div>

        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowPreview((current) => !current)}
            disabled={entries.length === 0}
          >
            {showPreview ? "Hide preview" : `Preview ${entries.length} row(s)`}
          </Button>
          <Button
            onClick={() => {
              if (!showPreview) {
                setShowPreview(true);
                return;
              }
              void onImport(entries);
            }}
            disabled={!canImport}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            Import {entries.length > 0 ? `${entries.length} row(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkField({
  id,
  label,
  count,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  count: number;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{count} line(s)</span>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={10}
        className="font-mono text-xs leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}

function Empty() {
  return <span className="text-muted-foreground italic">(empty)</span>;
}
