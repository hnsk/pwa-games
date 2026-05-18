---
name: dc-clean
description: Wipe the project's declared scratch dirs ([clean].targets in devctl.toml), captured. Refuses any target outside the repo root or the root itself. Use -n for a dry run.
---

# dc-clean

```
tools/scripts/clean          # wipe contents of [clean].targets dirs
tools/scripts/clean -n       # dry run — list what would be removed
```

Only wipes dirs listed in `[clean].targets` (`tools/devctl.toml`),
each validated to stay strictly inside the repo root. Captured (the
deletion list lands in a log). Never `rm -rf` scratch dirs by hand —
use this so the action is logged and bounded.
