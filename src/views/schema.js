/* ============================================================================
   LE SCHÉMA FONCTIONNEL

   Deux choses à lire d'un coup : les RELATIONS que le règlement exige, et ce
   que pèse chaque local. L'ancien schéma tenait la seconde en laissant tomber
   la première — chaque local dessiné à l'échelle, largeur ET hauteur libres, à
   des coordonnées posées à la main : rien n'alignait quoi que ce soit et les
   fils se croisaient.

   Ici, une seule dimension est libre. Toutes les colonnes ont la même largeur,
   donc l'aire d'un rectangle est proportionnelle à sa hauteur, donc à ses m² :
   on reste à l'échelle sans renoncer à l'alignement. Les locaux sont rangés en
   colonnes par pôle, les fils sont orthogonaux et routés dans les gouttières.

   Toute la géométrie est DÉDUITE de `data/schema.js` : ajouter un nœud ou un
   lien ne demande aucune coordonnée, et l'échelle se recalcule sur les
   surfaces du jour.
   ========================================================================= */
import { el, fmt } from "../core/format.js";
import { FMAP, ITEMBYKEY } from "../core/model.js";
import { s, wrapText } from "../core/svg.js";
import { FREE, SLINK, SNODE, SPOLE } from "../data/schema.js";

/* ---------- géométrie : le dessin est en MÈTRES ---------------------------
   Un rectangle vaut sa surface, dans ses DEUX dimensions : un local de 144 m²
   est un carré de 12 m de côté, un local de 6 m² un carré de 2,45 m. C'est la
   même convention que les diagrammes du volet Surfaces, et la seule qui se
   lise comme telle — une hauteur seule proportionnelle transformait les petits
   locaux en filets et les grands en colonnes, exact mais illisible.

   Le règlement impose parfois les deux côtés : la salle de sport double fait
   28 × 32 m. Ces cotes sont dans `program.js` et le schéma les lit ; il ne les
   redit pas.

   L'alignement, lui, ne vient plus des dimensions mais de la COLONNE : chaque
   pôle a un axe, ses locaux s'y centrent, les fils courent dans les gouttières.
   L'ancien schéma plaçait les siens à la main, et n'alignait rien. */
var CGAP = 20, NGAP = 5;             /* gouttière entre pôles, écart entre deux locaux */
var HEAD = 11, PAD = 3;              /* bandeau de pôle, marge intérieure */
var CHAN = 1.8;                      /* écart entre deux fils d'un même faisceau */
var HMIN = 0.9;                      /* filet du seul cas sans surface : le hors bilan */
var FS = 3.4, FSSM = 2.8;            /* corps du nom, corps de la surface */
var LINEH = FS * 1.12, SUBH = FSSM * 1.4;
var CWMIN = 26;                      /* largeur de colonne minimale : celle d'un nom */

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
/* Les côtés d'un local, en mètres. Cotes imposées par le règlement quand il en
   donne — elles vivent dans `program.js` —, carré de même surface sinon. */
export function nodeBox(nd){
  var A = nodeArea(nd);
  if(A.hors) return { w:HMIN * 4, h:HMIN, a:0, est:A.est, hors:1, split:0 };
  var it = (nd.k && nd.k.length === 1) ? ITEMBYKEY[nd.k[0]] : null;
  if(it && it.w && it.h) return { w:it.w, h:it.h, a:A.a, est:A.est, hors:0, split:it.split ? 1 : 0 };
  var c = Math.sqrt(A.a);
  return { w:c, h:c, a:A.a, est:A.est, hors:0, split:0 };
}

function layout(){
  /* 1 · la largeur d'un pôle : celle de son plus grand local, sans descendre
     sous ce qu'il faut pour écrire un nom. Une largeur unique, prise sur les
     1'296 m² de salles de classe, laissait quatre colonnes aux trois quarts
     vides. */
  SPOLE.forEach(function(pl){
    var w = CWMIN;
    SNODE.forEach(function(nd){ if(nd.p === pl.id) w = Math.max(w, nodeBox(nd).w); });
    pl.cw = Math.ceil(w);
  });

  /* 2 · chaque local : ses cotes, son nom, l'emplacement qu'il occupe */
  var x = 0, maxH = 0;
  SPOLE.forEach(function(pl, ci){
    var rows = SNODE.filter(function(nd){ return nd.p === pl.id; });
    var CW = pl.cw;
    pl.x = x; pl.rows = rows;
    var y = HEAD, t = 0;
    rows.forEach(function(nd, i){
      var B = nodeBox(nd);
      t += B.a;
      nd.bw = B.w; nd.bh = B.h; nd.box = B;
      nd.lines = wrapText(nd.n, Math.max(6, Math.floor((B.w - 2) / (FS * 0.52))), 2);
      var lab = nd.lines.length * LINEH + SUBH + 1.5;
      /* Le nom tient dans le local, ou il se range dessous. */
      nd.labIn = !B.hors && B.h >= lab + 1.5 && B.w >= 13;
      if(!nd.labIn) nd.lines = wrapText(nd.n, Math.floor((CW + 6) / (FS * 0.52)), 2);
      nd.slot = nd.labIn ? B.h : B.h + nd.lines.length * LINEH + SUBH + 1.5;
      nd.cx = x + CW / 2;                    /* le local est centré sur l'axe du pôle */
      nd.x = nd.cx - B.w / 2; nd.y = y;
      nd.cy = y + B.h / 2;                   /* le fil s'accroche au LOCAL, pas à l'emplacement */
      nd.cw = CW; nd.col = ci; nd.row = i;
      y += nd.slot + NGAP;
    });
    pl.area = t;
    pl.h = y - NGAP;
    if(pl.h > maxH) maxH = pl.h;
    x += CW + CGAP;
  });
  SCH_W = x - CGAP;
  SCH_H = maxH;
}

/* ---------- routage des fils ----------------------------------------------
   Deux cas, deux tracés, et rien d'autre : dans une colonne, le fil descend
   au bord ; d'une colonne à l'autre, il sort par le flanc, traverse la
   gouttière et rentre par le flanc d'en face. Les fils qui partagent une
   gouttière ou un canal sont décalés pour ne pas se superposer. */
/* Bords de la colonne d'un nœud : les canaux et les gouttières s'y appuient,
   et non sur les côtés du local, qui changent avec sa surface. */
function COL0(nd){ return nd.cx - nd.cw / 2; }
function COL1(nd){ return nd.cx + nd.cw / 2; }

function routes(){
  var chan = {}, gut = {}, out = [];
  SLINK.forEach(function(lk){
    var A = SMAP[lk.a], B = SMAP[lk.b];
    if(!A || !B) return;
    if(A.col === B.col){
      var hi = A.row < B.row ? A : B, lo = A.row < B.row ? B : A;
      if(lo.row - hi.row === 1 && hi.labIn){
        /* Rangs voisins et rien entre eux : le fil passe droit d'un bord à
           l'autre. Un nom rangé sous le rectangle du haut occupe ce vide : le
           fil part alors dans le canal, plutôt que de traverser le texte. */
        out.push({ lk:lk, d:"M " + hi.cx + " " + (hi.y + hi.bh) + " L " + lo.cx + " " + lo.y,
                   mx:hi.cx, my:(hi.y + hi.bh + lo.y) / 2 });
        return;
      }
      /* rangs éloignés : le fil contourne par le canal, à gauche de la colonne */
      /* Le canal d'une colonne longe son flanc gauche ; les fils d'une même
         colonne s'y rangent les uns derrière les autres. */
      var kc = hi.col;
      chan[kc] = (chan[kc] || 0) + 1;
      var cx = COL0(hi) - PAD - chan[kc] * CHAN;
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
    var gx = COL1(L) + 3 + (gut[kg] - 1) * CHAN;
    out.push({ lk:lk,
      d:"M " + (L.x + L.bw) + " " + L.cy + " L " + gx + " " + L.cy
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
  var fs = FS, fsSm = FSSM, fsCap = 3.4;

  /* La marge de gauche loge le canal de la première colonne : sans elle, les
     fils de l'enseignement sortaient du cadre et étaient rognés. */
  var REF = 100, cRef = Math.sqrt(REF), foot = cRef + 12;
  var svg = s("svg", { viewBox: "-16 -3 " + (SCH_W + 24) + " " + (SCH_H + 8 + foot),
    preserveAspectRatio: "xMinYMin meet", role: "img",
    "aria-label": "Schéma fonctionnel : les locaux rangés par pôle, reliés par les "
      + "adjacences que le règlement exige." });

  /* --- bandeaux de pôle : une colonne dit ce qu'elle regroupe --- */
  var gp = s("g", null);
  SPOLE.forEach(function(pl){
    gp.appendChild(s("rect", { x: pl.x - PAD, y: 0, width: pl.cw + 2 * PAD,
      height: pl.h + PAD, rx: 2,
      fill: "var(--rule-soft)", "fill-opacity": ".55", stroke: "none" }));
    /* Le nom du pôle se plie à la largeur de sa colonne : posé d'un trait, il
       débordait sur le pôle voisin dès que la colonne était étroite. */
    var cap = wrapText(pl.n.toUpperCase(), Math.max(8, Math.floor(pl.cw / (fsCap * 0.62))), 2);
    cap.forEach(function(ln, i){
      var t = s("text", { x: pl.x, y: HEAD - 3.5 - (cap.length - 1 - i) * fsCap * 1.15,
        "font-size": fsCap, fill: "var(--ink-3)", "letter-spacing": ".1" });
      t.textContent = ln;
      gp.appendChild(t);
    });
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
    /* Le rayon d'angle suit la hauteur : à 1,5 fixe, un rectangle de trois
       unités devenait une pastille et ne se comparait plus aux autres. */
    var rc = s("rect", { x: nd.x, y: nd.y, width: nd.bw, height: nd.bh,
      rx: Math.min(1.2, nd.bh / 4),
      fill: A.hors ? "var(--panel)" : col,
      "fill-opacity": A.hors ? "1" : "var(--fill-op)",
      stroke: col, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" });
    if(A.est || A.hors) rc.setAttribute("stroke-dasharray", "4 3");
    grp.appendChild(rc);
    /* La salle double se partage : le refend est au programme, pas ici. */
    if(nd.box.split){
      grp.appendChild(s("line", { x1: nd.cx, y1: nd.y, x2: nd.cx, y2: nd.y + nd.bh,
        stroke: col, "stroke-width": 1.2, "stroke-dasharray": "4 3",
        "vector-effect": "non-scaling-stroke" }));
    }

    /* Le nom et la surface forment UNE pile : centrée dans le rectangle quand
       il est assez haut, rangée juste dessous sinon. */
    var lines = nd.lines, blk = lines.length * LINEH + SUBH;
    var top0 = nd.labIn ? nd.cy - blk / 2 : nd.y + nd.bh + 1;
    var ink = nd.labIn ? "var(--ink)" : "var(--ink)";
    lines.forEach(function(ln, i){
      var t = s("text", { x: nd.cx, y: top0 + fs * 0.8 + i * LINEH, "text-anchor": "middle",
        "font-size": fs, fill: ink, "font-weight": 500 });
      t.textContent = ln;
      grp.appendChild(t);
    });
    var v = s("text", { x: nd.cx, y: top0 + lines.length * LINEH + fsSm * 0.95,
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

  /* --- l'étalon : ce que vaut un rectangle -----------------------------------
     Les surfaces sont écrites sur chaque carte, mais rien ne calibrait l'œil.
     Un rectangle de référence, à la même largeur que tous les autres, le fait. */
  var fy = SCH_H + 12;
  var gf = s("g", null);
  gf.appendChild(s("rect", { x: 0, y: fy, width: cRef, height: cRef, rx: 1.2,
    fill: "var(--ink-4)", "fill-opacity": ".18", stroke: "var(--ink-3)",
    "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }));
  var ft = s("text", { x: cRef + 4, y: fy + cRef / 2 + fsSm * 0.4, "font-size": fsSm,
    fill: "var(--ink-3)", "font-family": "'IBM Plex Mono', monospace" });
  ft.textContent = fmt(REF) + " m² · " + fmt(cRef) + " × " + fmt(cRef) + " m";
  gf.appendChild(ft);
  var f2 = s("text", { x: cRef + 46, y: fy + cRef / 2 + fs * 0.35, "font-size": fs,
    fill: "var(--ink-3)" });
  f2.textContent = "le dessin est en mètres : un local vaut sa surface, dans ses deux côtés";
  gf.appendChild(f2);
  svg.appendChild(gf);

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
