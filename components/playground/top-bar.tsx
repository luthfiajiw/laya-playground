"use client";

import {
  Check,
  ChevronDown,
  FlaskConical,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import { EXAMPLE_PRESETS } from "@/lib/laya/templates";
import type {
  HistoryEntry,
  LayaHealthState,
  LayaSettings,
} from "@/lib/laya/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HistoryPopover } from "@/components/playground/history-popover";

export interface TopBarProps {
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  health: LayaHealthState;
  onCheckHealth: () => void;
  activePresetId?: string;
  onSelectPreset: (presetId: string | null) => void;
  history: HistoryEntry[];
  onSelectHistoryEntry: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
  onCopyCurl: () => void;
  onClear: () => void;
  settings: LayaSettings;
  onSettingsChange: (settings: LayaSettings) => void;
  onResetSettings: () => void;
}

const SETTING_KEYS: Array<keyof LayaSettings> = [
  "min_confidence",
  "model",
  "lang",
  "max_len",
  "head_max_len",
];

function getHealthVisuals(health: LayaHealthState): {
  dotClass: string;
  tooltip: string;
} {
  if (health.status === "checking") {
    return {
      dotClass: "bg-amber-400 animate-pulse",
      tooltip: "Checking /health...",
    };
  }
  if (health.status === "healthy") {
    const isLoaded = health.loaded !== false;
    const modelLabel = health.model?.trim() || "Model";
    const latencySuffix =
      typeof health.latencyMs === "number" ? ` · ${health.latencyMs} ms` : "";
    return {
      dotClass: isLoaded ? "bg-emerald-500" : "bg-amber-500",
      tooltip: `${modelLabel} (${isLoaded ? "loaded" : "not loaded"})${latencySuffix} — Click to re-check`,
    };
  }
  if (health.status === "unhealthy") {
    return {
      dotClass: "bg-red-500",
      tooltip: `${health.error || "API unreachable"} — Click to retry`,
    };
  }
  return {
    dotClass: "bg-zinc-300",
    tooltip: "Click to check /health",
  };
}

export function TopBar({
  apiUrl,
  onApiUrlChange,
  health,
  onCheckHealth,
  activePresetId,
  onSelectPreset,
  history,
  onSelectHistoryEntry,
  onClearHistory,
  onCopyCurl,
  onClear,
  settings,
  onSettingsChange,
  onResetSettings,
}: TopBarProps) {
  const activePreset = EXAMPLE_PRESETS.find((p) => p.id === activePresetId);
  const presetLabel = activePreset
    ? activePreset.name
    : activePresetId === "blank"
      ? "Blank"
      : "Custom";

  const activeSettingsCount = SETTING_KEYS.filter((key) =>
    Boolean(settings[key]?.trim())
  ).length;

  const healthVisuals = getHealthVisuals(health);

  const updateSetting = (key: keyof LayaSettings, value: string) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3">
      {/* Left group: Brand + Preset Switcher */}
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex shrink-0 items-center gap-1.5 text-zinc-900">
          <FlaskConical className="size-4 text-zinc-700" />
          <span className="text-[13px] font-medium tracking-tight">
            Laya Playground
          </span>
        </div>

        <span className="text-xs text-zinc-300">/</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 max-w-48 gap-1 px-2 text-xs font-normal text-zinc-700 hover:text-zinc-900"
            >
              <span className="truncate">{presetLabel}</span>
              <ChevronDown className="size-3 shrink-0 text-zinc-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-[11px] font-medium text-zinc-500">
              Example presets
            </DropdownMenuLabel>
            {EXAMPLE_PRESETS.map((preset) => {
              const isSelected = preset.id === activePresetId;
              return (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => onSelectPreset(preset.id)}
                  className="flex items-start justify-between gap-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-zinc-900">
                      {preset.name}
                    </div>
                    <div className="line-clamp-2 text-[11px] leading-snug text-zinc-500">
                      {preset.description}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-zinc-700" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onSelectPreset(null)}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <div>
                <div className="text-xs font-medium text-zinc-900">
                  Blank (template picker)
                </div>
                <div className="text-[11px] text-zinc-500">
                  Start empty with question type cards
                </div>
              </div>
              {activePresetId === "blank" && (
                <Check className="size-3.5 shrink-0 text-zinc-700" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right group: API Base URL + Health dot + History + Copy cURL + Clear + Settings */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="relative flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCheckHealth}
                aria-label="Check Laya API health"
                className="absolute left-1.5 z-10 flex size-4 items-center justify-center rounded-full hover:bg-zinc-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    healthVisuals.dotClass
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{healthVisuals.tooltip}</TooltipContent>
          </Tooltip>

          <Input
            type="url"
            value={apiUrl}
            onChange={(e) => onApiUrlChange(e.target.value)}
            placeholder="http://localhost:8000"
            aria-label="Laya API Base URL"
            className="h-7 w-80 rounded-md border-zinc-200 bg-zinc-50/70 pl-6.5 pr-2 font-mono text-[11.5px] text-zinc-800 placeholder:text-zinc-400 focus-visible:bg-white"
          />
        </div>

        <HistoryPopover
          entries={history}
          onSelectEntry={onSelectHistoryEntry}
          onClearHistory={onClearHistory}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCopyCurl}
              className="h-7 gap-1 px-2 text-xs text-zinc-600 hover:text-zinc-900"
              aria-label="Copy cURL"
            >
              <Terminal className="size-3.5" />
              <span className="hidden md:inline">Copy cURL</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Copy request as cURL</TooltipContent>
        </Tooltip>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-xs text-zinc-600 hover:text-zinc-900"
        >
          Clear
        </Button>

        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative h-7 w-7 text-zinc-600 hover:text-zinc-900"
                  aria-label="Request settings"
                >
                  <SlidersHorizontal className="size-3.5" />
                  {activeSettingsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-zinc-900 px-1 font-mono text-[9px] font-medium text-white">
                      {activeSettingsCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Request settings</TooltipContent>
          </Tooltip>

          <PopoverContent align="end" className="w-80 p-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <div>
                <h3 className="text-xs font-medium text-zinc-900">
                  Request Settings
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Optional PredictRequest parameters. Empty fields are omitted.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onResetSettings}
                disabled={activeSettingsCount === 0}
                className="h-6 gap-1 px-1.5 text-[11px] text-zinc-500 hover:text-zinc-900"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </div>

            <div className="grid gap-2.5 pt-2">
              <div className="grid gap-1">
                <Label
                  htmlFor="laya-setting-min-confidence"
                  className="font-mono text-[11px] text-zinc-700"
                >
                  min_confidence
                </Label>
                <Input
                  id="laya-setting-min-confidence"
                  value={settings.min_confidence ?? ""}
                  onChange={(e) =>
                    updateSetting("min_confidence", e.target.value)
                  }
                  placeholder='0.85 or {"key": 0.9}'
                  className="h-7 font-mono text-xs"
                />
                <p className="text-[10.5px] text-zinc-400">
                  Float (0–1) or JSON map per question key
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label
                    htmlFor="laya-setting-model"
                    className="font-mono text-[11px] text-zinc-700"
                  >
                    model
                  </Label>
                  <Input
                    id="laya-setting-model"
                    value={settings.model ?? ""}
                    onChange={(e) => updateSetting("model", e.target.value)}
                    placeholder="multilingual"
                    className="h-7 font-mono text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="laya-setting-lang"
                    className="font-mono text-[11px] text-zinc-700"
                  >
                    lang
                  </Label>
                  <Input
                    id="laya-setting-lang"
                    value={settings.lang ?? ""}
                    onChange={(e) => updateSetting("lang", e.target.value)}
                    placeholder="en / id"
                    className="h-7 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label
                    htmlFor="laya-setting-max-len"
                    className="font-mono text-[11px] text-zinc-700"
                  >
                    max_len
                  </Label>
                  <Input
                    id="laya-setting-max-len"
                    type="number"
                    min={1}
                    value={settings.max_len ?? ""}
                    onChange={(e) => updateSetting("max_len", e.target.value)}
                    placeholder="512"
                    className="h-7 font-mono text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="laya-setting-head-max-len"
                    className="font-mono text-[11px] text-zinc-700"
                  >
                    head_max_len
                  </Label>
                  <Input
                    id="laya-setting-head-max-len"
                    type="number"
                    min={1}
                    value={settings.head_max_len ?? ""}
                    onChange={(e) =>
                      updateSetting("head_max_len", e.target.value)
                    }
                    placeholder="128"
                    className="h-7 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
