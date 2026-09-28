#!/usr/bin/env node
// Installe pour de vrai les plugins déclarés dans .claude/settings.json
// (enabledPlugins + extraKnownMarketplaces). Sans ce script, les déclarer
// dans settings.json ne suffit pas : ni une session cloud fraîche ni le
// premier `claude` d'une nouvelle machine ne les récupère tout seul — voir
// CLAUDE.md, « Travailler à plusieurs ». Appelé par le hook SessionStart
// (session-start.sh). Idempotent : `claude plugin install` déjà satisfait
// répond en ~1s sans rien retélécharger. Aucune dépendance, seuls fs et
// child_process du cœur de node.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [, , settingsPath] = process.argv;

let settings;
try {
  settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
} catch {
  process.exit(0); // pas de settings.json (ou illisible) : rien à faire
}

const enabled = Object.entries(settings.enabledPlugins ?? {})
  .filter(([, on]) => on)
  .map(([id]) => id);
const marketplaces = settings.extraKnownMarketplaces ?? {};

for (const id of enabled) {
  const marketplace = id.split('@')[1];
  const src = marketplaces[marketplace]?.source;
  if (src?.source === 'github' && src.repo) {
    run(['plugin', 'marketplace', 'add', src.repo, '--scope', 'project']);
  }
  run(['plugin', 'install', id, '-y', '--scope', 'project']);
}

function run(args) {
  try {
    execFileSync('claude', args, { stdio: 'ignore', timeout: 60_000 });
  } catch {
    // Pas de réseau, marketplace introuvable, etc. : on ne bloque jamais
    // le démarrage de la session pour ça, on le signale et on continue.
    console.error(`install-plugins: échec — claude ${args.join(' ')}`);
  }
}
