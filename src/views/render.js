import { el, fmt } from "../core/format.js";
import { ALL_OFF, BUILT, ESTT, FMAP, GRAND, PROG } from "../core/model.js";
import { view } from "../core/viewstate.js";
import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { FREE, SLINK, SNODE } from "../data/schema.js";
import { arrange, fit, planPanel, undoStack } from "../plan/editor.js";
import { initStore } from "../plan/store.js";
import { drawDiagram, drawScalebar, panelsEl, ppm, refreshPpm } from "./diagram.js";
import { drawSchema, linkKey, linkList } from "./schema.js";
import { tip } from "./tooltip.js";
import { drawVol, volLink, volPanel, volSync, wireVol } from "../vol/volumes.js";

export function scheduleList(items, showChap){
  var ul = el("ul","schedule");
  items.forEach(function(it){
    var li = el("li");
    var sw = el("i","sw"); sw.style.background = "var(" + FMAP[it.f].c + ")";
    li.appendChild(sw);
    var nm = el("div","nm");
    nm.appendChild(el("b", null, it.n));
    if(it.est){ var tg = el("span","esttag","à préciser"); nm.appendChild(document.createTextNode(" ")); nm.appendChild(tg); }
    var sub = (showChap ? it.chap : "") + (showChap && it.note ? " · " : "") + (it.note || "");
    if(sub) nm.appendChild(el("span","note", sub));
    li.appendChild(nm);
    li.appendChild(el("span","qty", it.nb + " × " + fmt(it.u)));
    li.appendChild(el("span","val", fmt(it.tot) + " m²"));
    ul.appendChild(li);
  });
  return ul;
}

export function render(){
  refreshPpm();
  drawScalebar();
  var W = (panelsEl.clientWidth || 900) / ppm;
  var fs = 11 / ppm, fsSm = 9.5 / ppm;
  while(panelsEl.firstChild) panelsEl.removeChild(panelsEl.firstChild);
  document.getElementById("modeSeg").hidden = (view.grouping !== "chap" && view.grouping !== "fam");
  tip.style.opacity = "0";

  if(view.grouping === "vol"){
    var vp2 = volPanel();
    panelsEl.appendChild(vp2);
    if(volLink) volSync(false);
    drawVol();
    if(!vp2.dataset.wired){ vp2.dataset.wired = "1"; wireVol(); }
    renderTotals();
    return;
  }


  if(view.grouping === "plan"){
    var pp = planPanel();
    panelsEl.appendChild(pp);
    if(!pp.dataset.ready){
      pp.dataset.ready = "1";
      arrange("f", 1);
      undoStack.length = 0;
      initStore();
      requestAnimationFrame(fit);
    }
    renderTotals();
    return;
  }

  if(view.grouping === "sch"){
    var p0 = el("section","panel");
    var hd = el("div","panel-head");
    hd.appendChild(el("i","panel-rule"));
    hd.appendChild(el("h2", null, "Les pièces que le règlement demande de placer côte à côte"));
    hd.appendChild(el("span","pct mono", SLINK.length + " liens · " + SNODE.length + " pièces"));
    p0.appendChild(hd);
    p0.appendChild(el("p","panel-sub",
      "Chaque fil correspond à une exigence de proximité énoncée dans la colonne « Remarques » du programme. Les pièces restent dessinées à leur surface réelle et à la même échelle que les autres vues ; les blocs en tireté sont les halls et vestiaires « selon projet », non chiffrés mais porteurs de relations."));
    p0.appendChild(linkKey());
    var sw = el("div","schema-wrap");
    p0.appendChild(sw);
    p0.appendChild(linkList());
    var fr = el("div","unpriced");
    fr.appendChild(el("b", null, "Sans contrainte de proximité énoncée — "));
    fr.appendChild(document.createTextNode(FREE.join(" · ")));
    p0.appendChild(fr);
    panelsEl.appendChild(p0);
    drawSchema(sw);
    renderTotals();
    return;
  }

  var groups = view.grouping === "chap"
    ? CHAP.map(function(c){ return { name:c.name, sub:c.sub, total:c.total, items:c.items, mix:c.mix, off:c.off, col:null }; })
    : FAM.filter(function(f){ return f.items.length; }).map(function(f){
        return { name:f.name, sub:f.d.charAt(0).toUpperCase() + f.d.slice(1) + ".", total:f.total,
                 items:f.items, mix:null, off:[], col:f.c };
      });

  groups.forEach(function(gp){
    var p = el("section","panel");
    var head = el("div","panel-head");
    var r = el("i","panel-rule");
    if(gp.col) r.style.background = "var(" + gp.col + ")";
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
        i2.style.background = "var(" + m.f.c + ")";
        i2.title = m.f.name + " — " + fmt(m.v) + " m²";
        mb.appendChild(i2);
      });
      p.appendChild(mb);
    }
    var d = el("div","diagram");
    p.appendChild(d);
    p.appendChild(scheduleList(gp.items, view.grouping === "fam"));
    if(gp.off && gp.off.length){
      var o = el("div","unpriced");
      o.appendChild(el("b", null, "Non chiffré au programme — "));
      o.appendChild(document.createTextNode(gp.off.join(" · ")));
      p.appendChild(o);
    }
    panelsEl.appendChild(p);
    drawDiagram(d, gp.items, W, fs, fsSm);
    d.querySelector("svg").setAttribute("aria-label",
      gp.name + " — " + fmt(gp.total) + " m² de surfaces chiffrées, représentées à l'échelle");
  });

  if(view.grouping === "fam"){
    var box = el("section","panel");
    box.style.borderBottom = "none";
    var o2 = el("div","unpriced");
    o2.style.borderTop = "none";
    o2.style.marginTop = "0";
    o2.appendChild(el("b", null, "Postes non chiffrés au programme — "));
    o2.appendChild(document.createTextNode(ALL_OFF.join(" · ")));
    box.appendChild(o2);
    panelsEl.appendChild(box);
  }
  renderTotals();
}

/* ---------- totals ---------- */
export function renderTotals(){
  var tb = document.getElementById("totalsBody");
  while(tb.firstChild) tb.removeChild(tb.firstChild);
  document.getElementById("totTitle").textContent =
    view.grouping === "chap" ? "Récapitulatif par chapitre" : "Récapitulatif par famille d'usage";
  document.getElementById("thFirst").textContent =
    view.grouping === "chap" ? "Ensemble" : "Famille d'usage";

  function row(name, col, pieces, val){
    var tr = el("tr"), td = el("td");
    if(col){
      var sw = el("span","sw"); sw.style.background = "var(" + col + ")";
      td.appendChild(sw);
    }
    td.appendChild(document.createTextNode(name));
    tr.appendChild(td);
    tr.appendChild(el("td","n", String(pieces)));
    tr.appendChild(el("td","n", fmt(val) + " m²"));
    tr.appendChild(el("td","n", Math.round(val / GRAND * 100) + " %"));
    return tr;
  }
  function pieces(items){ return items.reduce(function(a,i){ return a + i.nb; }, 0); }

  if(view.grouping === "chap"){
    CHAP.slice(0,4).forEach(function(c){ tb.appendChild(row(c.name, null, pieces(c.items), c.total)); });
    var sr = el("tr","sum");
    sr.appendChild(el("td", null, "Sous-total bâti scolaire — 1ᵉʳ temps"));
    sr.appendChild(el("td","n",""));
    sr.appendChild(el("td","n", fmt(BUILT) + " m²"));
    sr.appendChild(el("td","n", Math.round(BUILT/GRAND*100) + " %"));
    tb.appendChild(sr);
    CHAP.slice(4).forEach(function(c){ tb.appendChild(row(c.name, null, pieces(c.items), c.total)); });
  } else {
    FAM.forEach(function(f){ if(f.items.length) tb.appendChild(row(f.name, f.c, pieces(f.items), f.total)); });
  }
  var sp = el("tr","sum");
  sp.appendChild(el("td", null, "Programme chiffré au règlement"));
  sp.appendChild(el("td","n",""));
  sp.appendChild(el("td","n", fmt(PROG) + " m²"));
  sp.appendChild(el("td","n", Math.round(PROG / GRAND * 100) + " %"));
  tb.appendChild(sp);
  var se = el("tr");
  se.appendChild(el("td", null, "Surfaces à préciser — vestiaires, sanitaires et halls"));
  se.appendChild(el("td","n",""));
  se.appendChild(el("td","n", "+ " + fmt(ESTT) + " m²"));
  se.appendChild(el("td","n", Math.round(ESTT / GRAND * 100) + " %"));
  se.style.color = "var(--ink-3)";
  tb.appendChild(se);
  var gr = el("tr","grand");
  gr.appendChild(el("td", null, "Total"));
  gr.appendChild(el("td","n",""));
  gr.appendChild(el("td","n", fmt(GRAND) + " m²"));
  gr.appendChild(el("td","n","100 %"));
  tb.appendChild(gr);
}

