/* ============================================================================
   LES DONNÉES DES TYPOLOGIES — ce que le générateur de plans (`plans.html`)
   lit, tiré à l'instant de l'état du projet : la pile et les pièces du mixer,
   les volumes du massing, les liens actifs, le relevé. Rien n'est copié : la
   page les redemande à chaque ouverture de l'onglet.

   Elle n'écrit RIEN en amont : ni la pile du mixer, ni les volumes du
   Massing. Chaque onglet a son Shuffle ; celui des Typologies ne fait que
   réordonner les pièces dans les volumes donnés. Ce qu'elle garde — sa seed,
   les largeurs de pièces réglées ici — est à elle (`typo/etat.js`).
   ========================================================================= */
import { COULOIR } from "../core/model.js";
import { RULES } from "../data/rules.js";
import { SITE } from "../data/site.js";
import { V } from "../data/cadre.js";
import { BLOCKS, FLOORS, flCircDe, flHeight, flName, flNet, flShort, lvlOf } from "../mix/floors.js";
import { PMAP, PROX, uOf } from "../mix/prog.js";
import { adjActive, coteDe } from "../mix/opts.js";
import { nearestDims } from "../core/geometry.js";
import { saveSoon } from "../mix/store.js";
import { MASS, partiOf } from "../mass/model.js";
import { massOf } from "../mass/etat.js";
import { TYPO } from "./etat.js";

export function donneesTypo(){
  var floors = FLOORS.map(function(F, i){
    var q = {}, ordre = [];
    BLOCKS.forEach(function(b){
      if(b.fl !== i) return;
      if(!q[b.key]){ q[b.key] = 0; ordre.push(b.key); }
      q[b.key] += b.q;
    });
    return { i:i, name:flName(i), short:flShort(i), lvl:lvlOf(i), h:flHeight(i),
      circ:flCircDe(i), net:Math.round(flNet(i)),
      rooms:ordre.map(function(k){
        var p = PMAP[k];
        return { key:k, n:p.n, f:p.f, q:q[k], u:uOf(k), hors:p.hors, solid:p.solid,
                 w:TYPO.cotes[k] != null ? TYPO.cotes[k] : coteDe(k) };
      }) };
  });
  var pid = MASS.vol.parti || MASS.parti;
  return { floors:floors, graine:TYPO.graine,
    partis:{ courant:{ n:"Massing à l'écran · " + partiOf(pid).n, real:pid,
                       vols:massOf().vol, ponts:MASS.pont || [] } },
    site:{ per:SITE.per, bat:SITE.bat, mur:RULES.haut.mur },
    liens:PROX.filter(function(l){ return adjActive(l.id); }).map(function(l){ return { a:l.a, b:l.b, q:l.q }; }),
    /* les règles que le dessin tient : la largeur du couloir réglée au cahier
       des charges, le noyau, le feu, les murs, le module, la distance d'un lien */
    regles:{ couloir:COULOIR, cage:RULES.circ.cage, noyau:RULES.circ.noyau, feu:RULES.feu,
             mur:RULES.haut.mur, cloison:RULES.haut.cloison, module:V.module, lien:RULES.circ.proche } };
}

/* LA SEED des Typologies : celle que rejoue « Shuffle typologie ». Elle ne
   change que l'ordonnance des pièces DANS les volumes du Massing. */
export function typoGraine(g){
  if(g){ TYPO.graine = g >>> 0 || 1; saveSoon(); }
  return TYPO.graine;
}
/* La largeur d'une pièce d'un poste, au module, ramenée à une proportion qui
   garde la surface exacte ; null rend la cote du mixer (ou le calcul). Elle
   reste aux Typologies : la régler ici ne recompose pas le Massing. */
export function typoRegle(key, w){
  if(w == null) delete TYPO.cotes[key];
  else TYPO.cotes[key] = nearestDims(uOf(key), w).w;
  saveSoon();
}
