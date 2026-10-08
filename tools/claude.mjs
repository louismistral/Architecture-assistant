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
     node tools/claude.mjs rhino            l'état → un .3dm, selon la convention de calques
     node tools/claude.mjs importer f.3dm   un .3dm (de Rhino, d'un humain) → l'état
     node tools/claude.mjs test             la vérification de l'outil
   ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

/* Les modules de l'app écrivent sur l'appareil ; ici, il n'y en a pas. Posé
   AVANT de les importer, d'où les imports dynamiques. */
globalThis.localStorage ??= { getItem(){ return null; }, setItem(){}, removeItem(){} };

const SRC = new URL("../src/", import.meta.url);
let MODS = null;

class Erreur extends Error {}

/* L'outil ne touche JAMAIS au réseau : la base est l'affaire de Claude, par le
   connecteur. Imposé ici plutôt que promis — `js` atteint `net/supa.js`. */
globalThis.fetch = () => { throw new Erreur("réseau interdit : la base passe par le connecteur, pas par l'outil"); };
globalThis.WebSocket = undefined;

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
  const [, cadre] = await Promise.all(["data/leviers.js", "data/cadre.js", "data/orientation.js",
                     "data/recherche.js", "data/donnees.js"].map(im));
  const [site, geom, emp] = await Promise.all(["data/site.js", "mass/geom.js", "core/empreinte.js"].map(im));
  MODS = { M, G, F, S, St, R, L, J, E, C, CM, Va, Rech, T, XM, XX, model, cadre, site, geom, emp };
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

/* Ce que le connecteur rend est une LISTE de lignes : `[{ state:{…} }]`. Écrit
   tel quel, un état se relisait vide, sans erreur — et l'on jugeait le projet
   par défaut. On déballe, puis on refuse ce qui n'a rien d'un état. */
function deballer(o){
  if(Array.isArray(o)) o = o[0];
  if(o && typeof o === "object" && o.state && typeof o.state === "object" && !o.mass && !o.blocks) o = o.state;
  return o;
}
export function lireEtat(chemin, requis){
  const o = lireJSON(chemin, requis);
  if(o === null && !requis) return null;
  const e = deballer(o);
  if(!e || typeof e !== "object" || !["areas", "lvls", "blocks", "mass"].some((k) => k in e))
    throw new Erreur(chemin + " ne ressemble pas à un état du projet (ni areas, ni lvls, ni blocks, ni mass)");
  return e;
}
export function lireGroupe(chemin, requis){
  const o = lireJSON(chemin, requis);
  if(o === null) return null;
  const g = Array.isArray(o) ? o[0] : o;
  if(g != null && (typeof g !== "object" || !["areas", "circulation", "doctrine"].some((k) => k in g)))
    throw new Erreur(chemin + " ne ressemble pas aux réglages d'un groupe (areas, circulation, doctrine)");
  return g || null;
}
/* Un verbe qui ÉCRIT ne le fait pas sur un état à moitié remis : il
   blanchirait la perte en un état qui a l'air sain. */
function garde(perdu){
  if(perdu.length) throw new Erreur("PERDU au chargement : " + perdu.join(", ") + " — rien n'est écrit");
  return perdu;
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
  if(!etat) return [];
  etat = structuredClone(etat);
  const perdu = [];
  const m = etat.mass;
  if(m !== undefined && m !== null && (typeof m !== "object" || Array.isArray(m))){ perdu.push("massing"); delete etat.mass; }
  else if(m && m.vol !== undefined){
    if(!Array.isArray(m.vol)){ perdu.push("massing"); m.vol = []; }
    else {
      /* `setMass()` écarte en silence un corps sans étages ; on le dit */
      const n = m.vol.length;
      m.vol = m.vol.filter((v) => v && typeof v === "object" && Array.isArray(v.lv) && v.lv.length);
      if(m.vol.length < n) perdu.push("massing (" + (n - m.vol.length) + " corps sans étages ignorés)");
      /* Un corps sans `id` est « lié » à tous les autres (`lies()` compare
         `joint` et `id`, tous deux absents) : on lui en donne un. */
      const pris = new Set(m.vol.map((v) => v.id).filter((x) => x != null));
      m.vol.forEach((v, k) => {
        if(v.id != null) return;
        let id = "c" + (k + 1), j = 1;
        while(pris.has(id)) id = "c" + (k + 1) + "_" + j++;
        v.id = id; pris.add(id);
      });
    }
  }
  return perdu.concat(St.restore(etat));
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
    /* l'empreinte du code d'aujourd'hui : une variante dont la colonne `fingerprint`
       diffère est PÉRIMÉE (le programme ou le règlement a changé depuis) */
    empreinte: MODS.emp.empreinte(),
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
      /* ce que chaque niveau demande (bâti : locaux + circulation) et ce que
         les corps y posent — ce qu'il faut tenir en composant à la main */
      niveaux: M.bilan().map((n) => ({ i:n.i, nom:n.nom, lvl:n.lvl, demande:Math.round(n.demande),
        pose:Math.round(n.pose), ecart:Math.round(n.ecart) })),
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
  L.push("empreinte du code : " + b.empreinte, "");
  L.push("MIXER");
  b.mixer.niveaux.forEach((n) => L.push("  " + n.nom.padEnd(17) + (n.net + "/" + n.utile + " m²").padEnd(14)
    + (n.pieces + " pièces").padEnd(12) + "h=" + n.h));
  L.push("  bac : " + b.mixer.bac + " m²", "  verdict : " + JSON.stringify(b.mixer.verdict));
  b.mixer.alertes.forEach((a) => L.push("  [" + a.sev + "] " + a.code + " — " + a.msg
    + (a.remedes ? "  → " + a.remedes.join(" | ") : "")));
  L.push("", "MASSING · " + b.massing.parti + " · demandé " + b.massing.demande + " · posé " + b.massing.pose);
  b.massing.niveaux.forEach((n) => L.push("  niveau " + n.i + " " + n.nom.padEnd(17) + "demandé " + n.demande
    + " · posé " + n.pose + " · écart " + (n.ecart > 0 ? "+" : "") + n.ecart));
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
/* `let` : les tests les détournent, pour ne pas lire le groupe de l'espace de travail */
let FG = ".atelier/groupe.json", FE = ".atelier/etat.json";
function groupeDe(opt){ return lireGroupe(opt.groupe || FG, !!opt.groupe); }
function ouvrir(opt){ return charger(groupeDe(opt), lireEtat(opt.etat || FE, true)); }

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
  const e = lireEtat(fe, false);
  garde(charger(groupeDe(opt), e));
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
/* Ce que dit une clé, en mots : il y en a plus de 400, et `w:b7` ne parle pas.
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
  const g = lireGroupe(fg, false), e = lireEtat(fe, false);
  const perdu = charger(g, e);
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
  garde(perdu);
  const avant = L.V[k], change = L.regler(k, v);
  /* Refusée, seulement si `regler()` ne pouvait pas la lire : une valeur bornée
     qui retombe sur l'actuelle est « inchangée », pas refusée. */
  if(!change){
    const d = L.defaut(k), b = L.borne(k) || {};
    const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : +v;
    if((typeof d === "number" && !isFinite(n)) || (typeof d === "string" && b.parmi && !b.parmi.includes(v)))
      throw new Erreur("valeur refusée pour " + k + " : " + v + " (borne " + JSON.stringify(L.borne(k)) + ")");
  }
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
  garde(ouvrir(opt));
  const row = Va.resumeCourant();
  row.name = (pos[0] && pos[0].trim()) || Va.nomPropose();
  row.state = St.snapshot();
  row.tags = ["claude"];
  const fs = opt.sortie || ".atelier/variante.json", fq = fs.replace(/\.json$/, "") + ".sql";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /* la mère : la variante dont l'état est parti (requête 4, ou ce que `importer`
     a lu dans le .3dm) — les variantes se lisent alors à la suite */
  if(opt.parent !== undefined){
    if(!UUID.test(String(opt.parent))) throw new Erreur("--parent attend l'uuid de la variante mère");
    row.parent_id = opt.parent;
  }
  /* vérifié AVANT d'écrire quoi que ce soit ; et jamais une vieille requête à
     côté d'une nouvelle ligne : on l'insérerait par erreur */
  if((opt.team || opt.auteur) && (!UUID.test(String(opt.team)) || !UUID.test(String(opt.auteur))))
    throw new Erreur("--team et --auteur attendent deux uuid (requête 1 du skill)");
  if(existsSync(fq)) unlinkSync(fq);
  ecrireJSON(fs, row);
  /* `--team` et `--auteur` : la requête d'insertion entière, à passer telle
     quelle au connecteur — recopier six kilo-octets de JSON à la main est le
     plus sûr moyen d'en perdre un caractère. */
  if(opt.team){
    const j = JSON.stringify(row);
    let tag = "$j$"; for(let k = 0; j.includes(tag); k++) tag = "$j" + k + "$";
    const C = "name, seed_program, seed_massing, parti, score, floors, bodies, area_required, area_placed, "
      + "area_gross, verdict, criteria, thumbnail, fingerprint, state, tags" + (row.parent_id ? ", parent_id" : "");
    writeFileSync(fq,
      "insert into variant (team_id, author_id, " + C + ")\nselect '" + opt.team + "', '" + opt.auteur + "', "
      + C.split(", ").map((c) => "r." + c).join(", ") + "\nfrom jsonb_populate_record(null::public.variant, "
      + tag + j + tag + "::jsonb) r\nreturning id, name, score, tags;\n");
  }
  return sortie(row, opt, (r) => fs + (opt.team ? " + .sql" : "") + " · « " + r.name + " » · "
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
  const perdu = charger(groupeDe(opt), lireEtat(fe, false));
  if(opt.ecrire) garde(perdu);
  const code = opt.fichier ? readFileSync(opt.fichier, "utf8") : pos.join(" ");
  if(!code.trim()) throw new Erreur("rien à exécuter : js \"<code>\" ou js --fichier <chemin>");
  const noms = Object.keys(m).concat(["bilan", "texte"]);
  /* dans un bloc : `const L = …` y masque le module L au lieu de planter */
  const f = new AsyncFunction(...noms, "{\n" + code + "\n}");
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
  garde(ouvrir(opt));
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

/* ---------- le site ----------
   Où l'on peut poser : le périmètre du concours et la ligne de recul, en
   mètres du relevé (x vers l'est, y vers le nord), et l'axe principal du
   périmètre. Ce qu'il faut pour composer un corps à la main. */
async function verbeSite({ opt }){
  const { site, geom, cadre } = await modules();
  const P = site.PER, xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const m = cadre.reculVise();
  const o = { perimetre:P, bbox:[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
              recul:m, ligneRecul: m ? geom.ligneRecul(m).map((l) => l.map((p) => [r2(p[0]), r2(p[1])])) : [],
              axe:site.VANG, existants:site.SITE.bat.length };
  return sortie(o, opt, (o) => "périmètre (" + o.perimetre.length + " sommets, m) : "
    + o.perimetre.map((p) => p.join(",")).join(" ") + "\nemprise : x " + o.bbox[0] + "→" + o.bbox[2]
    + " · y " + o.bbox[1] + "→" + o.bbox[3] + "\nrecul visé : " + o.recul + " m · axe du périmètre : "
    + o.axe + " rad (" + Math.round(o.axe * 1800 / Math.PI) / 10 + "°)\nligne de recul : "
    + o.ligneRecul.map((l) => l.map((p) => p.join(",")).join(" ")).join("  |  "));
}

/* ---------- Rhino, dans les deux sens ----------
   Le même fichier que les boutons « Exporter / Importer (.3dm) » du Massing
   (`mass/export.js`, `mass/import.js`), selon la convention de calques
   (`data/calques.js`, docs/echange.md) : ce que Claude pose dans Rhino par le
   MCP, ou ce qu'un humain y a retouché, revient ici et se juge comme le
   reste. rhino3dm n'est PAS une dépendance du dépôt : la vue le charge du
   réseau, l'outil le prend dans un node_modules local (ignoré par git). */
async function rhino3dm(){
  let m;
  try{ m = await import("rhino3dm"); }
  catch(_){ throw new Erreur("rhino3dm absent : `npm i --no-save rhino3dm@8.35.0` à la racine du dépôt (node_modules est ignoré par git)"); }
  return m.default();
}
async function verbeRhino({ opt }){
  const { St } = await modules();
  const X = await import(new URL("mass/export.js", SRC));
  garde(ouvrir(opt));
  const rh = await rhino3dm();
  const fs = opt.sortie || ".atelier/massing.3dm";
  if(opt.parent !== undefined && !/^[0-9a-f-]{36}$/i.test(String(opt.parent)))
    throw new Erreur("--parent attend l'uuid de la variante dont l'état part");
  mkdirSync(dirname(fs), { recursive:true });
  const P = X.piecesMassing({ variante:opt.parent || null });
  writeFileSync(fs, X.dm3Massing(rh, { variante:opt.parent || null }));
  const par = {};
  P.objets.forEach((x) => { par[x.par] = (par[x.par] || 0) + 1; });
  const o = { fichier:fs, calques:P.calques, objets:P.objets.length, acteurs:par };
  return sortie(o, opt, (o) => o.fichier + " · " + o.objets + " objets · " + JSON.stringify(o.acteurs) + " · calques :\n  "
    + o.calques.join("\n  "));
}
async function verbeImporter({ pos, opt }){
  const { M, St } = await modules();
  const I = await import(new URL("mass/import.js", SRC));
  if(!pos[0]) throw new Erreur("importer <fichier.3dm>");
  /* l'état d'où vient le fichier : sa pile du mixer dit à quel niveau tombe
     chaque étage — sans elle, rien ne se relit */
  const fe = opt.etat || FE;
  garde(charger(groupeDe(opt), lireEtat(fe, true)));
  const rh = await rhino3dm();
  let sol, r;
  try{ sol = I.solides3dm(rh, new Uint8Array(readFileSync(pos[0]))); r = I.volsDe3dm(sol); if(r.mode === "libre") I.poserLibres(r); }
  catch(e){ throw new Erreur("import impossible : " + (e.message || e)); }
  M.massVols(r.vols);
  M.MASS.pile = M.empreintePile();
  const b = bilan([]);
  ecrireJSON(fe, St.snapshot());
  b.importe = { mode:r.mode, corps:r.vols.length, humain:r.vols.filter((v) => v.par === "humain").length,
                ia:r.vols.filter((v) => v.par === "ia").length,
                horsPile:r.horsPile || 0, parent:sol.variante || null };
  if(!opt.muet && !opt.json) console.log("importé : " + b.importe.corps + " corps (" + r.mode + "), "
    + b.importe.humain + " touché(s) par un humain, " + b.importe.ia + " par une IA" + (b.importe.horsPile ? ", " + b.importe.horsPile + " étage(s) hors pile ignorés" : "")
    + " · variante mère : " + (b.importe.parent || "aucune") + (b.importe.parent ? " — passe --parent " + b.importe.parent + " à `variante`" : "") + "\n");
  return sortie(b, opt, texte);
}

/* ---------- le plan ----------
   Un PNG du plan, pour que Claude VOIE ce qu'il compose : courbes de niveau
   (une par mètre), bâtiments existants, routes, périmètre, recul, et chaque
   corps — l'emprise de son plus bas étage hors sol peinte, chaque étage
   cerné. Le nord en haut, une barre de 10 m en bas à gauche. Aucune
   dépendance : un raster, un remplissage par balayage, un encodeur PNG. */
const PALETTE = [[214, 76, 60], [52, 120, 198], [46, 160, 90], [230, 150, 30], [140, 82, 190],
                 [30, 170, 170], [200, 70, 150], [120, 120, 40], [90, 90, 90], [170, 110, 70]];
const hex = (c) => "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");

function raster(x0, y0, x1, y1, s){
  const w = Math.ceil((x1 - x0) * s), h = Math.ceil((y1 - y0) * s), px = new Uint8Array(w * h * 3).fill(255);
  const versPx = (x, y) => [(x - x0) * s, (y1 - y) * s];
  function pose(i, j, c){
    if(i < 0 || j < 0 || i >= w || j >= h) return;
    const k = 3 * (j * w + i); px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2];
  }
  function trait(a, b, c, ep){
    const [ax, ay] = versPx(a[0], a[1]), [bx, by] = versPx(b[0], b[1]);
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay))), e = ep || 1, d = Math.floor((e - 1) / 2);
    for(let t = 0; t <= n; t++){
      const i = Math.round(ax + (bx - ax) * t / n), j = Math.round(ay + (by - ay) * t / n);
      for(let u = -d; u < e - d; u++) for(let v = -d; v < e - d; v++) pose(i + u, j + v, c);
    }
  }
  function ligne(pts, c, ep, fermee){
    for(let k = 0; k + 1 < pts.length; k++) trait(pts[k], pts[k + 1], c, ep);
    if(fermee && pts.length > 2) trait(pts[pts.length - 1], pts[0], c, ep);
  }
  /* pair-impair, au centre des pixels */
  function remplir(pts, c){
    const q = pts.map((p) => versPx(p[0], p[1]));
    const jm = Math.max(0, Math.floor(Math.min(...q.map((p) => p[1])))), jM = Math.min(h - 1, Math.ceil(Math.max(...q.map((p) => p[1]))));
    for(let j = jm; j <= jM; j++){
      const yc = j + .5, X = [];
      for(let k = 0; k < q.length; k++){
        const a = q[k], b = q[(k + 1) % q.length];
        if((a[1] <= yc) !== (b[1] <= yc)) X.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      X.sort((u, v) => u - v);
      for(let k = 0; k + 1 < X.length; k += 2)
        for(let i = Math.ceil(X[k] - .5); i <= Math.floor(X[k + 1] - .5); i++) pose(i, j, c);
    }
  }
  function lire(x, y){
    const [i, j] = versPx(x, y).map(Math.floor);
    if(i < 0 || j < 0 || i >= w || j >= h) return null;
    const k = 3 * (j * w + i); return [px[k], px[k + 1], px[k + 2]];
  }
  return { w, h, px, trait, ligne, remplir, lire };
}

const CRC = Array.from({ length:256 }, (_, n) => {
  let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
function crc32(b){ let c = 0xFFFFFFFF; for(const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function png(w, h, rgb){
  const bloc = (type, data) => {
    const t = Buffer.concat([Buffer.from(type, "ascii"), data]), o = Buffer.alloc(4), c = Buffer.alloc(4);
    o.writeUInt32BE(data.length); c.writeUInt32BE(crc32(t));
    return Buffer.concat([o, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const brut = Buffer.alloc((3 * w + 1) * h);
  for(let j = 0; j < h; j++) Buffer.from(rgb.buffer, rgb.byteOffset + 3 * w * j, 3 * w).copy(brut, (3 * w + 1) * j + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc("IHDR", ihdr),
                        bloc("IDAT", deflateSync(brut)), bloc("IEND", Buffer.alloc(0))]);
}

async function verbePlan({ opt }){
  const { M, site, geom, cadre } = await modules();
  ouvrir(opt);
  const P = site.PER, marge = 25, s = Number(opt.echelle) || 4;
  const x0 = Math.min(...P.map((p) => p[0])) - marge, x1 = Math.max(...P.map((p) => p[0])) + marge;
  const y0 = Math.min(...P.map((p) => p[1])) - marge, y1 = Math.max(...P.map((p) => p[1])) + marge;
  const R = raster(x0, y0, x1, y1, s);
  site.SITE.ctr.forEach(([z, l]) => R.ligne(l, Math.round(z) % 5 ? [228, 228, 228] : [200, 200, 200], 1));
  site.SITE.rou.forEach((l) => R.ligne(l, [170, 170, 170], 2));
  site.SITE.bat.forEach((b) => { R.remplir(b, [185, 185, 185]); R.ligne(b, [120, 120, 120], 1, true); });
  R.ligne(P, [0, 0, 0], 2, true);
  const m = cadre.reculVise();
  if(m) geom.ligneRecul(m).forEach((l) => R.ligne(l, [240, 140, 40], 1, true));
  const legende = M.MASS.vol.map((v, k) => {
    const c = PALETTE[k % PALETTE.length];
    /* un corps libre (un solide de Rhino) : son contour tel quel */
    if(v.libre) R.remplir(M.volCoins(v), c);
    else M.solRects(v).forEach((rc) => R.remplir(geom.coins(rc), c));
    v.lv.forEach((e) => (v.libre ? M.contourDe(v, e).loops : M.volRects(v, e).map(geom.coins)).forEach((P) => R.ligne(P, c.map((x) => x >> 1), 1, true)));
    return { corps: v.id == null ? k : v.id, nom: v.nom || null, couleur: hex(c), rgb: c };
  });
  (M.MASS.pont || []).forEach((p) => { const r = M.pontRect(p, M.MASS.vol); if(r) R.ligne(geom.coins(r), [0, 0, 0], 1, true); });
  /* la barre de 10 m */
  R.trait([x0 + 5, y0 + 4], [x0 + 15, y0 + 4], [0, 0, 0], 3);
  const fichier = opt.sortie || ".atelier/plan.png";
  mkdirSync(dirname(fichier), { recursive:true });
  writeFileSync(fichier, png(R.w, R.h, R.px));
  const o = { fichier, largeur:R.w, hauteur:R.h, echelle:s, legende, pixel:R.lire };
  return sortie(o, opt, (o) => o.fichier + " · " + o.largeur + "×" + o.hauteur + " px · " + o.echelle
    + " px/m · nord en haut · barre de 10 m en bas à gauche · courbes de niveau au mètre"
    + " · recul en orange\n" + o.legende.map((l) => "  " + l.couleur + "  corps " + l.corps + (l.nom ? " « " + l.nom + " »" : "")).join("\n"));
}

/* ---------- chercher ----------
   La recherche automatique de l'app : tirer beaucoup, garder peu. Chaque
   trouvaille est un état complet, écrit à côté de `--etat`. */
async function verbeChercher({ opt }){
  const { Rech } = await modules();
  const fe = opt.etat || FE, dos = dirname(fe);
  garde(charger(groupeDe(opt), lireEtat(fe, false)));
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
    /* pas de note figée ici : le jury change souvent, et l'égalité ci-dessus suffit */
    assert.equal(b.empreinte, (await import(new URL("core/empreinte.js", SRC))).empreinte());
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
  async tirer_ordonne(ref){
    const f = ".atelier/test/t.json";
    if(existsSync(f)) unlinkSync(f);   /* un état d'une course précédente porterait ses lignes */
    /* le tirage ordonné, seed 1 et graine 11, rend l'état de référence (troisième snapshot) */
    const attendu = bilan(charger(null, ref)).jugement.total;
    const b0 = await verbeTirer({ pos:[], opt:{ ordonne:true, seed:"1", graine:"11", etat:f, muet:true } });
    assert.equal(b0.jugement.total, attendu);
    const b = bilan(charger(null, lireJSON(f, true)));
    assert.equal(b.jugement.total, attendu);
    assert.equal(b.empreinte, (await import(new URL("core/empreinte.js", SRC))).empreinte());
  },
  async tirer_sans_etat(){
    const f = ".atelier/test/neuf.json";
    if(existsSync(f)) unlinkSync(f);
    /* dans un processus NEUF : celui des tests a déjà un programme réparti ;
       et un groupe vide, pas celui de l'espace de travail */
    const vide = ".atelier/test/groupe-vide.json";
    ecrireJSON(vide, { doctrine:{} });
    const b = JSON.parse(execFileSync(process.execPath,
      [fileURLToPath(import.meta.url), "tirer", "--parti", "cour", "--etat", f, "--groupe", vide, "--json"], { encoding:"utf8" }));
    assert.ok(b.massing.demande > 0, "demandé " + b.massing.demande);
  },
  async chercher(){
    const etat = ".atelier/test/c/etat.json";
    const r = await verbeChercher({ pos:[], opt:{ essais:"3", garder:"2", "avec-erreurs":true, etat, muet:true } });
    assert.ok(r.length >= 1 && r.length <= 2, "trouvés : " + r.length);
    r.forEach((t) => assert.deepEqual(charger(null, lireJSON(t.fichier, true)), []));
  },
  async poids_change_la_note(ref){
    const { J } = await modules();
    const f = ".atelier/test/l.json", g = ".atelier/test/g.json";
    ecrireJSON(f, ref); if(existsSync(g)) unlinkSync(g);
    const b0 = bilan(charger(null, ref)), t0 = b0.jugement.total;
    /* l'axe le plus loin de la note : l'éteindre doit la faire bouger */
    const loin = b0.jugement.axes.filter((a) => a.s != null).sort((p, q) => Math.abs(q.s * 100 - t0) - Math.abs(p.s * 100 - t0))[0];
    const ax = J.AXES.find((a) => a.id === loin.id);
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
    assert.equal(r.criteria.v, 4);   /* le format de `net/variantes.js` (aJour : v ≥ 4) */
    assert.deepEqual(r.tags, ["claude"]);
    assert.equal("team_id" in r, false);
    assert.equal("author_id" in r, false);
    assert.deepEqual(lireJSON(s, true), JSON.parse(JSON.stringify(r)));
  },
  async variante_sql(ref){
    const f = ".atelier/test/v-etat.json", s = ".atelier/test/v.json";
    ecrireJSON(f, ref);
    const team = "063c3451-3876-418b-b5a5-1da988e2c21a", moi = "65049058-9774-4e47-b23f-3d77bf6817e5";
    await verbeVariante({ pos:["l'essai"], opt:{ etat:f, sortie:s, team, auteur:moi, muet:true } });
    const q = readFileSync(s.replace(/\.json$/, ".sql"), "utf8");
    assert.match(q, /^insert into variant \(team_id, author_id,/);
    assert.ok(q.includes("'" + team + "', '" + moi + "'"));
    const j = q.slice(q.indexOf("$j$") + 3, q.lastIndexOf("$j$"));
    assert.equal(JSON.parse(j).name, "l'essai");
    await assert.rejects(verbeVariante({ pos:["x"], opt:{ etat:f, sortie:s, team:"pas-un-uuid", auteur:moi, muet:true } }), Erreur);
    /* la mère entre dans la requête, et seulement si on la donne */
    assert.equal(q.includes("parent_id"), false);
    await verbeVariante({ pos:["fille"], opt:{ etat:f, sortie:s, team, auteur:moi, parent:team, muet:true } });
    assert.match(readFileSync(s.replace(/\.json$/, ".sql"), "utf8"), /tags, parent_id\)/);
    await assert.rejects(verbeVariante({ pos:["x"], opt:{ etat:f, sortie:s, parent:"pas-un-uuid", muet:true } }), Erreur);
  },
  /* Rhino aller et retour, selon la convention : le Volume de l'algorithme en
     orange, la mère dans le fichier, un corps repeint « par calque » revient
     humain, un corps repeint en bleu revient à l'IA. Sans rhino3dm local, il n'y a rien à vérifier. */
  async rhino_aller_retour(ref){
    let rh;
    try{ rh = await rhino3dm(); }catch(_){ return; }
    const { M } = MODS;
    const X = await import(new URL("mass/export.js", SRC)), I = await import(new URL("mass/import.js", SRC));
    const Cq = await import(new URL("data/calques.js", SRC));
    garde(charger(null, ref));
    const mere = "11111111-2222-3333-4444-555555555555", n0 = M.MASS.vol.length;
    const doc = rh.File3dm.fromByteArray(X.dm3Massing(rh, { variante:mere })), O = doc.objects(), L = doc.layers();
    const d2 = new rh.File3dm();
    d2.settings().modelUnitSystem = doc.settings().modelUnitSystem;
    d2.strings().set("Saxon variante", doc.strings().getvalue("Saxon variante"));
    for(let k = 0; k < L.count; k++){
      const l = L.get(k), n = new rh.Layer();
      n.name = l.name; n.id = l.id; n.parentLayerId = l.parentLayerId; d2.layers().add(n);
    }
    let vol = 0, oranges = 0, repeint = null, bleui = null;
    for(let k = 0; k < O.count; k++){
      const o = O.get(k), a = o.attributes(), ch = L.get(a.layerIndex).fullPath;
      if(ch.startsWith(Cq.CALQUE.volume)){ vol++; if(Cq.acteurDe(a.objectColor) === "algo") oranges++; }
      if(ch.startsWith(Cq.CALQUE.volume) && !/Second_temps/.test(ch)){
        if(!repeint){ repeint = a.name; a.colorSource = rh.ObjectColorSource.ColorFromLayer; }
        else if(!bleui && !a.name.startsWith(repeint.split("_")[0] + "_")){
          bleui = a.name; const c = Cq.couleur("ia", .5); a.objectColor = { r:c[0], g:c[1], b:c[2], a:255 };
        }
      }
      d2.objects().add(o.geometry(), a);
    }
    assert.ok(vol > 0 && oranges === vol, oranges + " oranges sur " + vol);
    const sol = I.solides3dm(rh, d2.toByteArray()), r = I.volsDe3dm(sol);
    assert.equal(sol.variante, mere);
    assert.equal(r.vols.length, n0);
    assert.equal(r.vols.filter((v) => v.par === "humain").length, 1, "humain : " + repeint);
    assert.equal(r.vols.filter((v) => v.par === "ia").length, 1, "IA : " + bleui);
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
  async js_masque_un_module(ref){
    const f = ".atelier/test/js.json";
    ecrireJSON(f, ref);
    assert.equal(await verbeJs({ pos:["const L = 3; return L + M.MASS.vol.length * 0"], opt:{ etat:f, muet:true } }), 3);
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
  async niveaux_du_massing(ref){
    const { F } = await modules();
    const b = bilan(charger(null, ref));
    assert.equal(b.massing.niveaux.length, F.FLOORS.length);
    const d = b.massing.niveaux.reduce((s, n) => s + n.demande, 0);
    assert.ok(Math.abs(d - b.massing.demande) <= b.massing.niveaux.length, d + " / " + b.massing.demande);
  },
  async site(){
    const s = await verbeSite({ pos:[], opt:{ muet:true } });
    assert.equal(s.perimetre.length, 27);
    assert.equal(s.recul, 5);
    assert.ok(s.ligneRecul.length >= 1 && s.ligneRecul[0].length > 3);
  },
  async plan_png(ref){
    const f = ".atelier/test/p-etat.json", p = ".atelier/test/plan.png";
    ecrireJSON(f, ref);
    const r = await verbePlan({ pos:[], opt:{ etat:f, sortie:p, muet:true } });
    const o = readFileSync(p);
    assert.deepEqual([...o.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(o.readUInt32BE(16), r.largeur);
    assert.equal(o.readUInt32BE(20), r.hauteur);
    /* le centre de l'emprise du premier corps est peint de sa couleur */
    const { M } = await modules();
    const v = M.MASS.vol[0], rc = M.solRects(v)[0], c = r.legende.find((l) => l.corps === v.id).rgb;
    assert.deepEqual(r.pixel(rc.x, rc.y), c);
    assert.notDeepEqual(r.pixel(-50, -50), c);
  },
  /* ---- la relecture finale ---- */
  async deux_corps_sans_id(ref){
    const { M } = await modules();
    const v0 = ref.mass.vol[0], e = structuredClone(ref);
    e.mass.vol = [{ x:v0.x, y:v0.y, a:0, lv:[{ i:1, w:30, d:14 }] }, { x:v0.x + 40, y:v0.y, a:0, lv:[{ i:1, w:30, d:14 }] }];
    e.mass.pont = [];
    charger(null, e);
    const [a, b] = M.MASS.vol;
    assert.ok(a.id && b.id && a.id !== b.id, a.id + " / " + b.id);
    assert.equal(M.lies(a, b), false);
  },
  async perte_bloque_ecriture(ref){
    const f = ".atelier/test/casse.json", e = structuredClone(ref);
    e.blocks = "cassé";
    ecrireJSON(f, e);
    const avant = readFileSync(f, "utf8");
    await assert.rejects(verbeVariante({ pos:["x"], opt:{ etat:f, sortie:".atelier/test/vc.json", muet:true } }), /PERDU/);
    await assert.rejects(verbeTirer({ pos:[], opt:{ typo:true, etat:f, muet:true } }), /PERDU/);
    await assert.rejects(verbeJs({ pos:["1"], opt:{ etat:f, ecrire:true, muet:true } }), /PERDU/);
    assert.equal(readFileSync(f, "utf8"), avant);
  },
  async etat_enveloppe(ref){
    const f = ".atelier/test/env.json";
    for(const o of [[{ state:ref }], { state:ref }]){
      ecrireJSON(f, o);
      const b = await verbeBilan({ pos:[], opt:{ etat:f, muet:true } });
      assert.equal(b.massing.corps.length, ref.mass.vol.length);
    }
    for(const o of [null, {}, [], "x"]){
      ecrireJSON(f, o);
      await assert.rejects(verbeBilan({ pos:[], opt:{ etat:f, muet:true } }), Erreur);
    }
  },
  async groupe_enveloppe(ref){
    const { L } = await modules();
    const f = ".atelier/test/env.json", g = ".atelier/test/genv.json";
    ecrireJSON(f, ref);
    ecrireJSON(g, [{ areas:{}, circulation:null, doctrine:{ "ax:site":7 } }]);
    await verbeBilan({ pos:[], opt:{ etat:f, groupe:g, muet:true } });
    assert.equal(L.V["ax:site"], 7);
  },
  async corps_ignores(ref){
    const e = structuredClone(ref);
    e.mass.vol.push({ id:"z1", x:0, y:0, a:0, lv:[] }, { id:"z2", x:0, y:0, a:0, lv:"x" });
    const p = charger(null, e);
    assert.ok(p.some((x) => /massing/.test(x)), JSON.stringify(p));
    const e2 = structuredClone(ref); e2.mass = "cassé";
    assert.ok(charger(null, e2).some((x) => /massing/.test(x)));
  },
  async drapeaux(){
    assert.deepEqual(analyser(["--ecrire", "M.x = 1"]), { pos:["M.x = 1"], opt:{ ecrire:true } });
    assert.deepEqual(analyser(["--json", "nom", "--etat", "f.json"]), { pos:["nom"], opt:{ json:true, etat:"f.json" } });
  },
  async reseau_interdit(){
    assert.throws(() => fetch("https://example.com"), /réseau/);
  },
  async ligne_idempotente(ref){
    const f = ".atelier/test/l.json", g = ".atelier/test/g.json";
    ecrireJSON(f, ref); if(existsSync(g)) unlinkSync(g);
    await verbeLigne({ pos:["ax:site", "500"], opt:{ etat:f, groupe:g, muet:true } });
    const r = await verbeLigne({ pos:["ax:site", "500"], opt:{ etat:f, groupe:g, muet:true } });
    assert.equal(r.apres, 100);
    assert.equal(r.change, false);
    await verbeLigne({ pos:["module", "0,5"], opt:{ etat:f, groupe:g, muet:true } });
  },
  async sql_jamais_perime(ref){
    const f = ".atelier/test/v-etat.json", s = ".atelier/test/vs.json", q = ".atelier/test/vs.sql";
    ecrireJSON(f, ref);
    const team = "063c3451-3876-418b-b5a5-1da988e2c21a", moi = "65049058-9774-4e47-b23f-3d77bf6817e5";
    await verbeVariante({ pos:["a"], opt:{ etat:f, sortie:s, team, auteur:moi, muet:true } });
    await verbeVariante({ pos:["b"], opt:{ etat:f, sortie:s, muet:true } });
    assert.equal(existsSync(q), false);
    unlinkSync(s);
    await assert.rejects(verbeVariante({ pos:["c"], opt:{ etat:f, sortie:s, team, muet:true } }), Erreur);
    assert.equal(existsSync(s), false);
  },
  /* ---- le recouvrement dans un même bâtiment (mass/geom.js, mass/model.js) ---- */
  async rec_inter_carres(){
    const { geom } = await modules();
    const P = geom.coins({ x:0, y:0, w:20, d:20, a:0 }), Q = geom.coins({ x:15, y:0, w:20, d:20, a:0 });
    assert.ok(Math.abs(geom.airePoly(geom.interConvexe(P, Q)) - 100) < 1e-6);
  },
  async rec_inter_45(){
    const { geom } = await modules();
    const a = 10, P = geom.coins({ x:3, y:4, w:a, d:a, a:0 }), Q = geom.coins({ x:3, y:4, w:a, d:a, a:Math.PI / 4 });
    assert.ok(Math.abs(geom.airePoly(geom.interConvexe(P, Q)) - a * a * (2 * Math.SQRT2 - 2)) < 1e-6);
  },
  async rec_contact_nul(){
    const { geom } = await modules();
    const P = geom.coins({ x:0, y:0, w:20, d:20, a:0.3 }), Q = geom.coins({ x:20 * Math.cos(0.3), y:20 * Math.sin(0.3), w:20, d:20, a:0.3 });
    assert.equal(geom.interConvexe(P, Q).length, 0);
    assert.ok(geom.longueurDans(P, Q) < 1e-6 && geom.longueurDans(Q, P) < 1e-6);
  },
  async rec_longueur_dans(){
    const { geom } = await modules();
    const G = geom.coins({ x:0, y:0, w:20, d:20, a:0 });
    assert.ok(Math.abs(geom.longueurDans(geom.coins({ x:1, y:1, w:4, d:4, a:0.2 }), G) - 16) < 1e-6);
    /* à cheval : 4 × 10 dont la moitié dedans → 4 + 5 + 5 */
    assert.ok(Math.abs(geom.longueurDans(geom.coins({ x:10, y:0, w:10, d:4, a:0 }), G) - 14) < 1e-6);
  },
  async rec_bilan(ref){
    const { M } = await modules();
    /* deux corps de 20 × 20 au rez (niveau 1), intérieurs recouverts de 5 × 20 */
    const pose = (B, A) => {
      const e = structuredClone(ref);
      e.mass.vol = [Object.assign({ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] }, A || {}),
                    Object.assign({ id:"c", x:105, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] }, B || {})];
      e.mass.pont = [];
      charger(null, e);
      return Math.round(M.bilan()[1].pose);
    };
    assert.equal(pose(), 700, "liés recouverts");
    assert.equal(pose({ bat:"autre" }), 800, "non liés : rien ne se retranche");
    assert.equal(pose({ x:110 }), 800, "contact");
    assert.equal(pose({ ph:2 }), 400, "second temps ignoré");
    /* une part fusionnée de 10 × 20 à droite de a ; c la recouvre de 5 × 20 */
    assert.equal(pose({ x:115 }, { lv:[{ i:1, w:20, d:20, ext:[{ w:10, d:20, dx:15, dy:0 }] }] }), 900, "part fusionnée");
  },
  async rec_part_cedee(ref){
    const { M } = await modules();
    const e = structuredClone(ref);
    /* c, plus petit (15 × 20), listé AVANT a : il cède quand même */
    e.mass.vol = [{ id:"c", x:102.5, y:60, a:0, bat:"b", lv:[{ i:1, w:15, d:20 }] },
                  { id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] }];
    e.mass.pont = [];
    charger(null, e);
    const [c, a] = M.MASS.vol;
    assert.ok(Math.abs(M.partCedee(c, M.MASS.vol, 1) - 100) < 1e-6);
    assert.equal(M.partCedee(a, M.MASS.vol, 1), 0);
    assert.ok(Math.abs(M.recouvrement(M.MASS.vol, 1, false).aire - 100) < 1e-6);
    /* à égalité, l'ordre tranche : le premier garde */
    c.lv[0].w = 20; c.x = 105;
    assert.equal(M.partCedee(c, M.MASS.vol, 1), 0);
    assert.ok(Math.abs(M.partCedee(a, M.MASS.vol, 1) - 100) < 1e-6);
  },
  async rec_jury(ref){
    const { M, E } = await modules();
    const mes = (bat) => {
      const e = structuredClone(ref);
      e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }, { i:2, w:20, d:20 }] },
                    { id:"c", x:100, y:66, a:0.4, bat, lv:[{ i:1, w:20, d:20 }, { i:2, w:20, d:20 }] }];
      e.mass.pont = [];
      charger(null, e);
      return E.evaluationCourante().mes;
    };
    const brut = mes("autre"), lie = mes("b");
    const r1 = M.recouvrement(M.MASS.vol, 1, true).aire, r2 = M.recouvrement(M.MASS.vol, 2, true).aire;
    /* la hauteur d'un étage de corps (3,20 m ici), pas celle du niveau (7,40 m au rez, pour la salle) */
    const h = (i) => M.etagesDe(M.MASS.vol[0], M.MASS.vol).find((x) => x.e.i === i).h;
    const { RULES } = await import(new URL("data/rules.js", SRC));
    assert.ok(r1 > 50, "le cas recouvre vraiment : " + r1);
    assert.ok(Math.abs((brut.emprise - lie.emprise) - r1) <= 1, "emprise " + brut.emprise + " → " + lie.emprise);
    const attendu = r1 * h(1) + r2 * h(2) + r1 * RULES.haut.acrotere;
    assert.ok(Math.abs((brut.volume - lie.volume) - attendu) <= 2, "volume " + brut.volume + " → " + lie.volume + ", attendu −" + Math.round(attendu));
    assert.ok(Math.abs((lie.terrainMarge - brut.terrainMarge) - r1) <= 1, "terrain");
  },
  async rec_dist(ref){
    const { M, E, L } = await modules();
    const dist = (bat) => {
      const e = structuredClone(ref);
      e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] },
                    { id:"c", x:105, y:60, a:0, bat, lv:[{ i:1, w:20, d:20 }] }];
      e.mass.pont = [];
      charger(null, e);
      L.regler("t:dist", "impose"); L.regler("on:dist", 1);
      return E.ecarts(M.MASS.vol, false).filter((x) => x.k === "dist").length;
    };
    assert.equal(dist("b"), 0, "liés : aucune distance due");
    assert.ok(dist("autre") > 0, "non liés : ils s'interpénètrent");
  },
  async rec_requilibre(ref){
    const { M, XM } = await modules();
    const e = structuredClone(ref);
    /* v1 rejoint le bâtiment de v2 et glisse de 3 m dans lui */
    const v1 = e.mass.vol.find((v) => v.id === "v1"), v2 = e.mass.vol.find((v) => v.id === "v2");
    v1.bat = v2.bat;
    const dx = v2.x - v1.x, dy = v2.y - v1.y, n = Math.hypot(dx, dy);
    charger(null, e);
    const w = M.MASS.vol.find((v) => v.id === "v1");
    for(let s = 0; s < 40 && M.recouvrement(M.MASS.vol, 2, false).aire < 30; s++){ w.x += dx / n; w.y += dy / n; }
    assert.ok(M.recouvrement(M.MASS.vol, 2, false).aire >= 30, "le cas recouvre vraiment");
    XM.requilibre();
    M.bilan().forEach((b) => { if(b.demande > 0 && b.pose > 0) assert.ok(Math.abs(b.ecart) / b.demande < 0.01, b.nom + " écart " + Math.round(b.ecart)); });
  },
  async rec_main(ref){
    const { M, G } = await modules();
    const e = structuredClone(ref);
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] },
                  { id:"c", x:105, y:62, a:0.3, bat:"b", lv:[{ i:1, w:20, d:20 }] }];
    e.mass.pont = [];
    charger(null, e);
    const [a, c] = M.MASS.vol;
    assert.equal(G.chevaucheMain(c, M.MASS.vol), false, "liés : la main peut poser l'un sur l'autre");
    assert.equal(G.chevauche(c, M.MASS.vol), true, "le générateur, lui, refuse toujours");
    c.bat = "autre";
    assert.equal(G.chevaucheMain(c, M.MASS.vol), true, "non liés : refusé");
    assert.equal(a.id, "a");
  },
  async rec_fusion_garde_le_lien(ref){
    const { M, G } = await modules();
    const e = structuredClone(ref);
    /* z touche p bout à bout ; p est posé sur a (même bâtiment) ; z est listé d'abord */
    const a = 0.3, L = 20 + 2 * 0.40;
    e.mass.vol = [{ id:"z", x:105 + Math.cos(a) * L, y:62 + Math.sin(a) * L, a, bat:"z", lv:[{ i:1, w:20, d:20 }] },
                  { id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] },
                  { id:"p", x:105, y:62, a, bat:"b", lv:[{ i:1, w:20, d:20 }] }];
    e.mass.pont = [];
    charger(null, e);
    G.fusionner(M.MASS.vol, M.MASS.pont);
    /* z et p, bout à bout dans le même axe, se soudent en un volume : il doit rester
       du bâtiment de a, et rien ne doit se superposer sans lien */
    const A = M.MASS.vol.find((v) => v.id === "a");
    assert.ok(M.MASS.vol.every((v) => v === A || M.lies(v, A)), M.MASS.vol.map((v) => v.id + ":" + v.bat).join(" "));
    assert.ok(M.MASS.vol.every((v) => !G.chevaucheMain(v, M.MASS.vol)), "superposition entre corps non liés");
  },
  async rec_typo(ref){
    const im = (p) => import(new URL(p, SRC));
    const [{ donneesTypo }, { planifier }] = await Promise.all([im("typo/donnees.js"), im("typo/gen.js")]);
    const e = structuredClone(ref);
    /* au rez : a, 30 × 16, et c, 16 × 16, posé de 8 m sur le bout de a */
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                  { id:"c", x:105, y:60, a:0, bat:"b", lv:[{ i:1, w:16, d:16 }] }];
    e.mass.pont = [];
    charger(null, e);
    const D = donneesTypo();
    const V = D.partis.courant.vols, A = V.find((v) => v.id === "a"), C = V.find((v) => v.id === "c");
    /* aux plans, c se raccourcit de sa part commune (8 m), du côté de a : il ne la pave pas */
    const ec = C.lv.find((x) => x.i === 1), ea = A.lv.find((x) => x.i === 1);
    const u = [Math.cos(C.a), Math.sin(C.a)], centre = [C.x + u[0] * ec.dx - u[1] * (ec.dy || 0), C.y + u[1] * ec.dx + u[0] * (ec.dy || 0)];
    assert.ok(Math.abs(ec.w * ec.d - 8 * 16) < 1e-6, "c garde 8 × 16 : " + ec.w + " × " + ec.d);
    assert.ok(Math.abs(centre[0] - 109) < 1e-6 && Math.abs(centre[1] - 60) < 1e-6, "le centre de c glisse loin de a : " + centre);
    assert.equal(ea.w * ea.d, 30 * 16, "a ne bouge pas");
    const pieces = planifier(D).tous[1].F.filter((f) => f.v.id === "c").reduce((s, f) => s + f.rooms.reduce((t, r) => t + r.a, 0), 0);
    assert.ok(pieces <= 8 * 16 + 1e-6, "pièces dans c : " + Math.round(pieces) + " m² pour 128 de libre");
  },
  /* ---- la relecture du recouvrement ---- */
  async rec_typo_jumelles(){
    /* les ailes d'un même volume fusionné ne se cèdent rien : le générateur et les
       plans d'aujourd'hui ne bougent pas (sous-sols fusionnés qui se chevauchent de 0,2 m) */
    const { M, G, S, R } = await modules();
    const im = (p) => import(new URL(p, SRC));
    const [{ donneesTypo, ailes }, { volsOf }] = await Promise.all([im("typo/donnees.js"), im("mass/etat.js")]);
    for(const g of [2, 3, 6]){
      charger(null, null);
      R.seed(g); S.repartir({ alea:false, etages:true });
      M.massSet("parti", "compact"); M.massVols(G.genMass(11));
      assert.deepEqual(JSON.parse(JSON.stringify(donneesTypo().partis.courant.vols)),
                       JSON.parse(JSON.stringify(ailes(volsOf(M.MASS.vol)))), "graine " + g);
    }
  },
  async rec_contact_proche(ref){
    const { M } = await modules();
    const e = structuredClone(ref);
    /* hors tout, 0,10 m l'un dans l'autre : c'est un contact (CONTACT = 0,15 m) */
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] },
                  { id:"c", x:90 + 20.8 - 0.10, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20 }] }];
    e.mass.pont = [];
    charger(null, e);
    const r = M.recouvrement(M.MASS.vol, 1, true);
    assert.equal(r.aire, 0); assert.equal(r.enfouie, 0);
  },
  async rec_facade_affleurante(ref){
    const { M } = await modules();
    const e = structuredClone(ref);
    /* 30 × 16 et 16 × 16 à fleur, 8 m en commun : hors tout 30,8 × 16,8 et 16,8 × 16,8,
       union 38,8 × 16,8 — façade enfouie = 162,4 − 111,2 */
    e.mass.vol = [{ id:"a", x:90, y:60, a:0.2, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                  { id:"c", x:90 + 15 * Math.cos(0.2), y:60 + 15 * Math.sin(0.2), a:0.2, bat:"b", lv:[{ i:1, w:16, d:16 }] }];
    e.mass.pont = [];
    charger(null, e);
    const r = M.recouvrement(M.MASS.vol, 1, true);
    assert.ok(Math.abs(r.aire - 8.8 * 16.8) < 1e-6, "aire " + r.aire);
    assert.ok(Math.abs(r.enfouie - 51.2) < 1e-6, "façade enfouie " + r.enfouie);
  },
  async rec_fusionne_murs(ref){
    const { M } = await modules();
    const e = structuredClone(ref);
    /* a fusionné (20 × 20 et une part 10 × 20), hors tout un seul rectangle 30,8 × 20,8 ;
       c, 10 × 10, posé en plein sur la jonction : hors tout 10,8 × 10,8 tout entier dedans */
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:20, d:20, ext:[{ w:10, d:20, dx:15, dy:0 }] }] },
                  { id:"c", x:100, y:60, a:0, bat:"b", lv:[{ i:1, w:10, d:10 }] }];
    e.mass.pont = [];
    charger(null, e);
    const r = M.recouvrement(M.MASS.vol, 1, true);
    assert.ok(Math.abs(r.aire - 10.8 * 10.8) < 1e-6, "aire " + r.aire);
    assert.ok(Math.abs(r.enfouie - 4 * 10.8) < 1e-6, "façade enfouie " + r.enfouie);
  },
  /* ---- le recouvrement, phase 2 : le dessin ---- */
  async rec_moins(){
    const { geom } = await modules();
    const somme = (L) => L.reduce((s, P) => s + geom.airePoly(P), 0);
    const P = geom.coins({ x:0, y:0, w:20, d:20, a:0 });
    for(const Q of [geom.coins({ x:15, y:3, w:20, d:20, a:0 }), geom.coins({ x:4, y:-2, w:12, d:12, a:Math.PI / 4 })]){
      const L = geom.moins(P, [Q]);
      assert.ok(Math.abs(somme(L) - (400 - geom.airePoly(geom.interConvexe(P, Q)))) < 1e-6, "aire " + somme(L));
      L.forEach((A, i) => { assert.equal(geom.interConvexe(A, Q).length, 0, "dans Q");
        L.forEach((B, j) => { if(j > i) assert.equal(geom.interConvexe(A, B).length, 0, "morceaux disjoints"); }); });
    }
    assert.equal(geom.moins(geom.coins({ x:5, y:0, w:4, d:4, a:0 }), [P]).length, 0, "tout dedans : rien");
    assert.equal(geom.moins(P, []).length, 1, "rien à ôter : P");
  },
  async rec_bords(){
    const { geom } = await modules();
    const L = (S) => S.reduce((s, x) => s + Math.hypot(x[1][0] - x[0][0], x[1][1] - x[0][1]), 0);
    /* [-10, 10]² et [5, 25] × [-7, 13] : le contour de leur union fait 2 × (35 + 23) */
    const A = geom.coins({ x:0, y:0, w:20, d:20, a:0 }), B = geom.coins({ x:15, y:3, w:20, d:20, a:0 });
    assert.ok(Math.abs(L(geom.horsDe(A, [B])) - 58) < 1e-6 && Math.abs(L(geom.horsDe(B, [A])) - 58) < 1e-6);
    assert.ok(Math.abs(L(geom.horsDe(A, [])) - 80) < 1e-6);
  },
  async rec_dessin(ref){
    const { M, geom } = await modules();
    const somme = (L) => L.reduce((s, P) => s + geom.airePoly(P), 0);
    const pose = (B) => {
      const e = structuredClone(ref);
      /* c, 16 × 16, posé en biais sur le bout de a, 30 × 16 */
      e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                    Object.assign({ id:"c", x:106, y:63, a:0.4, bat:"b", lv:[{ i:1, w:16, d:16 }] }, B || {})];
      e.mass.pont = [];
      charger(null, e);
      return M.MASS.vol;
    };
    const [a, c] = pose(), ea = a.lv[0], ec = c.lv[0], Da = M.dessinDe(a, ea, M.MASS.vol), Dc = M.dessinDe(c, ec, M.MASS.vol);
    assert.ok(Da && Dc, "les deux se recouvrent");
    assert.deepEqual([Da.garde.length, Dc.garde.length], [0, 1], "le petit cède au grand");
    const Ra = M.volRect(a, ea), Rc = M.volRect(c, ec), co = geom.airePoly(geom.interConvexe(geom.coins(Ra), geom.coins(Rc)));
    const union = Ra.w * Ra.d + Rc.w * Rc.d - co;
    assert.ok(Math.abs(somme(Da.emprise) + somme(Dc.emprise) - union) < 1e-6, "emprise = union");
    /* le cédé pavé hors de l'intérieur du grand ; les murs et les intérieurs couvrent l'union, une fois */
    const ia = geom.coins(M.volInt(a, ea)), ic = geom.coins(M.volInt(c, ec));
    const intC = somme(Dc.cel(ic)), murs = somme(Da.murs) + somme(Dc.murs);
    assert.ok(Math.abs(intC - (16 * 16 - geom.airePoly(geom.interConvexe(ia, ic)))) < 1e-6, "cellules du cédé");
    assert.ok(Math.abs(murs + 30 * 16 + intC - union) < 1e-6, "murs + intérieurs = union : " + (murs + 30 * 16 + intC) + " / " + union);
    const per = (S) => S.reduce((s, x) => s + Math.hypot(x[1][0] - x[0][0], x[1][1] - x[0][1]), 0);
    assert.ok(per(Da.bords) + per(Dc.bords) < 2 * (Ra.w + Ra.d + Rc.w + Rc.d), "le contour d'union est plus court");
    const [, c3] = pose({ bat:"autre" });
    assert.equal(M.dessinDe(c3, c3.lv[0], M.MASS.vol), null, "non liés : comme avant");
    const [, c2] = pose({ x:90 + 15.4 + 8.4, y:60, a:0 });
    assert.equal(M.dessinDe(c2, c2.lv[0], M.MASS.vol), null, "au contact : comme avant");
  },
  async rec_export(ref){
    const { M, geom } = await modules();
    const X = await import(new URL("mass/export.js", SRC));
    const e = structuredClone(ref);
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                  { id:"c", x:106, y:63, a:0.4, bat:"b", lv:[{ i:1, w:16, d:16 }] }];
    e.mass.pont = [];
    charger(null, e);
    const O = X.piecesMassing({ date:new Date(0) }).objets.filter((o) => o.us && o.us["Saxon corps"]);
    const A = O.find((o) => o.us["Saxon corps"] === "a"), C = O.find((o) => o.us["Saxon corps"] === "c");
    assert.ok(A && C, "un objet par corps, nommé par sa chaîne");
    assert.equal(A.us["Saxon bat"], "b"); assert.equal(C.us["Saxon bat"], "b");
    assert.equal(A.us["Saxon boites"], undefined, "le grand reste une boîte");
    assert.equal(JSON.parse(C.us["Saxon boites"]).length, 1, "le petit garde sa boîte d'origine");
    /* fermé : chaque côté orienté a son inverse ; triangles en [a, b, c, c] */
    const T = (o) => [].concat(...o.f.map((f) => f[2] === f[3] ? [[f[0], f[1], f[2]]] : [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]));
    const cotes = new Set(); T(C).forEach((t) => t.forEach((p, i) => cotes.add(p + ">" + t[(i + 1) % 3])));
    cotes.forEach((k) => { const [p, q] = k.split(">"); assert.ok(cotes.has(q + ">" + p), "côté sans inverse " + k); });
    /* son volume : (emprise − commune) × h, dans le rapport de la boîte entière ; normales dehors */
    const vol = (o) => T(o).reduce((s, t) => { const [p, q, r] = t.map((k) => o.v[k]);
      return s + (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6; }, 0);
    const [a, c] = M.MASS.vol, Ra = M.volRect(a, a.lv[0]), Rc = M.volRect(c, c.lv[0]);
    const co = geom.airePoly(geom.interConvexe(geom.coins(Ra), geom.coins(Rc)));
    assert.ok(vol(A) > 0 && vol(C) > 0, "normales dehors");
    assert.ok(Math.abs(vol(C) / vol(A) - (Rc.w * Rc.d - co) / (Ra.w * Ra.d)) < 1e-3, "volume " + vol(C) / vol(A));
    /* il ne recoupe pas le grand : aucun dessus du petit dans l'emprise du grand */
    const haut = Math.max(...A.v.map((p) => p[2])), pa = A.v.filter((p) => p[2] === haut);
    assert.ok(T(C).some((t) => t.every((i) => C.v[i][2] === haut)), "le petit a un dessus");
    T(C).filter((t) => t.every((i) => C.v[i][2] === haut)).forEach((t) => { const g = [0, 1].map((k) => t.reduce((s, i) => s + C.v[i][k] / 3, 0));
      assert.equal(geom.interConvexe([[g[0] - .1, g[1] - .1], [g[0] + .1, g[1] - .1], [g[0] + .1, g[1] + .1], [g[0] - .1, g[1] + .1]], geom.enveloppe(pa)).length, 0, "dans le grand"); });
  },
  /* la relecture de la phase 2 : ce qui retombe sur l'ancien chemin */
  async rec_export_replis(ref){
    const { M } = await modules();
    const X = await import(new URL("mass/export.js", SRC));
    const objets = (vol) => {
      const e = structuredClone(ref);
      if(vol){ e.mass.vol = vol; e.mass.pont = []; }
      charger(null, e);
      return X.piecesMassing({ date:new Date(0) }).objets;
    };
    /* sans recouvrement : aucune chaîne d'objet, l'aller-retour reste celui d'avant */
    assert.ok(objets(null).every((o) => !o.us), "une composition sans recouvrement ne porte aucune chaîne");
    /* tout entier dans l'autre : sa boîte, pas un maillage vide */
    const O = objets([{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                      { id:"c", x:90, y:60, a:0.3, bat:"b", lv:[{ i:1, w:8, d:8 }] }]);
    const C = O.find((o) => o.us && o.us["Saxon corps"] === "c");
    assert.ok(C && C.v.length === 8 && !C.us["Saxon boites"], "le corps englouti garde sa boîte");
    /* fusionné : son prisme, comme avant */
    const F = objets([{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                      { id:"c", x:111, y:62, a:0.3, bat:"b", lv:[{ i:1, w:10, d:10, ext:[{ w:10, d:10, dx:10, dy:0 }] }] }]);
    assert.ok(!F.find((o) => o.us && o.us["Saxon corps"] === "c").us["Saxon boites"], "un volume fusionné ne se découpe pas");
    /* deux étages liés à deux altitudes : chacun se dessine comme avant */
    objets([{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16, h:9 }] },
            { id:"c", x:106, y:63, a:0.4, bat:"b", lv:[{ i:1, w:16, d:16 }] }]);
    const [a, c] = M.MASS.vol;
    assert.equal(M.dessinDe(c, c.lv[0], M.MASS.vol), null, "hauteurs différentes : pas de découpe");
    assert.equal(M.dessinDe(a, a.lv[0], M.MASS.vol), null);
  },
  async rec_rhino_lien(ref){
    let rh;
    try{ rh = await rhino3dm(); }catch(_){ return; }
    const { M } = await modules();
    const X = await import(new URL("mass/export.js", SRC)), I = await import(new URL("mass/import.js", SRC));
    const e = structuredClone(ref);
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                  { id:"c", x:106, y:63, a:0.4, bat:"b", lv:[{ i:1, w:16, d:16 }, { i:2, w:16, d:16 }] }];
    e.mass.pont = [];
    charger(null, e);
    const r0 = M.recouvrement(M.MASS.vol, 1, true).aire;
    const r = I.volsDe3dm(I.solides3dm(rh, X.dm3Massing(rh, {})));
    assert.equal(r.mode, "boites");
    assert.equal(r.vols.length, 2, r.vols.map((v) => v.id).join(" "));
    assert.ok(M.lies(r.vols[0], r.vols[1]), "le lien revient");
    assert.ok(Math.abs(M.recouvrement(r.vols, 1, true).aire - r0) < 1, "même recouvrement " + r0);
    assert.deepEqual(r.vols.map((v) => v.lv.length).sort(), [1, 2], "chaque corps garde ses étages");
  },
  async rec_sol(ref){
    const { M, E, geom } = await modules();
    /* c commence au R+1 (niveau 2), posé en biais au-dessus du bout de a, qui ne porte que le rez */
    const lire = (bat) => {
      const e = structuredClone(ref);
      e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                    { id:"c", x:106, y:63, a:0.4, bat, lv:[{ i:2, w:16, d:16 }] }];
      e.mass.pont = [];
      charger(null, e);
      return E.terrainLibre(M.MASS.vol).libre;
    };
    const brut = lire("autre"), lie = lire("b"), [a, c] = M.MASS.vol;
    const co = geom.airePoly(geom.interConvexe(geom.coins(M.volRect(a, a.lv[0])), geom.coins(M.volRect(c, c.lv[0]))));
    assert.ok(co > 50, "le cas recouvre vu du ciel : " + co);
    assert.ok(Math.abs(lie - brut - co) < 1e-6, "terrain libre " + brut + " → " + lie);
  },
  async rec_typo_entier(ref){
    const im = (p) => import(new URL(p, SRC));
    const { donneesTypo } = await im("typo/donnees.js");
    const e = structuredClone(ref);
    /* c, 10 × 16, posé sur a à 9,5 m sur 10 : raccourci, il ne lui resterait que 0,5 m */
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                  { id:"c", x:100.5, y:60, a:0, bat:"b", lv:[{ i:1, w:10, d:16 }, { i:2, w:10, d:16 }] }];
    e.mass.pont = [];
    charger(null, e);
    const C = donneesTypo().partis.courant.vols.find((v) => v.id === "c");
    assert.ok(C, "c garde son étage du dessus");
    assert.deepEqual(C.lv.map((x) => x.i), [2], "son rez, tout entier sur a, sort des plans");
    e.mass.vol[1].lv = [{ i:1, w:10, d:16 }];
    charger(null, e);
    assert.equal(donneesTypo().partis.courant.vols.some((v) => v.id === "c"), false, "un corps sans étage aussi");
  },
  async rec_recoller(ref){
    const { M, G } = await modules();
    const e = structuredClone(ref), t = 0.3, u = [Math.cos(t), Math.sin(t)], P0 = [106, 62], L = 16.8 + 0.5;
    /* p posé sur a, z posé sur w ; p et z, dans le même axe, à 0,50 m l'un de l'autre */
    e.mass.vol = [{ id:"a", x:90, y:60, a:0, bat:"b", lv:[{ i:1, w:30, d:16 }] },
                  { id:"p", x:P0[0], y:P0[1], a:t, bat:"b", lv:[{ i:1, w:16, d:16 }] },
                  { id:"z", x:P0[0] + u[0] * L, y:P0[1] + u[1] * L, a:t, bat:"z", lv:[{ i:1, w:16, d:16 }] },
                  { id:"w", x:P0[0] + u[0] * (L + 12), y:P0[1] + u[1] * (L + 12) - 2, a:t + 0.5, bat:"z", lv:[{ i:1, w:12, d:12 }] }];
    e.mass.pont = [];
    charger(null, e);
    const [, p, z, w] = M.MASS.vol;
    assert.ok(M.recouvrement(M.MASS.vol, 1, true).aire > 40 && G.dansPerimetre(z) && G.dansPerimetre(w), "le cas tient");
    G.fusionner(M.MASS.vol, M.MASS.pont);
    const V = M.MASS.vol, reste = V.includes(p) && V.includes(z);
    assert.ok(!reste || Math.abs(G.ecartVols(p, z)) <= M.CONTACT, "recollés : " + (reste ? G.ecartVols(p, z) : "soudés"));
    assert.ok(V.every((v) => !G.chevaucheMain(v, V)), "rien ne se superpose sans lien");
  },
  async etat_absent(){
    assert.throws(() => lireJSON("nexiste/pas.json", true),
      (e) => e instanceof Erreur && e.message.includes("nexiste/pas.json"));
  }
};

async function test(){
  FG = ".atelier/test/groupe-absent.json"; FE = ".atelier/test/etat-absent.json";
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
  remede: verbeRemede, variante: verbeVariante, js: verbeJs, site: verbeSite, plan: verbePlan,
  rhino: verbeRhino, importer: verbeImporter, test };

/* Les drapeaux sans valeur : sans cette liste, `js --ecrire "code"` prenait le
   code pour la valeur de --ecrire, et `variante --json "nom"` perdait son nom. */
const DRAPEAUX = new Set(["json", "muet", "complet", "ecrire", "ordonne", "mixer", "massing", "typo",
                          "toutes", "avec-erreurs"]);
export function analyser(argv){
  const pos = [], opt = {};
  for(let i = 0; i < argv.length; i++){
    const a = argv[i];
    if(a.startsWith("--")){
      const k = a.slice(2), suiv = argv[i + 1];
      if(!DRAPEAUX.has(k) && suiv !== undefined && !suiv.startsWith("--")){ opt[k] = suiv; i++; }
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
