---
name: dc-diag
description: Run any ad-hoc diagnostic command (docker ps, docker logs, port checks, etc.) through tools/scripts/capture so full stdout+stderr lands in a re-readable log. Use instead of `| tail` / `| head` on anything you may need to re-read.
---

# dc-diag

## Pattern

```
tools/scripts/capture --tag <short-tag> -- <cmd> [args...]
```

Writes full output to `tools/logs/<run-id>/<tag>.log` + a
`manifest.json`, appends `tools/logs/index.jsonl`. Prints `LOG=<path>`
first and `EXIT=<rc>` last; the wrapper itself always exits 0. **Read
the `LOG=` path** — do not rerun or chain `| tail`.

## When to use

Any inspection command the scaffold doesn't already wrap:
`docker ps`, `docker inspect`, `docker logs <container>`, port probes
(`nc`/`curl`), one-off `cat`/`grep` inside a container, etc.

## Examples

```
tools/scripts/capture --tag docker-ps   -- docker ps -a
tools/scripts/capture --tag port-probe  -- bash -lc 'curl -sv http://127.0.0.1:8080/'
```

## Why

Long output overflows terminal capture and can't be re-read; LOG files
can, and they feed the manifest index. This is also why captured output
never goes to `/tmp` or `| tail`.
