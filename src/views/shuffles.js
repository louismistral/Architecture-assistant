/* ============================================================================
   LES SHUFFLES DES AUTRES ONGLETS, et le MODE AUTO

   Sous le Shuffle de chaque onglet (mixer, Massing, Typologies), une rangée :
   — « Auto » : le même bouton, en mode auto, ne tire plus UNE proposition, il
     ouvre la recherche automatique des variantes, réduite à cet onglet ;
   — un mini-shuffle par AUTRE onglet de la chronologie : rebattre le
     programme sans quitter le Massing, une typologie depuis le mixer… Les
     onglets à construire ont le leur, vide.

   Un onglet verrouillé (ou figé par un cadenas en aval, `core/verrou.js`) a
   son mini-shuffle éteint : le bouton dit à quel onglet il appartient
   (`data-onglet`), et la garde du panneau (`render.js`) le tient comme le
   Shuffle de l'onglet lui-même.

   Les tirages sont INJECTÉS (`setShuffles`, par `render.js`) : le mixer et le
   Massing posent cette rangée, et l'importer en retour ferait un cycle.
   ========================================================================= */
import { el } from "../core/format.js";
import { fige } from "../core/verrou.js";
import { icone } from "./icons.js";
import { rechercheAuto } from "./variantes.js";

/* la chronologie : l'onglet, son nom court, ce que rebat la recherche */
var ONGLETS = [
  { id:"mixer",       n:"Programme",   titre:"Shuffle programme — autre répartition dans les étages", rech:"programme" },
  { id:"massing",     n:"Massing",     titre:"Shuffle massing — autre forme bâtie, même programme",    rech:"massing" },
  { id:"typologie",   n:"Typologies",  titre:"Shuffle typologie — autre plan, mêmes volumes",          rech:"typologies" },
  { id:"tectonique",  n:"Tectonics",   titre:"Tectonics — à construire" },
  { id:"materialite", n:"Materiality", titre:"Materiality — à construire" }
];

var TIRER = {}, apres = null;
export function setShuffles(t, fn){ TIRER = t; apres = fn; }

/* le mode auto, onglet par onglet, le temps de la session */
var AUTO = {};
/* le dernier mini-shuffle : son bouton le dit un instant, la page refaite */
var DERNIER = null;

function marquer(main, tab){
  var on = !!AUTO[tab], sous = main.querySelector(".mass-tir__t span");
  main.classList.toggle("is-auto", on);
  if(sous){
    if(main.dataset.sous == null) main.dataset.sous = sous.textContent;
    sous.textContent = on ? "recherche automatique, sur cet onglet" : main.dataset.sous;
  } else {
    if(main.dataset.txt == null) main.dataset.txt = main.textContent;
    main.textContent = on ? main.dataset.txt + " auto" : main.dataset.txt;
  }
}

/* La rangée du Shuffle `main` de l'onglet `tab` : posée juste après lui, ou à
   la fin de `hote` quand le bouton vit dans une barre en ligne (le mixer). */
export function sousShuffle(main, tab, hote){
  var ici = ONGLETS.filter(function(o){ return o.id === tab; })[0];
  /* en mode auto, le clic va à la recherche, et à elle seule */
  if(!main.dataset.shf){
    main.dataset.shf = "1";
    main.addEventListener("click", function(e){
      if(!AUTO[tab]) return;
      e.stopImmediatePropagation(); e.preventDefault();
      rechercheAuto(ici.rech);
    }, true);
  }
  marquer(main, tab);

  var r = el("div", "shf");
  r.setAttribute("role", "group");
  r.setAttribute("aria-label", "Mode auto et shuffles des autres onglets");
  var a = el("button", "btn shf__auto", "Auto");
  a.type = "button";
  a.dataset.onglet = tab;
  a.setAttribute("aria-pressed", String(!!AUTO[tab]));
  a.title = "Mode auto : le Shuffle ouvre la recherche automatique des variantes, sur cet onglet seulement";
  a.disabled = fige(tab);
  a.addEventListener("click", function(){
    AUTO[tab] = !AUTO[tab];
    a.setAttribute("aria-pressed", String(AUTO[tab]));
    marquer(main, tab);
  });
  r.appendChild(a);
  r.appendChild(el("span", "shf__sep"));

  ONGLETS.forEach(function(o){
    if(o.id === tab) return;
    var b = el("button", "btn shf__m");
    b.type = "button";
    b.dataset.onglet = o.id;
    b.appendChild(icone("shuffle", 12));
    b.appendChild(el("span", null, o.n));
    var vide = !TIRER[o.id], f = !vide && fige(o.id);
    b.disabled = vide || f;
    b.title = vide ? o.titre : f ? o.n + " est verrouillé : son shuffle aussi" : o.titre;
    if(DERNIER && DERNIER.id === o.id && Date.now() - DERNIER.t < 1500) b.classList.add("is-fait");
    b.addEventListener("click", function(){
      if(fige(o.id) || !TIRER[o.id]) return;
      TIRER[o.id]();
      DERNIER = { id:o.id, t:Date.now() };
      if(apres) apres();
    });
    r.appendChild(b);
  });
  if(hote) hote.appendChild(r);
  else main.insertAdjacentElement("afterend", r);
  return r;
}
