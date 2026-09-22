/* ============================================================================
   LES VARIANTES

   Une variante est un PRESET : l'état complet du projet, enregistré sous un
   nom, rechargeable à l'identique. C'est la seule raison de venir ici, et
   « Charger » est donc le geste principal de tout ce qui suit.

   Elle porte trois familles de choses :

   — CE QUI REJOUE : les deux graines, le parti, et l'instantané de `store.js`.
     Les graines suffiraient à reconstruire une composition tirée ; l'état
     complet est là pour celle qu'on a retouchée à la main, et qu'aucune graine
     ne retrouve.
   — CE QUI SE TRIE : note, niveaux, corps, surfaces. Des colonnes, pas du
     JSON : trier cinquante variantes par note ne doit pas demander d'ouvrir
     cinquante états.
   — CE QUI SE MONTRE : le verdict, le détail de la note, et les polygones de
     la miniature — pour dessiner le panneau sans rejouer un générateur par
     carte.

   Plus l'EMPREINTE des fichiers du dépôt : voir `core/empreinte.js`.
   ========================================================================= */
import { BUILTG } from "../core/model.js";
import { empreinte } from "../core/empreinte.js";
import { curSeed } from "../core/rand.js";
import { FLOORS } from "../mix/floors.js";
import { mixCheck, mixVerdict } from "../mix/checks.js";
import { restore, saveSoon, snapshot } from "../mix/store.js";
import { MASS, bilanTotal, volCoins } from "../mass/model.js";
import { massCheck, massVerdict } from "../mass/checks.js";
import { noteCourante } from "../mass/gen.js";
import { CPT } from "./compte.js";
import { deleteApi, insertApi, patchApi, selectApi } from "./supa.js";

export var VARIANTES = [];
var abonnes = [];
export function onVariantes(fn){
  abonnes.push(fn);
  return function(){ abonnes = abonnes.filter(function(f){ return f !== fn; }); };
}
function signale(){ abonnes.forEach(function(f){ try{ f(VARIANTES); }catch(_){} }); }

/* ---------- la miniature ----------
   Les quatre coins de l'emprise au sol de chaque corps, en mètres du relevé.
   Le périmètre n'est pas enregistré : il est dans `data/site.js`, donc dans le
   dépôt — s'il change, la variante est périmée, et la vue le dessinera avec
   le relevé du jour. */
export function vignetteCourante(){
  return { vol: (MASS.vol || []).map(function(v){
    var c = volCoins(v) || [];
    return { p: c.map(function(p){ return [ +p[0].toFixed(1), +p[1].toFixed(1) ]; }),
             s: v.fix ? 1 : 0 };
  }).filter(function(o){ return o.p.length === 4; }) };
}

/* Tout ce qui se déduit de l'état à l'écran, et qu'on enregistre à côté de lui
   pour ne pas avoir à le recalculer à chaque affichage de la liste. */
export function resumeCourant(){
  var b = bilanTotal(), note = null, crit = null;
  try{ var d = noteCourante(); if(d){ note = Math.round(d.total); crit = d.crit; } }catch(_){}
  var vm = {}, vx = {};
  try{ vm = massVerdict(massCheck()) || {}; }catch(_){}
  try{ vx = mixVerdict(mixCheck()) || {}; }catch(_){}
  return {
    seed_program: curSeed >>> 0,
    seed_massing: (MASS.graine || 0) >>> 0,
    parti: MASS.parti,
    score: note,
    floors: FLOORS.length,
    bodies: (MASS.vol || []).length,
    area_required: Math.round(b.demande || 0),
    area_placed: Math.round(b.pose || 0),
    area_gross: Math.round(BUILTG || 0),
    verdict: { mass:vm, mix:vx },
    criteria: crit,
    thumbnail: vignetteCourante(),
    fingerprint: empreinte()
  };
}

export function nomPropose(){
  var d = new Date();
  var mois = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  return (MASS.parti || "variante") + " · " + d.getDate() + " " + mois[d.getMonth()];
}

/* ---------- la base ---------- */
var CHAMPS = "id,name,created_at,updated_at,author_id,seed_program,seed_massing,parti," +
             "fingerprint,score,floors,bodies,area_required,area_placed,area_gross," +
             "verdict,criteria,thumbnail";

export async function chargerVariantes(){
  if(!CPT.equipe){ VARIANTES = []; signale(); return VARIANTES; }
  /* `state` est le gros morceau — on ne le tire qu'au chargement d'UNE
     variante. Cinquante états dans une liste, c'est plusieurs mégaoctets pour
     dessiner des miniatures. */
  VARIANTES = await selectApi("variant",
    "team_id=eq." + CPT.equipe.id + "&select=" + CHAMPS + "&order=score.desc.nullslast") || [];
  signale();
  return VARIANTES;
}

export async function enregistrer(nom){
  if(!CPT.equipe || !CPT.profil) throw new Error("aucune équipe");
  var row = resumeCourant();
  row.team_id = CPT.equipe.id;
  row.author_id = CPT.profil.id;
  row.name = (nom && nom.trim()) || nomPropose();
  row.state = snapshot();
  var r = await insertApi("variant", row);
  await chargerVariantes();
  return r && r[0];
}

export async function renommer(id, nom){
  var r = await patchApi("variant", "id=eq." + id, { name: nom });
  VARIANTES.forEach(function(v){ if(v.id === id && r && r[0]) v.name = r[0].name; });
  signale();
  return r && r[0];
}

export async function supprimer(id){
  await deleteApi("variant", "id=eq." + id);
  VARIANTES = VARIANTES.filter(function(v){ return v.id !== id; });
  signale();
}

/* ---------- charger ----------
   L'état n'est tiré qu'ici. On le remet en place section par section, puis on
   l'enregistre sur l'appareil : charger une variante, c'est reprendre le
   travail à cet endroit, pas le consulter. */
export async function etatDe(id){
  var l = await selectApi("variant", "id=eq." + id + "&select=state");
  return (l && l[0] && l[0].state) || null;
}
export async function charger(id){
  var st = await etatDe(id);
  if(!st) throw new Error("état introuvable");
  var perdu = restore(st);
  saveSoon();
  return perdu;
}
