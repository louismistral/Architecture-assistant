#!/bin/bash
# Hook SessionStart : rend réels les plugins déclarés dans .claude/settings.json,
# pour toute session — locale ou cloud — qui ouvre ce dépôt. Ne bloque jamais
# le démarrage : une installation qui échoue (pas de réseau, etc.) est
# signalée sur stderr et on continue.
set -uo pipefail

if ! command -v claude >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  exit 0
fi

node "$CLAUDE_PROJECT_DIR/.claude/hooks/install-plugins.mjs" \
  "$CLAUDE_PROJECT_DIR/.claude/settings.json" || true

exit 0
