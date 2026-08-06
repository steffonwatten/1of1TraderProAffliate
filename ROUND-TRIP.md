# Round-trip check

This file exists to prove one thing:

```
local edit → push → GitHub → Replit shell: git pull → publish → live
```

That loop is the entire point of moving development off the metered agent. Until
it works, the code being on GitHub changes nothing — there is no way to get a
change back into the running app, so the only route left is the billed agent.

**Created 6 Aug 2026**, when the loop was first proved for this project.

Deliberately trivial: a markdown file nothing imports, nothing builds, and
nothing renders. If the pull or the publish fails, the cause cannot be this file.

Safe to delete once you are bored of it.
