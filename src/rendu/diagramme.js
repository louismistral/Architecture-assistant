/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — A2, vectoriel, à la manière de BIG

   Le raisonnement du générateur, étape par étape, tel qu'il le tient :

     PROGRAMME   ce qu'il faut loger : une colonne par famille, haute de ses m²
     EMPILER     le mixer range le programme en niveaux : les dalles, éclatées
     DÉCOUPER    chaque niveau devient des corps d'une profondeur admissible
     ASSEMBLER   le parti les assemble en une figure, encore hors du site
     POSER       la figure sur la parcelle, dans le recul
     VÉRIFIER    les essais : ceux qui tiennent toutes les règles dures, les autres
     CLASSER     les meilleures, par la note du jugement
     HABITER     la composition retenue, dans les couleurs du programme

   À la manière de BIG : un geste par case, un verbe en gras, des volumes
   blancs, ce que l'étape fait en orange, des flèches entre les cases. Tout
   est lu dans l'état (le programme, le mixer, `genMass`, le jugement). La même
   planche s'affiche dans le rail du massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { ITEMS } from "../core/model.js";
import { PER } from "../data/site.js";
import { FAM } from "../data/families.js";
import { V, reculVise } from "../data/cadre.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { FLOORS, flHeight, flName, flNet, lvlOf } from "../mix/floors.js";
import { airePoly, bbox, coins, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf, postesDe } from "../mass/model.js";
import { evaluationCourante } from "../mass/mesures.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var GRIS = [0.55, 0.55, 0.55], TIRETS = { dash:[2.5, 1.8] };
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
function rect(x, y, w, d){ return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]; }

/* ---------- la vue : la même axonométrie partout, calée sur `pts` ---------- */
function axo(cadre, pts, z0, z1){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(pts.map(function(p){ return brut(p[0], p[1], z0); }).concat(pts.map(function(p){ return brut(p[0], p[1], z1); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.88;
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
  function st(fill){ return o.dash ? { stroke:E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:E.noir, lw:o.lw || .45 }; }
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
/* peint des boîtes { x, y, q, z0, z1, c, o } du plus loin au plus proche */
function peindre(t, A, C){
  C.sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); });
}
function sol(t, A){ t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 }); }

/* ---------- les corps d'une composition ----------
   Les étages hors sol, en place ; `dx`/`dy` les déplacent tous d'un bloc. */
function corps(vols, z00, col, o){
  o = o || {};
  var C = [];
  vols.forEach(function(v){
    if(v.ph && !o.second) return;
    etagesDe(v).forEach(function(e){
      if(lvlOf(e.e.i) < 0) return;
      var q = coins(e.rc).map(function(p){ return [p[0] + (o.dx || 0), p[1] + (o.dy || 0)]; });
      C.push({ x:e.rc.x + (o.dx || 0), y:e.rc.y + (o.dy || 0), q:q, z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00,
               c:col(v, e), o:v.ph ? TIRETS : null });
    });
  });
  return C;
}
function points(C){ var P = []; C.forEach(function(c){ P = P.concat(c.q); }); return P.length ? P : PER; }

/* ---------- les étapes ---------- */
function etapes(vols){
  var ev = evaluationCourante(), j = ev && ev.jugement, pa = partiOf(vols.parti || MASS.parti);
  var ecole = vols.filter(function(v){ return !v.ph; });
  var z00 = Infinity, hmax = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ hmax = Math.max(hmax, e.z1 - z00); }); });
  var hs = [];
  FLOORS.forEach(function(f, i){ if(lvlOf(i) >= 0) hs.push(i); });
  var S = [];

  /* 1 · le programme, famille par famille */
  var fams = FAM.map(function(f){
    var a = 0;
    ITEMS.forEach(function(it){ if(it.f === f.id) a += it.nb * it.u; });
    return { f:f, a:a };
  }).filter(function(x){ return x.a > 0; });
  var tot = 0; fams.forEach(function(x){ tot += x.a; });
  S.push({ n:"PROGRAMME", d:fmt(Math.round(tot)) + " m² à loger, en " + fams.length + " familles : chaque colonne est haute de ses mètres carrés.",
    f:function(t, cadre){
      var cote = 12, pas = 16, C = [];
      fams.forEach(function(x, i){ C.push({ x:i * pas, y:0, q:rect(i * pas, 0, cote, cote), z0:0, z1:x.a / 60, c:couleur(x.f.id) }); });
      var A = axo(cadre, points(C), 0, Math.max.apply(null, C.map(function(c){ return c.z1; })));
      peindre(t, A, C);
    } });

  /* 2 · le mixer empile */
  S.push({ n:"EMPILER", d:"Le mixer range le programme en " + FLOORS.length + " niveaux : "
      + FLOORS.map(function(f, i){ return flName(i).toLowerCase() + " " + fmt(Math.round(flNet(i))) + " m²"; }).join(", ") + ".",
    f:function(t, cadre){
      var C = [], z = 0, gap = 5, sous = FLOORS.map(function(f, i){ return i; }).filter(function(i){ return lvlOf(i) < 0; });
      z = -sous.reduce(function(s, i){ return s + flHeight(i) + gap; }, 0);
      FLOORS.forEach(function(f, i){
        var cote = Math.sqrt(Math.max(1, flNet(i))), x = -cote / 2, P = postesDe(i), a0 = 0, tot = 0;
        P.forEach(function(p){ tot += p.a; });
        var par = {};
        P.forEach(function(p){ par[p.f] = (par[p.f] || 0) + p.a; });
        Object.keys(par).forEach(function(k){
          var w = cote * par[k] / (tot || 1);
          C.push({ x:x + a0 + w / 2, y:0, q:rect(x + a0, -cote / 2, w, cote), z0:z, z1:z + flHeight(i) * .45, c:couleur(k) });
          a0 += w;
        });
        z += flHeight(i) * .45 + gap;
      });
      var A = axo(cadre, points(C), Math.min.apply(null, C.map(function(c){ return c.z0; })), z);
      /* les dalles se peignent de bas en haut : l'éclaté se lit */
      C.sort(function(a, b){ return a.z0 - b.z0 || A.prof(b.x, b.y) - A.prof(a.x, a.y); }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c); });
    } });

  /* 3 · chaque niveau devient des corps */
  S.push({ n:"DÉCOUPER", d:"Chaque niveau devient des corps de " + (vols.prof ? nb(vols.prof) + " m" : "")
      + " de profondeur, entre " + V.profMin + " et " + V.profMax + " m : " + ecole.length + " corps, alignés avant d'être assemblés.",
    f:function(t, cadre){
      var C = [], x = 0;
      ecole.forEach(function(v){
        var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
        if(!et.length) return;
        var w = et[0].rc.w, d = et[0].rc.d;
        et.forEach(function(e){ C.push({ x:x + w / 2, y:0, q:rect(x, 0, e.rc.w, e.rc.d), z0:e.z0 - z00, z1:e.z1 - z00, c:ACC }); });
        x += w + 6;
        void d;
      });
      var A = axo(cadre, points(C), 0, hmax);
      peindre(t, A, C);
    } });

  /* 4 · le parti assemble */
  S.push({ n:"ASSEMBLER", d:pa.n + " : " + pa.d.split(/[.:]/)[0].toLowerCase() + ".",
    f:function(t, cadre){
      var C = corps(ecole, z00, function(){ return ACC; });
      var A = axo(cadre, points(C), 0, hmax);
      peindre(t, A, C);
    } });

  /* 5 · la figure se pose sur la parcelle */
  var RV = reculVise();
  var recul = RV ? ligneRecul(RV).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] : null;
  S.push({ n:"POSER", d:"La figure tourne et glisse jusqu'à tenir dans la parcelle" + (RV ? ", à " + nb(RV) + " m du périmètre" : "")
      + ", orientée vers le soleil et alignée sur le site.",
    f:function(t, cadre){
      var A = axo(cadre, PER, 0, hmax * 1.6);
      sol(t, A);
      if(recul) t.poly(recul.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.accent, lw:.6, dash:[3, 2] });
      var C = corps(ecole, z00, blanc);
      peindre(t, A, C);
      var c0 = bbox(points(C));
      fleche(t, A(c0.cx, c0.cy, hmax * 1.55), A(c0.cx, c0.cy, hmax + 3), 1.6);
    } });

  /* 6 · les essais et les règles dures */
  var n = vols.essais || Math.max(1, Math.round(V.essais)), ok = Math.min(n, vols.valides || 1);
  S.push({ n:"VÉRIFIER", d:n + " compositions essayées : " + ok + " tiennent toutes les règles dures, les autres sont écartées sans appel.",
    f:function(t, cadre){
      var cols = Math.ceil(Math.sqrt(n * cadre[2] / cadre[3])), rows = Math.ceil(n / cols);
      var s = Math.min(cadre[2] / cols, cadre[3] / rows), c0 = s * .72;
      var x0 = cadre[0] + (cadre[2] - cols * s) / 2, y0 = cadre[1] + (cadre[3] + rows * s) / 2;
      for(var i = 0; i < n; i++){
        var x = x0 + (i % cols) * s, y = y0 - (Math.floor(i / cols) + 1) * s;
        var q = [[x, y], [x + c0, y], [x + c0, y + c0], [x, y + c0]];
        if(i < ok) t.poly(q, { fill:E.accent });
        else {
          t.poly(q, { stroke:GRIS, lw:.5 });
          t.ligne([[x + c0 * .2, y + c0 * .2], [x + c0 * .8, y + c0 * .8]], { stroke:GRIS, lw:.5 });
          t.ligne([[x + c0 * .2, y + c0 * .8], [x + c0 * .8, y + c0 * .2]], { stroke:GRIS, lw:.5 });
        }
      }
    } });

  /* 7 · le jugement classe */
  var props = (vols.props || [vols]).slice(0, 4);
  S.push({ n:"CLASSER", d:"Le jugement note chaque variante valide ; la mieux notée est retenue"
      + (j && j.total != null ? " : " + j.total + " / 100." : "."),
    f:function(t, cadre){
      var w = cadre[2] / props.length, hb = cadre[3] * .25;
      /* les barres montrent l'écart entre les notes, pas leur valeur absolue */
      var sc0 = Math.min.apply(null, props.map(function(p){ return p.score || 0; })), sc1 = Math.max.apply(null, props.map(function(p){ return p.score || 0; }));
      props.forEach(function(p, i){
        var C = corps(p.filter(function(v){ return !v.ph; }), z00, function(){ return p === vols ? ACC : BLANC; });
        var A = axo([cadre[0] + i * w, cadre[1] + hb + 8, w, cadre[3] - hb - 8], PER, 0, hmax);
        sol(t, A); peindre(t, A, C);
        var sc = p.score != null ? p.score : 0, bx = cadre[0] + i * w + w * .3, bh = hb * (.25 + .75 * (sc - sc0) / ((sc1 - sc0) || 1));
        t.poly([[bx, cadre[1]], [bx + w * .4, cadre[1]], [bx + w * .4, cadre[1] + bh], [bx, cadre[1] + bh]], { fill:p === vols ? E.accent : E.cote2 });
        t.texte(bx + w * .2, cadre[1] + bh + 3, String(sc), { size:7, gras:p === vols, ancre:"middle" });
      });
    } });

  /* 8 · la composition retenue, habitée */
  S.push({ n:"HABITER", d:"La composition retenue, étage par étage dans les couleurs du programme ; piscine et chauffage à distance en pointillé.",
    f:function(t, cadre){
      var A = axo(cadre, PER, 0, hmax);
      sol(t, A);
      peindre(t, A, corps(vols, z00, function(v, e){ return couleur(familleDom(e.e.i)); }, { second:true }));
    } });
  return S;
  function blanc(){ return BLANC; }
}

/* ---------- la planche ----------
   Un grand titre, puis les étapes reliées par des flèches ; sous chaque
   dessin, le numéro, le verbe en gras, une ligne pour dire pourquoi. La grille
   prend le nombre de colonnes qui donne les plus grands dessins. */
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
  var rows = Math.ceil(n / cols);
  t.texte(m, F.h - m - 26, "COMMENT LE VOLUME EST NÉ", { size:30, gras:true });
  t.texte(m, F.h - m - 46, "Le raisonnement du générateur, du programme au bâtiment · " + partiOf(vols.parti || MASS.parti).n, { size:10, fill:[0.4, 0.4, 0.4] });
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
