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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import assert from "node:assert/strict";

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
export function texte(b){
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
    L.push("  critères :");
    b.jugement.crit.forEach((x) => L.push("    " + x.id.padEnd(6) + pc(x.s).padStart(6) + "  " + x.de.padEnd(10)
      + x.n + (x.mesure ? "  [" + x.mesure + " = " + JSON.stringify(x.valeur) + "]" : "")));
    b.ecarts.forEach((x) => L.push("  écart [" + x.sev + "] " + x.k + " — " + x.msg));
    L.push("  orientation :");
    Object.entries(b.qualites).forEach(([id, q]) => L.push("    " + id.padEnd(8) + q.niv.padEnd(12) + q.txt));
  }
  return L.join("\n");
}

function sortie(o, opt, txt){ console.log(opt.json ? JSON.stringify(o, null, 2) : txt(o)); }
const FG = ".atelier/groupe.json", FE = ".atelier/etat.json";
function ouvrir(opt){
  const g = lireJSON(opt.groupe || FG, !!opt.groupe), e = lireJSON(opt.etat || FE, true);
  return charger(g, e);
}

async function verbeBilan({ opt }){
  await modules();
  sortie(bilan(ouvrir(opt)), opt, texte);
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
const VERBES = { bilan: verbeBilan, test };

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
