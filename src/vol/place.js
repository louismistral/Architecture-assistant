/* ============================================================================
   GÉOMÉTRIE DU SITE ET IMPLANTATION
   Poser une boîte sur le terrain : terrain naturel, appartenance au périmètre,
   recul, distance entre volumes, recherche de place.

   Ces fonctions vivaient dans `volumes.js`, qui est la VUE. Le générateur de
   volumétrie en a besoin lui aussi, et la vue importe le générateur : les
   sortir ici casse le cycle et rend la règle d'implantation vérifiable seule.
   ========================================================================= */
import { RULES } from "../data/rules.js";
import { PER, SITE, VANG } from "../data/site.js";

/* Le relevé est une régression plane sur les courbes de niveau : l'altitude du
   terrain naturel est affine en x et y. */
export function terrain(x, y){ return SITE.z[0] + SITE.z[1] * x + SITE.z[2] * y; }

/* Point bas du terrain, origine des hauteurs pour la vue 3D. */
export var ZBAS = 463.3;

export function inPer(x, y){
  var c = false, n = PER.length;
  for(var i = 0; i < n; i++){
    var a = PER[i], b = PER[(i + 1) % n];
    if((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1] + 1e-12) + a[0]) c = !c;
  }
  return c;
}
export function dSeg(px0, py0, a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  var t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((px0 - a[0]) * dx + (py0 - a[1]) * dy) / L2));
  return Math.hypot(px0 - (a[0] + t * dx), py0 - (a[1] + t * dy));
}
export function clearPer(x, y){
  var m = 1e9;
  for(var i = 0; i < PER.length; i++) m = Math.min(m, dSeg(x, y, PER[i], PER[(i + 1) % PER.length]));
  return m;
}
export function perBox(){
  var xs = PER.map(function(p){ return p[0]; }), ys = PER.map(function(p){ return p[1]; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  return { x0:x0, x1:x1, y0:y0, y1:y1, cx:(x0 + x1) / 2, cy:(y0 + y1) / 2 };
}

/* Un volume est un rectangle w × h posé en (x, y) et tourné de l'angle du
   terrain : ses quatre coins, dans l'ordre. */
export function vcorners(v, x, y){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  x = (x === undefined) ? v.x : x; y = (y === undefined) ? v.y : y;
  return [[0,0],[v.w,0],[v.w,v.h],[0,v.h]].map(function(u){
    return [x + u[0] * ca - u[1] * sa, y + u[0] * sa + u[1] * ca];
  });
}
/* Coordonnées locales → monde, pour tout point intérieur au volume. */
export function vpt(v, u, t){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  return [v.x + u * ca - t * sa, v.y + u * sa + t * ca];
}
export function vmid(v){
  var C = vcorners(v);
  return [(C[0][0] + C[2][0]) / 2, (C[0][1] + C[2][1]) / 2];
}
export function volFits(v, x, y){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var N = Math.max(2, Math.round(v.w / 4)), M = Math.max(2, Math.round(v.h / 4));
  for(var i = 0; i <= N; i++) for(var j = 0; j <= M; j++){
    if(i !== 0 && i !== N && j !== 0 && j !== M) continue;
    var u = v.w * i / N, t = v.h * j / M;
    var px0 = x + u * ca - t * sa, py0 = y + u * sa + t * ca;
    if(!inPer(px0, py0) || clearPer(px0, py0) < RULES.dist.retrait) return false;
  }
  return true;
}
/* Écart entre deux boîtes, mesuré dans le repère de la première : elles ont le
   même angle, la comparaison d'étendues suffit. */
export function volGap(v, x, y, o){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  function loc(p){ var dx = p[0] - x, dy = p[1] - y; return [dx * ca + dy * sa, -dx * sa + dy * ca]; }
  var A = vcorners(v, x, y).map(loc), B = vcorners(o).map(loc);
  function ext(P, k){ return [Math.min(P[0][k],P[1][k],P[2][k],P[3][k]), Math.max(P[0][k],P[1][k],P[2][k],P[3][k])]; }
  var au = ext(A,0), av = ext(A,1), bu = ext(B,0), bv = ext(B,1);
  var du = Math.max(0, Math.max(au[0] - bu[1], bu[0] - au[1]));
  var dv = Math.max(0, Math.max(av[0] - bv[1], bv[0] - av[1]));
  return Math.max(du, dv);
}
/* Profondeur de recouvrement entre deux boîtes de même angle : 0 quand elles
   sont disjointes ou seulement jointives. Deux volumes qui se touchent — une
   cour bordée par ses ailes — ne se recouvrent pas. */
export function volOver(v, x, y, o){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  function loc(p){ var dx = p[0] - x, dy = p[1] - y; return [dx * ca + dy * sa, -dx * sa + dy * ca]; }
  var A = vcorners(v, x, y).map(loc), B = vcorners(o).map(loc);
  function ext(P, k){ return [Math.min(P[0][k],P[1][k],P[2][k],P[3][k]), Math.max(P[0][k],P[1][k],P[2][k],P[3][k])]; }
  var au = ext(A,0), av = ext(A,1), bu = ext(B,0), bv = ext(B,1);
  var du = Math.min(au[1], bu[1]) - Math.max(au[0], bu[0]);
  var dv = Math.min(av[1], bv[1]) - Math.max(av[0], bv[0]);
  return (du > 0 && dv > 0) ? Math.min(du, dv) : 0;
}

/* La place la plus proche du centre du périmètre où le volume tient
   entièrement, à distance des limites et des volumes déjà posés. */
export function volFindSpot(v, placed, sep){
  var B = perBox();
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var best = null, bd = 1e9, gx, gy, i;
  for(gy = B.y0; gy <= B.y1; gy += 3) for(gx = B.x0; gx <= B.x1; gx += 3){
    var d = (gx - B.cx) * (gx - B.cx) + (gy - B.cy) * (gy - B.cy);
    if(d >= bd) continue;
    var ox = gx - (v.w / 2 * ca - v.h / 2 * sa);
    var oy = gy - (v.w / 2 * sa + v.h / 2 * ca);
    if(!volFits(v, ox, oy)) continue;
    var ok = true;
    for(i = 0; i < placed.length; i++) if(volGap(v, ox, oy, placed[i]) < sep){ ok = false; break; }
    if(!ok) continue;
    bd = d; best = { x: Math.round(ox * 2) / 2, y: Math.round(oy * 2) / 2 };
  }
  return best;
}
/* Les niveaux d'un même bâtiment se superposent : ils reçoivent tous le centre
   que le plus grand d'entre eux trouve dans le périmètre. */
export function volPlaceLinked(list){
  if(!list.length) return list;
  var B = perBox(), cx = B.cx, cy = B.cy;
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var big = list[0];
  list.forEach(function(v){ if(v.w * v.h > big.w * big.h) big = v; });
  var sp = volFindSpot(big, [], 0);
  if(sp){ cx = sp.x + (big.w / 2 * ca - big.h / 2 * sa); cy = sp.y + (big.w / 2 * sa + big.h / 2 * ca); }
  list.forEach(function(v){
    v.x = Math.round((cx - (v.w / 2 * ca - v.h / 2 * sa)) * 2) / 2;
    v.y = Math.round((cy - (v.w / 2 * sa + v.h / 2 * ca)) * 2) / 2;
  });
  return list;
}
