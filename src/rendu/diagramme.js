/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — comment ce volume a été trouvé

   Le générateur ne « conçoit » pas un parti : il TIRE des compositions au
   hasard dans un cadre fixe, écarte celles qui enfreignent une règle dure, et
   garde la mieux notée. La planche le dit tel quel, avec ce qu'il a réellement
   produit — rien n'y est reconstruit après coup :

     CE QUI EST FIXÉ      les surfaces du mixer, la salle de sport, le recul,
                          les bornes de profondeur                (vols.trace)
     CE QUI EST TIRÉ      pour ce volume : parti, profondeur, angle et sa
                          source, position, salle de sport, passerelles
     ESSAYER              une case par essai                      (vols.essais)
     ÉCARTER              pourquoi les autres ont été écartés     (vols.echecs)
     LES SURVIVANTES      la meilleure de chaque parti, et sa note (vols.props)
     POURQUOI CELLE-CI    ses axes du jugement contre la deuxième (evaluer)
     LE VOLUME RETENU     dans les couleurs du programme

   Volumes blancs, ce qui compte en orange, un verbe en gras par case. La même
   planche s'affiche dans le rail du massing (`svg()`) et s'imprime (`pdf()`).
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
import { bbox, coins } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";
import { evaluer } from "../mass/mesures.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var GRIS = [0.55, 0.55, 0.55], TXT = [0.3, 0.3, 0.3], TIRETS = { dash:[2.5, 1.8] };

/* les causes d'un essai écarté, dites en clair (`genMass` et `ecarts()`) */
var CAUSE = {
  parti: "la figure ne tient pas son parti", perimetre: "ne tient pas dans la parcelle",
  recul: "sort du recul", dist: "moins de 5 m entre bâtiments", existant: "trop près de l'existant",
  sport: "pas de place pour la salle de sport", abri: "abri PC mal posé", surfaces: "surfaces non tenues",
  cour: "cour trop petite", "cour-prog": "cour du programme non tenue"
};
var CAP = { axe:"le plus long côté de la parcelle", soleil:"le compromis soleil-vue", libre:"un angle libre autour de l'axe", pente:"la pente" };

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
function deg(a){ var d = ((a * 180 / Math.PI) % 180 + 180) % 180; return Math.round(d > 90 ? d - 180 : d); }
function barre(t, x, y, w, h, fill){ t.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { fill:fill }); }

/* ---------- l'axonométrie du site ---------- */
function axo(cadre, hmax){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(PER.map(function(p){ return brut(p[0], p[1], 0); }).concat(PER.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.92;
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
  function st(fill){ return o.dash ? { stroke:E.noir, lw:.4, dash:o.dash } : { fill:fill, stroke:E.noir, lw:o.lw || .4 }; }
  F.sort(function(u, v){ return v.d - u.d; }).forEach(function(f){
    t.poly([A(f.a[0], f.a[1], z0), A(f.b[0], f.b[1], z0), A(f.b[0], f.b[1], z1), A(f.a[0], f.a[1], z1)], st(c && (f.l ? c[1] : c[2])));
  });
  t.poly(p.map(function(q){ return A(q[0], q[1], z1); }), st(c && c[0]));
}
/* une composition posée sur son site ; `col(v, e)` dit la couleur */
function composition(t, A, vols, col, second){
  var z00 = Infinity, C = [];
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  vols.forEach(function(v){
    if(v.ph && !second) return;
    etagesDe(v).forEach(function(e){
      if(lvlOf(e.e.i) < 0) return;
      C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00, c:col(v, e), o:v.ph ? TIRETS : null });
    });
  });
  t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.4 });
  C.sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); });
}
function hauteur(vols){
  var h = 12;
  vols.forEach(function(v){ var et = etagesDe(v); if(et.length) h = Math.max(h, et[et.length - 1].z1 - et[0].z0); });
  return h;
}
/* des lignes de texte, « libellé : valeur », dans un cadre */
function tableau(t, cadre, L){
  var lh = Math.min(16, cadre[3] / (L.length + 1)), y = cadre[1] + cadre[3] - lh;
  L.forEach(function(r){
    t.texte(cadre[0], y, r[0], { size:7.5, fill:TXT });
    t.texte(cadre[0] + cadre[2] * .42, y, r[1], { size:8, gras:true, fill:r[2] ? E.accent : E.noir });
    y -= lh;
  });
}

/* ---------- les cases ---------- */
function etapes(vols){
  var T = vols.trace || {}, N = T.N || [], hmax = hauteur(vols), props = vols.props || [vols];
  var sport = vols.filter(function(v){ return v.fix && !v.ph; })[0], RV = reculVise();
  var n = vols.essais || 1, ok = vols.valides || 1, ech = vols.echecs || {};
  var S = [];

  S.push({ n:"CE QUI EST FIXÉ", d:"Avant tout tirage : les surfaces que le mixer a rangées par niveau, la salle de sport, le recul, les bornes de profondeur. Rien de cela ne varie.",
    f:function(t, cadre){
      var L = N.map(function(x){ return [x.nom, fmt(Math.round(x.A)) + " m² bâtis"]; });
      if(T.imp) L.push(["Salle de sport double", T.imp.d + " × " + T.imp.w + " m, au rez"]);
      L.push(["Recul sur le périmètre", RV ? nb(RV) + " m" : "aucun"]);
      L.push(["Entre bâtiments", "5 m (AEAI)"]);
      if(T.lo != null) L.push(["Profondeur d'un corps", "entre " + nb(T.lo + 1) + " et " + nb(T.hi + 1) + " m"]);
      tableau(t, cadre, L);
    } });

  S.push({ n:"CE QUI EST TIRÉ", d:"Pour CE volume, le hasard a donné ces valeurs, dans le cadre fixé. Un autre tirage donne un autre volume.",
    f:function(t, cadre){
      var L = [["Parti", partiOf(vols.parti || MASS.parti).n, 1]];
      if(vols.prof) L.push(["Profondeur des corps", nb(vols.prof + 1) + " m", 1]);
      if(T.cap) L.push(["Orientation", CAP[T.cap] || T.cap, 1]);
      if(vols.T) L.push(["Angle posé", deg(vols.T.a) + "°", 1]);
      if(vols.T) L.push(["Position (centre)", Math.round(vols.T.x) + " / " + Math.round(vols.T.y) + " m", 1]);
      if(T.S) L.push(["Corps", T.S.filter(function(s){ return s.haut > 1; }).length + " hauts, " + T.S.filter(function(s){ return s.haut <= 1; }).length + " au rez", 1]);
      if(sport) L.push(["Salle de sport", sport.joint ? "accolée à un corps" : "à part, au point bas", 1]);
      L.push(["Passerelles", String((vols.ponts || []).length), 1]);
      tableau(t, cadre, L);
    } });

  S.push({ n:"ESSAYER", d:n + " compositions tirées ainsi. En noir la retenue, en orange les " + ok + " qui tiennent toutes les règles dures, en blanc les écartées.",
    f:function(t, cadre){
      var cols = Math.ceil(Math.sqrt(n * cadre[2] / cadre[3])), rows = Math.ceil(n / cols);
      var s = Math.min(cadre[2] / cols, cadre[3] / rows), c0 = s * .72;
      var x0 = cadre[0] + (cadre[2] - cols * s) / 2, y0 = cadre[1] + (cadre[3] + rows * s) / 2;
      for(var i = 0; i < n; i++){
        var x = x0 + (i % cols) * s, y = y0 - (Math.floor(i / cols) + 1) * s;
        var q = [[x, y], [x + c0, y], [x + c0, y + c0], [x, y + c0]];
        t.poly(q, i === 0 ? { fill:E.noir } : i < ok ? { fill:E.accent } : { stroke:GRIS, lw:.4 });
      }
    } });

  var K = Object.keys(ech).sort(function(a, b){ return ech[b] - ech[a]; });
  if(K.length) S.push({ n:"ÉCARTER", d:(n - ok) + " essais écartés, chacun à la première règle dure enfreinte. La cause la plus fréquente : " + (CAUSE[K[0]] || K[0]) + ".",
    f:function(t, cadre){
      var mx = ech[K[0]], bh = Math.min(16, cadre[3] / (K.length + 1)), W = cadre[2] * .45, y = cadre[1] + cadre[3] - bh;
      K.forEach(function(k){
        t.texte(cadre[0], y + 3, CAUSE[k] || k, { size:7, fill:TXT });
        barre(t, cadre[0] + cadre[2] * .5, y, W * ech[k] / mx, bh * .7, E.cote2);
        t.texte(cadre[0] + cadre[2] * .5 + W * ech[k] / mx + 4, y + 3, String(ech[k]), { size:7, gras:true });
        y -= bh;
      });
    } });

  var P = props.slice(0, 6);
  S.push({ n:"LES SURVIVANTES", d:"Parmi les valides, la meilleure de chaque parti, avec sa note au jugement. Toutes sont réglementaires ; seule la note les sépare.",
    f:function(t, cadre){
      var c = Math.min(3, P.length), r = Math.ceil(P.length / c), w = cadre[2] / c, h = cadre[3] / r;
      P.forEach(function(p, i){
        var x = cadre[0] + (i % c) * w, y = cadre[1] + cadre[3] - (Math.floor(i / c) + 1) * h;
        var A = axo([x + 2, y + 12, w - 4, h - 14], hmax);
        composition(t, A, p, function(){ return p === vols ? ACC : BLANC; });
        t.texte(x + w / 2, y + 2, partiOf(p.parti).n + " · " + (p.score != null ? p.score : "—"), { size:6.5, gras:p === vols, ancre:"middle" });
      });
    } });

  var e1 = evaluer(vols), e2 = props[1] ? evaluer(props[1]) : null;
  if(e1 && e2) S.push({ n:"POURQUOI CELLE-CI", d:"Axe par axe, la retenue (orange) contre la deuxième, " + partiOf(props[1].parti).n.toLowerCase() + " (gris) : "
      + e1.jugement.total + " contre " + e2.jugement.total + " sur 100"
      + (e1.jugement.total === e2.jugement.total ? " — à égalité, c'est l'ordre du tirage qui les départage (préférence d'orientation, et 20 % de hasard)." : "."),
    f:function(t, cadre){
      var A1 = e1.jugement.axes, A2 = e2.jugement.axes, bh = Math.min(20, cadre[3] / (A1.length + 1)), W = cadre[2] * .42, y = cadre[1] + cadre[3] - bh;
      A1.forEach(function(a, i){
        var b = A2[i] || {}, s1 = a.s == null ? 0 : a.s, s2 = b.s == null ? 0 : b.s;
        coupe(a.n, 30).slice(0, 2).forEach(function(l, k){ t.texte(cadre[0], y + 5 - k * 7, l, { size:6.5, fill:TXT }); });
        var x = cadre[0] + cadre[2] * .52;
        barre(t, x, y + bh * .38, W * s1, bh * .3, E.accent);
        barre(t, x, y + bh * .02, W * s2, bh * .3, E.cote2);
        t.texte(x + W * Math.max(s1, s2) + 4, y + bh * .2, Math.round(100 * s1) + " / " + Math.round(100 * s2), { size:6.5, gras:true });
        y -= bh;
      });
    } });

  S.push({ n:"LE VOLUME RETENU", d:"La composition la mieux notée, dans les couleurs du programme ; piscine et chauffage à distance en pointillé.",
    f:function(t, cadre){
      composition(t, axo(cadre, hmax), vols, function(v, e){ return couleur(familleDom(e.e.i)); }, true);
    } });
  return S;
}

/* ---------- la planche ---------- */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 34;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, cols = n <= 4 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols);
  t.texte(m, F.h - m - 26, "COMMENT CE VOLUME A ÉTÉ TROUVÉ", { size:30, gras:true });
  t.texte(m, F.h - m - 46, "Tirer des compositions dans un cadre fixe, écarter ce qui enfreint une règle dure, garder la mieux notée.",
    { size:10, fill:[0.4, 0.4, 0.4] });
  var top = F.h - m - 76, cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 52], [x + cw, y + 52], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, [x, y + 60, cw, ch - 66]);
    t.fin();
    t.texte(x, y + 38, ("0" + (i + 1)).slice(-2), { size:9, gras:true, fill:E.accent });
    t.texte(x + 18, y + 38, s.n, { size:15, gras:true });
    coupe(s.d, Math.round(cw / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 9, l, { size:7.5, fill:TXT }); });
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
