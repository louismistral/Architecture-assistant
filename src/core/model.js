import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";

export var FMAP = {}; FAM.forEach(function(f){ FMAP[f.id] = f; f.total = 0; f.items = []; });
CHAP.forEach(function(ch){
  ch.items.forEach(function(it){
    it.key = ch.id + "|" + it.n;
    it.u0 = it.u;
    it.tot = it.nb * it.u;
    it.chap = ch.short;
    var f = FMAP[it.f];
    f.total += it.tot;
    f.items.push(it);
  });
  ch.total = ch.items.reduce(function(s,i){ return s + i.tot; }, 0);
  ch.items.sort(function(a,b){ return b.tot - a.tot; });
  ch.mix = FAM.filter(function(f){
    return ch.items.some(function(i){ return i.f === f.id; });
  }).map(function(f){
    return { f:f, v: ch.items.reduce(function(s,i){ return s + (i.f === f.id ? i.tot : 0); }, 0) };
  }).sort(function(a,b){ return b.v - a.v; });
});

FAM.forEach(function(f){ f.items.sort(function(a,b){ return b.tot - a.tot; }); });

export var PROG = 6489, ESTT = 0, GRAND = 6489, BUILT = 5089, GAP = 1.2;
export var ITEMS = [], VARITEMS = [];
CHAP.forEach(function(ch){ ch.items.forEach(function(it){ ITEMS.push(it); if(it.est) VARITEMS.push(it); }); });
export var ITEMBYKEY = {}; ITEMS.forEach(function(it){ ITEMBYKEY[it.key] = it; });

/* ---------- circulation ----------------------------------------------------
   La part de circulation était réglée dans DEUX outils — l'onglet Plan
   (`CIRC = 0.18`, part de la surface bâtie) et l'onglet Site (`MASS.circ =
   0.15`, supplément ajouté à la surface utile) — sous le même mot et avec deux
   arithmétiques opposées. Elle appartient au programme : c'est une surface, et
   les surfaces se décident une fois, dans l'onglet qui les tient.

   Convention unique : part de la surface BÂTIE.
     bâti = utile / (1 − part)   ·   circulation = bâti − utile
   Elle ne porte QUE sur le bâti scolaire — les quatre premiers chapitres. La
   piscine, le chauffage à distance, la cour et son préau n'ont pas de couloirs
   à nous : ils sont hors enveloppe. */
export var CIRC = RULES.circ.def;     /* part de la surface bâtie */
export var CIRCSET = false;           /* l'utilisateur a-t-il tranché ? */
export var CIRCA = 0;                 /* m² de circulation du bâti scolaire */
export var BUILTG = 0;                /* bâti scolaire, circulation comprise */

export function recompute(){
  ESTT = 0;
  ITEMS.forEach(function(it){ it.tot = it.nb * it.u; if(it.est) ESTT += it.tot; });
  CHAP.forEach(function(ch){
    ch.total = ch.items.reduce(function(t,i){ return t + i.tot; }, 0);
    ch.mix = FAM.filter(function(f){ return ch.items.some(function(i){ return i.f === f.id; }); })
      .map(function(f){ return { f:f, v: ch.items.reduce(function(t,i){ return t + (i.f === f.id ? i.tot : 0); }, 0) }; })
      .sort(function(a,b){ return b.v - a.v; });
    ch.items.sort(function(a,b){ return b.tot - a.tot; });
  });
  FAM.forEach(function(f){
    f.total = f.items.reduce(function(t,i){ return t + i.tot; }, 0);
    f.items.sort(function(a,b){ return b.tot - a.tot; });
  });
  GRAND = PROG + ESTT;
  BUILT = CHAP.slice(0,4).reduce(function(t,c){ return t + c.total; }, 0);
  BUILTG = BUILT / (1 - CIRC);
  CIRCA = BUILTG - BUILT;
}
recompute();

/* Surface d'un poste « à préciser ». Elle se saisit dans l'onglet Programme et
   ne se recalcule nulle part ailleurs : tout le reste en découle. */
export function setItemArea(key, v){
  var it = ITEMBYKEY[key];
  if(!it || !it.est || !(v > 0)) return false;
  if(it.u === v && it.set) return false;
  it.u = v; it.set = 1;
  userAreas[key] = v;
  recompute();
  return true;
}
export var userAreas = {};

export function setCirc(p){
  var lo = RULES.circ.min, hi = RULES.circ.max;
  if(!isFinite(p) || p < lo || p > hi) return false;
  /* Fixer la valeur qu'on avait déjà est un geste : le poste passe de « à
     préciser » à « fixée », et cela se voit. */
  var change = (p !== CIRC) || !CIRCSET;
  CIRCSET = true;
  if(p !== CIRC){ CIRC = p; recompute(); }
  return change;
}
/* Restauration depuis le stockage : la valeur revient telle qu'elle a été
   saisie, avec son statut « fixée ». */
export function loadCirc(p){
  if(!isFinite(p) || p < RULES.circ.min || p > RULES.circ.max) return false;
  CIRC = p; CIRCSET = true; recompute();
  return true;
}

export var ALL_OFF = [];
CHAP.forEach(function(ch){ ch.off.forEach(function(o){ ALL_OFF.push(ch.short + " — " + o); }); });
