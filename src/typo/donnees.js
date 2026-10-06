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
import { V, enVigueur } from "../data/cadre.js";
import { BLOCKS, FLOORS, flCircDe, flHeight, flName, flNet, flShort, lvlOf } from "../mix/floors.js";
import { PMAP, PROX, uOf } from "../mix/prog.js";
import { adjActive, coteDe } from "../mix/opts.js";
import { nearestDims } from "../core/geometry.js";
import { saveSoon } from "../mix/store.js";
import { MASS, datumEcole, etagesDe, niveaux, partiOf } from "../mass/model.js";
import { ETAGES, TRAITS } from "../data/planches.js";
import { massOf } from "../mass/etat.js";
import { TYPO } from "./etat.js";
import { fige } from "../core/verrou.js";

export function donneesTypo(){
  var NV = niveaux();
  var floors = FLOORS.map(function(F, i){
    var q = {}, ordre = [];
    BLOCKS.forEach(function(b){
      if(b.fl !== i) return;
      if(!q[b.key]){ q[b.key] = 0; ordre.push(b.key); }
      q[b.key] += b.q;
    });
    /* `h` la hauteur d'un corps d'école à ce niveau, `hs` celle de sa plus
       haute pièce (la salle de sport) : chaque volume a la sienne */
    return { i:i, name:flName(i), short:flShort(i), lvl:lvlOf(i), h:NV[i].hc, hs:flHeight(i),
      circ:flCircDe(i), net:Math.round(flNet(i)),
      rooms:ordre.map(function(k){
        var p = PMAP[k];
        return { key:k, n:p.n, f:p.f, q:q[k], u:uOf(k), hors:p.hors, solid:p.solid,
                 w:TYPO.cotes[k] != null ? TYPO.cotes[k] : coteDe(k) };
      }) };
  });
  var pid = MASS.vol.parti || MASS.parti;
  /* LES COTES DE NIVEAU : le pied de chaque étage de chaque volume, depuis le
     ±0.00 du rez de l'école, et sa hauteur — chaque volume a la sienne
     (`etagesDe`) */
  var vols = massOf().vol, z0 = datumEcole(MASS.vol), alt = {};
  MASS.vol.forEach(function(v){
    etagesDe(v).forEach(function(s, k, S){
      var r = z0 != null ? z0 : S[0].z0;
      alt[v.id + "|" + s.e.i] = { z:Math.round((s.z0 - r) * 100) / 100, h:s.h };
    });
  });
  return { floors:floors, graine:TYPO.graine, verrou:fige("typologie"),
    partis:{ courant:{ n:"Massing à l'écran · " + partiOf(pid).n, real:pid,
                       vols:ailes(vols), ponts:MASS.pont || [] } },
    site:{ per:SITE.per, bat:SITE.bat, mur:RULES.haut.mur },
    liens:PROX.filter(function(l){ return adjActive(l.id); }).map(function(l){ return { a:l.a, b:l.b, q:l.q }; }),
    /* les règles que le dessin tient : la largeur du couloir réglée au cahier
       des charges, le noyau, le feu, les murs, le module, la distance d'un lien */
    regles:{ fusion:V.fusionDist == null ? 1 : V.fusionDist, couloir:COULOIR, cage:RULES.circ.cage, noyau:RULES.circ.noyau, feu:RULES.feu,
             mur:RULES.haut.mur, cloison:RULES.haut.cloison, plan:RULES.plan, traits:TRAITS, alt:alt, echelle:ETAGES.echelle, module:V.module, lien:RULES.circ.proche,
             /* le sol libre toléré dans un corps ; null, la ligne est éteinte */
             vide:enVigueur("sol-vide") ? V.solVide : null } };
}

/* LES AILES D'UN VOLUME FUSIONNÉ. Le Massing assemble les corps qui se
   touchent en un volume de plusieurs rectangles (`model.js — partsDe`) ; les
   plans se composent rectangle par rectangle. Chaque aile devient donc un corps
   à part, du même bâtiment (`bat`) que les autres : elles se partagent leurs
   noyaux, et leurs intérieurs se touchent — pas de mur entre elles. Une aile
   se suit d'un niveau à l'autre par ce qu'elle recouvre en plan, pour que son
   noyau s'empile. */
export function ailes(vols){
  var out = [];
  vols.forEach(function(v){
    if(!v.lv.some(function(e){ return e.ext && e.ext.length; })){ out.push(v); return; }
    var A = [];
    v.lv.slice().sort(function(p, q){ return p.i - q.i; }).forEach(function(e){
      [{ w:e.w, d:e.d, dx:e.dx || 0, dy:e.dy || 0 }].concat((e.ext || []).map(function(p){
        return { w:p.w, d:p.d, dx:(e.dx || 0) + (p.dx || 0), dy:(e.dy || 0) + (p.dy || 0) };
      })).forEach(function(p, k){
        var lv = Object.assign({}, e, p, { ext:null });
        if(k) delete lv.keys;
        /* l'aile qu'elle recouvre le plus, et qui n'a pas encore ce niveau */
        var best = null, ba = .5;
        A.forEach(function(a){
          if(a.lv.some(function(x){ return x.i === e.i; })) return;
          var r = a.lv[a.lv.length - 1];
          var ox = Math.min(r.dx + r.w / 2, p.dx + p.w / 2) - Math.max(r.dx - r.w / 2, p.dx - p.w / 2);
          var oy = Math.min(r.dy + r.d / 2, p.dy + p.d / 2) - Math.max(r.dy - r.d / 2, p.dy - p.d / 2);
          if(ox > 0 && oy > 0 && ox * oy > ba){ ba = ox * oy; best = a; }
        });
        if(best) best.lv.push(lv);
        else A.push(Object.assign({}, v, { id:v.id + (A.length ? "-" + (A.length + 1) : ""),
                                           bat:v.bat || "b" + v.id, aile:v.id, lv:[lv] }));
      });
    });
    A.forEach(function(a){ out.push(a); });
  });
  return out;
}

/* LA SEED des Typologies : celle que rejoue « Shuffle typologie ». Elle ne
   change que l'ordonnance des pièces DANS les volumes du Massing. */
export function typoGraine(g){
  if(g && !fige("typologie")){ TYPO.graine = g >>> 0 || 1; saveSoon(); }
  return TYPO.graine;
}
/* La largeur d'une pièce d'un poste, au module, ramenée à une proportion qui
   garde la surface exacte ; null rend la cote du mixer (ou le calcul). Elle
   reste aux Typologies : la régler ici ne recompose pas le Massing. */
export function typoRegle(key, w){
  if(fige("typologie")) return;
  if(w == null) delete TYPO.cotes[key];
  else TYPO.cotes[key] = nearestDims(uOf(key), w).w;
  saveSoon();
}
