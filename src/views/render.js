import { dec, el, fmt } from "../core/format.js";
import {
  ALL_OFF, BUILT, BUILTG, CIRC, CIRCA, COULOIR, ESTT, FMAP, GRAND, GRANDG, PROG,
  setCirc, setItemArea
} from "../core/model.js";
import { curSub, setSub, subBtnId, subsOf, view, writeHash } from "../core/viewstate.js";
import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";
import { FREE } from "../data/schema.js";
import { drawMass, massDoctrine, massPanel, setMassNav } from "./massing.js";
import { drawMix, mixDoctrine, mixPanel, setMixNav } from "./mixer.js";
import { saveSoon } from "../mix/store.js";
import { constraintsSection } from "./constraints.js";
import { drawDiagram, panelsEl, ppm, refreshPpm, scaleBar } from "./diagram.js";
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

export function scheduleList(items, showChap){
  var ul = el("ul","schedule");
  items.forEach(function(it){
    var li = el("li");
    var sw = el("i","sw"); sw.style.backgroundColor = "var(" + FMAP[it.f].c + ")";
    if(it.f === "tec") sw.classList.add("is-hatched");
    li.appendChild(sw);
    var nm = el("div","nm");
    nm.appendChild(el("b", null, it.n));
    if(it.est){
      nm.appendChild(document.createTextNode(" "));
      nm.appendChild(el("span","esttag", it.set ? "fixée" : "à préciser"));
    }
    var sub = (showChap ? it.chap : "") + (showChap && it.note ? " · " : "") + (it.note || "");
    if(sub) nm.appendChild(el("span","note", sub));
    li.appendChild(nm);
    li.appendChild(el("span","qty", it.nb + " × " + fmt(it.u)));
    li.appendChild(el("span","val", fmt(it.tot) + " m²"));
    ul.appendChild(li);
  });
  return ul;
}

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
  bar.appendChild(group("Détail", "Niveau de détail des diagrammes",
    [["agg","Groupé"],["unit","Détaillé"]], "mode", render));
  bar.appendChild(el("span","spacer"));
  bar.appendChild(scaleBar());
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
  refreshPpm();
  while(panelsEl.firstChild) panelsEl.removeChild(panelsEl.firstChild);
  tip.style.opacity = "0";
  renderBar();

  /* Les deux outils ont chacun deux volets : ce qu'ils FONT, et les CONTRAINTES
     qui gouvernent ce qu'ils font. Le second est la réponse à « pourquoi
     obtient-on ce résultat » — et c'est là qu'on le corrige. */
  if(view.tab === "mixer"){
    var mh = subHost();
    if(curSub() === "contraintes"){ mh.appendChild(mixDoctrine()); return; }
    mh.appendChild(mixPanel());
    drawMix();
    return;
  }
  /* Le massing se dessine APRÈS avoir rejoint le document : son plan a besoin
     d'une largeur mesurable, et WebGL d'un canevas attaché. */
  if(view.tab === "massing"){
    var xh = subHost();
    if(curSub() === "contraintes"){ xh.appendChild(massDoctrine()); return; }
    xh.appendChild(massPanel());
    requestAnimationFrame(drawMass);
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

  var W = (host.clientWidth || panelsEl.clientWidth || 900) / ppm;
  var fs = 11 / ppm, fsSm = 9.5 / ppm;

  /* `circ` est la part de circulation que porte le groupe, au prorata de ce
     qu'il pèse dans le bâti scolaire ; `gross` est sa somme, circulation
     comprise. Les deux viennent du modèle : rien n'est recalculé ici. */
  var groups = view.group === "chap"
    ? CHAP.map(function(c){ return { name:c.name, sub:c.sub, total:c.total, circ:c.circ,
        gross:c.gross, items:c.items, mix:c.mix, off:c.off, col:null }; })
    : FAM.filter(function(f){ return f.items.length; }).map(function(f){
        return { name:f.name, sub:f.d.charAt(0).toUpperCase() + f.d.slice(1) + ".", total:f.total,
                 circ:f.circ, gross:f.gross, items:f.items, mix:null, off:[], col:f.c };
      });

  groups.forEach(function(gp){
    var p = el("section","panel");
    var head = el("div","panel-head");
    var r = el("i","panel-rule");
    if(gp.col) r.style.backgroundColor = "var(" + gp.col + ")";
    head.appendChild(r);
    head.appendChild(el("h3", null, gp.name));
    /* Le chiffre du chapitre est sa surface BÂTIE : le programme plus la part de
       circulation qu'il porte. Il n'affichait que le programme, alors que le
       reste de l'application — le mixer, les plateaux, les hauteurs — travaille
       sur le bâti. La décomposition suit, pour qu'on voie d'où vient l'écart. */
    head.appendChild(el("span","tot mono", fmt(Math.round(gp.gross)) + " m²"));
    if(gp.circ > 0.5){
      head.appendChild(el("span","pct mono",
        fmt(gp.total) + " + " + fmt(Math.round(gp.circ)) + " de circulation"));
    }
    head.appendChild(el("span","pct mono", Math.round(gp.gross / GRANDG * 100) + " % du total"));
    p.appendChild(head);
    if(gp.sub) p.appendChild(el("p","panel-sub", gp.sub));
    if(gp.mix && gp.mix.length > 1){
      var mb = el("div","mixbar");
      gp.mix.forEach(function(m){
        var i2 = el("i");
        i2.style.flex = m.v + " 0 0";
        i2.style.backgroundColor = "var(" + m.f.c + ")";
        i2.title = m.f.name + " — " + fmt(m.v) + " m²";
        mb.appendChild(i2);
      });
      p.appendChild(mb);
    }
    var d = el("div","diagram");
    p.appendChild(d);

    /* La liste répétait intégralement le diagramme, jusqu'à dix-sept lignes
       par chapitre : le dessin devenait une illustration de sa propre légende.
       Elle reste — c'est le seul accès aux petits postes non étiquetés — mais
       repliée derrière son propre décompte. */
    var det = el("details","disclose");
    det.appendChild(el("summary", null,
      gp.items.length + " postes · " + fmt(gp.total) + " m²"
      + (gp.circ > 0.5 ? " de programme" : "")));
    det.appendChild(scheduleList(gp.items, view.group === "fam"));
    if(gp.off && gp.off.length){
      var o = el("div","unpriced");
      /* « Non chiffré au programme » désignait DEUX statuts opposés à 30 cm
         d'écart : ces postes-ci n'ont aucune surface et ne comptent dans aucun
         total, tandis que les huit postes « à préciser » en ont une et sont
         dans les 7'025 m². L'écart se chiffrait en centaines de m². */
      o.appendChild(el("b", null, "Hors bilan — "));
      o.appendChild(document.createTextNode(gp.off.join(" · ")));
      o.appendChild(el("span","note", "mentionnés au règlement, jamais comptés dans les totaux."));
      det.appendChild(o);
    }
    p.appendChild(det);

    host.appendChild(p);
    drawDiagram(d, gp.items, W, fs, fsSm, Math.round(gp.circ),
      "couloirs de " + dec(COULOIR) + " m devant ses pièces, et sa part des cages d’escalier");
    d.querySelector("svg").setAttribute("aria-label",
      gp.name + " — " + fmt(Math.round(gp.gross)) + " m² représentés à l’échelle, dont "
      + fmt(gp.total) + " m² de programme"
      + (gp.circ > 0.5 ? " et " + fmt(Math.round(gp.circ)) + " m² de circulation" : ""));
  });

  if(view.group === "fam" && ALL_OFF.length){
    var box = el("section","panel panel--plain");
    var o2 = el("div","unpriced");
    o2.appendChild(el("b", null, "Hors bilan — "));
    o2.appendChild(document.createTextNode(ALL_OFF.join(" · ")));
    o2.appendChild(el("span","note", "mentionnés au règlement, jamais comptés dans les totaux."));
    box.appendChild(o2);
    host.appendChild(box);
  }

  host.appendChild(totalsSection());
  host.appendChild(sourcesSection());
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
