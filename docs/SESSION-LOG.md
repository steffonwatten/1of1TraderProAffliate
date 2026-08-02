# Session log — 1of1-trader-backoffice

**Every change made to this codebase: why, what it should do, and how it was
verified. Newest entry at the top.**

This is the client-facing record of the work. It is also what lets a session pick
this up cold without re-investigating things that have already been decided.

**Conventions** (from `playbook/PLAYBOOK.md` §9):

- Newest session at the top; **handoff block first**
- One entry per change, with the commit hash
- Always: **problem → change → expected result → how it was verified**
- Record what was **not** done and why — usually the more useful half
- Distinguish **MEASURED** from **INFERRED** in every claim
- **Corrections stay visible.** Never edit away a claim that was made and later
  withdrawn. On a prior engagement roughly a dozen findings had to be withdrawn
  or downgraded mid-audit — that is the normal rate, and a diagnosis is only as
  credible as the ideas it ruled out.

---

## 🔀 HANDOFF — read this first

**Status:** TODO
**Last verified:** TODO
**Deployed?** TODO — and by whom, and confirmed how

### Resume order

1. TODO — the next thing to do, and why it is first

### Open

| Item | Why it matters | Blocked on |
|---|---|---|
| TODO | | |

### Closed / declined — do not re-investigate

| Item | Why it was closed |
|---|---|
| TODO | |

### 🔴 Manual steps the client must do by hand

> Things no push can accomplish — password resets, dashboard settings, SQL to run
> in a specific database pane. These get lost otherwise.

| Step | Why | Done? |
|---|---|---|
| TODO | | |

---

## Session N — TODO date

**Present:** TODO

### N.1 — TODO title

**Problem.** TODO — what was actually wrong, and how you know. MEASURED or
INFERRED?

**Change.** TODO — what was done. Commit `TODO`.

**Expected result.** TODO — what should now be different.

**Verified by.** TODO — **the right signal**, not "typecheck passed". On a prior
engagement a change passed typecheck, lint and a full test suite while leaving an
entire interface unstyled. Ask what would actually break if this were wrong, then
check that.

---

### Considered and NOT done

> This half has already stopped work being repeated, and stopped a fix landing
> that would have broken outbound customer messaging. Fill it in properly.

| Considered | Why not |
|---|---|
| TODO | |

---

### Corrections to earlier entries

> Do not edit the original. Add here, and say what was wrong and how it was
> found. A confident wrong explanation costs more than no explanation, because
> it stops the search.

| Entry | What it claimed | What is actually true |
|---|---|---|
| TODO | | |
