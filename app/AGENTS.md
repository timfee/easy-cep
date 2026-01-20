# app Directory Guide

Keep App Router entries focused on composition and layout.
Prefer Next.js primitives (metadata, layout, page) over custom wrappers.

## Workflow SSE Routes

- SSE endpoints live under `app/api/workflow/steps/[stepId]/stream/route.ts`.
- Keep handlers minimal: parse inputs, resolve tokens from cookies, stream `StepStreamEvent` data.
- Do not accept provider access tokens via query params.
