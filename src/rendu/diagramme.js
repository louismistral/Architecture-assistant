/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — la logique de composition, à la manière de BIG

   Comment CE bâtiment a été composé, dans l'ordre où le générateur l'a fait,
   dessiné à partir de ce qu'il a réellement produit (`vols.trace`, posé par
   `genMass`) :

     LES SURFACES   ce que le mixer demande, niveau par niveau
     LE SPORT       la salle double sort du rez : 28 × 32 m, jamais découpée
     LA PROFONDEUR  une épaisseur tirée entre le minimum et deux classes + couloir
     LES CORPS      assez de corps pour loger chaque niveau à cette profondeur :
                    les hauts montent jusqu'en haut, les bas restent au rez
     LA FIGURE      le parti assemble les corps, en coordonnées locales
     L'ANGLE        la figure tourne : axe du périmètre, soleil-vue, ou libre
     POSER          la figure, d'un bloc, sur la parcelle, dans le recul
     ANCRER         la salle de sport accolée à un corps, ou à part au point bas
     CREUSER        le sous-sol sous le corps le plus haut du terrain
     RELIER         les passerelles, s'il y en a
     TRIER          les essais, les règles dures, le classement
     HABITER        la composition retenue, dans les couleurs du programme

   Une case n'existe que si l'étape a eu lieu. Volumes blancs, ce que l'étape
   fait en orange, flèches noires, un verbe en gras. La même planche
   s'affiche dans le rail du massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { reculVise } from "../data/cadre.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { lvlOf } from "../mix/floors.js";
import { airePoly, bbox, coins, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf, profFacade } from "../mass/model.js";
import { evaluationCourante } from "../mass/mesures.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var GRIS = [0.55, 0.55, 0.55], TIRETS = { dash:[2.5, 1.8] };

/* la règle de chaque figure, dite comme elle est codée (`mass/partis.js`) */
var FIGURE = {
  compact:   "deux rangs de corps accolés par leurs longs côtés",
  barre:     "une seule file de corps, bout à bout",
  barres:    "deux ou trois barres parallèles, décalées, séparées d'au moins 6 m",
  L:         "deux ailes perpendiculaires qui se rejoignent à une extrémité",
  U:         "une base et deux ailes du même côté",
  cour:      "un U, et un quatrième bâtiment qui ferme la cour à distance",
  pavillons: "des volumes seuls, en trame décalée, à 6 m au moins les uns des autres",
  hameau:    "trois ou quatre groupes sur un cercle, chacun son orientation",
  terrasses: "deux rangs qui suivent la pente, le haut en amont",
  peigne:    "un dos et des branches perpendiculaires d'un même côté",
  libre:     "des files, des coudes et des volumes seuls sur un cercle"
};
var CAP = {
  axe:    "alignée sur le plus long côté de la parcelle",
  soleil: "tournée vers le meilleur compromis soleil et vue",
  libre:  "tournée librement autour de l'axe de la parcelle",
  pente:  "ses rangs descendent la pente"
};

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
/* un angle ramené dans ]−90°, 90°] : une figure n'a ni avant ni arrière */
function deg(a){ var d = ((a * 180 / Math.PI) % 180 + 180) % 180; return Math.round(d > 90 ? d - 180 : d); }

/* ---------- l'axonométrie, calée sur les points `pts` ---------- */
function axo(cadre, pts, z0, z1){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(pts.map(function(p){ return brut(p[0], p[1], z0); }).concat(pts.map(function(p){ return brut(p[0], p[1], z1); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.86;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  return A;
}
/* le plan, vu de dessus, calé sur `pts` */
function plan(cadre, pts){
  var B = bbox(pts), k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.8;
  var ox = cadre[0] + cadre[2] / 2 - B.cx * k, oy = cadre[1] + cadre[3] / 2 - B.cy * k;
  var P = function(x, y){ return [ox + x * k, oy + y * k]; };
  P.k = k;
  return P;
}
function prisme(t, A, poly, z0, z1, c, o){
  o = o || {};
  var p = ccw(poly), F = [];
  for(var i = 0; i < p.length; i++){
    var a = p[i], b = p[(i + 1) % p.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    F.push({ a:a, b:b, d:A.prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), l:Math.abs(n[0]) > Math.abs(n[1]) });
  }
  function st(fill){ return o.dash ? { stroke:E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:E.noir, lw:o.lw || .45 }; }
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
function fleche(t, a, b, lw){
  lw = lw || 1.4;
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.5 + lw * 1.8;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:E.noir, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:E.noir });
}
function cote(t, a, b, txt, o){
  o = o || {};
  t.ligne([a, b], { stroke:o.c || E.accent, lw:.7 });
  [a, b].forEach(function(p){ t.cercle(p[0], p[1], 1.1, { fill:o.c || E.accent }); });
  t.texte((a[0] + b[0]) / 2 + (o.dx || 0), (a[1] + b[1]) / 2 + (o.dy == null ? 4 : o.dy), txt, { size:7, gras:true, fill:o.c || E.accent, ancre:"middle" });
}

/* ---------- les corps ---------- */
/* un slot de la figure (coordonnées locales) → ses étages, boîtes { q, z0, z1 } */
function slotBoites(s, N, c){
  var out = [], z = 0;
  s.lv.forEach(function(e){
    var h = N[e.k] ? N[e.k].h : 3.2, dy = s.gradin ? -((s.d - e.d) / 2) : 0;
    var ca = Math.cos(s.a || 0), sa = Math.sin(s.a || 0);
    var rc = { x:s.x - dy * sa, y:s.y + dy * ca, w:e.w + 1, d:e.d + 1, a:s.a || 0 };
    out.push({ x:rc.x, y:rc.y, q:coins(rc), z0:z, z1:z + h, c:c });
    z += h;
  });
  return out;
}
/* la composition posée : ses étages hors sol */
function corps(vols, z00, col, o){
  o = o || {};
  var C = [];
  vols.forEach(function(v){
    if(v.ph && !o.second) return;
    etagesDe(v).forEach(function(e){
      if(lvlOf(e.e.i) < 0) return;
      C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00, c:col(v, e), o:v.ph ? TIRETS : null });
    });
  });
  return C;
}
function points(C){ var P = []; C.forEach(function(c){ P = P.concat(c.q); }); return P.length ? P : PER; }
function sol(t, A){ t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 }); }

/* ---------- les étapes ---------- */
function etapes(vols){
  var T = vols.trace || {}, N = T.N || [], S0 = T.S || [], ev = evaluationCourante(), j = ev && ev.jugement;
  var pid = vols.parti || MASS.parti, pa = partiOf(pid);
  var ecole = vols.filter(function(v){ return !v.ph; });
  var sport = ecole.filter(function(v){ return v.fix; })[0];
  var z00 = Infinity, hmax = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ hmax = Math.max(hmax, e.z1 - z00); }); });
  var hauts = S0.filter(function(s){ return s.haut > 1; }).length, bas = S0.length - hauts;
  var S = [];
  function rien(){ return BLANC; }

  /* 1 · les surfaces, par niveau : des barres, larges de leurs m² */
  if(N.length) S.push({ n:"LES SURFACES", d:"Le mixer demande, hors sol : "
      + N.map(function(n){ return n.nom.toLowerCase() + " " + fmt(Math.round(n.A)) + " m²"; }).join(", ")
      + ". Le rez porte le plus : la forme sera plus large en bas qu'en haut.",
    f:function(t, cadre){
      var mx = Math.max.apply(null, N.map(function(n){ return n.A; })), bh = Math.min(26, cadre[3] / (N.length + 1.5));
      N.forEach(function(n, k){
        var W = cadre[2] - 150, w = W * n.A / mx, x = cadre[0] + 80, y = cadre[1] + 12 + k * (bh + 6);
        var sp = k === 0 && T.imp ? W * T.imp.aire / mx : 0;
        t.poly([[x, y], [x + w - sp, y], [x + w - sp, y + bh], [x, y + bh]], { fill:E.cote, stroke:E.noir, lw:.4 });
        if(sp) t.poly([[x + w - sp, y], [x + w, y], [x + w, y + bh], [x + w - sp, y + bh]], { fill:E.accent, stroke:E.noir, lw:.4 });
        t.texte(x - 6, y + bh / 2 - 3, n.nom, { size:7, ancre:"end" });
        t.texte(x + w + 6, y + bh / 2 - 3, fmt(Math.round(n.A)) + " m²", { size:7, gras:true });
      });
    } });

  /* 2 · la salle de sport sort du rez */
  if(T.imp) S.push({ n:"LE SPORT À PART", d:"La salle double, " + T.imp.d + " × " + T.imp.w + " m, ne se découpe pas : elle sort du rez, "
      + "il reste " + fmt(Math.round(T.A[0])) + " m² d'école à loger au rez.",
    f:function(t, cadre){
      var q = [[0, 0], [T.imp.w, 0], [T.imp.w, T.imp.d], [0, T.imp.d]], cl = [[T.imp.w + 14, 4], [T.imp.w + 44, 4], [T.imp.w + 44, T.imp.d - 4], [T.imp.w + 14, T.imp.d - 4]];
      var A = axo(cadre, q.concat(cl), 0, 12);
      prisme(t, A, cl, 0, 7.4, BLANC);
      prisme(t, A, q, 0, 7.4 + .4, ACC);
      fleche(t, A(T.imp.w + 12, T.imp.d / 2, 4), A(T.imp.w + 2, T.imp.d / 2, 4), 1.2);
      cote(t, A(0, -3, 0), A(T.imp.w, -3, 0), T.imp.w + " m", { dy:-10 });
    } });

  /* 3 · la profondeur : une coupe */
  if(T.prof) S.push({ n:"LA PROFONDEUR", d:"L'épaisseur des corps est tirée entre " + nb(T.lo + 1) + " m et " + nb(T.hi + 1)
      + " m — deux classes et leur couloir, chaque classe en façade : ici " + nb(T.prof + 1) + " m.",
    f:function(t, cadre){
      var fac = profFacade() + 1, k = cadre[2] * .8 / fac, x0 = cadre[0] + cadre[2] * .1, y0 = cadre[1] + cadre[3] * .35, h = 3.2 * k * 1.6;
      var d = T.prof + 1, cl = (fac - 2.4) / 2;
      /* la coupe maximale en pointillé, la coupe tirée en orange */
      t.poly([[x0, y0], [x0 + fac * k, y0], [x0 + fac * k, y0 + h], [x0, y0 + h]], { stroke:E.noir, lw:.5, dash:[2.5, 1.8] });
      t.poly([[x0, y0], [x0 + d * k, y0], [x0 + d * k, y0 + h], [x0, y0 + h]], { fill:E.accent, stroke:E.noir, lw:.5 });
      [cl, fac - cl].forEach(function(u){ t.ligne([[x0 + u * k, y0], [x0 + u * k, y0 + h]], { stroke:E.blanc, lw:.8 }); });
      t.texte(x0 + cl * k / 2, y0 + h / 2 - 3, "classe", { size:7, fill:E.blanc, ancre:"middle" });
      t.texte(x0 + fac * k / 2, y0 + h / 2 - 3, "couloir", { size:6, fill:E.blanc, ancre:"middle" });
      t.texte(x0 + (fac - cl / 2) * k, y0 + h / 2 - 3, "classe", { size:7, fill:E.blanc, ancre:"middle" });
      cote(t, [x0, y0 - 10], [x0 + d * k, y0 - 10], nb(d) + " m", { dy:-10 });
      cote(t, [x0, y0 + h + 10], [x0 + fac * k, y0 + h + 10], nb(fac) + " m au plus", { c:E.noir });
    } });

  /* 4 · les corps nécessaires, alignés */
  if(S0.length) S.push({ n:"LES CORPS", d:hauts + " corps montent jusqu'au " + (N[N.length - 1] ? N[N.length - 1].nom.toLowerCase() : "haut")
      + (bas ? ", " + bas + " restent au rez" : "") + " : chacun " + nb(T.prof + 1) + " m de profondeur, au plus 28 m de long ; les étages se retirent en largeur.",
    f:function(t, cadre){
      var C = [], x = 0;
      S0.slice().sort(function(a, b){ return b.haut - a.haut; }).forEach(function(s){
        var s2 = { x:x + (s.w + 1) / 2, y:0, a:0, w:s.w, d:s.d, lv:s.lv, gradin:s.gradin };
        C = C.concat(slotBoites(s2, N, s.haut > 1 ? ACC : BLANC));
        x += s.w + 1 + 5;
      });
      var A = axo(cadre, points(C), 0, Math.max.apply(null, C.map(function(c){ return c.z1; })));
      peindre(t, A, C);
    } });

  /* 5 · la figure, en coordonnées locales */
  if(S0.length) S.push({ n:"LA FIGURE", d:pa.n + " : " + (FIGURE[pid] || pa.d) + ". Les corps hauts et bas se rangent dans cette règle, avant tout site.",
    f:function(t, cadre){
      var C = [];
      S0.forEach(function(s){ C = C.concat(slotBoites(s, N, s.haut > 1 ? ACC : BLANC)); });
      var A = axo(cadre, points(C), 0, Math.max.apply(null, C.map(function(c){ return c.z1; })));
      peindre(t, A, C);
    } });

  /* 6 · l'angle, en plan */
  if(S0.length && vols.T) S.push({ n:"L'ANGLE", d:"La figure est " + (CAP[T.cap] || "tournée") + " : " + deg(vols.T.a) + "° par rapport à l'est.",
    f:function(t, cadre){
      var pts = [];
      S0.forEach(function(s){ pts = pts.concat(coins({ x:s.x, y:s.y, w:s.w + 1, d:s.d + 1, a:s.a || 0 })); });
      var c0 = bbox(pts), R = function(p, a){ var x = p[0] - c0.cx, y = p[1] - c0.cy; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
      var P = plan(cadre, pts.map(function(p){ return R(p, 0); }).concat(pts.map(function(p){ return R(p, vols.T.a); })));
      S0.forEach(function(s){
        var q = coins({ x:s.x, y:s.y, w:s.w + 1, d:s.d + 1, a:s.a || 0 });
        t.poly(q.map(function(p){ var r = R(p, 0); return P(r[0], r[1]); }), { stroke:E.noir, lw:.5, dash:[2.5, 1.8] });
        t.poly(q.map(function(p){ var r = R(p, vols.T.a); return P(r[0], r[1]); }), { fill:E.accent, stroke:E.noir, lw:.4 });
      });
      /* le nord, et l'arc de la rotation */
      var o = P(0, 0), n0 = [cadre[0] + cadre[2] - 16, cadre[1] + cadre[3] - 34];
      fleche(t, n0, [n0[0], n0[1] + 22], 1); t.texte(n0[0], n0[1] + 26, "N", { size:8, gras:true, ancre:"middle" });
      var arc = [], r0 = 40 * P.k;
      for(var i = 0; i <= 12; i++){ var a = vols.T.a * i / 12; arc.push([o[0] + Math.cos(a) * r0, o[1] + Math.sin(a) * r0]); }
      t.ligne(arc, { stroke:E.noir, lw:1.2 });
    } });

  /* 7 · la figure se pose sur la parcelle */
  var RV = reculVise();
  var recul = RV ? ligneRecul(RV).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] : null;
  S.push({ n:"POSER", d:"D'un seul bloc, à la première place tirée où tout tient : dans la parcelle" + (RV ? " à " + nb(RV) + " m du bord" : "")
      + ", 5 m entre bâtiments (AEAI), 5 m des bâtiments existants.",
    f:function(t, cadre){
      var A = axo(cadre, PER, 0, hmax * 1.7);
      sol(t, A);
      if(recul) t.poly(recul.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.accent, lw:.7, dash:[3, 2] });
      var C = corps(ecole.filter(function(v){ return !v.fix; }), z00, function(){ return ACC; });
      peindre(t, A, C);
      var c0 = bbox(points(C));
      fleche(t, A(c0.cx, c0.cy, hmax * 1.65), A(c0.cx, c0.cy, hmax + 3), 1.6);
    } });

  /* 8 · la salle de sport se pose */
  if(sport) S.push({ n:"ANCRER", d:sport.joint ? "La salle de sport s'accole à un corps de l'école, au rez, sous rien."
      : "La salle de sport se pose à part, sur le terrain le plus bas qui la reçoit : 7 m libres de moins à terrasser.",
    f:function(t, cadre){
      var A = axo(cadre, PER, 0, hmax * 1.7);
      sol(t, A);
      peindre(t, A, corps(ecole, z00, function(v){ return v.fix ? ACC : BLANC; }));
      fleche(t, A(sport.x, sport.y, hmax + 20), A(sport.x, sport.y, 10), 1.4);
    } });

  /* 9 · le sous-sol */
  var sous = [];
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) < 0) sous.push(e); }); });
  if(sous.length) S.push({ n:"CREUSER", d:"Le sous-sol va sous le corps posé le plus haut sur le terrain : c'est là que la nappe laisse le plus de couverture.",
    f:function(t, cadre){
      var A = axo(cadre, PER, -8, hmax * 1.7);
      sol(t, A);
      peindre(t, A, corps(ecole, z00, rien));
      sous.forEach(function(e){ prisme(t, A, coins(e.rc), e.z0 - z00, Math.min(0, e.z1 - z00), ACC, { lw:.5 }); });
      var r = sous[0].rc; fleche(t, A(r.x, r.y, hmax + 12), A(r.x, r.y, 2), 1.4);
    } });

  /* 10 · les passerelles */
  if((vols.ponts || []).length) S.push({ n:"RELIER", d:vols.ponts.length + " passerelle" + (vols.ponts.length > 1 ? "s" : "") + " à l'étage, les plus courtes d'abord, jusqu'à un seul ensemble.",
    f:function(t, cadre){ var A = axo(cadre, PER, 0, hmax * 1.7); sol(t, A); peindre(t, A, corps(ecole, z00, rien)); } });

  /* 11 · le tri */
  var n = vols.essais || 1, ok = Math.min(n, vols.valides || 1), props = vols.props || [vols];
  S.push({ n:"TRIER", d:n + " compositions essayées ainsi ; " + ok + " tiennent toutes les règles dures. Les jugements les classent : celle-ci est la "
      + ((vols.rang || 0) + 1) + (vols.rang ? "e" : "re") + " sur " + props.length + (j && j.total != null ? ", " + j.total + " / 100." : "."),
    f:function(t, cadre){
      var cols = Math.ceil(Math.sqrt(n * cadre[2] / cadre[3])), rows = Math.ceil(n / cols);
      var s = Math.min(cadre[2] / cols, cadre[3] / rows), c0 = s * .72;
      var x0 = cadre[0] + (cadre[2] - cols * s) / 2, y0 = cadre[1] + (cadre[3] + rows * s) / 2;
      for(var i = 0; i < n; i++){
        var x = x0 + (i % cols) * s, y = y0 - (Math.floor(i / cols) + 1) * s;
        var q = [[x, y], [x + c0, y], [x + c0, y + c0], [x, y + c0]];
        if(i === 0) t.poly(q, { fill:E.noir });
        else if(i < ok) t.poly(q, { fill:E.accent });
        else t.poly(q, { stroke:GRIS, lw:.5 });
      }
    } });

  /* 12 · habiter */
  S.push({ n:"HABITER", d:"La composition retenue, étage par étage dans les couleurs du programme ; piscine et chauffage à distance en pointillé.",
    f:function(t, cadre){
      var A = axo(cadre, PER, 0, hmax * 1.7);
      sol(t, A);
      peindre(t, A, corps(vols, z00, function(v, e){ return couleur(familleDom(e.e.i)); }, { second:true }));
    } });
  return S;
}

/* ---------- la planche ---------- */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 30;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, top = F.h - m - 76;
  var cols = 3, best = 0;
  for(var c = 2; c <= 6; c++){
    var r0 = Math.ceil(n / c), w0 = (F.w - 2 * m - (c - 1) * g) / c, h0 = (top - m - (r0 - 1) * g) / r0 - 62;
    var e0 = Math.min(w0 / 1.8, h0);
    if(e0 > best){ best = e0; cols = c; }
  }
  var rows = Math.ceil(n / cols), pid = vols.parti || MASS.parti;
  t.texte(m, F.h - m - 26, "LA LOGIQUE DE COMPOSITION", { size:30, gras:true });
  t.texte(m, F.h - m - 46, partiOf(pid).n + " — " + (FIGURE[pid] || "") + " · " + n + " étapes, dans l'ordre du générateur", { size:10, fill:[0.4, 0.4, 0.4] });
  var cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 52], [x + cw, y + 52], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, [x, y + 58, cw, ch - 62]);
    t.fin();
    t.texte(x, y + 38, ("0" + (i + 1)).slice(-2), { size:9, gras:true, fill:E.accent });
    t.texte(x + 18, y + 38, s.n, { size:15, gras:true });
    coupe(s.d, Math.round(cw / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 9, l, { size:7.5, fill:[0.3, 0.3, 0.3] }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 6, y + ch / 2 + 30], [x + cw + g - 6, y + ch / 2 + 30], 1);
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
