# Metis AI Waitlist

A Next.js waitlist landing page for Metis AI, designed for Vercel deployment with Supabase-backed email capture.

## Local development

Install dependencies:

```bash
npm install
```

Copy the environment example:

```bash
cp .env.local.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup

Run the SQL in [supabase/waitlist.sql](/Users/adi/my-weekender-project/supabase/waitlist.sql) inside the Supabase SQL Editor.

That creates:

- `public.waitlist_signups`
- a case-insensitive unique index on email
- row level security enabled on the table

This app writes to Supabase through the server-side route at `src/app/api/waitlist/route.ts`, using the service role key on the server only.

## Deploy on Vercel

Add these environment variables in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then deploy normally on Vercel.
