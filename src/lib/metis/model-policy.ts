function configuredModelCandidates(value: string | undefined, defaults: string[]) {
  const candidates = value?.trim() ? value.split(",") : defaults;

  return [...new Set(candidates.map((entry) => entry.trim()).filter(Boolean))];
}

function reportingDefaultModel() {
  return process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini";
}

export function getToneProfileModelCandidates() {
  return configuredModelCandidates(process.env.OPENROUTER_TONE_PROFILE_MODELS, [
    "openai/gpt-5.6-luna",
    "anthropic/claude-sonnet-4.6",
    reportingDefaultModel(),
  ]);
}

export function getCommunicatorModelCandidates() {
  return configuredModelCandidates(process.env.OPENROUTER_CLIENT_MESSAGE_MODELS, [
    "openai/gpt-5.6-terra",
    "anthropic/claude-sonnet-4.6",
    reportingDefaultModel(),
  ]);
}
