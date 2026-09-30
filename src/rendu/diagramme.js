/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — le volume en quatre gestes, à la manière de BIG

     01 LE BLOC       tout le volume de l'école en un seul bloc
     02 SÉPARER       comment ce bloc se partage en corps — s'il se partage
     03 ORIENTER      la figure tourne et se pose sur la parcelle
     04 LES NIVEAUX   chaque corps monte de ce qu'il porte : le jeu des niveaux

   Chaque geste part du précédent et garde le même volume. Tout vient de ce que
   le générateur a réellement produit : la figure en coordonnées locales,
   l'angle et sa source (`vols.trace`, posé par `genMass`), la translation
   (`vols.T`), les étages posés (`etagesDe`). Volumes blancs, ce que le geste
   change en orange, flèches noires, un verbe en gras. La même planche
   s'affiche dans le rail du massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { reculVise } from "../data/cadre.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { flName, lvlOf } from "../mix/floors.js";
import { airePoly, bbox, coins, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, partiOf } from "../mass/model.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var GRIS = [0.55, 0.55, 0.55], TXT = [0.3, 0.3, 0.3], TIRETS = { dash:[2.5, 1.8] };
var CAP = {
  axe:    "alignée sur le plus long côté de la parcelle",
  soleil: "tournée vers le meilleur compromis entre le soleil et la vue",
  libre:  "tournée librement autour de l'axe de la parcelle",
  pente:  "ses rangs suivent la pente"
};

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

/* ---------- la vue : la même axonométrie pour les quatre cases ---------- */
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
  function st(fill){ return o.dash ? { stroke:E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:E.noir, lw:.5 }; }
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
  lw = lw || 1.5;
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.5 + lw * 1.8;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:E.noir, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:E.noir });
}
function cote(t, a, b, txt){
  t.ligne([a, b], { stroke:E.accent, lw:.8 });
  [a, b].forEach(function(p){ t.cercle(p[0], p[1], 1.3, { fill:E.accent }); });
  t.texte((a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2, txt, { size:8, gras:true, fill:E.accent });
}
function sol(t, A, recul){
  t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 });
  if(recul) t.poly(recul.map(function(p){ return A(p[0], p[1], 0); }), { stroke:GRIS, lw:.5, dash:[3, 2] });
}

/* ---------- la figure : du repère local au site ---------- */
function repere(vols){
  var T = vols.trace || {}, S = (T.S || []).slice(), pos = vols.T;
  if(!S.length || !pos) return null;
  var cx = 0, cy = 0;
  S.forEach(function(s){ cx += s.x; cy += s.y; });
  cx /= S.length; cy /= S.length;
  /* un point local → le site, tourné de `a` (l'angle posé, ou 0 avant rotation) */
  function site(p, a){
    var x = p[0] - cx, y = p[1] - cy;
    return [pos.x + x * Math.cos(a) - y * Math.sin(a), pos.y + x * Math.sin(a) + y * Math.cos(a)];
  }
  function empreinte(s, a){
    var q = coins({ x:s.x, y:s.y, w:s.w + 1, d:s.d + 1, a:s.a || 0 });
    return q.map(function(p){ return site(p, a); });
  }
  return { S:S, site:site, empreinte:empreinte, a:pos.a };
}

/* ---------- les quatre gestes ---------- */
function etapes(vols){
  var R = repere(vols), T = vols.trace || {}, ecole = vols.filter(function(v){ return !v.ph; });
  /* la salle de sport n'est pas un corps de la figure : elle se pose à part,
     après ; le bloc ne porte que ce que la figure loge */
  var sport = ecole.filter(function(v){ return v.fix; })[0], figure = ecole.filter(function(v){ return !v.fix; });
  var RV = reculVise();
  var recul = RV ? ligneRecul(RV).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] : null;
  /* le volume réel de l'école hors sol, et sa hauteur la plus haute */
  var volume = 0, z00 = Infinity, hmax = 0;
  figure.forEach(function(v){ etagesDe(v).forEach(function(e){
    if(lvlOf(e.e.i) < 0) return;
    volume += e.rc.w * e.rc.d * (e.z1 - e.z0); z00 = Math.min(z00, e.z0);
  }); });
  if(!isFinite(z00)) z00 = 0;
  ecole.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) hmax = Math.max(hmax, e.z1 - z00); }); });
  /* les emprises de la figure, et la hauteur qu'aurait chaque corps si le
     volume restait réparti également : même volume, d'un geste à l'autre */
  var emprise = 0;
  if(R) R.S.forEach(function(s){ emprise += (s.w + 1) * (s.d + 1); });
  var hUni = emprise ? volume / emprise : hmax;
  /* le bloc : le rectangle qui enveloppe la figure non tournée, à la hauteur
     qui garde le volume */
  var pts0 = [];
  if(R) R.S.forEach(function(s){ pts0 = pts0.concat(R.empreinte(s, 0)); });
  var B0 = pts0.length ? bbox(pts0) : bbox(PER);
  var bloc = [[B0.x0, B0.y0], [B0.x1, B0.y0], [B0.x1, B0.y1], [B0.x0, B0.y1]];
  var hBloc = volume / Math.max(1, B0.w * B0.h);
  var HM = Math.max(hmax, hBloc, hUni) * 1.25;
  var S = [], n = R ? R.S.length : ecole.length, pa = partiOf(vols.parti || MASS.parti);

  S.push({ n:"LE BLOC", d:"Tout le volume de l'école" + (sport ? " hors salle de sport" : "") + ", " + fmt(Math.round(volume)) + " m³, en un seul bloc : "
      + Math.round(B0.w) + " × " + Math.round(B0.h) + " m sur " + nb(hBloc) + " m. Trop profond pour éclairer une classe.",
    f:function(t, A){
      sol(t, A, recul);
      peindre(t, A, [{ x:B0.cx, y:B0.cy, q:bloc, z0:0, z1:hBloc, c:ACC }]);
      cote(t, A(B0.x1, B0.y0, 0), A(B0.x1, B0.y0, hBloc), nb(hBloc) + " m");
    } });

  S.push({ n:"SÉPARER", d:n > 1
      ? "Le bloc se partage en " + n + " corps de " + nb((vols.prof || 0) + 1) + " m de profondeur — deux classes et leur couloir, chaque classe en façade — "
        + "rangés selon le parti « " + pa.n.toLowerCase() + " », à 5 m au moins quand ils ne se touchent pas."
      : "Le bloc reste d'un seul tenant : un corps de " + nb((vols.prof || 0) + 1) + " m de profondeur suffit.",
    f:function(t, A){
      sol(t, A, recul);
      prisme(t, A, bloc, 0, hBloc, null, TIRETS);
      var C = [];
      if(R) R.S.forEach(function(s){
        var q = R.empreinte(s, 0), c = bbox(q);
        C.push({ x:c.cx, y:c.cy, q:q, z0:0, z1:hUni, c:ACC });
      });
      peindre(t, A, C);
      /* les flèches : du centre du bloc vers chaque corps */
      C.slice(0, 6).forEach(function(k){
        var dx = k.x - B0.cx, dy = k.y - B0.cy, l = Math.hypot(dx, dy);
        if(l > 8) fleche(t, A(B0.cx, B0.cy, hBloc + 5), A(k.x - dx / l * 3, k.y - dy / l * 3, hUni + 5), 1.1);
      });
    } });

  S.push({ n:"ORIENTER", d:"La figure est " + (CAP[T.cap] || "tournée") + " : " + deg(R ? R.a : 0) + "°. "
      + "Elle se pose d'un bloc sur la parcelle, à la première place où tout tient" + (RV ? ", à " + nb(RV) + " m du bord." : "."),
    f:function(t, A){
      sol(t, A, recul);
      if(!R) return;
      R.S.forEach(function(s){ t.poly(R.empreinte(s, 0).map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.noir, lw:.5, dash:[2.5, 1.8] }); });
      var C = [];
      R.S.forEach(function(s){ var q = R.empreinte(s, R.a), c = bbox(q); C.push({ x:c.cx, y:c.cy, q:q, z0:0, z1:hUni, c:ACC }); });
      peindre(t, A, C);
      /* l'arc de la rotation, autour du centre de la figure */
      var P = [], r0 = Math.max(B0.w, B0.h) * .62, a1 = R.a;
      for(var i = 0; i <= 16; i++){ var a = a1 * i / 16; P.push(A(vols.T.x + Math.cos(a) * r0, vols.T.y + Math.sin(a) * r0, hUni + 6)); }
      t.ligne(P.slice(0, -1), { stroke:E.noir, lw:1.5 });
      fleche(t, P[P.length - 3], P[P.length - 1], 1.5);
    } });

  var top = 0;
  ecole.forEach(function(v){ etagesDe(v).forEach(function(e){ top = Math.max(top, lvlOf(e.e.i)); }); });
  var hauts = ecole.filter(function(v){ return etagesDe(v).some(function(e){ return lvlOf(e.e.i) === top; }); });
  var niv = {};
  ecole.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) niv[e.e.i] = e.h; }); });
  S.push({ n:"LES NIVEAUX", d:"Chaque corps monte de ce qu'il porte : " + hauts.length + " montent jusqu'au " + flName(Object.keys(niv).length ? +Object.keys(niv).sort(function(a, b){ return lvlOf(b) - lvlOf(a); })[0] : 0).toLowerCase()
      + ", les autres restent plus bas ; les étages se retirent en largeur"
      + (sport ? " ; la salle de sport, 7 m libres, " + (sport.joint ? "s'accole au rez" : "se pose à part") : "") + ". "
      + Object.keys(niv).sort(function(a, b){ return lvlOf(a) - lvlOf(b); }).map(function(i){ return flName(+i).toLowerCase() + " " + nb(niv[i]) + " m"; }).join(", ") + ".",
    f:function(t, A){
      sol(t, A, recul);
      var C = [];
      vols.forEach(function(v){
        etagesDe(v).forEach(function(e){
          if(lvlOf(e.e.i) < 0) return;
          C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00,
                   c:v.ph ? null : lvlOf(e.e.i) === top ? ACC : BLANC, o:v.ph ? TIRETS : null });
        });
      });
      peindre(t, A, C);
      var h = hauts[0] && etagesDe(hauts[0]);
      if(h && h.length){ var q0 = coins(h[0].rc)[1]; cote(t, A(q0[0], q0[1], 0), A(q0[0], q0[1], hmax), nb(hmax) + " m"); }
    } });
  S.hmax = HM;
  return S;
}

/* ---------- la planche : quatre cases, deux par deux ---------- */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 40;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, cols = 2, rows = Math.ceil(n / cols);
  t.texte(m, F.h - m - 26, "LE VOLUME EN QUATRE GESTES", { size:30, gras:true });
  t.texte(m, F.h - m - 46, partiOf(vols.parti || MASS.parti).n + " — un bloc, séparé, orienté, étagé", { size:10, fill:[0.4, 0.4, 0.4] });
  var top = F.h - m - 76, cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 56], [x + cw, y + 56], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo([x, y + 62, cw, ch - 66], S.hmax));
    t.fin();
    t.texte(x, y + 40, ("0" + (i + 1)).slice(-2), { size:11, gras:true, fill:E.accent });
    t.texte(x + 24, y + 40, s.n, { size:18, gras:true });
    coupe(s.d, Math.round(cw / 4)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 10, l, { size:8.5, fill:TXT }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 8, y + ch / 2 + 30], [x + cw + g - 8, y + ch / 2 + 30], 1.2);
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
