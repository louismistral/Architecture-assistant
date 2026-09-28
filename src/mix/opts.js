/* ============================================================================
   LES RÉGLAGES DU MIXER, ET LEUR DÉ

   Chaque réglage a une VALEUR, et par-dessus un DÉ. Dé allumé, le Shuffle
   décide ; dé éteint, la valeur est figée — c'est nous qui l'avons choisie, et
   le tirage la respecte. Quatre familles de réglages, et chacune se règle là où
   elle se voit :

     la pile        le nombre de niveaux            → sur la pile
     les plateaux   l'emprise de CHAQUE niveau       → sur le niveau
     les postes     lié ou délié, poste par poste    → sur le bloc
     les adjacences active ou non, lien par lien     → au flanc du mixer

   Un dé MAÎTRE par famille bascule toute la famille d'un coup ; il se lit
   « mixte » quand ses éléments ne s'accordent pas.

   Ils vivent ici, et non dans la vue, pour que `store.js` les lise sans avoir
   à remonter dans `views/` — une couche ne dépend pas de celle qui la montre.
   Ils remplacent les trois interrupteurs d'avant : « Shuffle niveaux » est
   devenu le dé de la pile, « Grouper les liés » les adjacences actives, « Voir
   les pièces » le lien de chaque poste.
   ========================================================================= */
import { SLINK } from "../data/schema.js";

/* ---------- la pile ----------------------------------------------------------
   Dé allumé par défaut, comme l'était « Shuffle niveaux » : l'éteindre revient
   à proposer une école de plain-pied de trois mille quatre cents mètres carrés
   d'emprise tant qu'on n'a pas composé la pile soi-même. */
export var dePile = true;
export function setDePile(on){ dePile = !!on; }

/* ---------- les plateaux, par COTE -------------------------------------------
   Une cote et non un indice : ajouter un sous-sol renumérote les indices, et le
   plateau figé du rez serait passé au premier étage. Absent : dé allumé. */
var dePlat = {};
export function dePlateau(lvl){ return dePlat[lvl] !== false; }
export function setDePlateau(lvl, on){ if(on) delete dePlat[lvl]; else dePlat[lvl] = false; }

/* ---------- les postes : lié ou délié ----------------------------------------
   LIÉ, les pièces d'un poste vont ensemble, en un bloc, à un seul niveau.
   DÉLIÉ, elles sont indépendantes : dessinées séparées, déplacées une à une,
   et le tirage peut les répartir sur plusieurs niveaux. Délié par défaut —
   c'est ce que faisait le tirage jusqu'ici. Un poste d'une seule pièce, ou dont
   le règlement impose les cotes, n'a pas le choix : `lienLibre()` le dit. */
var lies = {}, deL = {};
export function estLie(key){ return !!lies[key]; }
export function setLie(key, on){ if(on) lies[key] = true; else delete lies[key]; }
export function deLien(key){ return !!deL[key]; }
export function setDeLien(key, on){ if(on) deL[key] = true; else delete deL[key]; }

/* ---------- les adjacences ------------------------------------------------------
   Un lien du schéma fonctionnel (`data/schema.js`), désigné par ses deux nœuds.
   ACTIF, ses deux postes vont au même niveau et se déplacent ensemble ; ÉTEINT,
   ils sont indépendants. Par défaut, les adjacences exigées sont actives et les
   mutualisations — offertes, pas dues — éteintes. */
export function lienId(lk){ return lk.a + "|" + lk.b; }
var LK = {};
SLINK.forEach(function(lk){ LK[lienId(lk)] = lk; });
var adjOn = {}, deA = {};
var version = 0;              /* change à chaque bascule : les grappes se recalculent */
export function adjVersion(){ return version; }
export function adjDefaut(id){ return LK[id] ? !LK[id].opt : false; }
export function adjActive(id){ return id in adjOn ? adjOn[id] : adjDefaut(id); }
export function setAdj(id, on){
  if(!LK[id]) return;
  if(!!on === adjDefaut(id)) delete adjOn[id]; else adjOn[id] = !!on;
  version++;
}
export function deAdj(id){ return !!deA[id]; }
export function setDeAdj(id, on){ if(!LK[id]) return; if(on) deA[id] = true; else delete deA[id]; }
export function liens(){ return SLINK; }

/* ---------- les dés maîtres ---------------------------------------------------
   `true`, `false`, ou "mixed" quand la famille est partagée. `ids` est la liste
   des éléments qu'elle compte à cet instant — les cotes de la pile, les postes
   qui ont le choix : elle dépend de ce qui est posé, et la vue la connaît. */
export function etatDes(cat, ids){
  var on = 0, n = 0;
  (ids || []).forEach(function(id){
    n++;
    if(cat === "plateau" ? dePlateau(id) : cat === "lien" ? deLien(id) : deAdj(id)) on++;
  });
  if(cat === "pile") return dePile;
  if(!n) return false;
  return on === n ? true : (on === 0 ? false : "mixed");
}
export function setDes(cat, ids, on){
  if(cat === "pile"){ setDePile(on); return; }
  (ids || []).forEach(function(id){
    if(cat === "plateau") setDePlateau(id, on);
    else if(cat === "lien") setDeLien(id, on);
    else setDeAdj(id, on);
  });
}

/* ---------- persistance -------------------------------------------------------
   Retrouver ses réglages éteints à chaque ouverture reviendrait à ne jamais
   pouvoir s'en servir. On n'enregistre que ce qui s'écarte du défaut. L'ancien
   format — `{ niv, grp, pcs }`, les trois interrupteurs — se relit encore : `niv`
   était le dé de la pile ; grouper et voir les pièces n'ont plus d'équivalent
   exact et reviennent à leur défaut. */
export function optsOf(){
  return { v:2, pile: dePile ? 1 : 0, plat: dePlat, lie: lies, dl: deL, adj: adjOn, da: deA };
}
function copie(o, garde){
  var r = {};
  if(o && typeof o === "object") for(var k in o) if(garde(k, o[k])) r[k] = o[k];
  return r;
}
export function setOpts(o){
  if(!o) return;
  if(o.v !== 2){ if(o.niv !== undefined) dePile = !!o.niv; return; }
  dePile = !!o.pile;
  dePlat = copie(o.plat, function(k, v){ return v === false; });
  lies = copie(o.lie, function(k, v){ return v === true; });
  deL = copie(o.dl, function(k, v){ return v === true; });
  adjOn = copie(o.adj, function(k, v){ return !!LK[k] && typeof v === "boolean"; });
  deA = copie(o.da, function(k, v){ return !!LK[k] && v === true; });
  version++;
}
/* Un projet vide : tout au défaut. */
export function resetOpts(){
  dePile = true; dePlat = {}; lies = {}; deL = {}; adjOn = {}; deA = {};
  version++;
}
