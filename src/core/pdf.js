/* ============================================================================
   UN DESSIN VECTORIEL, DEUX SORTIES — l'écran (SVG) et l'impression (PDF)

   `trace(w, h)` accumule des primitives en POINTS, y vers le HAUT (le repère du
   PDF) : polygones, lignes, cercles, textes, découpes. `.svg()` les rend pour
   l'écran, `.pdf()` en fait un flux de contenu PDF. Une planche ne se dessine
   donc qu'une fois.

   Deux façons d'en faire un fichier, sans aucune dépendance :
     pdfNeuf(t)            un PDF d'une page, avec Helvetica ;
     pdfSur(base, t)       le PDF `base` (octets) auquel on AJOUTE `t` par-dessus
                           sa première page — une mise à jour incrémentale : le
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
    else o += ({ 0x2019:"\\222", 0x2014:"\\227", 0x2013:"\\226", 0x2022:"\\225", 0x2026:"\\205", 0x2192:"->", 0x1D49:"e" })[c] || "?";
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
    /* o : { size, gras, fill, ancre:"start"|"middle"|"end" } */
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
        o.push("BT /" + (a.gras ? "FHb" : "FH") + " " + f(sz) + " Tf " + rgb(a.fill || [0, 0, 0]) + " rg "
          + f(e.x + dx) + " " + f(e.y) + " Td " + chaine(e.s) + " Tj ET");
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
        o.push('<text x="' + f(e.x) + '" y="' + Y(e.y) + '" font-family="Helvetica, Arial, sans-serif" font-size="'
          + f(a.size || 8) + '"' + (a.gras ? ' font-weight="700"' : "") + ' fill="' + hex(a.fill || [0, 0, 0]) + '"'
          + (a.ancre ? ' text-anchor="' + a.ancre + '"' : "") + ">" + esc(e.s) + "</text>");
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

export function pdfSur(base, t){
  var s = latin(base);
  var sx = s.lastIndexOf("startxref"), prev = parseInt(s.slice(sx + 9).trim(), 10);
  var taille = 0, racine = null, id = null;
  s.replace(/\/Size (\d+)/g, function(_, n){ taille = Math.max(taille, +n); });
  var mr = s.match(/\/Root (\d+ \d+ R)/), mi = s.match(/\/ID\s*\[[^\]]*\]/);
  racine = mr[1]; id = mi ? mi[0] : "";
  /* la première page : la racine, ses /Pages, le premier de ses /Kids — pas le
     premier objet /Type/Page du fichier, que l'ordre d'écriture place où il veut */
  function objet(n){
    var re = new RegExp("(?:^|[\\r\\n])" + n + " 0 obj", "g"), m, d0 = -1;
    while((m = re.exec(s))) d0 = m.index + m[0].length;
    return { d0:d0, d1:s.indexOf("endobj", d0) };
  }
  function dictDe(n){ var o = objet(n); return s.slice(o.d0, o.d1); }
  var num = +racine.split(" ")[0];
  while(!/\/Type\s*\/Page(?![s\w])/.test(dictDe(num))){
    var d = dictDe(num), m = d.match(/\/Kids\s*\[\s*(\d+) 0 R/) || d.match(/\/Pages\s+(\d+) 0 R/);
    num = +m[1];
  }
  var dict = dictDe(num).trim();
  var q = taille, Q = taille + 1, ov = taille + 2, fh = taille + 3, fb = taille + 4;
  /* le contenu d'origine entre q … Q : ce qu'il laisse à l'état graphique ne
     déplace pas la surcouche */
  dict = dict.replace(/\/Contents\s*(\[[^\]]*\]|\d+ \d+ R)/, function(_, c){
    return "/Contents[" + q + " 0 R " + c.replace(/^\[|\]$/g, "") + " " + Q + " 0 R " + ov + " 0 R]";
  });
  dict = /\/Font\s*<</.test(dict)
    ? dict.replace(/\/Font\s*<</, "/Font<</FH " + fh + " 0 R/FHb " + fb + " 0 R")
    : dict.replace(/\/Resources\s*<</, "/Resources<</Font<</FH " + fh + " 0 R/FHb " + fb + " 0 R>>");
  var add = [[num, dict], [q, flux("q")], [Q, flux("Q")], [ov, flux(t.pdf())], [fh, POLICES], [fb, POLICES_B]];
  var u = "\n", off = [];
  add.forEach(function(o){ off.push([o[0], u.length]); u += o[0] + " 0 obj\n" + o[1] + "\nendobj\n"; });
  var x = base.length + u.length;
  u += xref(off, base.length) + "trailer\n<</Size " + (taille + 5) + "/Root " + racine + (id ? id : "")
    + "/Prev " + prev + ">>\nstartxref\n" + x + "\n%%EOF\n";
  return joindre([base, octets(u)]);
}

/* ---------- donner le fichier ---------- */
export function telecharger(bytes, nom){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type:"application/pdf" }));
  a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
}
