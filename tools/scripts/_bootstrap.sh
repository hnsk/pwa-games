# Sourced by every shim. Resolves repo root, ensures venv exists, exports DEVCTL.
# shellcheck shell=bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV="$REPO_ROOT/.venv"
DEVCTL="$VENV/bin/devctl"

if [[ ! -x "$DEVCTL" ]]; then
  echo "venv not ready; running setup.sh" >&2
  "$REPO_ROOT/setup.sh" >&2
fi

# All shims invoke `$DEVCTL <subcmd> "$@"`.
export DEVCTL REPO_ROOT VENV
