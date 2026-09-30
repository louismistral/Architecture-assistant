/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — la volumétrie expliquée, à la manière de BIG

   On raisonne À L'ENVERS : le volume est donné, on se demande par quels gestes
   un architecte y serait arrivé, et POURQUOI chacun. Comme dans les diagrammes
   de BIG, chaque geste a une raison lisible — le soleil, la vue, le Casino, le
   sol, les enfants — et la raison est MESURÉE sur le volume final, jamais
   inventée : la direction où s'ouvre la cour, le côté vers lequel le bâtiment
   s'abaisse, l'orientation des terrasses se lisent dans sa géométrie.

     LE BLOC      le programme en une boîte, sur le site
     TOURNER      dans l'axe qu'a pris le projet — pour le soleil, la parcelle
     CREUSER      le vide devient la cour ; il s'ouvre vers …
     FENDRE       les bâtiments se détachent : des passages entre eux
     ABAISSER     le bâtiment descend du côté de …
     ANCRER       la salle de sport, au sol
     GRADINER     les étages se retirent : des terrasses tournées vers …
     LE PROJET    le volume généré, IDENTIQUE, dans les couleurs du programme

   Un geste n'est dessiné que si la forme finale le contient. La dernière case
   dessine les étages de `etagesDe()` sans retouche ; chaque case précédente en
   est déduite. Volumes blancs, le geste en orange, les raisons en flèches et
   en icônes. La même planche s'affiche dans le rail du massing et s'imprime.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { lvlOf } from "../mix/floors.js";
import { airePoly, bbox, cibleVue, coins, ecart } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var CTXC = [[0.93, 0.93, 0.93], [0.85, 0.85, 0.85], [0.78, 0.78, 0.78]];
var GRIS = [0.55, 0.55, 0.55], TXT = [0.3, 0.3, 0.3], TIRETS = { dash:[2.5, 1.8] };
var VERT = [0.35, 0.6, 0.35], BLEU = [0.2, 0.45, 0.8];

function couleur(f){
  var c = typeof document !== "undefined" ? cssRGB(famTok(f)) : [0.7, 0.7, 0.7];
  return [c, c.map(function(v){ return v * .82; }), c.map(function(v){ return v * .68; })];
}
function coupe(s, n){
  var L = [], l = "";
  s.split(" ").forEach(function(m){ if((l + " " + m).trim().length > n){ L.push(l.trim()); l = m; } else l += " " + m; });
  if(l.trim()) L.push(l.trim());
  return L;
}
function ccw(p){
  var a = 0;
  for(var i = 0; i < p.length; i++){ var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a < 0 ? p.slice().reverse() : p;
}
function nb(x){ return String(Math.round(x * 10) / 10).replace(".", ","); }
/* une direction du plan (y vers le nord), dite comme un architecte la dit */
var CARD = ["l'est", "le nord-est", "le nord", "le nord-ouest", "l'ouest", "le sud-ouest", "le sud", "le sud-est"];
function cardinal(dx, dy){ var a = Math.atan2(dy, dx); return CARD[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
function angleEntre(a, b){ var d = Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])); return d; }
function centre(q){ var x = 0, y = 0; q.forEach(function(p){ x += p[0]; y += p[1]; }); return [x / q.length, y / q.length]; }

/* ---------- la vue ---------- */
function axo(cadre, pts, hmax){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(pts.map(function(p){ return brut(p[0], p[1], 0); }).concat(pts.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.9;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  return A;
}
function prisme(t, A, poly, z0, z1, c, o){
  o = o || {};
  var p = ccw(poly), F = [];
  for(var i = 0; i < p.length; i++){
    var a = p[i], b = p[(i + 1) % p.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    F.push({ a:a, b:b, d:A.prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), l:Math.abs(n[0]) > Math.abs(n[1]) });
  }
  function st(fill){ return o.dash ? { stroke:o.trait || E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:o.trait || E.noir, lw:o.lw || .45 }; }
  F.sort(function(u, v){ return v.d - u.d; }).forEach(function(f){
    t.poly([A(f.a[0], f.a[1], z0), A(f.b[0], f.b[1], z0), A(f.b[0], f.b[1], z1), A(f.a[0], f.a[1], z1)], st(c && (f.l ? c[1] : c[2])));
  });
  t.poly(p.map(function(q){ return A(q[0], q[1], z1); }), st(c && c[0]));
}
function peindre(t, A, C){
  C.sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); });
}
function fleche(t, a, b, lw, col){
  lw = lw || 1.4; col = col || E.noir;
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.5 + lw * 1.8;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:col, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:col });
}
function soleil(t, p, r){
  for(var i = 0; i < 12; i++){
    var a = i / 12 * 2 * Math.PI;
    t.ligne([[p[0] + Math.cos(a) * r * 1.5, p[1] + Math.sin(a) * r * 1.5], [p[0] + Math.cos(a) * r * 2.2, p[1] + Math.sin(a) * r * 2.2]], { stroke:E.soleil, lw:1 });
  }
  t.cercle(p[0], p[1], r, { fill:E.soleil });
}
/* un œil : la vue */
function oeil(t, p, r){
  t.poly([[p[0] - r * 1.6, p[1]], [p[0], p[1] + r * .9], [p[0] + r * 1.6, p[1]], [p[0], p[1] - r * .9]], { stroke:BLEU, lw:.8 });
  t.cercle(p[0], p[1], r * .45, { fill:BLEU });
}

/* ---------- lire le volume final ---------- */
var CASINO = null;
function casino(){
  if(CASINO) return CASINO;
  /* le Casino : le plus grand bâtiment du relevé */
  var best = null, ba = 0;
  SITE.bat.forEach(function(b, i){ var a = airePoly(b); if(a > ba){ ba = a; best = i; } });
  CASINO = best == null ? null : { p:SITE.bat[best], c:centre(SITE.bat[best]),
    h:SITE.bath[best] ? Math.max(4, SITE.bath[best][1] - SITE.bath[best][0]) : 10 };
  return CASINO;
}
function lire(vols){
  var C = [], z00 = Infinity;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){
    var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
    if(!et.length) return;
    C.push({ v:v, et:et, sol:et[0].rc, base:Math.max(0, et[0].z0 - z00), top:et[et.length - 1].z1 - z00,
             z:function(e){ return [Math.max(0, e.z0 - z00), e.z1 - z00]; } });
  });
  var ecole = C.filter(function(c){ return !c.v.ph; });
  /* la figure : l'école sans la salle de sport, qui a son propre geste */
  var fig = ecole.filter(function(c){ return !c.v.fix; });
  var maj = fig.slice().sort(function(a, b){ return b.sol.w * b.sol.d - a.sol.w * a.sol.d; })[0];
  var th = maj ? maj.sol.a : 0;
  function obb(pts, a){
    var ct = Math.cos(a), st = Math.sin(a);
    var B = bbox(pts.map(function(p){ return [p[0] * ct + p[1] * st, -p[0] * st + p[1] * ct]; }));
    return { B:B, q:[[B.x0, B.y0], [B.x1, B.y0], [B.x1, B.y1], [B.x0, B.y1]].map(function(p){ return [p[0] * ct - p[1] * st, p[0] * st + p[1] * ct]; }) };
  }
  var P = [];
  fig.forEach(function(c){ P = P.concat(coins(c.sol)); });
  var O = obb(P, th), N = obb(P, 0), H = Math.max.apply(null, ecole.map(function(c){ return c.top; }).concat([1]));
  var aireSol = 0, cx = 0, cy = 0;
  fig.forEach(function(c){ var a = c.sol.w * c.sol.d; aireSol += a; cx += c.sol.x * a; cy += c.sol.y * a; });
  var cm = [cx / aireSol, cy / aireSol];
  var aB = O.B.w * O.B.h, cb = centre(O.q), vide = aB - aireSol;
  /* le centre du vide : la boîte moins les emprises */
  var cv = vide > 1 ? [(cb[0] * aB - cm[0] * aireSol) / vide, (cb[1] * aB - cm[1] * aireSol) / vide] : cb;
  var grp = fig.map(function(c, i){ return i; });
  function f(i){ return grp[i] === i ? i : (grp[i] = f(grp[i])); }
  fig.forEach(function(a, i){ fig.forEach(function(b, k){ if(k > i && ecart(a.sol, b.sol) < .2) grp[f(i)] = f(k); }); });
  var bats = {};
  fig.forEach(function(c, i){ (bats[f(i)] = bats[f(i)] || []).push(c); });
  var sport = ecole.filter(function(c){ return c.v.fix; })[0];
  var nmax = Math.max.apply(null, ecole.filter(function(c){ return !c.v.fix; }).map(function(c){ return c.et.length; }).concat([1]));
  var hauts = ecole.filter(function(c){ return !c.v.fix && c.et.length === nmax; }), bas = ecole.filter(function(c){ return !c.v.fix && c.et.length < nmax; });
  function cmDe(L){ var x = 0, y = 0, a = 0; L.forEach(function(c){ var s = c.sol.w * c.sol.d; x += c.sol.x * s; y += c.sol.y * s; a += s; }); return a ? [x / a, y / a] : cm; }
  var retraits = [];
  ecole.forEach(function(c){ c.et.slice(1).forEach(function(e){ if(e.rc.w * e.rc.d < c.sol.w * c.sol.d - 1) retraits.push({ c:c, e:e }); }); });
  return { C:C, ecole:ecole, fig:fig, O:O, N:N, th:th, H:H, aireSol:aireSol, cm:cm, cv:cv, vide:vide, part:vide / aB,
           bats:Object.keys(bats).map(function(k){ return bats[k]; }), sport:sport, hauts:hauts, bas:bas, cmHaut:cmDe(hauts), cmBas:cmDe(bas), retraits:retraits };
}
function plein(c, z1, col){ return { x:c.sol.x, y:c.sol.y, q:coins(c.sol), z0:c.base, z1:z1, c:col }; }
function etages(X, col, avecSecond){
  var L = [];
  X.C.forEach(function(c){
    if(c.v.ph && !avecSecond) return;
    c.et.forEach(function(e){ var z = c.z(e); L.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:z[0], z1:z[1], c:c.v.ph ? null : col(c, e), o:c.v.ph ? TIRETS : null }); });
  });
  return L;
}

/* ---------- les gestes, et pourquoi ---------- */
function gestes(vols){
  var X = lire(vols), S = [], K = casino(), pa = partiOf(vols.parti || MASS.parti);
  var ctx = [];
  if(K) ctx.push({ x:K.c[0], y:K.c[1], q:K.p, z0:0, z1:K.h, c:CTXC, o:{ lw:.25, trait:GRIS } });
  function scene(t, A, L, plaque){
    t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 });
    if(plaque) plaque();
    peindre(t, A, ctx.concat(L));
  }
  var aTh = Math.round(((X.th * 180 / Math.PI) % 180 + 180) % 180), aThS = aTh > 90 ? aTh - 180 : aTh;
  var cN = centre(X.N.q), cO = centre(X.O.q);

  S.push({ n:"LE BLOC", d:"Le programme de l'école en une seule boîte de " + Math.round(X.N.B.w) + " × " + Math.round(X.N.B.h) + " m, "
      + nb(X.H) + " m de haut, posée à côté du Casino — la salle de sport à part, elle aura son geste. Tout part de là.",
    f:function(t, A){ scene(t, A, [{ x:cN[0], y:cN[1], q:X.N.q, z0:0, z1:X.H, c:ACC }]); } });

  if(Math.abs(aThS) > 3) S.push({ n:"TOURNER", d:"La boîte tourne de " + aThS + "° pour suivre la parcelle et offrir ses longues façades au "
      + cardinal(-Math.sin(X.th), Math.cos(X.th)).replace(/^le |^l'/, "") + " et au " + cardinal(Math.sin(X.th), -Math.cos(X.th)).replace(/^le |^l'/, "") + ".",
    f:function(t, A){
      scene(t, A, [{ x:cO[0], y:cO[1], q:X.O.q, z0:0, z1:X.H, c:ACC }], function(){
        t.poly(X.N.q.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.noir, lw:.5, dash:[2.5, 1.8] });
      });
      var P = [], r0 = Math.max(X.O.B.w, X.O.B.h) * .6;
      for(var i = 0; i <= 14; i++){ var a = X.th * i / 14; P.push(A(cO[0] + Math.cos(a) * r0, cO[1] + Math.sin(a) * r0, X.H + 4)); }
      t.ligne(P.slice(0, -1), { stroke:E.noir, lw:1.5 }); fleche(t, P[P.length - 3], P[P.length - 1], 1.5);
    } });

  var dv = [X.cv[0] - X.cm[0], X.cv[1] - X.cm[1]], sud = angleEntre(dv, [0, -1]) < Math.PI / 3;
  if(X.part > .12) S.push({ n:"CREUSER", d:"On vide la boîte de " + fmt(Math.round(X.vide)) + " m² : ce vide devient la cour des enfants. Elle s'ouvre vers "
      + cardinal(dv[0], dv[1]) + (sud ? " — au soleil de midi, abritée par les bâtiments." : ", tenue par les bâtiments sur ses autres côtés."),
    f:function(t, A){
      scene(t, A, X.fig.map(function(c){ return plein(c, X.H, BLANC); }), function(){
        t.poly(X.O.q.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.accent });
      });
      prisme(t, A, X.O.q, 0, X.H, null, TIRETS);
      if(sud) soleil(t, A(X.cv[0], X.cv[1] - 70, X.H * .8), 5);
      fleche(t, A(X.cv[0], X.cv[1], X.H + 14), A(X.cv[0], X.cv[1], 2), 1.4);
    } });

  if(X.bats.length > 1) S.push({ n:"FENDRE", d:"Le bâtiment se fend en " + X.bats.length + " : les fentes laissent passer les enfants et le regard, "
      + "à 5 m au moins l'un de l'autre.",
    f:function(t, A){
      scene(t, A, X.fig.map(function(c){ return plein(c, X.H, ACC); }));
      /* une flèche au travers de chaque fente : entre les centres de deux bâtiments voisins */
      var cs = X.bats.map(cmDeB);
      for(var i = 0; i < cs.length - 1 && i < 3; i++){
        var a = cs[i], b = cs[i + 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dx = b[1] - a[1], dy = -(b[0] - a[0]), l = Math.hypot(dx, dy) || 1;
        fleche(t, A(m[0] - dx / l * 25, m[1] - dy / l * 25, 1), A(m[0] + dx / l * 25, m[1] + dy / l * 25, 1), 1.3, VERT);
      }
    } });

  if(X.bas.length && X.hauts.length){
    var db = [X.cmBas[0] - X.cmHaut[0], X.cmBas[1] - X.cmHaut[1]];
    var versK = K && angleEntre(db, [K.c[0] - X.cmHaut[0], K.c[1] - X.cmHaut[1]]) < Math.PI / 3;
    S.push({ n:"ABAISSER", d:"Le bâtiment descend vers " + (versK ? "le Casino : il ne le domine pas et garde le bâtiment inventorié en vue. "
        : cardinal(db[0], db[1]) + " : l'échelle baisse vers le bord de la parcelle. ")
        + X.bas.length + " corps ne gardent que le rez, " + X.hauts.length + " montent à " + X.hauts[0].et.length + " niveaux.",
      f:function(t, A){
        scene(t, A, X.ecole.filter(function(c){ return !c.v.fix; }).map(function(c){ return plein(c, X.bas.indexOf(c) >= 0 ? c.top : X.H, X.bas.indexOf(c) >= 0 ? ACC : BLANC); }));
        X.bas.forEach(function(c){ prisme(t, A, coins(c.sol), c.base, X.H, null, TIRETS); });
        X.bas.slice(0, 4).forEach(function(c){ fleche(t, A(c.sol.x, c.sol.y, X.H + 8), A(c.sol.x, c.sol.y, c.top + 2), 1.1); });
      } });
  }

  if(X.sport){
    var basSol = X.sport.base <= Math.min.apply(null, X.ecole.map(function(c){ return c.base; })) + .5;
    S.push({ n:"ANCRER", d:"La salle de sport double, 28 × 32 m et 7 m libres, se pose " + (X.sport.v.joint ? "contre l'école, au rez" : "à part")
        + (basSol ? ", sur le point bas du terrain : sa hauteur s'y enfonce au lieu de dominer." : ", au sol : rien ne la surmonte."),
      f:function(t, A){
        scene(t, A, X.ecole.map(function(c){ return plein(c, c === X.sport ? c.top : (X.bas.indexOf(c) >= 0 ? c.top : X.H), c === X.sport ? ACC : BLANC); }));
        fleche(t, A(X.sport.sol.x, X.sport.sol.y, X.H + 14), A(X.sport.sol.x, X.sport.sol.y, X.sport.top + 2), 1.4);
      } });
  }

  if(X.retraits.length){
    var dt = [0, 0];
    X.retraits.forEach(function(r){ dt[0] += r.c.sol.x - r.e.rc.x; dt[1] += r.c.sol.y - r.e.rc.y; });
    var dir = Math.hypot(dt[0], dt[1]) > .5 ? cardinal(dt[0], dt[1]) : null;
    var vv = cibleVue(), vueOk = dir && angleEntre(dt, [vv.x - X.cm[0], vv.y - X.cm[1]]) < Math.PI / 3;
    S.push({ n:"GRADINER", d:"Les étages se retirent" + (dir ? " vers " + dir : " des deux côtés") + " : le toit du dessous devient terrasse"
        + (vueOk ? ", tournée vers la vue." : dir && /sud/.test(dir) ? ", au soleil." : ", une cour haute pour les classes."),
      f:function(t, A){
        scene(t, A, etages(X, function(c, e){ return X.retraits.some(function(r){ return r.e === e; }) ? BLANC : BLANC; }));
        X.retraits.forEach(function(r){ var z = r.c.z(r.e); prisme(t, A, coins(r.c.sol), z[0], z[0] + .3, ACC); });
        if(vueOk){ var p0 = A(X.cm[0], X.cm[1], X.H + 6); oeil(t, [p0[0] + 30, p0[1] + 16], 5); }
      } });
  }

  S.push({ n:"LE PROJET", d:"Le volume généré, identique, étage par étage dans les couleurs du programme ; piscine et chauffage à distance en pointillé. "
      + pa.n + ".",
    f:function(t, A){ scene(t, A, etages(X, function(c, e){ return couleur(familleDom(e.e.i)); }, true)); } });
  S.X = X;
  return S;
  function cmDeB(L){ var x = 0, y = 0, a = 0; L.forEach(function(c){ var s = c.sol.w * c.sol.d; x += c.sol.x * s; y += c.sol.y * s; a += s; }); return [x / a, y / a]; }
}

/* ---------- la planche ---------- */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 34;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = gestes(vols), n = S.length, X = S.X, top = F.h - m - 76;
  var cols = n <= 4 ? n : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols);
  var pts = PER.slice();
  X.C.forEach(function(c){ pts = pts.concat(coins(c.sol)); });
  var K = casino();
  if(K) pts = pts.concat(K.p);
  t.texte(m, F.h - m - 26, "LA VOLUMÉTRIE, GESTE PAR GESTE", { size:30, gras:true });
  t.texte(m, F.h - m - 46, "Comment arriver à cette forme : d'une boîte au projet, chaque geste et sa raison · " + partiOf(vols.parti || MASS.parti).n,
    { size:10, fill:[0.4, 0.4, 0.4] });
  var cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 52], [x + cw, y + 52], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo([x, y + 58, cw, ch - 62], pts, X.H * 1.35));
    t.fin();
    t.texte(x, y + 38, ("0" + (i + 1)).slice(-2), { size:9, gras:true, fill:E.accent });
    t.texte(x + 18, y + 38, s.n, { size:15, gras:true });
    coupe(s.d, Math.round(cw / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 9, l, { size:7.5, fill:TXT }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 6, y + ch / 2 + 30], [x + cw + g - 6, y + ch / 2 + 30], 1);
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
