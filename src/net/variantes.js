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
   — CE QUI SE TRIE : niveaux, corps, surfaces, en colonnes. La NOTE, elle, se
     refait ici, à chaque affichage : la variante garde ses MESURES BRUTES
     (`criteria.mes`), et le jugement d'aujourd'hui les note avec les poids
     d'aujourd'hui. Changer un poids reclasse toutes les variantes sans en
     regénérer une ; la colonne `score` ne garde que la note du jour de
     l'enregistrement, pour le premier tri de la base.
   — CE QUI SE MONTRE : le verdict, les écarts au cadre, les notes posées À LA
     MAIN (`criteria.main`), et les polygones de la miniature — pour dessiner
     le panneau sans rejouer un générateur par carte.

   `criteria` était une liste de critères notés par l'ancien juge ; c'est
   maintenant `{ v:4, mes, cadre, main }`. Une variante d'avant n'a pas de
   mesures : « Reload » les lui calcule, et la renote. Une v3 a les siennes,
   mais pas celles du plan des Typologies : notée sur ce qu'elle a, en
   italique, jusqu'au Reload.

   Plus l'EMPREINTE des fichiers du dépôt : voir `core/empreinte.js`.

   Et sa MÈRE (`parent_id`) : la variante dont l'état à l'écran est parti —
   chargée, enregistrée, ou rapportée de Rhino dans un .3dm qui la nomme. Les
   variantes se lisent alors à la suite, comme un historique : qui est partie
   de quoi, et ce que chaque passage a fait à la note. L'acteur (humain,
   claude, algo) reste dans le nom et les étiquettes.
   ========================================================================= */
import { BUILTG, VARITEMS, recompute, userAreas } from "../core/model.js";
import { curSeed as seedActuelle, seed } from "../core/rand.js";
import { V } from "../data/lignes.js";
import { moyennes, noter } from "../data/jugement.js";
import { empreinte } from "../core/empreinte.js";
import { curSeed } from "../core/rand.js";
import { FLOORS } from "../mix/floors.js";
import { mixCheck, mixVerdict } from "../mix/checks.js";
import { restore, saveSoon, snapshot } from "../mix/store.js";
import { MASS, bilanTotal, massVols, partiOf, volCoins } from "../mass/model.js";
import { massCheck, massVerdict } from "../mass/checks.js";
import { evaluationCourante } from "../mass/mesures.js";
import { TYPO } from "../typo/etat.js";
import { typoVerdict } from "../typo/mesures.js";
import { CPT } from "./compte.js";
import { deleteApi, insertApi, patchApi, selectApi } from "./supa.js";

export var VARIANTES = [];

/* ---------- la source ----------
   La variante d'où vient l'état à l'écran. Sur l'appareil, pour survivre à un
   rechargement ; hors de l'instantané, qui dit l'état du projet et pas son
   histoire. */
var SKEY = "saxon.source";
var SOURCE = null;
try{ SOURCE = localStorage.getItem(SKEY) || null; }catch(_){}
export function source(){ return SOURCE; }
export function setSource(id){
  SOURCE = id || null;
  try{ if(SOURCE) localStorage.setItem(SKEY, SOURCE); else localStorage.removeItem(SKEY); }catch(_){}
}
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
   filtre par type de massing le lit ici. Et la seed des TYPOLOGIES : l'état
   complet n'est tiré qu'au chargement, le modal la lit donc ici. */
export function vignetteCourante(){
  return { parti: (MASS.vol && MASS.vol.parti) || null, typo: TYPO.graine, vol: (MASS.vol || []).map(function(v){
    var c = volCoins(v) || [];
    return { p: c.map(function(p){ return [ +p[0].toFixed(1), +p[1].toFixed(1) ]; }),
             s: v.fix ? 1 : 0 };
  }).filter(function(o){ return o.p.length >= 3; }) };
}

/* Tout ce qui se déduit de l'état à l'écran, et qu'on enregistre à côté de lui
   pour ne pas avoir à le recalculer à chaque affichage de la liste. */
export function resumeCourant(){
  var b = bilanTotal(), note = null, crit = null;
  /* Les MESURES BRUTES du bâtiment, et ses écarts au cadre : de quoi le
     renoter demain avec d'autres poids, sans le regénérer. La note du jour,
     à côté, pour le premier tri de la base. */
  var ev = null;
  try{
    ev = evaluationCourante();
    if(ev){
      note = noter(ev.mes, null, moyennesMain()).total;
      crit = { v:4, mes:ev.mes,
               /* les ambres des plans ne sont pas un écart à NOTRE cadre : ils
                  se comptent à part (`verdict.typo`) — sans quoi toute variante
                  se dirait « hors cadre » */
               cadre:{ ko: idsDe(ev.ecarts, "e"),
                       notif: idsDe(ev.ecarts.filter(function(x){ return x.c !== "typo"; }), "w") } };
    }
  }catch(_){}
  var vm = {}, vx = {}, vt = ev ? typoVerdict(ev.ecarts) : {};
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
    verdict: { mass:vm, mix:vx, typo:vt },
    criteria: crit,
    thumbnail: vignetteCourante(),
    fingerprint: empreinte()
  };
}

function idsDe(E, sev){
  var o = [];
  E.forEach(function(x){ if(x.sev === sev && !x.pile && o.indexOf(x.k) < 0) o.push(x.k); });
  return o;
}

/* ---------- la note d'une variante, refaite ici ----------
   Les mesures qu'elle a gardées, ses notes manuelles, et — pour les critères
   qu'on ne lui a pas notés — la moyenne de celles des autres. */
function mesDe(v){ var c = v && v.criteria; return c && c.v >= 3 ? c : null; }
export function moyennesMain(){
  return moyennes(VARIANTES.map(function(v){ var c = mesDe(v); return c && c.main; }));
}
export function jugementDe(v, moy){
  var c = mesDe(v);
  if(!c) return null;
  return noter(c.mes, c.main, moy || moyennesMain());
}
/* La note à afficher et à trier : le jugement d'aujourd'hui quand la variante
   a ses mesures, la note enregistrée sinon — marquée comme telle. */
export function noteDe(v, moy){
  var j = jugementDe(v, moy);
  return j ? j.total : v.score;
}
/* À jour : mesurée par le code d'aujourd'hui, plans des Typologies compris. */
export function aJour(v){ var c = mesDe(v); return !!(c && c.v >= 4); }
/* Invalide : un écart au cadre OPPOSABLE. Elle reste chargeable et notée. */
export function invalide(v){ var c = mesDe(v); return !!(c && c.cadre && c.cadre.ko && c.cadre.ko.length); }
export function notifiee(v){ var c = mesDe(v); return c && c.cadre ? (c.cadre.notif || []) : []; }

/* Une note posée à la main, sur un critère sans mesure : `s` de 0 à 1, ou
   null pour l'effacer. Écrite dans la base, sur la variante même. */
export async function noterMain(id, crit, s){
  var v = VARIANTES.filter(function(x){ return x.id === id; })[0];
  var c = mesDe(v);
  if(!c) throw new Error("variante sans mesures — Reload d'abord");
  var main = Object.assign({}, c.main || {});
  if(s == null) delete main[crit]; else main[crit] = Math.max(0, Math.min(1, s));
  var nc = Object.assign({}, c, { main: main });
  var r = await patchApi("variant", "id=eq." + id, { criteria: nc });
  if(r && r[0]) v.criteria = r[0].criteria; else v.criteria = nc;
  signale();
  return v;
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
/* `parent_id` vient d'une migration (20261006120000). Tant qu'elle n'est pas
   passée sur la base, la colonne manque : on la retire de ce qu'on demande, au
   lieu de perdre toute la liste. */
var PARENT = true;
function sansParent(e){ return /parent_id/.test(String(e && e.message)); }
async function essai(f){
  try{ return await f(); }
  catch(e){ if(!PARENT || !sansParent(e)) throw e; PARENT = false; return f(); }
}
function avecParent(row){ if(PARENT && SOURCE) row.parent_id = SOURCE; else delete row.parent_id; return row; }

export async function chargerVariantes(){
  if(!CPT.equipe){ VARIANTES = []; signale(); return VARIANTES; }
  /* `state` est le gros morceau — on ne le tire qu'au chargement d'UNE
     variante. Cinquante états dans une liste, c'est plusieurs mégaoctets pour
     dessiner des miniatures. */
  VARIANTES = await essai(function(){
    return selectApi("variant", "team_id=eq." + CPT.equipe.id + "&select=" + CHAMPS + (PARENT ? ",parent_id" : "")
      + "&order=score.desc.nullslast");
  }) || [];
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
  var r = await essai(function(){ return insertApi("variant", avecParent(row)); });
  /* on continue de travailler à partir d'elle */
  if(r && r[0]) setSource(r[0].id);
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
    row.name = partiOf(t.pid || row.parti).n + " · " + row.score + "/100 · n° " + (k + 1);
    row.tags = [tag];
    row.state = t.state;
    return row;
  });
  var r = await essai(function(){ return insertApi("variant", rows.map(avecParent)); });
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
  if(SOURCE === id) setSource(null);
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
  setSource(id);
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
   posée, ni une ligne qu'elle aurait réglée : on les sauve et on les rend à
   l'identique. Les notes posées À LA MAIN survivent : elles ne se recalculent
   pas, elles se sont données. */
function pause(){ return new Promise(function(ok){ setTimeout(ok, 0); }); }
function sauverCadre(){
  return {
    doc: Object.assign({}, V),
    areas: Object.assign({}, userAreas),
    items: VARITEMS.map(function(it){ return [it, it.u, it.set]; })
  };
}
function rendreCadre(c){
  var k;
  for(k in V) if(k in c.doc) V[k] = c.doc[k];
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
      var r = resumeCourant(), patch = {}, diff = false, av = mesDe(v);
      if(r.criteria && av && av.main) r.criteria.main = av.main;
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
