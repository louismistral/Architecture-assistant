import { fmt } from "../core/format.js";
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
export function drawScalebar(){
  var sb = document.getElementById("scalebar");
  while(sb.firstChild) sb.removeChild(sb.firstChild);
  var seg = 5 * ppm, W = seg * 4;
  sb.setAttribute("width", W + 1);
  sb.setAttribute("viewBox", "0 0 " + (W + 1) + " 16");
  for(var i = 0; i < 4; i++){
    sb.appendChild(s("rect", { x: i*seg + .5, y: 3, width: seg, height: 7,
      fill: i % 2 ? "var(--panel)" : "var(--ink-2)", stroke: "var(--ink-2)", "stroke-width": 1 }));
  }
}

export function drawDiagram(host, items, W, fs, fsSm){
  while(host.firstChild) host.removeChild(host.firstChild);
  var list = blocks(items);
  var H = pack(list, W);
  var svg = s("svg", { viewBox: "0 0 " + W.toFixed(2) + " " + H.toFixed(2),
    width: "100%", height: (H * ppm).toFixed(1), preserveAspectRatio: "xMinYMin meet", role: "img" });

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
    var col = "var(" + FMAP[b.ref.f].c + ")";
    var grp = s("g", { "class": "blk", tabindex: "0" });
    var rct = s("rect", { x: b.x, y: b.y, width: b.w, height: b.h,
      fill: col, "fill-opacity": b.ref.est ? "0.1" : "var(--fill-op)", stroke: col,
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

    var dims = b.w.toFixed(1).replace(/\.0$/,"") + " × " + b.h.toFixed(1).replace(/\.0$/,"") + " m";
    var line2 = (view.mode === "agg"
      ? (b.cnt > 1 ? b.cnt + " × " + fmt(b.ref.u) + " m² = " + fmt(b.area) + " m²" : fmt(b.area) + " m²")
      : fmt(b.area) + " m² (1 pièce sur " + b.ref.nb + ")") + " · " + dims;
    grp.setAttribute("data-tip", b.label + (b.ref.est ? "  (estimé)" : "") + "|" + line2 + "|"
      + FMAP[b.ref.f].name + (b.ref.note ? " · " + b.ref.note : ""));
    grp.setAttribute("aria-label", b.label + ", " + fmt(b.area) + " mètres carrés, " + FMAP[b.ref.f].name);
    svg.appendChild(grp);
  });
  host.appendChild(svg);
}

