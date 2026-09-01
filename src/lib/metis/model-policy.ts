const DEFAULT_REPORTING_MODEL = "openai/gpt-5.4-mini";

function uniqueModels(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter(Boolean))];
}

function configuredModels(value: string | undefined, defaults: string[]) {
  if (!value?.trim()) return uniqueModels(defaults);
  return uniqueModels(value.split(","));
}

function reportingDefault() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_REPORTING_MODEL;
}

export function getToneProfileModelCandidates() {
  return configuredModels(process.env.OPENROUTER_TONE_PROFILE_MODELS, [
    "anthropic/claude-sonnet-4.6",
    reportingDefault(),
  ]);
}

export function getCommunicatorModelCandidates() {
  return configuredModels(process.env.OPENROUTER_CLIENT_MESSAGE_MODELS, [
    "anthropic/claude-sonnet-4.6",
    reportingDefault(),
  ]);
}

function scoreThreshold(value: string | undefined, fallback: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, parsed)) : fallback;
}

export function getVoiceRegenerateThreshold() {
  return scoreThreshold(process.env.METIS_TONE_REGENERATE_THRESHOLD, 8);
}

export function getFactRegenerateThreshold() {
  return scoreThreshold(process.env.METIS_FACT_REGENERATE_THRESHOLD, 7);
}
