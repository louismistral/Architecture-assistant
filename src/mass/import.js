/* ============================================================================
   L'IMPORT D'UNE VOLUMÉTRIE DEPUIS RHINO — UN FICHIER .3DM

   Le chemin inverse de l'export : un massing retravaillé dans Rhino revient
   ici, REMPLACE la volumétrie à l'écran, et se juge comme n'importe quelle
   autre. Le jugement ne lit que des mesures (`mesures.js`), et les mesures ne
   lisent que des volumes `{ x, y, a, lv }` : il suffit donc de RECONSTRUIRE
   ces volumes à partir du solide, et la note ne dépend plus de qui l'a dessiné
   ni d'où il a été dessiné — seulement de ce qu'on en mesure.

   LE REPÈRE est celui de l'export (`RHINO`, site.js) : X et Y du relevé, le
   zéro des altitudes à 465 m. L'unité est celle que le fichier déclare — un
   fichier en millimètres se relit aussi juste qu'un fichier en centimètres.

   LA RECONSTRUCTION, par deux chemins :

     des BOÎTES — l'export d'ici, ou un modèle construit étage par étage —
       se lisent boîte par boîte : chacune est un étage, les boîtes empilées
       un volume. Un massing exporté puis réimporté revient à l'identique ;
     un SOLIDE UNIFIÉ (une union booléenne) se lit par ses toits :
       1. en chaque point du plan, la colonne de matière — une face qui
          regarde le ciel y fait entrer, une qui regarde le sol en fait
          sortir : une dalle intérieure ne coupe rien, un porte-à-faux garde
          son vide dessous ;
       2. les toits d'une même altitude, d'un seul tenant, font une RÉGION,
          découpée en rectangles dans l'axe de ses bords les plus longs, sur
          une grille tirée de ses sommets — le plus grand d'abord ;
       3. chaque rectangle est un volume. Un solide n'a pas de dalles : ses
          étages se COMPTENT, sur la pile du mixer ou à la hauteur d'un étage
          de classe, et gardent la hauteur mesurée ;
       4. `fusionner()` recolle les morceaux d'un même corps et fait un
          bâtiment de ce qui se touche — comme après un tirage.
     Puis ce que le solide ne nomme pas, ses mesures le disent : la salle de
     sport, les ouvrages du second temps, les passerelles.

   Ce qui ne passe pas : un toit en pente n'est pas horizontal, il n'est donc
   pas lu ; une bande de moins d'un mètre est un reste de découpe ; là où un
   corps bute en biais contre un autre, restent de petits rectangles.
   ========================================================================= */
import { RULES } from "../data/rules.js";
import { RHINO } from "../data/site.js";
import { ITEMBYKEY } from "../core/model.js";
import { FLOORS, lvlOf, onFloor } from "../mix/floors.js";
import { PMAP } from "../mix/prog.js";
import { V } from "../data/cadre.js";
import { assise, dansRect, ecart, terrain } from "./geom.js";
import { CONTACT, etagesDe, hauteurEtage, niveaux, secondTemps, volRect } from "./model.js";
import { ecartVols, fusionner } from "./gen.js";

var TOL = .05;        /* m : deux altitudes plus proches sont la même */
var MIETTE = 1;       /* m : un côté plus court est un reste de découpe */
/* mètres par unité du fichier */
var UNITES = { Millimeters:.001, Centimeters:.01, Decimeters:.1, Meters:1, Inches:.0254, Feet:.3048 };

/* ---------- 1. le fichier → des solides, en triangles et en mètres --------- */
export function solides3dm(rh, octets){
  var doc = rh.File3dm.fromByteArray(octets);
  if(!doc) throw new Error("Fichier .3dm illisible.");
  var us = doc.settings().modelUnitSystem, s = null, k, j;
  for(k in UNITES) if(rh.UnitSystem[k] && rh.UnitSystem[k].value === us.value) s = UNITES[k];
  if(s == null){ doc.delete(); throw new Error("Unité du fichier non reconnue : passe-le en centimètres."); }
  var out = [], T, sans = 0, O = doc.objects();
  function maille(m){
    if(!m){ sans++; return; }
    var Vs = m.vertices(), F = m.faces(), i;
    function p(n){
      var q = Vs.get(n);
      return [q[0] * s - RHINO.x0 / RHINO.u, q[1] * s - RHINO.y0 / RHINO.u, q[2] * s + RHINO.z0];
    }
    for(i = 0; i < F.count; i++){
      var f = F.get(i);
      T.push([p(f[0]), p(f[1]), p(f[2])]);
      if(f[3] !== f[2]) T.push([p(f[0]), p(f[2]), p(f[3])]);
    }
  }
  /* l'habillage d'un massing exporté d'ici : un toit, un auvent ne sont pas
     des étages */
  var L = doc.layers(), passe = {};
  for(k = 0; k < L.count; k++) if(L.get(k).name === "Architecture") passe[k] = 1;
  for(k = 0; k < O.count; k++){
    if(passe[O.get(k).attributes().layerIndex]) continue;
    var g = O.get(k).geometry();
    out.push(T = []);
    if(g instanceof rh.Mesh) maille(g);
    else if(g instanceof rh.Extrusion) maille(g.getMesh(rh.MeshType.Any));
    else if(g instanceof rh.Brep){
      var F = g.faces();
      for(j = 0; j < F.count; j++) maille(F.get(j).getMesh(rh.MeshType.Any));
    }
  }
  doc.delete();
  /* rhino3dm ne maille pas : il relit les maillages de rendu que Rhino a
     enregistrés. Un fichier « Save small » n'en a pas. */
  if(sans) throw new Error(sans + " face(s) sans maillage de rendu : dans Rhino, affiche le "
    + "modèle en mode Ombré puis enregistre sans « Save small ».");
  out = out.filter(function(t){ return t.length; });
  if(!out.length) throw new Error("Aucun solide dans le fichier : ni Brep, ni extrusion, ni maillage.");
  return out;
}

/* ---------- 2. des solides → des volumes -------------------------------------
   Deux chemins. Un fichier fait de BOÎTES — l'export d'ici, ou un modèle
   construit étage par étage — se lit boîte par boîte : chacune est un étage,
   exactement. Sinon (une union booléenne, des formes libres), on lit le
   solide par ses toits. */
export function volsDe3dm(solides){
  var B = solides.map(boite);
  if(B.every(Boolean)) return parBoites(B);
  return parToits([].concat.apply([], solides));
}

/* Une boîte : des faces horizontales ou verticales, huit sommets, le dessus
   un rectangle posé sur le même rectangle. Cotes hors tout. */
function boite(T){
  var S = {}, n = 0, z0 = Infinity, z1 = -Infinity;
  for(var k = 0; k < T.length; k++){
    var t = T[k], c = normale(t), m = Math.hypot(c[0], c[1], c[2]);
    if(m > 1e-9 && Math.abs(c[2]) / m > .001 && Math.abs(c[2]) / m < .999) return null;
    t.forEach(function(p){
      var id = Math.round(p[0] * 100) + "," + Math.round(p[1] * 100) + "," + Math.round(p[2] * 100);
      if(!S[id]){ S[id] = p; n++; }
      z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    });
  }
  if(n !== 8 || z1 - z0 < .5) return null;
  var H = [], L = [], id;
  for(id in S){
    if(Math.abs(S[id][2] - z1) < .01) H.push(S[id]);
    else if(Math.abs(S[id][2] - z0) < .01) L.push(S[id]);
  }
  if(H.length !== 4 || L.length !== 4
     || !H.every(function(p){ return L.some(function(q){ return Math.hypot(p[0] - q[0], p[1] - q[1]) < .01; }); })) return null;
  var cx = 0, cy = 0;
  H.forEach(function(p){ cx += p[0] / 4; cy += p[1] / 4; });
  H.sort(function(p, q){ return Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx); });
  for(k = 0; k < 4; k++){
    var a = H[k], b = H[(k + 1) % 4], c2 = H[(k + 2) % 4];
    var dot = (b[0] - a[0]) * (c2[0] - b[0]) + (b[1] - a[1]) * (c2[1] - b[1]);
    if(Math.abs(dot) > .01 * Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c2[0] - b[0], c2[1] - b[1])) return null;
  }
  var w = Math.hypot(H[1][0] - H[0][0], H[1][1] - H[0][1]), d = Math.hypot(H[2][0] - H[1][0], H[2][1] - H[1][1]);
  var ang = Math.atan2(H[1][1] - H[0][1], H[1][0] - H[0][0]);
  if(d > w){ var t2 = w; w = d; d = t2; ang += Math.PI / 2; }
  return { x:cx, y:cy, w:w, d:d, a:ang, z0:z0, z1:z1 };
}
function normale(t){
  var ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
  var vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/* ---------- 2. des triangles → des volumes ----------------------------------- */
function surTri(t, x, y){
  var a = t[0], b = t[1], c = t[2];
  var d1 = (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  var d2 = (x - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (y - c[1]);
  var d3 = (x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1]);
  var neg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9, pos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
  return !(neg && pos);
}
function segDist(p, a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function cle(p){ return Math.round(p[0] * 100) + "," + Math.round(p[1] * 100); }

/* Ce que le solide ne nomme pas, ses MESURES le disent — comme le contrôle
   le lirait sur un tirage.
   LA SALLE DE SPORT : le corps aux deux cotes du programme, au mètre près
   (murs comptés dedans ou dehors). Une salle d'un seul tenant sous sa
   hauteur : un étage, pas deux. */
function sport(vols){
  var imp = null;
  FLOORS.forEach(function(F, i){
    onFloor(i).forEach(function(b){
      var p = PMAP[b.key], it = ITEMBYKEY[b.key];
      if(p && p.solid && it && it.w && it.h) imp = { key:b.key, i:i, lo:Math.min(it.w, it.h), hi:Math.max(it.w, it.h) };
    });
  });
  if(!imp) return;
  vols.forEach(function(v){
    var e = v.lv[0], H = 0;
    if(v.fix || imp.v || Math.abs(Math.min(e.w, e.d) - imp.lo) > 1.1 || Math.abs(Math.max(e.w, e.d) - imp.hi) > 1.1) return;
    v.lv.forEach(function(x){ H += hauteurEtage(x, niveaux()[x.i]); });
    imp.v = v;
    v.fix = 1; v.key = imp.key; v.id = "vsport";
    v.lv = [{ i:imp.i, w:e.w, d:e.d, dx:0, dy:0, h:H, keys:[imp.key] }];
    /* accolée : au corps qu'elle touche, comme le générateur l'accole */
    var o = vols.filter(function(x){ return x !== v && Math.abs(ecartVols(v, x)) <= CONTACT; })[0];
    if(o) v.joint = o.id;
  });
}
/* Accolée à PLUSIEURS corps d'un même bâtiment — un solide unifié l'a
   dessinée ainsi —, elle en fait partie : sans quoi le contrôle lirait deux
   bâtiments distincts qui se touchent. Après `fusionner()`, qui fait les
   bâtiments. */
function accoler(vols){
  vols.forEach(function(v){
    var J = v.fix && vols.filter(function(o){ return o.id === v.joint; })[0];
    if(J && J.bat && vols.filter(function(o){ return o !== v && Math.abs(ecartVols(v, o)) <= CONTACT; }).length > 1)
      v.bat = J.bat;
  });
}
/* LE SECOND TEMPS : un corps d'un étage, à l'écart de tout, de la surface
   d'un ouvrage — ou des deux réunis — à 5 % près. */
function second(vols){
  var S = secondTemps(), lots = S.map(function(x){ return [x]; });
  if(S.length > 1) lots.push(S);
  lots.forEach(function(lot){
    var a = 0, h = 0;
    lot.forEach(function(x){ a += x.a; h = Math.max(h, x.h); });
    var v = vols.filter(function(v){
      return !v.fix && !v.ph && !v.bat && !v.joint && v.lv.length === 1
        && !vols.some(function(o){ return o.joint === v.id; })
        && Math.abs(v.lv[0].w * v.lv[0].d - a) <= .05 * a;
    })[0];
    if(!v || lot.some(function(x){ return x.pris; })) return;
    lot.forEach(function(x){ x.pris = 1; });
    v.ph = 2; v.nom = lot.map(function(x){ return x.n; }).join(" et ");
    Object.assign(v.lv[0], { i:lot[0].i, h:v.lv[0].h || h, keys:lot.map(function(x){ return x.key; }) });
  });
}

/* Le même volume, son repère tourné d'un quart de tour. */
function quart(v){
  v.a += Math.PI / 2;
  v.lv.forEach(function(e){
    var w = e.w, dx = e.dx || 0;
    e.w = e.d; e.d = w; e.dx = e.dy || 0; e.dy = -dx;
  });
}

function parToits(T){
  /* les faces horizontales, chacune à son altitude ; les autres faces non
     verticales (un dessous qui suit le terrain, un toit en pente) comptent
     dans la colonne, pas dans les toits */
  var H = [], P = [];
  T.forEach(function(t){
    var c = normale(t), nx = c[0], ny = c[1], nz = c[2], n = Math.hypot(nx, ny, nz);
    if(n < 1e-6 || Math.abs(nz) / n < .1) return;
    var f = { t:t, z:(t[0][2] + t[1][2] + t[2][2]) / 3, nx:nx / nz, ny:ny / nz, s:nz > 0 ? 1 : -1,
              x0:Math.min(t[0][0], t[1][0], t[2][0]), x1:Math.max(t[0][0], t[1][0], t[2][0]),
              y0:Math.min(t[0][1], t[1][1], t[2][1]), y1:Math.max(t[0][1], t[1][1], t[2][1]) };
    P.push(f);
    if(Math.abs(nz) / n >= .999) H.push(f);
  });
  if(!H.length) throw new Error("Aucune face horizontale : rien qui ressemble à un toit.");
  /* LA COLONNE en un point : les intervalles PLEINS, de haut en bas. On
     descend le long de la verticale ; une face qui regarde le ciel fait
     entrer dans la matière, une face qui regarde le sol en fait sortir — un
     étage posé sur un autre ne coupe donc rien, et un porte-à-faux laisse son
     vide dessous. Deux faces à la même altitude ne comptent qu'une fois (un
     point sur l'arête de deux triangles d'une même face). Un maillage mal
     orienté retombe sur le plus haut et le plus bas. */
  function colonne(x, y){
    var Z = [];
    P.forEach(function(f){
      if(x < f.x0 - 1e-6 || x > f.x1 + 1e-6 || y < f.y0 - 1e-6 || y > f.y1 + 1e-6 || !surTri(f.t, x, y)) return;
      var a = f.t[0];
      Z.push({ z:a[2] - f.nx * (x - a[0]) - f.ny * (y - a[1]), s:f.s });
    });
    if(!Z.length) return null;
    Z.sort(function(a, b){ return b.z - a.z; });
    var out = [], w = 0, hi = null, i = 0, ok = true;
    while(i < Z.length){
      var z = Z[i].z, s = 0;
      for(; i < Z.length && z - Z[i].z <= TOL; i++) s += Z[i].s;
      var w1 = w + (s > 0 ? 1 : s < 0 ? -1 : 0);
      if(w1 < 0){ ok = false; break; }
      if(!w && w1) hi = z;
      if(w && !w1) out.push({ hi:hi, lo:z });
      w = w1;
    }
    if(!ok || w) out = [{ hi:Z[0].z, lo:Z[Z.length - 1].z }];
    return out;
  }

  /* les altitudes de toit, à TOL près */
  var Z = [];
  H.slice().sort(function(a, b){ return a.z - b.z; }).forEach(function(h){
    if(!Z.length || h.z - Z[Z.length - 1] > TOL) Z.push(h.z);
    h.k = Z.length - 1;
  });

  /* les régions : les faces d'une même altitude qui se touchent — par un
     sommet, ou un sommet posé sur le bord de l'autre (deux faces Brep voisines
     ne partagent pas toujours leurs sommets) */
  var regions = [];
  Z.forEach(function(z, k){
    var L = H.filter(function(h){ return h.k === k; }), chef = L.map(function(_, i){ return i; });
    function c(i){ while(chef[i] !== i) i = chef[i] = chef[chef[i]]; return i; }
    for(var i = 0; i < L.length; i++) for(var j = i + 1; j < L.length; j++){
      var A = L[i], B = L[j];
      if(A.x0 > B.x1 + .01 || B.x0 > A.x1 + .01 || A.y0 > B.y1 + .01 || B.y0 > A.y1 + .01) continue;
      var lie = A.t.some(function(p){ return B.t.some(function(q, n){ return segDist(p, q, B.t[(n + 1) % 3]) < .01; }); })
             || B.t.some(function(p){ return A.t.some(function(q, n){ return segDist(p, q, A.t[(n + 1) % 3]) < .01; }); });
      if(lie) chef[c(j)] = c(i);
    }
    var G = {};
    L.forEach(function(h, i){ (G[c(i)] = G[c(i)] || []).push(h); });
    for(var g in G) regions.push({ z:z, H:G[g] });
  });

  /* l'axe d'une région : la direction, modulo l'angle droit, qui porte la
     plus grande longueur de bords libres */
  regions.forEach(function(r){
    var E = {}, best = 0, i, b;
    r.H.forEach(function(h){
      h.t.forEach(function(p, n){
        var q = h.t[(n + 1) % 3], k1 = cle(p), k2 = cle(q), id = k1 < k2 ? k1 + "|" + k2 : k2 + "|" + k1;
        if(E[id]) E[id].n++; else E[id] = { n:1, p:p, q:q };
      });
    });
    var bins = new Float64Array(180), B = [];
    for(i in E){
      if(E[i].n > 1) continue;
      var dx = E[i].q[0] - E[i].p[0], dy = E[i].q[1] - E[i].p[1];
      var deg = ((Math.atan2(dy, dx) * 180 / Math.PI) % 90 + 90) % 90, L = Math.hypot(dx, dy);
      bins[Math.floor(deg * 2) % 180] += L;
      B.push([deg, L]);
    }
    for(i = 0, b = 0; i < 180; i++){
      var s = bins[(i + 179) % 180] + bins[i] + bins[(i + 1) % 180];
      if(s > best){ best = s; b = i; }
    }
    /* au demi-degré près, puis la moyenne exacte des bords qui y tombent */
    var c0 = (b + .5) / 2, sw = 0, sd = 0;
    B.forEach(function(e){
      var d = ((e[0] - c0 + 45) % 90 + 90) % 90 - 45;
      if(Math.abs(d) <= .75){ sw += e[1]; sd += e[1] * d; }
    });
    r.deg = c0 + (sw ? sd / sw : 0);
  });
  /* une même direction d'un bout à l'autre du projet : `fusionner()` ne
     rejoint que des corps exactement parallèles */
  var axes = [];
  regions.forEach(function(r){
    var a = axes.filter(function(x){ var d = Math.abs(x - r.deg); return Math.min(d, 90 - d) < 1; })[0];
    if(a == null){ axes.push(r.deg); a = r.deg; }
    r.a = a * Math.PI / 180;
  });

  /* chaque région, en rectangles */
  var hEt = RULES.haut.libre.cla + RULES.haut.dalle, rects = [], miettes = 0;
  regions.forEach(function(r){
    var c = Math.cos(r.a), s = Math.sin(r.a), U = [], W = [];
    function xy(u, v){ return [u * c - v * s, u * s + v * c]; }
    r.H.forEach(function(h){ h.t.forEach(function(p){
      U.push(p[0] * c + p[1] * s); W.push(-p[0] * s + p[1] * c);
    }); });
    /* la grille : les sommets du toit, et ceux du DESSOUS qui tombent dans
       son emprise — c'est là que commence un porte-à-faux */
    var u0 = Math.min.apply(null, U), u1 = Math.max.apply(null, U);
    var w0 = Math.min.apply(null, W), w1 = Math.max.apply(null, W);
    P.forEach(function(f){ f.t.forEach(function(p){
      var u = p[0] * c + p[1] * s, w = -p[0] * s + p[1] * c;
      if(u > u0 && u < u1 && w > w0 && w < w1){ U.push(u); W.push(w); }
    }); });
    function lignes(A){
      A.sort(function(a, b){ return a - b; });
      return A.filter(function(x, i){ return !i || x - A[i - 1] > .1; });
    }
    U = lignes(U); W = lignes(W);
    /* une cellule est pleine quand ce toit est le sien ; elle dit aussi à
       quel étage le solide COMMENCE au-dessus du terrain — 0 au sol, plus
       haut sous un porte-à-faux. Un rectangle ne mêle pas deux départs. */
    function lire(x, y){
      if(!r.H.some(function(h){ return surTri(h.t, x, y); })) return null;
      var col = (colonne(x, y) || []).filter(function(c){ return Math.abs(c.hi - r.z) <= TOL; })[0];
      if(!col) return null;
      return { lo:col.lo, bas:Math.round((col.lo - terrain(x, y)) / hEt) };
    }
    var nu = U.length - 1, nv = W.length - 1, C = [], i, j, a, b;
    for(i = 0; i < nu; i++){
      C.push([]);
      for(j = 0; j < nv; j++){
        var L = [], par = {}, maj = null;
        for(a = 1; a < 6; a += 2) for(b = 1; b < 6; b += 2){
          var p = xy(U[i] + (U[i + 1] - U[i]) * a / 6, W[j] + (W[j + 1] - W[j]) * b / 6), q = lire(p[0], p[1]);
          if(!q) continue;
          L.push(q);
          par[q.bas] = (par[q.bas] || 0) + 1;
          if(maj == null || par[q.bas] > par[maj]) maj = q.bas;
        }
        var Lm = L.filter(function(q){ return q.bas === maj; });
        C[i].push(L.length === 9 ? { bas:maj, lo:Lm.reduce(function(t, q){ return t + q.lo; }, 0) / Lm.length } : null);
      }
    }
    /* le plus grand rectangle de cellules pleines et de même départ, tant
       qu'il en reste un qui ne soit pas une miette */
    for(;;){
      var best = null;
      for(j = 0; j < nv; j++){
        var col = [];
        for(i = 0; i < nu; i++) col.push(C[i][j] ? C[i][j].bas : null);
        for(var j1 = j; j1 < nv; j1++){
          var hv = W[j1 + 1] - W[j];
          for(i = 0; i < nu; i++) if(!C[i][j1] || C[i][j1].bas !== col[i]) col[i] = null;
          if(hv < MIETTE) continue;
          for(i = 0; i < nu; i++){
            if(col[i] == null) continue;
            for(var i1 = i; i1 < nu && col[i1] === col[i]; i1++){
              var hu = U[i1 + 1] - U[i];
              if(hu >= MIETTE && (!best || hu * hv > best.A))
                best = { A:hu * hv, i0:i, i1:i1, j0:j, j1:j1, bas:col[i] };
            }
          }
        }
      }
      if(!best) break;
      var lo = 0;
      for(i = best.i0; i <= best.i1; i++) for(j = best.j0; j <= best.j1; j++){
        lo += C[i][j].lo * (U[i + 1] - U[i]) * (W[j + 1] - W[j]);
        C[i][j] = null;
      }
      var ua = U[best.i0], ub = U[best.i1 + 1], va = W[best.j0], vb = W[best.j1 + 1];
      var m = xy((ua + ub) / 2, (va + vb) / 2);
      rects.push({ x:m[0], y:m[1], w:ub - ua, d:vb - va, a:r.a, z:r.z, bas:best.bas, lo:lo / best.A });
    }
    C.forEach(function(L){ L.forEach(function(x){ if(x) miettes++; }); });
  });

  /* chaque rectangle, en volume : sa colonne, comptée en étages. Deux
     lectures, et une seule pour tout le fichier — mêler les deux poserait un
     porte-à-faux au mauvais niveau :
       la PILE du mixer, si la plupart du bâti y tombe — une colonne commence
       au plancher d'un niveau et finit, à 25 cm près, au plafond d'un autre ;
       c'est le cas d'un massing exporté d'ici. Une colonne qui n'y tombe pas
       (deux corps voisins posés à deux assises se recouvrent dans le solide)
       prend les niveaux les plus proches ;
       sinon, des étages de classe (`hEt`), chacun à la hauteur mesurée. */
  var mur = 2 * RULES.haut.mur, horsPile = 0, vols = [], pile = [], z = 0, i;
  /* la pile d'un corps d'école : chaque niveau à la hauteur de ses classes */
  for(i = 0; i < FLOORS.length; i++) pile.push({ i:i, lvl:lvlOf(i), h:niveaux()[i].hc });
  pile.sort(function(p, q){ return p.lvl - q.lvl; });
  pile.forEach(function(p){ if(p.lvl < 0) z -= p.h; });
  pile.forEach(function(p){ p.z = z; z += p.h; });
  function parPile(r){
    var rel = r.lo - assise(r).z, a = 0, b, k, H = r.z - r.lo;
    pile.forEach(function(p, x){ if(Math.abs(p.z - rel) < Math.abs(pile[a].z - rel)) a = x; });
    for(b = k = a; k < pile.length; k++)
      if(Math.abs(pile[k].z + pile[k].h - pile[a].z - H) < Math.abs(pile[b].z + pile[b].h - pile[a].z - H)) b = k;
    return { tombe: Math.abs(pile[a].z - rel) <= hEt / 2 && Math.abs(pile[b].z + pile[b].h - pile[a].z - H) <= .25,
             lv: pile.slice(a, b + 1).map(function(p){ return { i:p.i, h:0 }; }) };
  }
  function parClasse(r){
    var nb = Math.max(1, Math.round((r.z - r.lo) / hEt)), h = (r.z - r.lo) / nb, out = [], q;
    for(q = 0; q < nb; q++){
      var p = pile.filter(function(x){ return x.lvl === r.bas + q; })[0];
      if(p) out.push({ i:p.i, h:h }); else horsPile++;
    }
    return out;
  }
  var lu = rects.map(parPile), tombe = 0, tout = 0;
  rects.forEach(function(r, k){ tout += r.w * r.d; if(lu[k].tombe) tombe += r.w * r.d; });
  var mode = pile.length && tombe >= tout / 2 ? "pile" : "classe";
  rects.forEach(function(r, k){
    var lv = (mode === "pile" ? lu[k].lv : parClasse(r)).map(function(e){
      return { i:e.i, w:Math.max(.5, r.w - mur), d:Math.max(.5, r.d - mur), dx:0, dy:0, h:e.h };
    });
    if(lv.length) vols.push({ id:"r" + (k + 1), x:r.x, y:r.y, a:r.a, fix:0, lv:lv });
  });
  if(!vols.length) throw new Error("Aucun volume reconnu dans le solide.");
  sport(vols);
  /* `fusionner()` rejoint bout à bout dans l'axe du corps : une fois dans
     chaque axe. Puis la largeur redevient la grande cote, au plus grand étage. */
  vols.ponts = [];
  fusionner(vols, vols.ponts, true);
  vols.forEach(quart);
  fusionner(vols, vols.ponts, true);
  accoler(vols);
  droit(vols);
  second(vols);
  return { vols:vols, mode:mode, regions:regions.length, rects:rects.length, miettes:miettes, horsPile:horsPile };
}

/* La largeur redevient la grande cote, au plus grand étage ; l'angle dans
   ]−90°, 90°] — un demi-tour retourne aussi les décalages. */
function droit(vols){
  vols.forEach(function(v){
    var e = v.lv.reduce(function(m, x){ return x.w * x.d > m.w * m.d ? x : m; });
    if(e.d > e.w) quart(v);
    while(v.a > Math.PI / 2 || v.a <= -Math.PI / 2){
      v.a += v.a > 0 ? -Math.PI : Math.PI;
      v.lv.forEach(function(x){ x.dx = -(x.dx || 0); x.dy = -(x.dy || 0); });
    }
  });
}

/* ---------- des boîtes → des volumes -----------------------------------------
   Les boîtes empilées — l'une commence où l'autre finit, et la recouvre en
   plan — font un volume. Son REZ est la boîte posée au plus près du terrain
   sous elle (la même assise que `etagesDe()`), les autres montent ou
   descendent d'un niveau chacune. Une boîte seule, étroite comme une
   passerelle, perchée, et qui touche deux volumes est une passerelle. */
function parBoites(B){
  var mur = 2 * RULES.haut.mur, piles = [], N = niveaux(), horsPile = 0;
  B.sort(function(p, q){ return p.z0 - q.z0; });
  B.forEach(function(b){
    var P = piles.filter(function(L){
      var t = L[L.length - 1];
      return Math.abs(t.z1 - b.z0) <= TOL && Math.abs(Math.sin(2 * (t.a - b.a))) < 1e-3
        && (dansRect(t, b.x, b.y) || dansRect(b, t.x, t.y));
    })[0];
    if(P) P.push(b); else piles.push([b]);
  });
  var vols = [], ponts = [], perches = [];
  piles.forEach(function(L, k){
    var rez = 0;
    L.forEach(function(b, j){ if(Math.abs(b.z0 - assise(b).z) < Math.abs(L[rez].z0 - assise(L[rez]).z)) rez = j; });
    var R = L[rez], c = Math.cos(R.a), s = Math.sin(R.a), lv = [];
    L.forEach(function(b, j){
      var i = -1;
      FLOORS.forEach(function(F, x){ if(lvlOf(x) === j - rez) i = x; });
      if(i < 0){ horsPile++; return; }
      var tourne = Math.abs(Math.sin(b.a - R.a)) > .5, h = b.z1 - b.z0;
      lv.push({ i:i, w:(tourne ? b.d : b.w) - mur, d:(tourne ? b.w : b.d) - mur,
                dx:(b.x - R.x) * c + (b.y - R.y) * s, dy:-(b.x - R.x) * s + (b.y - R.y) * c,
                h:Math.abs(h - N[i].hc) <= TOL ? 0 : h });
    });
    if(!lv.length) return;
    var v = { id:"b" + (k + 1), x:R.x, y:R.y, a:R.a, fix:0, lv:lv };
    if(L.length === 1 && Math.abs(R.d - V.passLarg) <= .3 && R.z0 - assise(R).z > 2) perches.push({ v:v, b:R });
    vols.push(v);
  });
  /* les passerelles : ce qu'elles touchent, au niveau du premier */
  perches.forEach(function(p){
    var T = vols.filter(function(o){
      return o !== p.v && o.lv.some(function(e){ var d = ecart(p.b, volRect(o, e)); return d >= -CONTACT && d <= CONTACT; });
    });
    if(T.length < 2) return;
    var A = T.filter(function(o){ return etagesDe(o).some(function(x){ return Math.abs(x.z0 - p.b.z0) <= TOL; }); })[0] || T[0];
    var B2 = T.filter(function(o){ return o !== A; })[0], i = -1;
    etagesDe(A).forEach(function(x){ if(Math.abs(x.z0 - p.b.z0) <= .5) i = x.e.i; });
    if(i < 0) return;
    ponts.push({ a:A.id, b:B2.id, i:i });
    vols.splice(vols.indexOf(p.v), 1);
  });
  if(!vols.length) throw new Error("Aucun volume reconnu dans le fichier.");
  sport(vols);
  vols.ponts = ponts;
  fusionner(vols, ponts);
  accoler(vols);
  droit(vols);
  second(vols);
  return { vols:vols, mode:"boites", boites:B.length, ponts:ponts.length, horsPile:horsPile };
}
