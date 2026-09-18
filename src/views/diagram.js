import { dim, el, fmt } from "../core/format.js";
import { blocks, pack } from "../core/geometry.js";
import { FMAP } from "../core/model.js";
import { s, wrapText } from "../core/svg.js";
import { view } from "../core/viewstate.js";

export var panelsEl = document.getElementById("panels");
export var ppm = 8;
export function refreshPpm(){ ppm = pxPerM(); return ppm; }

export function pxPerM(){
  var w = panelsEl.clientWidth || 900;
  return w < 520 ? 6.2 : (w < 720 ? 7.2 : 8);
}
/* La barre d'échelle vivait dans le chrome global, donc affichée sur les cinq
   onglets — alors qu'elle ne décrit que les diagrammes du programme. Sur le
   schéma elle était fausse de 24 %, et sur le site d'un facteur 2, où une
   SECONDE barre d'échelle, elle juste, s'affichait en même temps. Elle
   appartient à la vue qu'elle mesure. */
export function scaleBar(){
  var box = el("div","scalebar");
  var sb = document.createElementNS("http://www.w3.org/2000/svg","svg");
  sb.setAttribute("height","16"); sb.setAttribute("role","img");
  sb.setAttribute("aria-label","Barre d\u2019échelle de 20 mètres");
  sb.id = "scalebar";
  box.appendChild(sb);
  box.appendChild(el("span","cap mono","20 m"));
  drawScalebar(sb);
  return box;
}
export function drawScalebar(node){
  var sb = node || document.getElementById("scalebar");
  if(!sb) return;
  while(sb.firstChild) sb.removeChild(sb.firstChild);
  var seg = 5 * ppm, W = seg * 4;
  sb.setAttribute("width", W + 1);
  sb.setAttribute("viewBox", "0 0 " + (W + 1) + " 16");
  for(var i = 0; i < 4; i++){
    sb.appendChild(s("rect", { x: i*seg + .5, y: 3, width: seg, height: 7,
      fill: i % 2 ? "var(--panel)" : "var(--ink-2)", stroke: "var(--ink-2)", "stroke-width": 1 }));
  }
}

/* La circulation n'est pas un poste du programme : elle n'a ni numéro d'article
   ni famille d'usage. Elle est pourtant une surface, et la plus grande après
   les classes — la dessiner à l'échelle avec les locaux est la seule façon de
   voir ce qu'elle pèse. Elle entre donc dans le pavage comme un bloc, hachuré
   et sans couleur de famille, exactement comme dans la légende. */
function circItem(a, quoi){
  return { n:"Circulation", nb:1, u:a, tot:a, f:null, circ:1,
           note:"couloirs, escaliers, paliers, sas — " + quoi };
}
export var CIRCPAT = "diagcirc";

export function drawDiagram(host, items, W, fs, fsSm, circ, circNote){
  while(host.firstChild) host.removeChild(host.firstChild);
  var src = items;
  if(circ > 0) src = items.concat([circItem(circ, circNote || "part de la surface bâtie")]);
  var list = blocks(src);
  var H = pack(list, W);
  var svg = s("svg", { viewBox: "0 0 " + W.toFixed(2) + " " + H.toFixed(2),
    width: "100%", height: (H * ppm).toFixed(1), preserveAspectRatio: "xMinYMin meet", role: "img" });

  /* La hachure de la circulation : même trame à 45° que sa pastille de légende,
     définie une fois par diagramme. `--hatch-ink` est le token de la hachure du
     technique ; c'est la même encre, et elle suit le thème. */
  if(circ > 0){
    var defs = s("defs"), pat = s("pattern", { id: CIRCPAT, width: 1.2, height: 1.2,
      patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(s("line", { x1: 0, y1: 0, x2: 0, y2: 1.2,
      stroke: "var(--hatch-ink)", "stroke-width": 0.35 }));
    defs.appendChild(pat);
    svg.appendChild(defs);
  }

  var used = 0;
  list.forEach(function(b){ used = Math.max(used, b.x + b.w); });
  var GW = Math.min(W, Math.ceil(used / 10) * 10);
  var g = s("g", { stroke: "var(--grid)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" });
  for(var gx = 0; gx <= GW + 0.01; gx += 10){
    var vx = Math.min(gx, GW);
    g.appendChild(s("line", { x1: vx, y1: 0, x2: vx, y2: H }));
  }
  for(var gy = H; gy >= -0.01; gy -= 10){
    var vy = Math.max(0, gy);
    g.appendChild(s("line", { x1: 0, y1: vy, x2: GW, y2: vy }));
  }
  svg.appendChild(g);

  list.forEach(function(b){
    var cir = b.ref.circ;
    var col = cir ? "var(--ink-4)" : "var(" + FMAP[b.ref.f].c + ")";
    var grp = s("g", { "class": "blk" + (cir ? " blk--circ" : ""), tabindex: "0" });
    var rct = s("rect", { x: b.x, y: b.y, width: b.w, height: b.h,
      fill: cir ? "url(#" + CIRCPAT + ")" : col,
      "fill-opacity": b.ref.est ? "0.1" : (cir ? "1" : "var(--fill-op)"), stroke: col,
      "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" });
    if(b.ref.est) rct.setAttribute("stroke-dasharray", "5 3");
    grp.appendChild(rct);

    if(b.split){
      grp.appendChild(s("line", { x1: b.x + b.w/2, y1: b.y, x2: b.x + b.w/2, y2: b.y + b.h,
        stroke: col, "stroke-width": 1.4, "stroke-dasharray": "5 4", "vector-effect": "non-scaling-stroke" }));
    }
    if(b.inset){
      var iw = b.inset.w || Math.sqrt(b.inset.a), ih = b.inset.h || Math.sqrt(b.inset.a);
      grp.appendChild(s("rect", { x: b.x + 1.1, y: b.y + b.h - ih - 1.1, width: iw, height: ih,
        fill: col, "fill-opacity": "0.3", stroke: col, "stroke-width": 1.2,
        "stroke-dasharray": "4 3", "vector-effect": "non-scaling-stroke" }));
    }

    var cx = b.x + b.w/2;
    if(b.w >= 9.5 && b.h >= 7.2){
      var maxChars = Math.floor((b.w - 1.6) / (fs * 0.52));
      var lines = wrapText(b.label, Math.max(6, maxChars), 3);
      var blockH = lines.length * fs * 1.16 + fs * 1.5;
      var top = b.y + b.h/2 - blockH/2 + fs * 0.9;
      lines.forEach(function(ln, i){
        var t = s("text", { x: cx, y: top + i * fs * 1.16, "text-anchor": "middle",
          "font-size": fs, fill: "var(--ink)", "font-weight": 500 });
        t.textContent = ln;
        grp.appendChild(t);
      });
      var v = s("text", { x: cx, y: top + lines.length * fs * 1.16 + fs * 0.42, "text-anchor": "middle",
        "font-size": fs * 1.02, fill: "var(--ink-2)", "font-family": "'IBM Plex Mono', monospace" });
      v.textContent = fmt(b.area) + " m²";
      grp.appendChild(v);
    } else if(b.w >= 5.4 && b.h >= 4.4){
      var v2 = s("text", { x: cx, y: b.y + b.h/2 + fsSm * 0.36, "text-anchor": "middle",
        "font-size": fsSm, fill: "var(--ink-2)", "font-family": "'IBM Plex Mono', monospace" });
      v2.textContent = fmt(b.area);
      grp.appendChild(v2);
    }
    if(b.inset && b.w >= 14){
      var il = s("text", { x: b.x + 1.1 + (b.inset.w || Math.sqrt(b.inset.a))/2, y: b.y + b.h - 2.0,
        "text-anchor": "middle", "font-size": fsSm, fill: "var(--ink-3)" });
      il.textContent = b.inset.label;
      grp.appendChild(il);
    }

    var dims = dim(b.w) + " × " + dim(b.h) + " m";
    var line2 = (cir || view.mode === "agg"
      ? (b.cnt > 1 ? b.cnt + " × " + fmt(b.ref.u) + " m² = " + fmt(b.area) + " m²" : fmt(b.area) + " m²")
      : fmt(b.area) + " m² (1 pièce sur " + b.ref.nb + ")") + " · " + dims;
    var quoi = cir ? "Hors des huit familles d\u2019usage" : FMAP[b.ref.f].name;
    grp.setAttribute("data-tip", b.label + (b.ref.est ? "  (à préciser)" : "") + "|" + line2 + "|"
      + quoi + (b.ref.note ? " · " + b.ref.note : ""));
    grp.setAttribute("aria-label", b.label + ", " + fmt(b.area) + " mètres carrés, " + quoi);
    svg.appendChild(grp);
  });
  host.appendChild(svg);
}

