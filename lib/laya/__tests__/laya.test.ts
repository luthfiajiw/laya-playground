import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import type * as UrlModule from "../url";
import type * as ParserModule from "../parser";
import type * as TemplatesModule from "../templates";
import type * as CurlModule from "../curl";
import type * as StorageModule from "../storage";

const require = createRequire(import.meta.url);

const { resolveLayaEndpoints } = require("../url.ts") as typeof UrlModule;
const { parseLayaResponse } = require("../parser.ts") as typeof ParserModule;
const {
  EXAMPLE_PRESETS,
  PRESET_GROUPS,
  QUESTION_TEMPLATE_CARDS,
  buildPredictPayload,
  insertQuestionTemplate,
} = require("../templates.ts") as typeof TemplatesModule;
const { buildCurlCommand } = require("../curl.ts") as typeof CurlModule;
const {
  MAX_HISTORY_ENTRIES,
  appendHistoryEntry,
  loadHistory,
  loadWorkspaceState,
  saveWorkspaceState,
} = require("../storage.ts") as typeof StorageModule;

test("resolveLayaEndpoints handles base URLs, trailing slashes, /predict, and subpaths", () => {
  assert.deepEqual(resolveLayaEndpoints("http://localhost:8000"), {
    baseUrl: "http://localhost:8000",
    predictUrl: "http://localhost:8000/predict",
    healthUrl: "http://localhost:8000/health",
  });

  assert.deepEqual(resolveLayaEndpoints("  http://localhost:8000/  "), {
    baseUrl: "http://localhost:8000",
    predictUrl: "http://localhost:8000/predict",
    healthUrl: "http://localhost:8000/health",
  });

  assert.deepEqual(resolveLayaEndpoints("http://localhost:8000/predict"), {
    baseUrl: "http://localhost:8000",
    predictUrl: "http://localhost:8000/predict",
    healthUrl: "http://localhost:8000/health",
  });

  assert.deepEqual(resolveLayaEndpoints("https://api.example.com/v1/laya/"), {
    baseUrl: "https://api.example.com/v1/laya",
    predictUrl: "https://api.example.com/v1/laya/predict",
    healthUrl: "https://api.example.com/v1/laya/health",
  });

  assert.deepEqual(
    resolveLayaEndpoints("https://api.example.com/v1/laya/predict"),
    {
      baseUrl: "https://api.example.com/v1/laya",
      predictUrl: "https://api.example.com/v1/laya/predict",
      healthUrl: "https://api.example.com/v1/laya/health",
    }
  );
});

test("resolveLayaEndpoints rejects empty, invalid, and non-HTTP(S) URLs", () => {
  assert.throws(() => resolveLayaEndpoints(""), /required/i);
  assert.throws(() => resolveLayaEndpoints("not-a-url"), /invalid url/i);
  assert.throws(() => resolveLayaEndpoints("ftp://localhost:8000"), /http/i);
  assert.throws(() => resolveLayaEndpoints("file:///etc/passwd"), /http/i);
});

test("parseLayaResponse handles Laya native response and enriches from sentQuestions object", () => {
  const sentQuestions = {
    department: {
      type: "choice",
      instructions: "Departemen mana yang harus menangani pesan ini?",
      criteria: {
        billing: "tagihan, pembayaran, refund",
        technical: "bug, error sistem, gangguan",
        sales: "harga, kontrak baru",
      },
    },
    urgency: {
      type: "score",
      instructions: "Seberapa mendesak permintaan ini?",
      criteria: ["tidak mendesak", "segera", "sangat mendesak"],
    },
    refund_requested: {
      type: "noul",
      instructions: "Apakah pengguna meminta pengembalian dana?",
    },
  };

  const rawData = {
    response: {
      department: {
        choice: "billing",
        confidence: 0.96,
        low_confidence: false,
        probabilities: {
          sales: 0.01,
          billing: 0.96,
          technical: 0.03,
        },
      },
      urgency: {
        score: 1.85,
        confidence: 0.89,
        probabilities: [0.05, 0.25, 0.7],
      },
      refund_requested: {
        noul: 0.97,
        confidence: 0.97,
      },
    },
  };

  const parsed = parseLayaResponse(rawData, sentQuestions);
  assert.equal(parsed.items.length, 3);

  const dept = parsed.items[0];
  assert.equal(dept.kind, "choice");
  if (dept.kind === "choice") {
    assert.equal(dept.choice, "billing");
    assert.equal(dept.instructions, sentQuestions.department.instructions);
    assert.equal(dept.optionCount, 3);
    assert.equal(dept.rankedOptions[0].label, "billing");
    assert.equal(dept.rankedOptions[0].description, "tagihan, pembayaran, refund");
    assert.equal(dept.rankedOptions[1].label, "technical");
  }

  const urgency = parsed.items[1];
  assert.equal(urgency.kind, "score");
  if (urgency.kind === "score") {
    assert.equal(urgency.score, 1.85);
    assert.equal(urgency.minScore, 0);
    assert.equal(urgency.maxScore, 2);
    assert.equal(urgency.levelCount, 3);
    assert.equal(urgency.probabilities?.[2].description, "sangat mendesak");
  }

  const refund = parsed.items[2];
  assert.equal(refund.kind, "noul");
  if (refund.kind === "noul") {
    assert.equal(refund.noul, 0.97);
    assert.equal(refund.instructions, sentQuestions.refund_requested.instructions);
  }
});

test("parseLayaResponse handles Jev nested format, low_confidence, array sentQuestions, and generic fallback", () => {
  const sentQuestions = [
    {
      key: "years_of_experience",
      type: "score",
      instructions: "Years of engineering experience",
    },
    {
      key: "custom_note",
      instructions: "Free-form reviewer note",
    },
  ];

  const rawData = {
    latency_ms: 44,
    response: {
      model: "jev-1.13.0",
      answers: {
        years_of_experience: {
          score: 2.99,
          confidence: 0.61,
          low_confidence: true,
          probabilities: {
            "0": 0.01,
            "1": 0.04,
            "2": 0.15,
            "3": 0.61,
            "4": 0.14,
            "5": 0.05,
          },
          legend: { "3": "5-7 years" },
          stats: { tokens: 256 },
        },
        custom_note: {
          summary: "Strong distributed systems background",
          tags: ["go", "payments"],
        },
        scalar_flag: true,
      },
    },
  };

  const parsed = parseLayaResponse(rawData, sentQuestions);
  assert.equal(parsed.model, "jev-1.13.0");
  assert.deepEqual(parsed.extraFields, [{ key: "latency_ms", value: 44 }]);
  assert.equal(parsed.items.length, 3);

  const scoreItem = parsed.items[0];
  assert.equal(scoreItem.kind, "score");
  if (scoreItem.kind === "score") {
    assert.equal(scoreItem.lowConfidence, true);
    assert.equal(scoreItem.minScore, 0);
    assert.equal(scoreItem.maxScore, 5);
    assert.equal(scoreItem.levelCount, 6);
    assert.equal(scoreItem.instructions, "Years of engineering experience");
    assert.equal(scoreItem.probabilities?.[3].description, "5-7 years");
    assert.deepEqual(scoreItem.stats, { tokens: 256 });
  }

  const genericObj = parsed.items[1];
  assert.equal(genericObj.kind, "generic");
  if (genericObj.kind === "generic") {
    assert.equal(genericObj.valueType, "object");
    assert.equal(genericObj.instructions, "Free-form reviewer note");
  }

  const genericBool = parsed.items[2];
  assert.equal(genericBool.kind, "generic");
  if (genericBool.kind === "generic") {
    assert.equal(genericBool.valueType, "boolean");
    assert.equal(genericBool.value, true);
  }
});

test("insertQuestionTemplate creates and increments unique question keys with 2-space formatting", () => {
  assert.equal(QUESTION_TEMPLATE_CARDS.length, 3);

  const first = insertQuestionTemplate("", "noul");
  const parsedFirst = JSON.parse(first) as Record<string, unknown>;
  assert.ok("is_relevant" in parsedFirst);

  const second = insertQuestionTemplate(first, "noul");
  const parsedSecond = JSON.parse(second) as Record<string, unknown>;
  assert.ok("is_relevant" in parsedSecond);
  assert.ok("is_relevant_2" in parsedSecond);

  const third = insertQuestionTemplate("{}", "choice");
  assert.ok(third.includes("\n  \"category_choice\": {"));

  assert.throws(
    () => insertQuestionTemplate("{invalid", "score"),
    /invalid/i
  );
  assert.throws(
    () => insertQuestionTemplate("[]", "score"),
    /object/i
  );
});

test("PRESET_GROUPS contains the 6 official laya-ai.com recipes and 3 single-type walkthrough lessons", () => {
  assert.equal(PRESET_GROUPS.length, 2);
  assert.equal(
    EXAMPLE_PRESETS.some(
      (p) => p.id === "resume-screening" || p.id === "customer-support-triage"
    ),
    false
  );

  const examplesGroup = PRESET_GROUPS.find((g) => g.id === "examples");
  assert.ok(examplesGroup);
  assert.deepEqual(
    examplesGroup.presets.map((p) => p.id),
    [
      "support-ticket-triage",
      "model-routing",
      "llm-guardrails",
      "rag-filtering",
      "content-moderation",
      "phishing-detection",
    ]
  );

  const walkthroughGroup = PRESET_GROUPS.find((g) => g.id === "walkthrough");
  assert.ok(walkthroughGroup);
  assert.equal(walkthroughGroup.label, "Walkthrough lessons");
  assert.equal(walkthroughGroup.presets.length, 3);

  const demonstratedTypes = walkthroughGroup.presets.map((preset) => {
    const questions = JSON.parse(preset.questionsText) as Record<
      string,
      { type?: string }
    >;
    const entries = Object.values(questions);
    assert.equal(entries.length, 1);
    return entries[0].type;
  });

  assert.deepEqual(demonstratedTypes, ["noul", "score", "choice"]);

  for (const preset of EXAMPLE_PRESETS) {
    const payload = buildPredictPayload(
      preset.stateMode,
      preset.stateText,
      preset.questionsText,
      preset.settings
    );
    assert.ok(payload.state);
    assert.ok(payload.questions);
  }
});

test("buildPredictPayload validates inputs and omits empty optional settings", () => {
  const preset = EXAMPLE_PRESETS[0];
  assert.equal(preset.id, "support-ticket-triage");

  const payload = buildPredictPayload(
    preset.stateMode,
    preset.stateText,
    preset.questionsText,
    {
      min_confidence: "0.85",
      model: "  ",
      lang: "",
      max_len: "",
      head_max_len: "128",
    }
  );

  assert.equal(payload.state, preset.stateText);
  assert.equal(payload.min_confidence, 0.85);
  assert.equal(payload.head_max_len, 128);
  assert.equal("model" in payload, false);
  assert.equal("lang" in payload, false);
  assert.equal("max_len" in payload, false);

  assert.throws(
    () => buildPredictPayload("text", "   ", preset.questionsText, {}),
    /empty/i
  );
  assert.throws(
    () =>
      buildPredictPayload("json", "{}", preset.questionsText, {}),
    /empty/i
  );
  assert.throws(
    () =>
      buildPredictPayload("text", "hello", preset.questionsText, {
        min_confidence: "1.5",
      }),
    /between 0 and 1/i
  );
  assert.throws(
    () =>
      buildPredictPayload("text", "hello", preset.questionsText, {
        max_len: "0",
      }),
    /positive integer/i
  );
});

test("buildCurlCommand formats URL and payload with safe POSIX escaping", () => {
  const curl = buildCurlCommand("http://localhost:8000/predict", {
    state: "User said: it's broken",
    questions: {
      urgent: { type: "noul", instructions: "Is it urgent?" },
    },
  });

  assert.match(curl, /^curl -X POST 'http:\/\/localhost:8000\/predict'/);
  assert.match(curl, /-H 'Content-Type: application\/json'/);
  assert.match(curl, /it'\\''s broken/);
});

test("storage helpers are SSR-safe when window is undefined and cap history at 15", () => {
  assert.equal(loadWorkspaceState(), null);
  assert.deepEqual(loadHistory(), []);

  const mem = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    },
  };

  try {
    saveWorkspaceState({
      apiUrl: "http://localhost:8000",
      stateMode: "text",
      stateText: "hello",
      questionsText: "{}",
      settings: {},
    });
    assert.equal(loadWorkspaceState()?.apiUrl, "http://localhost:8000");

    for (let i = 0; i < 20; i++) {
      appendHistoryEntry({
        id: `run-${i}`,
        timestamp: i,
        label: `Run ${i}`,
        apiUrl: "http://localhost:8000",
        stateMode: "text",
        stateText: "hello",
        questionsText: "{}",
        settings: {},
        result: {
          ok: true,
          status: 200,
          latencyMs: 10,
          timestamp: i,
          rawData: {},
          targetUrl: "http://localhost:8000/predict",
        },
      });
    }

    const history = loadHistory();
    assert.equal(history.length, MAX_HISTORY_ENTRIES);
    assert.equal(history[0].id, "run-19");
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
});
