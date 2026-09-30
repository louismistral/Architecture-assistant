/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — A2, vectoriel, à la manière de BIG

   Comment le volume est né, en une suite de gestes : chaque case applique UN
   verbe au résultat de la précédente — occuper, reculer, compacter, découper,
   tourner, ancrer, empiler, creuser, relier, choisir, habiter. Même vue, même
   échelle d'une case à l'autre, pour qu'on lise la transformation. Les
   volumes sont blancs ; ce que l'étape change est en couleur ; les flèches
   disent le geste. Une case n'existe que si le générateur a pris la décision
   pour la composition à l'écran (pas de sous-sol : pas de « creuser »).

   Tout est lu dans l'état (`genMass`, le mixer, le jugement). La même planche
   s'affiche dans le rail du massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { V, reculVise } from "../data/cadre.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { FLOORS, flHeight, flNet, lvlOf } from "../mix/floors.js";
import { airePoly, airePosable, bbox, coins, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";
import { evaluationCourante } from "../mass/mesures.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
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

/* ---------- la vue : la même pour toutes les cases ---------- */
function axo(cadre, hmax){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(PER.map(function(p){ return brut(p[0], p[1], 0); }).concat(
    PER.map(function(p){ return brut(p[0], p[1], hmax); })));
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
/* une flèche courbe : le geste de tourner */
function arc(t, A, cx, cy, z, r, a0, a1){
  var P = [];
  for(var i = 0; i <= 16; i++){ var a = a0 + (a1 - a0) * i / 16; P.push(A(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
  t.ligne(P.slice(0, -1), { stroke:E.noir, lw:1.4 });
  fleche(t, P[P.length - 3], P[P.length - 1], 1.4);
}
function soleil(t, p, r){
  for(var i = 0; i < 12; i++){
    var a = i / 12 * 2 * Math.PI;
    t.ligne([[p[0] + Math.cos(a) * r * 1.5, p[1] + Math.sin(a) * r * 1.5], [p[0] + Math.cos(a) * r * 2.2, p[1] + Math.sin(a) * r * 2.2]], { stroke:E.soleil, lw:1 });
  }
  t.cercle(p[0], p[1], r, { fill:E.soleil });
}

/* ---------- le sol et les corps ---------- */
function sol(t, A){ t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:[0.45, 0.45, 0.45], lw:.5 }); }
/* peint des corps { x, y, q, z0, z1, c, o } du plus loin au plus proche */
function peindre(t, A, C){
  C.sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); });
}
/* les étages hors sol d'une composition ; `col(v, e)` dit la couleur ;
   `o.plat` : chaque corps en une boîte, jusqu'à `o.h` ou son sommet */
function corps(vols, z00, col, o){
  var C = [];
  vols.forEach(function(v){
    if(v.ph && !(o && o.second)) return;
    var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
    if(!et.length) return;
    if(o && o.plat){
      var e0 = et[0];
      C.push({ x:e0.rc.x, y:e0.rc.y, q:coins(e0.rc), z0:0, z1:o.h || et[et.length - 1].z1 - z00, c:col(v, e0) });
      return;
    }
    et.forEach(function(e){
      C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00, c:col(v, e),
               o:v.ph ? { dash:[2.5, 1.8] } : null });
    });
  });
  return C;
}

/* ---------- les gestes ---------- */
function etapes(vols){
  var ev = evaluationCourante(), j = ev && ev.jugement, pa = partiOf(vols.parti || MASS.parti);
  function q(id){ return ev ? ev.qualites[id] : null; }
  var hs = [], net = 0, H = 0;
  FLOORS.forEach(function(f, i){ if(lvlOf(i) >= 0){ hs.push(i); net += flNet(i); H += flHeight(i); } });
  var z00 = Infinity, hmax = H;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ hmax = Math.max(hmax, e.z1 - z00); }); });
  /* le recul visé (`cadre.js`), s'il y en a un : sa plus grande boucle */
  var RV = reculVise();
  var recul = (RV ? ligneRecul(RV) : [PER.slice(0, -1)]).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] || PER;
  var ecole = vols.filter(function(v){ return !v.ph; }), sport = ecole.filter(function(v){ return v.fix; });
  var sous = [];
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) < 0) sous.push(e); }); });
  var ponts = vols.ponts || [], c0 = bbox(recul), cx = c0.cx, cy = c0.cy;
  var cote = Math.sqrt(net / Math.max(1, hs.length)), bloc = coins({ x:cx, y:cy, w:cote, d:cote, a:0 });
  var ang = ecole.length ? Math.round(((ecole[0].a * 180 / Math.PI) % 180 + 180) % 180) : 0;
  var tirets = { dash:[2.5, 1.8] };
  function blanc(){ return BLANC; }

  var S = [];
  S.push({ n:"OCCUPER", d:"Toute la parcelle, " + fmt(RULES.site.aire) + " m², à la hauteur du programme : "
      + nb(H) + " m sur " + hs.length + " niveaux. La zone A ne fixe aucun gabarit.",
    f:function(t, A){ sol(t, A); prisme(t, A, PER.slice(0, -1), 0, H, ACC);
      [[60, 55], [110, 85], [135, 45]].forEach(function(p){ fleche(t, A(p[0], p[1], H + 3), A(p[0], p[1], H + 16)); }); } });
  if(RV) S.push({ n:"RECULER", d:nb(RV) + " m sur tout le périmètre : il reste "
      + fmt(Math.round(airePosable(RV))) + " m² où poser.",
    f:function(t, A){ sol(t, A); prisme(t, A, PER.slice(0, -1), 0, H, null, tirets); prisme(t, A, recul, 0, H, ACC);
      [5, 12, 22].forEach(function(i){
        var p = PER[i], dx = cx - p[0], dy = cy - p[1], l = Math.hypot(dx, dy);
        fleche(t, A(p[0] - dx / l * 4, p[1] - dy / l * 4, H / 2), A(p[0] + dx / l * 9, p[1] + dy / l * 9, H / 2));
      }); } });
  S.push({ n:"COMPACTER", d:"Le programme seul : " + fmt(Math.round(net)) + " m² hors sol, un bloc de " + Math.round(cote)
      + " × " + Math.round(cote) + " m sur " + hs.length + " niveaux. Le reste du terrain se libère.",
    f:function(t, A){ sol(t, A); prisme(t, A, recul, 0, H, null, tirets); prisme(t, A, bloc, 0, H, ACC);
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function(d){
        fleche(t, A(cx + d[0] * (cote / 2 + 30), cy + d[1] * (cote / 2 + 30), H / 2), A(cx + d[0] * (cote / 2 + 4), cy + d[1] * (cote / 2 + 4), H / 2));
      }); } });
  S.push({ n:"DÉCOUPER", d:pa.n + " : " + pa.d.split(/[.:]/)[0].toLowerCase() + ". " + ecole.length + " corps"
      + (vols.prof ? " de " + nb(vols.prof) + " m de profondeur, tirée entre " + V.profMin + " et " + V.profMax + " m" : "") + ".",
    f:function(t, A){ sol(t, A); prisme(t, A, bloc, 0, H, null, tirets);
      peindre(t, A, corps(ecole, z00, function(){ return ACC; }, { plat:true, h:H }));
      ecole.slice(0, 5).forEach(function(v){
        var dx = v.x - cx, dy = v.y - cy, l = Math.hypot(dx, dy);
        if(l > 12) fleche(t, A(cx + dx / l * 6, cy + dy / l * 6, H + 4), A(v.x - dx / l * 4, v.y - dy / l * 4, H + 4), 1);
      }); } });
  var so = q("soleil"), vu = q("vue");
  S.push({ n:"TOURNER", d:"La figure à " + ang + "° : " + ([so && so.txt, vu && vu.txt].filter(Boolean).join(" ; ") || "vers le soleil et la vue") + ".",
    f:function(t, A){ sol(t, A); peindre(t, A, corps(ecole, z00, function(){ return ACC; }, { plat:true, h:H }));
      arc(t, A, cx, cy, H + 6, 34, 2.2, 0.9);
      var s0 = A(cx, cy - 95, hmax * 1.1); soleil(t, s0, 5);
      ecole.slice(0, 3).forEach(function(v){ t.ligne([s0, A(v.x, v.y, H * .6)], { stroke:E.soleil, lw:.9 }); }); } });
  if(sport.length) S.push({ n:"ANCRER", d:"La salle de sport double, 28 × 32 m et 7 m libres : au rez, d'un seul tenant, rien au-dessus.",
    f:function(t, A){ sol(t, A); peindre(t, A, corps(ecole, z00, function(v){ return v.fix ? ACC : BLANC; }, { plat:true, h:H }));
      var v = sport[0]; fleche(t, A(v.x, v.y, H + 22), A(v.x, v.y, H + 3)); } });
  S.push({ n:"EMPILER", d:"Chaque corps prend les niveaux qu'il porte, à la hauteur du mixer : "
      + hs.map(function(i){ return nb(flHeight(i)); }).join(" + ") + " m. Les classes au plus au 2e étage.",
    f:function(t, A){ sol(t, A);
      var top = lvlOf(hs[hs.length - 1]);
      peindre(t, A, corps(ecole, z00, function(v, e){ return lvlOf(e.e.i) === top ? ACC : BLANC; })); } });
  if(sous.length) S.push({ n:"CREUSER", d:"Sous le corps le plus haut du terrain, là où la nappe laisse " + nb(RULES.dist.couverture)
      + " m de couverture : l'abri PC et la technique.",
    f:function(t, A){ sol(t, A); peindre(t, A, corps(ecole, z00, blanc));
      sous.forEach(function(e){ prisme(t, A, coins(e.rc), e.z0 - z00, Math.min(0, e.z1 - z00), ACC, { lw:.5 }); });
      var r = sous[0].rc; fleche(t, A(r.x, r.y, hmax + 10), A(r.x, r.y, 2)); } });
  if(ponts.length) S.push({ n:"RELIER", d:ponts.length + " passerelle" + (ponts.length > 1 ? "s" : "") + " à l'étage : un seul ensemble.",
    f:function(t, A){ sol(t, A); peindre(t, A, corps(ecole, z00, blanc)); } });
  var props = (vols.props || [vols]).slice(0, 3);
  S.push({ n:"CHOISIR", d:Math.round(V.essais) + " compositions essayées" + (vols.valides ? ", " + vols.valides + " valides" : "")
      + ". Toute règle dure enfreinte élimine, les jugements classent : celle-ci, " + (j && j.total != null ? j.total + " / 100." : "la première."),
    f:function(t, A, cadre){
      /* les meilleures côte à côte, la retenue en couleur */
      var w = cadre[2] / props.length;
      props.forEach(function(p, i){
        var B = axo([cadre[0] + i * w, cadre[1] + 10, w, cadre[3] - 10], hmax);
        sol(t, B);
        peindre(t, B, corps(p, z00, function(){ return p === vols ? ACC : BLANC; }, { plat:true }));
        if(p.score != null) t.texte(cadre[0] + i * w + w / 2, cadre[1] + 2, p.score + " / 100", { size:7, gras:p === vols, ancre:"middle" });
      }); } });
  S.push({ n:"HABITER", d:"Le programme en place, étage par étage, dans les couleurs de ses familles ; piscine et chauffage en pointillé.",
    f:function(t, A){ sol(t, A); peindre(t, A, corps(vols, z00, function(v, e){ return couleur(familleDom(e.e.i)); }, { second:true })); } });
  S.hmax = hmax;
  return S;
}

export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 30;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, top0 = F.h - m - 76;
  /* la grille qui donne les plus grands dessins : une axonométrie du site est
     environ 2,2 fois plus large que haute, sous sa légende de 62 pt */
  var cols = 3, best = 0;
  for(var c = 2; c <= 6; c++){
    var r0 = Math.ceil(n / c), w0 = (F.w - 2 * m - (c - 1) * g) / c, h0 = (top0 - m - (r0 - 1) * g) / r0 - 62;
    var e0 = Math.min(w0 / 2.2, h0);
    if(e0 > best){ best = e0; cols = c; }
  }
  var rows = Math.ceil(n / cols);
  t.texte(m, F.h - m - 26, "COMMENT LE VOLUME EST NÉ", { size:30, gras:true });
  t.texte(m, F.h - m - 46, n + " gestes, dans l'ordre du générateur · " + partiOf(vols.parti || MASS.parti).n, { size:10, fill:[0.4, 0.4, 0.4] });
  var top = top0, cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    var cadre = [x, y + 58, cw, ch - 62];
    t.decoupe([[x, y + 52], [x + cw, y + 52], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo(cadre, S.hmax), cadre);
    t.fin();
    t.texte(x, y + 38, ("0" + (i + 1)).slice(-2), { size:9, gras:true, fill:E.accent });
    t.texte(x + 18, y + 38, s.n, { size:15, gras:true });
    coupe(s.d, Math.round(cw / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 9, l, { size:7.5, fill:[0.3, 0.3, 0.3] }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 6, y + ch / 2 + 30], [x + cw + g - 6, y + ch / 2 + 30], 1);
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
