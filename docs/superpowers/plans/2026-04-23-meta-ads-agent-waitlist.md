# Meta Ads Agent Waitlist Plan

## Goal

Build a high-converting waitlist landing page for a `Meta Ads Agent` and deploy it on Vercel with Supabase-backed email capture.

The page should communicate two product pillars from the scope image:

- `Builder`: collects brand website URL, objective, and the user’s required deliverable depth; outputs brand analysis, ad copy, and campaign strategy.
- `Reporting`: collects date range and past messages; outputs a summary report.

## Primary Conversion Goal

Capture qualified waitlist signups with email submission as the main CTA.

## Page Structure

1. Hero
   - Headline
   - Subheadline
   - Primary waitlist form
   - Lightweight proof / trust strip
2. What The Agent Does
   - Two-column explanation of `Builder` and `Reporting`
3. Outcome Benefits
   - Faster launch planning
   - Better copy consistency
   - Reporting clarity
4. How It Works
   - Input brand context
   - Generate strategy and copy
   - Review reporting output
5. Final CTA
   - Repeat waitlist form or CTA block

## Files To Modify

- `src/app/page.tsx`
  - Replace starter content with the landing page UI.
- `src/app/globals.css`
  - Define the visual system, color variables, typography, spacing, and global effects.
- `src/app/layout.tsx`
  - Update metadata for title, description, and social sharing basics.
- `src/app/api/waitlist/route.ts`
  - Add a server-side POST endpoint to validate and insert waitlist signups into Supabase.
- `src/components/waitlist-form.tsx`
  - Client form component with loading, success, and error states.
- `src/components/hero.tsx`
  - Hero section with messaging and CTA.
- `src/components/feature-sections.tsx`
  - Builder / Reporting explanation and benefit blocks.
- `src/components/final-cta.tsx`
  - Bottom conversion section.
- `.env.local.example`
  - Document required environment variables.
- `supabase/waitlist.sql`
  - SQL schema for the waitlist table and basic constraints.
- `README.md`
  - Add setup notes for Supabase env vars and local run instructions.

## Execution Order

### Step 1. Planning

- Translate the scope image into page sections and content requirements.
- Lock the component structure before writing copy or design code.

### Step 2. Messaging

- Produce two copy directions for the page.
- Choose one direction for implementation.
- Finalize:
  - Hero headline
  - Hero subheadline
  - Benefit statements
  - Form label, placeholder, CTA, and success message

### Step 3. Design

- Pick a distinct design direction with a clear palette and typography system.
- Avoid generic SaaS gradients and default font stacks.
- Define:
  - Background treatment
  - Section rhythm
  - Card styling
  - CTA styling
  - Responsive behavior

### Step 4. Frontend Build

- Build the landing page in small server-first components.
- Keep bundle size small by avoiding unnecessary client components.
- Make the waitlist form the only client-interactive element.
- Ensure the layout works on mobile and desktop.

### Step 5. Backend Integration

- Create a `waitlist_signups` table in Supabase.
- Add a Next.js API route that inserts emails into Supabase.
- Validate email input and handle duplicate submissions gracefully.
- Document required environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Step 6. Verification

- Run lint.
- Start the dev server.
- Test one successful form submission path.
- Confirm the page is deployable on Vercel and the env vars are documented.

## Notes

- The scope does not include full product screenshots, so the page should sell the workflow and outcomes rather than fake dashboard imagery.
- The product promise should stay concrete: strategy, copy, and reporting for Meta ads teams.
- The waitlist form should ask for email only in v1 to minimize friction.
