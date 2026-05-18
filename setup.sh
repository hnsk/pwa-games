#!/usr/bin/env bash
# setup.sh — bootstrap the local Python venv used by all tools/ scripts.
#
# Idempotent. Safe to re-run after pyproject.toml changes.
#
# Resulting layout:
#   .venv/                Python virtual environment (git-ignored)
#   .venv/bin/devctl      Console entry point (from pyproject.toml)
#
# Required: python3 >= 3.11 on PATH (stdlib `tomllib`). This is the ONLY
# thing that runs on the host — everything else runs in Docker Compose.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

PY="${PYTHON:-python3}"
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)' \
  || { echo "setup.sh: need python >= 3.11 (got $($PY --version 2>&1))" >&2; exit 2; }

if [[ ! -d .venv ]]; then
  "$PY" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --quiet --upgrade pip
if [[ -s requirements.txt ]]; then
  python -m pip install --quiet -r requirements.txt
fi
python -m pip install --quiet -e .

echo "venv ready: $REPO_ROOT/.venv"
echo "entry point: $REPO_ROOT/.venv/bin/devctl"
