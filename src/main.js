import { TABS, isTool, readHash, view, writeHash } from "./core/viewstate.js";
import { render } from "./views/render.js";
import { resizeMix } from "./views/mixer.js";
import { resizeMass } from "./views/massing.js";
import { initStore, verifieQuantites } from "./mix/store.js";
import { initCompte } from "./net/compte.js";
import { initReglages } from "./net/reglages.js";
import { PREFS, initPrefs, onPrefs, setPref } from "./net/prefs.js";
import { MODES, THEMES, modeOf, themeOf } from "./data/themes.js";
import { basculer, initVariantes, ouvrirProfil, setApresCharge } from "./views/variantes.js";
import { icone } from "./views/icons.js";
import { deroulant, item, separateur, titre } from "./views/menu.js";

var H = document.documentElement;

/* Un redimensionnement qui ne refait que ce qui dépend de la largeur. Le
   mixer et le massing ne se refont pas en entier : un rendu complet perdrait le
   repli ouvert, la seed tapée, le défilement — et, au massing, la caméra de la
   3D et le cadrage du plan. */
function recadrer(){
  if(view.tab === "mixer") resizeMix();
  else if(view.tab === "massing") resizeMass();
  else render();
}

/* ---------- thème et mode ----------
   Deux choix distincts : le THÈME (Saxon, puis ceux qu'on installe — voir
   `src/data/themes.js`) et le MODE (automatique, clair, sombre). Ils vivent
   dans les préférences du compte, et l'appareil en garde une copie pour que le
   thème ne clignote pas au démarrage. */
var charges = {};
function chargerTheme(t){
  if(!t.css || charges[t.id]) return;
  var l = document.createElement("link");
  l.rel = "stylesheet"; l.href = t.css;
  /* La 3D lit ses couleurs une fois : elle se repeint quand la feuille arrive. */
  l.addEventListener("load", function(){ if(view.tab === "massing") resizeMass(); });
  document.head.appendChild(l);
  charges[t.id] = 1;
}
var themeAvant = "";
function peindreTheme(){
  var t = themeOf(PREFS.theme), m = modeOf(PREFS.mode);
  chargerTheme(t);
  if(t.id === "saxon") H.removeAttribute("data-theme"); else H.setAttribute("data-theme", t.id);
  if(m.id === "auto") H.removeAttribute("data-mode"); else H.setAttribute("data-mode", m.id);
  var ic = document.getElementById("themeIcon");
  while(ic.firstChild) ic.removeChild(ic.firstChild);
  ic.appendChild(icone(m.id === "light" ? "soleil" : m.id === "dark" ? "lune" : "auto"));
  var lab = "Thème : " + t.n + " · " + m.n.toLowerCase();
  document.getElementById("themeLabel").textContent = lab;
  document.getElementById("themeBtn").title = lab;
  /* WebGL ne relit pas les tokens seul : on redessine ce qui en dépend. */
  var k = t.id + "|" + m.id;
  if(themeAvant && k !== themeAvant && view.tab === "massing") resizeMass();
  themeAvant = k;
}

/* Le menu ◐ : le thème, puis le mode — le déroulant de `views/menu.js`. */
deroulant(document.getElementById("themeMenu"), document.getElementById("themeBtn"),
          document.getElementById("themeList"), function(l){
  l.appendChild(titre("Thème"));
  THEMES.forEach(function(t){
    l.appendChild(item(t.n, t.d, PREFS.theme === t.id, function(){ setPref("theme", t.id); }));
  });
  l.appendChild(separateur());
  l.appendChild(titre("Mode"));
  MODES.forEach(function(m){
    l.appendChild(item(m.n, m.d, PREFS.mode === m.id, function(){ setPref("mode", m.id); }));
  });
});

/* ---------- la barre « Atelier et outils » ----------
   Une ligne par onglet, numérotée dans l'ordre du concours ; le cadre du
   projet en tête, avec une icône au lieu d'un numéro. Elle POUSSE le contenu :
   le plan et la 3D se recadrent au lieu d'être recouverts. Sur un écran
   étroit, elle se pose par-dessus et se referme au choix d'un onglet. */
var liste = document.getElementById("tabs");
var tabBtns = TABS.map(function(t){
  var b = document.createElement("button");
  b.type = "button"; b.className = "sidenav__item";
  b.id = "tab-" + t.id;
  b.setAttribute("role", "tab");
  b.setAttribute("aria-controls", "panels");
  var n = document.createElement("span");
  n.className = "sidenav__n mono";
  n.setAttribute("aria-hidden", "true");
  if(t.icon) n.appendChild(icone(t.icon)); else n.textContent = t.n;
  b.appendChild(n);
  var l = document.createElement("span");
  l.className = "sidenav__l"; l.textContent = t.label;
  b.appendChild(l);
  if(t.icon) b.classList.add("is-cadre");
  liste.appendChild(b);
  return { t:t, el:b };
});

function etroit(){ return window.matchMedia("(max-width: 900px)").matches; }
function peindreNav(){
  var ouvert = etroit() ? navEtroit : !!PREFS.nav;
  document.body.classList.toggle("has-nav", ouvert);
  document.getElementById("navBtn").setAttribute("aria-expanded", String(ouvert));
  document.getElementById("sidenav").hidden = !ouvert;
}
/* Sur un écran étroit, la barre ne s'ouvre qu'à la demande : elle couvrirait
   sinon tout l'outil à chaque rechargement. */
var navEtroit = false;
document.getElementById("navBtn").addEventListener("click", function(){
  if(etroit()) navEtroit = !navEtroit;
  else setPref("nav", !PREFS.nav);
  peindreNav();
  recadrer();
});

function paintTabs(){
  tabBtns.forEach(function(b){
    var on = view.tab === b.t.id;
    b.el.setAttribute("aria-selected", String(on));
    b.el.tabIndex = on ? 0 : -1;
  });
  document.getElementById("panels").setAttribute("aria-labelledby", "tab-" + view.tab);
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
  b.el.addEventListener("click", function(){
    goTo(b.t.id, false);
    if(etroit() && navEtroit){ navEtroit = false; peindreNav(); }
  });
  b.el.addEventListener("keydown", function(e){
    var d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1
          : e.key === "Home" ? -99 : e.key === "End" ? 99 : 0;
    if(!d) return;
    e.preventDefault();
    var n = d === -99 ? 0 : d === 99 ? tabBtns.length - 1
          : (i + d + tabBtns.length) % tabBtns.length;
    tabBtns[n].el.focus();
    goTo(tabBtns[n].t.id, false);
  });
});

window.addEventListener("hashchange", function(){
  if(readHash()) apply();
});

/* La barre d'application s'enroule sur un portable : sa hauteur se MESURE, et
   la barre latérale se cale dessous. C'est une géométrie, pas une valeur de
   dessin — comme la taille d'un bloc du mixer. */
function calerBarre(){
  var bar = document.querySelector(".appbar");
  H.style.setProperty("--appbar-h", (bar ? Math.round(bar.getBoundingClientRect().height) : 0) + "px");
}

/* ---------- les variantes, le compte ----------
   Le bouton des variantes vit à côté du compte, pas dans la barre des
   onglets : une variante n'est pas une étape de la chronologie, elle la rejoue
   en entier. Le badge du compte porte l'identité — où je suis, comment j'entre,
   comment je sors. */
document.getElementById("varBtn").addEventListener("click", function(){ basculer(); });
document.getElementById("profBtn").addEventListener("click", function(){ ouvrirProfil(); });

/* ---------- démarrage ---------- */
initPrefs();
peindreTheme();
peindreNav();
calerBarre();
onPrefs(function(){ peindreTheme(); peindreNav(); });
/* Le retour du lien de connexion arrive DANS LE FRAGMENT, et le fragment porte
   la vue : il faut le consommer avant `readHash()`, sinon l'application
   démarre sur `#access_token=…`, qui n'est l'onglet de personne. */
initCompte();
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

/* Charger une variante remet tous les onglets en place : c'est donc un rendu
   complet, pas un redimensionnement. */
setApresCharge(function(){ render(); });
initReglages();
initVariantes();

var rt;
window.addEventListener("resize", function(){
  clearTimeout(rt);
  rt = setTimeout(function(){
    calerBarre();
    peindreNav();
    recadrer();
  }, 140);
});

/* Chaque fichier du site redemandé au serveur : un changement publié se voit
   au prochain chargement (`sw.js`). */
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function(){});
