---
name: dc-up
description: Bring up the Docker-Compose dev stack (build images if needed, start services detached). Use before dc-shell / dc-run.
---

# dc-up

```
tools/scripts/compose up [extra docker compose args]
```

Runs `docker compose -f tools/docker-compose.yml up -d`. Add `--build`
to rebuild images first. The `dev` service stays up (`sleep infinity`)
so `dc-shell` / `dc-run` can exec into it.

Not captured (may be interactive). For build output you want to re-read,
use `tools/scripts/run -- <build cmd>` instead.
