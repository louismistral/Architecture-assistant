/* ============================================================================
   LE SCHÉMA FONCTIONNEL

   Deux choses à lire d'un coup : les RELATIONS que le règlement exige, et ce
   que pèse chaque local. L'ancien schéma tenait la seconde en laissant tomber
   la première — chaque local dessiné à l'échelle, largeur ET hauteur libres, à
   des coordonnées posées à la main : rien n'alignait quoi que ce soit et les
   fils se croisaient.

   Les colonnes par pôle qui ont suivi alignaient tout, mais donnaient à lire
   l'organigramme du programme plutôt que les proximités qu'il exige — et le
   lien, seul, est la contrainte.

   Le dessin part donc du LIEN, à la façon d'une carte heuristique. Chaque
   composante connexe des adjacences est une GRAPPE — la notion même que le
   mixer déplace d'un bloc. Elle a un centre, le local le plus lié ; ses
   voisins rayonnent autour de lui par branches courbes, et les voisins de
   ceux-là sur l'anneau suivant. On voit alors ce qu'une colonne taisait : ce
   qui tient ensemble, jusqu'où, et autour de quoi.

   Les rectangles restent EN MÈTRES et à l'échelle : seule la disposition a
   changé. Toute la géométrie est DÉDUITE de `data/schema.js` — ajouter un
   nœud ou un lien ne demande aucune coordonnée, et l'échelle se recalcule sur
   les surfaces du jour.
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
var RGAP = 8;                        /* jour entre deux anneaux d'une grappe */
var AGAP = 6;                        /* jour entre deux locaux d'un même anneau */
var CLGAP = 14, CAPH = 9, PAD = 4;   /* jour entre grappes, bandeau, marge */
var FSCAP = 3.4;                     /* corps du titre d'une grappe */
var HMIN = 0.9;                      /* filet du seul cas sans surface : le hors bilan */
var FS = 3.4, FSSM = 2.8;            /* corps du nom, corps de la surface */
var LINEH = FS * 1.12, SUBH = FSSM * 1.4;

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

/* ---------- le graphe : qui doit toucher qui -------------------------------
   Le schéma était rangé en COLONNES, une par pôle, et les liens couraient
   d'une colonne à l'autre dans des gouttières. L'ordre y était parfait et le
   propos perdu : on lisait l'organigramme du programme, pas les proximités
   qu'il exige. Or c'est le lien qui est la contrainte.

   Le dessin part donc du LIEN. Chaque composante connexe des adjacences est
   une GRAPPE — la même notion que le mixer déplace d'un bloc —, elle a un
   centre, et ses locaux rayonnent autour de lui par branches courbes, de
   proche en proche. C'est la forme d'une carte heuristique, et elle dit ce
   qu'une colonne taisait : ce qui tient ensemble, et jusqu'où. */
function graphe(){
  var adj = {};
  SNODE.forEach(function(nd){ adj[nd.id] = []; });
  SLINK.forEach(function(lk){
    if(!adj[lk.a] || !adj[lk.b]) return;
    adj[lk.a].push({ id:lk.b, lk:lk });
    adj[lk.b].push({ id:lk.a, lk:lk });
  });
  return adj;
}
/* Les grappes, dans l'ordre des pôles : la plus liée d'abord. */
function grappes(adj){
  var vus = {}, out = [];
  SNODE.forEach(function(nd){
    if(vus[nd.id]) return;
    var pile = [nd.id], ids = [];
    vus[nd.id] = 1;
    while(pile.length){
      var id = pile.pop();
      ids.push(id);
      adj[id].forEach(function(e){ if(!vus[e.id]){ vus[e.id] = 1; pile.push(e.id); } });
    }
    out.push(ids);
  });
  return out;
}
var PORD = {};
SPOLE.forEach(function(pl, i){ PORD[pl.id] = i; });

/* L'arbre d'une grappe : son centre est le local le plus lié — à égalité, le
   plus grand. Les liens qui ne sont pas dans l'arbre ne disparaissent pas : ce
   sont des exigences comme les autres, et ils se tracent en travers. */
function arbre(ids, adj){
  var hub = ids[0], best = -1;
  ids.forEach(function(id){
    var sc = adj[id].length * 1e6 + nodeArea(SMAP[id]).a;
    if(sc > best){ best = sc; hub = id; }
  });
  var par = {}, dep = {}, kids = {}, vus = {}, ordre = [hub], i = 0;
  ids.forEach(function(id){ kids[id] = []; });
  vus[hub] = 1; dep[hub] = 0; par[hub] = null;
  while(i < ordre.length){
    var id = ordre[i++];
    /* Les enfants se rangent par pôle puis par surface : deux locaux du même
       pôle restent dans le même secteur, et la grappe garde une lecture. */
    adj[id].slice().sort(function(x, y){
      var px = PORD[SMAP[x.id].p], py = PORD[SMAP[y.id].p];
      if(px !== py) return px - py;
      return nodeArea(SMAP[y.id]).a - nodeArea(SMAP[x.id]).a;
    }).forEach(function(e){
      if(vus[e.id]) return;
      vus[e.id] = 1; par[e.id] = id; dep[e.id] = dep[id] + 1;
      kids[id].push(e.id); ordre.push(e.id);
    });
  }
  return { hub:hub, par:par, dep:dep, kids:kids, ordre:ordre, ids:ids };
}

/* ---------- la carte d'une grappe ------------------------------------------
   Un anneau par profondeur, dont le rayon est déduit de l'encombrement des
   locaux qu'il porte : rien n'est posé à la main. L'angle d'une branche est
   proportionnel à ce qu'elle a à loger — sa part du tour, et celle de ses
   propres branches. Quand le tour ne suffit plus, on écarte les anneaux : les
   secteurs étant en 1/rayon, un seul passage suffit à les ramener dans le
   tour. */
var TOUR = Math.PI * 2 * 0.94;
function poser(T){
  /* Le rayon se calcule NŒUD PAR NŒUD, et non par anneau. Un anneau commun
     prenait sa distance sur le plus encombrant de ses locaux : l'abri PC de
     750 m² repoussait tout le deuxième anneau, et la chaîne de petits locaux
     de l'UAPE partait à deux cents mètres du centre pour rien. */
  var R = {}, i, id, pa;
  R[T.hub] = 0;
  for(i = 1; i < T.ordre.length; i++){
    id = T.ordre[i]; pa = T.par[id];
    R[id] = R[pa] + SMAP[pa].diam / 2 + RGAP + SMAP[id].diam / 2;
  }

  var sp = {};
  function spans(){
    var j;
    for(j = T.ordre.length - 1; j >= 0; j--){
      var k = T.ordre[j], nd = SMAP[k], som = 0;
      T.kids[k].forEach(function(c){ som += sp[c]; });
      var besoin = R[k] > 0 ? (nd.diam + AGAP) / R[k] : 0;
      sp[k] = Math.max(besoin, som);
    }
    var t = 0;
    T.kids[T.hub].forEach(function(c){ t += sp[c]; });
    return t;
  }
  /* Le tour ne suffit plus : on écarte tout. Les secteurs étant en 1/rayon, un
     seul passage les ramène dans le tour. */
  var tot = spans();
  if(tot > TOUR){
    var f = tot / TOUR;
    T.ids.forEach(function(x){ R[x] *= f; });
    tot = spans();
  }

  var ang = {};
  ang[T.hub] = 0;
  /* La racine remplit le tour : ses branches s'écartent au maximum. Une
     branche interne, elle, reste CENTRÉE dans le secteur de son parent — sinon
     elle s'en éloigne et le lien cesse de se suivre du regard. */
  function repartir(id, a0, a1, plein){
    var k = T.kids[id], som = 0;
    k.forEach(function(c){ som += sp[c]; });
    if(!som) return;
    var large = a1 - a0;
    var ech = plein ? large / som : 1;
    var cur = a0 + (plein ? 0 : (large - som) / 2);
    k.forEach(function(c){
      var w = sp[c] * ech;
      ang[c] = cur + w / 2;
      repartir(c, cur, cur + w, false);
      cur += w;
    });
  }
  repartir(T.hub, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, true);

  T.ids.forEach(function(x){
    var nd = SMAP[x], r = R[x], th = ang[x];
    nd.th = th; nd.r = r;
    nd.cx = r * Math.cos(th); nd.cy = r * Math.sin(th);
    nd.x = nd.cx - nd.bw / 2; nd.y = nd.cy - nd.bh / 2;
  });
  return T;
}

/* Les cotes d'un local et la place que prend son nom — communes aux deux
   temps du calcul, puisque le secteur d'une branche en dépend. */
function mesurer(){
  SNODE.forEach(function(nd){
    var B = nodeBox(nd);
    nd.bw = B.w; nd.bh = B.h; nd.box = B;
    nd.lines = wrapText(nd.n, Math.max(6, Math.floor((B.w - 2) / (FS * 0.52))), 2);
    var lab = nd.lines.length * LINEH + SUBH + 1.5;
    nd.labIn = !B.hors && B.h >= lab + 1.5 && B.w >= 13;
    if(!nd.labIn) nd.lines = wrapText(nd.n, 18, 2);
    /* Ce que le local occupe VRAIMENT : son rectangle, et le nom rangé dessous
       quand il n'y tient pas. Le secteur d'une branche se mesurait sur le seul
       rectangle — un local de 9 m² sous un nom de trente mètres de long se
       voyait accorder trois mètres, et les noms se chevauchaient. */
    var lw = 0;
    nd.lines.forEach(function(ln){ lw = Math.max(lw, ln.length * FS * 0.52); });
    lw = Math.max(lw, 9 * FSSM * 0.62);            /* la ligne de surface */
    nd.labW = nd.labIn ? 0 : lw;
    nd.labH = nd.labIn ? 0 : lab;
    /* Diamètre du cercle qui contient tout : une grappe tourne, donc la mesure
       ne peut pas dépendre de l'angle. */
    var ew = Math.max(nd.bw, nd.labW), eh = nd.bh + nd.labH;
    nd.diam = Math.sqrt(ew * ew + eh * eh);
  });
}

/* Ce qu'une grappe annonce d'elle-même : son compte, sa surface, et les pôles
   qu'elle TRAVERSE — car elle en traverse, et c'est précisément ce que des
   colonnes par pôle ne pouvaient pas montrer. */
function legende(T){
  var aire = 0, pols = [];
  T.ids.forEach(function(id){
    aire += nodeArea(SMAP[id]).a;
    var pp = SMAP[id].p;
    if(pols.indexOf(pp) < 0) pols.push(pp);
  });
  pols.sort(function(a, b){ return PORD[a] - PORD[b]; });
  return T.ids.length + " LOCAUX LIÉS · " + fmt(Math.round(aire)) + " M² · "
    + pols.map(function(id){
        var n = id;
        SPOLE.forEach(function(x){ if(x.id === id) n = x.n; });
        return n.toUpperCase();
      }).join(" · ");
}

/* Le cadre d'une grappe, nom rangé dessous compris. */
function cadre(T){
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  T.ids.forEach(function(id){
    var nd = SMAP[id], lw = Math.max(nd.bw, nd.labW);
    if(nd.cx - lw / 2 < x0) x0 = nd.cx - lw / 2;
    if(nd.cx + lw / 2 > x1) x1 = nd.cx + lw / 2;
    if(nd.y < y0) y0 = nd.y;
    if(nd.y + nd.bh + nd.labH > y1) y1 = nd.y + nd.bh + nd.labH;
  });
  T.cap = legende(T);
  T.x0 = x0 - PAD; T.y0 = y0 - PAD - CAPH;
  /* Le cadre tient aussi son propre titre : plus large que le dessin pour une
     grappe de deux locaux, il sortait de la planche et se rognait. */
  T.w = Math.max(x1 - x0 + 2 * PAD, T.cap.length * FSCAP * 0.6 + 2 * PAD);
  T.h = y1 - y0 + 2 * PAD + CAPH;
  return T;
}

function layout(){
  mesurer();
  var adj = graphe();
  var maps = grappes(adj).map(function(ids){ return cadre(poser(arbre(ids, adj))); });
  /* La plus grande grappe donne la largeur de la planche ; les autres se
     rangent derrière elle, par étagères. Une seule rangée aurait doublé la
     largeur et divisé par deux le corps des noms. */
  maps.sort(function(a, b){ return b.w * b.h - a.w * a.h; });
  var large = 0;
  maps.forEach(function(m){ if(m.w > large) large = m.w; });
  var x = 0, y = 0, hRang = 0, W = 0;
  maps.forEach(function(m){
    /* On ne casse une étagère que si la grappe la dépasse VRAIMENT : un ou
       deux mètres de plus élargissent la planche d'un cheveu, une étagère de
       plus lui coûte toute une hauteur de grappe. */
    if(x > 0 && x + m.w > large + CLGAP + 0.5){ x = 0; y += hRang + CLGAP; hRang = 0; }
    m.dx = x - m.x0; m.dy = y - m.y0;
    m.ox = m.dx; m.oy = m.dy;              /* le centre de la grappe, une fois posée */
    m.ids.forEach(function(id){
      var nd = SMAP[id];
      nd.cx += m.dx; nd.cy += m.dy; nd.x += m.dx; nd.y += m.dy;
    });
    m.px = x; m.py = y;
    if(x + m.w > W) W = x + m.w;
    if(m.h > hRang) hRang = m.h;
    x += m.w + CLGAP;
  });
  SCH_W = W;
  SCH_H = y + hRang;
  return maps;
}

/* ---------- les branches ---------------------------------------------------
   Une branche de carte heuristique est une COURBE : elle sort de son local et
   entre dans l'autre, et deux branches voisines ne se confondent pas comme le
   faisaient deux fils orthogonaux rangés dans la même gouttière. Le lien de
   l'arbre suit le rayon, les deux autres s'infléchissent vers le centre de la
   grappe. Le trait, lui, ne dit toujours qu'une chose : la nature de
   l'exigence. */
function bord(nd, ux, uy){
  var w = nd.bw / 2, h = nd.bh / 2;
  var tx = ux ? w / Math.abs(ux) : Infinity;
  var ty = uy ? h / Math.abs(uy) : Infinity;
  var t = Math.min(tx, ty);
  return { x: nd.cx + ux * t, y: nd.cy + uy * t };
}
function branches(maps){
  var ou = {};
  maps.forEach(function(m){ m.ids.forEach(function(id){ ou[id] = m; }); });
  var out = [];
  SLINK.forEach(function(lk){
    var A = SMAP[lk.a], B = SMAP[lk.b], m = ou[lk.a];
    if(!A || !B || !m) return;
    var estArbre = (m.par[lk.a] === lk.b) || (m.par[lk.b] === lk.a);
    if(estArbre){
      var P = m.par[lk.a] === lk.b ? B : A, C = P === A ? B : A;
      /* Le centre n'a pas d'angle : sa branche part droit sur l'enfant. */
      var t0 = P.r > 0 ? P.th : C.th, t1 = C.th;
      var p0 = bord(P, Math.cos(t0), Math.sin(t0));
      var p1 = bord(C, -Math.cos(t1), -Math.sin(t1));
      var rm = P.r + (C.r - P.r) * 0.55;
      var c1x = m.ox + rm * Math.cos(t0), c1y = m.oy + rm * Math.sin(t0);
      var c2x = m.ox + rm * Math.cos(t1), c2y = m.oy + rm * Math.sin(t1);
      out.push({ lk:lk,
        d:"M " + p0.x.toFixed(2) + " " + p0.y.toFixed(2)
          + " C " + c1x.toFixed(2) + " " + c1y.toFixed(2)
          + " " + c2x.toFixed(2) + " " + c2y.toFixed(2)
          + " " + p1.x.toFixed(2) + " " + p1.y.toFixed(2),
        mx:(p0.x + 3 * c1x + 3 * c2x + p1.x) / 8,
        my:(p0.y + 3 * c1y + 3 * c2y + p1.y) / 8 });
      return;
    }
    /* Hors de l'arbre : la corde s'infléchit vers le centre de la grappe. */
    var qx = m.ox + ((A.cx + B.cx) / 2 - m.ox) * 0.55;
    var qy = m.oy + ((A.cy + B.cy) / 2 - m.oy) * 0.55;
    var a0 = bord(A, qx - A.cx, qy - A.cy);
    var b0 = bord(B, qx - B.cx, qy - B.cy);
    out.push({ lk:lk,
      d:"M " + a0.x.toFixed(2) + " " + a0.y.toFixed(2)
        + " Q " + qx.toFixed(2) + " " + qy.toFixed(2)
        + " " + b0.x.toFixed(2) + " " + b0.y.toFixed(2),
      mx:(a0.x + 2 * qx + b0.x) / 4, my:(a0.y + 2 * qy + b0.y) / 4 });
  });
  return out;
}

export function drawSchema(host){
  while(host.firstChild) host.removeChild(host.firstChild);
  var maps = layout();
  var eff = Math.max(host.clientWidth || 900, 900) / (SCH_W + 12);
  var fs = FS, fsSm = FSSM, fsCap = FSCAP;

  var REF = 100, cRef = Math.sqrt(REF), foot = cRef + 12;
  var svg = s("svg", { viewBox: "-6 -3 " + (SCH_W + 12) + " " + (SCH_H + 8 + foot),
    preserveAspectRatio: "xMinYMin meet", role: "img",
    "aria-label": "Schéma fonctionnel : les locaux groupés en grappes de proximité, "
      + "chacune autour du local le plus lié, reliés par les adjacences que le "
      + "règlement exige." });

  /* --- le cadre d'une grappe, et ce qu'elle regroupe ---
     Une grappe se lit d'abord comme un tout : elle porte son compte, sa
     surface, et les pôles qu'elle traverse — car elle en traverse, et c'est
     précisément ce que les colonnes par pôle ne pouvaient pas montrer. */
  var gp = s("g", null);
  maps.forEach(function(m){
    gp.appendChild(s("rect", { x: m.px, y: m.py, width: m.w, height: m.h, rx: 3,
      fill: "var(--rule-soft)", "fill-opacity": ".5", stroke: "none" }));
    var cap = s("text", { x: m.px + PAD, y: m.py + CAPH - 3,
      "font-size": fsCap, fill: "var(--ink-3)", "letter-spacing": ".1" });
    cap.textContent = m.cap;
    gp.appendChild(cap);
  });
  svg.appendChild(gp);

  /* --- branches --- */
  var gl = s("g", { fill: "none" });
  branches(maps).forEach(function(r){
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
     Un rectangle de référence, posé au pied de la planche, le fait. */
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
