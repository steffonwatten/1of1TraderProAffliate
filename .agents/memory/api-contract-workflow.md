---
name: API contract workflow (openapi → orval → typed client)
description: How the typed API contract is maintained and the typecheck gotchas in this pnpm monorepo
---

# OpenAPI is the hand-maintained source of truth
- `lib/api-spec/openapi.yaml` is hand-written. It must match what the Express backend
  actually returns (`res.json(...)` is the runtime truth) AND what the frontend consumes.
- After editing the spec, regenerate the typed client + zod:
  `pnpm --filter @workspace/api-spec run codegen` (orval).
- Each endpoint needs a response schema that matches its OWN backend shape. Do not reuse
  one schema across endpoints that return different shapes (e.g. affiliate vs admin payouts
  must be separate schemas), or the frontend is forced to mask the mismatch with `as any`.

# Typecheck gotcha: composite project references + stale dist
**Rule:** to typecheck the whole repo reliably, run root `pnpm run typecheck` (it runs
`typecheck:libs` = `tsc --build` first), and FIRST delete stale build info:
`rm -f lib/*/tsconfig.tsbuildinfo artifacts/*/tsconfig.tsbuildinfo`.

**Why:** artifacts consume `@workspace/api-client-react` via its emitted `dist/*.d.ts`
(composite project reference, `emitDeclarationOnly`). Running an artifact's typecheck in
isolation, or leaving stale `tsbuildinfo`, makes it read OLD declarations and either hides
real errors or reports phantom ones. Removing tsbuildinfo + `tsc --build` rebuilds the
lib declarations so the artifact sees the current generated types.

# Build needs env vars
- `affiliate-dashboard` vite build requires `PORT` and `BASE_PATH` at config load time;
  `api-server` build needs `PORT`. The deploy pipeline injects these. A bare local
  `pnpm run build` fails on missing env vars — that is expected, not a real build break.
- `mockup-sandbox` is a dev-only design tool and is not part of the deployable product;
  its build failing on a missing `PORT` locally is irrelevant to deploys.
