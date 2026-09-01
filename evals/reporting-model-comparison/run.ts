import { createHash, randomInt } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  getAccountActivities,
  getAccountInsights,
  normalizeAdAccountId,
} from "../../scripts/pocs/lib/meta-client.mjs";
import {
  buildInsightsSnapshot,
  buildReportPromptInput,
  generateOpenRouterReportSummary,
} from "../../scripts/pocs/lib/reporting.mjs";
import {
  buildCanonicalActivities,
  buildToneProfile,
  composeClientMessage,
  deriveToneProfile,
  gradeFactMatch,
  gradeVoiceMatch,
  type ActivityRecord,
  type CanonicalActivity,
  type OpenRouterUsage,
} from "@/lib/metis/tone";
import {
  checkActivityDirections,
  violationsToCritique,
} from "../../src/lib/metis/fact-check";
import type { ToneProfile } from "../../src/lib/metis/types";
import {
  buildRecipientHandle,
  resolveReportingAccountName,
} from "../../src/lib/metis/recipient";

import { BudgetLedger } from "./budget";
import {
  BUDGET,
  COMPOSE_CANDIDATES,
  EVAL_WINDOW,
  JUDGE_CANDIDATES,
  SUMMARY_CANDIDATES,
  TONE_CANDIDATES,
  estimateCallCostUsd,
  type ModelCandidate,
} from "./config";
import {
  allChecksPass,
  checkGeneratedMessage,
  type CheckResult,
} from "./checks";

type Fixture = {
  schemaVersion: 1;
  capturedAt: string;
  brandLabel: string;
  accountName?: string;
  expectedRecipient?: string;
  accountId: string;
  dateRange: {
    from: string;
    to: string;
    preset: null;
    label: string;
  };
  rows: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  activitiesPermissionDenied: boolean;
  activitiesError: unknown;
};

type UsageCarrier = { usage?: OpenRouterUsage | null };

type TrialResult<T> = {
  trial: number;
  pass: boolean;
  output: T | null;
  usage: OpenRouterUsage | null;
  checks: CheckResult[];
  error: string | null;
};

type CandidateScreen<T> = {
  candidate: ModelCandidate;
  trials: Array<TrialResult<T>>;
  consistentPass: boolean;
};

type GeneratedReport = {
  executiveSummary: string;
  whatChanged: string[];
  risks: string[];
  nextActions: string[];
  slackMessage: string;
};

type Snapshot = ReturnType<typeof buildInsightsSnapshot>;

type ScreenOutput = {
  model?: string | null;
  message?: string;
  report?: GeneratedReport;
  [key: string]: unknown;
};

type AnyScreen = CandidateScreen<ScreenOutput>;

type ScreeningPayload = {
  schemaVersion: 1;
  generatedAt: string;
  fixtureChecksum: string;
  toneChecksum: string;
  summary: AnyScreen[];
  tone: AnyScreen[];
  compose: AnyScreen[];
  judges: AnyScreen[];
  blindMapping: Record<string, string>;
  budget: ReturnType<BudgetLedger["snapshot"]>;
};

const PRIVATE_ROOT = path.resolve(
  process.cwd(),
  process.env.METIS_EVAL_PRIVATE_DIR?.trim() ||
    ".private-evals/reporting-model-comparison",
);

function hydrateFixtureIdentity(fixture: Fixture): Fixture & {
  accountName: string;
  expectedRecipient: string;
} {
  const accountName = resolveReportingAccountName(
    fixture.rows as Array<{ accountName?: unknown }>,
    fixture.accountName ?? fixture.brandLabel,
  );
  const expectedRecipient = buildRecipientHandle(accountName);
  if (!accountName || !expectedRecipient) {
    throw new Error("The private fixture does not contain a usable Meta account name.");
  }

  return { ...fixture, brandLabel: accountName, accountName, expectedRecipient };
}

async function readFixture() {
  return hydrateFixtureIdentity(await readJson<Fixture>(FIXTURE_PATH));
}
const FIXTURE_PATH = path.join(PRIVATE_ROOT, "frozen-input.json");
const TONE_PATH = path.join(PRIVATE_ROOT, "tone-context.txt");
const BUDGET_PATH = path.join(PRIVATE_ROOT, "budget.json");
const LATEST_SCREENING_PATH = path.join(PRIVATE_ROOT, "latest-screening.json");
const SCREENING_PROGRESS_PATH = path.join(PRIVATE_ROOT, "screening-progress.json");
const EVAL_CALL_TIMEOUT_MS = 60_000;

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;
    const key = entry.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return args;
}

async function ensurePrivateRoot() {
  const relativeToRepo = path.relative(process.cwd(), PRIVATE_ROOT);
  const isInsideRepo =
    relativeToRepo === "" ||
    (!relativeToRepo.startsWith(`..${path.sep}`) &&
      relativeToRepo !== ".." &&
      !path.isAbsolute(relativeToRepo));
  const isIgnoredPrivateRoot =
    relativeToRepo === ".private-evals" ||
    relativeToRepo.startsWith(`.private-evals${path.sep}`);
  if (isInsideRepo && !isIgnoredPrivateRoot) {
    throw new Error(
      "Private evaluations inside the repository must stay under the ignored .private-evals directory.",
    );
  }
  await mkdir(PRIVATE_ROOT, { recursive: true, mode: 0o700 });
}

async function writePrivate(filePath: string, content: string) {
  await ensurePrivateRoot();
  await writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
}

async function writePrivateJson(filePath: string, value: unknown) {
  await writePrivate(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function checksum(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function splitToneExamples(content: string) {
  const quoted = [...content.matchAll(/"([\s\S]*?)"/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (quoted.length) return quoted;
  return content
    .split(/\n\s*\n+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function candidateMedianCost<T>(screen: CandidateScreen<T>) {
  return median(
    screen.trials.map((trial) => trial.usage?.costUsd ?? Number.POSITIVE_INFINITY),
  );
}

function isConsistent<T>(screen: CandidateScreen<T>) {
  return screen.trials.length === 3 && screen.trials.every((trial) => trial.pass);
}

async function withFreeRateLimit<T>(models: string[], run: () => Promise<T>) {
  const previous = process.env.POC_OPENROUTER_MIN_INTERVAL_MS;
  if (models.some((model) => model.endsWith(":free"))) {
    process.env.POC_OPENROUTER_MIN_INTERVAL_MS = "3100";
  }
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.POC_OPENROUTER_MIN_INTERVAL_MS;
    } else {
      process.env.POC_OPENROUTER_MIN_INTERVAL_MS = previous;
    }
  }
}

async function runCandidateTrials<T>({
  candidate,
  runTrial,
}: {
  candidate: ModelCandidate;
  runTrial: (trial: number) => Promise<TrialResult<T>>;
}): Promise<CandidateScreen<T>> {
  const trials = [await runTrial(1)];
  if (trials[0].pass) {
    trials.push(await runTrial(2));
    trials.push(await runTrial(3));
  }
  return {
    candidate,
    trials,
    consistentPass: trials.length === 3 && trials.every((trial) => trial.pass),
  };
}

function buildSourceFacts({
  snapshot,
  changesSummary,
}: {
  snapshot: ReturnType<typeof buildInsightsSnapshot>;
  changesSummary: string | null;
}) {
  const lines = [
    `Date range: ${snapshot.dateRange.label}`,
    `Row count: ${snapshot.rowCount}`,
    "Meta snapshot:",
    JSON.stringify(snapshot),
  ];
  if (changesSummary) {
    lines.push("CHANGES:", changesSummary);
  }
  return lines.join("\n");
}

async function fetchFixture(
  toneFile: string,
  args: Record<string, string | boolean>,
) {
  if (!toneFile) throw new Error("Pass --tone-file with the private tone-context path.");
  const accountId =
    process.env.META_REPORTING_ACCOUNT_ID?.trim() ||
    process.env.META_AD_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error(
      "Missing Meta reporting account configuration. Configure it in the existing private environment file.",
    );
  }
  if (!process.env.META_ACCESS_TOKEN?.trim()) {
    throw new Error(
      "Missing Meta access token. Configure it in the existing private environment file.",
    );
  }

  const toneContext = await readFile(path.resolve(toneFile), "utf8");
  const examples = splitToneExamples(toneContext);
  if (examples.length !== 9) {
    throw new Error(`Expected 9 tone examples; found ${examples.length}.`);
  }

  const normalizedAccountId = normalizeAdAccountId(accountId);
  const from = String(args.from ?? EVAL_WINDOW.from);
  const to = String(args.to ?? EVAL_WINDOW.to);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Date overrides must use YYYY-MM-DD.");
  }
  if (from > to) throw new Error("The reporting start date must not be after the end date.");
  const dateRange = {
    from,
    to,
    preset: null,
    label: String(args.label ?? `${from} to ${to}`),
  };
  console.log("Fetching the frozen account insights snapshot once...");
  const insights = await getAccountInsights({
    accountId: normalizedAccountId,
    level: "campaign",
    dateRange,
    accessToken: null,
  });
  console.log("Fetching the matching campaign-activity snapshot once...");
  const activities = await getAccountActivities({
    accountId: normalizedAccountId,
    dateRange,
    accessToken: null,
  });

  const accountName = resolveReportingAccountName(insights.rows, null);
  const expectedRecipient = buildRecipientHandle(accountName);
  if (!accountName || !expectedRecipient) {
    throw new Error("Meta insights did not return a usable account name.");
  }

  const fixture: Fixture = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    brandLabel: accountName,
    accountName,
    expectedRecipient,
    accountId: normalizedAccountId,
    dateRange,
    rows: insights.rows,
    activities: activities.activities,
    activitiesPermissionDenied: activities.permissionDenied,
    activitiesError: activities.error,
  };
  await writePrivate(TONE_PATH, toneContext);
  await writePrivateJson(FIXTURE_PATH, fixture);

  console.log(
    `Frozen locally: ${fixture.rows.length} insight rows, ${fixture.activities.length} activity rows, 9 tone examples.`,
  );
  console.log(`Fixture checksum: ${checksum(JSON.stringify(fixture))}`);
  console.log(`Tone checksum: ${checksum(toneContext)}`);
}

async function tracked<T extends UsageCarrier>({
  ledger,
  stage,
  candidate,
  inputCharacters,
  maxOutputTokens,
  run,
}: {
  ledger: BudgetLedger;
  stage: string;
  candidate: ModelCandidate;
  inputCharacters: number;
  maxOutputTokens: number;
  run: () => Promise<T>;
}) {
  try {
    return await ledger.trackedCall({
      stage,
      candidateId: candidate.id,
      models: candidate.models,
      inputCharacters,
      maxOutputTokens,
      run: () => withFreeRateLimit(candidate.models, run),
      getCostUsd: (result) => result.usage?.costUsd,
    });
  } finally {
    console.log(
      `tracked spend after ${stage}/${candidate.id}: $${ledger.snapshot().actualOrEstimatedUsd.toFixed(6)}`,
    );
  }
}

function estimateScreeningCeiling({
  promptInput,
  toneContext,
  report,
  snapshot,
  changesSummary,
  sourceFacts,
  samples,
  factMessages,
  voiceMessages,
}: {
  promptInput: unknown;
  toneContext: string;
  report: GeneratedReport | null;
  snapshot: Snapshot;
  changesSummary: string | null;
  sourceFacts: string;
  samples: string[];
  factMessages: string[];
  voiceMessages: string[];
}) {
  const estimate = (
    candidate: ModelCandidate,
    inputCharacters: number,
    maxOutputTokens: number,
    calls: number,
  ) =>
    estimateCallCostUsd({
      models: candidate.models,
      inputCharacters,
      maxOutputTokens,
    }) * calls;
  const summary = SUMMARY_CANDIDATES.reduce(
    (sum, candidate) =>
      sum + estimate(candidate, JSON.stringify(promptInput).length, 900, 3),
    0,
  );
  const tone = TONE_CANDIDATES.reduce(
    (sum, candidate) => sum + estimate(candidate, toneContext.length, 700, 3),
    0,
  );
  const composeInput =
    toneContext.length +
    JSON.stringify({ snapshot, changesSummary }).length +
    (report ? JSON.stringify(report).length : 3_600);
  const compose = COMPOSE_CANDIDATES.reduce(
    (sum, candidate) => sum + estimate(candidate, composeInput, 650, 3),
    0,
  );
  const sampleCharacters = samples.join("\n").length;
  const judges = JUDGE_CANDIDATES.reduce(
    (sum, candidate) =>
      sum +
      factMessages.reduce(
        (subtotal, message) =>
          subtotal + estimate(candidate, sourceFacts.length + message.length, 320, 3),
        0,
      ) +
      voiceMessages.reduce(
        (subtotal, message) =>
          subtotal + estimate(candidate, sampleCharacters + message.length, 280, 3),
        0,
      ),
    0,
  );
  return summary + tone + compose + judges;
}

async function screenSummary({
  candidate,
  ledger,
  promptInput,
  sourceData,
}: {
  candidate: ModelCandidate;
  ledger: BudgetLedger;
  promptInput: ReturnType<typeof buildReportPromptInput>;
  sourceData: unknown;
}) {
  return runCandidateTrials({
    candidate,
    runTrial: async (trial) => {
      console.log(`summary ${candidate.id} trial ${trial}`);
      try {
        const result = await tracked({
          ledger,
          stage: "summary",
          candidate,
          inputCharacters: JSON.stringify(promptInput).length,
          maxOutputTokens: 900,
          run: async () => {
            const generated = await generateOpenRouterReportSummary(promptInput, {
              model: candidate.models[0],
              maxTokens: 900,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            });
            return { ...generated, usage: generated.usage as OpenRouterUsage };
          },
        });
        const reportText = [
          result.report.executiveSummary,
          ...result.report.whatChanged,
          ...result.report.risks,
          ...result.report.nextActions,
          result.report.slackMessage,
        ].join("\n");
        const checks = checkGeneratedMessage({
          message: reportText,
          sourceData,
          canonicalActivities: [],
        }).filter((check) =>
          ["non-empty", "numeric-grounding"].includes(check.name),
        );
        return {
          trial,
          pass: allChecksPass(checks),
          output: { model: result.model, report: result.report, prompts: result.prompts },
          usage: result.usage,
          checks,
          error: null,
        };
      } catch (error) {
        return {
          trial,
          pass: false,
          output: null,
          usage: null,
          checks: [],
          error: errorMessage(error),
        };
      }
    },
  });
}

async function screenTone({
  candidate,
  ledger,
  toneContext,
}: {
  candidate: ModelCandidate;
  ledger: BudgetLedger;
  toneContext: string;
}) {
  return runCandidateTrials({
    candidate,
    runTrial: async (trial) => {
      console.log(`tone ${candidate.id} trial ${trial}`);
      try {
        const result = await tracked({
          ledger,
          stage: "tone-profile",
          candidate,
          inputCharacters: toneContext.length,
          maxOutputTokens: 700,
          run: () =>
            buildToneProfile(toneContext, {
              models: candidate.models,
              maxTokens: 700,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            }),
        });
        const checks: CheckResult[] = [
          {
            name: "model-response",
            pass: Boolean(result.model),
            detail: result.model
              ? `Resolved ${result.model}.`
              : "Model failed and the heuristic fallback was used.",
          },
          {
            name: "profile-shape",
            pass:
              result.profile.sampleCount > 0 &&
              result.profile.wordRange.min <= result.profile.wordRange.max,
            detail: "Profile must represent supplied examples and have a valid word range.",
          },
        ];
        return {
          trial,
          pass: allChecksPass(checks),
          output: { model: result.model, profile: result.profile, prompts: result.prompts },
          usage: result.usage,
          checks,
          error: null,
        };
      } catch (error) {
        return {
          trial,
          pass: false,
          output: null,
          usage: null,
          checks: [],
          error: errorMessage(error),
        };
      }
    },
  });
}

async function screenCompose({
  candidate,
  ledger,
  report,
  snapshot,
  toneContext,
  toneProfile,
  changesSummary,
  canonicalActivities,
  expectedRecipient,
  accountName,
}: {
  candidate: ModelCandidate;
  ledger: BudgetLedger;
  report: GeneratedReport;
  snapshot: Snapshot;
  toneContext: string;
  toneProfile: ToneProfile;
  changesSummary: string | null;
  canonicalActivities: CanonicalActivity[];
  expectedRecipient: string;
  accountName: string;
}) {
  return runCandidateTrials({
    candidate,
    runTrial: async (trial) => {
      console.log(`compose ${candidate.id} trial ${trial}`);
      try {
        const result = await tracked({
          ledger,
          stage: "compose",
          candidate,
          inputCharacters:
            toneContext.length + JSON.stringify({ report, snapshot, changesSummary }).length,
          maxOutputTokens: 650,
          run: () =>
            composeClientMessage({
              report,
              snapshot,
              toneExamples: toneContext,
              toneProfile,
              changesSummary,
              recipientName: accountName,
              models: candidate.models,
              maxTokens: 650,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            }),
        });
        const checks = checkGeneratedMessage({
          message: result.message,
          sourceData: { snapshot, changesSummary },
          canonicalActivities,
          dateRange: snapshot.dateRange,
          expectedRecipient,
        });
        return {
          trial,
          pass: allChecksPass(checks),
          output: {
            model: result.model,
            message: result.message,
            prompts: result.prompts,
          },
          usage: result.usage,
          checks,
          error: null,
        };
      } catch (error) {
        return {
          trial,
          pass: false,
          output: null,
          usage: null,
          checks: [],
          error: errorMessage(error),
        };
      }
    },
  });
}

async function screenJudge({
  candidate,
  ledger,
  samples,
  sourceFacts,
  goodFactMessage,
  badFactMessage,
  goodVoiceMessage,
  badVoiceMessage,
}: {
  candidate: ModelCandidate;
  ledger: BudgetLedger;
  samples: string[];
  sourceFacts: string;
  goodFactMessage: string;
  badFactMessage: string;
  goodVoiceMessage: string;
  badVoiceMessage: string;
}) {
  return runCandidateTrials({
    candidate,
    runTrial: async (trial) => {
      console.log(`judge ${candidate.id} trial ${trial}`);
      try {
        const factGood = await tracked({
          ledger,
          stage: "fact-judge-good",
          candidate,
          inputCharacters: sourceFacts.length + goodFactMessage.length,
          maxOutputTokens: 320,
          run: () =>
            gradeFactMatch({
              clientMessage: goodFactMessage,
              sourceFacts,
              models: candidate.models,
              maxTokens: 320,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            }),
        });
        const factBad = await tracked({
          ledger,
          stage: "fact-judge-bad",
          candidate,
          inputCharacters: sourceFacts.length + badFactMessage.length,
          maxOutputTokens: 320,
          run: () =>
            gradeFactMatch({
              clientMessage: badFactMessage,
              sourceFacts,
              models: candidate.models,
              maxTokens: 320,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            }),
        });
        const voiceGood = await tracked({
          ledger,
          stage: "voice-judge-good",
          candidate,
          inputCharacters: samples.join("\n").length + goodVoiceMessage.length,
          maxOutputTokens: 280,
          run: () =>
            gradeVoiceMatch({
              clientMessage: goodVoiceMessage,
              samples,
              models: candidate.models,
              maxTokens: 280,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            }),
        });
        const voiceBad = await tracked({
          ledger,
          stage: "voice-judge-bad",
          candidate,
          inputCharacters: samples.join("\n").length + badVoiceMessage.length,
          maxOutputTokens: 280,
          run: () =>
            gradeVoiceMatch({
              clientMessage: badVoiceMessage,
              samples,
              models: candidate.models,
              maxTokens: 280,
              timeoutMs: EVAL_CALL_TIMEOUT_MS,
            }),
        });
        const checks: CheckResult[] = [
          {
            name: "fact-good-accepted",
            pass: factGood.score >= 7,
            detail: `Good factual case scored ${factGood.score}.`,
          },
          {
            name: "fact-bad-rejected",
            pass: factBad.score < 7 && factBad.mismatches.length > 0,
            detail: `Bad factual case scored ${factBad.score}.`,
          },
          {
            name: "voice-good-accepted",
            pass: voiceGood.score >= 8,
            detail: `Real tone example scored ${voiceGood.score}.`,
          },
          {
            name: "voice-bad-rejected",
            pass: voiceBad.score < 8 && voiceBad.mismatches.length > 0,
            detail: `Deliberately wrong voice scored ${voiceBad.score}.`,
          },
        ];
        const usage: OpenRouterUsage = {
          promptTokens:
            (factGood.usage?.promptTokens ?? 0) +
            (factBad.usage?.promptTokens ?? 0) +
            (voiceGood.usage?.promptTokens ?? 0) +
            (voiceBad.usage?.promptTokens ?? 0),
          completionTokens:
            (factGood.usage?.completionTokens ?? 0) +
            (factBad.usage?.completionTokens ?? 0) +
            (voiceGood.usage?.completionTokens ?? 0) +
            (voiceBad.usage?.completionTokens ?? 0),
          totalTokens:
            (factGood.usage?.totalTokens ?? 0) +
            (factBad.usage?.totalTokens ?? 0) +
            (voiceGood.usage?.totalTokens ?? 0) +
            (voiceBad.usage?.totalTokens ?? 0),
          costUsd:
            (factGood.usage?.costUsd ?? 0) +
            (factBad.usage?.costUsd ?? 0) +
            (voiceGood.usage?.costUsd ?? 0) +
            (voiceBad.usage?.costUsd ?? 0),
          provider: null,
          requestId: null,
          latencyMs:
            (factGood.usage?.latencyMs ?? 0) +
            (factBad.usage?.latencyMs ?? 0) +
            (voiceGood.usage?.latencyMs ?? 0) +
            (voiceBad.usage?.latencyMs ?? 0),
          attempts: [
            ...(factGood.usage?.attempts ?? []),
            ...(factBad.usage?.attempts ?? []),
            ...(voiceGood.usage?.attempts ?? []),
            ...(voiceBad.usage?.attempts ?? []),
          ],
          attemptedModels: [
            ...(factGood.usage?.attemptedModels ?? []),
            ...(factBad.usage?.attemptedModels ?? []),
            ...(voiceGood.usage?.attemptedModels ?? []),
            ...(voiceBad.usage?.attemptedModels ?? []),
          ],
        };
        return {
          trial,
          pass: allChecksPass(checks),
          output: {
            model: factGood.model,
            factGood,
            factBad,
            voiceGood,
            voiceBad,
          },
          usage,
          checks,
          error: null,
        };
      } catch (error) {
        return {
          trial,
          pass: false,
          output: null,
          usage: null,
          checks: [],
          error: errorMessage(error),
        };
      }
    },
  });
}

function shuffled<T>(values: T[]) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function buildBlindReview(compose: AnyScreen[]) {
  const finalists = shuffled(compose.filter(isConsistent));
  const mapping: Record<string, string> = {};
  const sections = finalists.map((screen, index) => {
    const letter = String.fromCharCode(65 + index);
    mapping[letter] = screen.candidate.id;
    const outputs = screen.trials
      .map(
        (trial, trialIndex) =>
          `### ${letter}${trialIndex + 1}\n\n${trial.output?.message ?? "(no output)"}\n\n- [ ] Tone acceptable\n- [ ] Facts and recipient acceptable`,
      )
      .join("\n\n");
    return `## Option ${letter}\n\n${outputs}`;
  });
  const markdown = `# Blind client-message review\n\nAll options used the same frozen private data and the same tone file. Model names are intentionally hidden.\n\n${sections.join("\n\n")}\n\n## Your decision\n\n- Preferred option: ___\n- Any unacceptable option: ___\n- Brief reason: ___\n`;
  return { mapping, markdown };
}

function buildTechnicalSummary(payload: ScreeningPayload) {
  const section = (title: string, screens: AnyScreen[]) => {
    const rows = screens.map((screen) => {
      const cost = screen.trials.reduce(
        (sum, trial) => sum + (trial.usage?.costUsd ?? 0),
        0,
      );
      const resolved = [
        ...new Set(
          screen.trials
            .map((trial) => trial.output?.model)
            .filter((model): model is string => Boolean(model)),
        ),
      ].join(", ");
      return `| ${screen.candidate.label} | ${screen.consistentPass ? "PASS" : "FAIL"} | ${screen.trials.length} | ${resolved || "none"} | $${cost.toFixed(6)} |`;
    });
    return `## ${title}\n\n| Candidate | Result | Trials | Resolved model | Actual reported cost |\n|---|---:|---:|---|---:|\n${rows.join("\n")}`;
  };
  return `# Reporting model screening: technical results\n\nTracked total: $${payload.budget.actualOrEstimatedUsd.toFixed(6)}. Target: under $${BUDGET.targetUsd}. Hard stop: $${BUDGET.hardLimitUsd}.\n\n${section("Summary", payload.summary)}\n\n${section("Tone extraction", payload.tone)}\n\n${section("Client message", payload.compose)}\n\n${section("Fact and voice judges", payload.judges)}\n`;
}

async function runScreening(args: Record<string, string | boolean>) {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "Missing OpenRouter key. Configure it in the existing private environment file.",
    );
  }
  const fixture = await readFixture();
  const toneContext = await readFile(TONE_PATH, "utf8");
  const ledger = new BudgetLedger(BUDGET_PATH);
  await ledger.load();

  const snapshot = buildInsightsSnapshot(fixture.rows, fixture.dateRange);
  const promptInput = buildReportPromptInput({
    accountId: fixture.accountId,
    rows: fixture.rows,
    dateRange: fixture.dateRange,
  });
  const activityResult = buildCanonicalActivities(
    fixture.activities as ActivityRecord[],
  );
  const changesSummary = activityResult.summary || null;
  const canonicalActivities = activityResult.canonical as CanonicalActivity[];
  const finalistOnly = String(args.scope ?? "") === "finalists";
  const summaryCandidates = SUMMARY_CANDIDATES;
  const toneCandidates = finalistOnly
    ? TONE_CANDIDATES.filter((candidate) =>
        ["tone-current", "tone-luna"].includes(candidate.id),
      )
    : TONE_CANDIDATES;
  const composeCandidates = finalistOnly
    ? COMPOSE_CANDIDATES.filter((candidate) =>
        ["compose-current", "compose-terra"].includes(candidate.id),
      )
    : COMPOSE_CANDIDATES;
  const judgeCandidates = finalistOnly
    ? JUDGE_CANDIDATES.filter((candidate) => candidate.id === "judge-current")
    : JUDGE_CANDIDATES;

  const spend = snapshot.totals.spend ?? 0;
  const roas = snapshot.totals.roas;
  const goodFactMessage = `Hey ${fixture.expectedRecipient}, during ${fixture.dateRange.label} we spent $${spend}${typeof roas === "number" ? ` with an average ROAS of ${roas}` : ""}.`;
  const badFactMessage =
    `Hey ${fixture.expectedRecipient}, last week we spent $999,999 with a 99 ROAS. I doubled every campaign because that caused performance to improve, and I will scale all budgets again next week.`;
  const samples = splitToneExamples(toneContext).slice(0, 8);
  const goodVoiceMessage =
    samples.find((sample) =>
      sample.toLowerCase().includes(fixture.expectedRecipient.toLowerCase()),
    ) ?? samples[0];
  const badVoiceMessage =
    "PERFORMANCE REPORTING MEMORANDUM\n\nKEY PERFORMANCE METRICS\nThe reporting period has concluded. Stakeholders should review the dashboard.\n\nPERFORMANCE INSIGHTS\nNo further commentary is provided.";
  const estimatedSourceFacts = `${JSON.stringify({ snapshot, changesSummary })}${"x".repeat(3_600)}`;
  const screeningCeiling = estimateScreeningCeiling({
    promptInput,
    toneContext,
    report: null,
    snapshot,
    changesSummary,
    sourceFacts: estimatedSourceFacts,
    samples,
    factMessages: [goodFactMessage, badFactMessage],
    voiceMessages: [goodVoiceMessage, badVoiceMessage],
  });
  console.log(
    `Conservative all-candidates screening ceiling: $${screeningCeiling.toFixed(6)}. Adaptive screening should cost less; every call still checks the $${BUDGET.hardLimitUsd.toFixed(2)} hard stop.`,
  );

  const summary: AnyScreen[] = [];
  for (const candidate of summaryCandidates) {
    summary.push(
      await screenSummary({
        candidate,
        ledger,
        promptInput,
        sourceData: { snapshot, activities: fixture.activities },
      }),
    );
    await writePrivateJson(SCREENING_PROGRESS_PATH, {
      stage: "summary",
      updatedAt: new Date().toISOString(),
      summary,
      budget: ledger.snapshot(),
    });
  }
  const baselineSummary = summary
    .find((screen) => screen.candidate.id === "summary-current")
    ?.trials.find((trial) => trial.pass)?.output?.report;
  if (!baselineSummary) {
    throw new Error("Current summary baseline failed; compose screening cannot be fair.");
  }

  const tone: AnyScreen[] = [];
  for (const candidate of toneCandidates) {
    tone.push(await screenTone({ candidate, ledger, toneContext }));
    await writePrivateJson(SCREENING_PROGRESS_PATH, {
      stage: "tone",
      updatedAt: new Date().toISOString(),
      summary,
      tone,
      budget: ledger.snapshot(),
    });
  }

  const heuristicTone = deriveToneProfile(toneContext);
  const compose: AnyScreen[] = [];
  for (const candidate of composeCandidates) {
    compose.push(
      await screenCompose({
        candidate,
        ledger,
        report: baselineSummary,
        snapshot,
        toneContext,
        toneProfile: heuristicTone,
        changesSummary,
        canonicalActivities,
        expectedRecipient: fixture.expectedRecipient,
        accountName: fixture.accountName,
      }),
    );
    await writePrivateJson(SCREENING_PROGRESS_PATH, {
      stage: "compose",
      updatedAt: new Date().toISOString(),
      summary,
      tone,
      compose,
      budget: ledger.snapshot(),
    });
  }

  const sourceFacts = buildSourceFacts({
    snapshot,
    changesSummary,
  });
  const judges: AnyScreen[] = [];
  for (const candidate of judgeCandidates) {
    judges.push(
      await screenJudge({
        candidate,
        ledger,
        samples,
        sourceFacts,
        goodFactMessage,
        badFactMessage,
        goodVoiceMessage,
        badVoiceMessage,
      }),
    );
    await writePrivateJson(SCREENING_PROGRESS_PATH, {
      stage: "judges",
      updatedAt: new Date().toISOString(),
      summary,
      tone,
      compose,
      judges,
      budget: ledger.snapshot(),
    });
  }

  const blind = buildBlindReview(compose);
  const payload: ScreeningPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    fixtureChecksum: checksum(JSON.stringify(fixture)),
    toneChecksum: checksum(toneContext),
    summary,
    tone,
    compose,
    judges,
    blindMapping: blind.mapping,
    budget: ledger.snapshot(),
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultPath = path.join(PRIVATE_ROOT, `screening-${timestamp}.json`);
  const blindPath = path.join(PRIVATE_ROOT, `blind-review-${timestamp}.md`);
  const technicalPath = path.join(PRIVATE_ROOT, `technical-${timestamp}.md`);
  await writePrivateJson(resultPath, payload);
  await writePrivateJson(LATEST_SCREENING_PATH, payload);
  await writePrivate(blindPath, blind.markdown);
  await writePrivate(technicalPath, buildTechnicalSummary(payload));

  console.log(`Blind review: ${blindPath}`);
  console.log(`Technical results: ${technicalPath}`);
  console.log(
    `Tracked spend: $${payload.budget.actualOrEstimatedUsd.toFixed(6)}; remaining hard-limit room: $${payload.budget.remainingUsd.toFixed(6)}.`,
  );
}

function chooseCheapestConsistent(
  screens: AnyScreen[],
  allowedFamilies: ModelCandidate["family"][],
) {
  return screens
    .filter(
      (screen) =>
        isConsistent(screen) && allowedFamilies.includes(screen.candidate.family),
    )
    .sort(
      (left, right) =>
        (candidateMedianCost(left) ?? Number.POSITIVE_INFINITY) -
        (candidateMedianCost(right) ?? Number.POSITIVE_INFINITY),
    )[0]?.candidate;
}

async function recheckScreening() {
  const screening = await readJson<ScreeningPayload>(LATEST_SCREENING_PATH);
  const fixture = await readFixture();
  const snapshot = buildInsightsSnapshot(fixture.rows, fixture.dateRange);
  const activityResult = buildCanonicalActivities(
    fixture.activities as ActivityRecord[],
  );
  const changesSummary = activityResult.summary || null;
  const canonicalActivities = activityResult.canonical as CanonicalActivity[];
  const baselineSummary = screening.summary
    .find((screen) => screen.candidate.id === "summary-current")
    ?.trials.find((trial) => trial.pass)?.output?.report;
  if (!baselineSummary) {
    throw new Error("The passing current summary is missing from screening results.");
  }

  for (const screen of screening.compose) {
    for (const trial of screen.trials) {
      const message = trial.output?.message;
      if (!message) continue;
      trial.checks = checkGeneratedMessage({
        message,
        sourceData: { snapshot, changesSummary },
        canonicalActivities,
        dateRange: snapshot.dateRange,
        expectedRecipient: fixture.expectedRecipient,
      });
      trial.pass = allChecksPass(trial.checks);
    }
    screen.consistentPass = isConsistent(screen);
  }

  const blind = buildBlindReview(screening.compose);
  screening.generatedAt = new Date().toISOString();
  screening.blindMapping = blind.mapping;
  await writePrivateJson(LATEST_SCREENING_PATH, screening);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blindPath = path.join(PRIVATE_ROOT, `rechecked-blind-review-${timestamp}.md`);
  const technicalPath = path.join(PRIVATE_ROOT, `technical-${timestamp}.md`);
  await writePrivate(blindPath, blind.markdown);
  await writePrivate(technicalPath, buildTechnicalSummary(screening));
  console.log(`Rechecked blind review: ${blindPath}`);
  console.log(`Rechecked technical results: ${technicalPath}`);
}

async function rerunJudgeFinalists() {
  const screening = await readJson<ScreeningPayload>(LATEST_SCREENING_PATH);
  const fixture = await readFixture();
  const toneContext = await readFile(TONE_PATH, "utf8");
  const ledger = new BudgetLedger(BUDGET_PATH);
  await ledger.load();
  const snapshot = buildInsightsSnapshot(fixture.rows, fixture.dateRange);
  const activityResult = buildCanonicalActivities(
    fixture.activities as ActivityRecord[],
  );
  const baselineSummary = screening.summary
    .find((screen) => screen.candidate.id === "summary-current")
    ?.trials.find((trial) => trial.pass)?.output?.report;
  if (!baselineSummary) {
    throw new Error("The passing current summary is missing from screening results.");
  }
  const changesSummary = activityResult.summary || null;
  const sourceFacts = buildSourceFacts({
    snapshot,
    changesSummary,
  });
  const spend = snapshot.totals.spend ?? 0;
  const roas = snapshot.totals.roas;
  const samples = splitToneExamples(toneContext).slice(0, 8);
  const goodFactMessage = `Hey ${fixture.expectedRecipient}, during ${fixture.dateRange.label} we spent $${spend}${typeof roas === "number" ? ` with an average ROAS of ${roas}` : ""}.`;
  const badFactMessage =
    `Hey ${fixture.expectedRecipient}, last week we spent $999,999 with a 99 ROAS. I doubled every campaign because that caused performance to improve, and I will scale all budgets again next week.`;
  const goodVoiceMessage =
    samples.find((sample) =>
      sample.toLowerCase().includes(fixture.expectedRecipient.toLowerCase()),
    ) ?? samples[0];
  const badVoiceMessage =
    "PERFORMANCE REPORTING MEMORANDUM\n\nKEY PERFORMANCE METRICS\nThe reporting period has concluded. Stakeholders should review the dashboard.\n\nPERFORMANCE INSIGHTS\nNo further commentary is provided.";
  const finalistIds = new Set(["judge-current", "judge-deepseek"]);
  const replacements = new Map<string, AnyScreen>();

  for (const candidate of JUDGE_CANDIDATES.filter((item) => finalistIds.has(item.id))) {
    replacements.set(
      candidate.id,
      await screenJudge({
        candidate,
        ledger,
        samples,
        sourceFacts,
        goodFactMessage,
        badFactMessage,
        goodVoiceMessage,
        badVoiceMessage,
      }),
    );
  }

  screening.generatedAt = new Date().toISOString();
  screening.judges = screening.judges.map(
    (screen) => replacements.get(screen.candidate.id) ?? screen,
  );
  screening.budget = ledger.snapshot();
  await writePrivateJson(LATEST_SCREENING_PATH, screening);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const technicalPath = path.join(PRIVATE_ROOT, `technical-${timestamp}.md`);
  await writePrivate(technicalPath, buildTechnicalSummary(screening));
  console.log(`Updated technical results: ${technicalPath}`);
  console.log(
    `Tracked spend: $${screening.budget.actualOrEstimatedUsd.toFixed(6)}; remaining hard-limit room: $${screening.budget.remainingUsd.toFixed(6)}.`,
  );
}

async function runBundleTrial({
  bundle,
  trial,
  fixture,
  toneContext,
  ledger,
}: {
  bundle: {
    id: string;
    label: string;
    summary: ModelCandidate;
    tone: ModelCandidate;
    compose: ModelCandidate;
    voice: ModelCandidate;
    fact: ModelCandidate;
  };
  trial: number;
  fixture: Fixture;
  toneContext: string;
  ledger: BudgetLedger;
}) {
  console.log(`bundle ${bundle.id} trial ${trial}`);
  const snapshot = buildInsightsSnapshot(fixture.rows, fixture.dateRange);
  const promptInput = buildReportPromptInput({
    accountId: fixture.accountId,
    rows: fixture.rows,
    dateRange: fixture.dateRange,
  });
  const activityResult = buildCanonicalActivities(
    fixture.activities as ActivityRecord[],
  );
  const changesSummary = activityResult.summary || null;
  const canonicalActivities = activityResult.canonical as CanonicalActivity[];
  const calls: Array<{ step: string; model: string | null; usage: OpenRouterUsage | null }> = [];

  try {
    const summary = await tracked({
      ledger,
      stage: `bundle-${bundle.id}-summary`,
      candidate: bundle.summary,
      inputCharacters: JSON.stringify(promptInput).length,
      maxOutputTokens: 900,
      run: async () => {
        const result = await generateOpenRouterReportSummary(promptInput, {
          model: bundle.summary.models[0],
          maxTokens: 900,
          timeoutMs: EVAL_CALL_TIMEOUT_MS,
        });
        return { ...result, usage: result.usage as OpenRouterUsage };
      },
    });
    calls.push({ step: "summary", model: summary.model, usage: summary.usage });

    const tone = await tracked({
      ledger,
      stage: `bundle-${bundle.id}-tone`,
      candidate: bundle.tone,
      inputCharacters: toneContext.length,
      maxOutputTokens: 700,
      run: () =>
        buildToneProfile(toneContext, {
          models: bundle.tone.models,
          maxTokens: 700,
          timeoutMs: EVAL_CALL_TIMEOUT_MS,
        }),
    });
    calls.push({ step: "tone", model: tone.model, usage: tone.usage });

    let composed = await tracked({
      ledger,
      stage: `bundle-${bundle.id}-compose`,
      candidate: bundle.compose,
      inputCharacters:
        toneContext.length +
        JSON.stringify({ report: summary.report, snapshot, changesSummary }).length,
      maxOutputTokens: 650,
      run: () =>
        composeClientMessage({
          report: summary.report,
          snapshot,
          toneExamples: toneContext,
          toneProfile: tone.profile,
          changesSummary,
          recipientName: fixture.accountName,
          models: bundle.compose.models,
          maxTokens: 650,
          timeoutMs: EVAL_CALL_TIMEOUT_MS,
        }),
    });
    calls.push({ step: "compose", model: composed.model, usage: composed.usage });

    const sourceFacts = buildSourceFacts({
      snapshot,
      changesSummary,
    });
    let voice = await tracked({
      ledger,
      stage: `bundle-${bundle.id}-voice`,
      candidate: bundle.voice,
      inputCharacters: composed.samples.join("\n").length + composed.message.length,
      maxOutputTokens: 280,
      run: () =>
        gradeVoiceMatch({
          clientMessage: composed.message,
          samples: composed.samples,
          models: bundle.voice.models,
          maxTokens: 280,
          timeoutMs: EVAL_CALL_TIMEOUT_MS,
        }),
    });
    calls.push({ step: "voice", model: voice.model, usage: voice.usage });
    let fact = await tracked({
      ledger,
      stage: `bundle-${bundle.id}-fact`,
      candidate: bundle.fact,
      inputCharacters: sourceFacts.length + composed.message.length,
      maxOutputTokens: 320,
      run: () =>
        gradeFactMatch({
          clientMessage: composed.message,
          sourceFacts,
          models: bundle.fact.models,
          maxTokens: 320,
          timeoutMs: EVAL_CALL_TIMEOUT_MS,
        }),
    });
    calls.push({ step: "fact", model: fact.model, usage: fact.usage });

    const direction = checkActivityDirections(composed.message, canonicalActivities);
    const critique = [
      ...voice.mismatches,
      ...fact.mismatches,
      ...violationsToCritique(direction.violations),
    ];
    const voiceNeedsRegeneration = voice.score < 8;
    const factNeedsRegeneration = fact.score < 7;
    if (
      (!direction.ok || voiceNeedsRegeneration || factNeedsRegeneration) &&
      critique.length
    ) {
      composed = await tracked({
        ledger,
        stage: `bundle-${bundle.id}-regenerate`,
        candidate: bundle.compose,
        inputCharacters:
          toneContext.length +
          JSON.stringify({ summary: summary.report, snapshot, changesSummary, critique }).length,
        maxOutputTokens: 650,
        run: () =>
          composeClientMessage({
            report: summary.report,
            snapshot,
            toneExamples: toneContext,
            toneProfile: tone.profile,
            changesSummary,
            recipientName: fixture.accountName,
            critiqueFeedback: critique,
            models: bundle.compose.models,
            maxTokens: 650,
            timeoutMs: EVAL_CALL_TIMEOUT_MS,
          }),
      });
      calls.push({ step: "regenerate", model: composed.model, usage: composed.usage });

      voice = await tracked({
        ledger,
        stage: `bundle-${bundle.id}-voice-recheck`,
        candidate: bundle.voice,
        inputCharacters: composed.samples.join("\n").length + composed.message.length,
        maxOutputTokens: 280,
        run: () =>
          gradeVoiceMatch({
            clientMessage: composed.message,
            samples: composed.samples,
            models: bundle.voice.models,
            maxTokens: 280,
            timeoutMs: EVAL_CALL_TIMEOUT_MS,
          }),
      });
      calls.push({ step: "voice-recheck", model: voice.model, usage: voice.usage });

      fact = await tracked({
        ledger,
        stage: `bundle-${bundle.id}-fact-recheck`,
        candidate: bundle.fact,
        inputCharacters: sourceFacts.length + composed.message.length,
        maxOutputTokens: 320,
        run: () =>
          gradeFactMatch({
            clientMessage: composed.message,
            sourceFacts,
            models: bundle.fact.models,
            maxTokens: 320,
            timeoutMs: EVAL_CALL_TIMEOUT_MS,
          }),
      });
      calls.push({ step: "fact-recheck", model: fact.model, usage: fact.usage });
    }

    const checks = checkGeneratedMessage({
      message: composed.message,
      sourceData: { snapshot, changesSummary },
      canonicalActivities,
      dateRange: snapshot.dateRange,
      expectedRecipient: fixture.expectedRecipient,
    });
    return {
      trial,
      pass: allChecksPass(checks) && voice.score >= 8 && fact.score >= 7,
      output: {
        message: composed.message,
        report: summary.report,
        toneProfile: tone.profile,
        voice,
        fact,
      },
      checks,
      calls,
      costUsd: calls.reduce((sum, call) => sum + (call.usage?.costUsd ?? 0), 0),
      error: null,
    };
  } catch (error) {
    return {
      trial,
      pass: false,
      output: null,
      checks: [],
      calls,
      costUsd: calls.reduce((sum, call) => sum + (call.usage?.costUsd ?? 0), 0),
      error: errorMessage(error),
    };
  }
}

async function runFinal(args: Record<string, string | boolean>) {
  const selectedLetter = String(args["compose-winner"] ?? "").toUpperCase();
  if (!selectedLetter) {
    throw new Error("Pass --compose-winner A, B, or C after the blind review.");
  }
  const screening = await readJson<ScreeningPayload>(LATEST_SCREENING_PATH);
  const selectedComposeId = screening.blindMapping[selectedLetter];
  const composeWinner = COMPOSE_CANDIDATES.find(
    (candidate) => candidate.id === selectedComposeId,
  );
  if (!composeWinner) throw new Error("The selected blind option is not a passing composer.");

  const lowCostTone = chooseCheapestConsistent(screening.tone, [
    "open-weight",
    "free",
    "updated",
  ]);
  const lowCostJudge = chooseCheapestConsistent(screening.judges, [
    "open-weight",
    "free",
    "updated",
    "current",
  ]);
  if (!lowCostTone || !lowCostJudge) {
    throw new Error(
      "No reliable low-cost tone or judge candidate passed consistently.",
    );
  }
  const fixture = await readFixture();
  const toneContext = await readFile(TONE_PATH, "utf8");
  const ledger = new BudgetLedger(BUDGET_PATH);
  await ledger.load();
  const currentSummary = SUMMARY_CANDIDATES.find((item) => item.id === "summary-current")!;
  const lunaSummary = SUMMARY_CANDIDATES.find((item) => item.id === "summary-luna")!;
  const currentTone = TONE_CANDIDATES.find((item) => item.id === "tone-current")!;
  const lunaTone = TONE_CANDIDATES.find((item) => item.id === "tone-luna")!;
  const currentCompose = COMPOSE_CANDIDATES.find((item) => item.id === "compose-current")!;
  const currentJudge = JUDGE_CANDIDATES.find((item) => item.id === "judge-current")!;
  const lunaJudge = JUDGE_CANDIDATES.find((item) => item.id === "judge-luna")!;
  const bundles = [
    {
      id: "current",
      label: "Current bundle",
      summary: currentSummary,
      tone: currentTone,
      compose: currentCompose,
      voice: currentJudge,
      fact: currentJudge,
    },
    {
      id: "updated",
      label: "Updated bundle",
      summary: lunaSummary,
      tone: lunaTone,
      compose: composeWinner,
      voice: lunaJudge,
      fact: lunaJudge,
    },
    {
      id: "hybrid",
      label: "Low-cost hybrid bundle",
      summary: lunaSummary,
      tone: lowCostTone,
      compose: composeWinner,
      voice: lowCostJudge,
      fact: lowCostJudge,
    },
  ];

  const results = [];
  for (const bundle of bundles) {
    const trials = [
      await runBundleTrial({ bundle, trial: 1, fixture, toneContext, ledger }),
    ];
    if (trials[0].pass) {
      trials.push(await runBundleTrial({ bundle, trial: 2, fixture, toneContext, ledger }));
      trials.push(await runBundleTrial({ bundle, trial: 3, fixture, toneContext, ledger }));
    }
    results.push({ bundle, trials, consistentPass: trials.length === 3 && trials.every((trial) => trial.pass) });
  }

  const randomized = shuffled(results.filter((result) => result.consistentPass));
  const mapping: Record<string, string> = {};
  const sections = randomized.map((result, index) => {
    const letter = String.fromCharCode(65 + index);
    mapping[letter] = result.bundle.id;
    const messages = result.trials
      .map(
        (trial, trialIndex) =>
          `### ${letter}${trialIndex + 1}\n\n${trial.output?.message ?? "(no output)"}\n\n- [ ] Tone acceptable\n- [ ] Facts and recipient acceptable`,
      )
      .join("\n\n");
    return `## Option ${letter}\n\n${messages}`;
  });
  const review = `# Blind final-bundle review\n\n${sections.join("\n\n")}\n\n## Your decision\n\n- Preferred option: ___\n- Any unacceptable option: ___\n- Brief reason: ___\n`;
  const payload = {
    generatedAt: new Date().toISOString(),
    selectedComposeBlindOption: selectedLetter,
    selectedComposeId,
    lowCostToneId: lowCostTone.id,
    openToneQualified: ["open-weight", "free"].includes(lowCostTone.family),
    lowCostJudgeId: lowCostJudge.id,
    openJudgeQualified: ["open-weight", "free"].includes(lowCostJudge.family),
    results,
    blindMapping: mapping,
    budget: ledger.snapshot(),
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = path.join(PRIVATE_ROOT, `final-${timestamp}.json`);
  const reviewPath = path.join(PRIVATE_ROOT, `final-blind-review-${timestamp}.md`);
  await writePrivateJson(resultsPath, payload);
  await writePrivate(reviewPath, review);
  console.log(`Final blind review: ${reviewPath}`);
  console.log(`Final technical results: ${resultsPath}`);
  console.log(
    `Tracked spend: $${payload.budget.actualOrEstimatedUsd.toFixed(6)}; remaining hard-limit room: $${payload.budget.remainingUsd.toFixed(6)}.`,
  );
}

async function runReleaseCandidate() {
  const screening = await readJson<ScreeningPayload>(LATEST_SCREENING_PATH);
  const fixture = await readFixture();
  const toneContext = await readFile(TONE_PATH, "utf8");
  const ledger = new BudgetLedger(BUDGET_PATH);
  await ledger.load();

  const requirePassing = (screens: AnyScreen[], id: string) => {
    const screen = screens.find((candidate) => candidate.candidate.id === id);
    if (!screen?.consistentPass) {
      throw new Error(`Release candidate blocked because ${id} did not pass three trials.`);
    }
    return screen.candidate;
  };

  const bundle = {
    id: "reporting-release-candidate",
    label: "Reporting release candidate",
    summary: requirePassing(screening.summary, "summary-current"),
    tone: requirePassing(screening.tone, "tone-luna"),
    compose: requirePassing(screening.compose, "compose-terra"),
    voice: requirePassing(screening.judges, "judge-current"),
    fact: requirePassing(screening.judges, "judge-current"),
  };

  console.log(
    `Running up to three integrated release-candidate trials. Current tracked spend is $${ledger.snapshot().actualOrEstimatedUsd.toFixed(6)}; the $${BUDGET.hardLimitUsd.toFixed(2)} hard stop remains active before every call.`,
  );
  const trials = [
    await runBundleTrial({ bundle, trial: 1, fixture, toneContext, ledger }),
  ];
  if (trials[0].pass) {
    trials.push(await runBundleTrial({ bundle, trial: 2, fixture, toneContext, ledger }));
    trials.push(await runBundleTrial({ bundle, trial: 3, fixture, toneContext, ledger }));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    bundle,
    trials,
    consistentPass: trials.length === 3 && trials.every((trial) => trial.pass),
    budget: ledger.snapshot(),
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = path.join(PRIVATE_ROOT, `release-candidate-${timestamp}.json`);
  await writePrivateJson(resultsPath, payload);
  console.log(`Release-candidate results: ${resultsPath}`);
  console.log(
    `Result: ${payload.consistentPass ? "PASS" : "FAIL"}. Tracked spend: $${payload.budget.actualOrEstimatedUsd.toFixed(6)}; remaining hard-limit room: $${payload.budget.remainingUsd.toFixed(6)}.`,
  );
}

async function latestReleaseCandidatePath() {
  const candidates = (await readdir(PRIVATE_ROOT))
    .filter((name) => /^release-candidate-.*\.json$/.test(name))
    .sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error("No private release-candidate result was found.");
  return path.join(PRIVATE_ROOT, latest);
}

async function recheckLatestReleaseCandidate() {
  const sourcePath = await latestReleaseCandidatePath();
  const source = await readJson<{
    bundle: {
      voice: ModelCandidate;
      fact: ModelCandidate;
    };
    trials: Array<{
      trial: number;
      pass: boolean;
      output: { message: string; report: GeneratedReport } | null;
    }>;
  }>(sourcePath);
  const fixture = await readFixture();
  const toneContext = await readFile(TONE_PATH, "utf8");
  const samples = splitToneExamples(toneContext).slice(0, 8);
  const snapshot = buildInsightsSnapshot(fixture.rows, fixture.dateRange);
  const activityResult = buildCanonicalActivities(
    fixture.activities as ActivityRecord[],
  );
  const changesSummary = activityResult.summary || null;
  const ledger = new BudgetLedger(BUDGET_PATH);
  await ledger.load();

  const results = [];
  for (const trial of source.trials) {
    const output = trial.output;
    if (!output) {
      results.push({ trial: trial.trial, pass: false, error: "No output to recheck." });
      continue;
    }
    const sourceFacts = buildSourceFacts({
      snapshot,
      changesSummary,
    });
    try {
      const voice = await tracked({
        ledger,
        stage: "release-recheck-voice",
        candidate: source.bundle.voice,
        inputCharacters: samples.join("\n").length + output.message.length,
        maxOutputTokens: 280,
        run: () =>
          gradeVoiceMatch({
            clientMessage: output.message,
            samples,
            models: source.bundle.voice.models,
            maxTokens: 280,
            timeoutMs: EVAL_CALL_TIMEOUT_MS,
          }),
      });
      const fact = await tracked({
        ledger,
        stage: "release-recheck-fact",
        candidate: source.bundle.fact,
        inputCharacters: sourceFacts.length + output.message.length,
        maxOutputTokens: 320,
        run: () =>
          gradeFactMatch({
            clientMessage: output.message,
            sourceFacts,
            models: source.bundle.fact.models,
            maxTokens: 320,
            timeoutMs: EVAL_CALL_TIMEOUT_MS,
          }),
      });
      results.push({
        trial: trial.trial,
        pass: trial.pass && voice.score >= 8 && fact.score >= 7,
        voiceScore: voice.score,
        voiceMismatchCount: voice.mismatches.length,
        factScore: fact.score,
        factMismatchCount: fact.mismatches.length,
        costUsd: (voice.usage?.costUsd ?? 0) + (fact.usage?.costUsd ?? 0),
        error: null,
      });
    } catch (error) {
      results.push({
        trial: trial.trial,
        pass: false,
        error: errorMessage(error),
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(sourcePath),
    results,
    consistentPass: results.length === 3 && results.every((result) => result.pass),
    budget: ledger.snapshot(),
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = path.join(PRIVATE_ROOT, `release-recheck-${timestamp}.json`);
  await writePrivateJson(resultsPath, payload);
  console.log(`Release recheck: ${resultsPath}`);
  console.log(
    `Result: ${payload.consistentPass ? "PASS" : "FAIL"}. Tracked spend: $${payload.budget.actualOrEstimatedUsd.toFixed(6)}.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const phase = String(args.phase ?? "");
  await ensurePrivateRoot();
  if (phase === "fetch") {
    await fetchFixture(String(args["tone-file"] ?? ""), args);
    return;
  }
  if (phase === "screen") {
    await runScreening(args);
    return;
  }
  if (phase === "judge-finalists") {
    await rerunJudgeFinalists();
    return;
  }
  if (phase === "recheck") {
    await recheckScreening();
    return;
  }
  if (phase === "final") {
    await runFinal(args);
    return;
  }
  if (phase === "release") {
    await runReleaseCandidate();
    return;
  }
  if (phase === "release-recheck") {
    await recheckLatestReleaseCandidate();
    return;
  }
  throw new Error(
    "Use --phase fetch, --phase screen, --phase recheck, --phase judge-finalists, --phase final, --phase release, or --phase release-recheck.",
  );
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
