# Architecture — 1of1-trader-backoffice

**Structure, duplication, dead code and file sizes.** This is the document that
explains *why the codebase is expensive to change*, which is a different question
from whether it works.

Companion: `CODE-QUALITY.md` (practice), `docs/PROJECT-MAP.md` (the generated
inventory).

---

## Shape

```
TODO: the real structure. Annotated — a bare tree is worth much less than one
with a clause per line.
```

| Layer | Lines | Files | Notes |
|---|---|---|---|
| TODO | | | |

---

## 🔴 File size — the cost driver

**A metered AI agent is billed on the context it reads.** A one-line change
inside a five-thousand-line file costs the same to read as a rewrite of that
file. So file size is not an aesthetic concern here — it is the line item.

On a prior engagement one admin screen reached over five thousand lines, five
times the next largest file and three quarters the size of that application's
entire backend HTTP layer. Nobody decided to write it. It happened one reasonable
addition at a time.

| File | Lines | Why it grew | Plan |
|---|---|---|---|
| TODO | | | |

**Over 400 lines:** TODO count
**Over 800 lines:** TODO count

**The backlog is shrink-only.** Grandfather the existing offenders into the
linter config. A listed file may get smaller. It may not get bigger, and nothing
new may be added to the list.

---

## Duplication

| Duplicated thing | Copies | Where | Fix |
|---|---|---|---|
| TODO | | | |

**Two apps needing the same thing → a workspace package, never a copy.** On a
prior engagement one project carried dozens of byte-identical files across two
frontends, because some component libraries copy their source into your tree by
design. Every fix had to be made twice, or they drifted.

⚠️ **Delete before you share.** Deduplicating a library before removing its
unused parts just moves unwanted files into a shared package. On a prior
engagement the application used barely a quarter of its component library — the
rest was deleted first, so the shared package came out a quarter of the size.

⚠️ **Tailwind 4 does not scan workspace packages.** Moving styled components into
one without an `@source` line leaves them compiling, building and rendering
**with no styling** — typecheck, lint and a full test suite all passed while the
entire interface was broken. **Verify by CSS bundle size.**

---

## Dead code

🔴 **Compute the transitive closure, not direct usage.**

A component imported by another component rather than by the application looks
unused and is not. On a prior engagement deleting on direct usage alone broke a
build.

Method:

1. Start from the real entry points — the app root, the route table, the server
   bootstrap. Not from a grep.
2. Walk imports outward until the set stops growing.
3. Everything outside that set is a candidate.
4. Delete candidates **in their own commit**, never mixed with a behaviour
   change.
5. **Verify by the right signal.** On a prior engagement removing a large amount
   of dead frontend code changed the CSS bundle substantially and the JS bundle
   **not at all**. A green build would have told you neither.

| Candidate | Lines | Reached from | Verdict |
|---|---|---|---|
| TODO | | | |

**Removed:** TODO lines (TODO% of the codebase), commit `TODO`

---

## Generated code

| Directory | Generated from | Lines |
|---|---|---|
| TODO | | |

**The spec is the source of truth. Never hand-edit the output.** Exclude these
from AI context — on a prior engagement generated code was a large fraction of
one repository, and every line of it read by a metered agent was billed.

---

## Things that look wrong and are right

> **This section prevents damage.** Record anything a future session would
> reasonably "fix" and shouldn't, with the reason.

| Looks like | Actually | Do not |
|---|---|---|
| TODO | | |

Example of the shape, from a prior engagement: three call sites into the same
recompute routine, all guarded by one single-flight mutex. It reads exactly like
a duplicated background job. Deleting one would have silently changed behaviour.
