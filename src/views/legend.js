import { el, fmt } from "../core/format.js";
import { BUILT, BUILTG, CIRC, CIRCA, CIRCSET, ESTT, GRAND, PROG, VARITEMS } from "../core/model.js";
import { FAM } from "../data/families.js";
import { RULES } from "../data/rules.js";

/* Ce module construisait autrefois le contenu d'un en-tête statique haut de
   ~900 px, imposé au-dessus des cinq onglets. Il produit maintenant la section
   d'introduction du cahier des charges — le seul qu'elle décrive — plus les
   deux chiffres du chrome permanent. */

var onSetArea = null, onSetCirc = null;
export function setAreaHandler(fn){ onSetArea = fn; }
export function setCircHandler(fn){ onSetCirc = fn; }

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
  var pending = VARITEMS.filter(function(it){ return !it.set; }).length + (CIRCSET ? 0 : 1);
  e.textContent = pending
    ? pending + " poste" + (pending > 1 ? "s" : "") + " à préciser"
    : "toutes les surfaces sont fixées";
  e.dataset.pending = String(pending > 0);
  e.title = pending
    ? "Voir les postes que le règlement ne chiffre pas"
    : "Les huit postes et la part de circulation ont reçu ta valeur";
}

/* ---------- chapô du cahier des charges ----------
   Le titre et le chiffre-clé seulement. Les surfaces à préciser et la légende
   des familles appartiennent à la SECTION des surfaces, plus bas : l'onglet se
   lit maintenant en trois temps — contraintes, surfaces, adjacences. */
export function introSection(){
  var s = el("section","intro");

  var h = el("div","intro__head");
  h.appendChild(el("h1", null, "Cahier des charges"));
  h.appendChild(el("p","intro__lead",
    "Les contraintes du concours, les surfaces dessinées à l’échelle et les adjacences "
    + "exigées. C’est le premier temps : tout ce qui suit s’en sert."));
  s.appendChild(h);

  /* Le chiffre-clé est le TOTAL. L'ancien affichait la part chiffrée au
     règlement (6'489 m²), le total n'apparaissant qu'en fin de note. */
  var fig = el("div","intro__fig");
  var big = el("p","intro__big mono");
  big.appendChild(document.createTextNode(fmt(GRAND)));
  big.appendChild(el("span","u","m²"));
  fig.appendChild(big);
  fig.appendChild(breakBlock());
  s.appendChild(fig);
  return s;
}

/* La décomposition du chiffre-clé. La circulation y figure parce qu'elle vaut
   plus de mille mètres carrés : la taire ferait mentir le total. */
function breakBlock(){
  var br = el("dl","intro__break");
  [["chiffré au règlement", fmt(PROG) + " m²"],
   ["à préciser", fmt(ESTT) + " m²"],
   ["circulation, " + Math.round(CIRC * 100) + " % du bâti scolaire", fmt(Math.round(CIRCA)) + " m²"],
   ["bâti scolaire, circulation comprise", fmt(Math.round(BUILTG)) + " m²"]
  ].forEach(function(row){
    br.appendChild(el("dt", null, row[0]));
    br.appendChild(el("dd","mono", row[1]));
  });
  return br;
}

/* ---------- les postes que le règlement ne chiffre pas ----------
   C'était une note qui listait huit valeurs à corriger et renvoyait ailleurs
   pour les corriger. Les valeurs se saisissent maintenant sur place.

   La part de circulation les a rejointes : c'est elle aussi une surface que le
   règlement ne chiffre pas, elle vaut plus de mille mètres carrés, et elle se
   réglait jusqu'ici dans deux autres onglets, avec deux arithmétiques
   différentes. Elle se décide ici, une fois. */
export function varBlock(){
  var b = el("section","vars");
  b.id = "vars";
  var hd = el("div","vars__head");
  hd.appendChild(el("h2","label",
    "Surfaces à préciser — " + VARITEMS.length + " postes et la circulation"));
  hd.appendChild(el("p","vars__note",
    "Le règlement les compte en nombre de pièces, ou les renvoie « selon projet ». "
    + "Les valeurs ci-dessous sont les nôtres : corrige-les ici, tous les totaux "
    + "et tous les onglets suivants suivent."));
  b.appendChild(hd);

  var ul = el("ul","vars__list");

  /* --- fabrique commune : un nom, un état, un champ, un total, un message --- */
  function row(opt){
    var li = el("li", opt.set ? "is-set" : null);

    var nm = el("div","vars__name");
    nm.appendChild(document.createTextNode(opt.name));
    /* L'état ne peut pas être porté par la seule couleur : l'ancien bandeau
       écrivait « les postes que tu as fixés passent en vert ». */
    nm.appendChild(el("span","vars__state", opt.set ? "fixée" : "à préciser"));
    li.appendChild(nm);

    var f = el("form","vars__field");
    var lab = el("label","vh", opt.aria);
    lab.htmlFor = opt.id;                   /* les <label> étaient orphelins */
    var inp = document.createElement("input");
    inp.type = "number"; inp.id = opt.id;
    inp.min = String(opt.min); inp.max = String(opt.max); inp.step = String(opt.step);
    inp.value = String(opt.value);
    inp.className = "mono";
    var unit = el("span","vars__unit", opt.unit);
    var tot = el("b","vars__tot mono", opt.tot);
    var msg = el("p","vars__msg");
    f.appendChild(lab); f.appendChild(inp); f.appendChild(unit);
    f.appendChild(tot); f.appendChild(msg);

    function commit(e){
      if(e) e.preventDefault();
      var v = parseFloat(String(inp.value).replace(",", "."));
      if(!isFinite(v) || v < opt.min || v > opt.max){
        /* On ne remet PAS l'ancienne valeur : la saisie reste corrigeable sans
           être retapée, et la raison du refus est écrite. */
        msg.textContent = opt.bad + " — « " + inp.value + " » n’a pas été retenu.";
        li.classList.add("is-bad");
        return;
      }
      msg.textContent = ""; li.classList.remove("is-bad");
      /* `opt.commit` remplace tout le bloc par un neuf : sans cela, passer d'un
         champ au suivant d'un seul clic perdait ce clic ET le focus, puisque
         l'élément visé disparaissait entre le `change` et le `mousedown`. On
         rend le focus au même champ, identifié par son id stable. */
      if(!opt.commit(v)) return;
      var again = document.getElementById(opt.id);
      if(again && document.activeElement !== again){
        var atEnd = String(again.value).length;
        again.focus({ preventScroll:true });
        try{ again.setSelectionRange(atEnd, atEnd); }catch(_){}
      }
    }
    f.addEventListener("submit", commit);
    inp.addEventListener("change", commit);
    li.appendChild(f);
    return li;
  }

  VARITEMS.forEach(function(it){
    ul.appendChild(row({
      id: "var-" + it.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      name: it.n + (it.nb > 1 ? " ×" + it.nb : ""),
      set: it.set,
      aria: "Surface par pièce, en m², pour " + it.n,
      min: 1, max: 2000, step: 0.5, value: it.u,
      unit: "m²/pièce",
      tot: fmt(it.tot) + " m²",
      bad: "Entre 1 et 2 000 m²",
      commit: function(v){ return onSetArea ? onSetArea(it.key, v) : false; }
    }));
  });

  /* La circulation ferme la liste : elle n'est pas un local, elle est ce qui
     les relie, et sa part décide de la surface bâtie de tous les niveaux. */
  var lo = Math.round(RULES.circ.min * 100), hi = Math.round(RULES.circ.max * 100);
  var liC = row({
    id: "var-circ",
    name: "Circulation — couloirs, escaliers, paliers, sas",
    set: CIRCSET,
    aria: "Part de circulation, en pour cent de la surface bâtie",
    min: lo, max: hi, step: 1, value: Math.round(CIRC * 100),
    unit: "% du bâti",
    tot: fmt(Math.round(CIRCA)) + " m²",
    bad: "Entre " + lo + " et " + hi + " %",
    commit: function(v){ return onSetCirc ? onSetCirc(v / 100) : false; }
  });
  liC.classList.add("vars__circ");
  var why = el("p","vars__why",
    "Part de la surface BÂTIE, et non un supplément : " + fmt(BUILT)
    + " m² utiles de bâti scolaire deviennent " + fmt(Math.round(BUILTG)) + " m² bâtis.");
  liC.appendChild(why);
  ul.appendChild(liC);

  b.appendChild(ul);
  return b;
}

/* ---------- légende des familles ---------- */
export function legendBlock(){
  var b = el("section","legend");
  b.appendChild(el("h2","label","Familles d’usage"));

  var track = el("div","legend__track");
  track.setAttribute("role","img");
  track.setAttribute("aria-label",
    "Répartition des " + fmt(GRAND) + " m² entre les huit familles d’usage");
  FAM.forEach(function(f){
    var seg = el("div","legend__seg");
    seg.style.flex = f.total + " 0 0";
    seg.style.backgroundColor = "var(" + f.c + ")";
    if(f.id === "tec") seg.classList.add("is-hatched");
    seg.title = f.name + " — " + fmt(f.total) + " m²";
    track.appendChild(seg);
  });
  b.appendChild(track);

  var key = el("ul","legend__key");
  FAM.forEach(function(f){
    var k = el("li");
    var sw = el("i","sw"); sw.style.backgroundColor = "var(" + f.c + ")";
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

  /* La circulation n'a pas de couleur de famille : elle n'est aucun usage. Elle
     a sa ligne, pour qu'on ne la cherche pas dans la piste. */
  var ci = el("li","legend__extra");
  ci.appendChild(el("i","sw sw--circ"));
  var cl = el("div","legend__lb");
  cl.appendChild(document.createTextNode("Circulation"));
  cl.appendChild(el("i", null, "hors des huit familles · " + Math.round(CIRC * 100)
    + " % du bâti scolaire"));
  ci.appendChild(cl);
  ci.appendChild(el("div","legend__vl mono", fmt(Math.round(CIRCA)) + " m²"));
  key.appendChild(ci);
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
  var br = document.querySelector(".intro__break");
  if(br && br.parentNode) br.parentNode.replaceChild(breakBlock(), br);
}
