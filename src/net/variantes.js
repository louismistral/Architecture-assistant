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
import { BUILTG, VARITEMS, recompute, userAreas } from "../core/model.js";
import { curSeed as seedActuelle, seed } from "../core/rand.js";
import { DOC } from "../data/doctrine.js";
import { empreinte } from "../core/empreinte.js";
import { curSeed } from "../core/rand.js";
import { FLOORS } from "../mix/floors.js";
import { mixCheck, mixVerdict } from "../mix/checks.js";
import { restore, saveSoon, snapshot } from "../mix/store.js";
import { MASS, bilanTotal, massVols, partiOf, volCoins } from "../mass/model.js";
import { massCheck, massVerdict } from "../mass/checks.js";
import { jugementCourant } from "../mass/juge.js";
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
/* Elle porte aussi le parti RÉEL : en « Auto », `MASS.parti` vaut `auto` et ne
   dit pas quelle figure a été tirée — c'est la composition qui le sait. Le
   filtre par type de massing le lit ici. */
export function vignetteCourante(){
  return { parti: (MASS.vol && MASS.vol.parti) || null, vol: (MASS.vol || []).map(function(v){
    var c = volCoins(v) || [];
    return { p: c.map(function(p){ return [ +p[0].toFixed(1), +p[1].toFixed(1) ]; }),
             s: v.fix ? 1 : 0 };
  }).filter(function(o){ return o.p.length === 4; }) };
}

/* Tout ce qui se déduit de l'état à l'écran, et qu'on enregistre à côté de lui
   pour ne pas avoir à le recalculer à chaque affichage de la liste. */
export function resumeCourant(){
  var b = bilanTotal(), note = null, crit = null;
  /* La NOTE de la composition et son détail, critère par critère
     (`mass/juge.js — noter()`) : une lecture, que le générateur ne suit pas. */
  try{
    var d = jugementCourant();
    if(d){
      note = d.total;
      crit = d.crit.map(function(c){ return { id:c.id, n:c.n, pts:c.pts, niv:c.niv, rang:c.rang, txt:c.txt, actif:c.actif }; });
    }
  }catch(_){}
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
             "verdict,criteria,thumbnail,tags";

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

/* Les trouvailles d'une recherche (`net/recherche.js`), en un seul envoi :
   chacune porte l'état et le résumé du moment où elle a été tirée — pas celui
   de l'écran, que la recherche a remis en place. */
export async function poserTrouvees(trouves, tag){
  if(!CPT.equipe || !CPT.profil) throw new Error("aucune équipe");
  if(!trouves.length) return [];
  var rows = trouves.map(function(t, k){
    var row = Object.assign({}, t.row);
    row.team_id = CPT.equipe.id;
    row.author_id = CPT.profil.id;
    /* L'étiquette dit d'où elle vient ; le nom n'a pas à le redire. */
    row.name = partiOf(t.pid || row.parti).n + " · " +
               (row.score > 0 ? "+" : "") + row.score + " · n° " + (k + 1);
    row.tags = [tag];
    row.state = t.state;
    return row;
  });
  var r = await insertApi("variant", rows);
  await chargerVariantes();
  return r || [];
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

/* ---------- rejouer ----------
   « Reload » : chaque variante est rechargée, son résumé recalculé par le code
   D'AUJOURD'HUI — note, critères, verdict, surfaces, miniature — et réécrit en
   base s'il a changé. Une note d'un ancien juge (vingt-trois critères, ou 670
   sur 100) n'a plus de sens : elle est refaite, pas cachée.

   L'EMPREINTE, elle, ne bouge pas : elle dit sur quelle version du programme
   et du règlement la variante a été COMPOSÉE, et rejouer ne recompose rien.
   Une variante périmée le reste — sa note est simplement relue par le juge
   actuel.

   Comme la recherche, on travaille sur l'état vivant et on le remet tel quel.
   `restore()` ne défait pas une surface « à préciser » qu'une variante aurait
   posée, ni une valeur de doctrine : on les sauve et on les rend à l'identique. */
function pause(){ return new Promise(function(ok){ setTimeout(ok, 0); }); }
function sauverCadre(){
  return {
    doc: Object.assign({}, DOC),
    areas: Object.assign({}, userAreas),
    items: VARITEMS.map(function(it){ return [it, it.u, it.set]; })
  };
}
function rendreCadre(c){
  var k;
  for(k in DOC) if(k in c.doc) DOC[k] = c.doc[k];
  for(k in userAreas) delete userAreas[k];
  Object.assign(userAreas, c.areas);
  c.items.forEach(function(x){ x[0].u = x[1]; x[0].set = x[2]; });
  recompute();
}
var CHAMPS_RESUME = ["score", "criteria", "verdict", "floors", "bodies",
                     "area_required", "area_placed", "area_gross", "thumbnail"];

export async function rejouerTout(progres, arret){
  var liste = VARIANTES.slice(), etat = snapshot(), cadre = sauverCadre(),
      g0 = seedActuelle, faits = 0, changes = 0, rates = 0;
  try{
    for(var i = 0; i < liste.length; i++){
      if(arret && arret()) break;
      var v = liste[i], st = null;
      try{ st = await etatDe(v.id); }catch(_){ st = null; }
      if(!st){ rates++; continue; }
      restore(st);
      var r = resumeCourant(), patch = {}, diff = false;
      CHAMPS_RESUME.forEach(function(k){
        patch[k] = r[k];
        if(JSON.stringify(r[k]) !== JSON.stringify(v[k])) diff = true;
      });
      if(diff){
        try{ await patchApi("variant", "id=eq." + v.id, patch); Object.assign(v, patch); changes++; }
        catch(_){ rates++; }
      }
      faits++;
      if(progres) progres(faits, liste.length);
      await pause();
    }
  } finally {
    if(!(etat.mass && etat.mass.vol && etat.mass.vol.length)) massVols([]);
    restore(etat);
    rendreCadre(cadre);
    seed(g0);
  }
  await chargerVariantes();
  return { faits: faits, changes: changes, rates: rates };
}
