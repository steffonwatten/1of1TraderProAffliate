# Code quality — 1of1-trader-backoffice

**Why the AI agent line is what it is.** `ARCHITECTURE.md` describes the shape;
this describes the *practice* that produced it, and what changes it.

**Be fair.** These codebases are usually not bad — they are codebases written
fast, by an AI, under a client who needed the feature yesterday. Say what is
genuinely good as well as what is not. An audit that finds only faults reads as
sales copy and gets discounted accordingly.

---

## What is good here

> Fill this in honestly and first.

| Practice | Evidence |
|---|---|
| TODO | |

On a prior engagement the codebases were genuinely strong on comments explaining
*intent* — and several audit findings were only reachable because of it,
including one that identified a scheduler as dead code.

---

## What makes changes expensive

| Practice | Consequence | Evidence |
|---|---|---|
| Append-to-open-file growth | every change to a large file is billed as a full read | TODO |
| No file-size ceiling | TODO | |
| Duplication across apps | every fix made twice, or they drift | TODO |
| Dead code left in place | read by the agent, billed, never useful | TODO |
| Generated code in context | TODO | |

---

## Verification practice

**Typecheck is not proof.** On a prior engagement a change passed typecheck, lint
**and a full test suite** while leaving the entire user interface unstyled. The
CSS bundle size was the only signal that caught it.

| Check | Exists? | Actually catches |
|---|---|---|
| Typecheck | TODO | |
| Lint | TODO | |
| Tests | TODO — and **how many run**, not just the exit code | |
| Build | TODO | the only check that catches an unstyled UI |
| CI gate on deploy | TODO | |

⚠️ **Tests can fail at import and report "no tests"** rather than a failure —
green-ish output nobody investigates. **Check the count.**

⚠️ **Check what the tests actually assert.** On a prior engagement three tests
were verifying nothing: two stale mocks, and one that deliberately disabled the
security check it existed to cover.

---

## Guardrails to add, and how to land them

```js
"max-lines": ["warn", { max: 400 }]           // append-only growth
"no-restricted-imports"                        // apps must not import each other
"@typescript-eslint/no-unused-vars": "error"   // dead code before it accumulates
```

🔴 **Tune the config so the codebase passes on the day it lands.** A linter that
fails immediately gets deleted, and then there is no linter.

`max-lines` stays a **warning** deliberately: visible on every run, never blocks
a release. Where it can be an error, grandfather the existing offenders into a
**shrink-only** list — a listed file may get smaller, never bigger, and nothing
new joins the list.

**Enforce mechanically, not by documentation.** A rule that lives only in a
markdown file is a rule that will be broken by the next session that does not
read it — which is why the shared rules are *copied* into `.claude/rules/` rather
than linked. See `playbook/PLAYBOOK.md` §5.

| Guardrail | Landed? | Config location | Grandfathered count |
|---|---|---|---|
| TODO | | | |

---

## The test for all of it

**Could someone find this code without reading a file they didn't need to?**

If not, it is in the wrong place — regardless of whether it works. That is
literally the billing model.
