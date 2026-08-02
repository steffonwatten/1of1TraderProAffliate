# Audit — 1of1-trader-backoffice

**Findings for this application only.** Estate-wide findings go in the
engagement's `docs/CASE-STUDY.md`.

> ⚠️ **Sensitivity: internal.** Until the items below are fixed this document is
> effectively an attack roadmap. Private repo only. Do not send it to the client
> as-is — send the summary and the plan.

---

## 🔴 Every finding carries a tag. No exceptions.

| Tag | Means |
|---|---|
| **MEASURED** | Observed directly — a query against real data, a log line, a profiler run, a reproduced request. Say what you ran. |
| **INFERRED** | Read from the source and believed, but not executed or observed. |
| **UNVERIFIED** | Suspected. Written down so it is not lost, not yet checked. |

**Why this is enforced:** on a prior engagement roughly a dozen findings needed
withdrawing or downgrading mid-audit. That is the normal rate, not a scandal. The
tag is what makes the difference between a finding surviving review and the whole
document losing credibility.

🔴 **A documented safety property is INFERRED at best until you have tested it.**
On a prior engagement one project's own setup document asserted its workers
stayed dormant. Booting the API with three environment variables disproved it in
seconds — a worker immediately tried to write to live production records.

> **A safety property that was never tested is not a safety property.**

---

## Summary

| # | Finding | Tag | Severity | Worth | Status |
|---|---|---|---|---|---|
| 1 | TODO | | | | |

**Sort by value, not by ease, and not by how interesting the problem is.** On a
prior engagement real effort went into a change worth a couple of dollars a month
while a much larger one sat untouched.

> **The interesting problem and the expensive problem are rarely the same one.**

---

## Findings

### 1. TODO — title

**Tag:** MEASURED / INFERRED / UNVERIFIED
**Severity:** TODO
**Worth:** TODO — money per month, or the security consequence, stated plainly

**What is happening.** TODO

**Evidence.** TODO — the query, the log line, the measurement. If this is
INFERRED, say what would turn it into MEASURED and why that has not been done
yet.

**What would prove me wrong.** TODO — write this down *before* going to look.

**Falsification attempt.** TODO — what you actually checked, and what it showed.
A hypothesis that survives a real attempt to kill it is worth acting on; one that
merely fits is not.

⚠️ **Plot it by day before believing a percentage.** On a prior engagement three
separate findings looked serious and all three died to the same check. "A large
share of alerts never delivered" was entirely pre-launch. "Most claims failing"
was one afternoon's outage at a third party. **Aggregate percentages lie; time
series do not.**

⚠️ **Exclude demo, test and internal records before quoting a number.** On a
prior engagement a finding looked like a quarter of a million dollars of
exposure; the overwhelming majority was one demo account and the real figure was
a tenth. One more query, two minutes, prevented a tenfold error in front of the
client.

**Recommendation.** TODO — and **size it before building it.**

---

## 🔴 Withdrawn and downgraded findings

**These stay in the document. Never delete one.**

A diagnosis is only as credible as the ideas it ruled out, and the next session
needs to know a theory was already tested rather than testing it again.

| Finding | Originally | Now | What changed the answer |
|---|---|---|---|
| TODO | | | |

---

## Checked and clean

> Worth recording. It stops the same ground being covered twice, and it is
> evidence that the audit had scope rather than just finding what it tripped
> over.

| Area | How it was checked | Result |
|---|---|---|
| TODO | | |

---

## Method notes

- **Check the deployment configuration before reading source.** Repeatedly, the
  settings have mattered more than the code — background workers forcing an
  always-on machine, a wrong deploy target, a machine oversized several times
  over.
- ⚠️ **"Always-on" is not automatically waste.** On one project it was
  *correct* — a short-interval monitoring loop was the entire product. Find out
  what the loop is for before recommending a change.
- **Ask what the system is FOR before encoding what it should do.** On a prior
  engagement a piece of domain logic was guessed and was wrong; one sentence from
  the client's risk team produced a simpler and correct rule. **The client's
  verbal explanation of their own domain outranks your reading of the schema.**
- **Audit your own work last.** A self-audit at the end of one project found
  dozens of references *in its own documents* using the exact ambiguous shorthand
  it had just criticised elsewhere.
