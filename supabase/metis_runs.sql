-- Persistent run log for Metis AI agentic workflows.
-- Replaces the ephemeral /tmp/.jsonl writes that get wiped between Vercel
-- serverless invocations. Service-role inserts only; RLS keeps the table
-- private (no public policies). Anonymous Supabase clients can't read it.

create table if not exists public.metis_runs (
  id bigint generated always as identity primary key,
  run_id text not null unique,
  flow_type text not null,
  status text not null,
  env text not null default 'unknown',
  selected_account_id text,
  model text,
  summary text,
  started_at timestamptz not null,
  finished_at timestamptz,
  -- Aggregate LLM economics for the run.
  total_prompt_tokens integer,
  total_completion_tokens integer,
  total_tokens integer,
  total_cost_usd numeric(12, 6),
  total_latency_ms integer,
  -- Structured per-call detail. Each item in llm_calls maps to one
  -- OpenRouter invocation with model, status, usage, latency, errors.
  llm_calls jsonb not null default '[]'::jsonb,
  agent_steps jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  artifacts jsonb not null default '[]'::jsonb,
  -- When the row was written, separate from when the run started.
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists metis_runs_started_at_desc_idx
  on public.metis_runs (started_at desc);

create index if not exists metis_runs_flow_account_idx
  on public.metis_runs (flow_type, selected_account_id, started_at desc);

create index if not exists metis_runs_env_idx
  on public.metis_runs (env, started_at desc);

alter table public.metis_runs enable row level security;

comment on table public.metis_runs is
  'Durable log of every Metis AI reporting/builder run. Inserted by service-role only; RLS blocks public access.';
