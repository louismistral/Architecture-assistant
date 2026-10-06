/* ============================================================================
   LE GÉNÉRATEUR DE VOLUMÉTRIE

   « Shuffle massing » ne touche PAS au programme. Mêmes postes, mêmes
   surfaces, mêmes niveaux, même répartition par niveau : ce que le mixer a
   décidé est une donnée d'entrée, pas une variable. Ce qui change est la
   SOLUTION ARCHITECTURALE — combien de corps, où, dans quelle direction, à
   quelle profondeur, jusqu'à quel étage, accolés, séparés ou reliés.

   Le générateur, dans cet ordre :

     1. TIRE les LEVIERS laissés libres (`data/leviers.js`) — un parti, une
        figure, une profondeur, une orientation, la salle de sport à part ou
        accolée, des passerelles ou non —, et respecte ceux qu'on a fixés ;
     2. VALIDE le CADRE (`mesures.js — ecarts()`) et jette toute variante qui
        en sort : il n'en propose jamais une ;
     3. RETIENT, entre les variantes valides, celles que l'ORIENTATION préfère
        — dosée avec le hasard (`V.hasardMass`) : la meilleure de chaque parti
        en libre, les huit meilleures d'un parti fixé ;
     4. CLASSE ce qu'il retient par le JUGEMENT (`data/jugement.js`) : la
        première proposition est celle que le jury noterait le mieux.

   L'orientation choisit, le jugement classe ; aucun ne sait rien de l'autre.
   ========================================================================= */
import { ITEMBYKEY } from "../core/model.js";
import { PER, SITE } from "../data/site.js";
import { V, courExigee, enVigueur, recul, reculVise } from "../data/cadre.js";
import { distVisee, feuExige, feuVise, force, ombreVisee, preference, vise } from "../data/orientation.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { areaOf, lvlOf, onFloor } from "../mix/floors.js";
import { adjRompues } from "../mix/checks.js";
import {
  assise, attracteurs, axePer, bbox, bordDist, dedans, airePosable,
  ecart, ecartAngle, margeAu, terrain, tientA, visAVis
} from "./geom.js";
import { CONTACT, MASS, massVols, aPaver, auModule, horsSol, lies, pontRect, profBornes, profFacade, secondTemps,
  profPieces, sousSol, volEtage, volRect, volRects, solRects, assiseDe, contourDe, hauteurEtage, partsDe } from "./model.js";
export { lies };
import { angleSoleilVue, courUtile, ecarts, ensembles, evaluer, lecture, oublier }
  from "./mesures.js";
import { PARTIS_FIGURES, composer } from "./partis.js";
import { architecturer } from "./archi.js";
import { GRAINE0 } from "../typo/etat.js";

/* ---------- le hasard du massing, et lui seul -------------------------------
   Une graine propre : celle du mixer rejoue une RÉPARTITION, celle-ci rejoue
   une IMPLANTATION. Les confondre ferait qu'on ne peut plus changer l'une sans
   perdre l'autre — et c'est justement ce que les deux boutons évitent. */
function alea(g){
  var s = (g >>> 0) || 1;
  return function(){
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function entre(r, a, b){ return a + r() * (b - a); }

function d1(v){ return Math.round(v * 10) / 10; }
/* Un levier du massing : fixé, sa valeur ; libre, une des options, à parts
   égales. `r` est le hasard du massing. */
function levier(k, options, r){
  var v = MASS.lev[k];
  return v != null ? v : options[Math.floor(r() * options.length)];
}


/* ---------- les emprises déjà là --------------------------------------------
   Les bâtiments existants qui touchent le périmètre : ils ne sont plus du
   cadre, mais la cour et les mesures les lisent encore. Ceux du coteau, à cent
   mètres, ne comptent pas. */
/* Les emprises existantes ne changent jamais : on les filtre une fois, et l'on
   garde pour chacune son CERCLE ENGLOBANT. Le test d'admissibilité les
   parcourait toutes à chaque position essayée — vingt-neuf polygones, quatre
   coins et autant d'intersections de segments — alors qu'une comparaison de
   deux rayons écarte les vingt-huit qui sont à cent mètres. */
var OBS = null;
function obstacles(){
  if(OBS) return OBS;
  OBS = (SITE.bat || []).filter(function(P){
    return P.some(function(p){ return margePoint(p) > -35; });
  }).map(function(P){
    var c = centre(P), r = 0;
    P.forEach(function(p){ r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1])); });
    return { P:P, cx:c[0], cy:c[1], r:r };
  });
  return OBS;
}
/* Ce qui peut toucher ce rectangle, et rien d'autre. */
export function obstaclesPres(rc, marge){
  var OB = obstacles(), out = [], i;
  var port = Math.hypot(rc.w, rc.d) / 2 + marge;
  for(i = 0; i < OB.length; i++){
    var d = Math.hypot(OB[i].cx - rc.x, OB[i].cy - rc.y);
    if(d <= OB[i].r + port) out.push(OB[i].P);
  }
  return out;
}
function margePoint(p){
  var best = Infinity, i;
  for(i = 0; i < PER.length - 1; i++){
    var a = PER[i], b = PER[i + 1];
    var vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
    var t = l2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2 : 0;
    if(t < 0) t = 0; if(t > 1) t = 1;
    var d = Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
    if(d < best) best = d;
  }
  return dedans(PER, p[0], p[1]) ? best : -best;
}

/* ---------- ce que le programme impose --------------------------------------
   La salle de sport double ne se coupe pas : le règlement lui donne ses deux
   cotes, 28 × 32 m, et sept mètres libres sous structure. Elle fait donc un
   CORPS À ELLE, au rez, et sa surface sort du partage avant qu'il commence.
   La répartir au prorata comme le reste l'aurait coupée en deux. */
function corpsImpose(iRez){
  if(iRez < 0) return null;
  var out = null;
  onFloor(iRez).forEach(function(b){
    var p = PMAP[b.key], it = ITEMBYKEY[b.key];
    if(!p || !p.solid || !it || !it.w || !it.h) return;
    /* Les cotes viennent du programme et de nulle part ailleurs. */
    out = { key:b.key, n:p.n, f:p.f, w:Math.max(it.w, it.h), d:Math.min(it.w, it.h),
            fix:1, aire:areaOf(b) };
  });
  return out;
}


/* ---------- des corps aux volumes -------------------------------------------
   Ici, et seulement ici, le programme donne les cotes. La part d'un corps dans
   un niveau est son poids parmi ceux qui montent jusque-là ; sa surface UTILE
   est cette part de la surface bâtie du niveau ; sa largeur est cette surface
   divisée par sa profondeur. Les deux cotes sont au MODULE, et la profondeur
   reste dans le domaine du levier (`profBornes()`) — `hi` la plafonne en
   plus pour un corps d'école, dont toutes les classes doivent avoir leur façade.
   Les murs s'ajoutent autour (`volRect`) : ils ne prennent rien au programme. */
function cotes(a, prof, hi){
  var B = profBornes(), top = Math.max(B.lo, Math.min(hi || B.hi, B.hi));
  var d = Math.max(B.lo, Math.min(prof, top, Math.sqrt(a)));
  /* La LONGUEUR aussi reste sous la cote maximale : à surface égale, on
     épaissit — et si même l'épaisseur maximale n'y suffit pas, le corps est
     trop grand pour ce parti, et la variante sera jetée. */
  if(a / d > B.hi) d = Math.min(top, a / B.hi);
  d = auModule(d);
  return { w: auModule(a / d), d: d };
}


/* `bout` : essayer d'abord BOUT À BOUT dans l'axe du corps principal. */
function accolerA(sp, M, vols, r, bout){
  if(!sp || !M) return false;
  var rm = rectSol(M), rs = rectSol(sp), cand = [], s, t, q;
  [0, Math.PI / 2].forEach(function(rot){
    var sx = rot ? rs.d : rs.w, sy = rot ? rs.w : rs.d;
    for(s = -1; s <= 1; s += 2){
      for(t = -1; t <= 1; t++){
        cand.push({ rot:rot, u:t * (rm.w - sx) / 2, v:s * (rm.d + sy) / 2 });
        cand.push({ rot:rot, u:s * (rm.w + sx) / 2, v:t * (rm.d - sy) / 2, bout: !rot && !t });
      }
    }
  });
  var c = Math.cos(M.a), sn = Math.sin(M.a), cote = vise("pub-est");
  /* le public d'un côté : les faces du corps qui regardent ce côté d'abord */
  cand.forEach(function(k){
    var px = k.u * c - k.v * sn, py = k.u * sn + k.v * c;
    k.o = r() - (bout && k.bout ? 1 : 0) - (cote ? 2 * versPublic({ x:px, y:py }) / Math.max(1, rm.w + rm.d) : 0);
  });
  cand.sort(function(a, b){ return a.o - b.o; });
  var av = { x:sp.x, y:sp.y, a:sp.a };
  sp.joint = M.id;
  for(q = 0; q < cand.length; q++){
    var k = cand[q];
    sp.x = d1(rm.x + k.u * c - k.v * sn); sp.y = d1(rm.y + k.u * sn + k.v * c);
    sp.a = M.a + k.rot;
    if(admissible(sp, vols) && admissible(M, vols)) return true;
  }
  sp.x = av.x; sp.y = av.y; sp.a = av.a;
  delete sp.joint;
  return false;
}

/* ---------- les passerelles --------------------------------------------------
   Elles relient deux corps d'école sans les fusionner. Jamais systématiques :
   seulement dans une partie des variantes, et seulement entre ensembles qui ne
   sont pas déjà reliés — la plus courte d'abord, jusqu'à ce que l'école tienne
   d'un seul tenant ou que rien d'autre ne tienne. Une passerelle reste dans le
   périmètre et ne traverse aucun autre corps. */
export function relier(vols){
  var E = vols.filter(function(v){ return !v.ph && !v.fix; });
  var cand = [], ponts = [];
  E.forEach(function(A, i){
    E.forEach(function(B, j){
      if(j <= i || lies(A, B)) return;
      var i1 = -1;
      A.lv.forEach(function(e){
        if(lvlOf(e.i) >= 1 && volEtage(B, e.i) && (i1 < 0 || e.i < i1)) i1 = e.i;
      });
      if(i1 < 0) return;
      var p = { a:A.id, b:B.id, i:i1 }, rc = pontRect(p, vols);
      if(!rc || rc.long > V.passMax || rc.long < RULES.dist.entre - .01) return;
      if(margeAu(PER, rc) < recul() - .01) return;
      var bute = vols.some(function(o){
        return o !== A && o !== B && solRects(o).some(function(r){ return ecart(rc, r) < .5; }); });
      if(!bute) cand.push({ p:p, l:rc.long });
    });
  });
  cand.sort(function(a, b){ return a.l - b.l; });
  cand.forEach(function(c){
    if(ensembles(E, ponts) <= 1) return;
    var n0 = ensembles(E, ponts);
    ponts.push(c.p);
    if(ensembles(E, ponts) === n0) ponts.pop();
  });
  return ponts;
}

/* ---------- les ouvrages du second temps -------------------------------------
   La piscine (500 m²) et le local CAD (400 m²) sont indépendants de l'école et
   bâtis plus tard (art. 2.2), mais ils occupent le terrain : on les pose APRÈS
   l'école, dans les marges du site, aux mêmes distances que tout le reste, et
   sans entamer la cour minimale. Réunis ou séparés : « auto » laisse le
   générateur essayer les deux ; le rail peut l'imposer. Quand rien ne tient,
   l'ouvrage n'est pas posé et le contrôle le dit. */
function poserSecond(vols, r){
  var S = secondTemps();
  if(!S.length) return;
  var tot = 0;
  S.forEach(function(x){ tot += x.a; });
  /* Réunis, ils ne se tentent que si l'ouvrage commun reste sous la cote. */
  var unOk = tot <= profBornes().hi * profBornes().hi;
  var modes = MASS.second === "auto"
    ? (unOk ? (r() < .5 ? ["un", "sep"] : ["sep", "un"]) : ["sep"]) : [MASS.second];
  var i;
  for(i = 0; i < modes.length; i++){
    retirerSecond(vols);
    var lots = modes[i] === "un" ? [S] : S.map(function(x){ return [x]; });
    var tous = true;
    lots.forEach(function(lot, k){
      var a = 0, h = 0, keys = [], noms = [];
      lot.forEach(function(x){
        a += x.a; h = Math.max(h, x.h); keys.push(x.key); noms.push(x.n);
      });
      var q = cotes(a, 24);
      var v = { id:"ph" + (k + 1), x:0, y:0, a:axePer(),
                lv:[{ i:lot[0].i, w:q.w, d:q.d, dx:0, dy:0, a:a, h:h, keys:keys }],
                fix:0, ph:2, nom: noms.join(" et "), prof:q.d, grad:0 };
      vols.push(v);
      if(!auBord(v, vols)){ vols.pop(); tous = false; }
    });
    if(tous) return;
  }
}
function secondPose(vols){
  var pose = {};
  vols.forEach(function(v){ if(v.ph) (v.lv[0].keys || []).forEach(function(k){ pose[k] = 1; }); });
  return secondTemps().every(function(x){ return pose[x.key]; });
}
function retirerSecond(vols){
  for(var i = vols.length - 1; i >= 0; i--) if(vols[i].ph) vols.splice(i, 1);
}
/* La position admissible la plus proche du BORD, qui laisse sa cour à l'école. */
function auBord(v, vols){
  var B = bbox(PER), demi = Math.min(v.lv[0].w, v.lv[0].d) / 2;
  var cand = [], cx, cy, k, essais = 0;
  for(cx = B.x0; cx <= B.x1; cx += 2){
    for(cy = B.y0; cy <= B.y1; cy += 2){
      var d = bordDist(PER, cx, cy);
      if(d < reculVise() + demi * .3) continue;
      cand.push([cx, cy, d]);
    }
  }
  /* du bord vers le cœur ; et quand on vise le public d'un côté (`pub-est`),
     d'abord la marge de ce côté : on ajoute au bord la distance au côté public */
  var pmax = -Infinity, cote = (v.lv[0].keys.some(function(k){ return PMAP[k] && PMAP[k].pub; }) && vise("pub-est"))
    || (v.ph && vise("second-est"));
  cand.forEach(function(c){ c[3] = versPublic({ x:c[0], y:c[1] }); pmax = Math.max(pmax, c[3]); });
  cand.forEach(function(c){ c[2] += cote ? pmax - c[3] : 0; });
  cand.sort(function(p, q2){ return p[2] - q2[2]; });
  var angles = [v.a, v.a + Math.PI / 2, v.a + Math.PI / 4, v.a - Math.PI / 4];
  /* position d'abord, angle ensuite : une place du bon côté qui ne tient que
     tournée passe avant une place du mauvais côté qui tient droite */
  for(var i = 0; i < cand.length; i++){
    for(k = 0; k < angles.length; k++){
      if(!admissible(v, vols, cand[i][0], cand[i][1], angles[k])) continue;
      v.x = d1(cand[i][0]); v.y = d1(cand[i][1]); v.a = angles[k];
      if(courUtile(vols).a >= courExigee()) return true;
      if(++essais > 30) return false;
    }
  }
  return false;
}

/* ---------- la règle d'implantation, en UN seul endroit ----------------------
   Ni le générateur ni le glisser à la souris ne posent un corps qui ne tient
   pas : tous les étages dans le périmètre, recul du PACom compris ; rien ne se
   recouvre, et la distance incendie entre bâtiments à TOUS les étages hors sol
   quand elle est du cadre (`feuExige()`).
   Deux corps ACCOLÉS (`joint`) font un seul bâtiment : ils se touchent sans se
   recouvrir. */
export function rectsHors(v, P){
  var Q = P || v, out = [];
  /* toutes les parts d'un volume fusionné : c'est elles qui se mesurent */
  v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) volRects(Q, e).forEach(function(r){ out.push(r); }); });
  if(!out.length && v.lv[0]) volRects(Q, v.lv[0]).forEach(function(r){ out.push(r); });
  return out;
}
/* La plus petite distance entre deux volumes, étage par étage. Au-delà de
   `seuil`, on ne mesure pas : deux cercles englobants suffisent à le savoir. */
export function ecartVols(v, o, P, seuil){
  var A = rectsHors(v, P), Bo = rectsHors(o), m = Infinity, s = seuil == null ? Infinity : seuil;
  A.forEach(function(a){
    Bo.forEach(function(b){
      /* `ecart()` est l'écart le long des axes des rectangles, qui peut être
         PLUS PETIT que la distance à vol d'oiseau : sur les deux axes de `a`,
         il vaut au moins la distance des centres / √2, moins les deux rayons. */
      var bas = Math.hypot(a.x - b.x, a.y - b.y) / Math.SQRT2 - Math.hypot(a.w, a.d) / 2
              - Math.hypot(b.w, b.d) / 2;
      if(bas >= s) return;
      var e = ecart(a, b);
      if(e < m) m = e;
    });
  });
  return m;
}
/* Le corps tient dans le périmètre, recul compris — la seule règle que le geste
   à la main respecte ; les distances, le contrôle les signale. */
export function dansPerimetre(v, x, y, a){
  var P = { x: x == null ? v.x : x, y: y == null ? v.y : y, a: a == null ? v.a : a };
  for(var i = 0; i < v.lv.length; i++){
    var R = volRects(P, v.lv[i]);
    for(var k = 0; k < R.length; k++) if(!tientA(PER, R[k], recul() - .01)) return false;
  }
  return true;
}
export function admissible(v, vols, x, y, a){
  var P = { x: x == null ? v.x : x, y: y == null ? v.y : y, a: a == null ? v.a : a };
  var i, D = feuExige();
  if(!dansPerimetre(v, P.x, P.y, P.a)) return false;
  for(i = 0; i < vols.length; i++){
    var o = vols[i];
    if(o === v) continue;
    /* Deux parties d'un même bâtiment ne se recouvrent pas ; deux bâtiments se
       tiennent à la distance minimale. */
    var e = ecartVols(v, o, P, D);
    if(e < D - .01 && !(lies(v, o) && e >= -CONTACT)) return false;
  }
  return true;
}
export function toutDedans(vols){
  for(var i = 0; i < vols.length; i++) if(!admissible(vols[i], vols)) return false;
  return true;
}

/* Ramener ce qui dépasse. La distance minimale se tient pleine poussée ; le
   JOUR — `V.ombreK` fois la hauteur du plus haut — d'une poussée douce :
   c'est une orientation, pas un cadre, et elle ne doit pas faire sortir un
   corps de la parcelle pour gagner deux mètres. */
function reparer(vols){
  var pas, i, j, B = bbox(PER), RV = reculVise(), OK = ombreVisee();
  /* La réparation vise la distance SOUHAITÉE, jamais moins que la distance
     incendie. */
  var cible = Math.max(feuVise(), distVisee()) + .35;
  var N = horsSol(), HN = {};
  N.forEach(function(n){ HN[n.i] = n; });
  var HV = vols.map(function(v){
    var h = 0;
    v.lv.forEach(function(e){ if(HN[e.i] !== undefined) h += hauteurEtage(e, HN[e.i]); });
    return h;
  });
  var DOUX = .45, MARGE_JOUR = .4;
  for(pas = 0; pas < 60; pas++){
    var bouge = 0;
    for(i = 0; i < vols.length; i++){
      var v = vols[i], dx = 0, dy = 0;
      var pire = Infinity;
      v.lv.forEach(function(e){ volRects(v, e).forEach(function(r){ pire = Math.min(pire, margeAu(PER, r)); }); });
      var m = pire - RV - .3;
      if(m < 0){
        var k = Math.min(3, -m) * .55;
        var lx = B.cx - v.x, ly = B.cy - v.y, l = Math.hypot(lx, ly) || 1;
        dx += lx / l * k; dy += ly / l * k;
      }
      for(j = 0; j < vols.length; j++){
        if(j === i || lies(v, vols[j])) continue;
        var es = ecartSols(v, vols[j]), e = es.e;
        var jour = es.vis > 8 ? Math.max(HV[i], HV[j]) * OK : 0;
        var vise = Math.max(cible, Math.min(jour + MARGE_JOUR, cible + 14));
        if(e < vise){
          var ox = v.x - vols[j].x, oy = v.y - vols[j].y, ol = Math.hypot(ox, oy) || 1;
          var dur = Math.max(0, Math.min(cible, vise) - e);
          var mou = Math.max(0, vise - Math.max(e, cible));
          var push = Math.min(3, dur * .5 + mou * DOUX * .5);
          dx += ox / ol * push; dy += oy / ol * push;
        }
      }
      if(v.ancre){ dx *= .35; dy *= .35; }
      if(Math.abs(dx) + Math.abs(dy) > .02){
        v.x = d1(v.x + dx); v.y = d1(v.y + dy); bouge++;
      }
    }
    if(!bouge) break;
  }
}
/* Le repêchage : la position admissible la plus proche, quart de tour compris. */
function repecher(vols){
  for(var i = 0; i < vols.length; i++) recaler(vols[i], vols);
}
export function recaler(v, vols){
  if(!v || admissible(v, vols)) return false;
  var k, q;
  /* Condition NÉCESSAIRE avant tout calcul : le centre doit être à au moins le
     recul plus la demi-petite-cote du bord — le cercle inscrit. Elle écarte la
     plupart des positions sans rien mesurer. */
  var demi = Infinity;
  rectsHors(v).forEach(function(r){ demi = Math.min(demi, Math.min(r.w, r.d) / 2); });
  var seuil = reculVise() + demi - .01;
  var angles = [v.a, v.a + Math.PI / 2, axePer(), axePer() + Math.PI / 2];
  var cand = grilleSite().filter(function(p){ return p[2] >= seuil; }).map(function(p){
    return [p[0], p[1], (p[0] - v.x) * (p[0] - v.x) + (p[1] - v.y) * (p[1] - v.y)];
  });
  cand.sort(function(a, b){ return a[2] - b[2]; });
  for(k = 0; k < angles.length; k++){
    for(q = 0; q < cand.length; q++){
      if(!admissible(v, vols, cand[q][0], cand[q][1], angles[k])) continue;
      v.x = d1(cand[q][0]); v.y = d1(cand[q][1]); v.a = angles[k];
      return true;
    }
  }
  return false;
}
/* Les positions candidates du site, au pas de 3 m, avec leur distance au bord :
   le périmètre ne change jamais, on ne les calcule qu'une fois. */
var GRILLE = null;
function grilleSite(){
  if(GRILLE) return GRILLE;
  var B = bbox(PER), cx, cy;
  GRILLE = [];
  for(cx = B.x0; cx <= B.x1; cx += 3){
    for(cy = B.y0; cy <= B.y1; cy += 3){
      if(dedans(PER, cx, cy)) GRILLE.push([cx, cy, bordDist(PER, cx, cy), terrain(cx, cy)]);
    }
  }
  return GRILLE;
}
function centre(P){
  var x = 0, y = 0;
  P.forEach(function(p){ x += p[0]; y += p[1]; });
  return [x / P.length, y / P.length];
}
/* L'EMPRISE AU SOL, murs compris : le plus bas étage hors sol. */
function etageSol(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i < e.i) e = x;
  });
  return e || v.lv[0];
}
function rectSol(v){ return volRect(v, etageSol(v)); }
/* Pour un volume fusionné, l'emprise au sol est faite de plusieurs parts :
   l'assise les pondère, l'emprise est l'aire de leur union, et deux volumes se
   mesurent par leurs deux parts les plus proches (`vis` : leur vis-à-vis). */
export function assiseVol(v){ return assiseDe(solRects(v)); }
export function empSol(v){ return contourDe(v, etageSol(v)).aire; }
export function ecartSols(a, b){
  var A = solRects(a), B = solRects(b), best = { e:Infinity, vis:0 };
  A.forEach(function(ra){
    B.forEach(function(rb){
      var e = ecart(ra, rb);
      if(e < best.e) best = { e:e, vis:visAVis(ra, rb), ra:ra, rb:rb };
    });
  });
  return best;
}

/* ---------- poser une figure de parti D'UN BLOC --------------------------------
   La figure de `partis.js` arrive dans son repère ; on ne la déforme plus. On
   cherche une position et un angle où TOUS ses volumes tiennent — parcelle,
   recul, existant —, et c'est tout : pas de poussée corps par corps, qui
   défaisait un U en trois blocs épars. Si rien ne tient, la figure est jetée. */
var ATTS = null;
function implanter(S, N, r, th0){
  if(!ATTS) ATTS = attracteurs();
  var cx = 0, cy = 0, rMin = Infinity;
  S.forEach(function(s){ cx += s.x / S.length; cy += s.y / S.length; });
  var vols = S.map(function(s, k){
    rMin = Math.min(rMin, Math.min(s.w, s.d) / 2);
    return { id:"v" + (k + 1), x:0, y:0, a:0, lx:s.x - cx, ly:s.y - cy, la:s.a,
             bat:s.bat, role:s.role, fix:0, prof:s.d, grad: s.gradin ? 1 : 0,
             lv: s.lv.map(function(e){
               return { i:N[e.k].i, w:e.w, d:e.d, dx:0,
                        dy: s.gradin && e.k > 0 ? d1(-(s.d - e.d) / 2) : 0, a:e.a };
             }) };
  });
  var cand = grilleSite().filter(function(p){ return p[2] >= reculVise() + rMin; });
  var t, k;
  for(t = 0; t < 300; t++){
    var p = cand[Math.floor(r() * cand.length)];
    /* piscine et CAD du côté public (`second-est`) : l'école laisse cette marge —
       de deux positions tirées, la plus éloignée du côté public */
    if(vise("second-est")){
      var p2 = cand[Math.floor(r() * cand.length)];
      if(versPublic({ x:p2[0], y:p2[1] }) < versPublic({ x:p[0], y:p[1] })) p = p2;
    }
    /* L'angle choisi le plus souvent ; parfois une direction du site — une
       longue barre ne tient que dans le sens de la parcelle. */
    var th = r() < .7 ? th0 + entre(r, -1, 1) * V.jeuAngle * 1.5 + (r() < .25 ? Math.PI / 2 : 0)
                      : ATTS[Math.floor(r() * ATTS.length)].a + (r() < .5 ? 0 : Math.PI / 2);
    var c = Math.cos(th), s2 = Math.sin(th), ok = true;
    for(k = 0; k < vols.length; k++){
      var v = vols[k];
      v.x = d1(p[0] + v.lx * c - v.ly * s2); v.y = d1(p[1] + v.lx * s2 + v.ly * c); v.a = th + v.la;
    }
    for(k = 0; k < vols.length && ok; k++) if(!admissible(vols[k], vols)) ok = false;
    if(ok){ vols.T = { x:p[0], y:p[1], a:th }; return vols; }
  }
  return null;
}
/* La figure est-elle restée celle qu'on a construite ? Chaque volume à sa place
   dans le repère posé, au décimètre près. C'est la garde contre toute retouche
   qui la déformerait. */
export function intact(vols){
  var T = vols.T;
  if(!T) return true;
  var c = Math.cos(T.a), s = Math.sin(T.a);
  return vols.every(function(v){
    if(v.lx == null) return true;
    var x = T.x + v.lx * c - v.ly * s, y = T.y + v.lx * s + v.ly * c;
    return Math.hypot(v.x - x, v.y - y) < .2 && Math.abs(Math.sin(v.a - T.a - v.la)) < .01;
  });
}
/* La salle de sport — un LEVIER : accolée à la figure, ou sur le bas du
   terrain, à distance. Libre, une chance sur deux ; accolée sans y parvenir,
   elle se pose à part. Ses cotes ne bougent pas. Le cadre `scene-sport` (la
   scène collée à la salle, sur un de ses côtés) la veut TOUJOURS accolée : il
   essaie chaque corps d'école, et sans succès l'essai échoue. */
/* Où un point se tient vers le côté public (`V.pubAz`, l'orientation `pub-est`) : m. */
function versPublic(p){ var az = V.pubAz * Math.PI / 180; return p.x * Math.sin(az) + p.y * Math.cos(az); }
function placerSport(vols, imp, r, th){
  var sp = { id:"vsport", x:0, y:0, a:th, fix:1, ancre:1, key:imp.key, prof:imp.d, grad:0,
             lv:[{ i:imp.i, w:imp.w, d:imp.d, dx:0, dy:0, a:imp.aire, keys:[imp.key] }] };
  vols.push(sp);
  var E = vols.filter(function(v){ return !v.fix && !v.ph; });
  if(enVigueur("scene-sport")){
    var o = Math.floor(r() * Math.max(1, E.length));
    var L0 = E.map(function(x, e){ return E[(o + e) % E.length]; });
    /* le public d'un côté (`pub-est`) : d'abord le corps le plus avancé de ce côté */
    if(vise("pub-est")) L0.sort(function(a, b){ return versPublic(b) - versPublic(a); });
    for(var e = 0; e < L0.length; e++) if(accolerA(sp, L0[e], vols, r)) return true;
    vols.pop();
    return false;
  }
  if(E.length && levier("sport", ["accolee", "part"], r) === "accolee"
     && accolerA(sp, E[Math.floor(r() * E.length)], vols, r)) return true;
  delete sp.joint;
  var demi = Math.min(imp.w, imp.d) / 2 + RULES.haut.mur;
  var cand = grilleSite().filter(function(p){ return p[2] >= reculVise() + demi; })
    .map(function(p){ return [p[0], p[1], p[3] + r() * .8]; });
  cand.sort(function(a, b){ return a[2] - b[2]; });
  for(var q = 0; q < cand.length && q < 500; q++){
    var A = [th, th + Math.PI / 2];
    for(var k = 0; k < 2; k++){
      if(admissible(sp, vols, cand[q][0], cand[q][1], A[k])){
        sp.x = d1(cand[q][0]); sp.y = d1(cand[q][1]); sp.a = A[k];
        return true;
      }
    }
  }
  vols.pop();
  return false;
}
/* Le sens de la pente : vers où le terrain descend, au cœur du site. */
var AVAL = null;
function aval(){
  if(AVAL != null) return AVAL;
  var B = bbox(PER), h = 20;
  var gx = terrain(B.cx + h, B.cy) - terrain(B.cx - h, B.cy);
  var gy = terrain(B.cx, B.cy + h) - terrain(B.cx, B.cy - h);
  AVAL = Math.atan2(-gy, -gx);
  return AVAL;
}
/* L'orientation d'une figure — une ORIENTATION (`data/orientation.js — cap`) :
   l'axe du périmètre, l'optimum soleil-vue, ou un angle libre autour de l'axe.
   L'optimum compte `force("cap")` fois de plus que les deux autres. Les terrasses suivent les courbes : leurs rangs descendent la
   pente (le +v de la figure va vers l'aval). */
var CAP = null;      /* d'où vient le dernier angle : « pente », « axe », « soleil », « libre » */
function orientation(pid, r, centreSite){
  CAP = "pente";
  if(pid === "terrasses") return aval() - Math.PI / 2;
  var O = ["axe", "soleil", "libre"];
  for(var k = force("cap"); k > 0; k--) O.push("soleil");
  var m = CAP = O[Math.floor(r() * O.length)];
  if(m === "axe") return axePer();
  if(m === "soleil") return angleSoleilVue(centreSite.cx, centreSite.cy);
  return axePer() + entre(r, -.7, .7);
}

/* ---------- le tirage massing ------------------------------------------------
   Générer, valider, comparer, choisir — dans cet ordre. En « Auto », chaque
   parti est reconnu ; ceux qui rendent au moins une variante valide reçoivent
   la suite des essais. Quand aucune variante ne tient, RIEN n'est proposé : le
   résultat est vide, marqué `impossible`, et le contrôle dit quoi faire. */
/* Les pièces redimensionnées au mixer dictent la profondeur (`profPieces`) ;
   si aucune composition n'y tient, on rejoue sans elles plutôt que de ne rien
   proposer — et le contrôle dit que les cotes n'ont pas été tenues. */
var SANS_PIECES = false;
export function genMass(graine){
  var g = graine == null ? MASS.graine : graine;
  var r = alea(g);
  var N = horsSol();
  /* une adjacence exigée rompue au mixer : la répartition n'est pas valide, et
     aucun volume ne se propose dessus */
  if(!N.length || adjRompues().length) return [];
  oublier();
  var imp = corpsImpose(N[0].i);
  if(imp) imp.i = N[0].i;
  var partis = MASS.parti === "auto" ? PARTIS_LIBRES : [MASS.parti];
  var B = profBornes(), hiE = Math.max(B.lo, Math.min(B.hi, profFacade()));
  var centreSite = bbox(PER);
  var valides = [], rates = [], nEssais = 0;

  /* UN ESSAI, dans l'ordre voulu : 1. les LEVIERS — le parti construit sa
     figure, le programme lui donne ses étages et ses emprises (dans
     `composer`), la figure est posée d'un bloc, puis la salle de sport, le
     sous-sol, les passerelles ; 2. le CADRE — tout entier — décide si elle
     entre dans les résultats ; 3. l'ORIENTATION ne départage qu'ensuite. */
  function essai(pid){
    nEssais++;
    /* La profondeur — un levier : fixée, la nôtre ; libre, tirée sous la cote
       de façade, pleine pour une barre et un bloc compact. Toute profondeur se
       pave, mais un corps mince paie plus de couloir : `aPaver` le dit, et le
       niveau le reçoit. Des pavillons plus minces ne tenaient plus sur le site. */
    var p0 = B.lo, p1 = hiE;
    if(pid === "barre" || pid === "compact") p0 = Math.max(B.lo, hiE - 3);
    /* fixée au rail, elle est la nôtre ; sinon, des pièces redimensionnées au
       mixer la dictent (`profPieces`) ; sinon, elle est tirée */
    var fixe = MASS.lev.prof, pp = SANS_PIECES ? null : profPieces();
    var prof = fixe != null ? auModule(Math.max(B.lo, Math.min(hiE, fixe - 2 * RULES.haut.mur)))
             : pp != null ? auModule(Math.max(B.lo, Math.min(hiE, pp)))
                          : auModule(entre(r, p0, p1)), vols;
    /* ce que chaque niveau demande à cette profondeur : ce que les plans y pavent */
    var Aecole = N.map(function(n, k){ return Math.max(0, aPaver(n.i, prof) - (imp && k === 0 ? imp.aire : 0)); });
    {
      var S = composer(pid, Aecole, prof, r);
      if(!S){ rates.push({ pid:pid, k:"parti" }); return false; }
      var th = orientation(pid, r, centreSite);
      vols = implanter(S, N, r, th);
      if(!vols){ rates.push({ pid:pid, k:"perimetre" }); return false; }
      if(imp && !placerSport(vols, imp, r, th)){ rates.push({ pid:pid, k:"sport" }); return false; }
      enterrer(vols);
      var bats = {};
      vols.forEach(function(v){ if(v.bat) bats[v.bat] = 1; });
      vols.ponts = Object.keys(bats).length > 1 && levier("ponts", ["oui", "non"], r) === "oui"
        ? relier(vols) : [];
      /* la figure doit rester celle de son parti : c'est ce que veut dire
         l'option du levier, pas une contrainte sur le bâtiment */
      if(!intact(vols)){ rates.push({ pid:pid, k:"parti" }); return false; }
      /* CE QUI SE TOUCHE NE FAIT QU'UN avant d'être jugé : le cadre, l'orientation
         et la note lisent le L, pas ses deux barres — comme à l'écran */
      fusionner(vols, vols.ponts);
    }
    vols.parti = pid; vols.prof = prof;
    /* des pièces plus profondes que le cadre ne laisse de corps : bornées */
    if(fixe == null && pp != null && pp > hiE + 0.25) vols.piecesIgnorees = pp;
    /* la TRACE du raisonnement, pour la planche de diagrammes : la figure en
       coordonnées locales avant implantation, l'angle et sa source, les
       surfaces par niveau, la salle de sport, les bornes de profondeur */
    vols.trace = { S:S, th:th, cap:CAP, prof:prof, A:Aecole.slice(), N:N, imp:imp, lo:B.lo, hi:hiE };
    var d = ecarts(vols, true);
    if(!d.length){ valides.push({ vols:vols, pid:pid, pref: preference(lecture(vols).q) }); return true; }
    rates.push({ vols:vols, pid:pid, k:d[0].k, pile:d[0].pile });
    return false;
  }


  var lot = partis, t;
  if(partis.length > 1){
    var ok = {};
    partis.forEach(function(pid){
      for(var k = 0; k < Math.max(1, Math.round(V.essaisParti)); k++)
        if(essai(pid)) ok[pid] = 1;
    });
    var l2 = partis.filter(function(p){ return ok[p]; });
    if(l2.length) lot = l2;
  }
  for(t = 0; t < Math.max(1, Math.round(V.essais)); t++) essai(lot[t % lot.length]);
  /* Un parti imposé qui n'a encore presque rien rendu : on persévère, les
     essais ne coûtent que quelques millisecondes — jusqu'à dix fois le budget. */
  var plafond = 10 * Math.max(1, Math.round(V.essais));
  while(valides.length < 4 && t < plafond){ essai(lot[t % lot.length]); t++; }

  /* RETENIR, PUIS LA DERNIÈRE GARDE, PUIS CLASSER. L'orientation retient les
     candidates ; sur chacune, les ouvrages du second temps se posent et TOUT le
     cadre est revérifié : s'ils le font enfreindre, ils ne sont pas posés ; si
     la variante ne tient plus, elle s'en va. Rien qui sorte du cadre n'arrive à
     l'écran. Ce qui reste est classé par le JUGEMENT — le bâtiment entier,
     second temps compris : la première est montrée, les suivantes attendent
     « Shuffle massing ». */
  /* La piscine et le CAD sont TOUJOURS dessinés : une candidate qui ne sait pas
     les poser ne passe qu'à défaut de toute autre — et le contrôle le dit en rouge. */
  var n0 = valides.length, props = [], sans = [];
  retenir(valides, partis.length > 1, r).forEach(function(c){
    poserSecond(c.vols, r);
    if(ecarts(c.vols, false).length) retirerSecond(c.vols);
    if(ecarts(c.vols, false).length) return;
    /* plans compris, à la seed typologie PAR DÉFAUT : la seed du massing seule
       décide du massing, quelle que soit la typologie à l'écran — la recherche
       essaie ensuite les typologies du volume retenu */
    var ev = evaluer(c.vols, null, GRAINE0);
    c.vols.score = ev.jugement.total;
    c.vols.pref = c.pref;
    c.vols.valides = n0; c.vols.essais = nEssais;
    (secondPose(c.vols) ? props : sans).push(c.vols);
  });
  if(!props.length) props = sans;
  props.sort(function(a, b){ return (b.score || 0) - (a.score || 0); });
  /* ce qui a fait échouer les essais, compté — gardé aussi quand ça réussit :
     c'est la moitié de l'histoire d'une variante (la planche de diagrammes) */
  var echecs = {};
  rates.forEach(function(x){ echecs[x.k] = (echecs[x.k] || 0) + 1; });
  if(!props.length && !SANS_PIECES && profPieces() != null){
    SANS_PIECES = true;
    var libre;
    try { libre = genMass(graine); } finally { SANS_PIECES = false; }
    libre.piecesIgnorees = profPieces();
    if(libre.props) libre.props.forEach(function(v){ v.piecesIgnorees = libre.piecesIgnorees; });
    return libre;
  }
  if(props.length){
    props.forEach(function(v){ v.echecs = echecs; });
    props.forEach(function(v, k){ v.rang = k; v.props = props; });
    return props[0];
  }
  /* AUCUNE variante ne tient : on ne propose RIEN. Une composition qui enfreint
     une contrainte dure n'est pas une option, même « la moins fautive ». Le
     résultat est vide et marqué, et le contrôle dit pourquoi et quoi faire. */
  var vide = [];
  vide.impossible = 1;
  /* Ce qui a fait échouer les essais, compté : de quoi dire pourquoi. */
  vide.echecs = {};
  rates.forEach(function(x){ vide.echecs[x.k] = (vide.echecs[x.k] || 0) + 1; });
  /* Une règle que la composition ne peut pas résoudre (l'abri PC à l'étage) : on
     le dit, c'est au mixer. */
  var pile = rates.filter(function(x){ return x.pile && x.vols; })[0];
  if(pile) vide.raison = ecarts(pile.vols, false).filter(function(x){ return x.pile; })[0].msg;
  vide.parti = MASS.parti;
  vide.posable = airePosable(reculVise());
  return vide;
}
var PARTIS_LIBRES = PARTIS_FIGURES.concat(["libre"]);

/* L'ORIENTATION RETIENT. Chaque candidate valide a sa préférence (0 à 1,
   `data/orientation.js — preference()`) ; la part du hasard (`V.hasardMass`)
   s'y mêle, et l'on garde les mieux placées : la meilleure de chaque parti
   quand le parti est libre — la diversité —, les huit meilleures d'un parti
   fixé. Le jugement n'entre pas ici : il classe ensuite ce qu'on a retenu. */
function retenir(cands, parParti, r){
  var h = Math.max(0, Math.min(1, V.hasardMass));
  cands.forEach(function(c){ c.cle = (1 - h) * c.pref + h * r(); });
  cands.sort(function(a, b){ return b.cle - a.cle; });
  if(!parParti) return cands.slice(0, 8);
  var vu = {}, out = [];
  cands.forEach(function(c){ if(!vu[c.pid]){ vu[c.pid] = 1; out.push(c); } });
  return out;
}

/* Les sous-sols vont sous le corps le PLUS HAUT du site : trois mètres de
   terrain au-dessus de la nappe ne se trouvent qu'au tiers est. Jamais sous la
   salle de sport, ni sous un ouvrage du second temps. */
function desenterrer(vols){
  vols.forEach(function(v){
    v.lv = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; });
  });
}
function enterrer(vols){
  var S = sousSol();
  if(!S.length || !vols.length) return;
  var cand = vols.filter(function(v){ return !v.fix && !v.ph; });
  if(!cand.length) cand = vols;
  var big = cand[0], bz = assiseVol(cand[0]).z, i;
  for(i = 1; i < cand.length; i++){
    var z = assiseVol(cand[i]).z;
    if(z > bz + .15 || (Math.abs(z - bz) <= .15
        && empSol(cand[i]) > empSol(big))){
      bz = Math.max(bz, z); big = cand[i];
    }
  }
  /* Le sous-sol se loge sous le corps le plus haut, et sous les suivants quand
     il dépasse ce qu'un volume peut avoir : chaque part garde la profondeur de
     son corps et reste sous la cote maximale. */
  var ordre = cand.slice().sort(function(a, b){
    return assiseVol(b).z - assiseVol(a).z; });
  ordre.splice(ordre.indexOf(big), 1); ordre.unshift(big);
  S.forEach(function(n){
    var reste = aPaver(n.i, Math.min(etageSol(big).d, profBornes().hi)), k = 0;
    while(reste > 1 && k < ordre.length){
      var v = ordre[k++], hi = profBornes().hi, d = Math.min(etageSol(v).d, hi);
      var a = Math.min(reste, d * hi);
      var q = cotes(a, d);
      v.lv.push({ i:n.i, w:q.w, d:q.d, dx:0, dy:0, a:a });
      reste -= a;
    }
    if(reste > 1){                                  /* rien d'autre sous quoi creuser */
      var e = null;
      big.lv.forEach(function(x){ if(x.i === n.i) e = x; });
      if(e){ e.a += reste; var q2 = cotes(e.a, e.d); e.w = q2.w; e.d = q2.d; }
    }
  });
  ordre.forEach(function(v){ v.lv.sort(function(a, b){ return a.i - b.i; }); });
}

/* ---------- ce que les remèdes rejouent --------------------------------------
   Le contrôle propose des gestes (`mass/fix.js`) ; la mécanique reste ici. */
export function ecarter(vols){
  reparer(vols);
  vols.forEach(function(v){ recaler(v, vols); });
  return true;
}
export function replacerSousSol(vols){
  if(!sousSol().length) return false;
  desenterrer(vols);
  enterrer(vols);
  return true;
}
export function poserSecondTemps(vols){
  poserSecond(vols, alea(MASS.graine));
  return true;
}
export function relierCourant(){
  MASS.pont = relier(MASS.vol);
  return MASS.pont.length > 0;
}

export { rectSol };

/* ---------- deux règles du geste à la main ---------------------------------
   RIEN NE SE SUPERPOSE : deux volumes peuvent se toucher, jamais se recouvrir,
   à aucun étage. */
export function chevauche(v, vols, x, y, a){
  var P = { x: x == null ? v.x : x, y: y == null ? v.y : y, a: a == null ? v.a : a, lv: v.lv };
  return vols.some(function(o){ return o !== v && ecartVols(v, o, P, 1) < -CONTACT; });
}
/* CE QUI SE TOUCHE NE FAIT QU'UN. Deux corps bout à bout, de même angle, aux
   mêmes niveaux et de même profondeur à chacun, deviennent UN volume : les deux
   pignons qui se touchaient disparaissent, leur épaisseur entre dans le corps.
   Deux corps qui se touchent autrement (en équerre, ou l'un plus haut que
   l'autre, ou la salle de sport aux cotes imposées) deviennent un même
   BÂTIMENT : ils partagent leurs couloirs, aucune distance ne leur est due.
   Rend le nombre de fusions. `etage` : se toucher à UN étage suffit, même si
   les deux corps se recouvrent à d'autres — les morceaux d'un même corps
   qu'un solide importé a découpés (`import.js`). */
function touchent(a, b, etage){
  var e = ecartVols(a, b, null, 1);
  if(e >= -CONTACT && e <= CONTACT) return true;
  return !!etage && a.lv.some(function(x){
    var y = volEtage(b, x.i), d = y && ecart(volRect(a, x), volRect(b, y));
    return !!y && d >= -CONTACT && d <= CONTACT;
  });
}
function dansRepere(a, r){
  var c = Math.cos(a.a), s = Math.sin(a.a), dx = r.x - a.x, dy = r.y - a.y;
  return { u: dx * c + dy * s, v: -dx * s + dy * c };
}
function alignes(a, b){
  if(Math.abs(Math.sin(a.a - b.a)) > 1e-3) return null;
  /* les niveaux des deux corps : là où les deux en ont un, même profondeur,
     même alignement, et bout à bout ; là où un seul en a, le sien */
  var tous = {}, plan = [], bout = false;
  a.lv.concat(b.lv).forEach(function(e){ tous[e.i] = 1; });
  for(var i in tous){
    i = +i;
    var ea = a.lv.filter(function(e){ return e.i === i; })[0], eb = b.lv.filter(function(e){ return e.i === i; })[0];
    var ra = ea && volRect(a, ea), rb = eb && volRect(b, eb), pa = ra && dansRepere(a, ra), pb = rb && dansRepere(a, rb);
    if(ra && rb){
      if(Math.abs(ra.d - rb.d) > .05 || Math.abs(pa.v - pb.v) > .05) return null;
      if(Math.abs(Math.abs(pa.u - pb.u) - (ra.w + rb.w) / 2) > CONTACT) return null;
      bout = true;
      plan.push({ i:i, ea:ea, eb:eb, d0:ra.d, v:pa.v, g:Math.min(pa.u - ra.w / 2, pb.u - rb.w / 2), d:Math.max(pa.u + ra.w / 2, pb.u + rb.w / 2) });
    } else {
      var r = ra || rb, p = pa || pb;
      plan.push({ i:i, ea:ea, eb:eb, d0:r.d, v:p.v, g:p.u - r.w / 2, d:p.u + r.w / 2 });
    }
  }
  return bout ? plan : null;
}
export function fusionner(vols, ponts, etage){
  /* la ligne `fusion` du cadre choisi ; les morceaux d'un même corps importé
     (`etage`) se recollent toujours */
  if(!etage && !enVigueur("fusion")) return 0;
  if(!etage) recoller(vols);
  var m = 2 * RULES.haut.mur, faits = 0, encore = true;
  while(encore){
    encore = false;
    for(var i = 0; i < vols.length && !encore; i++) for(var j = i + 1; j < vols.length && !encore; j++){
      var a = vols[i], b = vols[j];
      if(a.ph || b.ph || a.fix || b.fix || !touchent(a, b, etage)) continue;
      var pl = alignes(a, b);
      if(pl){
        pl.forEach(function(p){
          var e = p.ea;
          if(!e){ e = Object.assign({}, p.eb); a.lv.push(e); }
          else if(p.eb && p.eb.keys) e.keys = (e.keys || []).concat(p.eb.keys);
          e.w = Math.max(.5, p.d - p.g - m); e.d = p.d0 - m; e.dx = (p.g + p.d) / 2; e.dy = p.v;
          delete e.w0; delete e.d0; delete e.dx0; delete e.dy0;
        });
      } else if(etage || !assembler(a, b, vols)) continue;
      a.lv.sort(function(p, q){ return p.i - q.i; });
      vols.forEach(function(o){ if(o.joint === b.id) o.joint = a.id; });
      if(!a.joint && b.joint) a.joint = b.joint;
      if(!a.bat && b.bat) a.bat = b.bat;
      (ponts || []).forEach(function(p){ if(p.a === b.id) p.a = a.id; if(p.b === b.id) p.b = a.id; });
      if(ponts) for(var q = ponts.length - 1; q >= 0; q--) if(ponts[q].a === ponts[q].b) ponts.splice(q, 1);
      vols.splice(j, 1); faits++; encore = true;
    }
  }
  /* un même bâtiment pour tout ce qui se touche encore */
  var grp = vols.map(function(v, k){ return k; });
  function chef(k){ while(grp[k] !== k) k = grp[k]; return k; }
  for(var x = 0; x < vols.length; x++) for(var y = x + 1; y < vols.length; y++){
    if(vols[x].ph || vols[y].ph || !touchent(vols[x], vols[y], etage)) continue;
    grp[chef(y)] = chef(x);
  }
  vols.forEach(function(v, k){
    var c = chef(k);
    if(c === k) return;
    var C = vols[c];
    if(!C.bat) C.bat = "b" + C.id;
    if(v.fix){ if(!v.joint) v.joint = C.id; }
    else v.bat = C.bat;
  });
  return faits;
}

/* ---------- le volume n'est pas qu'un rectangle ------------------------------
   Deux bâtiments à moins de `V.fusionDist` (1 m, la ligne `fusion` du cadre)
   l'un de l'autre, côtés parallèles ou en équerre, se RECOLLENT : l'un glisse
   jusqu'à toucher l'autre, s'il le peut sans rien recouvrir ni sortir du
   périmètre. Deux corps d'école qui se touchent alors s'ASSEMBLENT en un seul
   volume fait de plusieurs rectangles (`model.js — partsDe`) : à la jonction,
   les deux murs disparaissent et leur épaisseur entre dans le corps, comme
   bout à bout. La salle de sport, à sa hauteur et à ses cotes, reste un
   volume : elle se recolle et fait un même bâtiment. Tout se lit dans le
   repère de `a`. */
var TOL_ANGLE = 3 * Math.PI / 180;
function boite(a, o, p, mm){
  var c = Math.cos(o.a), s = Math.sin(o.a), wx = o.x + p.dx * c - p.dy * s, wy = o.y + p.dx * s + p.dy * c;
  var ca = Math.cos(a.a), sa = Math.sin(a.a), dx = wx - a.x, dy = wy - a.y;
  var u = dx * ca + dy * sa, v = -dx * sa + dy * ca, tr = Math.abs(Math.sin(o.a - a.a)) > .5;
  var hw = (tr ? p.d : p.w) / 2 + mm, hd = (tr ? p.w : p.d) / 2 + mm;
  return { x0:u - hw, x1:u + hw, y0:v - hd, y1:v + hd };
}
function boitesDe(a, o, e, mm){ return partsDe(e).map(function(p){ return boite(a, o, p, mm); }); }
/* le plus petit écart entre les emprises de deux volumes, côtés en regard */
function jeu(a, b){
  var best = null;
  a.lv.forEach(function(ea){
    var eb = volEtage(b, ea.i);
    if(!eb || lvlOf(ea.i) < 0) return;
    boitesDe(a, a, ea, RULES.haut.mur).forEach(function(A){
      boitesDe(a, b, eb, RULES.haut.mur).forEach(function(B){
        var oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0), ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        [[oy, B.x0 - A.x1, -1, 0], [oy, A.x0 - B.x1, 1, 0], [ox, B.y0 - A.y1, 0, -1], [ox, A.y0 - B.y1, 0, 1]]
          .forEach(function(c){
            if(c[0] > .5 && c[1] >= -CONTACT && (!best || c[1] < best.g))
              best = { g:c[1], u:c[2] * c[1], v:c[3] * c[1], du:c[2], dv:c[3] };
          });
      });
    });
  });
  return best;
}
function recoller(vols){
  var D = V.fusionDist == null ? 1 : V.fusionDist;
  for(var i = 0; i < vols.length; i++) for(var j = i + 1; j < vols.length; j++){
    var a = vols[i], b = vols[j], k = Math.round((b.a - a.a) / (Math.PI / 2));
    if(a.ph || b.ph || Math.abs(b.a - a.a - k * Math.PI / 2) > TOL_ANGLE) continue;
    if(ecartVols(a, b, null, D + 1) > D) continue;
    /* celui qui bouge : le second, sinon le premier, à l'angle de l'autre */
    [[b, a], [a, b]].some(function(x){
      var m = x[0], f = x[1], g0 = { x:m.x, y:m.y, a:m.a };
      m.a = f.a + Math.round((m.a - f.a) / (Math.PI / 2)) * Math.PI / 2;
      var J = jeu(f, m);
      if(J && Math.abs(J.g) > 1e-3 && J.g <= D){
        var c = Math.cos(f.a), s = Math.sin(f.a);
        /* `J` dit de combien m doit avancer vers f, dans le repère de f */
        m.x = m.x + J.u * c - J.v * s; m.y = m.y + J.u * s + J.v * c;
      }
      if(J && J.g <= D && dansPerimetre(m) && !chevauche(m, vols)) return true;
      m.x = g0.x; m.y = g0.y; m.a = g0.a;
      return false;
    });
  }
}
/* Deux corps d'école qui se touchent, en un volume : `b` avance de
   l'épaisseur des deux murs qui se faisaient face, ses intérieurs touchent
   ceux de `a`, et ses parts passent dans `a`, niveau par niveau. Rien ne
   s'allonge : chaque part garde ses cotes, donc sa surface et son module. Ne
   se fait que si `b`, ainsi avancé, ne recouvre ni un intérieur de `a` ni
   aucun autre volume, et reste dans le périmètre. */
function assembler(a, b, vols){
  if(a.lv.concat(b.lv).some(function(e){ return (e.keys && e.keys.length) || e.h; })) return false;
  if(Math.abs(Math.sin(2 * (a.a - b.a))) > 1e-3) return false;
  var J = jeu(a, b), M = 2 * RULES.haut.mur;
  if(!J || Math.abs(J.g) > CONTACT) return false;
  var c = Math.cos(a.a), s = Math.sin(a.a), k = J.g + M, ux = (J.du * c - J.dv * s) * k, uy = (J.du * s + J.dv * c) * k;
  function libre(m){
    return dansPerimetre(m) && !seRecouvrent() && !vols.some(function(o){
      return o !== a && o !== b && ecartVols(m, o, null, 1) < -CONTACT; });
  }
  /* `b` avance vers `a` ; s'il ne le peut pas, c'est `a` qui recule vers `b`.
     Les sous-sols ne bougent pas : ils ne sont pas du contact, et sous terre
     un volume se tient sous ses étages sans s'y aligner. */
  function bouger(m, dx, dy){
    m.x += dx; m.y += dy;
    var c2 = Math.cos(m.a), s2 = Math.sin(m.a);
    m.lv.forEach(function(e){
      if(lvlOf(e.i) >= 0) return;
      e.dx = (e.dx || 0) - (dx * c2 + dy * s2); e.dy = (e.dy || 0) - (-dx * s2 + dy * c2);
    });
  }
  bouger(b, ux, uy);
  if(!libre(b)){
    bouger(b, -ux, -uy); bouger(a, -ux, -uy);
    if(!libre(a)){ bouger(a, ux, uy); return false; }
  }
  function seRecouvrent(){
    return b.lv.some(function(eb){
      var ea = volEtage(a, eb.i);
      if(lvlOf(eb.i) < 0) return false;
      return ea && boitesDe(a, a, ea, 0).some(function(A){
        return boitesDe(a, b, eb, 0).some(function(B){
          return Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > .05 && Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > .05;
        });
      });
    });
  }
  b.lv.forEach(function(eb){
    var ea = volEtage(a, eb.i), B = boitesDe(a, b, eb, 0), R;
    if(ea) R = boitesDe(a, a, ea, 0).concat(B);
    else {
      var r0 = B[0];
      ea = Object.assign({}, eb, { w:r0.x1 - r0.x0, d:r0.y1 - r0.y0, dx:(r0.x0 + r0.x1) / 2, dy:(r0.y0 + r0.y1) / 2 });
      a.lv.push(ea);
      R = B;
    }
    ["w0", "d0", "dx0", "dy0"].forEach(function(x){ delete ea[x]; });
    ea.ext = R.slice(1).map(function(r){
      return { w:r.x1 - r.x0, d:r.y1 - r.y0, dx:(r.x0 + r.x1) / 2 - (ea.dx || 0), dy:(r.y0 + r.y1) / 2 - (ea.dy || 0) };
    });
  });
  return true;
}

/* PLUS RIEN NE SE RECOUVRE : un corps qui en recouvre un autre (un corps que
   les Typologies ont allongé, une composition relue) va à la position libre
   la plus proche, dans le périmètre — on cherche en couronnes de 0,5 m. La
   salle de sport, aux cotes imposées, ne bouge qu'en dernier recours. */
export function degager(vols){
  var bouges = 0;
  for(var t = 0; t < 3; t++){
    var fait = false;
    function libere(v){
      for(var r = .5; r <= 40; r += .5){
        var n = Math.max(8, Math.round(2 * Math.PI * r / .5));
        for(var k = 0; k < n; k++){
          var x = v.x + r * Math.cos(2 * Math.PI * k / n), y = v.y + r * Math.sin(2 * Math.PI * k / n);
          if(dansPerimetre(v, x, y, v.a) && !chevauche(v, vols, x, y, v.a)){
            v.x = Math.round(x * 10) / 10; v.y = Math.round(y * 10) / 10; return true;
          }
        }
      }
      return false;
    }
    vols.forEach(function(v){
      if(!chevauche(v, vols)) return;
      var o = vols.filter(function(x){ return x !== v && ecartVols(v, x, null, 1) < -CONTACT; })[0];
      if(v.fix && o && !o.fix && !o.ph) return;           /* c'est l'autre qui bouge d'abord */
      if(libere(v) || (o && libere(o))){ bouges++; fait = true; }
    });
    if(!fait) break;
  }
  return bouges;
}

/* POSER UNE VOLUMÉTRIE, par où qu'elle vienne — un tirage, la proposition
   suivante, un remède : rien ne se recouvre, ce qui se touche ne fait qu'un,
   puis les leviers d'architecture habillent les corps. Un seul chemin, pour
   que toutes les volumétries à l'écran obéissent aux mêmes règles. */
export function poser(list){
  massVols(list || []);
  if(!MASS.vol.length) return;
  degager(MASS.vol); fusionner(MASS.vol, MASS.pont);
  architecturer(MASS.vol, MASS.lev, MASS.graine, function(v){ return dansPerimetre(v) && !chevauche(v, MASS.vol); });
}
