/* ============================================================================
   LES DONNÉES DES TYPOLOGIES — ce que le générateur de plans (`plans.html`)
   lit, tiré à l'instant de l'état du projet : la pile et les pièces du mixer,
   les volumes du massing, le relevé. Rien n'est copié : la page les redemande
   à chaque ouverture de l'onglet.
   ========================================================================= */
import { RULES } from "../data/rules.js";
import { SITE } from "../data/site.js";
import { BLOCKS, FLOORS, flCircDe, flHeight, flName, flNet, flShort, lvlOf } from "../mix/floors.js";
import { PMAP, uOf } from "../mix/prog.js";
import { MASS, partiOf } from "../mass/model.js";
import { COULOIR } from "../core/model.js";
import { massOf } from "../mass/etat.js";

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
        return { key:k, n:p.n, f:p.f, q:q[k], u:uOf(k), hors:p.hors, solid:p.solid };
      }) };
  });
  var pid = MASS.vol.parti || MASS.parti;
  return { floors:floors,
    partis:{ courant:{ n:"Massing à l'écran · " + partiOf(pid).n, real:pid,
                       vols:massOf().vol, ponts:MASS.pont || [] } },
    site:{ per:SITE.per, bat:SITE.bat, mur:RULES.haut.mur },
    /* les règles que le dessin tient : la largeur du couloir réglée au cahier
       des charges, le noyau, l'évacuation, les murs */
    regles:{ couloir:COULOIR, cage:RULES.circ.cage, noyau:RULES.circ.noyau, feu:RULES.feu,
             mur:RULES.haut.mur, cloison:RULES.haut.cloison } };
}
