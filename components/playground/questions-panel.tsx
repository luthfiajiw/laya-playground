"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  insertQuestionTemplate,
  QUESTION_TEMPLATE_CARDS,
} from "@/lib/laya/templates";
import type { QuestionType } from "@/lib/laya/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CodeEditor,
  type CodeEditorDiagnostics,
} from "@/components/playground/code-editor";

export interface QuestionsPanelProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: CodeEditorDiagnostics;
  onDiagnosticsChange: (info: CodeEditorDiagnostics) => void;
  onRunShortcut?: () => void;
}

function isBlankQuestionsValue(val: string): boolean {
  const trimmed = val.trim();
  return trimmed === "" || trimmed === "{}";
}

export function QuestionsPanel({
  value,
  onChange,
  diagnostics,
  onDiagnosticsChange,
  onRunShortcut,
}: QuestionsPanelProps) {
  const [rawTypingOptIn, setRawTypingOptIn] = useState(false);

  const isBlank = isBlankQuestionsValue(value);
  const showTemplatePicker = isBlank && !rawTypingOptIn;

  const effectiveErrorCount = showTemplatePicker ? 0 : diagnostics.errorCount;
  const hasError = effectiveErrorCount > 0;

  const handleInsertTemplate = (type: QuestionType) => {
    try {
      const next = insertQuestionTemplate(value, type);
      setRawTypingOptIn(false);
      onChange(next);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Cannot insert question template"
      );
    }
  };

  const handleFormat = () => {
    if (!value.trim()) return;
    try {
      const parsed: unknown = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Cannot format Questions JSON: ${err.message}`
          : "Cannot format invalid JSON"
      );
    }
  };

  const handleEditorChange = (nextVal: string) => {
    if (!isBlankQuestionsValue(nextVal) && rawTypingOptIn) {
      setRawTypingOptIn(false);
    }
    onChange(nextVal);
  };

  const handleStartRawJson = () => {
    setRawTypingOptIn(true);
    if (!value.trim()) {
      onChange("{\n  \n}");
    }
    onDiagnosticsChange({ errorCount: 0, firstError: undefined });
  };

  return (
    <section className="flex h-full flex-col bg-white">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 px-3">
        <span className="text-xs font-medium text-zinc-600">Questions</span>

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 gap-1 px-1.5 text-[11px] font-normal text-zinc-600 hover:text-zinc-900"
              >
                <Plus className="size-3" />
                <span>Add question</span>
                <ChevronDown className="size-3 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] font-medium text-zinc-500">
                Insert question template
              </DropdownMenuLabel>
              {QUESTION_TEMPLATE_CARDS.map((card) => (
                <DropdownMenuItem
                  key={card.type}
                  onClick={() => handleInsertTemplate(card.type)}
                  className="flex flex-col items-start gap-0.5 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.2 font-mono text-[10.5px] font-medium text-zinc-800">
                      {card.badgeLabel}
                    </span>
                    <span className="text-xs font-medium text-zinc-900">
                      {card.title}
                    </span>
                  </div>
                  <span className="text-[11px] leading-snug text-zinc-500">
                    {card.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleFormat}
            disabled={showTemplatePicker || !value.trim() || hasError}
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
                <span>{effectiveErrorCount}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {hasError
                ? diagnostics.firstError || "Invalid JSON"
                : "No JSON errors"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {showTemplatePicker ? (
          <div className="h-full overflow-y-auto bg-white py-2.5">
            {/* Line 1 gutter + opening brace matching Jev Screenshot 1 */}
            <div className="flex items-center bg-zinc-50/90 pr-3 leading-6">
              <span className="w-[34px] shrink-0 pr-1.5 text-right font-mono text-[11.5px] text-zinc-400 select-none">
                1
              </span>
              <span className="pl-3 font-mono text-[12.5px] text-zinc-500">
                {"{"}
              </span>
            </div>

            <div className="pl-[46px] pr-5 pt-2.5 pb-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs text-zinc-600">
                  Define output type to ask questions
                </p>
                <button
                  type="button"
                  onClick={handleStartRawJson}
                  className="text-[11px] text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-800"
                >
                  or type raw JSON
                </button>
              </div>

              <div className="mt-2.5 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {QUESTION_TEMPLATE_CARDS.map((card) => (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => handleInsertTemplate(card.type)}
                    className="group flex flex-col items-start rounded-md border border-zinc-200/80 bg-zinc-50/70 p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-700 group-hover:border-zinc-300">
                        {card.badgeLabel}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-500">
                        {card.title}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-zinc-800">
                      {card.description}
                    </p>
                    <p className="mt-0.5 text-[11.5px] italic text-zinc-500">
                      {card.examplePrompt}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-2.5 font-mono text-[12.5px] text-zinc-500">
                {"}"}
              </div>
            </div>
          </div>
        ) : (
          <CodeEditor
            value={value}
            onChange={handleEditorChange}
            mode="json"
            placeholder={'{\n  "question_key": {\n    "type": "noul",\n    "instructions": "..."\n  }\n}'}
            onDiagnosticsChange={onDiagnosticsChange}
            onRunShortcut={onRunShortcut}
          />
        )}
      </div>
    </section>
  );
}
