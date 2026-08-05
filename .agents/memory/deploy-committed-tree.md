---
name: Deploy builds the committed git tree
description: Why a file that exists in the working dir can still fail the publish build
---
Publishing/deploy builds from the **committed git tree**, not your working directory.

**Why:** A new file (e.g. a React page) that runs fine in dev but was never committed
will cause the deploy build to fail with vite `load-fallback ENOENT` for that file,
because the build only sees committed files.

**How to apply:** Before publishing, confirm any newly added files are committed. If a
publish fails with ENOENT / "cannot find module" for a file that clearly exists locally,
check `git status` for uncommitted/untracked files first.
