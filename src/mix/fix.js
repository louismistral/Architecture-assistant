/* ============================================================================
   LES REMÈDES

   Un écart qui se contente de dire ce qui ne va pas laisse tout le travail à
   faire. Chaque contrôle de `checks.js` nomme ici le geste qui le résoudrait —
   déplacer un poste, agrandir un plateau, vider un niveau — et la vue n'a plus
   qu'à le proposer.

   Aucun remède n'est appliqué tout seul : ils sont offerts, à côté de
   « Laisser comme ça ». Le mixer ne refuse rien, et il ne décide rien non plus.

   La mécanique vit ici, la RÈGLE reste dans `checks.js` : c'est là qu'on lit,
   au même endroit, ce qui est reproché et ce qui le réparerait.
   ========================================================================= */
import { fmt } from "../core/format.js";
import {
  BLOCKS, FLOORS, PLATE_MAX, TRAY, flName, flNet, lvlOf, move, nSub, nUp,
  onFloor, place, setPlate, setStack, split, trayBlocks, usable
} from "./floors.js";
import { WCRE, lvRange } from "./niv.js";
import { PMAP, aOf, qOf } from "./prog.js";

/* Un remède : ce qu'on propose, ce que ça coûte, et ce que ça fait. */
export function acte(label, hint, run){ return { label:label, hint:hint, run:run }; }

/* ---------- repères ------------------------------------------------------- */
/* Le niveau admissible le plus proche d'un indice donné, dans la pile telle
   qu'elle est. -1 si la pile n'en offre aucun : le remède n'existe pas, et le
   dire vaut mieux que proposer un déplacement impossible. */
export function nivCible(p, depuis){
  var r = lvRange(p), best = -1, d = Infinity, i;
  for(i = 0; i < FLOORS.length; i++){
    var l = lvlOf(i);
    if(l < r.min || l > r.max) continue;
    var q = Math.abs(i - depuis);
    if(q < d){ d = q; best = i; }
  }
  return best;
}
/* Le niveau qui a le plus de marge parmi ceux qu'un poste peut occuper. */
export function nivLarge(p){
  var r = lvRange(p), best = -1, marge = -Infinity, i;
  for(i = 0; i < FLOORS.length; i++){
    var l = lvlOf(i);
    if(l < r.min || l > r.max) continue;
    var m = usable(i) - flNet(i);
    if(m > marge){ marge = m; best = i; }
  }
  return best;
}
function margeDe(i, a){
  var m = usable(i) - flNet(i);
  if(!isFinite(m)) return "";
  return m >= a ? "il y reste " + fmt(Math.round(m)) + " m² de marge"
                : "il y manquera " + fmt(Math.round(a - m)) + " m² de plateau";
}

/* ---------- déplacer ------------------------------------------------------ */
/* Tout un poste vers un niveau. `place` refait les parts : un poste scindé en
   trois redevient un seul bloc, ce qui est bien ce qu'on demande ici.

   Un remède ne doit jamais en créer un autre : un déplacement vers une cote que
   le règlement refuse à ce poste n'est pas proposé. Sans ce garde-fou, réparer
   une adjacence proposait d'envoyer la salle de sport au 2ᵉ étage. */
export function fixDeplacer(key, fl, quoi){
  if(fl < 0 || fl >= FLOORS.length) return null;
  var p = PMAP[key];
  if(!p) return null;
  var r = lvRange(p), l = lvlOf(fl);
  if(l < r.min || l > r.max) return null;
  /* La surface se lit par `aOf` : le poste ne porte PAS sa surface unitaire —
     elle se règle dans l'onglet Programme et se relit à chaque appel. */
  var a = aOf(key, qOf(key));
  return acte("Déplacer " + (quoi || p.n) + " au " + flName(fl).toLowerCase(),
    margeDe(fl, a),
    function(){ place(key, mkWant(fl, qOf(key))); return true; });
}
function mkWant(fl, q){ var o = {}; o[fl] = q; return o; }

/* ---------- vider, remplir ------------------------------------------------ */
export function fixVider(k){
  var n = 0;
  onFloor(k).forEach(function(b){ n += b.q; });
  if(!n) return null;
  return acte("Vider le " + flName(k).toLowerCase(),
    "ses " + n + " pièce" + (n > 1 ? "s repartent" : " repart") + " au bac, à reposer ailleurs",
    function(){
      onFloor(k).slice().forEach(function(b){ move(b.u, TRAY); });
      return true;
    });
}
/* Ce qui dort au bac va au niveau admissible qui a le plus de marge. C'est la
   même règle que le tirage, appliquée au seul reste. */
export function fixReste(){
  var tb = trayBlocks();
  if(!tb.length) return null;
  var n = 0;
  tb.forEach(function(b){ n += b.q; });
  return acte("Poser le reste", n + " pièce" + (n > 1 ? "s" : "")
    + " au niveau admis qui a le plus de marge",
    function(){
      var reste = 0;
      trayBlocks().slice().forEach(function(b){
        var c = nivLarge(PMAP[b.key]);
        if(c >= 0) move(b.u, c); else reste++;
      });
      return true;
    });
}

/* ---------- plateau et pile ------------------------------------------------ */
export function fixPlateau(k, m2){
  var v = Math.min(PLATE_MAX, Math.ceil(m2 / 10) * 10);
  if(!(v > FLOORS[k].plate)) return null;
  return acte("Porter le plateau à " + fmt(v) + " m²",
    "au " + flName(k).toLowerCase() + ", contre " + fmt(FLOORS[k].plate) + " m² aujourd’hui",
    function(){ return setPlate(k, v); });
}
export function fixEtage(){
  return acte("Ajouter un étage",
    "la pile passe à " + (nUp() + 1) + " étage" + (nUp() + 1 > 1 ? "s" : "")
    + " au-dessus du rez ; rien n’y descend tout seul",
    function(){ setStack(nSub(), nUp() + 1); return true; });
}
export function fixCombler(){
  if(nSub() < 1) return null;
  return acte("Combler le sous-sol",
    "ce qu’il portait repart au bac",
    function(){ setStack(nSub() - 1, nUp()); return true; });
}

/* ---------- sanitaires ----------------------------------------------------- */
/* Un WC au niveau `k` : on en détache une unité là où il y en a plusieurs, ou
   on en prend une au bac. Les WC sont comptés en cabines, ils se scindent. */
export function fixWC(k){
  var src = null, bac = null;
  BLOCKS.forEach(function(b){
    if(!WCRE.test(PMAP[b.key].n)) return;
    if(b.fl === TRAY){ if(!bac || b.q > bac.q) bac = b; return; }
    if(b.fl === k) return;
    if(b.q > 1 && (!src || b.q > src.q)) src = b;
  });
  var from = bac || src;
  if(!from) return null;
  return acte("Poser un WC au " + flName(k).toLowerCase(),
    "une cabine détachée " + (bac ? "du bac" : "du " + flName(from.fl).toLowerCase())
      + " — « " + PMAP[from.key].n + " »",
    function(){
      var b = from;
      if(b.q > 1){
        var nb = split(b.u, 1);
        if(!nb) return false;
        move(nb.u, k);
      } else {
        move(b.u, k);
      }
      return true;
    });
}
