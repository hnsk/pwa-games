---
name: dc-logs
description: Captured `docker compose logs` for the stack. Whole log dumped to a re-readable file instead of `| tail`. Do not pass -f/--follow (capture waits for exit).
---

# dc-logs

```
tools/scripts/logs                       # all services
tools/scripts/logs -- <service>          # one service
tools/scripts/logs -- --tail 500 dev     # forwarded args
```

`docker compose logs --no-color`, wrapped in capture. Prints `LOG=`
first, `EXIT=` last. Read the `LOG=` path. **No `-f`/`--follow`** —
capture blocks until the command exits.
