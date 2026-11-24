"use client";

import { AlertCircle, AlignLeft, Code2 } from "lucide-react";
import { toast } from "sonner";
import type { StateMode } from "@/lib/laya/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CodeEditor,
  type CodeEditorDiagnostics,
} from "@/components/playground/code-editor";

export interface StatePanelProps {
  value: string;
  onChange: (value: string) => void;
  mode: StateMode;
  onModeChange: (mode: StateMode) => void;
  diagnostics: CodeEditorDiagnostics;
  onDiagnosticsChange: (info: CodeEditorDiagnostics) => void;
  onRunShortcut?: () => void;
}

export function StatePanel({
  value,
  onChange,
  mode,
  onModeChange,
  diagnostics,
  onDiagnosticsChange,
  onRunShortcut,
}: StatePanelProps) {
  const handleFormat = () => {
    if (!value.trim()) return;
    try {
      const parsed: unknown = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Cannot format State JSON: ${err.message}`
          : "Cannot format invalid JSON"
      );
    }
  };

  const hasError = mode === "json" && diagnostics.errorCount > 0;

  return (
    <section className="flex h-full flex-col bg-white">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 px-3">
        <span className="text-xs font-medium text-zinc-600">State</span>

        <div className="flex items-center gap-2">
          {mode === "json" && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleFormat}
                disabled={!value.trim() || hasError}
                className="h-6 px-1.5 text-[11px] font-normal text-zinc-500 hover:text-zinc-900"
              >
                Format
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[11px] select-none",
                      hasError
                        ? "border border-red-200 bg-red-50 text-red-600"
                        : "text-zinc-400"
                    )}
                  >
                    <AlertCircle className="size-3" />
                    <span>{diagnostics.errorCount}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {hasError
                    ? diagnostics.firstError || "Invalid JSON"
                    : "No JSON errors"}
                </TooltipContent>
              </Tooltip>
            </>
          )}

          <div
            className="inline-flex items-center rounded-md border border-zinc-200/90 bg-zinc-100/80 p-0.5"
            role="group"
            aria-label="State editor mode"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onModeChange("text")}
                  aria-pressed={mode === "text"}
                  aria-label="Plain Text mode"
                  className={cn(
                    "inline-flex h-5.5 w-6 items-center justify-center rounded-[4px] transition-colors",
                    mode === "text"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  <AlignLeft className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Plain Text</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onModeChange("json")}
                  aria-pressed={mode === "json"}
                  aria-label="JSON mode"
                  className={cn(
                    "inline-flex h-5.5 w-6 items-center justify-center rounded-[4px] transition-colors",
                    mode === "json"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  <Code2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">JSON</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeEditor
          value={value}
          onChange={onChange}
          mode={mode}
          placeholder={
            mode === "text"
              ? "Enter text or context for Laya to evaluate..."
              : '{\n  "text": "Enter JSON context for Laya to evaluate..."\n}'
          }
          onDiagnosticsChange={onDiagnosticsChange}
          onRunShortcut={onRunShortcut}
        />
      </div>
    </section>
  );
}
