/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — l'évolution volumétrique, à la manière de BIG

   Le volume a été généré ; la planche en fait le RÉTRO-DESSIN : partir d'un
   volume très simple et, par des transformations crédibles, arriver EXACTEMENT
   au volume généré. Le raisonnement s'adapte au volume, jamais l'inverse : la
   dernière case dessine les étages tels que `etagesDe()` les donne, sans rien
   retoucher, et chaque étape intermédiaire est tirée de cette géométrie finale.

     LE BLOC        la plus petite boîte, dans l'axe du corps principal, qui
                    contient tout le projet, à sa hauteur la plus haute
     ÉVIDER /       on ôte le vide : il ne reste que les emprises réelles, pleine
     DÉTACHER       hauteur (DÉTACHER s'il y a plusieurs bâtiments)
     ANCRER         la salle de sport descend à sa hauteur          — si elle existe
     ABAISSER       les corps qui portent moins de niveaux descendent — s'il y en a
     EN RETRAIT     les étages supérieurs se retirent               — s'ils le font
     LE SECOND TEMPS  piscine et chauffage à distance, en pointillé — s'ils sont posés
     LE VOLUME      le volume généré, identique, dans les couleurs du programme

   Une étape n'existe que si le volume final la contient : aucune opération
   n'est ajoutée pour faire nombre. Volumes blancs, ce que l'étape change en
   orange, flèches noires, un verbe en gras. La même planche s'affiche dans le
   rail du massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { flHeight, flName, lvlOf } from "../mix/floors.js";
import { bbox, coins, ecart } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var GRIS = [0.55, 0.55, 0.55], TXT = [0.3, 0.3, 0.3], TIRETS = { dash:[2.5, 1.8] };

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

/* ---------- la vue : la même pour toutes les cases ---------- */
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
  function st(fill){ return o.dash ? { stroke:o.trait || E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:E.noir, lw:.45 }; }
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
function sol(t, A){ t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 }); }

/* ---------- l'analyse du volume final ----------
   Tout ce que les étapes dessinent est lu ici, dans les étages posés. */
function analyse(vols){
  var C = [], z00 = Infinity;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){
    var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
    if(!et.length) return;
    C.push({ v:v, et:et, sol:et[0].rc, base:Math.max(0, et[0].z0 - z00), top:et[et.length - 1].z1 - z00,
             z:function(e){ return [Math.max(0, e.z0 - z00), e.z1 - z00]; } });
  });
  var ecole = C.filter(function(c){ return !c.v.ph; }), second = C.filter(function(c){ return c.v.ph; });
  /* l'axe : celui de la plus grande emprise */
  var maj = ecole.slice().sort(function(a, b){ return b.sol.w * b.sol.d - a.sol.w * a.sol.d; })[0];
  var th = maj ? maj.sol.a : 0, ct = Math.cos(th), st = Math.sin(th);
  /* la boîte la plus serrée dans cet axe, autour de toutes les emprises */
  var P = [];
  ecole.forEach(function(c){ P = P.concat(coins(c.sol)); });
  var L = P.map(function(p){ return [p[0] * ct + p[1] * st, -p[0] * st + p[1] * ct]; }), B = bbox(L);
  var boite = [[B.x0, B.y0], [B.x1, B.y0], [B.x1, B.y1], [B.x0, B.y1]].map(function(p){ return [p[0] * ct - p[1] * st, p[0] * st + p[1] * ct]; });
  var H = Math.max.apply(null, ecole.map(function(c){ return c.top; }).concat([1]));
  var aireSol = 0;
  ecole.forEach(function(c){ aireSol += c.sol.w * c.sol.d; });
  /* les bâtiments : les corps qui se touchent en forment un seul */
  var grp = ecole.map(function(c, i){ return i; });
  function f(i){ return grp[i] === i ? i : (grp[i] = f(grp[i])); }
  ecole.forEach(function(a, i){ ecole.forEach(function(b, k){ if(k > i && ecart(a.sol, b.sol) < .2) grp[f(i)] = f(k); }); });
  var nbat = ecole.filter(function(c, i){ return f(i) === i; }).length;
  var sport = ecole.filter(function(c){ return c.v.fix; })[0];
  /* un corps « bas » porte moins de niveaux que les plus hauts — pas seulement
     posé plus bas sur le terrain */
  var nmax = Math.max.apply(null, ecole.filter(function(c){ return !c.v.fix; }).map(function(c){ return c.et.length; }).concat([1]));
  var bas = ecole.filter(function(c){ return !c.v.fix && c.et.length < nmax; });
  /* un étage est en retrait quand son emprise est plus petite que celle du sol */
  var retraits = [];
  ecole.forEach(function(c){ c.et.slice(1).forEach(function(e){ if(e.rc.w * e.rc.d < c.sol.w * c.sol.d - 1) retraits.push({ c:c, e:e }); }); });
  return { C:C, ecole:ecole, second:second, boite:boite, B:B, H:H, aireSol:aireSol, nbat:nbat, sport:sport, bas:bas, retraits:retraits };
}
function boiteDe(c, z1, col){ return { x:c.sol.x, y:c.sol.y, q:coins(c.sol), z0:c.base, z1:z1, c:col }; }

/* ---------- les étapes ---------- */
function etapes(vols){
  var X = analyse(vols), S = [], pa = partiOf(vols.parti || MASS.parti);
  var vide = X.B.w * X.B.h - X.aireSol, part = vide / (X.B.w * X.B.h);
  var nonSport = X.ecole.filter(function(c){ return !c.v.fix; });
  function hauteurDe(c){ return c.v.fix || X.bas.indexOf(c) >= 0 ? c.top : X.H; }
  /* l'état « plein » de chaque étape : ce qui est déjà descendu, et le reste à H */
  function pleins(fait, col){
    return X.ecole.map(function(c){
      var h = fait(c) ? c.top : X.H;
      return boiteDe(c, h, col(c));
    });
  }

  S.push({ n:"LE BLOC", d:"Tout le projet tient dans une boîte de " + Math.round(X.B.w) + " × " + Math.round(X.B.h) + " m, dans l'axe du corps principal, "
      + nb(X.H) + " m de haut. C'est le point de départ.",
    f:function(t, A){ sol(t, A); peindre(t, A, [{ x:(X.B.x0 + X.B.x1) / 2, y:0, q:X.boite, z0:0, z1:X.H, c:ACC }]); } });

  var verbe = X.nbat > 1 ? "DÉTACHER" : part > .15 ? "ÉVIDER" : "DÉCOUPER";
  S.push({ n:verbe, d:(X.nbat > 1 ? "La boîte se détache en " + X.nbat + " bâtiments" : "On ôte ce que la boîte a de trop")
      + " : " + fmt(Math.round(vide)) + " m² de vide (" + Math.round(part * 100) + " %) deviennent cour et respiration ; il reste "
      + X.ecole.length + " corps, " + pa.n.toLowerCase() + ".",
    f:function(t, A){ sol(t, A); prisme(t, A, X.boite, 0, X.H, null, TIRETS); peindre(t, A, pleins(function(){ return false; }, function(){ return ACC; })); } });

  if(X.sport) S.push({ n:"ANCRER", d:"La salle de sport double descend à sa hauteur, " + nb(X.sport.top - X.sport.base) + " m : rien ne la surmonte, elle ancre le projet au sol.",
    f:function(t, A){
      sol(t, A);
      peindre(t, A, pleins(function(c){ return c === X.sport; }, function(c){ return c === X.sport ? ACC : BLANC; }));
      prisme(t, A, coins(X.sport.sol), X.sport.base, X.H, null, TIRETS);
      fleche(t, A(X.sport.sol.x, X.sport.sol.y, X.H + 10), A(X.sport.sol.x, X.sport.sol.y, X.sport.top + 2));
    } });

  if(X.bas.length) S.push({ n:"ABAISSER", d:X.bas.length + " corps ne portent que " + (X.bas[0].et.length > 1 ? "les niveaux inférieurs" : "le rez")
      + " (" + X.bas.map(function(c){ return c.et.length + " niv."; }).join(", ") + ") : ils descendent, le projet s'abaisse vers ses bords.",
    f:function(t, A){
      sol(t, A);
      peindre(t, A, pleins(function(c){ return c.v.fix || X.bas.indexOf(c) >= 0; }, function(c){ return X.bas.indexOf(c) >= 0 ? ACC : BLANC; }));
      X.bas.forEach(function(c){ prisme(t, A, coins(c.sol), c.base, X.H, null, TIRETS); });
      X.bas.slice(0, 4).forEach(function(c){ fleche(t, A(c.sol.x, c.sol.y, X.H + 8), A(c.sol.x, c.sol.y, c.top + 2), 1.1); });
    } });

  if(X.retraits.length) S.push({ n:"EN RETRAIT", d:X.retraits.length + " étage" + (X.retraits.length > 1 ? "s se retirent" : " se retire")
      + " : plus petits que le rez, ils laissent des terrasses. Le volume est maintenant celui qui a été généré.",
    f:function(t, A){
      sol(t, A);
      var C = [];
      X.ecole.forEach(function(c){ c.et.forEach(function(e){
        var z = c.z(e), r = X.retraits.some(function(x){ return x.e === e; });
        C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:z[0], z1:z[1], c:r ? ACC : BLANC });
      }); });
      peindre(t, A, C);
      /* ce qui a été retiré, en pointillé */
      X.retraits.forEach(function(x){ var z = x.c.z(x.e); prisme(t, A, coins(x.c.sol), z[0], z[1], null, TIRETS); });
    } });

  if(X.second.length) S.push({ n:"LE SECOND TEMPS", d:"La piscine et le chauffage à distance se posent à part, en pointillé : l'école fonctionne sans eux, et les accueille ensuite.",
    f:function(t, A){
      sol(t, A);
      var C = [];
      X.C.forEach(function(c){ c.et.forEach(function(e){
        var z = c.z(e);
        C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:z[0], z1:z[1], c:c.v.ph ? null : BLANC, o:c.v.ph ? { dash:[2.5, 1.8], trait:E.accent } : null });
      }); });
      peindre(t, A, C);
    } });

  /* le volume généré, tel quel : les étages de `etagesDe()`, sans retouche */
  var niv = {};
  X.ecole.forEach(function(c){ c.et.forEach(function(e){ niv[e.e.i] = 1; }); });
  S.push({ n:"LE VOLUME", d:"Le volume généré, identique, étage par étage dans les couleurs du programme : "
      + Object.keys(niv).map(function(i){ return flName(+i).toLowerCase() + " " + nb(flHeight(+i)) + " m"; }).join(", ") + ".",
    f:function(t, A){
      sol(t, A);
      var C = [];
      X.C.forEach(function(c){ c.et.forEach(function(e){
        var z = c.z(e);
        C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:z[0], z1:z[1], c:c.v.ph ? null : couleur(familleDom(e.e.i)), o:c.v.ph ? TIRETS : null });
      }); });
      peindre(t, A, C);
    } });
  S.X = X;
  void nonSport;
  return S;
}

/* ---------- la planche ---------- */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50, g = 34;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, X = S.X, top = F.h - m - 76;
  var cols = 3, best = 0;
  for(var c = 2; c <= 4; c++){
    var r0 = Math.ceil(n / c), w0 = (F.w - 2 * m - (c - 1) * g) / c, h0 = (top - m - (r0 - 1) * g) / r0 - 62;
    var e0 = Math.min(w0 / 2, h0);
    if(e0 > best){ best = e0; cols = c; }
  }
  var rows = Math.ceil(n / cols);
  /* le cadrage : la parcelle et tout le projet, à la même échelle dans toutes les cases */
  var pts = PER.slice();
  X.C.forEach(function(c){ pts = pts.concat(coins(c.sol)); });
  t.texte(m, F.h - m - 26, "L'ÉVOLUTION DU VOLUME", { size:30, gras:true });
  t.texte(m, F.h - m - 46, "D'une boîte au volume généré, en " + n + " étapes · " + partiOf(vols.parti || MASS.parti).n, { size:10, fill:[0.4, 0.4, 0.4] });
  var cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 52], [x + cw, y + 52], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo([x, y + 58, cw, ch - 62], pts, X.H * 1.25));
    t.fin();
    t.texte(x, y + 38, ("0" + (i + 1)).slice(-2), { size:9, gras:true, fill:E.accent });
    t.texte(x + 18, y + 38, s.n, { size:15, gras:true });
    coupe(s.d, Math.round(cw / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 9, l, { size:7.5, fill:TXT }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 6, y + ch / 2 + 30], [x + cw + g - 6, y + ch / 2 + 30], 1);
  });
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
