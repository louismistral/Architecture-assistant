import { el, fmt } from "../core/format.js";
import { FMAP } from "../core/model.js";
import { s, wrapText } from "../core/svg.js";
import { SCH_H, SCH_W, SLINK, SNODE } from "../data/schema.js";

/* ---------- schéma fonctionnel ---------- */
export var SMAP = {}; SNODE.forEach(function(nd){ SMAP[nd.id] = nd; nd.cx = nd.x + nd.w/2; nd.cy = nd.y + nd.h/2; });

export function edgePoint(nd, tx, ty){
  var dx = tx - nd.cx, dy = ty - nd.cy;
  if(!dx && !dy) return [nd.cx, nd.cy];
  var a = nd.w/2, b = nd.h/2;
  var t = Math.min(dx ? a/Math.abs(dx) : Infinity, dy ? b/Math.abs(dy) : Infinity);
  return [nd.cx + dx*t, nd.cy + dy*t];
}

export function drawSchema(host){
  while(host.firstChild) host.removeChild(host.firstChild);
  var eff = Math.max(host.clientWidth || 840, 840) / SCH_W;
  var fs = 11 / eff, fsSm = 9.5 / eff;
  var svg = s("svg", { viewBox: "-3 -4 " + (SCH_W + 6) + " " + (SCH_H + 6),
    preserveAspectRatio: "xMinYMin meet", role: "img",
    "aria-label": "Schéma fonctionnel : les pièces que le règlement demande de placer côte à côte, reliées par un fil" });

  /* fils */
  var gl = s("g", null);
  SLINK.forEach(function(lk){
    var A = SMAP[lk.a], B = SMAP[lk.b];
    var p1 = edgePoint(A, B.cx, B.cy), p2 = edgePoint(B, A.cx, A.cy);
    var ln = s("line", { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
      stroke: lk.opt ? "var(--ink-3)" : "var(--ink-2)",
      "stroke-width": lk.opt ? 1.3 : 1.7,
      "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" });
    if(lk.opt) ln.setAttribute("stroke-dasharray", "5 4");
    gl.appendChild(ln);
  });
  svg.appendChild(gl);

  /* pièces */
  SNODE.forEach(function(nd){
    var col = nd.f ? "var(" + FMAP[nd.f].c + ")" : "var(--ink-3)";
    var grp = s("g", { "class": "blk", tabindex: "0" });
    var rc = s("rect", { x: nd.x, y: nd.y, width: nd.w, height: nd.h,
      fill: nd.dash ? "var(--panel)" : col, "fill-opacity": nd.dash ? "1" : "var(--fill-op)",
      stroke: col, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" });
    if(nd.dash) rc.setAttribute("stroke-dasharray", "4 3");
    grp.appendChild(rc);
    if(nd.split){
      grp.appendChild(s("line", { x1: nd.cx, y1: nd.y, x2: nd.cx, y2: nd.y + nd.h,
        stroke: col, "stroke-width": 1.4, "stroke-dasharray": "5 4", "vector-effect": "non-scaling-stroke" }));
    }

    var lp = nd.lp || "in";
    if(lp === "in"){
      var maxChars = Math.max(5, Math.floor((nd.w - 1.6) / (fs * 0.52)));
      var lines = wrapText(nd.n, maxChars, 3);
      var sub = nd.sub || (nd.a ? fmt(nd.a) + " m²" : "");
      var subFs = fs * 0.86;
      var blockH = lines.length * fs * 1.16 + (sub ? subFs * 1.6 : 0);
      var top = nd.cy - blockH/2 + fs * 0.9;
      lines.forEach(function(ln2, i){
        var t = s("text", { x: nd.cx, y: top + i * fs * 1.16, "text-anchor": "middle",
          "font-size": fs, fill: "var(--ink)", "font-weight": 500 });
        t.textContent = ln2;
        grp.appendChild(t);
      });
      if(sub){
        var v = s("text", { x: nd.cx, y: top + lines.length * fs * 1.16 + subFs * 0.45,
          "text-anchor": "middle", "font-size": subFs, fill: "var(--ink-2)",
          "font-family": "'IBM Plex Mono', monospace" });
        v.textContent = sub;
        grp.appendChild(v);
      }
    } else {
      var lx = nd.cx, ly, anc = "middle";
      if(lp === "below") ly = nd.y + nd.h + fs * 1.25;
      else if(lp === "above") ly = nd.y - fs * 0.55;
      else { lx = nd.x + nd.w + fs * 0.7; ly = nd.cy + fs * 0.35; anc = "start"; }
      var t2 = s("text", { x: lx, y: ly, "text-anchor": anc, "font-size": fs,
        fill: "var(--ink)", "font-weight": 500 });
      t2.textContent = nd.n;
      grp.appendChild(t2);
    }

    grp.setAttribute("data-tip", nd.n + "|" + (nd.a ? fmt(nd.a) + " m²" : "surface selon projet")
      + "|" + (nd.f ? FMAP[nd.f].name : "Circulation, non chiffrée au programme"));
    grp.setAttribute("aria-label", nd.n + (nd.a ? ", " + fmt(nd.a) + " mètres carrés" : ""));
    svg.appendChild(grp);
  });
  host.appendChild(svg);
}

export function linkKey(){
  var d = el("div","linkkey");
  [["Adjacence demandée", false], ["Mutualisation possible", true]].forEach(function(p){
    var sp = el("span");
    var sv = s("svg", { width: 26, height: 8, viewBox: "0 0 26 8" });
    var ln = s("line", { x1: 0, y1: 4, x2: 26, y2: 4,
      stroke: p[1] ? "var(--ink-3)" : "var(--ink-2)", "stroke-width": p[1] ? 1.3 : 1.7, "stroke-linecap": "round" });
    if(p[1]) ln.setAttribute("stroke-dasharray", "5 4");
    sv.appendChild(ln);
    sp.appendChild(sv);
    sp.appendChild(document.createTextNode(p[0]));
    d.appendChild(sp);
  });
  return d;
}

export function linkList(){
  var ul = el("ul","links");
  SLINK.forEach(function(lk){
    var li = el("li");
    var ic = el("div","ic");
    var sv = s("svg", { width: 13, height: 3, viewBox: "0 0 13 3" });
    var ln = s("line", { x1: 0, y1: 1.5, x2: 13, y2: 1.5,
      stroke: lk.opt ? "var(--ink-3)" : "var(--ink-2)", "stroke-width": lk.opt ? 1.3 : 1.7 });
    if(lk.opt) ln.setAttribute("stroke-dasharray", "4 3");
    sv.appendChild(ln); ic.appendChild(sv); li.appendChild(ic);
    var tx = el("div");
    tx.appendChild(el("b", null, SMAP[lk.a].n + "  ↔  " + SMAP[lk.b].n));
    tx.appendChild(el("q", null, lk.q));
    li.appendChild(tx);
    ul.appendChild(li);
  });
  return ul;
}

