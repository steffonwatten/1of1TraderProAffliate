# Project map — 1of1-trader-backoffice

<!-- ─────────────────────────────────────────────────────────────────────────
     🔴 GENERATE THIS FILE. DO NOT MAINTAIN IT BY HAND.

     A map maintained by hand is a map that will be wrong, and a wrong map costs
     MORE than no map: an AI follows it, finds nothing, and reads the whole tree
     — which is the exact cost the map exists to prevent. This has already
     happened on a prior engagement.

     Write a `map` script that walks the tree and emits this file, then make CI
     fail when it is stale:

         pnpm run map
         git diff --exit-code docs/PROJECT-MAP.md

     Until that script exists, treat everything below as provisional and verify
     any path before relying on it.
───────────────────────────────────────────────────────────────────────── -->

> **Use this file to FIND things. Use `CLAUDE.md` to UNDERSTAND them.**
>
> Generated — run `pnpm run map` after adding any file, route, worker or table.
> CI fails if it is stale.

**Generated:** TODO
**Total:** TODO files, TODO lines

---

## Screen → page → route → table

The lookup that means nobody has to read a large file to find where something
lives.

| Screen | Page file | API route file | Main table(s) |
|---|---|---|---|
| TODO | | | |

---

## Routes

| Method | Path | Handler | Auth |
|---|---|---|---|
| TODO | | | |

🔴 **Mark the auth boundary explicitly.** Anything mounted above the auth
middleware is reachable by anyone on the internet. On a prior engagement that
mount order was the security boundary of the entire application and it was a
single line number.

---

## Background jobs

| File | Cadence | What it does | Gated by |
|---|---|---|---|
| TODO | | | |

**Every one of these needs a gate that can be turned off on a non-hosting copy.**
See `.env.example`.

---

## Database tables

| Table | Schema file | Rows (prod, approx) | Notes |
|---|---|---|---|
| TODO | | | |

---

## 🔴 The over-400-line backlog

**Shrink-only.** A listed file may get smaller. It may not get bigger, and
nothing new joins the list.

| File | Lines | Over by |
|---|---|---|
| TODO | | |

**Count over 400:** TODO
**Count over 800:** TODO
**Largest:** TODO

---

## Generated — do not read, do not edit

| Directory | Generated from | Lines |
|---|---|---|
| TODO | | |

Excluding these from AI context is a direct cost saving: on a prior engagement
generated code was a large fraction of one repository, and every line a metered
agent read was billed.
