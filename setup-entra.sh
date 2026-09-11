#!/usr/bin/env bash
# Wrapper to run scripts/setup-entra.sh
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${DIR}/scripts/setup-entra.sh" "$@"

