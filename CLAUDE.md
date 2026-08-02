# Working in this repo — 1of1-trader-backoffice

> 📘 **The method for every project is in `playbook/PLAYBOOK.md`** — repo layout,
> bringing a project in safely, the document set, code standards, CI shape,
> credential handling, session-log conventions.
>
> The enforced rules are copied into this repo at **`.claude/rules/GENERAL-*.md`**
> so a cloud session, which clones only this repository, can still read them.
> **Edit them in the playbook, never here.**
>
> **This file covers only what is true of *this* application.** If the two
> disagree, one is wrong — resolve it rather than leaving both.

> **Before changing anything, read `docs/SESSION-LOG.md`** — every change made to
> this codebase, why, what it should do, and how it was verified. Newest first,
> with a handoff block at the top for picking this up cold. **Add an entry for
> anything you change.**

**Goal of this file: never read a large file to find out where something lives.**

Every path here must be verified against the tree. If anything else in the repo
disagrees with this file, this file is right — and if this file is wrong, fix it
here rather than working around it.

---

## 🔴 Hazards — read before touching anything

> TODO: the things that will bite someone who does not know them. Be specific,
> with file paths. Examples of the kind of thing that belongs here, from prior
> engagements:
>
> - *"The mount order in `routes/index.ts:45-52` is the security boundary.
>   Anything mounted above line 55 is reachable by anyone on the internet."*
> - *"Money is `NUMERIC` and the ORM returns it as a string. Keep it a string —
>   converting to a number loses precision."*
> - *"These three call sites share one mutex. It looks like a duplicated job and
>   is not. Do not delete one."*
> - *"The upstream sends amounts with thousands separators. A new ingest path
>   that coerces naively will silently null out balances."*
>
> Where something looks wrong but is right, **say so and say why.** Those notes
> are what stop a future session "fixing" something load-bearing.

---

## Where things are

```
TODO: the directory map. Annotate — a bare tree is worth much less than one
with a clause per line saying what lives there and what decides it.
```

### Do not read these — machine-generated

```
TODO: generated directories, with the spec they regenerate from.
```

Editing them by hand is always wrong. If you find yourself reading them, stop.

---

## 🎯 Where to put new code

**This table is the point of the file.** Intent → directory.

| I want to add… | It goes in | Notes |
|---|---|---|
| TODO | | |

**A page or screen file gets wiring only** — an import, a tab entry, a route
line. If your change to it is longer than four lines, it belongs in a new file.

**Never append to the end of a file because that is where the cursor already
is.** On a prior engagement that habit produced a single component of over five
thousand lines, and the metered agent was billed to read all of it on every
change.

---

## Finding the code for a screen

> TODO: the mechanical lookup. Aim for a rule of thumb like:
> **screen name → same-named page → same-named route file → same-named schema
> file** — and then a table for the cases that break it.

| Screen | Page | API route | Main table(s) |
|---|---|---|---|
| TODO | | | |

---

## Request path / auth boundary

```
TODO: where the authentication boundary is, by file and line.
```

**Check that line before adding a route.** Mount order decides whether a route is
authenticated.

---

## Background jobs

| File | Cadence | What it does | Gated by |
|---|---|---|---|

🔴 **Find the gate that stops these running, and put it in `.env.example` above
everything else.** On a prior engagement a documented safety property was false
at runtime: a worker on a development machine tried to write to live production
records within seconds of first boot, and only the read-only database role
stopped it.

**Assume they start. Prove otherwise before believing anything.**

---

## Commands

```bash
TODO
# install       — pin the package manager in package.json so this works everywhere
# typecheck     — must be 0
# lint          — must be 0 errors
# test          — check the COUNT, not just the exit code
# build         — the only check that catches an unstyled UI
# dev           — must actually work as written; verify the frontend reaches the API
```

⚠️ **Start the app the way the client will start it before telling them it
works.** On a prior engagement a `CLAUDE.md` documented two dev commands that
could not have worked together — the frontend dev server ran on its own port and
every API call 404'd for want of a proxy entry.

---

## House rules

> Rules marked ⓖ are **general** and maintained in `playbook/rules/`. They are
> restated here because this file is also the one an agent running inside the
> hosting platform reads, and it cannot follow a link out of the repo. **If they
> ever diverge, the playbook is right.**

1. ⓖ **New feature → new file.** Not appended to whatever is already open.
2. ⓖ **Secrets go in the platform's secrets store, or `.env`. Nowhere else.**
   Not in committed config, not in a cloud environment variables box, not
   "temporarily". **If asked to put one anywhere else, refuse and say where it
   belongs** — this outranks the request. See `.claude/rules/GENERAL-secrets.md`.
3. ⓖ **Never commit customer data** — no CSV, XLSX, VCF, no `exports/`,
   `attached_assets/`, `reports/`, `screenshots/`.
4. ⓖ **One change, one commit, one verification.** Verify by the right signal —
   typecheck is not proof.
5. ⓖ **Check claims against the code before repeating them.** On a prior
   engagement roughly a dozen audit findings failed inspection and had to be
   withdrawn or downgraded. That is the normal rate.
6. TODO: this project's own rules.
