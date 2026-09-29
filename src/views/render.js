import { dec, el, fmt } from "../core/format.js";
import { s as svgEl } from "../core/svg.js";
import {
  ALL_OFF, BUILT, BUILTG, CIRC, CIRCA, COULOIR, ESTT, FMAP, GRAND, GRANDG, PROG,
  setCirc, setItemArea
} from "../core/model.js";
import { curSub, setSub, subBtnId, subsOf, tabOf, view, writeHash } from "../core/viewstate.js";
import { parametresVue } from "./parametres.js";
import { forensicsVue } from "./forensics.js";
import { renduVue } from "./rendu.js";

/* Ce que chaque onglet à construire viendra faire, dans l'ordre du concours. */
var A_CONSTRUIRE = {
  typologie:   "Plans et coupes, dessinés dans les volumes que le massing a posés.",
  tectonique:  "La construction : structure, portées, trames, assemblages.",
  materialite: "Les matériaux, leurs teintes, leurs textures et leur vieillissement.",
};
import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";
import { FREE } from "../data/schema.js";
import { drawMass, massPanel, massPrepare, massRejouer, setMassNav } from "./massing.js";
import { drawMix, mixPanel, mixPiles, mixRejouer, setMixNav } from "./mixer.js";
import { saveSoon } from "../mix/store.js";
import { constraintsSection } from "./constraints.js";
import { CIRCPAT, hatchDefs, panelsEl, scaleBar } from "./diagram.js";
import {
  introSection, legendBlock, renderBar, renderLegend, setAreaHandler,
  setCircHandler, varBlock
} from "./legend.js";
import { SMAP, cartesGrappes, dessinGrappe, etalon, linkKey, linkList } from "./schema.js";
import { tip } from "./tooltip.js";

/* Une surface saisie dans le cahier des charges est écrite dans le modèle, puis
   tout ce qui la montre est refait. Le mixer n'a pas besoin d'être ouvert : il
   relit les surfaces à chaque rendu, il n'en garde aucune copie. */
setAreaHandler(function(key, v){
  if(!setItemArea(key, v)) return false;
  refreshProgramme();
  return true;
});
setCircHandler(function(p){
  if(!setCirc(p)) return false;
  refreshProgramme();
  return true;
});
/* Une surface saisie, ou la part de circulation réglée, déplace TOUT le volet
   Surfaces : le chiffre-clé, les diagrammes à l'échelle, la somme de chaque
   chapitre et le récapitulatif. Seuls la légende et le récapitulatif étaient
   refaits — un chapitre continuait donc d'afficher l'ancienne circulation
   après qu'on l'eut changée. Le champ reprend le focus par son id stable,
   comme il le faisait déjà quand la légende seule était remplacée. */
function refreshProgramme(){
  if(view.tab === "programme" && curSub() === "surfaces") render();
  else { renderBar(); renderLegend(); renderTotals(); }
  saveSoon();
}

/* Les deux outils reviennent sur leur volet d'origine après un tirage lancé
   depuis les contraintes. Ils ne peuvent pas importer `render` — il les importe
   déjà —, alors on le leur donne. */
function allerAuVolet(sub){
  setSub(sub);
  writeHash();
  render();
}
setMixNav(allerAuVolet);
setMassNav(allerAuVolet);

/* ---------- barre de vue de la section des surfaces ----------
   Le regroupement et le niveau de détail étaient dans le chrome global, au même
   rang que la navigation : un réglage ressemblait à une destination, et le
   niveau de détail restait offert sur trois onglets où il ne gouverne rien. */
function programmeBar(){
  var bar = el("div","viewbar");

  function group(caption, label, pairs, key, onPick){
    var g = el("div","btn-group");
    g.setAttribute("role","group");
    g.setAttribute("aria-label", label);
    g.appendChild(el("span","segcap", caption));
    pairs.forEach(function(pr){
      var b = el("button","btn", pr[1]);
      b.type = "button";
      b.setAttribute("aria-current", String(view[key] === pr[0]));
      b.addEventListener("click", function(){
        if(view[key] === pr[0]) return;
        view[key] = pr[0];
        onPick();
      });
      g.appendChild(b);
    });
    return g;
  }

  bar.appendChild(group("Grouper par", "Regroupement du programme",
    [["chap","Chapitres"],["fam","Familles"]], "group", render));
  bar.appendChild(group("À l’échelle", "Ce que dessine la colonne à l’échelle",
    [["agg","Un carré par poste"],["unit","Un carré par pièce"]], "mode", render));
  bar.appendChild(el("span","spacer"));
  bar.appendChild(scaleBar(NOMEN_K, 20));
  return bar;
}

/* ---------- volets du cahier des charges ----------
   Le patron d'onglets du chrome, repris tel quel un cran plus bas parce que
   c'est la même chose : `role="tablist"`, `aria-selected`, un seul arrêt de
   tabulation pour le groupe, flèches pour circuler, et un `role="tabpanel"`
   nommé par le volet actif. */
function subTabs(){
  var nav = el("nav","btn-group subtabs");
  nav.setAttribute("role","tablist");
  nav.setAttribute("aria-label","Volets de " + view.tab);
  var SUBS = subsOf(), ids = [];
  SUBS.forEach(function(sb, i){
    var b = el("button","btn", sb.label);
    b.type = "button";
    b.id = subBtnId(view.tab, sb.id);
    b.setAttribute("role","tab");
    b.setAttribute("aria-selected", String(curSub() === sb.id));
    b.setAttribute("aria-controls","subpanel");
    b.tabIndex = curSub() === sb.id ? 0 : -1;
    b.addEventListener("click", function(){
      if(curSub() === sb.id) return;
      setSub(sb.id);
      writeHash();
      render();
    });
    b.addEventListener("keydown", function(e){
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1
            : e.key === "Home" ? -99 : e.key === "End" ? 99 : 0;
      if(!d) return;
      e.preventDefault();
      var n = d === -99 ? 0 : d === 99 ? SUBS.length - 1 : (i + d + SUBS.length) % SUBS.length;
      setSub(SUBS[n].id);
      writeHash();
      render();
      /* Le rendu a refait les boutons : on retrouve le nouveau par son id. */
      var again = document.getElementById(ids[n]);
      if(again) again.focus();
    });
    ids.push(b.id);
    nav.appendChild(b);
  });
  return nav;
}

/* Le volet d'un onglet : la barre, puis l'hôte. Le cahier des charges le faisait
   seul ; les deux outils ont les mêmes volets, donc le même patron — il n'y a
   aucune raison qu'un onglet ait sa propre façon de changer de volet. */
function subHost(){
  var bar = el("div","subtabs-bar");
  bar.appendChild(subTabs());
  panelsEl.appendChild(bar);
  var host = el("div","subpanel");
  host.id = "subpanel";
  host.setAttribute("role","tabpanel");
  host.setAttribute("aria-labelledby", subBtnId(view.tab, curSub()));
  panelsEl.appendChild(host);
  return host;
}

/* Un rang de section : le numéro dit l'ordre de lecture, le titre dit quoi. */
function sectHead(n, titre, sous){
  var h = el("div","secthead");
  h.appendChild(el("span","secthead__n mono", n));
  var t = el("div");
  t.appendChild(el("h2", null, titre));
  if(sous) t.appendChild(el("p", null, sous));
  h.appendChild(t);
  return h;
}

export function render(){
  while(panelsEl.firstChild) panelsEl.removeChild(panelsEl.firstChild);
  tip.style.opacity = "0";
  renderBar();

  /* Les deux outils ont chacun deux volets : ce qu'ils FONT, et les CONTRAINTES
     qui gouvernent ce qu'ils font. Le second est la page Paramètres &
     contraintes filtrée sur l'onglet : la réponse à « pourquoi obtient-on ce
     résultat », et l'endroit où on le corrige. */
  if(view.tab === "mixer"){
    var mh = subHost();
    if(curSub() === "contraintes"){
      mh.appendChild(parametresVue(render, { onglet:"mixer", titre:"Ce qui gouverne la répartition",
        rejouer: mixRejouer, extra: mixPiles() }));
      return;
    }
    mh.appendChild(mixPanel());
    drawMix();
    return;
  }
  /* Le massing se dessine APRÈS avoir rejoint le document : son plan a besoin
     d'une largeur mesurable, et WebGL d'un canevas attaché. */
  if(view.tab === "massing"){
    var xh = subHost();
    if(curSub() === "contraintes"){
      massPrepare();
      xh.appendChild(parametresVue(render, { onglet:"massing", titre:"Ce qui gouverne la volumétrie",
        rejouer: massRejouer }));
      return;
    }
    xh.appendChild(massPanel());
    requestAnimationFrame(drawMass);
    return;
  }

  if(view.tab === "rendu"){ subHost().appendChild(renduVue(curSub())); return; }
  if(view.tab === "parametres"){ panelsEl.appendChild(parametresVue(render)); return; }
  if(view.tab === "forensics"){ forensicsVue(panelsEl, render); return; }

  /* Les onglets à construire. Ils sont là pour que la chronologie soit
     entière, et ne promettent rien d'autre que ce qu'ils viendront faire. */
  if(A_CONSTRUIRE[view.tab]){
    var tv = el("section","tab-vide");
    tv.appendChild(el("h2", null, tabOf(view.tab).n + " " + tabOf(view.tab).label));
    tv.appendChild(el("p", null, A_CONSTRUIRE[view.tab] + " Cet onglet est à construire."));
    panelsEl.appendChild(tv);
    return;
  }

  /* ================= Programme =================
     Trois lectures du même règlement : les surfaces qu'il donne, le cadre qu'il
     impose, les proximités qu'il exige. Elles étaient empilées sur une seule
     page et numérotées 1, 2, 3 ; elles sont des volets, parce qu'on y revient
     sans arrêt et qu'on ne les lit pas d'affilée. La chronologie du concours,
     elle, reste dans les onglets : Programme, puis le mixer. */
  panelsEl.appendChild(introSection());
  var host = subHost();

  if(curSub() === "contraintes"){
    host.appendChild(sectHead("2", "Contraintes",
      "Le cadre : site, hauteurs libres, protection incendie, séisme, mobilité, second temps."));
    host.appendChild(constraintsSection());
    return;
  }
  /* Les adjacences fermaient les contraintes, sur une planche unique : on les
     lisait après quatre écrans de tableaux, et trois petites grappes flottaient
     dans le vide de la grande. Elles ont leur volet, une carte par grappe. */
  if(curSub() === "adjacences"){
    adjacencesVolet(host);
    return;
  }

  /* ---- volet Surfaces ---- */
  host.appendChild(sectHead("1", "Surfaces",
    "Le programme des locaux, chaque bloc à sa surface réelle. Les huit postes "
    + "que le règlement ne chiffre pas, et la part de circulation, se saisissent ici."));
  host.appendChild(varBlock());
  host.appendChild(legendBlock());
  host.appendChild(programmeBar());

  host.appendChild(nomenclature());
  host.appendChild(totalsSection());
  host.appendChild(sourcesSection());
}

/* ---------- la nomenclature ------------------------------------------------
   Le volet dessinait chaque ensemble comme une planche de carrés sur un
   quadrillage de 10 m, sous un titre qui portait cinq chiffres, et repliait la
   liste des postes sous un décompte. Le dessin devenait l'illustration de sa
   propre légende : on survolait les carrés pour lire ce que la liste cachait.

   La liste est désormais la vue : UN tableau, un ensemble par groupe de
   lignes, et chaque ligne porte en marge un carré À L'ÉCHELLE — la même pour
   toutes, `NOMEN_K` pixels par mètre —, ou une rangée de carrés, un par pièce.
   On compare encore les tailles d'un coup d'œil, et l'on lit les chiffres sans
   les chercher. La circulation a sa ligne dans chaque ensemble, hachurée.

   `circ` est la part de circulation que porte le groupe — les couloirs de SES
   pièces et sa part des cages ; `gross` est sa somme, circulation comprise. Les
   deux viennent du modèle : rien n'est recalculé ici. */
var NOMEN_K = 1.6, NOMEN_GW = 168;
function nomenclature(){
  var groups = view.group === "chap"
    ? CHAP.map(function(c){ return { name:c.name, sub:c.sub, total:c.total, circ:c.circ,
        gross:c.gross, items:c.items, off:c.off, col:null }; })
    : FAM.filter(function(f){ return f.items.length; }).map(function(f){
        return { name:f.name, sub:f.d.charAt(0).toUpperCase() + f.d.slice(1) + ".", total:f.total,
                 circ:f.circ, gross:f.gross, items:f.items, off:[], col:f.c };
      });
  var fam = view.group === "fam";

  var wrap = el("div","nomen");
  wrap.appendChild(hatchDefs());
  var tb = el("table","nomen__t");
  tb.appendChild(el("caption","vh", "Programme des locaux, par "
    + (fam ? "famille d’usage" : "chapitre") + " : nombre, surface unitaire, surface et part, "
    + "avec un dessin à l’échelle de chaque poste"));
  var thd = el("thead"), tr0 = el("tr");
  [["Poste",""],["À l’échelle",""],["Nombre","n"],["Unité","n"],["Surface","n"],["Part","n"]]
    .forEach(function(c){ var th = el("th", c[1], c[0]); th.scope = "col"; tr0.appendChild(th); });
  thd.appendChild(tr0); tb.appendChild(thd);

  groups.forEach(function(gp){
    var body = el("tbody"), trg = el("tr","nomen__g"), th = el("th");
    th.colSpan = 6; th.scope = "rowgroup";
    var hd = el("div","nomen__gh");
    var nm = el("span","nomen__gn");
    if(gp.col){ var sw = el("i","sw"); sw.style.backgroundColor = "var(" + gp.col + ")"; nm.appendChild(sw); }
    nm.appendChild(document.createTextNode(gp.name));
    hd.appendChild(nm);
    /* Le chiffre du groupe est sa surface BÂTIE : le programme plus la
       circulation qu'il porte. Le reste de l'application — le mixer, les
       plateaux, les hauteurs — travaille sur le bâti. */
    hd.appendChild(el("span","nomen__gt mono", fmt(Math.round(gp.gross)) + " m²"));
    th.appendChild(hd);
    var pieces = gp.items.reduce(function(a, i){ return a + i.nb; }, 0);
    th.appendChild(el("span","nomen__gs",
      gp.items.length + " postes · " + pieces + " pièces · " + fmt(gp.total) + " m² de programme"
      + (gp.circ > 0.5 ? " + " + fmt(Math.round(gp.circ)) + " m² de circulation" : "")
      + " · " + Math.round(gp.gross / GRANDG * 100) + " % du total"));
    if(gp.sub) th.appendChild(el("span","nomen__gd", gp.sub));
    trg.appendChild(th); body.appendChild(trg);

    gp.items.forEach(function(it){ body.appendChild(ligne(it, gp, fam)); });
    if(gp.circ > 0.5){
      body.appendChild(ligne({ n:"Circulation", nb:1, u:gp.circ, tot:gp.circ, f:null, circ:1,
        note:"couloirs de " + dec(COULOIR) + " m devant ses pièces, et sa part des cages d’escalier" }, gp, fam));
    }
    /* « Non chiffré au programme » désignait DEUX statuts opposés à 30 cm
       d'écart : ces postes-ci n'ont aucune surface et ne comptent dans aucun
       total, tandis que les huit postes « à préciser » en ont une et sont dans
       les 7'025 m². */
    if(gp.off && gp.off.length){
      var tro = el("tr","nomen__off"), td = el("td");
      td.colSpan = 6;
      td.appendChild(el("b", null, "Hors bilan — "));
      td.appendChild(document.createTextNode(gp.off.join(" · ")));
      td.appendChild(el("span","note", "mentionnés au règlement, jamais comptés dans les totaux."));
      tro.appendChild(td); body.appendChild(tro);
    }
    tb.appendChild(body);
  });
  var sc = el("div","nomen__scroll");
  sc.appendChild(tb);
  wrap.appendChild(sc);

  if(fam && ALL_OFF.length){
    var o2 = el("div","unpriced");
    o2.appendChild(el("b", null, "Hors bilan — "));
    o2.appendChild(document.createTextNode(ALL_OFF.join(" · ")));
    o2.appendChild(el("span","note", "mentionnés au règlement, jamais comptés dans les totaux."));
    wrap.appendChild(o2);
  }
  return wrap;
}

/* Une ligne de la nomenclature : le nom, sa note, le dessin, les chiffres. */
function ligne(it, gp, fam){
  var tr = el("tr", it.circ ? "is-circ" : null);
  var tn = el("td","nomen__nm"), inn = el("div","nomen__in");
  var sw = el("i","sw");
  if(it.circ) sw.classList.add("sw--circ");
  else {
    sw.style.backgroundColor = "var(" + FMAP[it.f].c + ")";
    if(it.f === "tec") sw.classList.add("is-hatched");
    if(it.est) sw.classList.add("sw--dashed");
  }
  inn.appendChild(sw);
  var t = el("div");
  var b = el("b", null, it.n);
  t.appendChild(b);
  if(it.est){
    t.appendChild(document.createTextNode(" "));
    t.appendChild(el("span","esttag", it.set ? "fixée" : "à préciser"));
  }
  var sub = (fam && it.chap ? it.chap : "") + (fam && it.chap && it.note ? " · " : "") + (it.note || "");
  if(sub) t.appendChild(el("span","note", sub));
  inn.appendChild(t);
  tn.appendChild(inn); tr.appendChild(tn);

  var tg = el("td","nomen__gl");
  tg.appendChild(glyphe(it));
  tr.appendChild(tg);
  tr.appendChild(el("td","n", it.circ ? "—" : String(it.nb)));
  tr.appendChild(el("td","n", it.circ ? "—" : fmt(it.u) + " m²"));
  tr.appendChild(el("td","n", fmt(Math.round(it.tot)) + " m²"));
  var tp = el("td","n"), pt = el("div","nomen__part"), bar = el("i");
  var part = gp.gross > 0 ? it.tot / gp.gross : 0;
  bar.style.width = Math.max(1, part * 60).toFixed(1) + "px";
  pt.appendChild(bar);
  pt.appendChild(document.createTextNode(Math.round(part * 100) + " %"));
  tp.appendChild(pt); tr.appendChild(tp);
  return tr;
}

/* Le dessin d'un poste, à l'échelle commune : un carré de sa surface — ou ses
   cotes quand le règlement les impose, la salle double fait 32 × 28 m —, ou
   une rangée de carrés, un par pièce. La couleur est celle de la famille, la
   hachure celle du technique et de la circulation, le tireté celui des
   surfaces à préciser : les mêmes conventions que partout ailleurs. */
function glyphe(it){
  var K = NOMEN_K, GW = NOMEN_GW;
  var col = it.circ ? "var(--faint-foreground)" : "var(" + FMAP[it.f].c + ")";
  var fill = it.circ ? "url(#" + CIRCPAT + ")" : (it.f === "tec" ? "url(#" + CIRCPAT + "-tec)" : col);
  var op = it.circ || it.f === "tec" ? "1" : (it.est ? "0.1" : "var(--fill-op)");
  function carre(g, x, y, w, h){
    var r = svgEl("rect", { x: x + .5, y: y + .5, width: Math.max(1, w - .5), height: Math.max(1, h - .5),
      fill: fill, "fill-opacity": op, stroke: col, "stroke-width": 1 });
    if(it.est) r.setAttribute("stroke-dasharray", "3 2");
    g.appendChild(r);
  }
  var g = svgEl("g", { "class": "blk" }), W, H;
  if(view.mode === "agg" || it.nb === 1 || it.circ){
    var w = it.w ? it.w * K : Math.sqrt(it.tot) * K, h = it.h ? it.h * K : w;
    w = Math.max(2, Math.min(w, GW)); h = Math.max(2, h);
    carre(g, 0, 0, w, h);
    W = w + 1; H = h + 1;
  } else {
    var c = Math.max(2, Math.sqrt(it.u) * K), gap = c < 5 ? 1 : 2;
    var per = Math.max(1, Math.floor((GW + gap) / (c + gap))), rows = Math.ceil(it.nb / per);
    for(var i = 0; i < it.nb; i++) carre(g, (i % per) * (c + gap), Math.floor(i / per) * (c + gap), c, c);
    W = Math.min(it.nb, per) * (c + gap); H = rows * (c + gap);
  }
  var svg = svgEl("svg", { width: Math.ceil(W), height: Math.ceil(H), viewBox: "0 0 " + Math.ceil(W) + " " + Math.ceil(H),
    role: "img", "aria-label": it.n + ", " + fmt(Math.round(it.tot)) + " m² à l’échelle" });
  var quoi = it.circ ? "Hors des huit familles d’usage" : FMAP[it.f].name;
  g.setAttribute("data-tip", it.n + (it.est ? "  (à préciser)" : "") + "|"
    + (it.nb > 1 ? it.nb + " × " + fmt(it.u) + " m² = " : "") + fmt(Math.round(it.tot)) + " m²"
    + (it.w && it.h ? " · " + it.w + " × " + it.h + " m" : "") + "|" + quoi + (it.note ? " · " + it.note : ""));
  svg.appendChild(g);
  return svg;
}

/* ---------- adjacences ----------
   C'était un onglet de premier rang, puis un volet, puis la fin des
   contraintes, sur une planche unique. C'est de nouveau un volet, et chaque
   GRAPPE — un ensemble de locaux que le règlement veut ensemble, de proche en
   proche — y a sa carte. L'onglet suivant, le mixer, s'en sert comme de règles
   de placement, qu'on y active ou non.

   Les cartes se rangent en CASCADE : chacune prend la hauteur que son dessin
   demande, la grande grappe prend toute la largeur si elle en a besoin, et les
   petites se tassent dans les trous (`grid-auto-flow: dense`). Toutes sont à la
   même échelle : un local se compare à un autre d'une carte à l'autre. */
function adjacencesVolet(host){
  host.appendChild(sectHead("3", "Adjacences",
    "Les locaux que le règlement demande de placer côte à côte, groupés en GRAPPES : "
    + "chaque grappe se tient, et rayonne autour de son local le plus lié. Le dessin est "
    + "en mètres, à la même échelle sur toutes les cartes : un local vaut sa surface, dans "
    + "ses deux côtés. Un local trop petit pour écrire son nom le range dessous."));
  var bar = el("div","adj-bar");
  bar.appendChild(linkKey());
  host.appendChild(bar);
  var grid = el("div","adj-grid");
  host.appendChild(grid);
  /* Les cartes se dessinent une fois la grille mesurable : leur échelle et le
     nombre de colonnes dépendent de sa largeur. */
  requestAnimationFrame(function(){ cartesAdj(grid, bar); });
}

var ADJ_COL = 300, ADJ_ROW = 4;
function cartesAdj(grid, bar){
  var W = grid.clientWidth || 900;
  var gap = parseFloat(getComputedStyle(grid).columnGap) || 16;
  var n = Math.max(1, Math.floor((W + gap) / (ADJ_COL + gap)));
  var colW = (W - gap * (n - 1)) / n, PADC = 32;
  /* L'échelle commune : la plus grande grappe tient toute la largeur, et la
     suivante une seule colonne — sans quoi toutes les cartes prenaient la
     largeur entière et la cascade n'était plus qu'une pile. Bornée pour que
     les petites ne deviennent pas des timbres. Le corps des noms suit
     l'échelle et change donc l'encombrement : trois passes suffisent. */
  function echelle(T){
    var larg = T.map(function(t){ return t.w; }).sort(function(a, b){ return b - a; });
    var e = (W - PADC) / larg[0];
    if(n > 1 && larg.length > 1) e = Math.min(e, (colW - PADC) / larg[1]);
    return Math.max(1.6, Math.min(4.2, e));
  }
  var k = echelle(cartesGrappes(echelle(cartesGrappes(3))));
  /* Le dessin et les noms sont à la MÊME échelle : une carte qui en déborde
     d'un cheveu se réduit dans sa colonne, les noms avec elle. */
  var T = cartesGrappes(k);
  bar.appendChild(etalon(k));

  T.forEach(function(t){
    var c = el("article","adj-card");
    /* Une carte qui déborde d'une colonne de moins d'un sixième s'y tient, son
       dessin réduit d'autant : prendre toute la largeur pour dix pixels
       laissait une colonne vide à côté d'elle, sur toute sa hauteur. */
    if(t.w * k + PADC > colW * 1.15) c.classList.add("is-wide");
    var hd = el("header","adj-card__h");
    hd.appendChild(el("span","adj-card__eyebrow", "Autour de"));
    hd.appendChild(el("h3", null, SMAP[t.hub].n));
    var exi = 0, opt = 0, sep = 0;
    t.liens.forEach(function(lk){ if(lk.sep) sep++; else if(lk.opt) opt++; else exi++; });
    hd.appendChild(el("p","adj-card__s mono",
      t.ids.length + " locaux · " + fmt(Math.round(t.aire)) + " m²"));
    hd.appendChild(el("p","adj-card__p", t.pols.join(" · ")));
    var cnt = el("p","adj-card__n");
    cnt.appendChild(document.createTextNode(exi + " adjacence" + (exi > 1 ? "s" : "") + " exigée" + (exi > 1 ? "s" : "")));
    if(opt) cnt.appendChild(document.createTextNode(" · " + opt + " mutualisation" + (opt > 1 ? "s" : "") + " possible" + (opt > 1 ? "s" : "")));
    if(sep) cnt.appendChild(document.createTextNode(" · " + sep + " indépendance" + (sep > 1 ? "s" : "")));
    hd.appendChild(cnt);
    c.appendChild(hd);
    var fig = el("div","adj-card__fig");
    fig.appendChild(dessinGrappe(t, k));
    c.appendChild(fig);
    var det = el("details","disclose adj-card__det");
    det.appendChild(el("summary", null, t.liens.length + " exigence" + (t.liens.length > 1 ? "s" : "")
      + ", citée" + (t.liens.length > 1 ? "s" : "") + " au règlement"));
    det.appendChild(linkList(t.liens));
    det.addEventListener("toggle", function(){ caler(c); });
    c.appendChild(det);
    grid.appendChild(c);
  });

  /* Les postes sans voisin exigé ferment la cascade : les citer est la seule
     façon de dire que les cartes sont complètes. */
  var fr = el("article","adj-card adj-card--free");
  var fh = el("header","adj-card__h");
  fh.appendChild(el("span","adj-card__eyebrow", "Sans proximité exigée"));
  fh.appendChild(el("h3", null, FREE.length + " postes libres"));
  fh.appendChild(el("p","adj-card__p",
    "Pas oubliés : le règlement ne leur impose aucun voisin. Le mixer les pose où il y a la place."));
  fr.appendChild(fh);
  var ul = el("ul","adj-free");
  FREE.forEach(function(n){ ul.appendChild(el("li", null, n)); });
  fr.appendChild(ul);
  grid.appendChild(fr);

  Array.prototype.forEach.call(grid.children, caler);
}
/* La cascade : chaque carte occupe autant de rangs de 4 px que sa hauteur en
   demande. La grille les empile au plus serré, colonne par colonne. */
function caler(c){
  var gap = parseFloat(getComputedStyle(c.parentNode).columnGap) || 16;
  c.style.gridRowEnd = "span " + Math.ceil((c.getBoundingClientRect().height + gap) / ADJ_ROW);
}

/* ---------- récapitulatif ----------
   Il était rendu sous les cinq onglets, hors de #panels, avec un titre qui
   parlait de familles d'usage au bas d'un schéma fonctionnel. Il devient la
   dernière section de l'onglet qu'il récapitule. */
function totalsSection(){
  var sec = el("section","totals");
  sec.id = "totals";
  sec.appendChild(el("h3","label--lg",
    view.group === "chap" ? "Récapitulatif par chapitre" : "Récapitulatif par famille d’usage"));

  var tbl = el("table");
  tbl.appendChild(el("caption","vh",
    "Surfaces du programme, par " + (view.group === "chap" ? "chapitre" : "famille d’usage")
    + ", avec le nombre de pièces et la part du total"));
  var thead = el("thead"), htr = el("tr");
  [[view.group === "chap" ? "Ensemble" : "Famille d’usage", ""],
   ["Pièces","n"],["Surface","n"],["Part","n"]].forEach(function(c){
    var th = el("th", c[1], c[0]);
    th.scope = "col";
    htr.appendChild(th);
  });
  thead.appendChild(htr); tbl.appendChild(thead);
  var tb = el("tbody"); tbl.appendChild(tb);
  sec.appendChild(tbl);
  fillTotals(tb);
  return sec;
}

export function renderTotals(){
  var sec = document.getElementById("totals");
  if(!sec || !sec.parentNode) return;       /* absent hors du cahier des charges */
  sec.parentNode.replaceChild(totalsSection(), sec);
}

function fillTotals(tb){
  function row(name, col, pieces, val, cls, sub){
    var tr = el("tr", cls || null), th = el("th", null);
    th.scope = "row";
    if(col){
      var sw = el("span","sw"); sw.style.backgroundColor = "var(" + col + ")";
      th.appendChild(sw);
    }
    th.appendChild(document.createTextNode(name));
    if(sub) th.appendChild(el("span","totals__s", sub));
    tr.appendChild(th);
    tr.appendChild(el("td","n", pieces == null ? "—" : String(pieces)));
    tr.appendChild(el("td","n", fmt(val) + " m²"));
    tr.appendChild(el("td","n", Math.round(val / GRAND * 100) + " %"));
    return tr;
  }
  function pieces(items){ return items.reduce(function(a,i){ return a + i.nb; }, 0); }

  /* La colonne « Surface » reste celle du PROGRAMME : c'est la comptabilité du
     règlement, et elle doit rester comparable à lui. La part de circulation que
     porte chaque ligne se lit sous son nom, et se resomme aux deux dernières
     lignes du tableau. */
  function circSub(a){ return a > 0.5 ? "+ " + fmt(Math.round(a)) + " m² de circulation" : null; }
  if(view.group === "chap"){
    CHAP.slice(0,4).forEach(function(c){
      tb.appendChild(row(c.name, null, pieces(c.items), c.total, null, circSub(c.circ)));
    });
    tb.appendChild(row("Sous-total bâti scolaire — 1ᵉʳ temps", null, null, BUILT, "sum"));
    CHAP.slice(4).forEach(function(c){ tb.appendChild(row(c.name, null, pieces(c.items), c.total)); });
  } else {
    FAM.forEach(function(f){
      if(f.items.length) tb.appendChild(row(f.name, f.c, pieces(f.items), f.total, null, circSub(f.circ)));
    });
  }
  tb.appendChild(row("Programme chiffré au règlement", null, null, PROG, "sum"));
  tb.appendChild(row("Surfaces à préciser — vestiaires, sanitaires et halls", null, null, ESTT, "soft"));
  tb.appendChild(row("Total du programme", null, null, GRAND, "grand"));
  /* La circulation n'est pas un local : elle vient APRÈS le total du programme,
     et seule la part bâtie scolaire la porte. La taire ferait croire qu'un
     projet de 7'025 m² se bâtit en 7'025 m². */
  tb.appendChild(row("Circulation", null, null, Math.round(CIRCA), "soft",
    "couloirs de " + dec(COULOIR) + " m et cages d’escalier, sur le seul bâti scolaire — "
    + Math.round(CIRC * 100) + " % de la surface bâtie"));
  tb.appendChild(row("Bâti scolaire, circulation comprise", null, null,
    Math.round(BUILTG), "grand"));
}

/* ---------- sources et conventions ----------
   Trois paragraphes denses de 250 mots, imposés sous les cinq onglets. Le
   contenu est conservé intégralement : c'est la justification des chiffres, et
   sur un rendu de concours elle compte. Elle cesse simplement d'être lue de
   force avant qu'on ait vu un dessin. */
function sourcesSection(){
  var d = el("details","disclose disclose--sources");
  d.appendChild(el("summary", null, "Sources et conventions"));

  var a = el("p");
  a.appendChild(el("b", null, "Surfaces à préciser. "));
  a.appendChild(document.createTextNode(
    "Huit postes ne sont pas chiffrés par le règlement — il les compte en nombre de pièces, ou les "
    + "renvoie « selon projet ». Ils portent notre valeur, modifiable en section 1, sur ces "
    + "bases : vestiaires de classe 0,5 m² par élève, soit 10 m² pour 20 élèves ; WC 2 m² par cabine, "
    + "soit la cabine standard de 1 × 2 m sans la zone lavabos ; halls posés par défaut à 120, 150 et "
    + "30 m², sans fondement dans le règlement. Ces valeurs sont à vérifier contre les directives "
    + "cantonales. Elles apparaissent partout en trait tireté et restent comptées séparément."));
  d.appendChild(a);

  var e = el("p");
  e.appendChild(el("b", null, "Circulation. "));
  e.appendChild(document.createTextNode(
    "Le règlement ne la chiffre pas. Elle est une hypothèse de projet, déduite des PIÈCES et non "
    + "des seuls mètres carrés : un couloir dessert des portes. Chaque pièce ouvre sur lui le côté "
    + "d’un carré de sa surface ; les petites pièces d’un même poste — WC, vestiaires — forment un "
    + "bloc à une porte, et un grand local n’ouvre jamais plus de " + RULES.circ.frontMax + " m. Ce "
    + "front, fois la largeur du couloir saisie en section 1, divisé par " + RULES.circ.rangs
    + " parce qu’un couloir dessert ses deux rives, donne les couloirs ; chaque niveau ajoute une ou "
    + "deux cages d’escalier de " + RULES.circ.cage + " m², selon le seuil de la protection incendie. "
    + "Le cahier des charges suppose " + RULES.circ.niveaux + " niveaux ; le mixer compte ceux de sa "
    + "pile. Elle ne porte que sur le bâti scolaire — école, sport, UAPE, technique ; la piscine, le "
    + "chauffage à distance, la cour et son préau n’ont pas de couloirs à nous."));
  d.appendChild(e);

  var b = el("p");
  b.appendChild(el("b", null, "Lecture des couleurs. "));
  b.appendChild(document.createTextNode(
    "Tous les vestiaires et sanitaires sont comptés avec l’eau, y compris les vestiaires de classe ; "
    + "tout le stockage et les dépôts vont au technique, qui est hachuré ; la salle de pause de l’UAPE "
    + "va aux locaux du personnel. Chaque hall prend la couleur de ce qu’il dessert — hall d’école avec "
    + "les classes, foyer de la salle polyvalente avec le sport, hall UAPE avec l’UAPE — et non celle "
    + "de l’administration."));
  d.appendChild(b);

  var c = el("p");
  c.appendChild(el("b", null, "Source. "));
  c.appendChild(el("i", null, "1.19.a Concours école Saxon — règlement-programme, juillet 2026"));
  c.appendChild(document.createTextNode(
    ", chapitres 2.2 à 2.10, et directive de protection incendie AEAI DPI 16-15. Les postes « selon "
    + "projet » (halls, foyer), les WC comptés en nombre et les places de stationnement ne sont pas "
    + "chiffrés au programme. La surface de plancher réelle du projet sera sensiblement supérieure au "
    + "total ci-dessus."));
  d.appendChild(c);
  return d;
}
