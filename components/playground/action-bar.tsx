"use client";

import { Loader2, Plus } from "lucide-react";
import { QUESTION_TEMPLATE_CARDS } from "@/lib/laya/templates";
import type { QuestionType } from "@/lib/laya/types";
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

export interface ActionBarProps {
  onAddQuestion: (type: QuestionType) => void;
  activeModel?: string;
  isRunning: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onRun: () => void;
  onCancel: () => void;
}

export function ActionBar({
  onAddQuestion,
  activeModel,
  isRunning,
  disabled = false,
  disabledReason,
  onRun,
  onCancel,
}: ActionBarProps) {
  const modelDisplay = activeModel?.trim() || "laya-api";

  const runButton = (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={onRun}
      className="h-8 gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:opacity-100"
    >
      <span>Run request</span>
      <kbd className="font-mono text-[10.5px] font-normal opacity-75">
        Ctrl+↵
      </kbd>
    </Button>
  );

  return (
    <footer className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-zinc-200 bg-white px-2">
      {/* Left group: + quick-add question + active model pill */}
      <div className="flex min-w-0 items-center gap-2">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-zinc-600 hover:text-zinc-900"
                  aria-label="Quick add question"
                >
                  <Plus className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Add question template</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="start" side="top" className="w-60">
            <DropdownMenuLabel className="text-[11px] font-medium text-zinc-500">
              Add question
            </DropdownMenuLabel>
            {QUESTION_TEMPLATE_CARDS.map((card) => (
              <DropdownMenuItem
                key={card.type}
                onClick={() => onAddQuestion(card.type)}
                className="flex items-center gap-2 py-1.5"
              >
                <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.2 font-mono text-[10.5px] font-medium text-zinc-800">
                  {card.badgeLabel}
                </span>
                <span className="truncate text-xs text-zinc-700">
                  {card.title}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-zinc-200" aria-hidden="true" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-44 truncate rounded-md border border-zinc-200/80 bg-zinc-100 px-2 py-0.5 font-mono text-[11.5px] text-zinc-700">
              {modelDisplay}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Active Laya model: {modelDisplay}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Right group: Run request or Running + Cancel */}
      <div className="flex shrink-0 items-center gap-2">
        {isRunning ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin text-zinc-600" />
              <span className="hidden sm:inline">Running...</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-8 border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Cancel
            </Button>
          </>
        ) : disabled && disabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                {runButton}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          runButton
        )}
      </div>
    </footer>
  );
}
