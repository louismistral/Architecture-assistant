/* ============================================================================
   UN DESSIN VECTORIEL, DEUX SORTIES — l'écran (SVG) et l'impression (PDF)

   `trace(w, h)` accumule des primitives en POINTS, y vers le HAUT (le repère du
   PDF) : polygones, lignes, cercles, textes, découpes. `.svg()` les rend pour
   l'écran, `.pdf()` en fait un flux de contenu PDF. Une planche ne se dessine
   donc qu'une fois.

   Deux façons d'en faire un fichier, sans aucune dépendance :
     pdfNeuf(t)            un PDF d'une page, avec Helvetica ;
     pdfSur(base, t, t2)   le PDF `base` (octets) auquel on AJOUTE `t` par-dessus
                           sa première page (et `t2` sur la deuxième) — une mise à jour incrémentale : le
                           fichier d'origine reste intact, octet pour octet, et
                           la surcouche s'écrit à la suite.
   ========================================================================= */

function f(n){ return (Math.round(n * 100) / 100).toString(); }
function rgb(c){ return c.map(f).join(" "); }
function hex(c){
  return "#" + c.map(function(v){ return ("0" + Math.round(v * 255).toString(16)).slice(-2); }).join("");
}
/* Helvetica en WinAnsi : les accents français passent en octal. */
function chaine(s){
  var o = "";
  for(var i = 0; i < s.length; i++){
    var c = s.charCodeAt(i);
    if(c === 40 || c === 41 || c === 92) o += "\\" + s[i];
    else if(c < 128) o += s[i];
    else if(c < 256) o += "\\" + c.toString(8);
    else o += ({ 0x2019:"\\222", 0x2014:"\\227", 0x2013:"\\226", 0x2022:"\\225", 0x2026:"\\205", 0x2192:"->", 0x1D49:"e", 0x02B3:"r" })[c] || "?";
  }
  return "(" + o + ")";
}
function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

export function trace(w, h){
  var L = [];
  var t = {
    w: w, h: h, L: L,
    /* o : { fill:[r,g,b], stroke:[r,g,b], lw, dash:[a,b], op } */
    poly: function(pts, o){ if(pts.length > 1) L.push({ k:"p", pts:pts, o:o || {}, ferme:true }); return t; },
    ligne: function(pts, o){ if(pts.length > 1) L.push({ k:"p", pts:pts, o:o || {}, ferme:false }); return t; },
    cercle: function(x, y, r, o){ L.push({ k:"c", x:x, y:y, r:r, o:o || {} }); return t; },
    /* o : { size, gras, fill, ancre:"start"|"middle"|"end", rot (radians, sens direct),
             m:[ux, uy, vx, vy] (le repère du texte, pour l'écrire sur une face) } */
    texte: function(x, y, s, o){ L.push({ k:"t", x:x, y:y, s:String(s), o:o || {} }); return t; },
    /* tout ce qui suit, jusqu'à `fin()`, est découpé par `pts` */
    decoupe: function(pts){ L.push({ k:"clip", pts:pts }); return t; },
    fin: function(){ L.push({ k:"fin" }); return t; }
  };

  t.pdf = function(){
    var o = [];
    function peint(e, chemin){
      var a = e.o;
      o.push("q");
      if(a.lw != null) o.push(f(a.lw) + " w");
      if(a.dash) o.push("[" + a.dash.map(f).join(" ") + "] 0 d");
      if(a.fill) o.push(rgb(a.fill) + " rg");
      if(a.stroke) o.push(rgb(a.stroke) + " RG");
      o.push("1 j 1 J");
      o.push(chemin);
      o.push(a.fill && a.stroke ? "B" : a.fill ? "f" : "S");
      o.push("Q");
    }
    function chemin(pts, ferme){
      return pts.map(function(p, i){ return f(p[0]) + " " + f(p[1]) + (i ? " l" : " m"); }).join(" ") + (ferme ? " h" : "");
    }
    L.forEach(function(e){
      if(e.k === "p") peint(e, chemin(e.pts, e.ferme));
      else if(e.k === "c"){
        /* un cercle en quatre béziers */
        var k = .5523 * e.r, x = e.x, y = e.y, r = e.r;
        peint(e, [f(x + r) + " " + f(y) + " m",
          [x + r, y + k, x + k, y + r, x, y + r], [x - k, y + r, x - r, y + k, x - r, y],
          [x - r, y - k, x - k, y - r, x, y - r], [x + k, y - r, x + r, y - k, x + r, y]]
          .map(function(s){ return typeof s === "string" ? s : s.map(f).join(" ") + " c"; }).join(" ") + " h");
      } else if(e.k === "t"){
        var a = e.o, sz = a.size || 8;
        /* largeur approchée d'Helvetica pour centrer ou caler à droite */
        var dx = a.ancre === "middle" ? -.26 * sz * e.s.length : a.ancre === "end" ? -.52 * sz * e.s.length : 0;
        var co = Math.cos(a.rot || 0), si = Math.sin(a.rot || 0), m = a.m || [co, si, -si, co];
        o.push("BT /" + (a.gras ? "FHb" : "FH") + " " + f(sz) + " Tf " + rgb(a.fill || [0, 0, 0]) + " rg "
          + (a.rot || a.m ? m.concat([e.x + dx * m[0], e.y + dx * m[1]]).map(function(v){ return (Math.round(v * 1e4) / 1e4).toString(); }).join(" ") + " Tm "
                   : f(e.x + dx) + " " + f(e.y) + " Td ") + chaine(e.s) + " Tj ET");
      } else if(e.k === "clip") o.push("q " + chemin(e.pts, true) + " W n");
      else if(e.k === "fin") o.push("Q");
    });
    return o.join("\n");
  };

  t.svg = function(){
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f(w) + " " + f(h) + '" class="planche">'];
    var n = 0, ouverts = 0;
    function Y(y){ return f(h - y); }
    function style(a, texte){
      var s = texte ? "" : ' fill="' + (a.fill ? hex(a.fill) : "none") + '"';
      if(a.stroke && !texte) s += ' stroke="' + hex(a.stroke) + '" stroke-width="' + f(a.lw || 1)
        + '" stroke-linejoin="round" stroke-linecap="round"' + (a.dash ? ' stroke-dasharray="' + a.dash.map(f).join(" ") + '"' : "");
      return s;
    }
    L.forEach(function(e){
      if(e.k === "p"){
        o.push("<" + (e.ferme ? "polygon" : "polyline") + ' points="'
          + e.pts.map(function(p){ return f(p[0]) + "," + Y(p[1]); }).join(" ") + '"' + style(e.o) + "/>");
      } else if(e.k === "c") o.push('<circle cx="' + f(e.x) + '" cy="' + Y(e.y) + '" r="' + f(e.r) + '"' + style(e.o) + "/>");
      else if(e.k === "t"){
        var a = e.o;
        o.push('<text x="' + (a.m ? 0 : f(e.x)) + '" y="' + (a.m ? 0 : Y(e.y)) + '" font-family="Helvetica, Arial, sans-serif" font-size="'
          + f(a.size || 8) + '"' + (a.gras ? ' font-weight="700"' : "") + ' fill="' + hex(a.fill || [0, 0, 0]) + '"'
          + (a.ancre ? ' text-anchor="' + a.ancre + '"' : "")
          + (a.m ? ' transform="matrix(' + [a.m[0], -a.m[1], -a.m[2], a.m[3], e.x, h - e.y].map(function(v){ return (Math.round(v * 1e4) / 1e4).toString(); }).join(" ") + ')"'
             : a.rot ? ' transform="rotate(' + f(-a.rot * 180 / Math.PI) + " " + f(e.x) + " " + Y(e.y) + ')"' : "") + ">" + esc(e.s) + "</text>");
      } else if(e.k === "clip"){
        n++; ouverts++;
        o.push('<clipPath id="cp' + n + '"><polygon points="'
          + e.pts.map(function(p){ return f(p[0]) + "," + Y(p[1]); }).join(" ") + '"/></clipPath><g clip-path="url(#cp' + n + ')">');
      } else if(e.k === "fin" && ouverts){ ouverts--; o.push("</g>"); }
    });
    while(ouverts--) o.push("</g>");
    o.push("</svg>");
    return o.join("");
  };
  return t;
}

/* ---------- les fichiers ---------- */
function octets(s){
  /* latin-1 : un caractère, un octet — le flux PDF n'a que de l'ASCII et de l'octal */
  var b = new Uint8Array(s.length);
  for(var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return b;
}
function latin(b){
  var s = "";
  for(var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return s;
}
function joindre(parts){
  var n = 0; parts.forEach(function(p){ n += p.length; });
  var o = new Uint8Array(n), k = 0;
  parts.forEach(function(p){ o.set(p, k); k += p.length; });
  return o;
}
var POLICES = "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>";
var POLICES_B = "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>";
function flux(s){ return "<</Length " + s.length + ">>\nstream\n" + s + "\nendstream"; }
function xref(objs, depart){
  /* objs : [[numéro, décalage]] ; une sous-section par numéro, c'est permis */
  var s = "xref\n";
  objs.sort(function(a, b){ return a[0] - b[0]; }).forEach(function(o){
    s += o[0] + " 1\n" + ("0000000000" + (o[1] + depart)).slice(-10) + " 00000 n \n";
  });
  return s;
}

export function pdfNeuf(t){
  var objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 " + f(t.w) + " " + f(t.h) + "]/Resources<</Font<</FH 5 0 R/FHb 6 0 R>>>>/Contents 4 0 R>>",
    flux(t.pdf()), POLICES, POLICES_B
  ];
  var s = "%PDF-1.4\n", off = [];
  objs.forEach(function(o, i){ off.push([i + 1, s.length]); s += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
  var x = s.length;
  s += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n"
    + off.map(function(o){ return ("0000000000" + o[1]).slice(-10) + " 00000 n \n"; }).join("")
    + "trailer\n<</Size " + (objs.length + 1) + "/Root 1 0 R>>\nstartxref\n" + x + "\n%%EOF\n";
  return octets(s);
}

export function pdfSur(base, t, t2){
  var s = latin(base);
  var sx = s.lastIndexOf("startxref"), prev = parseInt(s.slice(sx + 9).trim(), 10);
  var taille = 0, racine = null, id = null;
  s.replace(/\/Size (\d+)/g, function(_, n){ taille = Math.max(taille, +n); });
  var mr = s.match(/\/Root (\d+ \d+ R)/), mi = s.match(/\/ID\s*\[[^\]]*\]/);
  racine = mr[1]; id = mi ? mi[0] : "";
  function objet(n){
    var re = new RegExp("(?:^|[\\r\\n])" + n + " 0 obj", "g"), m, d0 = -1;
    while((m = re.exec(s))) d0 = m.index + m[0].length;
    return { d0:d0, d1:s.indexOf("endobj", d0) };
  }
  function dictDe(n){ var o = objet(n); return s.slice(o.d0, o.d1); }
  /* les pages, dans l'ordre : la racine, ses /Pages, leurs /Kids — et non
     l'ordre des objets dans le fichier, que l'écriture place où elle veut */
  function pages(n){
    var d = dictDe(n);
    if(/\/Type\s*\/Page(?![s\w])/.test(d)) return [n];
    var k = d.match(/\/Kids\s*\[([^\]]*)\]/);
    if(!k){ var pp = d.match(/\/Pages\s+(\d+) 0 R/); return pp ? pages(+pp[1]) : []; }
    var out = [];
    k[1].replace(/(\d+) 0 R/g, function(_, x){ out = out.concat(pages(+x)); });
    return out;
  }
  var P = pages(+racine.split(" ")[0]);
  var fh = taille, fb = taille + 1, n = taille + 2, add = [[fh, POLICES], [fb, POLICES_B]];
  /* sur chaque page, son dessin : le contenu d'origine entre q … Q, pour que
     ce qu'il laisse à l'état graphique ne déplace pas la surcouche */
  [t, t2].forEach(function(tr, k){
    if(!tr || P[k] == null) return;
    var q = n++, Q = n++, ov = n++, dict = dictDe(P[k]).trim();
    /* des ressources en objet à part (pymupdf l'écrit ainsi) : recopiées dans
       la page, où l'on peut leur ajouter nos polices */
    dict = dict.replace(/\/Resources\s+(\d+) 0 R/, function(_, r){ return "/Resources" + dictDe(+r).trim(); });
    dict = dict.replace(/\/Font\s+(\d+) 0 R/, function(_, r){ return "/Font" + dictDe(+r).trim(); });
    dict = dict.replace(/\/Contents\s*(\[[^\]]*\]|\d+ \d+ R)/, function(_, c){
      return "/Contents[" + q + " 0 R " + c.replace(/^\[|\]$/g, "") + " " + Q + " 0 R " + ov + " 0 R]";
    });
    dict = /\/Font\s*<</.test(dict)
      ? dict.replace(/\/Font\s*<</, "/Font<</FH " + fh + " 0 R/FHb " + fb + " 0 R")
      : dict.replace(/\/Resources\s*<</, "/Resources<</Font<</FH " + fh + " 0 R/FHb " + fb + " 0 R>>");
    add.push([P[k], dict], [q, flux("q")], [Q, flux("Q")], [ov, flux(tr.pdf())]);
  });
  var u = "\n", off = [];
  add.forEach(function(o){ off.push([o[0], u.length]); u += o[0] + " 0 obj\n" + o[1] + "\nendobj\n"; });
  var x = base.length + u.length;
  u += xref(off, base.length) + "trailer\n<</Size " + n + "/Root " + racine + (id ? id : "")
    + "/Prev " + prev + ">>\nstartxref\n" + x + "\n%%EOF\n";
  return joindre([base, octets(u)]);
}

/* ---------- le DXF, pour AutoCAD ----------
   DXF 2000 (AC1015) : le format d'échange que tout logiciel de DAO ouvre, et
   que l'on écrit sans dépendance — le DWG est binaire et fermé. Le fichier se
   travaille comme un dessin fait à la main : des POLYLIGNES (LWPOLYLINE), des
   HACHURES pleines pour les aplats, des TEXTES éditables, des CERCLES. Chaque
   entité garde sa couleur exacte, son épaisseur de trait, ses tirets ; un calque
   par épaisseur (`TRAIT-0.50`, `TRAIT-0.18-TIRETS`…), `HACHURE`, `TEXTE`.
   Unités : le millimètre SUR LE PAPIER — la planche s'ouvre à l'échelle de son
   PDF (1:200 → 1 mm du dessin = 0,2 m). Les découpes de la planche sont
   APPLIQUÉES à la géométrie : rien ne déborde. Une page suivante (`t2`) se pose
   à droite de la première. La base d'un PDF posé sur un gabarit (géomètre,
   midterm) n'y est pas : seule notre surcouche est dessinée. */
var ACI = [[1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255],
  [7, 0, 0, 0], [7, 255, 255, 255], [8, 128, 128, 128], [9, 192, 192, 192],
  [250, 51, 51, 51], [251, 80, 80, 80], [252, 105, 105, 105], [253, 130, 130, 130], [254, 190, 190, 190]];
/* les épaisseurs que connaît AutoCAD, en centièmes de mm */
var LW = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
function aci(c){
  var r = c[0] * 255, g = c[1] * 255, b = c[2] * 255, m = ACI[0], d = 1e9;
  ACI.forEach(function(a){ var e = (a[1] - r) * (a[1] - r) + (a[2] - g) * (a[2] - g) + (a[3] - b) * (a[3] - b); if(e < d){ d = e; m = a; } });
  return String(m[0]);
}
var CP1252 = { 0x2019:"\x92", 0x2018:"\x91", 0x201C:"\x93", 0x201D:"\x94", 0x2014:"\x97", 0x2013:"\x96",
  0x2022:"\x95", 0x2026:"\x85", 0x2192:"->", 0x1D49:"e", 0x02B3:"r", 0x2032:"'" };
function vrai(c){ return String((Math.round(c[0] * 255) << 16) + (Math.round(c[1] * 255) << 8) + Math.round(c[2] * 255)); }

/* ---- la découpe, faite sur la géométrie ---- */
function dedans(p, P){
  var c = false;
  for(var i = 0, j = P.length - 1; i < P.length; j = i++){
    if((P[i][1] > p[1]) !== (P[j][1] > p[1])
       && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  }
  return c;
}
function convexe(P){
  var s = 0;
  for(var i = 0; i < P.length; i++){
    var a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
    var z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if(Math.abs(z) < 1e-9) continue;
    if(s && Math.sign(z) !== s) return false;
    s = Math.sign(z);
  }
  return true;
}
/* une ligne brisée coupée par un polygone quelconque : chaque segment est
   partagé à ses croisements avec le bord, on garde les morceaux dedans */
function couperLigne(pts, P){
  var out = [], cur = [];
  for(var i = 0; i + 1 < pts.length; i++){
    var a = pts[i], b = pts[i + 1], ts = [0, 1];
    for(var k = 0, j = P.length - 1; k < P.length; j = k++){
      var c = P[j], d = P[k], r = [b[0] - a[0], b[1] - a[1]], q = [d[0] - c[0], d[1] - c[1]];
      var den = r[0] * q[1] - r[1] * q[0];
      if(Math.abs(den) < 1e-12) continue;
      var t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      if(t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort(function(x, y){ return x - y; });
    for(var m = 0; m + 1 < ts.length; m++){
      var t0 = ts[m], t1 = ts[m + 1];
      if(t1 - t0 < 1e-9) continue;
      var tm = (t0 + t1) / 2, p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      if(dedans([a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm], P)){
        if(!cur.length) cur.push(p0);
        cur.push(p1);
      } else if(cur.length){ out.push(cur); cur = []; }
    }
  }
  if(cur.length) out.push(cur);
  return out;
}
/* une surface coupée : Sutherland–Hodgman, exact quand la découpe est convexe
   (les cadres) ; contre la parcelle, qui ne l'est pas, une surface tout entière
   dedans passe telle quelle, une autre est coupée au mieux. */
function couperSurface(pts, P){
  if(pts.every(function(p){ return dedans(p, P); })) return pts;
  // ponytail: Sutherland–Hodgman — juste pour une découpe convexe ; Greiner–Hormann si une surface déborde d'une découpe concave
  var sens = 0;
  for(var i = 0; i < P.length; i++){ var a = P[i], b = P[(i + 1) % P.length]; sens += a[0] * b[1] - b[0] * a[1]; }
  var out = pts;
  for(var e = 0; e < P.length && out.length; e++){
    var A = P[e], B = P[(e + 1) % P.length], inp = out; out = [];
    var cote = function(p){ return sens * ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) >= 0; };
    for(var k = 0; k < inp.length; k++){
      var p = inp[k], q = inp[(k + 1) % inp.length], ip = cote(p), iq = cote(q);
      if(ip) out.push(p);
      if(ip !== iq){
        var dx = q[0] - p[0], dy = q[1] - p[1], ex = B[0] - A[0], ey = B[1] - A[1];
        var t = (ex * (p[1] - A[1]) - ey * (p[0] - A[0])) / (ey * dx - ex * dy);
        out.push([p[0] + dx * t, p[1] + dy * t]);
      }
    }
  }
  return out.length > 2 ? out : null;
}
function cercle(x, y, r){
  var o = [];
  for(var i = 0; i < 48; i++) o.push([x + r * Math.cos(i * Math.PI / 24), y + r * Math.sin(i * Math.PI / 24)]);
  return o;
}

export function dxf(t, t2){
  var MMPT = 25.4 / 72, H = 0x100, E = [], calques = {}, tirets = {};
  function h(){ return (H++).toString(16).toUpperCase(); }
  function n(v){ return (Math.round(v * MMPT * 1000) / 1000).toString(); }
  var MS = h(), PS = h();
  /* le début de chaque entité : poignée, propriétaire, calque, couleur… */
  function entite(type, calque, coul, a){
    calques[calque] = 1;
    E.push("0", type, "5", h(), "330", MS, "100", "AcDbEntity", "8", calque);
    if(a && a.dash){
      /* un type de ligne par motif : le pointillé exact de la planche, en mm */
      var mm = a.dash.map(function(v){ return Math.round(v * MMPT * 100) / 100; }), lt = "TIRETS-" + mm.join("-");
      tirets[lt] = mm;
      E.push("6", lt);
    }
    E.push("62", aci(coul), "420", vrai(coul));
    if(a && a.lw != null){
      var lw = a.lw * MMPT * 100, best = LW[0];
      LW.forEach(function(v){ if(Math.abs(v - lw) < Math.abs(best - lw)) best = v; });
      E.push("370", String(best));
    }
    if(a && a.op != null && a.op < 1) E.push("440", String(0x02000000 + Math.round(255 * a.op)));
  }
  function trait(a){ return "TRAIT-" + (a.lw != null ? (a.lw * MMPT).toFixed(2) : "0.25") + (a.dash ? "-TIRETS" : ""); }
  function polyligne(pts, ferme, a, dx){
    entite("LWPOLYLINE", trait(a), a.stroke, a);
    E.push("100", "AcDbPolyline", "90", String(pts.length), "70", ferme ? "1" : "0");
    pts.forEach(function(p){ E.push("10", n(p[0] + dx), "20", n(p[1])); });
  }
  function hachure(pts, a, dx){
    entite("HATCH", "HACHURE", a.fill, { op:a.op });
    E.push("100", "AcDbHatch", "10", "0", "20", "0", "30", "0", "210", "0", "220", "0", "230", "1",
      "2", "SOLID", "70", "1", "71", "0", "91", "1", "92", "3", "72", "0", "73", "1", "93", String(pts.length));
    pts.forEach(function(p){ E.push("10", n(p[0] + dx), "20", n(p[1])); });
    E.push("97", "0", "75", "0", "76", "1", "98", "0");
  }
  function chaine(s){
    return s.replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, function(c){
      return CP1252[c.charCodeAt(0)] || "\\U+" + ("000" + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
    });
  }

  [t, t2].forEach(function(tr, k){
    if(!tr) return;
    var dx = k ? t.w + 20 / MMPT : 0, pile = [];
    function tout(p){ return pile.every(function(P){ return dedans(p, P); }); }
    function surface(pts){
      for(var i = 0; i < pile.length && pts; i++) pts = couperSurface(pts, pile[i]);
      return pts;
    }
    function lignes(pts){
      var L = [pts];
      pile.forEach(function(P){ var o = []; L.forEach(function(l){ o = o.concat(couperLigne(l, P)); }); L = o; });
      return L.filter(function(l){ return l.length > 1; });
    }
    tr.L.forEach(function(e){
      var a = e.o || {};
      if(e.k === "clip") pile.push(e.pts);
      else if(e.k === "fin") pile.pop();
      else if(e.k === "p" || e.k === "c"){
        var pts = e.k === "c" ? cercle(e.x, e.y, e.r) : e.pts, ferme = e.k === "c" || e.ferme;
        var libre = pts.every(tout);
        if(a.fill && ferme){ var s = libre ? pts : surface(pts); if(s) hachure(s, a, dx); }
        if(!a.stroke) return;
        if(libre && e.k === "c"){
          entite("CIRCLE", trait(a), a.stroke, a);
          E.push("100", "AcDbCircle", "10", n(e.x + dx), "20", n(e.y), "30", "0", "40", n(e.r));
        } else if(libre) polyligne(pts, ferme, a, dx);
        else lignes(ferme ? pts.concat([pts[0]]) : pts).forEach(function(l){ polyligne(l, false, a, dx); });
      } else if(e.k === "t" && tout([e.x, e.y])){
        var m = a.m || [Math.cos(a.rot || 0), Math.sin(a.rot || 0)], x = n(e.x + dx), y = n(e.y);
        entite("TEXT", "TEXTE", a.fill || [0, 0, 0]);
        /* la hauteur d'un TEXT est celle des capitales : 0,72 du corps en Helvetica */
        E.push("100", "AcDbText", "10", x, "20", y, "30", "0", "40", n((a.size || 8) * .72 * Math.hypot(m[0], m[1])),
          "1", chaine(e.s), "50", (Math.round(Math.atan2(m[1], m[0]) * 18000 / Math.PI) / 100).toString(), "7", a.gras ? "GRAS" : "STANDARD",
          "72", a.ancre === "middle" ? "1" : a.ancre === "end" ? "2" : "0", "11", x, "21", y, "31", "0", "100", "AcDbText");
      }
    });
  });

  /* l'enveloppe minimale d'un DXF 2000 : tables, blocs des espaces, dictionnaire */
  var o = [];
  function table(nom, entrees){
    var th = h();
    o.push("0", "TABLE", "2", nom, "5", th, "330", "0", "100", "AcDbSymbolTable", "70", String(entrees.length));
    if(nom === "DIMSTYLE") o.push("100", "AcDbDimStyleTable");
    entrees.forEach(function(x){ o.push("0", nom, "5", x[0] || h(), "330", th, "100", "AcDbSymbolTableRecord"); o.push.apply(o, x[1]); });
    o.push("0", "ENDTAB");
  }
  var C = Object.keys(calques).sort(), rD = h(), gD = h();
  var ents = E;
  o.push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1015", "9", "$DWGCODEPAGE", "3", "ANSI_1252",
    "9", "$INSUNITS", "70", "4", "9", "$MEASUREMENT", "70", "1", "9", "$LWDISPLAY", "290", "1", "9", "$LTSCALE", "40", "1",
    "9", "$HANDSEED", "5", "FFFFF", "0", "ENDSEC", "0", "SECTION", "2", "CLASSES", "0", "ENDSEC", "0", "SECTION", "2", "TABLES");
  table("VPORT", [[null, ["100", "AcDbViewportTableRecord", "2", "*ACTIVE", "70", "0", "10", "0", "20", "0", "11", "1", "21", "1",
    "12", n(t.w / 2), "22", n(t.h / 2), "40", n(t.h), "41", String(t.w / t.h)]]]);
  table("LTYPE", [
    [null, ["100", "AcDbLinetypeTableRecord", "2", "ByBlock", "70", "0", "3", "", "72", "65", "73", "0", "40", "0"]],
    [null, ["100", "AcDbLinetypeTableRecord", "2", "ByLayer", "70", "0", "3", "", "72", "65", "73", "0", "40", "0"]],
    [null, ["100", "AcDbLinetypeTableRecord", "2", "Continuous", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0"]]
  ].concat(Object.keys(tirets).map(function(lt){
    var mm = tirets[lt].length % 2 ? tirets[lt].concat(tirets[lt]) : tirets[lt], o = ["100", "AcDbLinetypeTableRecord", "2", lt, "70", "0",
      "3", lt, "72", "65", "73", String(mm.length), "40", String(mm.reduce(function(x, y){ return x + y; }, 0))];
    mm.forEach(function(v, i){ o.push("49", String(i % 2 ? -v : v), "74", "0"); });
    return [null, o];
  })));
  table("LAYER", ["0"].concat(C).map(function(c){
    return [null, ["100", "AcDbLayerTableRecord", "2", c, "70", "0", "62", c === "HACHURE" ? "8" : "7", "6", "Continuous", "370", "-3", "390", "0"]];
  }));
  table("STYLE", [[null, ["100", "AcDbTextStyleTableRecord", "2", "STANDARD", "70", "0", "40", "0", "41", "1", "50", "0", "71", "0",
    "42", "2.5", "3", "arial.ttf", "4", ""]],
    [null, ["100", "AcDbTextStyleTableRecord", "2", "GRAS", "70", "0", "40", "0", "41", "1", "50", "0", "71", "0",
    "42", "2.5", "3", "arialbd.ttf", "4", ""]]]);
  table("VIEW", []); table("UCS", []);
  table("APPID", [[null, ["100", "AcDbRegAppTableRecord", "2", "ACAD", "70", "0"]]]);
  table("DIMSTYLE", []);
  table("BLOCK_RECORD", [[MS, ["100", "AcDbBlockTableRecord", "2", "*Model_Space"]], [PS, ["100", "AcDbBlockTableRecord", "2", "*Paper_Space"]]]);
  o.push("0", "ENDSEC", "0", "SECTION", "2", "BLOCKS");
  [[MS, "*Model_Space", "0"], [PS, "*Paper_Space", "1"]].forEach(function(b){
    o.push("0", "BLOCK", "5", h(), "330", b[0], "100", "AcDbEntity", "67", b[2], "8", "0", "100", "AcDbBlockBegin", "2", b[1], "70", "0",
      "10", "0", "20", "0", "30", "0", "3", b[1], "1", "",
      "0", "ENDBLK", "5", h(), "330", b[0], "100", "AcDbEntity", "67", b[2], "8", "0", "100", "AcDbBlockEnd");
  });
  o.push("0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
  o = o.concat(ents);
  o.push("0", "ENDSEC", "0", "SECTION", "2", "OBJECTS",
    "0", "DICTIONARY", "5", rD, "330", "0", "100", "AcDbDictionary", "281", "1", "3", "ACAD_GROUP", "350", gD,
    "0", "DICTIONARY", "5", gD, "330", rD, "100", "AcDbDictionary", "281", "1",
    "0", "ENDSEC", "0", "EOF");
  o[o.indexOf("FFFFF")] = H.toString(16).toUpperCase();
  /* Windows-1252, comme le dit l'en-tête ; au-delà, \U+2019 */
  return octets(o.join("\r\n") + "\r\n");
}

/* ---------- donner le fichier ---------- */
export function telecharger(bytes, nom, type){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type:type || "application/pdf" }));
  a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
}
