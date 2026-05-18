---
name: dc-shell
description: Interactive shell inside a running service container (default service from devctl.toml). For ad-hoc poking only; for output you need to re-read use dc-run instead.
---

# dc-shell

```
tools/scripts/shell                    # bash -l in default service
tools/scripts/shell --service test     # another service
tools/scripts/shell -- <cmd> [args]    # one-shot, then exit
```

Wraps `docker compose exec`. The container must be running (`dc-up`
first). Interactive, **not captured** — TTY straight through. Anything
you may want to re-read later → use `dc-run` (captured) instead.
