/* ============================================================================
   CE QU'ON LIT SUR UNE RÉPARTITION

   Les mesures du programme réparti, pour le JUGEMENT : des nombres, sans
   seuil ni tag. Elles regardent le bâtiment — ce qui est posé à quel niveau —
   et jamais la recherche : les proximités se comptent sur le schéma
   fonctionnel du règlement, pas sur les adjacences qu'on a allumées au mixer.
   ========================================================================= */
import { BLOCKS, FLOORS, TRAY, flBuilt, flCirc, lvlOf } from "./floors.js";
import { BRUYANT, CLSRE, UNITE } from "./niv.js";
import { PMAP, PROX } from "./prog.js";

function r2(x){ return Math.round(x * 1000) / 1000; }

export function mesuresMix(){
  var ou = {};
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY) return;
    (ou[b.key] = ou[b.key] || {})[b.fl] = 1;
  });
  /* les proximités EXIGÉES par le schéma, tenues quand les deux postes
     partagent au moins un niveau */
  var n = 0, ok = 0;
  PROX.forEach(function(l){
    if(l.opt) return;
    var A = ou[l.a], B = ou[l.b];
    if(!A || !B) return;
    n++;
    if(Object.keys(A).some(function(f){ return B[f]; })) ok++;
  });
  var mixtes = 0, cls = 0, haut = 0, cmax = 0, circ = 0, bati = 0;
  FLOORS.forEach(function(F, i){
    var br = 0, cl = 0, un = 0;
    BLOCKS.forEach(function(b){
      if(b.fl !== i) return;
      var p = PMAP[b.key];
      if(BRUYANT.test(p.n)) br += b.q;
      if(CLSRE.test(p.n)) cl += b.q;
      if(UNITE.test(p.n)) un += b.q;
    });
    if(br && cl) mixtes++;
    cls += cl;
    if(lvlOf(i) > 0) haut += cl;
    cmax = Math.max(cmax, un);
    circ += flCirc(i); bati += flBuilt(i);
  });
  return {
    adjTenues: n ? r2(ok / n) : null,
    bruitMixte: mixtes,
    classesEtage: cls ? r2(haut / cls) : null,
    classesNiveauMax: cmax,
    circPart: bati ? r2(circ / bati) : null
  };
}
