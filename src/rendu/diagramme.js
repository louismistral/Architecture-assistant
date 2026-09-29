/* ============================================================================
   PLANCHE MASSING · PROCESSUS — A2, vectoriel

   Le raisonnement du générateur, dans l'ordre où il le tient (`mass/gen.js —
   genMass`) : le site, le programme mis en volume, le recul, la figure du
   parti, l'orientation, la salle de sport, les étages, le sous-sol, les
   passerelles, le tri. Une case par décision RÉELLEMENT prise pour cette
   composition : pas de sous-sol, pas de case « sous-sol ». Le nombre de cases
   suit, la grille aussi.

   Le style est celui de la planche de référence (`diagramme.pdf`) : fond
   blanc, contexte gris, parcelle au trait rouge, le volume saumon et ses
   flancs brique, des flèches noires, le soleil ; les couleurs du programme
   n'arrivent qu'à la dernière case. Chaque case porte un numéro, un titre et
   ce qui a décidé, lu dans l'état.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { DOC } from "../data/doctrine.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { FLOORS, flHeight, flNet, lvlOf } from "../mix/floors.js";
import { airePoly, airePosable, bbox, coins, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";
import { jugementCourant } from "../mass/juge.js";

var E = ENCRE;
function couleur(f){
  /* la couleur de la famille, résolue par le navigateur ; gris hors navigateur */
  return typeof document !== "undefined" ? cssRGB(famTok(f)) : [0.7, 0.7, 0.7];
}
function teinte(c, k){ return c.map(function(v){ return v * k; }); }
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

/* ---------- l'axonométrie d'une case ----------
   Vue du sud-ouest : le site tourne de `r`, la profondeur s'écrase, la hauteur
   monte. La parcelle et son contexte proche sont calés dans `cadre`. */
function axo(cadre, hmax){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(PER.map(function(p){ return brut(p[0], p[1], 0); }).concat(
    PER.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.86;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  A.cadre = cadre;
  return A;
}
/* Un prisme : ses faces visibles, de la plus lointaine à la plus proche, puis
   son toit. `c` : [toit, flanc]. */
function prisme(t, A, poly, z0, z1, c, o){
  o = o || {};
  var p = ccw(poly), F = [];
  for(var i = 0; i < p.length; i++){
    var a = p[i], b = p[(i + 1) % p.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    F.push({ a:a, b:b, d:A.prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), l:Math.abs(n[0]) > Math.abs(n[1]) });
  }
  F.sort(function(u, v){ return v.d - u.d; }).forEach(function(f){
    t.poly([A(f.a[0], f.a[1], z0), A(f.b[0], f.b[1], z0), A(f.b[0], f.b[1], z1), A(f.a[0], f.a[1], z1)],
      { fill: f.l ? c[1] : teinte(c[1], 1.12), stroke:o.trait || E.noir, lw:o.lw || .3 });
  });
  t.poly(p.map(function(q){ return A(q[0], q[1], z1); }), { fill:c[0], stroke:o.trait || E.noir, lw:o.lw || .3, dash:o.dash });
}
function fleche(t, a, b, lw){
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.2 + lw * 1.6;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:E.noir, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:E.noir });
}
function soleil(t, p, r){
  for(var i = 0; i < 12; i++){
    var a = i / 12 * 2 * Math.PI;
    t.ligne([[p[0] + Math.cos(a) * r * 1.4, p[1] + Math.sin(a) * r * 1.4], [p[0] + Math.cos(a) * r * 2, p[1] + Math.sin(a) * r * 2]], { stroke:E.soleil, lw:.8 });
  }
  t.cercle(p[0], p[1], r, { fill:E.soleil, stroke:[0.85, 0.5, 0.05], lw:.5 });
}

/* ---------- ce que toute case montre : le contexte, la parcelle ---------- */
var CTX = null;
function contexte(){
  if(CTX) return CTX;
  var B = bbox(PER);
  CTX = [];
  SITE.bat.forEach(function(b, i){
    var c = bbox(b);
    if(c.cx < B.x0 - 45 || c.cx > B.x1 + 45 || c.cy < B.y0 - 45 || c.cy > B.y1 + 45) return;
    var h = SITE.bath[i] ? Math.max(3, SITE.bath[i][1] - SITE.bath[i][0]) : 6;
    CTX.push({ p:b, h:h, d:0 });
  });
  return CTX;
}
/* Tout ce qui a une hauteur, peint du plus loin au plus proche : le contexte
   et les corps de la case, dans une seule liste. */
function scene(t, A, corps){
  var L = contexte().map(function(b){
    var c = bbox(b.p);
    return { d:A.prof(c.cx, c.cy), z:0, f:function(){ prisme(t, A, b.p, 0, b.h, [E.contexte, [0.78, 0.78, 0.78]], { trait:[0.55, 0.55, 0.55], lw:.2 }); } };
  }).concat(corps);
  L.sort(function(a, b){ return Math.abs(a.d - b.d) > 3 ? b.d - a.d : a.z - b.z; });
  t.ligne(PER.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.rouge, lw:.6 });
  L.forEach(function(x){ x.f(); });
}
/* les corps de la composition, avec la couleur que dit `col(corps)` */
function corpsDe(t, A, vols, col, z00, o){
  var C = [];
  vols.forEach(function(v){
    etagesDe(v).forEach(function(e){
      if(v.ph && !(o && o.second)) return;
      var c = col(v, e);
      if(!c) return;
      C.push({ d:A.prof(e.rc.x, e.rc.y), z:e.z0, f:function(){
        prisme(t, A, coins(e.rc), Math.max(0, e.z0 - z00), e.z1 - z00, c, v.ph ? { dash:[2, 1.5] } : null);
      } });
    });
  });
  return C;
}
function saumon(){ return [E.volume, E.flanc]; }
function fantome(){ return [E.fantome, [0.95, 0.8, 0.74]]; }

/* ---------- les cases : une par décision prise ---------- */
function etapes(vols){
  var j = jugementCourant(), pa = partiOf(vols.parti || MASS.parti);
  function q(id){ return j ? j.fortes.concat(j.prefs).filter(function(c){ return c.id === id; })[0] : null; }
  var hs = [], net = 0, H = 0, z00 = Infinity, hmax = 0;
  FLOORS.forEach(function(f, i){ if(lvlOf(i) >= 0){ hs.push(i); net += flNet(i); H += flHeight(i); } });
  vols.forEach(function(v){
    var et = etagesDe(v);
    et.forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); });
  });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ hmax = Math.max(hmax, e.z1 - z00); }); });
  hmax = Math.max(hmax, H);
  /* la ligne de recul : sa plus grande boucle */
  var recul = ligneRecul(RULES.dist.retrait).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] || PER;
  var sport = vols.filter(function(v){ return v.fix && !v.ph; });
  var sous = [];
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) < 0) sous.push({ v:v, e:e }); }); });
  var ponts = vols.ponts || [], ecole = vols.filter(function(v){ return !v.ph; });
  var prof = vols.prof ? Math.round(vols.prof * 10) / 10 : null;
  var ang = ecole.length ? Math.round(((ecole[0].a * 180 / Math.PI) % 180 + 180) % 180) : 0;

  var S = [];
  S.push({ n:"Le site", d:"Une parcelle de " + fmt(RULES.site.aire) + " m² en zone publique A : ni gabarit, ni hauteur, "
    + "ni distance aux limites. Ce qui la tient : le Casino et ses jardins, les voisins, la nappe.",
    f:function(t, A){ scene(t, A, []); } });
  S.push({ n:"Le programme en volume", d:fmt(Math.round(net)) + " m² hors sol, sur " + hs.length + " niveaux empilés par le mixer : "
    + "l'école monte à " + fmt(Math.round(H * 10) / 10) + " m. C'est la matière à loger.",
    f:function(t, A){
      scene(t, A, [{ d:0, z:0, f:function(){ prisme(t, A, PER.slice(0, -1), 0, H, saumon()); } }]);
      [[60, 50], [110, 80], [130, 40]].forEach(function(p){ fleche(t, A(p[0], p[1], H + 2), A(p[0], p[1], H + 14), .9); });
    } });
  S.push({ n:"Le recul", d:RULES.dist.retrait + " m de recul sur tout le périmètre, " + RULES.dist.entre + " m entre bâtiments (AEAI) : "
    + "il reste " + fmt(Math.round(airePosable(RULES.dist.retrait))) + " m² posables.",
    f:function(t, A){
      scene(t, A, [{ d:0, z:0, f:function(){ prisme(t, A, recul, 0, H, saumon()); } }]);
      t.ligne(recul.map(function(p){ return A(p[0], p[1], 0); }).concat([A(recul[0][0], recul[0][1], 0)]), { stroke:E.rouge, lw:.4, dash:[2, 1.5] });
      [[PER[5], recul], [PER[12], recul], [PER[22], recul]].forEach(function(o){
        var p = o[0], c = bbox(PER), dx = c.cx - p[0], dy = c.cy - p[1], l = Math.hypot(dx, dy);
        fleche(t, A(p[0] - dx / l * 8, p[1] - dy / l * 8, H / 2), A(p[0] + dx / l * 6, p[1] + dy / l * 6, H / 2), .8);
      });
    } });
  S.push({ n:"La figure : " + pa.n.toLowerCase(), d:pa.d.split(/[.:]/)[0] + ". " + ecole.length + " corps"
    + (prof ? " de " + String(prof).replace(".", ",") + " m de profondeur, tirée entre " + DOC.profMin + " et " + DOC.profMax + " m" : "")
    + " : chacun prend une part des niveaux.",
    f:function(t, A){
      /* la figure au sol : l'emprise de chaque corps, sur l'aire posable */
      var C = [{ d:1e9, z:-1, f:function(){ prisme(t, A, recul, 0, .3, fantome(), { lw:.15 }); } }];
      ecole.forEach(function(v){
        var e = etagesDe(v).filter(function(x){ return lvlOf(x.e.i) >= 0; })[0];
        if(e) C.push({ d:A.prof(e.rc.x, e.rc.y), z:0, f:function(){ prisme(t, A, coins(e.rc), 0, 1.5, saumon()); } });
      });
      scene(t, A, C);
    } });
  var so = q("soleil"), al = q("align");
  S.push({ n:"L'orientation", d:"La figure tourne à " + ang + "° : " + [so && so.txt, al && al.txt].filter(Boolean).join(" ; ") + ".",
    f:function(t, A){
      scene(t, A, corpsDe(t, A, ecole, function(){ return saumon(); }, z00));
      var s0 = A(95, -40, hmax * 1.3);
      soleil(t, s0, 5);
      [[70, 40], [100, 55], [130, 50]].forEach(function(p){ t.ligne([s0, A(p[0], p[1], hmax * .5)], { stroke:E.soleil, lw:.9 }); });
    } });
  if(sport.length) S.push({ n:"La salle de sport", d:"28 × 32 m et 7 m libres : elle se pose au rez, d'un seul tenant, et rien ne la surmonte. "
    + "Le reste de l'école se range autour.",
    f:function(t, A){
      scene(t, A, corpsDe(t, A, ecole, function(v){ return v.fix ? saumon() : fantome(); }, z00));
      var v = sport[0], et = etagesDe(v), top = et.length ? et[et.length - 1].z1 - z00 : 8;
      fleche(t, A(v.x, v.y, top + 16), A(v.x, v.y, top + 2), 1);
    } });
  S.push({ n:"Les étages", d:"Chaque corps reçoit les niveaux qu'il porte, à la hauteur du mixer : "
    + hs.map(function(i){ return String(flHeight(i)).replace(".", ","); }).join(" + ") + " m. Les classes restent au plus au 2e étage.",
    f:function(t, A){ scene(t, A, corpsDe(t, A, ecole, function(){ return saumon(); }, z00)); } });
  if(sous.length) S.push({ n:"Le sous-sol", d:"Sous le corps le plus haut du terrain, là seulement où la nappe laisse "
    + String(RULES.dist.couverture).replace(".", ",") + " m de couverture : l'abri PC et la technique.",
    f:function(t, A){
      scene(t, A, corpsDe(t, A, ecole, function(v, e){ return lvlOf(e.e.i) < 0 ? null : fantome(); }, z00));
      /* sous le terrain : dessiné par-dessus, pour qu'on le voie */
      sous.forEach(function(s){
        var q = coins(s.e.rc), z0 = s.e.z0 - z00;
        prisme(t, A, q, z0, 0, saumon(), { lw:.4 });
        t.poly(q.map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.noir, lw:.5, dash:[2, 1.5] });
      });
      var s = sous[0].e.rc; fleche(t, A(s.x, s.y, 14), A(s.x, s.y, 1), 1);
    } });
  if(ponts.length) S.push({ n:"Les passerelles", d:ponts.length + " passerelle" + (ponts.length > 1 ? "s relient" : " relie")
    + " les bâtiments à l'étage : un seul ensemble, sans les fermer.",
    f:function(t, A){ scene(t, A, corpsDe(t, A, ecole, function(){ return saumon(); }, z00)); } });
  var props = vols.props || [vols];
  S.push({ n:"Le tri", d:Math.round(DOC.essais) + " compositions essayées" + (vols.valides ? ", " + vols.valides + " valides" : "")
    + " : toute règle dure enfreinte élimine. Les autres sont notées par les jugements ; celle-ci est la "
    + ((vols.rang || 0) + 1) + (vols.rang ? "e" : "re") + " sur " + props.length
    + (j && j.total != null ? ", " + j.total + " / 100." : "."),
    f:function(t, A){
      scene(t, A, corpsDe(t, A, vols, function(v, e){ var c = couleur(familleDom(e.e.i)); return [c, teinte(c, .72)]; }, z00, { second:true }));
    } });
  S.hmax = hmax;
  return S;
}

export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 48, g = 26;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, cols = n <= 4 ? n : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols);
  t.texte(m, F.h - m - 22, "MASSING — LE PROCESSUS", { size:26, gras:true });
  t.texte(m, F.h - m - 42, "Ce que le générateur a décidé, dans l'ordre, pour la composition à l'écran — "
    + n + " étapes. Parti : " + partiOf(vols.parti || MASS.parti).n + ".", { size:10, fill:[0.35, 0.35, 0.35] });
  var top = F.h - m - 62, cw = (F.w - 2 * m - (cols - 1) * g) / cols, ch = (top - m - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 50], [x + cw, y + 50], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo([x, y + 56, cw, ch - 60], S.hmax));
    t.fin();
    t.texte(x, y + 26, ("0" + (i + 1)).slice(-2), { size:22, gras:true });
    t.texte(x + 38, y + 38, s.n, { size:10.5, gras:true });
    coupe(s.d, Math.round((cw - 38) / 3.9)).slice(0, 3).forEach(function(l, k){ t.texte(x + 38, y + 26 - k * 9.5, l, { size:7.5, fill:[0.25, 0.25, 0.25] }); });
  });
  t.texte(F.w - m, m - 22, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.4, 0.4, 0.4], ancre:"end" });
  return t;
}
