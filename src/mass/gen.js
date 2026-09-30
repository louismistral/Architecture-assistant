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
import { V, courExigee, recul, reculVise } from "../data/cadre.js";
import { distVisee, ombreVisee, preference } from "../data/orientation.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { areaOf, lvlOf, onFloor } from "../mix/floors.js";
import {
  assise, attracteurs, axePer, bbox, bordDist, dedans, airePosable,
  ecart, ecartAngle, ecartPoly, margeAu, terrain, tientA, visAVis
} from "./geom.js";
import { CONTACT, MASS, auModule, horsSol, lies, pontRect, profBornes, profFacade, secondTemps,
  sousSol, volEtage, volRect } from "./model.js";
export { lies };
import { angleSoleilVue, courUtile, ecarts, ensembles, evaluer, lecture, oublier }
  from "./mesures.js";
import { PARTIS_FIGURES, composer } from "./partis.js";

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
   Les bâtiments existants qui touchent le périmètre : ce sont eux que l'on ne
   peut pas percuter, et dont l'AEAI veut qu'on s'écarte. Ceux du coteau, à
   cent mètres, ne gênent personne. */
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
  cand.forEach(function(c){ c.o = r() - (bout && c.bout ? 1 : 0); });
  cand.sort(function(a, b){ return a.o - b.o; });
  var av = { x:sp.x, y:sp.y, a:sp.a };
  sp.joint = M.id;
  var c = Math.cos(M.a), sn = Math.sin(M.a);
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
        return o !== A && o !== B && ecart(rc, rectSol(o)) < .5; });
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
  if(MASS.second === "non") return;
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
  cand.sort(function(p, q2){ return p[2] - q2[2]; });
  var angles = [v.a, v.a + Math.PI / 2, v.a + Math.PI / 4, v.a - Math.PI / 4];
  for(k = 0; k < angles.length; k++){
    for(var i = 0; i < cand.length; i++){
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
   pas : tous les étages dans le périmètre, recul du PACom compris ; la distance
   minimale entre bâtiments à TOUS les étages hors sol — ce qui interdit aussi
   de surmonter la salle de sport ; rien sur l'existant ni trop près de lui.
   Deux corps ACCOLÉS (`joint`) font un seul bâtiment : ils se touchent sans se
   recouvrir. */
export function rectsHors(v, P){
  var Q = P || v, out = [];
  v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) out.push(volRect(Q, e)); });
  if(!out.length && v.lv[0]) out.push(volRect(Q, v.lv[0]));
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
export function admissible(v, vols, x, y, a){
  var P = { x: x == null ? v.x : x, y: y == null ? v.y : y, a: a == null ? v.a : a };
  var i, j;
  for(i = 0; i < v.lv.length; i++)
    if(!tientA(PER, volRect(P, v.lv[i]), recul() - .01)) return false;
  for(i = 0; i < vols.length; i++){
    var o = vols[i];
    if(o === v) continue;
    /* Deux parties d'un même bâtiment ne se recouvrent pas ; deux bâtiments se
       tiennent à la distance minimale. */
    var e = ecartVols(v, o, P, RULES.dist.entre);
    if(e < RULES.dist.entre - .01 && !(lies(v, o) && e >= -CONTACT)) return false;
  }
  var H = rectsHors(v, P);
  for(i = 0; i < H.length; i++){
    var OB = obstaclesPres(H[i], RULES.dist.entre);
    for(j = 0; j < OB.length; j++)
      if(ecartPoly(H[i], OB[j]) < RULES.dist.entre - .01) return false;
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
  var cible = Math.max(RULES.dist.entre, distVisee()) + .35;
  var N = horsSol(), HN = {};
  N.forEach(function(n){ HN[n.i] = n.h; });
  var HV = vols.map(function(v){
    var h = 0;
    v.lv.forEach(function(e){ if(HN[e.i] !== undefined) h += HN[e.i]; });
    return h;
  });
  var DOUX = .45, MARGE_JOUR = .4;
  for(pas = 0; pas < 60; pas++){
    var bouge = 0;
    for(i = 0; i < vols.length; i++){
      var v = vols[i], rc = rectSol(v), dx = 0, dy = 0;
      var pire = Infinity;
      v.lv.forEach(function(e){ pire = Math.min(pire, margeAu(PER, volRect(v, e))); });
      var m = pire - RV - .3;
      if(m < 0){
        var k = Math.min(3, -m) * .55;
        var lx = B.cx - v.x, ly = B.cy - v.y, l = Math.hypot(lx, ly) || 1;
        dx += lx / l * k; dy += ly / l * k;
      }
      for(j = 0; j < vols.length; j++){
        if(j === i || lies(v, vols[j])) continue;
        var o = rectSol(vols[j]);
        var e = ecart(rc, o);
        var jour = visAVis(rc, o) > 8 ? Math.max(HV[i], HV[j]) * OK : 0;
        var vise = Math.max(cible, Math.min(jour + MARGE_JOUR, cible + 14));
        if(e < vise){
          var ox = v.x - vols[j].x, oy = v.y - vols[j].y, ol = Math.hypot(ox, oy) || 1;
          var dur = Math.max(0, Math.min(cible, vise) - e);
          var mou = Math.max(0, vise - Math.max(e, cible));
          var push = Math.min(3, dur * .5 + mou * DOUX * .5);
          dx += ox / ol * push; dy += oy / ol * push;
        }
      }
      var OB = obstaclesPres(rc, cible);
      for(j = 0; j < OB.length; j++){
        var eb = ecartPoly(rc, OB[j]);
        if(eb < cible){
          var c2 = centre(OB[j]);
          var bx = v.x - c2[0], by = v.y - c2[1], bl = Math.hypot(bx, by) || 1;
          var pb = Math.min(3, (cible - eb)) * .6;
          dx += bx / bl * pb; dy += by / bl * pb;
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
   elle se pose à part. Ses cotes ne bougent pas. */
function placerSport(vols, imp, r, th){
  var sp = { id:"vsport", x:0, y:0, a:th, fix:1, ancre:1, key:imp.key, prof:imp.d, grad:0,
             lv:[{ i:imp.i, w:imp.w, d:imp.d, dx:0, dy:0, a:imp.aire, keys:[imp.key] }] };
  vols.push(sp);
  var E = vols.filter(function(v){ return !v.fix && !v.ph; });
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
/* L'orientation d'une figure — un LEVIER : l'axe du périmètre, l'optimum
   soleil-vue, ou un angle libre autour de l'axe ; libre, l'une des trois à
   parts égales. Les terrasses suivent les courbes : leurs rangs descendent la
   pente (le +v de la figure va vers l'aval). */
function orientation(pid, r, centreSite){
  if(pid === "terrasses") return aval() - Math.PI / 2;
  var m = levier("cap", ["axe", "soleil", "libre"], r);
  if(m === "axe") return axePer();
  if(m === "soleil") return angleSoleilVue(centreSite.cx, centreSite.cy);
  return axePer() + entre(r, -.7, .7);
}

/* ---------- le tirage massing ------------------------------------------------
   Générer, valider, comparer, choisir — dans cet ordre. En « Auto », chaque
   parti est reconnu ; ceux qui rendent au moins une variante valide reçoivent
   la suite des essais. Quand aucune variante ne tient, RIEN n'est proposé : le
   résultat est vide, marqué `impossible`, et le contrôle dit quoi faire. */
export function genMass(graine){
  var g = graine == null ? MASS.graine : graine;
  var r = alea(g);
  var N = horsSol();
  if(!N.length) return [];
  oublier();
  var imp = corpsImpose(N[0].i);
  if(imp) imp.i = N[0].i;
  var partis = MASS.parti === "auto" ? PARTIS_LIBRES : [MASS.parti];
  var B = profBornes(), hiE = Math.max(B.lo, Math.min(B.hi, profFacade()));
  var centreSite = bbox(PER);
  var valides = [], rates = [], nEssais = 0;

  /* L'aire bâtie d'école par niveau hors sol : ce que la figure doit loger. */
  var Aecole = N.map(function(n, k){ return Math.max(0, n.A - (imp && k === 0 ? imp.aire : 0)); });

  /* UN ESSAI, dans l'ordre voulu : 1. les LEVIERS — le parti construit sa
     figure, le programme lui donne ses étages et ses emprises (dans
     `composer`), la figure est posée d'un bloc, puis la salle de sport, le
     sous-sol, les passerelles ; 2. le CADRE — tout entier — décide si elle
     entre dans les résultats ; 3. l'ORIENTATION ne départage qu'ensuite. */
  function essai(pid){
    nEssais++;
    /* La profondeur — un levier : fixée, la nôtre ; libre, tirée sous la cote
       de façade, pleine pour une barre et un bloc compact, plus mince pour des
       pavillons et un hameau. */
    var p0 = B.lo, p1 = hiE;
    if(pid === "barre" || pid === "compact") p0 = Math.max(B.lo, hiE - 3);
    if(pid === "pavillons" || pid === "hameau") p1 = Math.max(B.lo, Math.min(hiE, B.lo + 5));
    var fixe = MASS.lev.prof;
    var prof = fixe != null ? auModule(Math.max(B.lo, Math.min(hiE, fixe - 2 * RULES.haut.mur)))
                            : auModule(entre(r, p0, p1)), vols;
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
    }
    vols.parti = pid; vols.prof = prof;
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
  var n0 = valides.length, props = [];
  retenir(valides, partis.length > 1, r).forEach(function(c){
    poserSecond(c.vols, r);
    if(ecarts(c.vols, false).length) retirerSecond(c.vols);
    if(ecarts(c.vols, false).length) return;
    var ev = evaluer(c.vols);
    c.vols.score = ev.jugement.total;
    c.vols.pref = c.pref;
    c.vols.valides = n0; c.vols.essais = nEssais;
    props.push(c.vols);
  });
  props.sort(function(a, b){ return (b.score || 0) - (a.score || 0); });
  if(props.length){
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
  var big = cand[0], bz = assise(rectSol(cand[0])).z, i;
  for(i = 1; i < cand.length; i++){
    var z = assise(rectSol(cand[i])).z;
    if(z > bz + .15 || (Math.abs(z - bz) <= .15
        && rectSol(cand[i]).w * rectSol(cand[i]).d > rectSol(big).w * rectSol(big).d)){
      bz = Math.max(bz, z); big = cand[i];
    }
  }
  /* Le sous-sol se loge sous le corps le plus haut, et sous les suivants quand
     il dépasse ce qu'un volume peut avoir : chaque part garde la profondeur de
     son corps et reste sous la cote maximale. */
  var ordre = cand.slice().sort(function(a, b){
    return assise(rectSol(b)).z - assise(rectSol(a)).z; });
  ordre.splice(ordre.indexOf(big), 1); ordre.unshift(big);
  S.forEach(function(n){
    var reste = n.A, k = 0;
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
