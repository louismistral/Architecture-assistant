/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — A2, vectoriel, à la manière de BIG

   Pourquoi CE volume, et comment il a été pensé. La planche est propre à la
   forme posée : le geste qui la fait naître dépend de son parti (un bloc se
   SERRE, un U ENCADRE, des pavillons se DISPERSENT…), et chaque case dit,
   chiffres de la composition à l'appui, ce que ce geste lui vaut — la cour
   qu'il tient, la profondeur qui met les classes en façade, le soleil sur les
   longues façades, la hauteur à l'échelle du village.

   Comme les diagrammes de BIG (la LEGO House) : le contexte en gris clair, le
   volume en blanc, ce que la case explique en orange, des flèches, un verbe
   en gras sous chaque case. Une case n'existe que si elle dit quelque chose
   de cette forme-ci (pas de salle de sport imposée : pas de case « ancrer »).
   La même planche s'affiche dans le rail du massing (`svg()`) et s'imprime.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { reculVise } from "../data/cadre.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { lvlOf } from "../mix/floors.js";
import { airePoly, bbox, cibleVue, coins, enveloppe, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";
import { evaluationCourante } from "../mass/mesures.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var CTXC = [[0.93, 0.93, 0.93], [0.84, 0.84, 0.84], [0.76, 0.76, 0.76]];
var GRIS = [0.55, 0.55, 0.55], TIRETS = { dash:[2.5, 1.8] };

/* Le geste de chaque parti : le verbe, et ce qu'il fait. */
var GESTE = {
  compact:   ["SERRER",     "deux rangs accolés par leurs longs côtés : le moins de façade possible"],
  barre:     ["ÉTIRER",     "une seule file, une direction : tout le programme le long d'un axe"],
  barres:    ["ÉCHELONNER", "des barres parallèles et décalées : des vides qui font cours"],
  L:         ["PLIER",      "deux ailes qui se rencontrent : l'angle cadre un dehors"],
  U:         ["ENCADRER",   "une base et deux ailes : elles tiennent un espace central"],
  cour:      ["FERMER",     "trois côtés accolés, un quatrième à distance : une cour au milieu"],
  pavillons: ["DISPERSER",  "des volumes autonomes en trame décalée : aucun ne touche l'autre"],
  hameau:    ["GROUPER",    "des groupes aux orientations propres, autour d'une place"],
  terrasses: ["ÉTAGER",     "des rangs qui suivent les courbes de niveau, le plus haut en amont"],
  peigne:    ["RAMIFIER",   "un corps principal et des branches d'un même côté"],
  libre:     ["COMPOSER",   "des files, des coudes, des volumes seuls, aussi serrés que les règles le permettent"]
};

function couleur(f){
  /* la couleur de la famille, résolue par le navigateur ; gris hors navigateur */
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

/* ---------- la vue : la même axonométrie pour toutes les cases ---------- */
function axo(cadre, hmax){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(PER.map(function(p){ return brut(p[0], p[1], 0); }).concat(PER.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.9;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  return A;
}
/* un prisme : ses faces visibles, de la plus lointaine à la plus proche, puis
   son toit ; `c` = [toit, flanc clair, flanc sombre] ; `o.dash` : au trait seul */
function prisme(t, A, poly, z0, z1, c, o){
  o = o || {};
  var p = ccw(poly), F = [];
  for(var i = 0; i < p.length; i++){
    var a = p[i], b = p[(i + 1) % p.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    F.push({ a:a, b:b, d:A.prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), l:Math.abs(n[0]) > Math.abs(n[1]) });
  }
  function st(fill){ return o.dash ? { stroke:E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:o.trait || E.noir, lw:o.lw || .45 }; }
  F.sort(function(u, v){ return v.d - u.d; }).forEach(function(f){
    t.poly([A(f.a[0], f.a[1], z0), A(f.b[0], f.b[1], z0), A(f.b[0], f.b[1], z1), A(f.a[0], f.a[1], z1)], st(c && (f.l ? c[1] : c[2])));
  });
  t.poly(p.map(function(q){ return A(q[0], q[1], z1); }), st(c && c[0]));
}
function fleche(t, a, b, lw){
  lw = lw || 1.4;
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.5 + lw * 1.8;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:E.noir, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:E.noir });
}
function soleil(t, p, r){
  for(var i = 0; i < 12; i++){
    var a = i / 12 * 2 * Math.PI;
    t.ligne([[p[0] + Math.cos(a) * r * 1.5, p[1] + Math.sin(a) * r * 1.5], [p[0] + Math.cos(a) * r * 2.2, p[1] + Math.sin(a) * r * 2.2]], { stroke:E.soleil, lw:1 });
  }
  t.cercle(p[0], p[1], r, { fill:E.soleil });
}
/* une cote : un trait, deux tirets, un nombre */
function cote(t, a, b, txt){
  t.ligne([a, b], { stroke:E.accent, lw:.8 });
  [a, b].forEach(function(p){ t.cercle(p[0], p[1], 1.2, { fill:E.accent }); });
  t.texte((a[0] + b[0]) / 2 + 4, (a[1] + b[1]) / 2, txt, { size:7, gras:true, fill:E.accent });
}

/* ---------- la scène : le sol, le contexte, les corps ---------- */
var CTX = null;
function contexte(){
  if(CTX) return CTX;
  var B = bbox(PER);
  CTX = [];
  SITE.bat.forEach(function(b, i){
    var c = bbox(b);
    if(c.cx < B.x0 - 35 || c.cx > B.x1 + 35 || c.cy < B.y0 - 35 || c.cy > B.y1 + 35) return;
    var h = SITE.bath[i] ? Math.max(3, SITE.bath[i][1] - SITE.bath[i][0]) : 6;
    CTX.push({ x:c.cx, y:c.cy, q:b, z0:0, z1:h, c:CTXC, o:{ lw:.2, trait:GRIS } });
  });
  return CTX;
}
function scene(t, A, C, plaque){
  t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 });
  if(plaque) plaque(t, A);
  contexte().concat(C || []).sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); });
}
/* les étages hors sol ; `col(v, e)` dit la couleur, `o.plat` fait de chaque
   corps une boîte jusqu'à `o.h` */
function corps(vols, z00, col, o){
  o = o || {};
  var C = [];
  vols.forEach(function(v){
    if(v.ph && !o.second) return;
    var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
    if(!et.length) return;
    if(o.plat){
      C.push({ x:et[0].rc.x, y:et[0].rc.y, q:coins(et[0].rc), z0:0, z1:o.h, c:col(v, et[0]) });
      return;
    }
    et.forEach(function(e){
      C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00, c:col(v, e), o:v.ph ? TIRETS : null });
    });
  });
  return C;
}

/* ---------- les cases : ce que cette forme-ci doit à chaque geste ---------- */
function etapes(vols){
  var ev = evaluationCourante(), j = ev && ev.jugement, M = (ev && ev.mes) || {};
  function q(id){ return ev && ev.qualites[id] ? ev.qualites[id] : null; }
  function dit(id, repli){ var x = q(id); return x ? x.txt : repli; }
  var pid = vols.parti || MASS.parti, pa = partiOf(pid), G = GESTE[pid] || GESTE.libre;
  var ecole = vols.filter(function(v){ return !v.ph; }), sport = ecole.filter(function(v){ return v.fix; });
  var z00 = Infinity, hmax = 0, haut = null;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  ecole.forEach(function(v){ etagesDe(v).forEach(function(e){ if(e.z1 - z00 > hmax){ hmax = e.z1 - z00; haut = v; } }); });
  var pts = [];
  ecole.forEach(function(v){ var e = etagesDe(v).filter(function(x){ return lvlOf(x.e.i) >= 0; })[0]; if(e) pts = pts.concat(coins(e.rc)); });
  var env = pts.length > 2 ? enveloppe(pts) : PER, ce = bbox(env);
  var emprise = M.emprise || 0, volume = M.volume || 0, hbloc = emprise ? volume / emprise : hmax;
  var cote0 = Math.sqrt(emprise || 1);
  var RV = reculVise();
  var recul = RV ? ligneRecul(RV).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] : null;
  function blanc(){ return BLANC; }
  var S = [];

  S.push({ n:"LE SITE", d:fmt(RULES.site.aire) + " m² au pied du Casino, entre la rue du Casino et le chemin du Petit Mont"
      + (RV ? " ; " + nb(RV) + " m de recul sur tout le périmètre." : "."),
    f:function(t, A){ scene(t, A, [], function(t, A){
      if(recul) t.poly(recul.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.accent, lw:.7, dash:[3, 2] });
    }); } });

  S.push({ n:"UN BLOC", d:fmt(Math.round(volume)) + " m³ d'école sur " + fmt(Math.round(emprise)) + " m² d'emprise : "
      + "en un seul bloc, " + Math.round(cote0) + " × " + Math.round(cote0) + " m sur " + nb(hbloc) + " m. Trop profond pour éclairer une classe.",
    f:function(t, A){ scene(t, A, [{ x:ce.cx, y:ce.cy, q:coins({ x:ce.cx, y:ce.cy, w:cote0, d:cote0, a:ecole.length ? ecole[0].a : 0 }), z0:0, z1:hbloc, c:ACC }]); } });

  S.push({ n:G[0], d:pa.n + " : " + G[1] + ". " + ecole.length + " corps ; " + dit("compa", "") + ".",
    f:function(t, A){
      var C = corps(ecole, z00, function(){ return ACC; }, { plat:true, h:hbloc });
      scene(t, A, C);
      prisme(t, A, coins({ x:ce.cx, y:ce.cy, w:cote0, d:cote0, a:ecole.length ? ecole[0].a : 0 }), 0, hbloc, null, TIRETS);
      ecole.slice(0, 6).forEach(function(v){
        var dx = v.x - ce.cx, dy = v.y - ce.cy, l = Math.hypot(dx, dy);
        if(l > 10) fleche(t, A(ce.cx + dx / l * 5, ce.cy + dy / l * 5, hbloc + 4), A(v.x - dx / l * 3, v.y - dy / l * 3, hbloc + 4), 1);
      });
    } });

  if(M.cour) S.push({ n:"LA COUR", d:"Le vide que la forme tient devient la cour : " + dit("courq", fmt(Math.round(M.cour)) + " m² utiles")
      + ", pour " + fmt(RULES.ecole.eleves) + " élèves.",
    f:function(t, A){ scene(t, A, corps(ecole, z00, blanc, { plat:true, h:hbloc }), function(t, A){
      t.poly(env.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.accent });
    }); } });

  var cl = ecole.filter(function(v){ return !v.fix; })[0];
  if(cl) S.push({ n:"LA PROFONDEUR", d:"Des " + dit("facade", "corps minces") + " : deux classes et leur couloir, chaque classe en façade, éclairée naturellement.",
    f:function(t, A){
      scene(t, A, corps(ecole, z00, function(v){ return v === cl ? ACC : BLANC; }, { plat:true, h:hbloc }));
      var e = etagesDe(cl).filter(function(x){ return lvlOf(x.e.i) >= 0; })[0];
      if(e){
        var rc = e.rc, ux = -Math.sin(rc.a), uy = Math.cos(rc.a);
        cote(t, A(rc.x - ux * rc.d / 2, rc.y - uy * rc.d / 2, hbloc + 3), A(rc.x + ux * rc.d / 2, rc.y + uy * rc.d / 2, hbloc + 3), nb(rc.d) + " m");
      }
    } });

  S.push({ n:"LE SOLEIL", d:"La figure est tournée pour que les " + dit("soleil", "longues façades regardent le sud") + ".",
    f:function(t, A){
      scene(t, A, corps(ecole, z00, blanc, { plat:true, h:hbloc }));
      var s0 = A(ce.cx, ce.cy - 90, hmax * 1.3); soleil(t, s0, 5);
      ecole.slice(0, 5).forEach(function(v){ t.ligne([s0, A(v.x, v.y, hbloc * .5)], { stroke:E.soleil, lw:.9 }); });
    } });

  var vu = q("vue");
  if(vu && vu.niv > 0) S.push({ n:"LA VUE", d:"Les " + vu.txt + " : l'école s'ouvre vers le dégagement.",
    f:function(t, A){
      scene(t, A, corps(ecole, z00, blanc, { plat:true, h:hbloc }));
      var cv = cibleVue(), dx = cv.x - ce.cx, dy = cv.y - ce.cy, l = Math.hypot(dx, dy) || 1;
      fleche(t, A(ce.cx, ce.cy, hbloc + 6), A(ce.cx + dx / l * 60, ce.cy + dy / l * 60, hbloc + 6), 1.6);
    } });

  if(sport.length) S.push({ n:"ANCRER", d:"La salle de sport double, 28 × 32 m et 7 m libres, se pose au rez, d'un seul tenant : rien ne la surmonte.",
    f:function(t, A){
      scene(t, A, corps(ecole, z00, function(v){ return v.fix ? ACC : BLANC; }));
      var v = sport[0]; fleche(t, A(v.x, v.y, hmax + 18), A(v.x, v.y, hmax * .6 + 2), 1.4);
    } });

  S.push({ n:"LA HAUTEUR", d:(M.niveauxMax || "") + " niveaux au plus, " + nb(hmax) + " m : à l'échelle du village, "
      + "chaque corps ne monte que de ce qu'il porte.",
    f:function(t, A){
      scene(t, A, corps(ecole, z00, function(v){ return v === haut ? ACC : BLANC; }));
      if(haut){
        var e = etagesDe(haut), q0 = coins(e[0].rc)[0];
        cote(t, A(q0[0], q0[1], 0), A(q0[0], q0[1], hmax), nb(hmax) + " m");
      }
    } });

  var fort = ev ? Object.keys(ev.qualites).map(function(k){ return ev.qualites[k]; }).filter(function(x){ return x.niv === 2; }).slice(0, 2) : [];
  S.push({ n:"L'ÉCOLE", d:"Le programme en place, dans les couleurs de ses familles"
      + (j && j.total != null ? " — " + j.total + " / 100 au jugement" : "")
      + (fort.length ? " ; " + fort.map(function(x){ return x.n.toLowerCase(); }).join(", ") : "") + ".",
    f:function(t, A){ scene(t, A, corps(vols, z00, function(v, e){ return couleur(familleDom(e.e.i)); }, { second:true })); } });
  S.hmax = Math.max(hmax, hbloc);
  return S;
}

/* ---------- la planche ----------
   Un grand titre, puis les cases reliées par des flèches ; sous chaque
   dessin, le numéro, le verbe en gras, une ligne pour dire pourquoi. La grille
   prend le nombre de colonnes qui donne les plus grands dessins. */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 30;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, top = F.h - m - 76;
  var cols = 3, best = 0;
  for(var c = 2; c <= 6; c++){
    var r0 = Math.ceil(n / c), w0 = (F.w - 2 * m - (c - 1) * g) / c, h0 = (top - m - (r0 - 1) * g) / r0 - 62;
    var e0 = Math.min(w0 / 2.2, h0);
    if(e0 > best){ best = e0; cols = c; }
  }
  var rows = Math.ceil(n / cols), pid = vols.parti || MASS.parti;
  t.texte(m, F.h - m - 26, "POURQUOI CE VOLUME", { size:30, gras:true });
  t.texte(m, F.h - m - 46, partiOf(pid).n + " — " + (GESTE[pid] || GESTE.libre)[1], { size:10, fill:[0.4, 0.4, 0.4] });
  var cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 52], [x + cw, y + 52], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo([x, y + 58, cw, ch - 62], S.hmax));
    t.fin();
    t.texte(x, y + 38, ("0" + (i + 1)).slice(-2), { size:9, gras:true, fill:E.accent });
    t.texte(x + 18, y + 38, s.n, { size:15, gras:true });
    coupe(s.d, Math.round(cw / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 9, l, { size:7.5, fill:[0.3, 0.3, 0.3] }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 6, y + ch / 2 + 30], [x + cw + g - 6, y + ch / 2 + 30], 1);
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
