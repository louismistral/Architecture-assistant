/* ============================================================================
   LES RÉGLAGES DU MIXER, ET LEUR DÉ

   Chaque réglage a une VALEUR, et par-dessus un DÉ. Dé allumé, le Shuffle
   décide ; dé éteint, la valeur est figée — c'est nous qui l'avons choisie, et
   le tirage la respecte. Seule la PILE a encore un dé : le plateau de chaque
   niveau se déduit de la pile, le lien d'un poste se règle à la main, et les
   adjacences exigées sont du CADRE (`data/cadre.js — adj`) — toujours actives.

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

/* Le plateau d'un niveau se déduit toujours de la pile : plus de levier. */
export function dePlateau(){ return true; }

/* ---------- les postes : lié ou délié ----------------------------------------
   LIÉ, les pièces d'un poste vont ensemble, en un bloc, à un seul niveau.
   DÉLIÉ, elles sont indépendantes : dessinées séparées, déplacées une à une,
   et le tirage peut les répartir sur plusieurs niveaux. Délié par défaut —
   c'est ce que faisait le tirage jusqu'ici. Un poste d'une seule pièce, ou dont
   le règlement impose les cotes, n'a pas le choix : `lienLibre()` le dit. */
var lies = {};
export function estLie(key){ return !!lies[key]; }
export function setLie(key, on){ if(on) lies[key] = true; else delete lies[key]; }

/* ---------- les adjacences ------------------------------------------------------
   Un lien du schéma fonctionnel (`data/schema.js`), désigné par ses deux nœuds.
   Les adjacences exigées sont TOUJOURS actives — c'est le cadre : leurs deux
   postes vont au même niveau. Les mutualisations — offertes, pas dues — ne
   lient rien. */
export function lienId(lk){ return lk.a + "|" + lk.b; }
var LK = {};
SLINK.forEach(function(lk){ LK[lienId(lk)] = lk; });
var version = 0;              /* change à chaque rechargement : les grappes se recalculent */
export function adjVersion(){ return version; }
export function adjActive(id){ return LK[id] ? !LK[id].opt : false; }
export function liens(){ return SLINK; }

/* ---------- les cotes des pièces ---------------------------------------------
   La LARGEUR d'une pièce d'un poste — le côté sur le couloir —, au module ; la
   profondeur s'en déduit et la surface ne change jamais (`validDims`). Absente,
   la pièce prend la profondeur que le massing donne à ses bandes. Une source
   pour trois onglets : le mixer la montre et la règle, les Typologies la
   lisent et la règlent, le massing en tire la profondeur de ses corps. */
var cotes = {};
export function coteDe(key){ return cotes[key]; }
export function setCote(key, w){ if(w == null || !(w > 0)) delete cotes[key]; else cotes[key] = w; }
export function toutesCotes(){ return cotes; }

/* ---------- persistance -------------------------------------------------------
   Retrouver ses réglages éteints à chaque ouverture reviendrait à ne jamais
   pouvoir s'en servir. On n'enregistre que ce qui s'écarte du défaut. L'ancien
   format — `{ niv, grp, pcs }`, les trois interrupteurs — se relit encore : `niv`
   était le dé de la pile ; grouper et voir les pièces n'ont plus d'équivalent
   exact et reviennent à leur défaut. */
export function optsOf(){
  return { v:2, pile: dePile ? 1 : 0, lie: lies, cotes: cotes };
}
function copie(o, garde){
  var r = {};
  if(o && typeof o === "object") for(var k in o) if(garde(k, o[k])) r[k] = o[k];
  return r;
}
export function setOpts(o){
  if(!o) return;
  /* Un état d'avant ne connaît ni liens ni adjacences : ils reviennent au
     défaut, et non à ceux de la session en cours — sinon une variante
     ancienne se rechargeait avec les réglages de la dernière qu'on a vue. */
  if(o.v !== 2){ resetOpts(); if(o.niv !== undefined) dePile = !!o.niv; return; }
  dePile = !!o.pile;
  lies = copie(o.lie, function(k, v){ return v === true; });
  cotes = copie(o.cotes, function(k, v){ return typeof v === "number" && v > 0; });
  version++;
}
/* Un projet vide : tout au défaut. */
export function resetOpts(){
  dePile = true; lies = {}; cotes = {};
  version++;
}
