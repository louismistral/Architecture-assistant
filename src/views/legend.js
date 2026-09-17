import { el, fmt } from "../core/format.js";
import { ESTT, GRAND, PROG, VARITEMS } from "../core/model.js";
import { FAM } from "../data/families.js";

/* Ce module construisait autrefois le contenu d'un en-tête statique haut de
   ~900 px, imposé au-dessus des cinq onglets. Il produit maintenant la section
   d'introduction de l'onglet Programme — le seul qu'elle décrive — plus les
   deux chiffres du chrome permanent. */

var onSetArea = null;
export function setAreaHandler(fn){ onSetArea = fn; }

/* ---------- chrome permanent ---------- */
export function renderBar(){
  var t = document.getElementById("barTot");
  if(t){
    while(t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(document.createTextNode(fmt(GRAND)));
    t.appendChild(el("span","u","m²"));
  }
  var e = document.getElementById("barEst");
  if(!e) return;
  var pending = VARITEMS.filter(function(it){ return !it.set; }).length;
  e.textContent = pending
    ? pending + " poste" + (pending > 1 ? "s" : "") + " à préciser"
    : "toutes les surfaces sont fixées";
  e.dataset.pending = String(pending > 0);
  e.title = pending
    ? "Voir les postes que le règlement ne chiffre pas"
    : "Les huit postes non chiffrés au règlement ont reçu ta valeur";
}

/* ---------- section d'introduction de l'onglet Programme ---------- */
export function introSection(){
  var s = el("section","intro");

  var h = el("div","intro__head");
  h.appendChild(el("h1", null, "Programme"));
  h.appendChild(el("p","intro__lead",
    "Le programme du concours, dessiné à l’échelle : chaque bloc vaut sa surface réelle."));
  s.appendChild(h);

  /* Le chiffre-clé est le TOTAL. L'ancien affichait la part chiffrée au
     règlement (6'489 m²), le total n'apparaissant qu'en fin de note. */
  var fig = el("div","intro__fig");
  var big = el("p","intro__big mono");
  big.appendChild(document.createTextNode(fmt(GRAND)));
  big.appendChild(el("span","u","m²"));
  fig.appendChild(big);
  var br = el("dl","intro__break");
  [["chiffré au règlement", fmt(PROG) + " m²"],
   ["à préciser", fmt(ESTT) + " m²"]].forEach(function(row){
    br.appendChild(el("dt", null, row[0]));
    br.appendChild(el("dd","mono", row[1]));
  });
  fig.appendChild(br);
  s.appendChild(fig);

  s.appendChild(varBlock());
  s.appendChild(legendBlock());
  return s;
}

/* ---------- les postes que le règlement ne chiffre pas ----------
   C'était une note qui listait huit valeurs à corriger et renvoyait ailleurs
   pour les corriger. Les valeurs se saisissent maintenant sur place. */
function varBlock(){
  var b = el("section","vars");
  b.id = "vars";
  var hd = el("div","vars__head");
  hd.appendChild(el("h2","label", "Surfaces à préciser — " + VARITEMS.length + " postes"));
  hd.appendChild(el("p","vars__note",
    "Le règlement les compte en nombre de pièces, ou les renvoie « selon projet ». "
    + "Les valeurs ci-dessous sont les nôtres : corrige-les ici, tous les totaux suivent."));
  b.appendChild(hd);

  var ul = el("ul","vars__list");
  VARITEMS.forEach(function(it){
    var li = el("li", it.set ? "is-set" : null);

    var nm = el("div","vars__name");
    nm.appendChild(document.createTextNode(it.n + (it.nb > 1 ? " ×" + it.nb : "")));
    /* L'état ne peut pas être porté par la seule couleur : l'ancien bandeau
       écrivait « les postes que tu as fixés passent en vert ». */
    nm.appendChild(el("span","vars__state", it.set ? "fixée" : "à préciser"));
    li.appendChild(nm);

    var f = el("form","vars__field");
    var id = "var-" + it.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    var lab = el("label","vh", "Surface par pièce, en m², pour " + it.n);
    lab.htmlFor = id;                       /* les <label> étaient orphelins */
    var inp = document.createElement("input");
    inp.type = "number"; inp.id = id; inp.min = "1"; inp.max = "2000"; inp.step = "0.5";
    inp.value = String(it.u);
    inp.className = "mono";
    var unit = el("span","vars__unit","m²/pièce");
    var tot = el("b","vars__tot mono", fmt(it.tot) + " m²");
    var msg = el("p","vars__msg");
    f.appendChild(lab); f.appendChild(inp); f.appendChild(unit);
    f.appendChild(tot); f.appendChild(msg);

    function commit(e){
      if(e) e.preventDefault();
      var v = parseFloat(String(inp.value).replace(",", "."));
      if(!isFinite(v) || v < 1 || v > 2000){
        /* On ne remet PAS l'ancienne valeur : la saisie reste corrigeable sans
           être retapée, et la raison du refus est écrite. */
        msg.textContent = "Entre 1 et 2 000 m² — « " + inp.value + " » n’a pas été retenu.";
        li.classList.add("is-bad");
        return;
      }
      msg.textContent = ""; li.classList.remove("is-bad");
      if(v === it.u) return;
      if(onSetArea) onSetArea(it.key, v);
    }
    f.addEventListener("submit", commit);
    inp.addEventListener("change", commit);
    li.appendChild(f);
    ul.appendChild(li);
  });
  b.appendChild(ul);
  return b;
}

/* ---------- légende des familles ---------- */
function legendBlock(){
  var b = el("section","legend");
  b.appendChild(el("h2","label","Familles d’usage"));

  var track = el("div","legend__track");
  track.setAttribute("role","img");
  track.setAttribute("aria-label",
    "Répartition des " + fmt(GRAND) + " m² entre les huit familles d’usage");
  FAM.forEach(function(f){
    var seg = el("div","legend__seg");
    seg.style.flex = f.total + " 0 0";
    seg.style.background = "var(" + f.c + ")";
    if(f.id === "tec") seg.classList.add("is-hatched");
    seg.title = f.name + " — " + fmt(f.total) + " m²";
    track.appendChild(seg);
  });
  b.appendChild(track);

  var key = el("ul","legend__key");
  FAM.forEach(function(f){
    var k = el("li");
    var sw = el("i","sw"); sw.style.background = "var(" + f.c + ")";
    if(f.id === "tec") sw.classList.add("is-hatched");
    k.appendChild(sw);
    var lb = el("div","legend__lb");
    lb.appendChild(document.createTextNode(f.name));
    lb.appendChild(el("i", null, f.d));
    k.appendChild(lb);
    k.appendChild(el("div","legend__vl mono", fmt(f.total) + " m²"));
    key.appendChild(k);
  });
  /* La convention du trait tireté était expliquée dans le chapô, à trois
     paragraphes de l'endroit où elle sert. C'est une entrée de légende. */
  var dash = el("li","legend__extra");
  dash.appendChild(el("i","sw sw--dashed"));
  var dl = el("div","legend__lb");
  dl.appendChild(document.createTextNode("Surface à préciser"));
  dl.appendChild(el("i", null, "trait tireté, sur tous les dessins"));
  dash.appendChild(dl);
  key.appendChild(dash);
  b.appendChild(key);
  return b;
}

/* Rafraîchit ce qui existe : appelé après une saisie de surface, depuis
   n'importe quel onglet. */
export function renderLegend(){
  renderBar();
  var host = document.getElementById("vars");
  if(host && host.parentNode){
    var fresh = varBlock();
    host.parentNode.replaceChild(fresh, host);
  }
  var lg = document.querySelector(".legend");
  if(lg && lg.parentNode) lg.parentNode.replaceChild(legendBlock(), lg);
}
