"use client";

import { useState } from "react";
import { Clock, History, Trash2 } from "lucide-react";
import type { HistoryEntry } from "@/lib/laya/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface HistoryPopoverProps {
  entries: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

const MAX_VISIBLE_ENTRIES = 15;

function formatRelativeTime(timestamp: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function extractModelName(entry: HistoryEntry): string | undefined {
  const raw = entry.result.rawData;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (typeof record.model === "string" && record.model.trim()) {
      return record.model.trim();
    }
    if (
      record.response &&
      typeof record.response === "object" &&
      !Array.isArray(record.response)
    ) {
      const resp = record.response as Record<string, unknown>;
      if (typeof resp.model === "string" && resp.model.trim()) {
        return resp.model.trim();
      }
    }
  }
  if (entry.settings.model?.trim()) {
    return entry.settings.model.trim();
  }
  return undefined;
}

function summarizeQuestionKeys(questionsText: string): string {
  try {
    const parsed: unknown = JSON.parse(questionsText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length === 0) return "No questions";
      if (keys.length <= 3) return keys.join(", ");
      return `${keys.slice(0, 3).join(", ")} +${keys.length - 3}`;
    }
    if (Array.isArray(parsed)) {
      return `${parsed.length} question${parsed.length === 1 ? "" : "s"}`;
    }
  } catch {
    // Ignore parse failures for historical snapshots
  }
  return "Custom questions";
}

export function HistoryPopover({
  entries,
  onSelectEntry,
  onClearHistory,
}: HistoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number>(0);

  const visibleEntries = entries.slice(0, MAX_VISIBLE_ENTRIES);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNow(Date.now());
    }
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative h-7 gap-1.5 px-2 text-xs text-zinc-600 hover:text-zinc-900"
              aria-label="Request history"
            >
              <History className="size-3.5" />
              <span className="hidden sm:inline">History</span>
              {entries.length > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-100 px-1 font-mono text-[10px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                  {Math.min(entries.length, MAX_VISIBLE_ENTRIES)}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Recent request history</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-84 p-0">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-900">
              Run history
            </span>
            {visibleEntries.length > 0 && (
              <span className="font-mono text-[11px] text-zinc-400">
                ({visibleEntries.length})
              </span>
            )}
          </div>
          {visibleEntries.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 gap-1 px-1.5 text-[11px] text-zinc-500 hover:text-red-600"
              onClick={() => {
                onClearHistory();
                setOpen(false);
              }}
            >
              <Trash2 className="size-3" />
              Clear history
            </Button>
          )}
        </div>

        {visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
            <Clock className="size-5 text-zinc-300" />
            <p className="text-xs font-medium text-zinc-700">No runs yet</p>
            <p className="text-[11px] text-zinc-400">
              Executed requests will be saved here (up to {MAX_VISIBLE_ENTRIES}).
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-zinc-100">
              {visibleEntries.map((entry) => {
                const modelName = extractModelName(entry);
                const keysSummary = summarizeQuestionKeys(entry.questionsText);
                const statusCode = entry.result.status;
                const isOk = entry.result.ok;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      onSelectEntry(entry);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded border px-1.5 py-0.2 font-mono text-[10px] font-medium",
                            isOk
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {statusCode > 0 ? statusCode : "ERR"}
                        </span>
                        <span className="truncate text-xs font-medium text-zinc-900">
                          {entry.label || keysSummary}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                        {formatRelativeTime(
                          entry.timestamp,
                          now || entry.timestamp
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span className="truncate font-mono text-[11px] text-zinc-500">
                        {keysSummary}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {modelName && (
                          <span className="max-w-24 truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                            {modelName}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-zinc-500">
                          {entry.result.latencyMs} ms
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
