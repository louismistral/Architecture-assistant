import { TABS, curSub, isTool, readHash, setSub, view, writeHash } from "./core/viewstate.js";
import { render } from "./views/render.js";
import { resizeMix } from "./views/mixer.js";
import { resizeMass } from "./views/massing.js";
import { initStore, verifieQuantites } from "./mix/store.js";

/* ---------- thème ----------
   `[data-theme]` était prévu dans la feuille de tokens mais aucune ligne du
   projet ne l'écrivait : le thème sombre n'était pas contrôlable. Trois états,
   parce que « suivre le système » est le bon défaut et doit rester joignable. */
var THEMES = [
  { v:"auto",  icon:"◐", label:"automatique" },
  { v:"light", icon:"○", label:"clair" },
  { v:"dark",  icon:"●", label:"sombre" }
];
var themeIdx = 0;

function readTheme(){
  try{
    var s = localStorage.getItem("saxon.theme");
    for(var i = 0; i < THEMES.length; i++) if(THEMES[i].v === s) return i;
  }catch(e){ /* mode privé, stockage refusé : on reste sur « automatique » */ }
  return 0;
}
function paintTheme(){
  var t = THEMES[themeIdx];
  if(t.v === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t.v);
  var b = document.getElementById("themeBtn");
  document.getElementById("themeIcon").textContent = t.icon;
  document.getElementById("themeLabel").textContent = "Thème : " + t.label;
  b.title = "Thème : " + t.label;
}
function wireTheme(){
  themeIdx = readTheme();
  paintTheme();
  document.getElementById("themeBtn").addEventListener("click", function(){
    themeIdx = (themeIdx + 1) % THEMES.length;
    try{ localStorage.setItem("saxon.theme", THEMES[themeIdx].v); }catch(e){}
    paintTheme();
  });
}

/* ---------- onglets ----------
   Vrai patron d'onglets : `role="tab"` + `aria-selected`, un seul arrêt de
   tabulation pour le groupe, flèches pour circuler. L'ancienne barre utilisait
   `aria-pressed`, donc le vocabulaire des interrupteurs : une destination et un
   réglage se ressemblaient. */
var tabBtns = TABS.map(function(t){
  return { t:t, el:document.getElementById("tab" + t.id.charAt(0).toUpperCase() + t.id.slice(1)) };
});

function paintTabs(){
  tabBtns.forEach(function(b){
    var on = view.tab === b.t.id;
    b.el.setAttribute("aria-selected", String(on));
    b.el.tabIndex = on ? 0 : -1;
  });
  var cur = tabBtns.filter(function(b){ return view.tab === b.t.id; })[0];
  if(cur) document.getElementById("panels").setAttribute("aria-labelledby", cur.el.id);
}

export function goTo(id, focusPanel){
  if(view.tab === id) return;
  view.tab = id;
  apply();
  if(focusPanel) document.getElementById("panels").focus();
}

function apply(){
  document.body.dataset.view = view.tab;
  document.body.dataset.kind = isTool() ? "tool" : "doc";
  paintTabs();
  writeHash();
  render();
}

tabBtns.forEach(function(b, i){
  b.el.addEventListener("click", function(){ goTo(b.t.id, false); });
  b.el.addEventListener("keydown", function(e){
    var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1
          : e.key === "Home" ? -99 : e.key === "End" ? 99 : 0;
    if(!d) return;
    e.preventDefault();
    var n = d === -99 ? 0 : d === 99 ? tabBtns.length - 1
          : (i + d + tabBtns.length) % tabBtns.length;
    tabBtns[n].el.focus();
    goTo(tabBtns[n].t.id, false);
  });
});

/* Ce compteur est un bouton, avec un `title` qui promet de montrer les postes
   concernés — et il n'avait aucun gestionnaire : contrôle mort dans le chrome
   permanent. Il mène à la liste, où les valeurs se saisissent. */
document.getElementById("barEst").addEventListener("click", function(){
  /* Les surfaces à préciser se saisissent dans le volet Surfaces : depuis
     « Contraintes » ou « Adjacences », changer d'onglet ne suffisait plus. */
  var move = view.tab !== "programme" || curSub() !== "surfaces";
  /* Le volet est nommé AVEC son onglet : depuis le mixer, « surfaces » n'est
     pas un volet du mixer, et le régler sans dire où n'aurait rien fait. */
  setSub("surfaces", "programme");
  if(view.tab !== "programme") goTo("programme", false);
  else if(move) apply();
  var host = document.getElementById("vars");
  if(host){
    host.scrollIntoView({ block:"center", behavior:"smooth" });
    var first = host.querySelector("input");
    if(first) first.focus({ preventScroll:true });
  }
});

window.addEventListener("hashchange", function(){
  if(readHash()) apply();
});

/* ---------- démarrage ---------- */
wireTheme();
/* Avant tout rendu : une surface peut être modifiée depuis le cahier des charges,
   donc avant que le mixer ait jamais été ouvert. */
initStore();
verifieQuantites();
readHash();
document.body.dataset.view = view.tab;
document.body.dataset.kind = isTool() ? "tool" : "doc";
paintTabs();
writeHash();
render();

var rt;
window.addEventListener("resize", function(){
  clearTimeout(rt);
  rt = setTimeout(function(){
    /* Le mixer ne se refait pas en entier : seule la largeur du canevas change,
       donc seul le pavage est à refaire. Un rendu complet perdrait le repli
       ouvert, la graine tapée et le défilement. */
    /* Le massing non plus : le canevas WebGL perdrait sa caméra, et le plan
       son cadrage. Seules leurs largeurs changent. */
    if(view.tab === "mixer") resizeMix();
    else if(view.tab === "massing") resizeMass();
    else render();
  }, 140);
});
