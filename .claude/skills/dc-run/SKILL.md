---
name: dc-run
description: Run a one-shot command in a compose service with output captured to a re-readable log + manifest. Use for builds, test suites, scripts — anything whose output you may need to re-read.
---

# dc-run

```
tools/scripts/run -- <cmd> [args]                 # in default service
tools/scripts/run --service test -- <cmd>         # another service
tools/scripts/run --tag build -- make             # custom log tag
tools/scripts/run                                  # → [test].command
```

`docker compose run --rm <service> <cmd>`, wrapped in capture. Prints
`LOG=<path>` first, `EXIT=<rc>` last; the shim exits 0 regardless.
**Read the `LOG=` path** — never `| tail`. With no command, falls back
to `[test].command` in `tools/devctl.toml`.
