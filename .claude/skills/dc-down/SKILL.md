---
name: dc-down
description: Stop and remove the Docker-Compose dev stack containers. Add -v to also drop named volumes.
---

# dc-down

```
tools/scripts/compose down [extra docker compose args]
```

`docker compose -f tools/docker-compose.yml down`. Pass `-v` to also
remove named volumes (wipes caches/data — destructive, confirm intent).
