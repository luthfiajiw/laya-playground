"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlignJustify,
  Check,
  Code2,
  Copy,
  Layers,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/playground/code-editor";
import { DynamicResponseView } from "@/components/playground/dynamic-response-view";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseLayaResponse } from "@/lib/laya/parser";
import { PRESET_GROUPS } from "@/lib/laya/templates";
import type { RunResult } from "@/lib/laya/types";
import { cn } from "@/lib/utils";

export interface ResponsePanelProps {
  result: RunResult | null;
  isRunning: boolean;
  modelFallback?: string;
  onSelectPreset: (presetId: string) => void;
  onCancel?: () => void;
}

type ViewMode = "dynamic" | "json";

function formatRelativeTime(timestamp: number, now: number): string {
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSeconds < 10) return "Ran just now";
  if (diffSeconds < 60) return `Ran ${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Ran ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Ran ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Ran ${diffDays}d ago`;
}

function extractErrorDetail(rawData: unknown): string | undefined {
  if (rawData === null || rawData === undefined) return undefined;
  if (typeof rawData === "string") {
    return rawData.trim() || undefined;
  }
  if (typeof rawData === "object" && !Array.isArray(rawData)) {
    const obj = rawData as Record<string, unknown>;
    const candidate = obj.detail ?? obj.error ?? obj.message;
    if (typeof candidate === "string") {
      return candidate.trim() || undefined;
    }
    if (candidate !== undefined) {
      try {
        return JSON.stringify(candidate, null, 2);
      } catch {
        return String(candidate);
      }
    }
  }
  return undefined;
}

function formatResultJson(result: RunResult): string {
  if (result.rawData !== undefined) {
    try {
      return JSON.stringify(result.rawData, null, 2);
    } catch {
      return String(result.rawData);
    }
  }
  return JSON.stringify(
    {
      error: result.errorMessage ?? "No response payload",
      ...(result.rawText ? { rawText: result.rawText } : {}),
    },
    null,
    2,
  );
}

export function ResponsePanel({
  result,
  isRunning,
  modelFallback,
  onSelectPreset,
  onCancel,
}: ResponsePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("dynamic");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    if (!result) return;
    const syncTimer = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);
    return () => {
      window.clearTimeout(syncTimer);
      window.clearInterval(timer);
    };
  }, [result]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const parsed = useMemo(() => {
    if (!result || !result.ok) return null;
    return parseLayaResponse(result.rawData, result.sentQuestions);
  }, [result]);

  const formattedJson = useMemo(() => {
    if (!result) return "";
    return formatResultJson(result);
  }, [result]);

  const handleCopyJson = async () => {
    if (!formattedJson) return;
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      toast.success("Response JSON copied to clipboard");
    } catch {
      toast.error("Failed to copy response JSON");
    }
  };

  // Loading state
  if (isRunning) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-200 px-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[13px] font-medium text-zinc-900">
              Response
            </span>
            <span className="text-zinc-300">·</span>
            <span className="inline-flex items-center gap-1.5 text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running Laya inference...
            </span>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onCancel}
              className="text-zinc-600 hover:text-zinc-900"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            <span>Evaluating state against questions...</span>
          </div>
          <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200/80">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="grid grid-cols-[1.2fr_1fr_80px] items-start gap-4 px-4 py-3.5"
              >
                <div className="space-y-2">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-200/80" />
                  <div className="h-3 w-52 animate-pulse rounded bg-zinc-100" />
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-200/80" />
                  <div className="h-2.5 w-28 animate-pulse rounded bg-zinc-100" />
                </div>
                <div className="flex justify-end">
                  <div className="h-5 w-12 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state (matching Jev Screenshot 1)
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
        <div className="flex flex-col items-center">
          <Layers
            className="h-6 w-6 text-zinc-500"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <p className="mt-2.5 text-xs text-zinc-500">
            Run request to see output
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3.5 h-8 rounded-md border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-900 shadow-2xs hover:bg-zinc-50"
              >
                View example requests
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72">
              {PRESET_GROUPS.map((group, groupIndex) => (
                <Fragment key={group.id}>
                  {groupIndex > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[11px] font-medium text-zinc-500">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.presets.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onSelect={() => onSelectPreset(preset.id)}
                        className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-zinc-900">
                            {preset.name}
                          </span>
                          {preset.badge && (
                            <span className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.2 font-mono text-[10px] font-medium text-zinc-700">
                              {preset.badge}
                            </span>
                          )}
                        </div>
                        <span className="line-clamp-2 text-[11px] leading-snug text-zinc-500">
                          {preset.description}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  const relativeTime = formatRelativeTime(
    result.timestamp,
    now || result.timestamp,
  );
  const statusLabel = result.ok
    ? `${result.status} OK`
    : result.status > 0
      ? `${result.status} Error`
      : "Network Error";
  const errorDetail = !result.ok ? extractErrorDetail(result.rawData) : undefined;
  const displayModel = parsed?.model || modelFallback;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[13px] font-medium text-zinc-900">
            Response
          </span>
          <span className="text-zinc-300">·</span>
          <span className="truncate text-xs text-zinc-400">{relativeTime}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-medium leading-none tabular-nums",
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {statusLabel}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums">
            {result.latencyMs} ms
          </span>
        </div>

        {/* Segmented toggle */}
        <div
          role="group"
          aria-label="Response view mode"
          className="flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-200/80 bg-zinc-100/80 p-0.5"
        >
          <button
            type="button"
            onClick={() => setViewMode("dynamic")}
            title="Dynamic view"
            aria-label="Dynamic view"
            aria-pressed={viewMode === "dynamic"}
            className={cn(
              "inline-flex h-6 w-7 items-center justify-center rounded-[4px] transition-all",
              viewMode === "dynamic"
                ? "bg-white text-zinc-900 shadow-2xs"
                : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("json")}
            title="Raw JSON"
            aria-label="Raw JSON"
            aria-pressed={viewMode === "json"}
            className={cn(
              "inline-flex h-6 w-7 items-center justify-center rounded-[4px] transition-all",
              viewMode === "json"
                ? "bg-white text-zinc-900 shadow-2xs"
                : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {viewMode === "dynamic" && !result.ok && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <div className="text-[13px] font-medium text-red-900">
                    {result.status > 0
                      ? `Request failed with HTTP ${result.status}`
                      : "Failed to reach Laya API"}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-red-700/80">
                    {result.targetUrl}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setViewMode("json")}
                className="shrink-0 border-red-200 bg-white text-red-800 hover:bg-red-50"
              >
                <Code2 className="h-3 w-3" />
                Raw JSON
              </Button>
            </div>

            {result.errorMessage && (
              <p className="mt-3 text-xs leading-relaxed text-red-800">
                {result.errorMessage}
              </p>
            )}

            {errorDetail && (
              <div className="mt-3">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-red-700/80">
                  Response detail
                </div>
                <pre className="max-h-64 overflow-auto rounded-md border border-red-200/80 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-zinc-800">
                  {errorDetail}
                </pre>
              </div>
            )}

            {!errorDetail && result.rawText && (
              <div className="mt-3">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-red-700/80">
                  Raw response
                </div>
                <pre className="max-h-64 overflow-auto rounded-md border border-red-200/80 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-zinc-800">
                  {result.rawText}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "dynamic" && result.ok && parsed && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DynamicResponseView
            parsed={parsed}
            latencyMs={result.latencyMs}
            modelFallback={modelFallback}
          />
        </div>
      )}

      {viewMode === "json" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 text-xs">
            <span className="truncate font-mono text-zinc-500">
              {displayModel ?? "JSON output"}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                {result.latencyMs} ms
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleCopyJson}
                className="h-6 border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 hover:bg-zinc-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor mode="json" readOnly={true} value={formattedJson} />
          </div>
        </div>
      )}
    </div>
  );
}
