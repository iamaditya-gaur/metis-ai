export type ModelCandidate = {
  id: string;
  label: string;
  models: string[];
  family: "current" | "updated" | "open-weight" | "free";
};

export const EVAL_WINDOW = {
  from: "2026-08-24",
  to: "2026-08-30",
  label: "2026-08-24 to 2026-08-30",
} as const;

export const BUDGET = {
  targetUsd: 1,
  hardLimitUsd: 3,
} as const;

export const CURRENT_COMMUNICATOR_MODELS = [
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.4-mini",
];

export const SUMMARY_CANDIDATES: ModelCandidate[] = [
  {
    id: "summary-current",
    label: "Current summary",
    models: ["openai/gpt-5.4-mini"],
    family: "current",
  },
  {
    id: "summary-luna",
    label: "GPT-5.6 Luna summary",
    models: ["openai/gpt-5.6-luna"],
    family: "updated",
  },
];

export const TONE_CANDIDATES: ModelCandidate[] = [
  {
    id: "tone-current",
    label: "Current tone extraction",
    models: CURRENT_COMMUNICATOR_MODELS,
    family: "current",
  },
  {
    id: "tone-luna",
    label: "GPT-5.6 Luna tone extraction",
    models: ["openai/gpt-5.6-luna"],
    family: "updated",
  },
  {
    id: "tone-deepseek",
    label: "DeepSeek V4 Flash tone extraction",
    models: ["deepseek/deepseek-v4-flash-0731"],
    family: "open-weight",
  },
  {
    id: "tone-glm-free",
    label: "GLM-5.2 Free tone extraction",
    models: ["z-ai/glm-5.2:free"],
    family: "free",
  },
];

export const COMPOSE_CANDIDATES: ModelCandidate[] = [
  {
    id: "compose-current",
    label: "Current client message",
    models: CURRENT_COMMUNICATOR_MODELS,
    family: "current",
  },
  {
    id: "compose-sonnet-5",
    label: "Claude Sonnet 5 client message",
    models: ["anthropic/claude-sonnet-5"],
    family: "updated",
  },
  {
    id: "compose-terra",
    label: "GPT-5.6 Terra client message",
    models: ["openai/gpt-5.6-terra"],
    family: "updated",
  },
];

export const JUDGE_CANDIDATES: ModelCandidate[] = [
  {
    id: "judge-current",
    label: "Current judge",
    models: ["openai/gpt-5.4-mini"],
    family: "current",
  },
  {
    id: "judge-luna",
    label: "GPT-5.6 Luna judge",
    models: ["openai/gpt-5.6-luna"],
    family: "updated",
  },
  {
    id: "judge-deepseek",
    label: "DeepSeek V4 Flash judge",
    models: ["deepseek/deepseek-v4-flash-0731"],
    family: "open-weight",
  },
  {
    id: "judge-gpt-oss",
    label: "GPT-OSS 120B judge",
    models: ["openai/gpt-oss-120b"],
    family: "open-weight",
  },
  {
    id: "judge-glm-free",
    label: "GLM-5.2 Free judge",
    models: ["z-ai/glm-5.2:free"],
    family: "free",
  },
];

type Price = { input: number; output: number };

export const MODEL_PRICES_USD_PER_MILLION: Record<string, Price> = {
  "openai/gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "openai/gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "openai/gpt-5.6-terra": { input: 2, output: 12 },
  "anthropic/claude-sonnet-4.6": { input: 3, output: 15 },
  "anthropic/claude-sonnet-5": { input: 2, output: 10 },
  "deepseek/deepseek-v4-flash-0731": { input: 0.065, output: 0.18 },
  "openai/gpt-oss-120b": { input: 0.037, output: 0.17 },
  "z-ai/glm-5.2:free": { input: 0, output: 0 },
};

export function estimateCallCostUsd({
  models,
  inputCharacters,
  maxOutputTokens,
}: {
  models: string[];
  inputCharacters: number;
  maxOutputTokens: number;
}) {
  const estimatedInputTokens = Math.ceil(inputCharacters / 3.5);
  const rawEstimate = models.reduce((sum, model) => {
    const price = MODEL_PRICES_USD_PER_MILLION[model] ?? {
      input: 5,
      output: 25,
    };
    return (
      sum +
      (estimatedInputTokens * price.input) / 1_000_000 +
      (maxOutputTokens * price.output) / 1_000_000
    );
  }, 0);

  // Two-times padding protects the hard limit from token-estimation error
  // and provider price variation.
  return Number((rawEstimate * 2).toFixed(6));
}
