import type {
  ExamplePreset,
  LayaSettings,
  QuestionTemplateCard,
  QuestionType,
  StateMode,
} from "./types";

export const QUESTION_TEMPLATE_CARDS: QuestionTemplateCard[] = [
  {
    type: "noul",
    title: "Boolean / Probability",
    badgeLabel: "noul",
    description: "Predicts a 0.00–1.00 truth probability for a yes/no question.",
    examplePrompt: "Does the message explicitly request a refund?",
    defaultKey: "is_relevant",
    template: {
      type: "noul",
      instructions: "Does the text meet this condition?",
    },
  },
  {
    type: "score",
    title: "Criteria Score",
    badgeLabel: "score",
    description: "Rates the input across ordered criteria levels with probabilities.",
    examplePrompt: "How urgent is this customer support ticket?",
    defaultKey: "quality_score",
    template: {
      type: "score",
      instructions: "Rate the input based on the defined criteria levels.",
      criteria: [
        "low or minimal",
        "moderate",
        "high or critical",
      ],
    },
  },
  {
    type: "choice",
    title: "Multi-class Choice",
    badgeLabel: "choice",
    description: "Selects the best matching label from named options.",
    examplePrompt: "Which department should handle this message?",
    defaultKey: "category_choice",
    template: {
      type: "choice",
      instructions: "Select the best matching category.",
      criteria: {
        option_a: "keywords or description for option A",
        option_b: "keywords or description for option B",
        option_c: "keywords or description for option C",
      },
    },
  },
];

export const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: "customer-support-triage",
    name: "Customer Support Triage",
    description:
      "Official example from training-laya/app.py for routing billing, urgency, and refund requests.",
    stateMode: "text",
    stateText:
      "Kami ditagih dua kali untuk tagihan bulan Maret. Tolong segera refund hari ini juga.",
    questionsText: JSON.stringify(
      {
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
          criteria: [
            "tidak mendesak",
            "segera",
            "sangat mendesak atau memblokir operasional",
          ],
        },
        refund_requested: {
          type: "noul",
          instructions: "Apakah pengguna meminta pengembalian dana?",
        },
      },
      null,
      2
    ),
    settings: {
      min_confidence: "0.85",
    },
  },
  {
    id: "resume-screening",
    name: "Resumé Screening",
    description:
      "Evaluate candidate JSON profiles for experience, technical depth, mentorship, and career progression.",
    stateMode: "json",
    stateText: JSON.stringify(
      {
        candidate: "Alya Pratama",
        role_applied: "Senior Backend Engineer",
        summary:
          "7 years building high-throughput distributed payment services in Go and Python, mentoring 4 junior engineers and leading database sharding migrations.",
        experience: [
          {
            company: "FinPay",
            title: "Staff Software Engineer",
            years: 3,
            highlights: [
              "Reduced p99 checkout latency from 420ms to 85ms",
              "Mentored squad of 4 engineers through weekly architecture reviews",
            ],
          },
          {
            company: "CloudCart",
            title: "Backend Engineer",
            years: 4,
            highlights: [
              "Designed event-driven billing pipeline handling 12k events/sec",
            ],
          },
        ],
      },
      null,
      2
    ),
    questionsText: JSON.stringify(
      {
        years_of_experience: {
          type: "score",
          instructions:
            "How many total years of relevant software engineering experience does the candidate have?",
          criteria: [
            "0-1 years (entry level)",
            "2-3 years (junior)",
            "4-5 years (mid-level)",
            "6-8 years (senior)",
            "9+ years (staff/principal)",
          ],
        },
        technical_depth: {
          type: "score",
          instructions:
            "How strong is the demonstrated systems and backend engineering depth?",
          criteria: [
            "basic CRUD usage only",
            "solid service development",
            "strong architecture, performance, and distributed systems ownership",
          ],
        },
        mentorship_demonstrated: {
          type: "noul",
          instructions:
            "Does the resumé clearly demonstrate mentoring or coaching other engineers?",
        },
        career_progression: {
          type: "choice",
          instructions:
            "Which pattern best describes the candidate's career trajectory?",
          criteria: {
            steady_growth: "clear progression to higher scope and seniority",
            lateral_moves: "similar scope across different companies",
            career_switch: "recent transition from an unrelated domain",
          },
        },
      },
      null,
      2
    ),
    settings: {
      min_confidence: "0.8",
    },
  },
  {
    id: "content-moderation",
    name: "Content Moderation",
    description:
      "Classify user-generated posts for policy violations, severity, and violation category.",
    stateMode: "json",
    stateText: JSON.stringify(
      {
        post_id: "pst_94821",
        author_trust_tier: "new_account",
        content:
          "Click this verified airdrop link within 10 minutes and enter your seed phrase to claim 5000 tokens immediately!",
      },
      null,
      2
    ),
    questionsText: JSON.stringify(
      {
        policy_violation: {
          type: "noul",
          instructions:
            "Does this post violate platform safety or anti-scam policies?",
        },
        severity: {
          type: "score",
          instructions:
            "How severe is the potential user harm if this post remains visible?",
          criteria: [
            "harmless or benign",
            "mildly spammy or off-topic",
            "moderate deception or policy abuse",
            "high-risk phishing, fraud, or credential theft",
          ],
        },
        violation_category: {
          type: "choice",
          instructions:
            "Which moderation category best fits this content?",
          criteria: {
            phishing_scam: "credential theft, fake giveaways, malicious links",
            spam: "unsolicited promotional repetition",
            harassment: "targeted abuse, threats, or hate speech",
            safe: "benign content with no violation",
          },
        },
      },
      null,
      2
    ),
    settings: {
      min_confidence: "0.85",
    },
  },
];

/**
 * Inserts a new question template of `type` into an existing Questions JSON string.
 * Empty or whitespace-only input is treated as `{}`. Throws if existing text is invalid JSON
 * or not a JSON object.
 */
export function insertQuestionTemplate(
  currentJson: string,
  type: QuestionType
): string {
  const card = QUESTION_TEMPLATE_CARDS.find((c) => c.type === type);
  if (!card) {
    throw new Error(`Unknown question type: ${type}`);
  }

  const trimmed = currentJson.trim();
  let parsed: Record<string, unknown>;

  if (!trimmed) {
    parsed = {};
  } else {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Cannot insert question: current Questions JSON is invalid (${
          err instanceof Error ? err.message : "parse error"
        }).`
      );
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error(
        "Cannot insert question: Questions must be a JSON object."
      );
    }
    parsed = { ...(raw as Record<string, unknown>) };
  }

  let candidateKey = card.defaultKey;
  let suffix = 2;
  while (Object.prototype.hasOwnProperty.call(parsed, candidateKey)) {
    candidateKey = `${card.defaultKey}_${suffix}`;
    suffix += 1;
  }

  parsed[candidateKey] = structuredClone(card.template);
  return JSON.stringify(parsed, null, 2);
}

function parsePositiveInt(raw: string, fieldName: string): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error(`${fieldName} must be a positive integer (>= 1).`);
  }
  return num;
}

function parseMinConfidence(raw: string): number | Record<string, number> {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("min_confidence JSON object is invalid.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("min_confidence must be a number (0..1) or JSON object.");
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
        throw new Error(`min_confidence["${k}"] must be between 0 and 1.`);
      }
      out[k] = v;
    }
    return out;
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0 || num > 1) {
    throw new Error("min_confidence must be a number between 0 and 1.");
  }
  return num;
}

/**
 * Validates editor inputs and optional settings, returning a payload matching
 * `PredictRequest` in `training-laya/app.py`.
 */
export function buildPredictPayload(
  stateMode: StateMode,
  stateText: string,
  questionsText: string,
  settings: LayaSettings
): Record<string, unknown> {
  let stateValue: unknown;

  if (stateMode === "text") {
    if (!stateText.trim()) {
      throw new Error("State text cannot be empty.");
    }
    stateValue = stateText;
  } else {
    const trimmedState = stateText.trim();
    if (!trimmedState) {
      throw new Error("State JSON cannot be empty.");
    }
    try {
      stateValue = JSON.parse(trimmedState);
    } catch (err) {
      throw new Error(
        `State JSON is invalid: ${
          err instanceof Error ? err.message : "parse error"
        }`
      );
    }
    const isEmptyStr = typeof stateValue === "string" && !stateValue.trim();
    const isEmptyArray = Array.isArray(stateValue) && stateValue.length === 0;
    const isEmptyObj =
      typeof stateValue === "object" &&
      stateValue !== null &&
      !Array.isArray(stateValue) &&
      Object.keys(stateValue).length === 0;

    if (
      stateValue === null ||
      stateValue === undefined ||
      isEmptyStr ||
      isEmptyArray ||
      isEmptyObj
    ) {
      throw new Error("State JSON cannot be empty.");
    }
  }

  const trimmedQuestions = questionsText.trim();
  if (!trimmedQuestions) {
    throw new Error("Questions JSON cannot be empty.");
  }

  let questionsValue: unknown;
  try {
    questionsValue = JSON.parse(trimmedQuestions);
  } catch (err) {
    throw new Error(
      `Questions JSON is invalid: ${
        err instanceof Error ? err.message : "parse error"
      }`
    );
  }

  const isValidQuestionsObj =
    typeof questionsValue === "object" &&
    questionsValue !== null &&
    !Array.isArray(questionsValue) &&
    Object.keys(questionsValue).length > 0;
  const isValidQuestionsArr =
    Array.isArray(questionsValue) && questionsValue.length > 0;

  if (!isValidQuestionsObj && !isValidQuestionsArr) {
    throw new Error(
      "Questions must be a non-empty JSON object or non-empty array of question definitions."
    );
  }

  const payload: Record<string, unknown> = {
    state: stateValue,
    questions: questionsValue,
  };

  if (settings.min_confidence && settings.min_confidence.trim()) {
    payload.min_confidence = parseMinConfidence(settings.min_confidence);
  }
  if (settings.model && settings.model.trim()) {
    payload.model = settings.model.trim();
  }
  if (settings.lang && settings.lang.trim()) {
    payload.lang = settings.lang.trim();
  }
  if (settings.max_len && settings.max_len.trim()) {
    payload.max_len = parsePositiveInt(settings.max_len.trim(), "max_len");
  }
  if (settings.head_max_len && settings.head_max_len.trim()) {
    payload.head_max_len = parsePositiveInt(
      settings.head_max_len.trim(),
      "head_max_len"
    );
  }

  return payload;
}
