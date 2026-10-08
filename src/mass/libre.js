/* ============================================================================
   LES CORPS LIBRES — un solide de Rhino, tel qu'il est

   Un massing dessiné à la main revient de Rhino EXACT : chaque solide devient un
   corps `libre`, son contour hors tout, son plancher à son altitude, sa hauteur,
   son chapitre — rien n'est empilé, fusionné, recoté ni reposé sur le terrain
   (`docs/superpowers/specs/2026-10-08-corps-libres-design.md`).

   Ce module ne fait que de la géométrie, sans état :
     prisme(T)        des triangles → un prisme droit : z0, z1, le contour ;
     rentrer(P, m)    le contour rentré de l'épaisseur du mur : l'intérieur ;
     decouper(I)      l'intérieur en rectangles, CHACUN DANS SON AXE — exact pour
                      toute forme orthogonale, en autant d'orientations qu'on veut ;
     trianguler(P)    les faces d'un polygone quelconque (par oreilles), pour la
                      3D et l'export.
   Le polygone dit la forme (contour, aire, dessin) ; les rectangles servent à ce
   qui raisonne en rectangles (distances, recul, plans des Typologies).
   ========================================================================= */
import { airePoly, dedans } from "./geom.js";

var TOL = .05;       /* m : deux altitudes plus proches sont la même */
var ALIGNE = .01;    /* m : un sommet à moins de ça de la droite de ses voisins est sur un côté */
var MIETTE = 1;      /* m : un rectangle plus étroit est un reste de découpe */
var BRUIT = .02;     /* m : le jeu d'un dessin à la main — deux cotes plus proches sont la même */

function normale(t){
  var ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
  var vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}
function cle(p){ return Math.round(p[0] * 1000) + "," + Math.round(p[1] * 1000); }
/* signé : positif dans le sens direct */
function aireS(P){
  var a = 0;
  for(var i = 0; i < P.length; i++){ var p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
/* Les sommets posés sur le côté de leurs voisins ne sont pas des sommets. */
export function sansAlignes(P){
  var Q = P.slice(), ok = false;
  while(!ok && Q.length > 3){
    ok = true;
    for(var i = 0; i < Q.length; i++){
      var a = Q[(i - 1 + Q.length) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length];
      var L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      var h = L ? Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / L : 0;
      if(h < ALIGNE){ Q.splice(i, 1); ok = false; break; }
    }
  }
  return Q;
}

/* ---------- 1. des triangles → un prisme droit -------------------------------
   Toutes les faces horizontales ou verticales, les horizontales au pied ou à la
   tête : sinon ce n'est pas un prisme (un toit en pente), et l'on rend null. Le
   contour : les arêtes du dessus qui ne servent qu'à un triangle, chaînées ; la
   plus grande boucle est le contour extérieur, sens direct. */
export function prisme(T){
  var z0 = Infinity, z1 = -Infinity, k;
  for(k = 0; k < T.length; k++) T[k].forEach(function(p){ z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); });
  if(!(z1 - z0 > .5)) return null;
  var E = {};
  for(k = 0; k < T.length; k++){
    var t = T[k], c = normale(t), m = Math.hypot(c[0], c[1], c[2]);
    if(m < 1e-9) continue;
    var nz = Math.abs(c[2]) / m;
    if(nz > .001 && nz < .999) return null;
    if(nz <= .001) continue;
    var haut = t.every(function(p){ return Math.abs(p[2] - z1) < TOL; });
    if(!haut){
      if(t.every(function(p){ return Math.abs(p[2] - z0) < TOL; })) continue;
      return null;
    }
    t.forEach(function(p, n){
      var q = t[(n + 1) % 3], a = cle(p), b = cle(q), id = a < b ? a + "|" + b : b + "|" + a;
      if(E[id]) E[id].n++; else E[id] = { n:1, p:[p[0], p[1]], q:[q[0], q[1]] };
    });
  }
  var S = [];
  for(k in E) if(E[k].n === 1) S.push([E[k].p, E[k].q]);
  if(S.length < 3) return null;
  /* chaîner les segments en boucles */
  var boucles = [];
  while(S.length){
    var s = S.shift(), L = [s[0], s[1]], tour = 0;
    while(S.length && tour++ < 100000){
      var fin = cle(L[L.length - 1]), j = -1, i;
      for(i = 0; i < S.length; i++) if(cle(S[i][0]) === fin || cle(S[i][1]) === fin){ j = i; break; }
      if(j < 0) break;
      var x = S.splice(j, 1)[0];
      L.push(cle(x[0]) === fin ? x[1] : x[0]);
      if(cle(L[L.length - 1]) === cle(L[0])){ L.pop(); break; }
    }
    if(L.length >= 3) boucles.push(L);
  }
  if(!boucles.length) return null;
  boucles.sort(function(a, b){ return Math.abs(aireS(b)) - Math.abs(aireS(a)); });
  var P = sansAlignes(boucles[0]);
  if(aireS(P) < 0) P.reverse();
  return { z0:z0, z1:z1, poly:P, trous:boucles.length - 1 };
}

/* ---------- 2. les axes d'un contour -----------------------------------------
   Les directions de ses côtés, modulo l'angle droit, chacune pesée de la longueur
   qui la porte — la plus longue d'abord. Au demi-degré : deux côtés plus proches
   sont parallèles. */
export function axesDe(P){
  var G = [];
  for(var i = 0; i < P.length; i++){
    var p = P[i], q = P[(i + 1) % P.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if(L < 1e-6) continue;
    var a = Math.atan2(q[1] - p[1], q[0] - p[0]), m = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    var g = G.filter(function(x){ var d = Math.abs(x.a - m); return Math.min(d, Math.PI / 2 - d) < .5 * Math.PI / 180; })[0];
    /* 0° et 89,999° sont la même direction : on ramène l'angle près du groupe avant de le peser */
    if(g){ m -= Math.round((m - g.a) / (Math.PI / 2)) * (Math.PI / 2); g.s += m * L; g.L += L; g.a = g.s / g.L; }
    else G.push({ a:m, s:m * L, L:L });
  }
  return G.sort(function(x, y){ return y.L - x.L; }).map(function(x){ return { a:x.a, L:x.L }; });
}

/* ---------- 3. l'intérieur : le contour rentré du mur ------------------------
   Chaque côté avance de `m` vers l'intérieur ; deux côtés voisins se recoupent à
   l'onglet. Juste pour un polygone dont aucune partie n'est plus étroite que
   deux murs. */
export function rentrer(P, m){
  var n = P.length, L = [], out = [], i;
  for(i = 0; i < n; i++){
    var p = P[i], q = P[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    /* sens direct : l'intérieur est à gauche */
    var nx = -dy / l, ny = dx / l;
    L.push({ p:[p[0] + nx * m, p[1] + ny * m], d:[dx / l, dy / l] });
  }
  for(i = 0; i < n; i++){
    var A = L[(i - 1 + n) % n], B = L[i], det = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if(Math.abs(det) < 1e-9){ out.push(B.p); continue; }
    var t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / det;
    out.push([A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]);
  }
  return out;
}

/* ---------- 4. l'intérieur en rectangles -------------------------------------
   Une grille par axe du contour : les sommets, projetés dans cet axe ; une
   cellule est pleine si elle est toute dans le polygone (aucun sommet n'est dans
   une cellule : ses quatre coins suffisent). Puis, tant qu'il en reste, le
   rectangle de cellules pleines qui couvre le plus de NEUF — ce qu'aucun
   rectangle posé ne couvre —, tous axes confondus : une barre d'abord, l'aile en
   biais ensuite, sans les miettes en escalier qu'un seul axe laisserait. Dans un
   même axe, deux rectangles ne se recouvrent pas ; d'un axe à l'autre, ils
   peuvent (l'aile en biais posée sur la barre), comme deux corps d'un même
   bâtiment. Rend des rectangles `{ x, y, w, d, a }` au site, `w` le grand côté,
   et la part du polygone qu'ils couvrent. */
export function decouper(I){
  var A0 = airePoly(I), R = [];
  function couvre(r, x, y){
    var c = Math.cos(r.a), s = Math.sin(r.a), u = (x - r.x) * c + (y - r.y) * s, v = -(x - r.x) * s + (y - r.y) * c;
    return Math.abs(u) <= r.w / 2 + 1e-6 && Math.abs(v) <= r.d / 2 + 1e-6;
  }
  var G = axesDe(I).map(function(ax){
    var c = Math.cos(ax.a), s = Math.sin(ax.a);
    function loc(p){ return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; }
    function site(u, v){ return [u * c - v * s, u * s + v * c]; }
    function uniq(X){
      X.sort(function(a, b){ return a - b; });
      return X.filter(function(x, i){ return !i || x - X[i - 1] > BRUIT; });
    }
    var Q = I.map(loc), U = uniq(Q.map(function(p){ return p[0]; })), W = uniq(Q.map(function(p){ return p[1]; }));
    var g = { a:ax.a, site:site, U:U, W:W, nu:U.length - 1, nv:W.length - 1, plein:[], neuf:[], mid:[] }, i, j, e = BRUIT;
    for(i = 0; i < g.nu; i++){
      g.plein.push([]); g.neuf.push([]); g.mid.push([]);
      for(j = 0; j < g.nv; j++){
        var ok = [[U[i] + e, W[j] + e], [U[i + 1] - e, W[j] + e], [U[i + 1] - e, W[j + 1] - e], [U[i] + e, W[j + 1] - e],
                  [(U[i] + U[i + 1]) / 2, (W[j] + W[j + 1]) / 2]].every(function(p){ return dedans(Q, p[0], p[1]); });
        g.plein[i].push(ok); g.neuf[i].push(ok);
        g.mid[i].push(site((U[i] + U[i + 1]) / 2, (W[j] + W[j + 1]) / 2));
      }
    }
    return g;
  });
  /* le meilleur rectangle d'un axe : le plus de neuf, puis le plus grand */
  function meilleur(g){
    var best = null, U = g.U, W = g.W;
    for(var i0 = 0; i0 < g.nu; i0++) for(var j0 = 0; j0 < g.nv; j0++){
      if(!g.plein[i0][j0]) continue;
      for(var i1 = i0; i1 < g.nu && g.plein[i1][j0]; i1++){
        for(var j1 = j0; j1 < g.nv; j1++){
          var tout = true, a, b, n = 0, t = 0;
          for(a = i0; a <= i1 && tout; a++) for(b = j0; b <= j1; b++){
            if(!g.plein[a][b]){ tout = false; break; }
            var ar = (U[a + 1] - U[a]) * (W[b + 1] - W[b]);
            t += ar; if(g.neuf[a][b]) n += ar;
          }
          if(!tout) break;
          if(U[i1 + 1] - U[i0] < MIETTE || W[j1 + 1] - W[j0] < MIETTE || n < MIETTE * MIETTE) continue;
          if(!best || n > best.n + 1e-6 || (Math.abs(n - best.n) <= 1e-6 && t > best.t))
            best = { g:g, n:n, t:t, i0:i0, i1:i1, j0:j0, j1:j1 };
        }
      }
    }
    return best;
  }
  for(var tour = 0; tour < 200; tour++){
    var best = null;
    G.forEach(function(g){ var b = meilleur(g); if(b && (!best || b.n > best.n + 1e-6)) best = b; });
    if(!best) break;
    var g = best.g, i, j;
    for(i = best.i0; i <= best.i1; i++) for(j = best.j0; j <= best.j1; j++) g.plein[i][j] = false;
    var u0 = g.U[best.i0], u1 = g.U[best.i1 + 1], v0 = g.W[best.j0], v1 = g.W[best.j1 + 1], m = g.site((u0 + u1) / 2, (v0 + v1) / 2);
    var r = { x:m[0], y:m[1], w:u1 - u0, d:v1 - v0, a:g.a };
    if(r.d > r.w){ var tw = r.w; r.w = r.d; r.d = tw; r.a += Math.PI / 2; }
    R.push(r);
    /* ce qu'il couvre n'est plus neuf, dans aucun axe */
    G.forEach(function(h){
      for(var a = 0; a < h.nu; a++) for(var b = 0; b < h.nv; b++)
        if(h.neuf[a][b] && couvre(r, h.mid[a][b][0], h.mid[a][b][1])) h.neuf[a][b] = false;
    });
  }
  /* la part couverte, à 25 cm près */
  var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, tot = 0, cv = 0, x, y;
  I.forEach(function(p){ bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); });
  for(x = bx0 + .125; x < bx1; x += .25) for(y = by0 + .125; y < by1; y += .25){
    if(!dedans(I, x, y)) continue;
    tot++;
    if(R.some(function(r){ return couvre(r, x, y); })) cv++;
  }
  return { rects:R, couvert: tot ? cv / tot : 0, aire:A0 };
}

/* ---------- 5. les faces d'un polygone : des oreilles ----------------------
   Un polygone simple, sens direct, en triangles d'indices. */
export function trianguler(P){
  var n = P.length, V = [], out = [], i;
  for(i = 0; i < n; i++) V.push(i);
  if(aireS(P) < 0) V.reverse();
  function oreille(a, b, c){
    var A = P[a], B = P[b], C = P[c];
    if((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) <= 1e-12) return false;
    for(var k = 0; k < V.length; k++){
      var j = V[k];
      if(j === a || j === b || j === c) continue;
      if(dedansTri(P[j], A, B, C)) return false;
    }
    return true;
  }
  var garde = 0;
  while(V.length > 3 && garde++ < 10000){
    var fait = false;
    for(i = 0; i < V.length; i++){
      var a = V[(i - 1 + V.length) % V.length], b = V[i], c = V[(i + 1) % V.length];
      if(oreille(a, b, c)){ out.push([a, b, c]); V.splice(i, 1); fait = true; break; }
    }
    if(!fait) break;
  }
  if(V.length === 3) out.push([V[0], V[1], V[2]]);
  return out;
}
function dedansTri(p, a, b, c){
  function s(u, v, w){ return (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]); }
  var d1 = s(a, b, p), d2 = s(b, c, p), d3 = s(c, a, p);
  return d1 >= -1e-12 && d2 >= -1e-12 && d3 >= -1e-12;
}

/* Du site au repère d'un corps, et retour. */
export function versLocal(v){
  var c = Math.cos(v.a), s = Math.sin(v.a);
  return function(p){ return [(p[0] - v.x) * c + (p[1] - v.y) * s, -(p[0] - v.x) * s + (p[1] - v.y) * c]; };
}
export function versSite(v){
  var c = Math.cos(v.a), s = Math.sin(v.a);
  return function(p){ return [v.x + p[0] * c - p[1] * s, v.y + p[0] * s + p[1] * c]; };
}
/* Le contour d'un étage libre, au site. */
export function polyDe(v, e){ return e.poly.map(versSite(v)); }
/* Le centre de gravité d'un polygone. */
export function centre(P){
  var a = 0, cx = 0, cy = 0;
  for(var i = 0; i < P.length; i++){
    var p = P[i], q = P[(i + 1) % P.length], k = p[0] * q[1] - q[0] * p[1];
    a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : P[0];
}
