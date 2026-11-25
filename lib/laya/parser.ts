import type {
  GenericValueType,
  NormalizedAnswerItem,
  NormalizedChoiceItem,
  NormalizedChoiceOption,
  NormalizedGenericItem,
  NormalizedNoulItem,
  NormalizedScoreItem,
  ParsedLayaResponse,
  ScoreProbabilityLevel,
} from "./types";

interface QuestionMetadata {
  type?: string;
  instructions?: string;
  criteria?: Record<string, string> | string[];
  optionCount?: number;
  levelCount?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function inferValueType(value: unknown): GenericValueType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "object";
  }
}

function extractCriteria(
  rawCriteria: unknown
): Record<string, string> | string[] | undefined {
  if (Array.isArray(rawCriteria)) {
    return rawCriteria.map((item) =>
      typeof item === "string" ? item : JSON.stringify(item)
    );
  }
  if (isPlainObject(rawCriteria)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawCriteria)) {
      out[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return out;
  }
  return undefined;
}

function indexSentQuestions(
  sentQuestions: unknown
): Map<string, QuestionMetadata> {
  const map = new Map<string, QuestionMetadata>();
  if (!sentQuestions) return map;

  const extractMeta = (raw: Record<string, unknown>): QuestionMetadata => {
    const type = typeof raw.type === "string" ? raw.type : undefined;
    const instructions =
      typeof raw.instructions === "string" ? raw.instructions : undefined;
    const criteria = extractCriteria(raw.criteria);
    const optionsSource = isPlainObject(raw.criteria)
      ? Object.keys(raw.criteria).length
      : Array.isArray(raw.criteria)
        ? raw.criteria.length
        : Array.isArray(raw.options)
          ? raw.options.length
          : Array.isArray(raw.choices)
            ? raw.choices.length
            : undefined;
    const levelSource = Array.isArray(raw.criteria)
      ? raw.criteria.length
      : isPlainObject(raw.criteria)
        ? Object.keys(raw.criteria).length
        : undefined;

    return {
      type,
      instructions,
      criteria,
      optionCount: optionsSource,
      levelCount: levelSource,
    };
  };

  if (isPlainObject(sentQuestions)) {
    for (const [key, value] of Object.entries(sentQuestions)) {
      if (isPlainObject(value)) {
        map.set(key, extractMeta(value));
      } else if (typeof value === "string") {
        map.set(key, { instructions: value });
      }
    }
  } else if (Array.isArray(sentQuestions)) {
    sentQuestions.forEach((entry, index) => {
      if (!isPlainObject(entry)) return;
      const key =
        typeof entry.key === "string"
          ? entry.key
          : typeof entry.name === "string"
            ? entry.name
            : typeof entry.id === "string"
              ? entry.id
              : String(index);
      map.set(key, extractMeta(entry));
    });
  }

  return map;
}

function getChoiceDescription(
  collection: Record<string, string> | string[] | undefined,
  label: string
): string | undefined {
  if (!collection || Array.isArray(collection)) return undefined;
  return collection[label];
}

function getDescriptionFromCollection(
  collection: Record<string, string> | string[] | undefined,
  label: string,
  index: number
): string | undefined {
  if (!collection) return undefined;
  if (Array.isArray(collection)) {
    const numericIdx = Number(label);
    if (Number.isInteger(numericIdx) && numericIdx >= 0 && numericIdx < collection.length) {
      return collection[numericIdx];
    }
    if (index >= 0 && index < collection.length) {
      return collection[index];
    }
    return undefined;
  }
  return collection[label];
}

function normalizeScoreItem(
  key: string,
  obj: Record<string, unknown>,
  meta?: QuestionMetadata
): NormalizedScoreItem {
  const score = toOptionalNumber(obj.score) ?? 0;
  const confidence = toOptionalNumber(obj.confidence);
  const lowConfidence = toOptionalBoolean(
    obj.low_confidence ?? obj.lowConfidence
  );
  const stats = isPlainObject(obj.stats) ? obj.stats : undefined;
  const legend = extractCriteria(obj.legend);
  const criteria = meta?.criteria;

  const rawProbs = obj.probabilities ?? obj.probs ?? obj.distribution;
  let probabilities: ScoreProbabilityLevel[] | undefined;

  if (Array.isArray(rawProbs)) {
    const numericProbs = rawProbs.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    );
    if (numericProbs.length > 0) {
      const explicitMin = toOptionalNumber(obj.min_score ?? obj.minScore);
      const startIndex = explicitMin !== undefined ? explicitMin : 0;
      probabilities = numericProbs.map((probability, idx) => {
        const label = String(startIndex + idx);
        return {
          label,
          probability,
          description:
            getDescriptionFromCollection(legend, label, idx) ??
            getDescriptionFromCollection(criteria, label, idx),
        };
      });
    }
  } else if (isPlainObject(rawProbs)) {
    const entries = Object.entries(rawProbs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort(([a], [b]) => {
        const numA = Number(a);
        const numB = Number(b);
        if (Number.isFinite(numA) && Number.isFinite(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    if (entries.length > 0) {
      probabilities = entries.map(([label, prob], idx) => ({
        label,
        probability: prob as number,
        description:
          getDescriptionFromCollection(legend, label, idx) ??
          getDescriptionFromCollection(criteria, label, idx),
      }));
    }
  }

  const explicitMin = toOptionalNumber(obj.min_score ?? obj.minScore);
  const explicitMax = toOptionalNumber(
    obj.max_score ?? obj.maxScore ?? obj.max
  );

  let minScore = explicitMin ?? 0;
  let maxScore = explicitMax ?? 0;
  let levelCount = meta?.levelCount ?? 0;

  if (probabilities && probabilities.length > 0) {
    levelCount = probabilities.length;
    const numericLabels = probabilities
      .map((p) => Number(p.label))
      .filter((n) => Number.isFinite(n));
    if (numericLabels.length === probabilities.length) {
      if (explicitMin === undefined) minScore = Math.min(...numericLabels);
      if (explicitMax === undefined) maxScore = Math.max(...numericLabels);
    } else {
      if (explicitMin === undefined) minScore = 0;
      if (explicitMax === undefined) maxScore = Math.max(levelCount - 1, 1);
    }
  } else {
    if (isPlainObject(criteria)) {
      const numericKeys = Object.keys(criteria)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      if (numericKeys.length > 0) {
        if (explicitMin === undefined) minScore = Math.min(...numericKeys);
        if (explicitMax === undefined) maxScore = Math.max(...numericKeys);
        levelCount = Object.keys(criteria).length;
      }
    } else if (Array.isArray(criteria) && criteria.length > 0) {
      levelCount = criteria.length;
      if (explicitMin === undefined) minScore = 0;
      if (explicitMax === undefined) {
        maxScore = Math.max(criteria.length - 1, Math.ceil(score), 1);
      }
    }
  }

  if (explicitMax === undefined && maxScore <= minScore) {
    maxScore = Math.max(5, Math.ceil(score));
  }
  if (levelCount <= 0) {
    levelCount = Math.max(1, Math.round(maxScore - minScore) + 1);
  }

  return {
    kind: "score",
    key,
    instructions: meta?.instructions ?? (typeof obj.instructions === "string" ? obj.instructions : undefined),
    score,
    minScore,
    maxScore,
    levelCount,
    confidence,
    lowConfidence,
    probabilities,
    legend,
    criteria,
    stats,
    raw: obj,
  };
}

function normalizeNoulItem(
  key: string,
  obj: Record<string, unknown>,
  meta?: QuestionMetadata
): NormalizedNoulItem {
  const rawVal =
    toOptionalNumber(obj.noul) ?? toOptionalNumber(obj.probability) ?? 0;
  return {
    kind: "noul",
    key,
    instructions:
      meta?.instructions ??
      (typeof obj.instructions === "string" ? obj.instructions : undefined),
    noul: clamp01(rawVal),
    confidence: toOptionalNumber(obj.confidence),
    lowConfidence: toOptionalBoolean(obj.low_confidence ?? obj.lowConfidence),
    stats: isPlainObject(obj.stats) ? obj.stats : undefined,
    raw: obj,
  };
}

function normalizeChoiceItem(
  key: string,
  obj: Record<string, unknown>,
  meta?: QuestionMetadata
): NormalizedChoiceItem {
  const confidence = toOptionalNumber(obj.confidence);
  const lowConfidence = toOptionalBoolean(
    obj.low_confidence ?? obj.lowConfidence
  );
  const stats = isPlainObject(obj.stats) ? obj.stats : undefined;
  const legend = extractCriteria(obj.legend);
  const criteria = meta?.criteria;

  const rankedOptions: NormalizedChoiceOption[] = [];
  const rawProbs = obj.probabilities ?? obj.probs;

  if (isPlainObject(rawProbs)) {
    const entries = Object.entries(rawProbs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort(([, a], [, b]) => (b as number) - (a as number));

    entries.forEach(([label, probability]) => {
      rankedOptions.push({
        label,
        probability: probability as number,
        description:
          getChoiceDescription(legend, label) ??
          getChoiceDescription(criteria, label),
      });
    });
  } else if (Array.isArray(obj.rankedOptions)) {
    obj.rankedOptions.forEach((opt) => {
      if (isPlainObject(opt) && typeof opt.label === "string") {
        rankedOptions.push({
          label: opt.label,
          probability: toOptionalNumber(opt.probability) ?? 0,
          description:
            typeof opt.description === "string"
              ? opt.description
              : getChoiceDescription(criteria, opt.label),
        });
      }
    });
  }

  const explicitChoice =
    typeof obj.choice === "string" ? obj.choice : undefined;

  if (explicitChoice && rankedOptions.length === 0) {
    rankedOptions.push({
      label: explicitChoice,
      probability: confidence ?? 1,
      description: getChoiceDescription(criteria, explicitChoice),
    });
  }

  const choice = explicitChoice ?? rankedOptions[0]?.label;
  const optionCount = Math.max(rankedOptions.length, meta?.optionCount ?? 0);

  return {
    kind: "choice",
    key,
    instructions:
      meta?.instructions ??
      (typeof obj.instructions === "string" ? obj.instructions : undefined),
    choice,
    rankedOptions,
    optionCount,
    confidence,
    lowConfidence,
    stats,
    raw: obj,
  };
}

function normalizeGenericItem(
  key: string,
  value: unknown,
  meta?: QuestionMetadata
): NormalizedGenericItem {
  return {
    kind: "generic",
    key,
    instructions: meta?.instructions,
    valueType: inferValueType(value),
    value,
    raw: value,
  };
}

function normalizeAnswerEntry(
  key: string,
  value: unknown,
  meta?: QuestionMetadata
): NormalizedAnswerItem {
  if (!isPlainObject(value)) {
    return normalizeGenericItem(key, value, meta);
  }

  const explicitType =
    typeof value.type === "string" ? value.type.toLowerCase() : undefined;

  if (explicitType === "score") {
    return normalizeScoreItem(key, value, meta);
  }
  if (explicitType === "noul") {
    return normalizeNoulItem(key, value, meta);
  }
  if (explicitType === "choice") {
    return normalizeChoiceItem(key, value, meta);
  }

  // Structural duck-typing
  if (typeof value.score === "number") {
    return normalizeScoreItem(key, value, meta);
  }
  if (typeof value.noul === "number") {
    return normalizeNoulItem(key, value, meta);
  }
  if (
    typeof value.choice === "string" ||
    isPlainObject(value.probabilities) ||
    isPlainObject(value.probs)
  ) {
    if (
      meta?.type === "score" &&
      typeof value.score === "number"
    ) {
      return normalizeScoreItem(key, value, meta);
    }
    return normalizeChoiceItem(key, value, meta);
  }

  if (meta?.type === "noul" && typeof value.probability === "number") {
    return normalizeNoulItem(key, value, meta);
  }

  return normalizeGenericItem(key, value, meta);
}

/**
 * Parses Laya `/predict` responses (primary raw `{ model, answers, ... }` format,
 * with fallback for legacy `{ response: ... }` and flat payloads) and normalizes
 * each answer into a discriminated union (`score` | `noul` | `choice` | `generic`),
 * enriching items with `instructions` and `criteria` from `sentQuestions`.
 */
export function parseLayaResponse(
  rawData: unknown,
  sentQuestions?: unknown
): ParsedLayaResponse {
  const questionMetaMap = indexSentQuestions(sentQuestions);
  const extraFields: Array<{ key: string; value: unknown }> = [];

  if (rawData === undefined) {
    return { items: [], extraFields };
  }

  if (!isPlainObject(rawData)) {
    return {
      items: [normalizeGenericItem("response", rawData)],
      extraFields,
    };
  }

  let model: string | undefined =
    typeof rawData.model === "string" && rawData.model.trim()
      ? rawData.model.trim()
      : undefined;
  let answersSource: Record<string, unknown>;

  if (isPlainObject(rawData.answers)) {
    answersSource = rawData.answers;
    for (const [k, v] of Object.entries(rawData)) {
      if (k !== "answers" && !(k === "model" && typeof v === "string")) {
        extraFields.push({ key: k, value: v });
      }
    }
  } else if (isPlainObject(rawData.response)) {
    const resp = rawData.response;
    for (const [k, v] of Object.entries(rawData)) {
      if (k !== "response" && !(k === "model" && typeof v === "string")) {
        extraFields.push({ key: k, value: v });
      }
    }

    if (typeof resp.model === "string" && resp.model.trim()) {
      model = resp.model.trim();
    }

    if (isPlainObject(resp.answers)) {
      answersSource = resp.answers;
      for (const [k, v] of Object.entries(resp)) {
        if (k !== "answers" && !(k === "model" && typeof v === "string")) {
          extraFields.push({ key: k, value: v });
        }
      }
    } else {
      answersSource = {};
      for (const [k, v] of Object.entries(resp)) {
        if (k === "model" && typeof v === "string") continue;
        answersSource[k] = v;
      }
    }
  } else {
    answersSource = {};
    for (const [k, v] of Object.entries(rawData)) {
      if (k === "model" && typeof v === "string") continue;
      answersSource[k] = v;
    }
  }

  const items = Object.entries(answersSource).map(([key, value]) =>
    normalizeAnswerEntry(key, value, questionMetaMap.get(key))
  );

  return {
    model,
    items,
    extraFields,
  };
}
