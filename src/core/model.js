import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";

export var FMAP = {}; FAM.forEach(function(f){ FMAP[f.id] = f; f.total = 0; f.items = []; });
CHAP.forEach(function(ch, ci){
  ch.ci = ci;
  ch.items.forEach(function(it){
    /* L'indice du chapitre voyage avec le poste : c'est lui qui dit si le poste
       est du bâti scolaire — les quatre premiers chapitres — donc s'il porte
       une part de circulation. */
    it.ci = ci;
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

export var PROG = 6489, ESTT = 0, GRAND = 6489, BUILT = 5089;
export var ITEMS = [], VARITEMS = [];
CHAP.forEach(function(ch){ ch.items.forEach(function(it){ ITEMS.push(it); if(it.est) VARITEMS.push(it); }); });
export var ITEMBYKEY = {}; ITEMS.forEach(function(it){ ITEMBYKEY[it.key] = it; });

/* ---------- circulation ----------------------------------------------------
   La part de circulation était réglée dans DEUX outils — l'onglet Plan
   (`CIRC = 0.18`, part de la surface bâtie) et l'onglet Site (`MASS.circ =
   0.15`, supplément ajouté à la surface utile) — sous le même mot et avec deux
   arithmétiques opposées. Elle appartient au programme : c'est une surface, et
   les surfaces se décident une fois, dans l'onglet qui les tient.

   Elle ne dépend plus des seuls mètres carrés mais des PIÈCES : un couloir
   dessert des portes. Chaque pièce ouvre sur lui le côté d'un carré de sa
   surface, son front ; le couloir vaut ce front, fois sa largeur, divisé par
   les rangs qu'il dessert ; chaque niveau ajoute ses cages d'escalier. Les
   petites pièces d'un poste se groupent en un bloc à une porte, un grand local
   plafonne son front. Tous les chiffres sont dans `RULES.circ`.

   La largeur du couloir est la seule saisie ; la PART de la surface bâtie
   devient un résultat — `CIRC`, qu'on lit partout où on lisait la part.
   Elle ne porte QUE sur le bâti scolaire — les quatre premiers chapitres. La
   piscine, le chauffage à distance, la cour et son préau n'ont pas de couloirs
   à nous : ils sont hors enveloppe. */
export var COULOIR = RULES.circ.couloir.def;   /* largeur du couloir, m */
export var CIRCSET = false;           /* l'utilisateur a-t-il tranché ? */
export var CIRC = 0;                  /* part de la surface bâtie — un résultat */
export var CIRCA = 0;                 /* m² de circulation du bâti scolaire */
export var CIRCH = 0;                 /* dont couloirs */
export var CIRCV = 0;                 /* dont cages d'escalier */
export var FRONT = 0;                 /* mètres de front ouverts sur les couloirs */
export var BUILTG = 0;                /* bâti scolaire, circulation comprise */
export var GRANDG = 0;                /* total du programme, circulation comprise */

/* Le front que `q` pièces d'un poste ouvrent sur le couloir. Les locaux engins
   de la salle de gym n'en ont pas : ils sont DANS l'abri PC, que le règlement
   convertit, et ils n'ont pas de porte à eux. */
export function frontDe(it, q){
  var R = RULES.circ;
  if(!it || !(q > 0) || it.planSkip || it.ci >= 4) return 0;
  if(it.u < R.bloc) return Math.min(Math.sqrt(q * it.u), R.frontMax);
  return q * Math.min(Math.sqrt(it.u), R.frontMax);
}
/* Les m² de couloir qu'un front demande. */
export function couloirDe(front){ return front * COULOIR / RULES.circ.rangs; }
/* Les m² de cages d'un niveau qui porte `aire` m² bâtis : une cage, deux
   au-delà du seuil de la protection incendie. */
export function cagesDe(aire){
  var n = aire > RULES.feu.cageSeuil ? 2 : RULES.feu.cageMin;
  return n * RULES.circ.cage;
}

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

  /* Les couloirs, poste par poste : chacun porte ceux que ses pièces demandent. */
  FRONT = 0; CIRCH = 0;
  ITEMS.forEach(function(it){
    it.front = frontDe(it, it.nb);
    it.couloir = couloirDe(it.front);
    FRONT += it.front; CIRCH += it.couloir;
  });
  /* Les cages, sur la pile que le cahier des charges suppose : il vient AVANT
     le mixer, et ne sait pas encore combien de niveaux le projet aura. */
  var N = RULES.circ.niveaux;
  CIRCV = N * cagesDe((BUILT + CIRCH) / N);
  CIRCA = CIRCH + CIRCV;
  BUILTG = BUILT + CIRCA;
  CIRC = BUILTG > 0 ? CIRCA / BUILTG : 0;
  GRANDG = GRAND + CIRCA;
  /* La circulation se répartit sur les chapitres et les familles : chacun porte
     les couloirs de SES pièces, et les cages — qui servent tout le monde — au
     prorata de ce qu'il pèse dans le bâti scolaire. Les parts se resomment
     exactement à CIRCA. Les deux derniers chapitres — infrastructures du second
     temps et extérieurs — sont hors enveloppe et n'en portent aucune. */
  function partDe(items){
    var scol = 0, h = 0, n = 0;
    items.forEach(function(i){
      if(i.ci >= 4) return;
      scol += i.tot; h += i.couloir; n += i.nb;
    });
    return { scol: scol, circ: h + (BUILT > 0 ? CIRCV * scol / BUILT : 0), pieces: n };
  }
  CHAP.forEach(function(ch){
    var p = partDe(ch.items);
    ch.scol = p.scol; ch.circ = p.circ;
    ch.gross = ch.total + ch.circ;
  });
  FAM.forEach(function(f){
    var p = partDe(f.items);
    f.scol = p.scol; f.circ = p.circ;
    f.gross = f.total + f.circ;
  });
}
recompute();

/* Surface d'un poste « à préciser ». Elle se saisit dans le cahier des charges et
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

/* La largeur du couloir, en mètres — la seule chose qui se saisit de la
   circulation. Tout le reste en découle. */
export function setCirc(w){
  var R = RULES.circ.couloir;
  if(!isFinite(w) || w < R.min || w > R.max) return false;
  w = Math.round(w * 100) / 100;
  /* Fixer la valeur qu'on avait déjà est un geste : le poste passe de « à
     préciser » à « fixée », et cela se voit. */
  var change = (w !== COULOIR) || !CIRCSET;
  CIRCSET = true;
  if(w !== COULOIR){ COULOIR = w; recompute(); }
  return change;
}
/* Restauration depuis le stockage : la valeur revient telle qu'elle a été
   saisie, avec son statut « fixée ». Un état enregistré avant le calcul par
   les pièces portait une PART (0,18) : elle est hors des bornes d'une largeur
   et se refuse d'elle-même — on repart du couloir par défaut. */
export function loadCirc(w){
  var R = RULES.circ.couloir;
  if(!isFinite(w) || w < R.min || w > R.max) return false;
  COULOIR = w; CIRCSET = true; recompute();
  return true;
}

export var ALL_OFF = [];
CHAP.forEach(function(ch){ ch.off.forEach(function(o){ ALL_OFF.push(ch.short + " — " + o); }); });
