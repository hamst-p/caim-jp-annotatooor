"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROW_FILTERS, ROW_FILTER_LABEL } from "@/lib/utils/row-status";
import type { RowFilter } from "@/types/translation";

export function SearchFilters({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  visibleCount,
  totalCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: RowFilter;
  onFilterChange: (value: RowFilter) => void;
  visibleCount: number;
  totalCount: number;
}) {
  const isFiltered = query.trim().length > 0 || filter !== "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search original, japanese, reading, file name"
            aria-label="Search phrases"
            className="pl-8"
          />
          {query.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => onQueryChange("")}
                >
                  <X aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear search</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Select value={filter} onValueChange={(value) => onFilterChange(value as RowFilter)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter phrases">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {ROW_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {ROW_FILTER_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {isFiltered
          ? `Showing ${visibleCount} of ${totalCount} phrases`
          : `${totalCount} phrase${totalCount === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
