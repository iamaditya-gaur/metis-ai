# Reporting model comparison

This harness compares the reporting workflow without sending Slack messages,
writing Supabase run logs, or changing production model configuration.

Private data is written only to `.private-evals/reporting-model-comparison/`,
which is ignored by Git. Files are created with owner-only permissions.

## Fixed test input

- Account identity: derived from the private frozen Meta fixture
- Reporting window: 24–30 August 2026
- Tone context: exactly nine supplied examples
- Current prompt limits remain unchanged: six examples for tone extraction and
  eight examples for composition

## Run

Load credentials from an existing ignored environment file. Never put keys in
command arguments or commit them.

```bash
node --env-file=/path/to/private/.env.local ./node_modules/tsx/dist/cli.mjs \
  evals/reporting-model-comparison/run.ts \
  --phase fetch \
  --tone-file '/path/to/Weekly Summary Format.txt'

node --env-file=/path/to/private/.env.local ./node_modules/tsx/dist/cli.mjs \
  evals/reporting-model-comparison/run.ts --phase screen
```

The screening phase creates a blind review Markdown file. After the product
reviewer chooses A, B, or C, run the full bundles:

```bash
node --env-file=/path/to/private/.env.local ./node_modules/tsx/dist/cli.mjs \
  evals/reporting-model-comparison/run.ts \
  --phase final \
  --compose-winner A
```

For a monthly run, use a separate ignored directory so weekly evidence remains
unchanged:

```bash
METIS_EVAL_PRIVATE_DIR=.private-evals/reporting-model-comparison-monthly \
node --env-file=/path/to/private/.env.local ./node_modules/tsx/dist/cli.mjs \
  evals/reporting-model-comparison/run.ts \
  --phase fetch \
  --from 2026-08-01 \
  --to 2026-08-31 \
  --tone-file '/path/to/private-tone-context.txt'

METIS_EVAL_PRIVATE_DIR=.private-evals/reporting-model-comparison-monthly \
node --env-file=/path/to/private/.env.local ./node_modules/tsx/dist/cli.mjs \
  evals/reporting-model-comparison/run.ts \
  --phase screen \
  --scope finalists
```

The fixture stores the Meta-returned account name privately and derives the
required recipient from it. Do not pass a client name in command arguments or
add one to committed tests.

After the selected summary, tone, compose, and judge candidates each pass three
screening runs, test their exact production bundle end to end:

```bash
METIS_EVAL_PRIVATE_DIR=.private-evals/reporting-model-comparison-monthly \
node --env-file=/path/to/private/.env.local ./node_modules/tsx/dist/cli.mjs \
  evals/reporting-model-comparison/run.ts --phase release
```

The release phase stops after the first failed run. It never tests rejected
bundles, which keeps spend focused on the intended production configuration.
If a message is rewritten, the voice and fact judges score the rewritten text
again. The `release-recheck` phase applies that final judge check to an earlier
private release result without rerunning the more expensive generation steps.

## Spending rules

- Target: under $1 total
- Hard stop: $3 total across screening and final phases
- Each call reserves a conservative estimate before execution
- Failed or unpriced responses are charged to the local ledger using that
  estimate
- Explicit free models are allowed; `openrouter/free` is forbidden
