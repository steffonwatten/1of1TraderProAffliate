# Session chat — 1of1-trader-backoffice

**The readable narrative of how the work actually went — including the wrong
turns.**

`SESSION-LOG.md` is the record of *what changed*. This is the record of *how it
was worked out*: what was tried, what looked true and wasn't, what the client
said that changed the direction.

⚠️ **This is the redacted derivative.** The raw session transcript (`*.jsonl`) is
**never** committed — it contains secrets in plain text, server addresses, and
findings about customer records including file names and column structures.
`.gitignore` blocks it. This file is what is safe to keep.

**Redact before writing:** no live credential values, no customer names, no
account numbers, no email addresses, no server IPs.

---

## Why keep this at all

Because the wrong turns are the expensive part, and they are invisible in a diff.

On a prior engagement, keeping this record:

- stopped work being repeated across sessions
- stopped a fix landing that would have broken outbound customer messaging
- preserved the reason a plausible theory was rejected, so nobody re-tested it

**A confident wrong explanation costs more than no explanation, because it stops
the search.** That is why the wrong turns are written down rather than tidied
away.

---

## Session N — TODO date

### What was asked

> TODO — the client's actual words where possible. Their phrasing carries domain
> information yours does not.

### What happened

TODO — narrative. Include:

- the hypothesis, and **what would have proved it wrong**
- what was actually checked, and what it showed
- **anything that looked true and wasn't**, and how long before it was caught
- what the client said that changed the direction

### 🔴 Wrong turns

| What was believed | For how long | What killed it |
|---|---|---|
| TODO | | |

Shapes worth watching for, from prior engagements:

- **An aggregate percentage that dissolved when plotted by day.** Three separate
  findings died to that one check.
- **A headline exposure figure that was a tenth of what it looked like** once
  demo accounts were excluded.
- **A documented safety property that was false at runtime.**
- **A spinning page diagnosed for an hour** as a data problem when the server
  simply was not running.

### What the client said that mattered

> TODO

**Ask what the system is FOR before encoding what it should do.** A client's
verbal explanation of their own domain outranks your reading of the schema — on a
prior engagement one sentence from a risk team replaced guessed logic with a
simpler and correct rule.

### Where the session was wrong and said so

TODO.

Worth recording explicitly. On a prior engagement, asked three questions against
live data, a session answered two and **declined the third** — *"cannot attribute
this, the owner field is NULL for every record."* It could have invented a
breakdown. It didn't, and the refusal was itself the finding: a work queue with
tens of thousands of open items and not one assigned to anybody.

**That is the thing that makes a client trust the other numbers.** Show it to
them.
