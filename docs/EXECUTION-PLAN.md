# Execution plan — 1of1-trader-backoffice

**Status board and ordered backlog for this application.**

🔴 **Ordered by value, not by ease and not by how interesting the problem is.**
On a prior engagement real effort went into a change worth a couple of dollars a
month while a much larger one sat untouched.

> **The interesting problem and the expensive problem are rarely the same one.**

Legend: 🔴 blocking / security · 🟡 valuable · 🟢 free win
**C** = Claude can do it · **R** = requires the client

---

## Status board

| # | Item | Worth | Owner | Status |
|---|---|---|---|---|
| TODO | | | C/R | |

**Last updated:** TODO
**Deploys blocked?** TODO — check. A delinquent invoice silently stops
publishing, and any document that says otherwise may be stale. **Fix the
document rather than working around it.**

---

## Phase 0 — before anything is pushed anywhere

> Everything here gates every later phase. Do not start Phase 1 with any of this
> open.

### 0.1 🔴 Client authorisation — R

Written confirmation to access the code, the invoices and the database. Not
verbal.

### 0.2 🔴 Rotate any exposed secret — C then R

Deleting a commit does not un-publish a secret. **Rotate first**, then remove.

⚠️ **A redaction is not a fix.** On a prior engagement scrubbing a secret to a
placeholder left a working-looking config that then became production's live
value, and more than a day of customer replies were rejected — including several
opt-out requests. See `.claude/rules/GENERAL-secrets.md`.

### 0.3 🔴 Confirm no customer data reached this repo — C

```bash
git log --all --pretty=format: --name-only | sort -u | grep -E "^(exports|attached_assets|reports)/"
git ls-files | grep -iE "\.(csv|env|png|jpg|sql|dump|pem|key|xlsx)$"
```

**And separately: is it still live in the platform's own history?** A fresh-history
import keeps it out of *your* repo; it does nothing about theirs. Record the
answer, because it decides whether that workspace is ever safe to connect to
GitHub.

### 0.4 🟡 Breach-notification obligations — R

If customer data was exposed, that is a decision for the client, in writing. Do
not decide it silently by omission.

---

## Phase 1 — security, independent of cost work

> These do not wait for the cost work and are not traded off against it.

| # | Item | Why | Owner |
|---|---|---|---|
| 1.1 | TODO | | |

Common shapes worth checking for, from prior engagements:

- **An unauthenticated route serving customer documents.** Check the router's
  mount order — anything mounted above the auth middleware is public.
- **An auth gate that fails open.** `NODE_ENV !== "production"` turns an unset or
  misspelled variable into a full admin. Invert it to require two explicit
  conditions.
- **A default admin password still live.** Check, do not assume.
- **Webhooks authenticated only by a shared secret** that has been in git.
- **Missing crash and shutdown handlers**, so a rejected promise takes the
  process down silently.

⚠️ **Beware the obvious fix.** On a prior engagement the obvious way to gate an
unauthenticated storage endpoint would have broken outbound customer messaging,
which depended on it. That was caught because it was written down, not because
someone remembered.

---

## Phase 2 — separate build from host

The saving. See `playbook/PLAYBOOK.md` §2 and `playbook/CLIENT-ACCESS.md`.

| # | Step | Status |
|---|---|---|
| 2.1 | Export, scan, import with fresh history, push private | |
| 2.2 | Prove the round trip with a trivial change | |
| 2.3 | Make the platform track the repo; remote named `origin` | |
| 2.4 | CI green before the client pushes anything real | |
| 2.5 | Read-only production database access | |
| 2.6 | Client builds one thing unaided | |

**2.6 is the only test that counts.**

---

## Phase 3 — fix the defects

| # | Fix | Worth/month | Effort | Status |
|---|---|---|---|---|
| 3.1 | **Guardrails first** — linter, CI, size ceiling | — | | |
| 3.2 | TODO | | | |

**Guardrails first, deliberately.** Fixing the code before the guardrails exist
means it regrows.

---

## Phase 4 — free wins

> Anything that takes minutes. Do these whenever there is a gap.

| Item | Status |
|---|---|
| TODO | |

---

## 🔴 Manual steps only the client can do

> No push accomplishes these, and they get lost otherwise. Chase them
> explicitly.

| Step | Why | Asked | Done |
|---|---|---|---|
| TODO | | | |

---

## ⏳ Do not forget — deferred work

> Things deliberately staged and not shipped, with the condition that unblocks
> them. **Include the failure mode to watch for**, or the next session will not
> know what it is looking at.

| Item | Blocked on | Failure mode if done wrong |
|---|---|---|
| TODO | | |

---

## Open questions

| Question | Who can answer | Why it matters |
|---|---|---|
| TODO | | |

**Ask what the system is FOR before encoding what it should do.** On a prior
engagement one sentence from the client's risk team replaced guessed domain logic
with a simpler and correct rule. **Their verbal explanation of their own domain
outranks your reading of the schema.**
