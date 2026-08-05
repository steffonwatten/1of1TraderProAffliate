---
name: Deploy builds from the committed git tree
description: Why a vite "load-fallback ENOENT" on an existing source file means it wasn't committed at deploy time
---

# Symptom
Production publish fails in the build phase with vite:
`[vite:load-fallback] Could not load .../src/.../SomeFile (imported by ...): ENOENT`
— note the path has NO extension. The file exists in the working directory and may
even be git-tracked when you check later.

# Root cause
The deployment build runs against the **committed git tree**, not the working directory.
If a newly created source file is imported but was not yet committed at the moment of
the publish, the deploy can't see it and vite falls back to loading the literal path,
which fails with ENOENT.

# How to confirm / fix
- `git --no-optional-locks cat-file -e HEAD:<path>` to check the file is in HEAD.
- `git --no-optional-locks log --oneline -- <path>` to see when it was committed.
- Ensure the file is committed, then re-publish. A checkpoint commit at "loop end"
  often lands the file AFTER a publish that was triggered earlier, which is exactly
  this race.

# Note on the PORT error during local repro
A bare `pnpm --filter @workspace/affiliate-dashboard run build` fails at vite config
load with "PORT environment variable is required". That is expected locally — the
deploy injects PORT/BASE_PATH. To reproduce the deploy build locally, run with
`PORT=5000 BASE_PATH=/ pnpm --filter @workspace/affiliate-dashboard run build`.
