/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — A2, vectoriel, à la manière de BIG

   Huit axonométries en bande, du site au volume : chaque case montre UNE
   décision, un numéro, un titre, deux lignes. Tout est lu dans l'état : le
   site, le recul, le programme du mixer, le parti, la volumétrie, le soleil et
   la vue, la mobilité, le jugement. La même planche s'affiche dans le massing
   à chaque génération (`svg()`), et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { FLOORS, flHeight, flName, flNet } from "../mix/floors.js";
import { bbox, cibleVue, coins, dedans, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";
import { jugementCourant } from "../mass/juge.js";
import { JUGES } from "../data/jugements.js";
import { mobilite } from "./mobilite.js";

var E = ENCRE;
function couleur(f){
  /* la couleur de la famille, résolue par le navigateur ; gris hors navigateur */
  return typeof document !== "undefined" ? cssRGB(famTok(f)) : [0.7, 0.7, 0.7];
}
function teinte(c, k){ return c.map(function(v){ return v * k; }); }
function coupe(s, n){
  var mots = s.split(" "), L = [], l = "";
  mots.forEach(function(m){ if((l + " " + m).trim().length > n){ L.push(l.trim()); l = m; } else l += " " + m; });
  if(l.trim()) L.push(l.trim());
  return L;
}

/* ---------- l'axonométrie d'une case ----------
   Vue du sud-ouest : on tourne le site de `r`, on écrase la profondeur, la
   hauteur monte. `cadre` = [x, y, w, h] en points ; la parcelle y est calée. */
function axo(cadre, hmax){
  var r = -0.62, el = 0.52, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(PER.map(function(p){ return brut(p[0], p[1], 0); }).concat(
    PER.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.92;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  return A;
}
/* une boîte : ses faces visibles, puis son toit */
function boite(t, A, q, z0, z1, col, o){
  o = o || {};
  for(var i = 0; i < 4; i++){
    var a = q[i], b = q[(i + 1) % 4], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    t.poly([A(a[0], a[1], z0), A(b[0], b[1], z0), A(b[0], b[1], z1), A(a[0], a[1], z1)],
      { fill: teinte(col, i % 2 ? 0.72 : 0.84), stroke:E.noir, lw:o.lw || .35 });
  }
  t.poly(q.map(function(p){ return A(p[0], p[1], z1); }), { fill:col, stroke:E.noir, lw:o.lw || .35 });
}
function sol(t, A, fill){
  t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:fill || [0.93, 0.93, 0.91], stroke:E.noir, lw:.5 });
}
function fleche(t, a, b, col, lw){
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 3 + lw * 2;
  t.ligne([a, b], { stroke:col, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:col });
}
/* les corps posés, du plus loin au plus proche ; `col(c)` dit la couleur */
function volumes(t, A, vols, col){
  var C = [];
  vols.forEach(function(v){
    etagesDe(v).forEach(function(e){ C.push({ v:v, e:e, q:coins(e.rc) }); });
  });
  var z00 = Math.min.apply(null, C.map(function(c){ return c.e.z0; }).concat([Infinity]));
  C.sort(function(a, b){
    var da = A.prof(a.e.rc.x, a.e.rc.y), db = A.prof(b.e.rc.x, b.e.rc.y);
    return Math.abs(da - db) > 4 ? db - da : a.e.z0 - b.e.z0;
  });
  C.forEach(function(c){
    if(c.v.ph){
      t.poly(c.q.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.noir, lw:.4, dash:[2, 1.5] });
      return;
    }
    boite(t, A, c.q, Math.max(0, c.e.z0 - z00), c.e.z1 - z00, col(c));
  });
}
function hauteurMax(vols){
  var h = 12;
  vols.forEach(function(v){
    var et = etagesDe(v);
    if(et.length) h = Math.max(h, et[et.length - 1].z1 - et[0].z0);
  });
  return h;
}

/* ---------- les huit cases ---------- */
function cases(vols){
  var j = jugementCourant(), p = partiOf(vols.parti || MASS.parti), M = null;
  function q(id){ return j ? j.fortes.concat(j.prefs).filter(function(c){ return c.id === id; })[0] : null; }
  var net = 0; FLOORS.forEach(function(f, i){ net += flNet(i); });
  var gris = [0.97, 0.97, 0.96];
  return [
    { n:"Le site", d:"Une parcelle de " + fmt(RULES.site.aire) + " m² entre la rue du Casino et le chemin du Petit Mont, au pied du Casino et de ses jardins.",
      f:function(t, A){
        SITE.bat.forEach(function(b, i){
          var c = bbox(b);
          if(!dedans([[-40, -40], [220, -40], [220, 170], [-40, 170]], c.cx, c.cy)) return;
          var h = SITE.bath[i] ? Math.max(3, SITE.bath[i][1] - SITE.bath[i][0]) : 6;
          t.poly(b.map(function(p){ return A(p[0], p[1], h); }), { fill:E.blanc, stroke:E.fin, lw:.3 });
        });
        sol(t, A, [0.86, 0.9, 0.82]);
      } },
    { n:"Les limites", d:"Recul de " + fmt(RULES.dist.retrait) + " m sur le périmètre ; la nappe à 3 m sous le terrain interdit presque tout sous-sol.",
      f:function(t, A){
        sol(t, A);
        t.poly(ligneRecul(RULES.dist.retrait).map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.rouge, lw:1, dash:[4, 2.5] });
      } },
    { n:"Le programme", d:fmt(Math.round(net)) + " m² sur " + FLOORS.length + " niveaux, empilés par le mixer : chaque dalle a la couleur de sa famille dominante.",
      f:function(t, A){
        sol(t, A);
        var cx = 88, cy = 60, z = 0;
        FLOORS.forEach(function(f, i){
          var a = Math.sqrt(Math.max(1, flNet(i))), h = flHeight(i);
          boite(t, A, coins({ x:cx, y:cy, w:a, d:a, a:0 }), z, z + h, couleur(familleDom(i)));
          z += h;
        });
      } },
    { n:"Le parti", d:p.n + " — " + p.d.split(/[.:]/)[0] + ".",
      f:function(t, A){
        sol(t, A);
        vols.forEach(function(v){
          var e = etagesDe(v)[0];
          if(e) t.poly(coins(e.rc).map(function(pt){ return A(pt[0], pt[1], 0); }), { fill:[0.25, 0.25, 0.25] });
        });
      } },
    { n:"L'empilement", d:"Chaque étage prend la couleur de ce qu'il porte : le sport au rez, les classes au plus au 2ᵉ étage.",
      f:function(t, A){ sol(t, A); volumes(t, A, vols, function(c){ return couleur(familleDom(c.e.e.i)); }); } },
    { n:"Soleil et vue", d:[q("soleil"), q("vue")].filter(Boolean).map(function(c){ return c.n + " : " + c.txt; }).join(" · ") || "Les longues façades des classes vers le sud, la vue vers le nord-ouest.",
      f:function(t, A){
        sol(t, A); volumes(t, A, vols, function(){ return gris; });
        fleche(t, A(90, -45, 35), A(90, 10, 14), [0.95, 0.65, 0.1], 2.2);
        /* la vue : vers la cible de `cibleVue()`, depuis le centre de la parcelle */
        var cv = cibleVue(), dx = cv.x - 90, dy = cv.y - 60, l = Math.hypot(dx, dy) || 1;
        fleche(t, A(90, 60, 22), A(90 + dx / l * 70, 60 + dy / l * 70, 22), [0.2, 0.45, 0.8], 1.6);
      } },
    { n:"La mobilité", d:"Bus et dépose-minute côté rue du Casino, piétons et vélos par le chemin du Petit Mont, " + RULES.ext.voitures + " places en bordure.",
      f:function(t, A){
        sol(t, A);
        M = M || mobilite(vols);
        M.lots.forEach(function(l){ t.poly(coins(l.rc).map(function(pt){ return A(pt[0], pt[1], 0); }), { fill:E.route, stroke:E.trait, lw:.3 }); });
        [M.bus, M.depose].forEach(function(r){ if(r) t.poly(coins(r).map(function(pt){ return A(pt[0], pt[1], 0); }), { fill:[0.95, 0.65, 0.1] }); });
        if(M.pieton) fleche(t, A(M.pieton[0][0], M.pieton[0][1], 0), A(M.pieton[1][0], M.pieton[1][1], 0), [0.2, 0.6, 0.35], 1.4);
        volumes(t, A, vols, function(){ return gris; });
      } },
    { n:"Le résultat", d:j && j.total != null ? "Note " + j.total + " / 100 — toutes les règles dures tenues ; " + meilleurs(j) + "."
                                             : "Aucune composition valide pour l'instant.",
      f:function(t, A){ sol(t, A, [0.86, 0.9, 0.82]); volumes(t, A, vols, function(){ return E.blanc; }); } }
  ];
}
function meilleurs(j){
  var L = (j.juges || []).slice().sort(function(a, b){ return b.w * b.sc - a.w * a.sc; }).slice(0, 2);
  return L.map(function(o){
    var x = JUGES.filter(function(y){ return y.id === o.id; })[0];
    return (x ? x.n.split(/[,:(]/)[0].toLowerCase() : o.id) + " " + Math.round(o.sc * 100) + " %";
  }).join(", ");
}

export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 48, g = 22;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  t.texte(m, F.h - m - 30, "Massing — du programme au volume", { size:34, gras:true });
  t.texte(m, F.h - m - 56, "Huit décisions, dans l'ordre où le générateur les prend. Parti : " + partiOf(vols.parti || MASS.parti).n
    + " · " + vols.length + " corps · " + FLOORS.map(function(f, i){ return flName(i); }).join(" / "), { size:11, fill:[0.35, 0.35, 0.35] });
  var top = F.h - m - 90, cw = (F.w - 2 * m - 3 * g) / 4, ch = (top - m - g) / 2, hm = hauteurMax(vols);
  cases(vols).forEach(function(c, i){
    var col = i % 4, row = Math.floor(i / 4);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    var A = axo([x, y + 96, cw, ch - 110], hm);
    c.f(t, A);
    t.ligne([[x, y + 88], [x + cw, y + 88]], { stroke:E.noir, lw:.8 });
    t.texte(x, y + 58, ("0" + (i + 1)).slice(-2), { size:26, gras:true });
    t.texte(x + 44, y + 68, c.n, { size:13, gras:true });
    coupe(c.d, 58).slice(0, 4).forEach(function(l, k){ t.texte(x + 44, y + 52 - k * 11, l, { size:8.5, fill:[0.25, 0.25, 0.25] }); });
    if(col < 3) fleche(t, [x + cw + 3, y + ch / 2 + 40], [x + cw + g - 3, y + ch / 2 + 40], E.noir, .8);
  });
  t.texte(F.w - m, m - 20, "Concours CS Saxon · planche massing · A2", { size:8, fill:[0.4, 0.4, 0.4], ancre:"end" });
  return t;
}
