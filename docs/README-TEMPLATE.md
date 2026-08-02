<!-- Rename to README.md at the repo root. This is the application's own README —
     what it is, how to run it, hazards FIRST. -->

# 1of1-trader-backoffice

TODO — one paragraph. What this application does, for whom, and what breaks in
the business if it stops.

---

## 🔴 Before you run anything

> **Hazards first, deliberately.** On a prior engagement the dangerous variable
> was documented halfway down a file nobody read to the end of, and a
> development machine started writing to live production records within seconds
> of first boot.

- **`WORKERS_ENABLED=false` on every copy that is not the host.** Background jobs
  frequently default to ON. A second worker fleet against a live database does
  not fail loudly — it double-sends customer messages and double-writes records.
- **The database credential is READ-ONLY.** It cannot write, update or delete.
  That is intentional. If you need a write, say so and it becomes a separate
  decision.
- **Never commit customer data.** No CSV, XLSX, VCF, no `exports/`,
  `attached_assets/`, `reports/`, `screenshots/`. See `.gitignore`.
- **Secrets go in the platform's secrets store or `.env`. Nowhere else.**

---

## Running it

```bash
TODO install    # the package manager is pinned in package.json — use corepack
TODO dev
```

Then open TODO.

⚠️ **Verify the frontend can actually reach the API in dev.** In production the
API and the built frontend are usually served from one origin, so the generated
client uses relative paths. Run the frontend on its own port without a proxy
entry and every API call 404s. **Start it the way the client will start it.**

---

## Checks

```bash
TODO typecheck   # must be 0
TODO lint        # must be 0 errors
TODO test        # check the COUNT, not just the exit code
TODO build       # the only check that catches an unstyled UI
```

**Typecheck is not proof.** On a prior engagement a change passed typecheck, lint
and a full test suite while leaving the entire interface unstyled.

---

## Deploying

```
push  →  GitHub  →  the platform pulls  →  publish  →  live site
```

CI must be green first. Pushing does not make it live.

🔴 **If the change adds a database table, it will not exist in production**, and
creating it in production *alone* guarantees a destructive migration on the next
publish. Run the `CREATE TABLE IF NOT EXISTS` in **both** the development and the
production database, then expand the migration list before approving. See
`.claude/rules/GENERAL-finishing-work.md`.

---

## Where to look

| | |
|---|---|
| Where code lives, and the traps | `CLAUDE.md` |
| Find a file, route, worker or table | `docs/PROJECT-MAP.md` (generated) |
| What changed and why | `docs/SESSION-LOG.md` |
| Known defects | `docs/AUDIT.md` |
| The rules every session follows | `.claude/rules/` |
