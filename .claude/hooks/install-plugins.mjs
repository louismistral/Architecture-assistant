#!/usr/bin/env node
// Installe pour de vrai les plugins déclarés dans .claude/settings.json
// (enabledPlugins + extraKnownMarketplaces). Sans ce script, les déclarer
// dans settings.json ne suffit pas : ni une session cloud fraîche ni le
// premier `claude` d'une nouvelle machine ne les récupère tout seul — voir
// CLAUDE.md, « Travailler à plusieurs ». Appelé par le hook SessionStart
// (session-start.sh). Aucune dépendance, seuls fs/path/child_process du
// cœur de node.
//
// Deux garde-fous contre le coût d'une réinstallation à chaque tour :
// - ne tourne qu'au vrai démarrage (source "startup"), jamais sur
//   resume/clear/compact — le conteneur ou la machine ne perdent pas leurs
//   plugins entre deux de ceux-là ;
// - ne rappelle `claude plugin install` que pour ce qui manque vraiment
//   (`claude plugin list --json` fait foi), pas pour ce qui est déjà là.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

const [, , settingsPath] = process.argv;

let hookInput = {};
try {
  hookInput = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  // pas de stdin exploitable : on part du principe que c'est un démarrage
}
if (hookInput.source && hookInput.source !== 'startup') process.exit(0);

let settings;
try {
  settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
} catch {
  process.exit(0); // pas de settings.json (ou illisible) : rien à faire
}

const enabled = Object.entries(settings.enabledPlugins ?? {})
  .filter(([, on]) => on)
  .map(([id]) => id);
if (enabled.length === 0) process.exit(0);

const projectPath = dirname(dirname(settingsPath));
const installed = new Set(
  listInstalled().filter((p) => p.scope === 'user' || p.projectPath === projectPath).map((p) => p.id)
);
const marketplaces = settings.extraKnownMarketplaces ?? {};

for (const id of enabled) {
  if (installed.has(id)) continue;
  const marketplace = id.split('@')[1];
  const src = marketplaces[marketplace]?.source;
  if (src?.source === 'github' && src.repo) {
    run(['plugin', 'marketplace', 'add', src.repo, '--scope', 'project']);
  }
  run(['plugin', 'install', id, '-y', '--scope', 'project']);
}

function listInstalled() {
  try {
    return JSON.parse(execFileSync('claude', ['plugin', 'list', '--json'], { timeout: 30_000 }));
  } catch {
    return []; // en cas de doute, on retente l'install plutôt que de la sauter à tort
  }
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
