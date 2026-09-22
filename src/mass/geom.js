/* ============================================================================
   GÉOMÉTRIE DU MASSING — RECTANGLES, POLYGONES, TERRAIN

   Tout ce que la volumétrie demande à la géométrie, et rien de plus : un
   volume est un RECTANGLE TOURNÉ, parce qu'un bâtiment scolaire l'est presque
   toujours et parce qu'une surface de programme se pose exactement dans un
   rectangle — largeur × profondeur, à surface exacte, comme le veut la règle
   première du projet.

   Le terrain n'est plus un plan incliné : `SITE.grid` donne les altitudes
   relevées au pas de quatre mètres, et `terrain()` les interpole. Un bâtiment
   posé dessus ne flotte plus et ne s'enterre plus.

   Aucune règle de concours ici — elles sont dans `src/data/rules.js` ; aucune
   mesure non plus — elles sont dans `src/data/site.js`.
   ========================================================================= */
import { PER, SITE } from "../data/site.js";

/* ---------- le terrain ----------------------------------------------------- */
/* Altitude au point (x, y), interpolée bilinéairement dans la grille du
   relevé. Hors grille, on se rabat sur le bord : le coteau continue, mais nous
   ne l'avons pas mesuré. */
export function terrain(x, y){
  var g = SITE.grid;
  if(!g) return SITE.z[0] + SITE.z[1] * x + SITE.z[2] * y;
  var fx = (x - g.x0) / g.pas, fy = (y - g.y0) / g.pas;
  var i = Math.floor(fx), j = Math.floor(fy);
  if(i < 0) i = 0; if(i > g.nx - 2) i = g.nx - 2;
  if(j < 0) j = 0; if(j > g.ny - 2) j = g.ny - 2;
  var tx = fx - i, ty = fy - j;
  if(tx < 0) tx = 0; if(tx > 1) tx = 1;
  if(ty < 0) ty = 0; if(ty > 1) ty = 1;
  return g.zsol + (grille(g, i, j) * (1 - tx) * (1 - ty)
                 + grille(g, i + 1, j) * tx * (1 - ty)
                 + grille(g, i, j + 1) * (1 - tx) * ty
                 + grille(g, i + 1, j + 1) * tx * ty) / 100;
}
/* Le relevé garde ses altitudes en centimètres entiers au-dessus de `zsol` :
   au décimètre, le terrain se terrassait de lui-même — une marche tous les sept
   mètres sur une pente à 1,5 %, et le maillage les montrait toutes. */
export function grille(g, i, j){ return g.zc[i][j]; }
/* L'altitude à laquelle poser un volume : la MOYENNE du terrain sous son
   emprise, et non l'altitude de son centre. Un bâtiment de quarante mètres
   posé sur son centre s'enterre d'un côté et flotte de l'autre. On rend aussi
   les extrêmes : c'est ce qui dit s'il faut terrasser. */
export function assise(rc){
  var q = coins(rc), n = 0, s = 0, lo = Infinity, hi = -Infinity, i, j;
  for(i = 0; i <= 4; i++){
    for(j = 0; j <= 4; j++){
      var p = lerpQuad(q, i / 4, j / 4), z = terrain(p[0], p[1]);
      s += z; n++;
      if(z < lo) lo = z;
      if(z > hi) hi = z;
    }
  }
  return { z: s / n, lo: lo, hi: hi, d: hi - lo };
}
function lerpQuad(q, u, v){
  var a = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
  var b = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
  return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v];
}

/* ---------- rectangles tournés ---------------------------------------------
   Un rectangle est { x, y, w, d, a } : centre, largeur, profondeur, angle.
   Ses quatre coins tournent dans le sens direct, en commençant au coin
   « avant-gauche » — l'ordre importe pour le dessin comme pour l'extrusion. */
export function coins(rc){
  var c = Math.cos(rc.a), s = Math.sin(rc.a);
  var hw = rc.w / 2, hd = rc.d / 2;
  return [
    [rc.x - hw * c + hd * s, rc.y - hw * s - hd * c],
    [rc.x + hw * c + hd * s, rc.y + hw * s - hd * c],
    [rc.x + hw * c - hd * s, rc.y + hw * s + hd * c],
    [rc.x - hw * c - hd * s, rc.y - hw * s + hd * c]
  ];
}
/* Du repère du bâtiment vers le site : un décalage d'étage (porte-à-faux,
   retrait, terrasse) se pense dans l'axe du volume, pas dans celui du nord. */
export function local(rc, dx, dy){
  var c = Math.cos(rc.a), s = Math.sin(rc.a);
  return { x: rc.x + dx * c - dy * s, y: rc.y + dx * s + dy * c,
           w: rc.w, d: rc.d, a: rc.a };
}
export function aire(rc){ return rc.w * rc.d; }

/* ---------- polygones ------------------------------------------------------ */
export function dedans(poly, x, y){
  var n = poly.length, ok = false, i, j;
  for(i = 0, j = n - 1; i < n; j = i++){
    var a = poly[i], b = poly[j];
    if(((a[1] > y) !== (b[1] > y))
       && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ok = !ok;
  }
  return ok;
}
export function bbox(poly){
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  poly.forEach(function(p){
    if(p[0] < x0) x0 = p[0];
    if(p[0] > x1) x1 = p[0];
    if(p[1] < y0) y0 = p[1];
    if(p[1] > y1) y1 = p[1];
  });
  return { x0:x0, y0:y0, x1:x1, y1:y1, w:x1 - x0, h:y1 - y0,
           cx:(x0 + x1) / 2, cy:(y0 + y1) / 2 };
}
export function airePoly(poly){
  var a = 0, i;
  for(i = 0; i < poly.length; i++){
    var p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}
/* Distance d'un point au bord d'un polygone — signée : positive dedans. C'est
   elle qui dit le recul sur le périmètre, sans avoir à décaler le polygone. */
export function bordDist(poly, x, y){
  var best = Infinity, i;
  for(i = 0; i < poly.length; i++){
    var a = poly[i], b = poly[(i + 1) % poly.length];
    var d = segDist(x, y, a[0], a[1], b[0], b[1]);
    if(d < best) best = d;
  }
  return dedans(poly, x, y) ? best : -best;
}
export function segDist(px, py, ax, ay, bx, by){
  var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
  var t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  if(t < 0) t = 0; if(t > 1) t = 1;
  var dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}
/* Le retrait d'un rectangle sur le périmètre : la plus petite marge de ses
   quatre coins ET de ses bords échantillonnés. Un rectangle dont les coins
   sont dedans peut avoir un côté qui sort par une encoche du périmètre. */
export function margeAu(poly, rc){
  var q = coins(rc), best = Infinity, i, k;
  for(i = 0; i < 4; i++){
    var a = q[i], b = q[(i + 1) % 4];
    var n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    for(k = 0; k <= n; k++){
      var t = k / n;
      var d = bordDist(poly, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      if(d < best) best = d;
    }
  }
  return best;
}

/* Ce que la parcelle peut PORTER : l'aire où un point est à plus du recul de
   la limite. Ce n'est pas l'aire du périmètre — 12'781 m² —, et c'est cette
   différence qui dit si un niveau tient. Échantillonnée au pas de deux mètres,
   calculée une fois. */
var POSABLE = 0;
export function airePosable(recul){
  if(POSABLE) return POSABLE;
  var B = bbox(PER), n = 0, x, y, PAS = 2;
  for(x = B.x0; x <= B.x1; x += PAS)
    for(y = B.y0; y <= B.y1; y += PAS)
      if(bordDist(PER, x, y) >= recul) n++;
  POSABLE = n * PAS * PAS;
  return POSABLE;
}

/* ---------- séparation de deux rectangles ----------------------------------
   Axe séparateur (SAT) : la distance entre deux rectangles tournés, négative
   quand ils se recouvrent. C'est la mesure que demandent les 6 m de l'AEAI, et
   celle qui dit qu'un volume en percute un autre. */
export function ecart(r1, r2){
  var A = coins(r1), B = coins(r2);
  var axes = [
    [Math.cos(r1.a), Math.sin(r1.a)], [-Math.sin(r1.a), Math.cos(r1.a)],
    [Math.cos(r2.a), Math.sin(r2.a)], [-Math.sin(r2.a), Math.cos(r2.a)]
  ];
  var best = -Infinity, i;
  for(i = 0; i < axes.length; i++){
    var ax = axes[i];
    var a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, k;
    for(k = 0; k < 4; k++){
      var pa = A[k][0] * ax[0] + A[k][1] * ax[1];
      var pb = B[k][0] * ax[0] + B[k][1] * ax[1];
      if(pa < a0) a0 = pa; if(pa > a1) a1 = pa;
      if(pb < b0) b0 = pb; if(pb > b1) b1 = pb;
    }
    var d = Math.max(b0 - a1, a0 - b1);
    if(d > best) best = d;
  }
  return best;
}
/* Recouvrement d'un rectangle et d'un polygone quelconque — l'emprise d'un
   bâtiment existant, par exemple. Approché par les coins et le centre : il ne
   s'agit pas de mesurer, mais de dire qu'il y a choc. */
export function heurte(rc, poly){
  var q = coins(rc), i, k;
  for(i = 0; i < 4; i++) if(dedans(poly, q[i][0], q[i][1])) return true;
  for(i = 0; i < poly.length; i++) if(dansRect(rc, poly[i][0], poly[i][1])) return true;
  for(i = 0; i < 4; i++){
    var a = q[i], b = q[(i + 1) % 4];
    for(k = 0; k < poly.length; k++){
      var c = poly[k], d = poly[(k + 1) % poly.length];
      if(croise(a, b, c, d)) return true;
    }
  }
  return false;
}
export function dansRect(rc, x, y){
  var c = Math.cos(-rc.a), s = Math.sin(-rc.a);
  var dx = x - rc.x, dy = y - rc.y;
  var u = dx * c - dy * s, v = dx * s + dy * c;
  return Math.abs(u) <= rc.w / 2 && Math.abs(v) <= rc.d / 2;
}
function croise(p1, p2, p3, p4){
  function d(a, b, c){ return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
  var d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
/* Distance d'un rectangle à une emprise existante : zéro s'il la touche. */
export function ecartPoly(rc, poly){
  if(heurte(rc, poly)) return -1;
  var q = coins(rc), best = Infinity, i, k;
  for(i = 0; i < 4; i++){
    for(k = 0; k < poly.length; k++){
      var a = poly[k], b = poly[(k + 1) % poly.length];
      var dd = segDist(q[i][0], q[i][1], a[0], a[1], b[0], b[1]);
      if(dd < best) best = dd;
    }
  }
  return best;
}

/* ---------- le périmètre, et son axe ----------------------------------------
   Le périmètre du concours n'est ni un carré ni orienté au nord : il file au
   nord-est. Son AXE PRINCIPAL — celui de sa plus longue paire de côtés — est
   la direction à laquelle tout s'alignera par défaut, et les angles proposés
   au générateur s'y rapportent. */
export function axePer(){
  var best = 0, bl = 0, i;
  for(i = 0; i < PER.length - 1; i++){
    var a = PER[i], b = PER[i + 1];
    var l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if(l > bl){ bl = l; best = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  /* Ramené dans [−π/2, π/2] : un bâtiment n'a pas d'avant ni d'arrière ici. */
  while(best > Math.PI / 2) best -= Math.PI;
  while(best < -Math.PI / 2) best += Math.PI;
  return best;
}
/* Les directions auxquelles un bâtiment PEUT s'aligner, avec ce qu'elles
   valent. Ce ne sont pas des règles : le générateur les préfère, il ne s'y
   soumet pas — un projet libre reste possible, et c'est voulu. */
export function attracteurs(){
  var out = [{ a: axePer(), w: 1, n: "l’axe du périmètre" },
             { a: axePer() + Math.PI / 2, w: .8, n: "perpendiculaire au périmètre" },
             { a: 0, w: .55, n: "est-ouest" },
             { a: Math.PI / 2, w: .55, n: "nord-sud" }];
  /* Les longues limites du périmètre et les routes : un bâtiment qui s'y
     range tient au site plutôt qu'à la feuille. */
  var lim = [], i;
  for(i = 0; i < PER.length - 1; i++){
    var a = PER[i], b = PER[i + 1];
    var l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if(l > 30) lim.push({ a: Math.atan2(b[1] - a[1], b[0] - a[0]), w: .7, n: "une limite de parcelle" });
  }
  (SITE.rou || []).forEach(function(R){
    for(var k = 0; k < R.length - 1; k++){
      var p = R[k], q = R[k + 1];
      if(Math.hypot(q[0] - p[0], q[1] - p[1]) > 40)
        lim.push({ a: Math.atan2(q[1] - p[1], q[0] - p[0]), w: .5, n: "une route" });
    }
  });
  return out.concat(lim).map(function(d){
    var a = d.a;
    while(a > Math.PI / 2) a -= Math.PI;
    while(a < -Math.PI / 2) a += Math.PI;
    return { a: a, w: d.w, n: d.n };
  });
}
/* L'attracteur le plus proche d'un angle, et l'écart qui l'en sépare. */
export function alignement(ang, atts){
  var best = null, bd = Infinity;
  atts.forEach(function(d){
    var e = Math.abs(ecartAngle(ang, d.a));
    if(e < bd){ bd = e; best = d; }
  });
  return { att: best, ecart: bd };
}
export function ecartAngle(a, b){
  var d = (a - b) % Math.PI;
  if(d > Math.PI / 2) d -= Math.PI;
  if(d < -Math.PI / 2) d += Math.PI;
  return d;
}
