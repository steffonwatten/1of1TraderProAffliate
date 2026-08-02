# Cost analysis — 1of1-trader-backoffice

**Where this application's money goes, and what is recoverable.**

Estate-wide figures belong in the engagement's `docs/CASE-STUDY.md`. This file is
one application.

🔴 **Read `playbook/INVOICE-ANALYSIS.md` before writing a single number here.**
Invoices within a billing cycle are **cumulative, not additive**, and the
*Amount due* column is usually a **payment cap, not the bill**. Both mistakes
produce a plausible-looking wrong answer.

---

## The number

| Line | Per month | Share | Fixable by |
|---|---|---|---|
| AI agent usage | TODO | TODO% | moving development to a flat-rate tool |
| Compute / VM | TODO | TODO% | right-sizing, deploy target |
| Managed database | TODO | TODO% | finding what polls it |
| Outbound transfer | TODO | TODO% | finding what serves or polls something large |
| Storage | TODO | TODO% | usually not worth touching |
| **Total** | **TODO** | | |

**Source invoices:** TODO — list them, and mark which are **terminal** for their
cycle. Only a terminal invoice shows a full period.
**Period normalised from:** TODO days → 30-day month.

⚠️ **State elapsed hours and duty cycle, not just dollars.** "192 of 216 hours,
89% duty cycle" tells you something "$12.40" does not.

---

## Is anyone using this at all?

🔴 **Establish this before opening the codebase. It decides whether there is a
project here.**

| Signal | Value | Reading |
|---|---|---|
| Agent spend, last two cycles | TODO | zero = nobody has touched the code |
| Real user traffic | TODO | |
| Database duty cycle | TODO | non-zero with no humans = something is on a timer |

**If it has no users, the answer is to pause the deployment and the entire cost
goes — no code required.**

⚠️ **Check the service name carefully first.** On a prior engagement three
deployments had names differing by one word — one fully audited, one unaudited,
one dormant and still billing — and a status table had the wrong one listed.
Confirm against the invoices before pausing anything.

---

## Why the agent line is what it is

**The agent is billed on the context it reads.** So the bill is a direct function
of how the code is organised, and it grows every month the files grow, whether or
not anyone is doing more work.

| Driver | Measurement | Consequence |
|---|---|---|
| Largest file | TODO lines | every change to it is billed as a full read |
| Files over 400 lines | TODO | |
| Generated code in context | TODO lines | billed, and never useful to read |
| Duplication | TODO | every fix made twice |

The second amplifier is **repeated ad-hoc questions**: operations the application
cannot perform get performed by hand, by an AI, at a metered rate, over and over.

> **If the client has asked for something twice, it is a missing feature, not an
> AI task.**

| Repeated request | Times seen | As a feature it would be |
|---|---|---|
| TODO | | |

This single reframe is often worth more than any individual fix.

---

## Infrastructure

**Check the deployment configuration before reading source.** Repeatedly, the
settings have mattered more than the code.

| Setting | Current | Measured need | Change | Worth |
|---|---|---|---|---|
| Machine size | TODO | TODO peak CPU / memory over 7 and 30 days | TODO | TODO |
| Deploy target | TODO | | | |
| Always-on? | TODO | | | |

⚠️ **"Always-on" is not automatically waste.** On a prior engagement one project
was always-on *correctly* — a short-interval monitoring loop was the entire
product. On another it was oversized several times over and the fix was a
dropdown, not a refactor. **Find out what the loop is for.**

**Read the monitoring pane before the source.** Peak CPU and memory over 7 and 30
days answers the machine-size question in about a minute.

---

## Recoverable

| Fix | Saving/month | Effort | Ratio | Do it? |
|---|---|---|---|---|
| TODO | | | | |

🔴 **Size the fix before building it.** On a prior engagement real effort went
into a change worth a couple of dollars a month while a much larger one sat
untouched. If right-sizing a machine saves a meaningful amount in ten minutes,
**that is the job — finish it and stop.**

---

## Measured vs projected

| Claim | Tag | Basis |
|---|---|---|
| TODO | MEASURED / PROJECTED | |

**Say which.** A projected saving quoted as measured is the fastest way to lose a
client's trust in every other number in the document.
