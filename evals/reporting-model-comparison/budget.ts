import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { BUDGET, estimateCallCostUsd } from "./config";

type BudgetCall = {
  stage: string;
  candidateId: string;
  estimatedUsd: number;
  chargedUsd: number;
  usedEstimate: boolean;
  status: "success" | "error";
  at: string;
};

type BudgetState = {
  actualOrEstimatedUsd: number;
  reservedUsd: number;
  calls: BudgetCall[];
};

const EMPTY_STATE: BudgetState = {
  actualOrEstimatedUsd: 0,
  reservedUsd: 0,
  calls: [],
};

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, filePath);
}

function isBudgetState(value: unknown): value is BudgetState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<BudgetState>;
  return (
    typeof state.actualOrEstimatedUsd === "number" &&
    Number.isFinite(state.actualOrEstimatedUsd) &&
    state.actualOrEstimatedUsd >= 0 &&
    typeof state.reservedUsd === "number" &&
    Number.isFinite(state.reservedUsd) &&
    state.reservedUsd >= 0 &&
    Array.isArray(state.calls)
  );
}

export class BudgetLedger {
  private state: BudgetState = structuredClone(EMPTY_STATE);

  constructor(private readonly filePath: string) {}

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      if (!isBudgetState(parsed)) {
        throw new Error("Budget ledger has an invalid shape.");
      }
      this.state = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(
          "Budget ledger could not be read safely. Restore it before making more model calls.",
          { cause: error },
        );
      }
      this.state = structuredClone(EMPTY_STATE);
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      ...this.state,
      targetUsd: BUDGET.targetUsd,
      hardLimitUsd: BUDGET.hardLimitUsd,
      remainingUsd: Math.max(
        0,
        BUDGET.hardLimitUsd -
          this.state.actualOrEstimatedUsd -
          this.state.reservedUsd,
      ),
    };
  }

  async trackedCall<T>({
    stage,
    candidateId,
    models,
    inputCharacters,
    maxOutputTokens,
    run,
    getCostUsd,
  }: {
    stage: string;
    candidateId: string;
    models: string[];
    inputCharacters: number;
    maxOutputTokens: number;
    run: () => Promise<T>;
    getCostUsd: (result: T) => number | null | undefined;
  }): Promise<T> {
    const estimatedUsd = estimateCallCostUsd({
      models,
      inputCharacters,
      maxOutputTokens,
    });
    const projected =
      this.state.actualOrEstimatedUsd + this.state.reservedUsd + estimatedUsd;

    if (projected > BUDGET.hardLimitUsd) {
      throw new Error(
        `Budget stop: ${stage}/${candidateId} could raise tracked spend above $${BUDGET.hardLimitUsd.toFixed(2)}.`,
      );
    }

    this.state.reservedUsd += estimatedUsd;
    await writePrivateJson(this.filePath, this.state);

    try {
      const result = await run();
      const actual = getCostUsd(result);
      const chargedUsd =
        typeof actual === "number" && Number.isFinite(actual)
          ? Math.max(0, actual)
          : estimatedUsd;
      this.state.reservedUsd = Math.max(0, this.state.reservedUsd - estimatedUsd);
      this.state.actualOrEstimatedUsd += chargedUsd;
      this.state.calls.push({
        stage,
        candidateId,
        estimatedUsd,
        chargedUsd,
        usedEstimate: actual === null || actual === undefined,
        status: "success",
        at: new Date().toISOString(),
      });
      await writePrivateJson(this.filePath, this.state);
      return result;
    } catch (error) {
      // A model can be billed even when its response is invalid JSON. Charge
      // the conservative estimate when the API helper cannot return usage.
      this.state.reservedUsd = Math.max(0, this.state.reservedUsd - estimatedUsd);
      this.state.actualOrEstimatedUsd += estimatedUsd;
      this.state.calls.push({
        stage,
        candidateId,
        estimatedUsd,
        chargedUsd: estimatedUsd,
        usedEstimate: true,
        status: "error",
        at: new Date().toISOString(),
      });
      await writePrivateJson(this.filePath, this.state);
      throw error;
    }
  }
}
