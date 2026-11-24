export type StateMode = "text" | "json";

export type QuestionType = "noul" | "score" | "choice";

export interface LayaSettings {
  min_confidence?: string;
  model?: string;
  lang?: string;
  max_len?: string;
  head_max_len?: string;
}

export interface LayaHealthState {
  status: "idle" | "checking" | "healthy" | "unhealthy";
  model?: string;
  loaded?: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt?: number;
}

export interface ScoreProbabilityLevel {
  label: string;
  probability: number;
  description?: string;
}

export interface NormalizedScoreItem {
  kind: "score";
  key: string;
  instructions?: string;
  score: number;
  maxScore: number;
  minScore: number;
  levelCount: number;
  confidence?: number;
  lowConfidence?: boolean;
  probabilities?: ScoreProbabilityLevel[];
  legend?: Record<string, string> | string[];
  criteria?: Record<string, string> | string[];
  stats?: Record<string, unknown>;
  raw: unknown;
}

export interface NormalizedNoulItem {
  kind: "noul";
  key: string;
  instructions?: string;
  noul: number;
  confidence?: number;
  lowConfidence?: boolean;
  stats?: Record<string, unknown>;
  raw: unknown;
}

export interface NormalizedChoiceOption {
  label: string;
  probability: number;
  description?: string;
}

export interface NormalizedChoiceItem {
  kind: "choice";
  key: string;
  instructions?: string;
  choice?: string;
  rankedOptions: NormalizedChoiceOption[];
  optionCount: number;
  confidence?: number;
  lowConfidence?: boolean;
  stats?: Record<string, unknown>;
  raw: unknown;
}

export type GenericValueType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null";

export interface NormalizedGenericItem {
  kind: "generic";
  key: string;
  instructions?: string;
  valueType: GenericValueType;
  value: unknown;
  raw: unknown;
}

export type NormalizedAnswerItem =
  | NormalizedScoreItem
  | NormalizedNoulItem
  | NormalizedChoiceItem
  | NormalizedGenericItem;

export interface ParsedLayaResponse {
  model?: string;
  items: NormalizedAnswerItem[];
  extraFields: Array<{ key: string; value: unknown }>;
}

export interface RunResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  timestamp: number;
  rawData: unknown;
  rawText?: string;
  errorMessage?: string;
  sentQuestions?: unknown;
  targetUrl: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  label: string;
  apiUrl: string;
  stateMode: StateMode;
  stateText: string;
  questionsText: string;
  settings: LayaSettings;
  result: RunResult;
}

export interface PlaygroundWorkspaceState {
  apiUrl: string;
  stateMode: StateMode;
  stateText: string;
  questionsText: string;
  settings: LayaSettings;
  responseViewMode?: "dynamic" | "json";
  activePresetId?: string;
}

export interface ExamplePreset {
  id: string;
  name: string;
  description: string;
  stateMode: StateMode;
  stateText: string;
  questionsText: string;
  settings: LayaSettings;
}

export interface QuestionTemplateCard {
  type: QuestionType;
  title: string;
  badgeLabel: string;
  description: string;
  examplePrompt: string;
  defaultKey: string;
  template: Record<string, unknown>;
}
