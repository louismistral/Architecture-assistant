import { el, fmt } from "../core/format.js";
import { ALL_OFF, BUILT, ESTT, FMAP, GRAND, PROG } from "../core/model.js";
import { SUBS, view, writeHash } from "../core/viewstate.js";
import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { FREE, SLINK, SNODE } from "../data/schema.js";
import { roomForKey, setPosteArea } from "../plan/areas.js";
import { arrange, fit, planPanel, undoStack } from "../plan/editor.js";
import { initStore } from "../plan/store.js";
import { drawDiagram, panelsEl, ppm, refreshPpm, scaleBar } from "./diagram.js";
import { introSection, renderBar, setAreaHandler } from "./legend.js";
import { rulesPanels } from "./rules.js";
import { drawSchema, linkKey, linkList } from "./schema.js";
import { tip } from "./tooltip.js";
import { drawVol, volLink, volPanel, volSync, wireVol } from "../vol/volumes.js";

/* Une surface saisie dans l'onglet Programme passe par l'éditeur de plan, qui
   la propage à toutes les pièces du poste. Le plan n'a pas besoin d'être ouvert :
   les effets de bord sur son DOM sont gardés. */
setAreaHandler(function(key, v){
  var id = roomForKey(key);
  if(id) setPosteArea(id, v);
});

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

/* ---------- barre de vue de l'onglet Programme ----------
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

/* ---------- volets de l'onglet Programme ----------
   Vrai patron d'onglets imbriqué : `role="tablist"` et `aria-selected`, un seul
   arrêt de tabulation pour le groupe, flèches pour circuler — le même patron
   que la barre d'application, parce que c'est la même chose un cran plus bas.
   Les trois volets lisent le règlement ; on ne compose dans aucun. */
function subTabs(){
  var nav = el("nav","btn-group subtabs");
  nav.setAttribute("role","tablist");
  nav.setAttribute("aria-label","Volets du programme");
  var btns = [];
  SUBS.forEach(function(sb, i){
    var b = el("button","btn", sb.label);
    b.type = "button";
    b.id = "sub" + sb.id.charAt(0).toUpperCase() + sb.id.slice(1);
    b.setAttribute("role","tab");
    b.setAttribute("aria-selected", String(view.sub === sb.id));
    b.setAttribute("aria-controls","subpanel");
    b.tabIndex = view.sub === sb.id ? 0 : -1;
    b.addEventListener("click", function(){
      if(view.sub === sb.id) return;
      view.sub = sb.id;
      writeHash();
      render();
    });
    b.addEventListener("keydown", function(e){
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1
            : e.key === "Home" ? -99 : e.key === "End" ? 99 : 0;
      if(!d) return;
      e.preventDefault();
      var n = d === -99 ? 0 : d === 99 ? SUBS.length - 1 : (i + d + SUBS.length) % SUBS.length;
      view.sub = SUBS[n].id;
      writeHash();
      render();
      var again = document.getElementById(btns[n]);
      if(again) again.focus();
    });
    btns.push(b.id);
    nav.appendChild(b);
  });
  return nav;
}

/* ---------- volet Adjacences ---------- */
function adjacencesPanel(){
  var p0 = el("section","panel");
  var hd = el("div","panel-head");
  hd.appendChild(el("h1", null, "Adjacences"));
  hd.appendChild(el("span","pct mono", SLINK.length + " liens · " + SNODE.length + " pièces"));
  p0.appendChild(hd);
  p0.appendChild(el("p","panel-sub",
    "Les pièces que le règlement demande de placer côte à côte."));
  p0.appendChild(linkKey());
  var sw = el("div","schema-wrap");
  p0.appendChild(sw);
  var det = el("details","disclose");
  det.appendChild(el("summary", null, SLINK.length + " exigences, citées au règlement"));
  det.appendChild(linkList());
  var fr = el("div","unpriced");
  fr.appendChild(el("b", null, "Sans contrainte de proximité énoncée — "));
  fr.appendChild(document.createTextNode(FREE.join(" · ")));
  det.appendChild(fr);
  p0.appendChild(det);
  return { panel: p0, wrap: sw };
}

export function render(){
  refreshPpm();
  while(panelsEl.firstChild) panelsEl.removeChild(panelsEl.firstChild);
  tip.style.opacity = "0";
  renderBar();

  if(view.tab === "site"){
    var vp2 = volPanel();
    panelsEl.appendChild(vp2);
    if(volLink) volSync(false);
    drawVol();
    if(!vp2.dataset.wired){ vp2.dataset.wired = "1"; wireVol(); }
    return;
  }

  if(view.tab === "plan"){
    var pp = planPanel();
    panelsEl.appendChild(pp);
    if(!pp.dataset.ready){
      pp.dataset.ready = "1";
      arrange("f", 1);
      undoStack.length = 0;
      initStore();
      requestAnimationFrame(fit);
    }
    return;
  }

  /* ---------- Programme : trois volets ---------- */
  var sbar = el("div","subtabs-bar");
  sbar.appendChild(subTabs());
  panelsEl.appendChild(sbar);
  var host = el("div","subpanel");
  host.id = "subpanel";
  host.setAttribute("role","tabpanel");
  host.setAttribute("aria-labelledby",
    "sub" + view.sub.charAt(0).toUpperCase() + view.sub.slice(1));
  panelsEl.appendChild(host);

  if(view.sub === "adjacences"){
    var adj = adjacencesPanel();
    host.appendChild(adj.panel);
    drawSchema(adj.wrap);
    return;
  }
  if(view.sub === "contraintes"){
    rulesPanels().forEach(function(p){ host.appendChild(p); });
    return;
  }

  /* ---------- volet Surfaces ---------- */
  host.appendChild(introSection());
  host.appendChild(programmeBar());

  var W = (host.clientWidth || panelsEl.clientWidth || 900) / ppm;
  var fs = 11 / ppm, fsSm = 9.5 / ppm;

  var groups = view.group === "chap"
    ? CHAP.map(function(c){ return { name:c.name, sub:c.sub, total:c.total, items:c.items, mix:c.mix, off:c.off, col:null }; })
    : FAM.filter(function(f){ return f.items.length; }).map(function(f){
        return { name:f.name, sub:f.d.charAt(0).toUpperCase() + f.d.slice(1) + ".", total:f.total,
                 items:f.items, mix:null, off:[], col:f.c };
      });

  groups.forEach(function(gp){
    var p = el("section","panel");
    var head = el("div","panel-head");
    var r = el("i","panel-rule");
    if(gp.col) r.style.backgroundColor = "var(" + gp.col + ")";
    head.appendChild(r);
    head.appendChild(el("h2", null, gp.name));
    head.appendChild(el("span","tot mono", fmt(gp.total) + " m²"));
    head.appendChild(el("span","pct mono", Math.round(gp.total / GRAND * 100) + " % du total"));
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
      gp.items.length + " postes · " + fmt(gp.total) + " m²"));
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
    drawDiagram(d, gp.items, W, fs, fsSm);
    d.querySelector("svg").setAttribute("aria-label",
      gp.name + " — " + fmt(gp.total) + " m² de surfaces chiffrées, représentées à l’échelle");
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

/* ---------- récapitulatif ----------
   Il était rendu sous les cinq onglets, hors de #panels, avec un titre qui
   parlait de familles d'usage au bas d'un schéma fonctionnel. Il devient la
   dernière section de l'onglet qu'il récapitule. */
function totalsSection(){
  var sec = el("section","totals");
  sec.id = "totals";
  sec.appendChild(el("h2","label--lg",
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
  if(!sec || !sec.parentNode) return;       /* absent hors de l'onglet Programme */
  sec.parentNode.replaceChild(totalsSection(), sec);
}

function fillTotals(tb){
  function row(name, col, pieces, val, cls){
    var tr = el("tr", cls || null), th = el("th", null);
    th.scope = "row";
    if(col){
      var sw = el("span","sw"); sw.style.backgroundColor = "var(" + col + ")";
      th.appendChild(sw);
    }
    th.appendChild(document.createTextNode(name));
    tr.appendChild(th);
    tr.appendChild(el("td","n", pieces == null ? "—" : String(pieces)));
    tr.appendChild(el("td","n", fmt(val) + " m²"));
    tr.appendChild(el("td","n", Math.round(val / GRAND * 100) + " %"));
    return tr;
  }
  function pieces(items){ return items.reduce(function(a,i){ return a + i.nb; }, 0); }

  if(view.group === "chap"){
    CHAP.slice(0,4).forEach(function(c){ tb.appendChild(row(c.name, null, pieces(c.items), c.total)); });
    tb.appendChild(row("Sous-total bâti scolaire — 1ᵉʳ temps", null, null, BUILT, "sum"));
    CHAP.slice(4).forEach(function(c){ tb.appendChild(row(c.name, null, pieces(c.items), c.total)); });
  } else {
    FAM.forEach(function(f){ if(f.items.length) tb.appendChild(row(f.name, f.c, pieces(f.items), f.total)); });
  }
  tb.appendChild(row("Programme chiffré au règlement", null, null, PROG, "sum"));
  tb.appendChild(row("Surfaces à préciser — vestiaires, sanitaires et halls", null, null, ESTT, "soft"));
  tb.appendChild(row("Total", null, null, GRAND, "grand"));
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
    + "renvoie « selon projet ». Ils portent notre valeur, modifiable en tête de cet onglet, sur ces "
    + "bases : vestiaires de classe 0,5 m² par élève, soit 10 m² pour 20 élèves ; WC 2 m² par cabine, "
    + "soit la cabine standard de 1 × 2 m sans la zone lavabos ; halls posés par défaut à 120, 150 et "
    + "30 m², sans fondement dans le règlement. Ces valeurs sont à vérifier contre les directives "
    + "cantonales. Elles apparaissent partout en trait tireté et restent comptées séparément."));
  d.appendChild(a);

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
    ", chapitre 2.10 « Programme des locaux ». Les postes « selon projet » (halls, foyer), les WC "
    + "comptés en nombre et les places de stationnement ne sont pas chiffrés au programme. La surface "
    + "de plancher réelle du projet sera sensiblement supérieure au total ci-dessus."));
  d.appendChild(c);
  return d;
}
