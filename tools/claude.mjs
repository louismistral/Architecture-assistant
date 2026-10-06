/* ============================================================================
   CLAUDE DANS L'ATELIER — L'OUTIL

   Ce que Claude fait dans l'app, sans navigateur : remettre en place un état du
   projet, le juger, le tirer, en régler les lignes, préparer une variante. Il
   lit et écrit des fichiers JSON de `.atelier/`, et RIEN d'autre — la base est
   l'affaire de Claude, par le connecteur Supabase. La méthode est dans
   `.claude/skills/atelier/SKILL.md` ; la spec, dans
   `docs/superpowers/specs/2026-10-06-claude-atelier-design.md`.

   L'instantané (`snapshot()`, `mix/store.js`) est la langue : il dit TOUT
   l'état du projet. Composer un volume, c'est écrire `mass.vol` ; ce que l'app
   apprendra demain entrera dans l'instantané, donc ici, le même jour.

     node tools/claude.mjs bilan            ce que l'état donne
     node tools/claude.mjs test             la vérification de l'outil
   ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/* Les modules de l'app écrivent sur l'appareil ; ici, il n'y en a pas. Posé
   AVANT de les importer, d'où les imports dynamiques. */
globalThis.localStorage ??= { getItem(){ return null; }, setItem(){}, removeItem(){} };

const SRC = new URL("../src/", import.meta.url);
let MODS = null;

class Erreur extends Error {}

export async function modules(){
  if(MODS) return MODS;
  const im = (p) => import(new URL(p, SRC));
  const [M, G, F, S, St, R, L, J, E, C, CM, Va, Rech, T, XM, XX, model] = await Promise.all([
    "mass/model.js", "mass/gen.js", "mix/floors.js", "mix/shuffle.js", "mix/store.js",
    "core/rand.js", "data/lignes.js", "data/jugement.js", "mass/mesures.js",
    "mass/checks.js", "mix/checks.js", "net/variantes.js", "net/recherche.js",
    "typo/etat.js", "mass/fix.js", "mix/fix.js", "core/model.js"
  ].map(im));
  /* que TOUTES les lignes soient déclarées, jury compris */
  await Promise.all(["data/leviers.js", "data/cadre.js", "data/orientation.js",
                     "data/recherche.js", "data/donnees.js"].map(im));
  MODS = { M, G, F, S, St, R, L, J, E, C, CM, Va, Rech, T, XM, XX, model };
  return MODS;
}

/* ---------- les fichiers ---------- */
export function lireJSON(chemin, requis){
  if(!existsSync(chemin)){
    if(requis) throw new Erreur("fichier introuvable : " + chemin);
    return null;
  }
  try{ return JSON.parse(readFileSync(chemin, "utf8")); }
  catch(e){ throw new Erreur("JSON illisible dans " + chemin + " : " + e.message); }
}
export function ecrireJSON(chemin, o){
  mkdirSync(dirname(chemin), { recursive:true });
  writeFileSync(chemin, JSON.stringify(o, null, 2) + "\n");
}

/* ---------- remettre en place ----------
   Le groupe d'abord, comme `tirerReglages()` à l'ouverture de l'app : le jury
   et les surfaces sont ceux du groupe, pas les défauts du code. Puis l'état.
   On repart du défaut de TOUTES les lignes, jury compris : deux appels dans le
   même processus ne doivent pas se passer leurs réglages. Rend la liste des
   sections que `restore()` n'a pas pu remettre. */
export function charger(groupe, etat){
  const { M, L, St, model } = MODS;
  L.retablir(false);
  if(groupe){
    if(groupe.areas) St.applyAreas(groupe.areas);
    if(groupe.circulation != null) model.loadCirc(groupe.circulation);
    if(groupe.doctrine) L.poser(groupe.doctrine, false);
    model.recompute();
  }
  M.massVols([]);
  return etat ? St.restore(etat) : [];
}

/* ---------- le bilan ----------
   Ce que Claude lit pour raisonner : les trois snapshots de CLAUDE.md réunis,
   et le TEXTE des alertes, avec les remèdes que l'app propose. */
const r2 = (x) => x == null || !isFinite(x) ? x : Math.round(x * 100) / 100;
const NIV = ["défavorable", "neutre", "favorable"];
function alertes(liste){
  return liste.filter((x) => !x.ok).map((x) => {
    const o = { sev:x.sev, code:x.code, msg:x.msg };
    if(x.fixes && x.fixes.length) o.remedes = x.fixes.map((f) => f.label);
    return o;
  });
}

export function bilan(perdu){
  const { M, F, E, C, CM, J } = MODS;
  const lmix = CM.mixCheck(), lmass = C.massCheck(), b = M.bilanTotal();
  const ev = E.evaluationCourante();
  return {
    perdu: perdu || [],
    mixer: {
      niveaux: F.FLOORS.map((f, i) => ({ nom:F.flName(i), net:Math.round(F.flNet(i)),
        utile:Math.round(F.usable(i)), pieces:F.flCount(i), h:F.flHeight(i) })),
      bac: Math.round(F.trayArea()),
      verdict: CM.mixVerdict(lmix),
      alertes: alertes(lmix)
    },
    massing: {
      parti: (M.MASS.vol && M.MASS.vol.parti) || M.MASS.parti,
      corps: M.MASS.vol.map((v, k) => ({
        id: v.id == null ? k : v.id, nom: v.nom || null, x:r2(v.x), y:r2(v.y), a:r2(v.a),
        bat: v.bat || null,
        etages: v.lv.map((e) => {
          const o = { i:e.i, w:r2(e.w), d:r2(e.d), dx:r2(e.dx || 0), dy:r2(e.dy || 0), keys:e.keys || null };
          if(e.ext && e.ext.length) o.parts = e.ext.length + 1;
          return o;
        })
      })),
      demande: Math.round(b.demande || 0),
      pose: Math.round(b.pose || 0),
      verdict: C.massVerdict(lmass),
      alertes: alertes(lmass)
    },
    jugement: ev ? {
      total: ev.jugement.total,
      couv: r2(ev.jugement.couv),
      axes: ev.jugement.axes.map((a) => ({ id:a.id, n:a.n, w:a.w, s:r2(a.s) })),
      crit: J.CRITERES.map((x) => ({ id:x.id, n:x.n, s:r2(ev.jugement.crit[x.id].s),
        de:ev.jugement.crit[x.id].de, mesure:x.mesure || null,
        valeur: x.mesure ? ev.mes[x.mesure] : null }))
    } : null,
    cadre: ev ? (ev.invalide ? "enfreint" : ev.notifie ? "choisi enfreint" : "tenu") : null,
    ecarts: ev ? ev.ecarts.map((x) => ({ k:x.k, sev:x.sev, msg:x.msg })) : [],
    qualites: ev ? Object.fromEntries(Object.entries(ev.qualites)
      .map(([id, q]) => [id, { niv:NIV[q.niv], txt:q.txt }])) : {}
  };
}

const pc = (s) => s == null ? "—" : Math.round(100 * s) + " %";
export function texte(b, complet){
  const L = [];
  if(b.perdu.length) L.push("PERDU au chargement : " + b.perdu.join(", "), "");
  L.push("MIXER");
  b.mixer.niveaux.forEach((n) => L.push("  " + n.nom.padEnd(17) + (n.net + "/" + n.utile + " m²").padEnd(14)
    + (n.pieces + " pièces").padEnd(12) + "h=" + n.h));
  L.push("  bac : " + b.mixer.bac + " m²", "  verdict : " + JSON.stringify(b.mixer.verdict));
  b.mixer.alertes.forEach((a) => L.push("  [" + a.sev + "] " + a.code + " — " + a.msg
    + (a.remedes ? "  → " + a.remedes.join(" | ") : "")));
  L.push("", "MASSING · " + b.massing.parti + " · demandé " + b.massing.demande + " · posé " + b.massing.pose);
  b.massing.corps.forEach((v) => {
    L.push("  corps " + v.id + (v.nom ? " « " + v.nom + " »" : "") + " x=" + v.x + " y=" + v.y + " a=" + v.a
      + (v.bat ? " bât " + v.bat : ""));
    v.etages.forEach((e) => L.push("    étage " + e.i + " " + e.w + "×" + e.d
      + (e.dx || e.dy ? " décalé " + e.dx + "," + e.dy : "") + (e.parts ? " (" + e.parts + " parts)" : "")
      + (e.keys ? " · " + e.keys.join(", ") : "")));
  });
  L.push("  verdict : " + JSON.stringify(b.massing.verdict));
  b.massing.alertes.forEach((a) => L.push("  [" + a.sev + "] " + a.code + " — " + a.msg
    + (a.remedes ? "  → " + a.remedes.join(" | ") : "")));
  L.push("");
  if(!b.jugement) L.push("JUGEMENT : aucun corps, rien à juger");
  else {
    L.push("JUGEMENT " + b.jugement.total + "/100 · lu à " + pc(b.jugement.couv) + " · cadre " + b.cadre);
    b.jugement.axes.forEach((a) => L.push("  " + a.n.padEnd(52) + pc(a.s).padStart(6) + "  (poids " + a.w + ")"));
    /* Les critères sans mesure se notent à la main dans l'app : sans `--complet`,
       ils tiennent en une ligne — le bilan se relit à chaque essai. */
    const lus = b.jugement.crit.filter((x) => complet || x.de === "mesure" || x.de === "main");
    const tus = b.jugement.crit.filter((x) => !lus.includes(x));
    L.push("  critères :");
    lus.forEach((x) => L.push("    " + x.id.padEnd(10) + pc(x.s).padStart(6) + "  " + x.de.padEnd(10)
      + x.n + (x.mesure ? "  [" + x.mesure + " = " + JSON.stringify(x.valeur) + "]" : "")));
    if(tus.length) L.push("    + " + tus.length + " sans mesure (neutre, moyenne, éteint) : "
      + tus.map((x) => x.id).join(" "));
    b.ecarts.forEach((x) => L.push("  écart [" + x.sev + "] " + x.k + " — " + x.msg));
    L.push("  orientation :");
    Object.entries(b.qualites).forEach(([id, q]) => L.push("    " + id.padEnd(8) + q.niv.padEnd(12) + q.txt));
  }
  return L.join("\n");
}

function sortie(o, opt, txt){
  if(!opt.muet) console.log(opt.json ? JSON.stringify(o, null, 2) : txt(o));
  return o;
}
function entier(x, nom){
  if(x === undefined) return undefined;
  const n = Number(x);
  if(!Number.isInteger(n)) throw new Erreur("--" + nom + " attend un entier : " + x);
  return n;
}
const graineAuHasard = () => (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
const FG = ".atelier/groupe.json", FE = ".atelier/etat.json";
function ouvrir(opt){
  const g = lireJSON(opt.groupe || FG, !!opt.groupe), e = lireJSON(opt.etat || FE, true);
  return charger(g, e);
}

async function verbeBilan({ opt }){
  await modules();
  return sortie(bilan(ouvrir(opt)), opt, (b) => texte(b, opt.complet));
}

/* ---------- tirer ----------
   Les dés de l'app, un par onglet. Le bilan est rendu AVANT relecture : c'est
   le seul moment où la figure tirée en « Auto » est connue. Un mixer retiré
   regénère le massing avec la graine courante : la volumétrie suit la pile,
   comme dans la recherche automatique. */
async function verbeTirer({ opt }){
  const { M, G, S, St, R, T } = await modules();
  const fe = opt.etat || FE;
  const e = lireJSON(fe, false);
  charger(lireJSON(opt.groupe || FG, !!opt.groupe), e);
  /* `--parti` seul change la figure, pas le reste : même pile, même graine */
  const tout = !opt.mixer && !opt.massing && !opt.typo && !opt.parti;
  const seed = entier(opt.seed, "seed"), graine = entier(opt.graine, "graine");
  if(opt.parti){
    if(!M.PARTIS.some((p) => p.id === opt.parti))
      throw new Erreur("parti inconnu : " + opt.parti + " — " + M.PARTIS.map((p) => p.id).join(", "));
    M.massSet("parti", opt.parti);
  }
  /* Sans état, rien n'est réparti : un massing tiré là n'aurait rien à loger. */
  if(tout || opt.mixer || !e){
    R.seed(seed === undefined ? null : seed);
    S.repartir({ alea: !opt.ordonne, etages:true });
  }
  if(tout || opt.mixer || !e || opt.massing || opt.parti){
    if(tout || opt.massing) M.massSet("graine", graine === undefined ? graineAuHasard() : graine);
    M.massVols(G.genMass(M.MASS.graine));
    M.MASS.pile = M.empreintePile();
  }
  if(opt.typo) T.TYPO.graine = graine === undefined ? graineAuHasard() : graine;
  const b = bilan([]);
  ecrireJSON(fe, St.snapshot());
  return sortie(b, opt, texte);
}

/* ---------- les lignes ----------
   Tout ce qui influe sur une variante, jury compris (`data/lignes.js`). Le
   jury va au GROUPE seul (`doctrine`) ; le reste va aussi à l'état (`doc`),
   comme dans l'app. Rend l'ancienne valeur ET celle réellement posée :
   `regler()` borne, et la valeur demandée n'est pas toujours celle qui tient.
   Écrire le groupe dans la base change l'app de TOUT le groupe : c'est à
   Claude de le faire, sur demande — ici, on ne fait que le fichier. */
/* Ce que dit une clé, en mots : il y en a plus de 360, et `w:b7` ne parle pas.
   Les préfixes sont ceux de `data/lignes.js — declarer()` et de
   `data/jugement.js` (axes, sous-axes, fonctions de score). */
function decrire(c){
  const { L, J } = MODS;
  const [p, id] = c.includes(":") ? [c.slice(0, c.indexOf(":")), c.slice(c.indexOf(":") + 1)] : [null, c];
  const l = id && L.ligne(id), role = l ? l.role : null;
  if(p === "ax"){ const a = J.AXES.find((a) => a.id === id); return { n:"poids de l'axe — " + (a ? a.n : id), role:"jugement" }; }
  if(p === "sx"){ const s = J.sousAxe(id); return { n:"poids du sous-axe — " + (s ? s.n : id), role:"jugement" }; }
  if(p === "t" && l) return { n:"tag — " + l.n, role };
  if(p === "on" && l) return { n:"allumée (1) ou éteinte (0) — " + l.n, role };
  if((p === "jb" || p === "jn" || p === "jh") && l)
    return { n:{ jb:"score plein à", jn:"score nul à", jh:"seuil haut" }[p] + " — " + l.n, role };
  const d = L.LIGNES.find((x) => x.k === c || x.k2 === c);
  if(d) return { n:(d.k2 === c ? "2ᵉ valeur — " : "") + d.n, role:d.role };
  return { n:l ? l.n : "", role };
}

async function verbeLigne({ pos, opt }){
  const { L } = await modules();
  const fg = opt.groupe || FG, fe = opt.etat || FE;
  const g = lireJSON(fg, false), e = lireJSON(fe, false);
  charger(g, e);
  const [k, v] = pos;
  if(k === undefined && opt.toutes){
    const mot = opt.cherche ? String(opt.cherche).toLowerCase() : null;
    const l = Object.keys(L.V).map((c) => Object.assign({ cle:c, valeur:L.V[c], defaut:L.defaut(c),
      jury:L.estJury(c) }, decrire(c))).filter((x) => !mot || (x.cle + " " + x.n + " " + x.role).toLowerCase().includes(mot));
    return sortie(l, opt, (l) => l.map((x) => x.cle.padEnd(20) + String(x.valeur).padEnd(12)
      + (x.role || "").padEnd(12) + x.n).join("\n"));
  }
  if(k === undefined){
    const l = Object.entries(L.ecarts(false)).map(([c, x]) =>
      ({ cle:c, valeur:x, defaut:L.defaut(c), jury:L.estJury(c) }));
    return sortie(l, opt, (l) => l.length ? l.map((x) => x.cle.padEnd(24) + String(x.valeur).padEnd(10)
      + "défaut " + x.defaut + (x.jury ? "  · jury" : "")).join("\n") : "toutes les lignes au défaut");
  }
  if(!L.connue(k)) throw new Erreur("ligne inconnue : " + k);
  if(v === undefined){
    return sortie({ cle:k, valeur:L.V[k], defaut:L.defaut(k), borne:L.borne(k), jury:L.estJury(k) },
      opt, (o) => JSON.stringify(o));
  }
  const avant = L.V[k], change = L.regler(k, v);
  if(!change && String(v) !== String(avant) && Number(v) !== avant)
    throw new Erreur("valeur refusée pour " + k + " : " + v + " (borne " + JSON.stringify(L.borne(k)) + ")");
  ecrireJSON(fg, Object.assign({}, g || {}, { doctrine: L.ecarts(false) }));
  if(e) ecrireJSON(fe, Object.assign({}, e, { doc: L.ecarts(true) }));
  return sortie({ cle:k, avant, apres:L.V[k], change }, opt,
    (o) => o.cle + " : " + o.avant + " → " + o.apres + (o.change ? "" : " (inchangé)"));
}

/* ---------- la variante ----------
   La ligne de `variant` telle que l'app la pose (`enregistrer()`,
   `net/variantes.js`), avec le tag `claude`. `team_id` et `author_id` restent
   absents : c'est Claude qui les remplit à l'insertion, par le connecteur. */
async function verbeVariante({ pos, opt }){
  const { Va, St } = await modules();
  ouvrir(opt);
  const row = Va.resumeCourant();
  row.name = (pos[0] && pos[0].trim()) || Va.nomPropose();
  row.state = St.snapshot();
  row.tags = ["claude"];
  ecrireJSON(opt.sortie || ".atelier/variante.json", row);
  return sortie(row, opt, (r) => (opt.sortie || ".atelier/variante.json") + " · « " + r.name + " » · "
    + r.score + "/100 · massing " + JSON.stringify(r.verdict.mass) + " · mixer " + JSON.stringify(r.verdict.mix));
}

/* ---------- la porte de sortie ----------
   Tout ce qu'aucun verbe ne couvre encore : du JS, avec les modules de l'app
   sous la main, après la remise en place. Un `js` que Claude réécrit souvent
   devient un verbe. `--fichier` évite les guillemets du shell. */
const AsyncFunction = (async () => {}).constructor;
async function verbeJs({ pos, opt }){
  const m = await modules();
  const fe = opt.etat || FE;
  charger(lireJSON(opt.groupe || FG, !!opt.groupe), lireJSON(fe, false));
  const code = opt.fichier ? readFileSync(opt.fichier, "utf8") : pos.join(" ");
  if(!code.trim()) throw new Erreur("rien à exécuter : js \"<code>\" ou js --fichier <chemin>");
  const noms = Object.keys(m).concat(["bilan", "texte"]);
  const f = new AsyncFunction(...noms, code);
  const r = await f(...noms.map((n) => n === "bilan" ? bilan : n === "texte" ? texte : m[n]));
  if(opt.ecrire) ecrireJSON(fe, m.St.snapshot());
  if(!opt.muet && r !== undefined) console.log(typeof r === "string" ? r : JSON.stringify(r, null, 2));
  return r;
}

/* ---------- les remèdes ----------
   Chaque alerte du contrôle porte les gestes que l'app propose pour la
   réparer (`mix/fix.js`, `mass/fix.js`) ; le bilan en donne les noms. Ici, on
   en joue un : `remede <code> [n]`, n le rang du remède (0 par défaut). */
async function verbeRemede({ pos, opt }){
  const { C, CM, St } = await modules();
  const fe = opt.etat || FE;
  ouvrir(opt);
  const [code, n] = pos;
  if(!code) throw new Erreur("remede <code> [n] — les codes et leurs remèdes sont dans le bilan");
  const a = C.massCheck().concat(CM.mixCheck()).find((x) => x.code === code && !x.ok);
  if(!a) throw new Erreur("aucune alerte ouverte de code " + code);
  const k = n === undefined ? 0 : entier(n, "n");
  const f = (a.fixes || [])[k];
  if(!f) throw new Erreur("l'alerte " + code + " n'a pas de remède n° " + k
    + (a.fixes && a.fixes.length ? " — " + a.fixes.map((x, i) => i + " " + x.label).join(" | ") : ""));
  /* `false` : le remède n'avait rien à faire (la vue le dit aussi) */
  if(await f.run() === false) throw new Erreur("le remède « " + f.label + " » n'a rien changé");
  const b = bilan([]);
  ecrireJSON(fe, St.snapshot());
  if(!opt.muet) console.log("remède joué : " + f.label + "\n");
  return sortie(b, opt, texte);
}

/* ---------- chercher ----------
   La recherche automatique de l'app : tirer beaucoup, garder peu. Chaque
   trouvaille est un état complet, écrit à côté de `--etat`. */
async function verbeChercher({ opt }){
  const { Rech } = await modules();
  const fe = opt.etat || FE, dos = dirname(fe);
  charger(lireJSON(opt.groupe || FG, !!opt.groupe), lireJSON(fe, false));
  const o = { essais: entier(opt.essais, "essais") || 30, garder: entier(opt.garder, "garder") || 3 };
  if(opt.partis) o.partis = String(opt.partis).split(",").map((s) => s.trim()).filter(Boolean);
  if(opt["avec-erreurs"]) o.sansErreur = false;
  const r = await Rech.rechercher(o);
  if(existsSync(dos)) readdirSync(dos).filter((f) => /^trouve-\d+\.json$/.test(f))
    .forEach((f) => unlinkSync(join(dos, f)));
  const out = r.trouves.map((t, k) => {
    const fichier = join(dos, "trouve-" + (k + 1) + ".json");
    ecrireJSON(fichier, t.state);
    const v = t.row.verdict || {};
    return { fichier, parti:t.pid, score:t.row.score,
             massing:{ e:(v.mass || {}).e || 0, w:(v.mass || {}).w || 0 },
             mixer:{ e:(v.mix || {}).e || 0, w:(v.mix || {}).w || 0 } };
  });
  return sortie(out, opt, (l) => r.essais + " essais, " + l.length + " gardés\n" + l.map((t) =>
    t.fichier + " · " + t.parti + " · " + t.score + "/100 · massing " + t.massing.e + "e " + t.massing.w
    + "w · mixer " + t.mixer.e + "e " + t.mixer.w + "w").join("\n"));
}

/* ---------- les tests ----------
   Une seule vérification, qui casse si la logique casse. Chaque test repart
   d'un état tiré en mémoire, celui du troisième snapshot de CLAUDE.md. */
async function etatDeReference(){
  const { M, G, S, St, R } = await modules();
  R.seed(1);
  S.repartir({ alea:false, etages:true });
  M.massSet("parti", "auto");
  M.massVols(G.genMass(11));
  return JSON.parse(JSON.stringify(St.snapshot()));
}
/* hors la date, et sans distinguer `null` d'absent : `restore()` remet à
   `null` des champs qu'un tirage frais n'avait pas posés — même sens. */
function sansDate(o){
  const c = JSON.parse(JSON.stringify(o, (k, v) => v === null ? undefined : v));
  delete c.updatedAt;
  return c;
}

const TESTS = {
  async aller_retour(ref){
    const { St } = await modules();
    charger(null, ref);
    assert.deepEqual(sansDate(St.snapshot()), sansDate(ref));
  },
  async bilan_troisieme_snapshot(ref){
    const { M, E } = await modules();
    const b = bilan(charger(null, ref));
    assert.equal(b.jugement.total, E.evaluationCourante().jugement.total);
    /* La figure tirée en « Auto » ne survit pas à l'instantané (il garde
       `auto`) : on ne la lit que dans le processus qui a tiré. */
    assert.equal(b.massing.parti, M.MASS.vol.parti || M.MASS.parti);
    assert.equal(b.jugement.total, 64);
  },
  async corps_minimal(ref){
    const v0 = ref.mass.vol[0];
    const e = structuredClone(ref);
    e.mass.vol = [{ x:v0.x, y:v0.y, a:0, lv:[{ i:0, w:30, d:14 }] }];
    e.mass.pont = [];
    const b = bilan(charger(null, e));
    assert.equal(b.massing.corps.length, 1);
    assert.notEqual(b.jugement, null);
  },
  async hors_perimetre(ref){
    const e = structuredClone(ref);
    e.mass.vol[0].x += 1000;
    assert.ok(bilan(charger(null, e)).massing.verdict.e > 0);
  },
  async perdu(ref){
    const e = structuredClone(ref);
    e.blocks = "cassé";
    const perdu = charger(null, e);
    assert.ok(perdu.includes("répartition"), JSON.stringify(perdu));
    assert.deepEqual(bilan(perdu).perdu, perdu);
  },
  async tirer_ordonne(){
    const f = ".atelier/test/t.json";
    const b0 = await verbeTirer({ pos:[], opt:{ ordonne:true, seed:"1", graine:"11", etat:f, muet:true } });
    assert.equal(b0.massing.parti, "barres");
    const b = bilan(charger(null, lireJSON(f, true)));
    assert.equal(b.jugement.total, 64);
  },
  async tirer_sans_etat(){
    const f = ".atelier/test/neuf.json";
    if(existsSync(f)) unlinkSync(f);
    /* dans un processus NEUF : celui des tests a déjà un programme réparti */
    const b = JSON.parse(execFileSync(process.execPath,
      [fileURLToPath(import.meta.url), "tirer", "--parti", "cour", "--etat", f, "--json"], { encoding:"utf8" }));
    assert.ok(b.massing.demande > 0, "demandé " + b.massing.demande);
  },
  async chercher(){
    const etat = ".atelier/test/c/etat.json";
    const r = await verbeChercher({ pos:[], opt:{ essais:"3", garder:"2", etat, muet:true } });
    assert.ok(r.length >= 1 && r.length <= 2, "trouvés : " + r.length);
    r.forEach((t) => assert.deepEqual(charger(null, lireJSON(t.fichier, true)), []));
  },
  async poids_change_la_note(ref){
    const { J } = await modules();
    const f = ".atelier/test/l.json", g = ".atelier/test/g.json", ax = J.AXES[0];
    ecrireJSON(f, ref); if(existsSync(g)) unlinkSync(g);
    const t0 = bilan(charger(null, ref)).jugement.total;
    const r = await verbeLigne({ pos:["ax:" + ax.id, "0"], opt:{ etat:f, groupe:g, muet:true } });
    assert.equal(r.avant, ax.w);
    assert.equal(r.apres, 0);
    assert.notEqual(bilan(charger(lireJSON(g, true), lireJSON(f, true))).jugement.total, t0);
  },
  async borne(ref){
    const { J } = await modules();
    const f = ".atelier/test/l.json", g = ".atelier/test/g.json";
    ecrireJSON(f, ref); if(existsSync(g)) unlinkSync(g);
    const r = await verbeLigne({ pos:["ax:" + J.AXES[0].id, "500"], opt:{ etat:f, groupe:g, muet:true } });
    assert.equal(r.apres, 100);
  },
  async ligne_inconnue(){
    await assert.rejects(verbeLigne({ pos:["pas:une:ligne", "1"], opt:{ groupe:".atelier/test/g.json", muet:true } }),
      (e) => e instanceof Erreur && e.message.includes("pas:une:ligne"));
  },
  async jury_hors_etat(ref){
    const { J } = await modules();
    const f = ".atelier/test/l.json", g = ".atelier/test/g.json", k = "ax:" + J.AXES[0].id;
    ecrireJSON(f, ref); if(existsSync(g)) unlinkSync(g);
    await verbeLigne({ pos:[k, "7"], opt:{ etat:f, groupe:g, muet:true } });
    assert.equal(k in (lireJSON(f, true).doc || {}), false);
    assert.equal(lireJSON(g, true).doctrine[k], 7);
  },
  async valeur_refusee(){
    await assert.rejects(verbeLigne({ pos:["module", "abc"], opt:{ groupe:".atelier/test/g.json", etat:"nope.json", muet:true } }),
      (e) => e instanceof Erreur && e.message.includes("refusée"));
  },
  async toutes_les_lignes(){
    const { L } = await modules();
    const l = await verbeLigne({ pos:[], opt:{ toutes:true, groupe:"nope.json", etat:"nope.json", muet:true } });
    assert.equal(l.length, Object.keys(L.V).length);
    assert.match(l.find((x) => x.cle === "w:b7").n, /Implantation/);
    const c = await verbeLigne({ pos:[], opt:{ toutes:true, cherche:"nappe", groupe:"nope.json", etat:"nope.json", muet:true } });
    assert.ok(c.length > 0 && c.length < l.length);
  },
  async variante(ref){
    const f = ".atelier/test/v-etat.json", s = ".atelier/test/v.json";
    ecrireJSON(f, ref);
    const r = await verbeVariante({ pos:["essai"], opt:{ etat:f, sortie:s, muet:true } });
    assert.equal(r.name, "essai");
    assert.ok(r.state.mass.vol.length > 0);
    assert.equal(r.criteria.v, 3);
    assert.deepEqual(r.tags, ["claude"]);
    assert.equal("team_id" in r, false);
    assert.equal("author_id" in r, false);
    assert.deepEqual(lireJSON(s, true), JSON.parse(JSON.stringify(r)));
  },
  async js_ecrire(ref){
    const f = ".atelier/test/js.json", x0 = ref.mass.vol[0].x;
    ecrireJSON(f, ref);
    await verbeJs({ pos:["M.MASS.vol[0].x += 5"], opt:{ etat:f, ecrire:true, muet:true } });
    assert.ok(Math.abs(lireJSON(f, true).mass.vol[0].x - (x0 + 5)) < 1e-9);
  },
  async js_fichier(ref){
    const f = ".atelier/test/js.json", p = ".atelier/test/code.js";
    ecrireJSON(f, ref);
    writeFileSync(p, "return \"a'\\\"b\";\n");
    assert.equal(await verbeJs({ pos:[], opt:{ fichier:p, etat:f, muet:true } }), "a'\"b");
  },
  async remede(ref){
    /* un corps sorti de la parcelle : « Ramener le volume 1 dans la parcelle » */
    const f = ".atelier/test/rem.json";
    ref.mass.vol[0].x += 40;
    ecrireJSON(f, ref);
    const b = await verbeRemede({ pos:["m:perimetre:v1"], opt:{ etat:f, muet:true } });
    assert.equal(b.massing.alertes.some((x) => x.code === "m:perimetre:v1"), false);
    assert.equal(bilan(charger(null, lireJSON(f, true))).massing.alertes.some((x) => x.code === "m:perimetre:v1"), false);
    await assert.rejects(verbeRemede({ pos:["m:pas-la"], opt:{ etat:f, muet:true } }), Erreur);
  },
  async etat_absent(){
    assert.throws(() => lireJSON("nexiste/pas.json", true),
      (e) => e instanceof Erreur && e.message.includes("nexiste/pas.json"));
  }
};

async function test(){
  await modules();
  const ref = await etatDeReference();
  let ko = 0;
  for(const [nom, f] of Object.entries(TESTS)){
    try{ await f(structuredClone(ref)); console.log("ok  ", nom); }
    catch(e){ ko++; console.log("KO  ", nom, "—", e.message.split("\n")[0]); }
  }
  console.log(ko ? ko + " échec(s)" : Object.keys(TESTS).length + " tests passés");
  if(ko) process.exitCode = 1;
}

/* ---------- la ligne de commande ---------- */
const VERBES = { bilan: verbeBilan, tirer: verbeTirer, chercher: verbeChercher, ligne: verbeLigne,
  remede: verbeRemede, variante: verbeVariante, js: verbeJs, test };

function analyser(argv){
  const pos = [], opt = {};
  for(let i = 0; i < argv.length; i++){
    const a = argv[i];
    if(a.startsWith("--")){
      const k = a.slice(2), suiv = argv[i + 1];
      if(suiv !== undefined && !suiv.startsWith("--")){ opt[k] = suiv; i++; }
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

async function main(argv){
  const [verbe, ...reste] = argv;
  const f = VERBES[verbe];
  if(!f){
    console.error("verbes : " + Object.keys(VERBES).join(", "));
    process.exitCode = 1;
    return;
  }
  try{ await f(analyser(reste)); }
  catch(e){
    if(!(e instanceof Erreur)) throw e;
    console.error(e.message);
    process.exitCode = 1;
  }
}

if(import.meta.url === new URL(process.argv[1], "file:///").href || process.argv[1]?.endsWith("claude.mjs")){
  await main(process.argv.slice(2));
}
