/* ============================================================================
   LES DONNÉES DES TYPOLOGIES — ce que le générateur de plans (`plans.html`)
   lit, tiré à l'instant de l'état du projet : la pile et les pièces du mixer,
   les volumes du massing, les liens actifs, le relevé. Rien n'est copié : la
   page les redemande à chaque ouverture de l'onglet.

   Et ce qu'elle ÉCRIT, par deux portes seulement : les cotes des corps qu'elle
   a mesurées (`typoEcrire`), les largeurs de pièces réglées à la main
   (`typoRegle`). Les deux vont dans le Massing et s'enregistrent avec lui.
   ========================================================================= */
import { COULOIR } from "../core/model.js";
import { RULES } from "../data/rules.js";
import { SITE } from "../data/site.js";
import { V } from "../data/cadre.js";
import { BLOCKS, FLOORS, flCircDe, flHeight, flName, flNet, flShort, lvlOf, place } from "../mix/floors.js";
import { lvRange } from "../mix/niv.js";
import { PMAP, PROX, uOf } from "../mix/prog.js";
import { adjActive } from "../mix/opts.js";
import { saveSoon } from "../mix/store.js";
import { MASS, partiOf } from "../mass/model.js";
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
    liens:PROX.filter(function(l){ return adjActive(l.id); }).map(function(l){ return { a:l.a, b:l.b, q:l.q }; }),
    /* les règles que le dessin tient : la largeur du couloir réglée au cahier
       des charges, le noyau, le feu, les murs, le module, la distance d'un lien */
    regles:{ couloir:COULOIR, cage:RULES.circ.cage, noyau:RULES.circ.noyau, feu:RULES.feu,
             mur:RULES.haut.mur, cloison:RULES.haut.cloison, module:V.module, lien:RULES.circ.proche } };
}

function etage(id, i){
  var v = MASS.vol.filter(function(x){ return x.id === id; })[0];
  return v ? { v:v, e:v.lv.filter(function(e){ return e.i === i; })[0] } : {};
}
/* Les corps aux cotes que leurs pièces demandent. `w0` garde la cote que le
   Massing avait donnée : c'est elle qui répartit le programme entre les corps,
   pour que mesurer deux fois donne deux fois la même chose. */
export function typoEcrire(maj){
  maj.forEach(function(m){
    var x = etage(m.id, m.i);
    if(!x.e) return;
    if(x.e.w0 == null) x.e.w0 = x.e.w;
    x.e.w = m.w; x.e.dx = m.dx;
    if(m.d) x.e.d = m.d;
    if(m.dy != null) x.e.dy = m.dy;
  });
  if(maj.length) saveSoon();
}
/* La largeur d'une pièce, au module ; null la rend au calcul. */
export function typoRegle(id, i, lab, w){
  var v = MASS.vol.filter(function(x){ return x.id === id; })[0];
  if(!v) return;
  v.typo = v.typo || {};
  if(w == null) delete v.typo[i + "|" + lab]; else v.typo[i + "|" + lab] = w;
  saveSoon();
}

/* LES LIENS AU MÊME NIVEAU. Un plan ne rapproche pas deux pièces que le
   mixer a posées à deux niveaux : avant de dessiner, chaque lien actif du
   schéma (a → b, « b auprès de chaque a ») est rendu possible. Le poste b se
   répartit sur les niveaux où se trouve a, au prorata, un au moins par niveau,
   dans la plage de niveaux que le cadre lui permet ; s'il n'en a pas assez,
   c'est a qui rejoint b. Les moves passent par `place()` du mixer, et ce que
   le mixer en pense se lit dans son contrôle. Rend la liste de ce qui a bougé. */
export function typoAccorder(){
  var faits = [];
  function niv(key){
    var o = {};
    BLOCKS.forEach(function(b){ if(b.key === key && b.fl >= 0 && b.fl < FLOORS.length) o[b.fl] = (o[b.fl] || 0) + b.q; });
    return o;
  }
  function permis(key, fl){ var r = lvRange(PMAP[key]), l = lvlOf(fl); return l >= r.min && l <= r.max; }
  function tot(o){ var t = 0; for(var k in o) t += o[k]; return t; }
  for(var passe = 0; passe < 2; passe++){
    PROX.forEach(function(l){
      if(!adjActive(l.id) || !PMAP[l.a] || !PMAP[l.b]) return;
      var A = niv(l.a), B = niv(l.b), la = Object.keys(A);
      if(!la.length || !tot(B)) return;
      /* une petite pièce « auprès de chaque » (WC, vestiaires de classe) suit
         sa mère au prorata, niveau par niveau ; une autre, seulement là où elle
         manque */
      var qb = tot(B), ok = la.every(function(f){ return permis(l.b, +f); });
      var petite = uOf(l.b) < 30 && uOf(l.b) < uOf(l.a);
      if(la.every(function(f){ return B[f]; })){
        if(!petite || !ok) return;
        var qa0 = tot(A);
        if(la.every(function(f){ return Math.abs(B[f] - qb * A[f] / qa0) < 1; }) &&
           Object.keys(B).every(function(f){ return A[f]; })) return;
      }
      if(!PMAP[l.b].solid && ok && qb >= la.length){
        /* b au prorata de a, un au moins par niveau de a */
        var qa = tot(A), want = {}, reste = qb - la.length;
        la.forEach(function(f){ want[f] = 1; });
        la.slice().sort(function(p, q){ return A[q] - A[p]; }).forEach(function(f){
          var add = Math.min(reste, Math.round((qb - la.length) * A[f] / qa));
          want[f] += add; reste -= add;
        });
        want[la[0]] += reste;
        place(l.b, want);
        faits.push(PMAP[l.b].n + " suit " + PMAP[l.a].n.toLowerCase());
        return;
      }
      /* sinon a rejoint b, s'il le peut */
      var lb = Object.keys(B).sort(function(p, q){ return B[q] - B[p]; })[0];
      if(!PMAP[l.a].solid && permis(l.a, +lb)){
        var w = {}; w[lb] = tot(A);
        place(l.a, w);
        faits.push(PMAP[l.a].n + " rejoint " + PMAP[l.b].n.toLowerCase());
      }
    });
  }
  if(faits.length) saveSoon();
  return faits;
}
