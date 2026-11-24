"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  NormalizedAnswerItem,
  NormalizedChoiceItem,
  NormalizedGenericItem,
  NormalizedNoulItem,
  NormalizedScoreItem,
  ParsedLayaResponse,
} from "@/lib/laya/types";
import { cn } from "@/lib/utils";

export interface DynamicResponseViewProps {
  parsed: ParsedLayaResponse;
  latencyMs: number;
  modelFallback?: string;
}

const GRID_COLUMNS =
  "grid grid-cols-[18px_minmax(0,1.2fr)_minmax(0,1fr)_92px] items-start gap-x-3";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(maxDecimals)).toString();
}

function formatPercent(probability: number): number {
  return Math.round(clamp01(probability) * 100);
}

function formatConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  if (confidence <= 1 && confidence >= 0) {
    return Math.round(confidence * 100);
  }
  return Math.round(Math.max(0, Math.min(100, confidence)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatJsonCompact(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function RadialPieIcon({
  ratio,
  primary,
}: {
  ratio: number;
  primary: boolean;
}) {
  const clamped = clamp01(ratio);
  const radius = 2.5;
  const circumference = 2 * Math.PI * radius;
  const dashLength = clamped * circumference;
  const strokeColor = primary ? "#2563eb" : "#93c5fd";
  const trackFill = primary ? "#dbeafe" : "#eff6ff";

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle
        cx="6"
        cy="6"
        r="5"
        fill={trackFill}
        stroke={primary ? "#bfdbfe" : "#dbeafe"}
        strokeWidth="0.6"
      />
      {clamped > 0.004 && (
        <circle
          cx="6"
          cy="6"
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth="5"
          strokeDasharray={`${dashLength} ${circumference}`}
          transform="rotate(-90 6 6)"
        />
      )}
    </svg>
  );
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-zinc-200/90 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-zinc-600">
      {label}
    </span>
  );
}

function ConfidenceMeta({
  confidence,
  lowConfidence,
}: {
  confidence?: number;
  lowConfidence?: boolean;
}) {
  if (confidence === undefined && !lowConfidence) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {confidence !== undefined && (
        <span className="text-[11px] text-zinc-500 tabular-nums">
          Confidence: {formatConfidence(confidence)}%
        </span>
      )}
      {lowConfidence === true && (
        <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-700">
          Low confidence
        </span>
      )}
    </div>
  );
}

function ProbabilityBarRow({
  label,
  probability,
  description,
  isHighlighted,
  barColorClass = "bg-blue-600",
}: {
  label: string;
  probability: number;
  description?: string;
  isHighlighted?: boolean;
  barColorClass?: string;
}) {
  const pct = formatPercent(probability);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "min-w-12 max-w-44 truncate font-mono text-[11px]",
            isHighlighted
              ? "font-semibold text-zinc-900"
              : "font-normal text-zinc-600",
          )}
          title={label}
        >
          {label}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200/80">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isHighlighted ? barColorClass : "bg-zinc-400/70",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            "w-9 shrink-0 text-right font-mono text-[11px] tabular-nums",
            isHighlighted
              ? "font-semibold text-zinc-900"
              : "text-zinc-500",
          )}
        >
          {pct}%
        </span>
      </div>
      {description && (
        <p className="pl-0.5 text-[11px] leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
    </div>
  );
}

function StatsSection({ stats }: { stats?: Record<string, unknown> }) {
  if (!stats) return null;
  const entries = Object.entries(stats);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 border-t border-zinc-200/70 pt-2.5">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Stats
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {entries.map(([statKey, statVal]) => (
          <div
            key={statKey}
            className="flex items-baseline justify-between gap-2 rounded bg-white/80 px-2 py-1 ring-1 ring-zinc-200/70"
          >
            <span className="truncate font-mono text-[11px] text-zinc-500">
              {statKey}
            </span>
            <span className="shrink-0 font-mono text-[11px] font-medium text-zinc-800 tabular-nums">
              {typeof statVal === "number"
                ? formatNumber(statVal, 4)
                : typeof statVal === "string" || typeof statVal === "boolean"
                  ? String(statVal)
                  : JSON.stringify(statVal)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreSummary({ item }: { item: NormalizedScoreItem }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">
          {formatNumber(item.score)}
        </span>
        <span className="text-xs text-zinc-400 tabular-nums">
          of {formatNumber(item.maxScore)}
        </span>
      </div>
      <ConfidenceMeta
        confidence={item.confidence}
        lowConfidence={item.lowConfidence}
      />
    </div>
  );
}

function NoulSummary({ item }: { item: NormalizedNoulItem }) {
  const ratio = clamp01(item.noul);
  const pct = Math.round(ratio * 100);
  const dotColor =
    ratio >= 0.6
      ? "bg-emerald-500"
      : ratio >= 0.4
        ? "bg-amber-500"
        : "bg-orange-500";

  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">
          {pct}%
        </span>
        <span className="text-xs text-zinc-400">true</span>
      </div>
      <div className="relative mt-2.5 h-[2px] w-full max-w-[168px] rounded-full bg-zinc-200">
        <div
          className={cn(
            "absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
            dotColor,
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <ConfidenceMeta
        confidence={item.confidence}
        lowConfidence={item.lowConfidence}
      />
    </div>
  );
}

function ChoiceSummary({ item }: { item: NormalizedChoiceItem }) {
  const topOptions =
    item.rankedOptions.length > 0
      ? item.rankedOptions.slice(0, 3)
      : item.choice
        ? [{ label: item.choice, probability: item.confidence ?? 1 }]
        : [];

  return (
    <div className="min-w-0">
      {topOptions.length > 0 ? (
        <div className="space-y-1">
          {topOptions.map((opt, idx) => {
            const isTop = idx === 0;
            const pct = formatPercent(opt.probability);
            return (
              <div
                key={opt.label}
                className="flex items-center justify-between gap-3"
              >
                <span
                  className={cn(
                    "truncate font-mono text-xs",
                    isTop ? "font-medium text-zinc-900" : "text-zinc-400",
                  )}
                  title={opt.label}
                >
                  {opt.label}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isTop ? "font-medium text-zinc-900" : "text-zinc-400",
                    )}
                  >
                    {pct}%
                  </span>
                  <RadialPieIcon ratio={opt.probability} primary={isTop} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="text-xs italic text-zinc-400">No options returned</span>
      )}
      <ConfidenceMeta
        confidence={item.confidence}
        lowConfidence={item.lowConfidence}
      />
    </div>
  );
}

function GenericSummary({ item }: { item: NormalizedGenericItem }) {
  const { value, valueType } = item;

  if (valueType === "boolean") {
    const boolVal = Boolean(value);
    return (
      <span
        className={cn(
          "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium",
          boolVal
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-zinc-200 bg-zinc-100 text-zinc-600",
        )}
      >
        {String(boolVal)}
      </span>
    );
  }

  if (valueType === "number") {
    return (
      <span className="font-mono text-[13px] font-semibold text-zinc-900 tabular-nums">
        {formatNumber(value as number, 4)}
      </span>
    );
  }

  if (valueType === "null") {
    return (
      <span className="font-mono text-xs italic text-zinc-400">null</span>
    );
  }

  if (valueType === "string") {
    const str = String(value);
    const preview = str.length > 90 ? `${str.slice(0, 90)}…` : str;
    return (
      <span className="block truncate font-mono text-xs text-zinc-700" title={str}>
        {preview || '""'}
      </span>
    );
  }

  if (valueType === "array" && Array.isArray(value)) {
    return (
      <span className="font-mono text-xs text-zinc-700 tabular-nums">
        {value.length} {value.length === 1 ? "item" : "items"}
      </span>
    );
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <span className="font-mono text-xs text-zinc-400">{"{}"}</span>;
    }
    const visibleKeys = keys.slice(0, 3).join(", ");
    const extraCount = keys.length - 3;
    return (
      <span className="block truncate font-mono text-xs text-zinc-600">
        {"{ "}
        {visibleKeys}
        {extraCount > 0 ? `, +${extraCount} more` : ""}
        {" }"}
      </span>
    );
  }

  return (
    <span className="font-mono text-xs text-zinc-600">{String(value)}</span>
  );
}

function ScoreExpanded({ item }: { item: NormalizedScoreItem }) {
  const levels = item.probabilities;
  const maxProb =
    levels && levels.length > 0
      ? Math.max(...levels.map((l) => l.probability))
      : 0;

  const fallbackLegendEntries = useMemo(() => {
    const source = item.legend ?? item.criteria;
    if (!source) return [];
    if (Array.isArray(source)) {
      return source.map((desc, idx) => ({
        label: String(item.minScore + idx),
        description: desc,
      }));
    }
    return Object.entries(source).map(([label, description]) => ({
      label,
      description,
    }));
  }, [item.criteria, item.legend, item.minScore]);

  return (
    <div>
      {levels && levels.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Level distribution
          </div>
          {levels.map((level) => (
            <ProbabilityBarRow
              key={level.label}
              label={level.label}
              probability={level.probability}
              description={level.description}
              isHighlighted={level.probability > 0 && level.probability === maxProb}
              barColorClass="bg-zinc-800"
            />
          ))}
        </div>
      ) : fallbackLegendEntries.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Rubric levels
          </div>
          {fallbackLegendEntries.map((entry) => (
            <div key={entry.label} className="flex items-baseline gap-2.5">
              <span className="w-8 shrink-0 font-mono text-[11px] font-medium text-zinc-700">
                {entry.label}
              </span>
              <span className="text-[11px] leading-relaxed text-zinc-600">
                {entry.description}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-zinc-500">
          No per-level probability distribution returned.
        </div>
      )}
      <StatsSection stats={item.stats} />
    </div>
  );
}

function NoulExpanded({ item }: { item: NormalizedNoulItem }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <div className="rounded bg-white/80 px-2.5 py-1.5 ring-1 ring-zinc-200/70">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Raw probability
          </div>
          <div className="mt-0.5 font-mono text-xs font-medium text-zinc-900 tabular-nums">
            {item.noul.toFixed(4)}
          </div>
        </div>
        {item.confidence !== undefined && (
          <div className="rounded bg-white/80 px-2.5 py-1.5 ring-1 ring-zinc-200/70">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Confidence
            </div>
            <div className="mt-0.5 font-mono text-xs font-medium text-zinc-900 tabular-nums">
              {formatConfidence(item.confidence)}% ({item.confidence.toFixed(4)})
            </div>
          </div>
        )}
        {item.lowConfidence !== undefined && (
          <div className="rounded bg-white/80 px-2.5 py-1.5 ring-1 ring-zinc-200/70">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              low_confidence
            </div>
            <div className="mt-0.5 font-mono text-xs font-medium text-zinc-900">
              {String(item.lowConfidence)}
            </div>
          </div>
        )}
      </div>
      <StatsSection stats={item.stats} />
    </div>
  );
}

function ChoiceExpanded({ item }: { item: NormalizedChoiceItem }) {
  return (
    <div>
      {item.rankedOptions.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            All options ({item.rankedOptions.length})
          </div>
          {item.rankedOptions.map((opt, idx) => (
            <ProbabilityBarRow
              key={opt.label}
              label={opt.label}
              probability={opt.probability}
              description={opt.description}
              isHighlighted={idx === 0}
              barColorClass="bg-blue-600"
            />
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-zinc-500">
          No option probabilities returned.
        </div>
      )}
      <StatsSection stats={item.stats} />
    </div>
  );
}

function GenericExpanded({ item }: { item: NormalizedGenericItem }) {
  const { value } = item;

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    const hasNested = entries.some(
      ([, v]) => isPlainObject(v) || Array.isArray(v),
    );
    if (!hasNested && entries.length > 0) {
      return (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-3 rounded bg-white/80 px-2.5 py-1.5 ring-1 ring-zinc-200/70"
            >
              <span className="truncate font-mono text-[11px] text-zinc-500">
                {k}
              </span>
              <span className="truncate font-mono text-[11px] font-medium text-zinc-900">
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-zinc-200/80 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-zinc-800">
      {typeof value === "string" ? value : formatJsonCompact(value)}
    </pre>
  );
}

function renderRightColumn(item: NormalizedAnswerItem) {
  switch (item.kind) {
    case "score":
      return (
        <div className="flex flex-col items-end text-right">
          <TypePill label="Score" />
          <span className="mt-1.5 text-[11px] text-zinc-400 tabular-nums">
            {item.levelCount} {item.levelCount === 1 ? "level" : "levels"} ·{" "}
            {formatNumber(item.minScore)}~{formatNumber(item.maxScore)}
          </span>
        </div>
      );
    case "noul":
      return (
        <div className="flex flex-col items-end text-right">
          <TypePill label="Noul" />
        </div>
      );
    case "choice":
      return (
        <div className="flex flex-col items-end text-right">
          <TypePill label="Choice" />
          <span className="mt-1.5 text-[11px] text-zinc-400 tabular-nums">
            {item.optionCount} {item.optionCount === 1 ? "option" : "options"}
          </span>
        </div>
      );
    case "generic":
      return (
        <div className="flex flex-col items-end text-right">
          <TypePill label={capitalize(item.valueType)} />
        </div>
      );
  }
}

function AnswerRow({
  item,
  open,
  onOpenChange,
}: {
  item: NormalizedAnswerItem;
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-b border-zinc-200/80 bg-white"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            GRID_COLUMNS,
            "w-full px-3 py-3 text-left transition-colors hover:bg-zinc-50/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-300",
          )}
        >
          <span className="flex h-5 w-4 items-center justify-center text-zinc-400">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-150",
                open && "rotate-90 text-zinc-600",
              )}
            />
          </span>

          <div className="min-w-0 pr-2">
            <div
              className="truncate font-mono text-[13px] font-medium leading-5 text-zinc-900"
              title={item.key}
            >
              {item.key}
            </div>
            {item.instructions && (
              <p className="mt-1 text-xs italic leading-relaxed text-zinc-500">
                {item.instructions}
              </p>
            )}
          </div>

          <div className="min-w-0">
            {item.kind === "score" && <ScoreSummary item={item} />}
            {item.kind === "noul" && <NoulSummary item={item} />}
            {item.kind === "choice" && <ChoiceSummary item={item} />}
            {item.kind === "generic" && <GenericSummary item={item} />}
          </div>

          <div className="shrink-0">{renderRightColumn(item)}</div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-zinc-100 bg-zinc-50/70 px-8 py-3 text-xs">
          {item.kind === "score" && <ScoreExpanded item={item} />}
          {item.kind === "noul" && <NoulExpanded item={item} />}
          {item.kind === "choice" && <ChoiceExpanded item={item} />}
          {item.kind === "generic" && <GenericExpanded item={item} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DynamicResponseView({
  parsed,
  latencyMs,
  modelFallback,
}: DynamicResponseViewProps) {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [extraOpen, setExtraOpen] = useState(false);

  const modelLabel = parsed.model || modelFallback;
  const allExpanded =
    parsed.items.length > 0 &&
    parsed.items.every((item) => Boolean(expandedKeys[item.key]));

  const toggleAll = () => {
    if (parsed.items.length === 0) return;
    const nextState = !allExpanded;
    const updated: Record<string, boolean> = {};
    for (const item of parsed.items) {
      updated[item.key] = nextState;
    }
    setExpandedKeys(updated);
  };

  if (parsed.items.length === 0 && parsed.extraFields.length === 0) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center p-6 text-center">
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-5 py-4 text-xs text-zinc-500">
          Response returned an empty object
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      <div
        className={cn(
          GRID_COLUMNS,
          "sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-3 py-2 text-xs text-zinc-400 backdrop-blur-xs",
        )}
      >
        <button
          type="button"
          onClick={toggleAll}
          title={allExpanded ? "Collapse all rows" : "Expand all rows"}
          disabled={parsed.items.length === 0}
          className="flex h-4 w-4 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-40"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
        <span className="font-normal text-zinc-400">Key &amp; instructions</span>
        <span className="truncate font-normal text-zinc-400 tabular-nums">
          {modelLabel ? `${modelLabel} · ${latencyMs} ms` : `${latencyMs} ms`}
        </span>
        <span className="text-right font-normal text-zinc-400">Type</span>
      </div>

      <div>
        {parsed.items.map((item) => (
          <AnswerRow
            key={item.key}
            item={item}
            open={Boolean(expandedKeys[item.key])}
            onOpenChange={(nextOpen) =>
              setExpandedKeys((prev) => ({ ...prev, [item.key]: nextOpen }))
            }
          />
        ))}
      </div>

      {parsed.extraFields.length > 0 && (
        <Collapsible
          open={extraOpen}
          onOpenChange={setExtraOpen}
          className="border-b border-zinc-200/80 bg-zinc-50/40"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-100/60"
            >
              <span className="flex items-center gap-2 font-medium">
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-zinc-400 transition-transform duration-150",
                    extraOpen && "rotate-90 text-zinc-600",
                  )}
                />
                Additional response fields ({parsed.extraFields.length})
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                {parsed.extraFields.map((f) => f.key).join(", ")}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 border-t border-zinc-200/70 bg-zinc-50/70 px-8 py-3">
              {parsed.extraFields.map(({ key, value }) => (
                <div
                  key={key}
                  className="rounded-md border border-zinc-200/80 bg-white px-3 py-2"
                >
                  <div className="mb-1 font-mono text-[11px] font-medium text-zinc-800">
                    {key}
                  </div>
                  {isPlainObject(value) || Array.isArray(value) ? (
                    <pre className="max-h-48 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-600">
                      {formatJsonCompact(value)}
                    </pre>
                  ) : (
                    <div className="font-mono text-xs text-zinc-600">
                      {value === null ? "null" : String(value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
