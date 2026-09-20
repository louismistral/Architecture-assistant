/* ============================================================================
   LE SCHÉMA FONCTIONNEL

   L'ancien schéma dessinait chaque local à l'échelle de sa surface, à des
   coordonnées posées à la main. Deux conséquences : un local de reproduction
   de 9 m² devenait un carré de trois millimètres, avec son nom rejeté à côté
   faute de place, et rien n'alignait quoi que ce soit — les fils se croisaient
   et il fallait les suivre du doigt.

   Ici on ne lit pas des surfaces, on lit des RELATIONS. Le dessin le dit :
   cartes de même taille, rangées en colonnes par pôle, fils orthogonaux routés
   dans les gouttières. Les surfaces restent écrites sur chaque carte, et se
   lisent à l'échelle dans le volet Surfaces, qui est fait pour ça.

   Toute la géométrie est DÉDUITE de `data/schema.js` : ajouter un nœud ou un
   lien ne demande aucune coordonnée.
   ========================================================================= */
import { el, fmt } from "../core/format.js";
import { FMAP, ITEMBYKEY } from "../core/model.js";
import { s, wrapText } from "../core/svg.js";
import { FREE, SLINK, SNODE, SPOLE } from "../data/schema.js";

/* ---------- géométrie, en unités de dessin -------------------------------- */
var NW = 42, NH = 17, NGAP = 6;      /* carte : largeur, hauteur, écart vertical */
var GUT = 26, HEAD = 11, PAD = 3;    /* gouttière entre colonnes, bandeau de pôle */
var CHAN = 2;                        /* écart entre deux fils d'un même faisceau */

/* La table des nœuds est construite au chargement : `linkList()` la lit pour
   nommer les deux bouts d'un lien, et elle est appelée AVANT le premier dessin.
   `layout()` n'y ajoute que la géométrie. */
export var SMAP = {};
SNODE.forEach(function(nd){ SMAP[nd.id] = nd; });
export var SCH_W = 0, SCH_H = 0;

/* La surface d'un nœud est la somme des postes qu'il désigne, relue à chaque
   fois : un poste « à préciser » se change dans le cahier des charges et le
   schéma suit. Aucun poste : le local est hors bilan. */
export function nodeArea(nd){
  var a = 0, est = 0, n = 0;
  (nd.k || []).forEach(function(k){
    var it = ITEMBYKEY[k];
    if(!it) return;
    a += it.tot; n++;
    if(it.est && !it.set) est = 1;
  });
  return { a:a, est:est, hors: n === 0 };
}

function layout(){
  var x = 0, maxRows = 0;
  SPOLE.forEach(function(pl){
    var rows = SNODE.filter(function(nd){ return nd.p === pl.id; });
    pl.x = x; pl.rows = rows;
    rows.forEach(function(nd, i){
      nd.x = x; nd.y = HEAD + i * (NH + NGAP);
      nd.w = NW; nd.h = NH;
      nd.cx = nd.x + NW / 2; nd.cy = nd.y + NH / 2;
      nd.col = SPOLE.indexOf(pl);
      nd.row = i;
    });
    maxRows = Math.max(maxRows, rows.length);
    x += NW + GUT;
  });
  SCH_W = x - GUT;
  SCH_H = HEAD + maxRows * (NH + NGAP) - NGAP;
}

/* ---------- routage des fils ----------------------------------------------
   Deux cas, deux tracés, et rien d'autre : dans une colonne, le fil descend
   au bord ; d'une colonne à l'autre, il sort par le flanc, traverse la
   gouttière et rentre par le flanc d'en face. Les fils qui partagent une
   gouttière ou un canal sont décalés pour ne pas se superposer. */
function routes(){
  var chan = {}, gut = {}, out = [];
  SLINK.forEach(function(lk){
    var A = SMAP[lk.a], B = SMAP[lk.b];
    if(!A || !B) return;
    if(A.col === B.col){
      var hi = A.row < B.row ? A : B, lo = A.row < B.row ? B : A;
      if(lo.row - hi.row === 1){
        /* rangs voisins : le fil passe droit d'un bord à l'autre */
        out.push({ lk:lk, d:"M " + hi.cx + " " + (hi.y + NH) + " L " + lo.cx + " " + lo.y,
                   mx:hi.cx, my:(hi.y + NH + lo.y) / 2 });
        return;
      }
      /* rangs éloignés : le fil contourne par le canal, à gauche de la colonne */
      /* Le canal d'une colonne longe son flanc gauche ; les fils d'une même
         colonne s'y rangent les uns derrière les autres. */
      var kc = hi.col;
      chan[kc] = (chan[kc] || 0) + 1;
      var cx = hi.x - PAD - 1 - chan[kc] * CHAN;
      out.push({ lk:lk,
        d:"M " + hi.x + " " + hi.cy + " L " + cx + " " + hi.cy
          + " L " + cx + " " + lo.cy + " L " + lo.x + " " + lo.cy,
        mx:cx, my:(hi.cy + lo.cy) / 2 });
      return;
    }
    /* d'une colonne à l'autre : la gouttière la plus à gauche des deux */
    var L = A.col < B.col ? A : B, R = A.col < B.col ? B : A;
    /* Les fils d'une gouttière se rangent contre la colonne de GAUCHE : le
       flanc droit de la gouttière appartient au canal de la colonne suivante,
       et deux faisceaux qui se mêlent ne se suivent plus du regard. */
    var kg = L.col;
    gut[kg] = (gut[kg] || 0) + 1;
    var gx = L.x + NW + 4 + (gut[kg] - 1) * CHAN;
    out.push({ lk:lk,
      d:"M " + (L.x + NW) + " " + L.cy + " L " + gx + " " + L.cy
        + " L " + gx + " " + R.cy + " L " + R.x + " " + R.cy,
      mx:gx, my:(L.cy + R.cy) / 2 });
  });
  return out;
}

/* ---------- dessin --------------------------------------------------------- */
export function drawSchema(host){
  while(host.firstChild) host.removeChild(host.firstChild);
  layout();
  var eff = Math.max(host.clientWidth || 900, 900) / (SCH_W + 12);
  var fs = 4.2, fsSm = 3.4, fsCap = 3.4;

  var svg = s("svg", { viewBox: "-6 -3 " + (SCH_W + 12) + " " + (SCH_H + 8),
    preserveAspectRatio: "xMinYMin meet", role: "img",
    "aria-label": "Schéma fonctionnel : les locaux rangés par pôle, reliés par les "
      + "adjacences que le règlement exige." });

  /* --- bandeaux de pôle : une colonne dit ce qu'elle regroupe --- */
  var gp = s("g", null);
  SPOLE.forEach(function(pl){
    var last = pl.rows[pl.rows.length - 1];
    gp.appendChild(s("rect", { x: pl.x - PAD, y: 0, width: NW + 2 * PAD,
      height: (last ? last.y + NH : HEAD) + PAD, rx: 2,
      fill: "var(--rule-soft)", "fill-opacity": ".55", stroke: "none" }));
    var t = s("text", { x: pl.x, y: HEAD - 4.2, "font-size": fsCap,
      fill: "var(--ink-3)", "letter-spacing": ".1" });
    t.textContent = pl.n.toUpperCase();
    gp.appendChild(t);
  });
  svg.appendChild(gp);

  /* --- fils --- */
  var gl = s("g", { fill: "none" });
  routes().forEach(function(r){
    var lk = r.lk;
    var e = s("path", { d: r.d,
      stroke: lk.opt ? "var(--ink-4)" : "var(--ink-2)",
      "stroke-width": lk.opt ? 1.1 : 1.6,
      "stroke-linecap": "round", "stroke-linejoin": "round",
      "vector-effect": "non-scaling-stroke" });
    if(lk.opt) e.setAttribute("stroke-dasharray", "4 3");
    gl.appendChild(e);
    /* une indépendance exigée porte sa barre, au milieu du fil : c'est le
       contraire d'une adjacence et cela ne peut pas se lire au même trait */
    if(lk.sep){
      gl.appendChild(s("line", { x1: r.mx - 1.7, y1: r.my - 1.7, x2: r.mx + 1.7, y2: r.my + 1.7,
        stroke: "var(--danger)", "stroke-width": 1.8, "stroke-linecap": "round",
        "vector-effect": "non-scaling-stroke" }));
      gl.appendChild(s("line", { x1: r.mx - 1.7, y1: r.my + 1.7, x2: r.mx + 1.7, y2: r.my - 1.7,
        stroke: "var(--danger)", "stroke-width": 1.8, "stroke-linecap": "round",
        "vector-effect": "non-scaling-stroke" }));
    }
  });
  svg.appendChild(gl);

  /* --- cartes --- */
  SNODE.forEach(function(nd){
    var A = nodeArea(nd);
    var col = nd.f ? "var(" + FMAP[nd.f].c + ")" : "var(--ink-3)";
    var grp = s("g", { "class": "blk", tabindex: "0" });
    var rc = s("rect", { x: nd.x, y: nd.y, width: NW, height: NH, rx: 1.5,
      fill: A.hors ? "var(--panel)" : col,
      "fill-opacity": A.hors ? "1" : "var(--fill-op)",
      stroke: col, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" });
    if(A.est || A.hors) rc.setAttribute("stroke-dasharray", "4 3");
    grp.appendChild(rc);

    /* Le nom et la surface forment UNE pile, centrée dans la carte : calés
       séparément, la surface d'un nom sur deux lignes débordait sous le bord. */
    var lines = wrapText(nd.n, Math.floor((NW - 3) / (fs * 0.5)), 2);
    var lineH = fs * 1.1, subH = fsSm * 1.35;
    var top0 = nd.cy - (lines.length * lineH + subH) / 2;
    lines.forEach(function(ln, i){
      var t = s("text", { x: nd.cx, y: top0 + fs * 0.8 + i * lineH, "text-anchor": "middle",
        "font-size": fs, fill: "var(--ink)", "font-weight": 500 });
      t.textContent = ln;
      grp.appendChild(t);
    });
    var v = s("text", { x: nd.cx, y: top0 + lines.length * lineH + fsSm * 0.95,
      "text-anchor": "middle", "font-size": fsSm, fill: "var(--ink-2)",
      "font-family": "'IBM Plex Mono', monospace" });
    v.textContent = A.hors ? "hors bilan" : fmt(A.a) + " m²" + (A.est ? " ?" : "");
    grp.appendChild(v);

    grp.setAttribute("data-tip", nd.n + "|"
      + (A.hors ? "aucune surface à lui — hors bilan"
                : fmt(A.a) + " m²" + (A.est ? " · à préciser" : ""))
      + "|" + (nd.f ? FMAP[nd.f].name : "hors familles d’usage"));
    grp.setAttribute("aria-label", nd.n + (A.hors ? ", hors bilan" : ", " + fmt(A.a) + " mètres carrés"));
    svg.appendChild(grp);
  });
  host.appendChild(svg);
  return eff;
}

/* ---------- légende et liste ----------------------------------------------- */
export function linkKey(){
  var d = el("div","linkkey");
  function trait(label, opt, sep){
    var sp = el("span");
    var sv = s("svg", { width: 26, height: 10, viewBox: "0 0 26 10" });
    var ln = s("line", { x1: 0, y1: 5, x2: 26, y2: 5,
      stroke: opt ? "var(--ink-4)" : "var(--ink-2)",
      "stroke-width": opt ? 1.3 : 1.7, "stroke-linecap": "round" });
    if(opt) ln.setAttribute("stroke-dasharray", "5 4");
    sv.appendChild(ln);
    if(sep){
      sv.appendChild(s("line", { x1: 10, y1: 1, x2: 16, y2: 9,
        stroke: "var(--danger)", "stroke-width": 1.8, "stroke-linecap": "round" }));
      sv.appendChild(s("line", { x1: 10, y1: 9, x2: 16, y2: 1,
        stroke: "var(--danger)", "stroke-width": 1.8, "stroke-linecap": "round" }));
    }
    sp.appendChild(sv);
    sp.appendChild(document.createTextNode(label));
    d.appendChild(sp);
  }
  trait("Adjacence exigée", false, false);
  trait("Mutualisation possible", true, false);
  trait("Indépendance exigée", true, true);
  var sp = el("span");
  var sv = s("svg", { width: 26, height: 10, viewBox: "0 0 26 10" });
  sv.appendChild(s("rect", { x: 1, y: 1, width: 24, height: 8, rx: 1.5, fill: "none",
    stroke: "var(--ink-4)", "stroke-width": 1.4, "stroke-dasharray": "4 3" }));
  sp.appendChild(sv);
  sp.appendChild(document.createTextNode("Surface à préciser, ou hors bilan"));
  d.appendChild(sp);
  return d;
}

export function linkList(){
  var ul = el("ul","links");
  SLINK.forEach(function(lk){
    var li = el("li");
    var ic = el("div","ic");
    var sv = s("svg", { width: 13, height: 3, viewBox: "0 0 13 3" });
    var ln = s("line", { x1: 0, y1: 1.5, x2: 13, y2: 1.5,
      stroke: lk.sep ? "var(--danger)" : lk.opt ? "var(--ink-4)" : "var(--ink-2)",
      "stroke-width": lk.opt && !lk.sep ? 1.3 : 1.7 });
    if(lk.opt) ln.setAttribute("stroke-dasharray", "4 3");
    sv.appendChild(ln); ic.appendChild(sv); li.appendChild(ic);
    var tx = el("div");
    tx.appendChild(el("b", null, SMAP[lk.a].n + (lk.sep ? "  ⊣  " : "  ↔  ") + SMAP[lk.b].n));
    tx.appendChild(el("q", null, lk.q));
    li.appendChild(tx);
    ul.appendChild(li);
  });
  return ul;
}
export function freeList(){ return FREE; }
