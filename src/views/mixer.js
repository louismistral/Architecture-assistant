/* ============================================================================
   ONGLET « PROGRAMME MIXER »

   Deuxième temps de la chronologie : le cahier des charges a fixé les surfaces,
   celui-ci les répartit sur des niveaux. Rien d'autre. Ni plan, ni volume —
   seulement la question « qu'est-ce qui va à quel étage », qui est la première
   décision d'un projet et celle dont tout le reste dépend.

   Un niveau est dessiné à l'échelle des surfaces : chaque bloc occupe dans le
   rectangle exactement la part de m² qu'il occupe dans le programme (pavage
   squarifié, `src/core/treemap.js`). Une liste ne dirait pas qu'un niveau est
   plein ; un dessin le dit avant qu'on ait lu un chiffre.

   Deux gestes, et ils se font sur le dessin : on GLISSE un bloc d'un niveau
   à l'autre, et l'on SCINDE en tirant une pièce hors de son bloc. Il y avait
   un menu pour cela — « déplacer vers », « scinder 6 sur 18 » — qui demandait
   de choisir un niveau dans une liste et un nombre dans une autre, alors que
   la pile et le bloc étaient là, sous les yeux. Deux blocs d'un même poste qui
   se retrouvent au même niveau se refondent en un (`fuse`), donc rien ne se
   perd à se tromper.

   Chaque RÉGLAGE a sa valeur et son DÉ (`mix/opts.js`) : dé allumé, le Shuffle
   décide ; dé éteint, la valeur est la nôtre et le tirage la respecte. Toucher
   une valeur, c'est la choisir : son dé s'éteint. Chacun se règle là où il se
   voit — le nombre de niveaux sur la pile, le plateau sur son niveau, le lien
   d'un poste sur son bloc —, et les dés maîtres sont à l'étape Leviers du rail.

   Le rail est celui du Massing et des Typologies : « Proposer » en tête —
   Shuffle programme, Tout au bac, la seed —, puis les étapes repliables, leur
   état à droite : À placer, Contraintes, Leviers, Adjacences, Circulation.
   ========================================================================= */
import { fige } from "../core/verrou.js";
import { dec, el, fmt } from "../core/format.js";
import { CIRC, CIRCA, COULOIR, FMAP } from "../core/model.js";
import { curSeed, parseSeed, seed, seedLabel } from "../core/rand.js";
import { s as svg } from "../core/svg.js";
import { squarify } from "../core/treemap.js";
import { view } from "../core/viewstate.js";
import { RULES } from "../data/rules.js";
import { accept, unaccept } from "../mix/accept.js";
import { mixCheck, mixVerdict } from "../mix/checks.js";
import {
  FLOORS, PLATE_MAX, PLATE_MIN, TRAY,
  addFloorBottom, addFloorTop, areaOf, blockOf, delFloorAt, flArea, flBrut, flBuilt, flCirc, flCircDe,
  flCount, flHeight, flLibre, flName, flNet, floorCost, grappeBlocs, horsAt,
  lvlOf, move, moveGroupe, onFloor, rassembler, setPlate, split, toTray,
  trayArea, trayBlocks, usable
} from "../mix/floors.js";
import {
  adjActive, coteDe, dePile, estLie, lienId, liens, setCote, setDePile, setLie
} from "../mix/opts.js";
import { dimsAProf, nearestDims, squarest, validDims } from "../core/geometry.js";
import { bandeMassing } from "../mass/model.js";
import { PMAP, aOf, lienLibre, posables, posesDedans, qOf, uOf } from "../mix/prog.js";
import { SMAP } from "./schema.js";
import { pilesAdmissibles, repartir } from "../mix/shuffle.js";
import { saveSoon, setChip } from "../mix/store.js";
import { sousShuffle } from "./shuffles.js";
import { icone as ico } from "./icons.js";
import { roleNom } from "../data/lignes.js";

/* Surface d'un mètre carré, en pixels carrés. Constante pour toute la vue :
   c'est ce qui permet de comparer deux niveaux d'un coup d'œil. */
var AIRE = 70;
var TINY_W = 46, TINY_H = 21;

var stackEl = null, issuesEl = null, trayEl = null, sumEl = null, circEl = null;
var reglEl = null, adjEl = null, dernierCheck = [];
var ghostEl = null;
var selU = null, drag = null, wired = false;
/* Le code de l'écart déplié, s'il y en a un. Un seul à la fois : ouvrir le
   suivant referme le précédent, comme un menu. L'écart ouvert désigne aussi
   ses coupables dans la pile — c'est à quoi sert `issFocus`. */
var openIss = null, issFocus = null;

/* ---------- construction du panneau ---------------------------------------
   La disposition du Massing et des Typologies : un RAIL à gauche, en chaîne —
   « Proposer » en tête, toujours visible, puis les étapes repliables, chacune
   portant son état à droite —, et ce qu'on regarde, la pile, tient tout le
   reste. Le rail se refait à chaque geste (`dessineRail`). */
var railEl = null;
export function mixPanel(){
  var p = el("section","mix");
  var grid = el("div","mass-grid");
  railEl = el("aside","mass-rail");
  grid.appendChild(railEl);

  var main = el("div","mix-main");
  sumEl = el("div","mix-sum");
  main.appendChild(sumEl);
  stackEl = el("div","mix-stack");
  main.appendChild(stackEl);
  grid.appendChild(main);
  p.appendChild(grid);

  if(!ghostEl){
    ghostEl = el("div","mix-ghost");
    ghostEl.hidden = true;
    document.body.appendChild(ghostEl);
  }
  if(!wired) wireMix();
  /* Une seed existe dès le premier affichage : sans elle, la première
     proposition ne serait pas rejouable. */
  if(!curSeed) seed(null);
  return p;
}

/* --- le rail : proposer, puis les étapes --------------------------------------
   Ce qui agit sur l'ENSEMBLE en tête : le Shuffle, Tout au bac, la seed. Puis,
   dans l'ordre où l'on s'en sert : ce qui reste à poser, ce qui ne va pas, ce
   que tire le Shuffle, les adjacences, la circulation qu'on lit. Le corps d'une
   étape ne se construit que si elle est ouverte. */
var OUVERT = {};
function dessineRail(){
  if(!railEl) return;
  while(railEl.firstChild) railEl.removeChild(railEl.firstChild);
  issuesEl = trayEl = reglEl = adjEl = circEl = null;
  dernierCheck = mixCheck();
  railEl.appendChild(blocProposer());
  var ol = el("ol","mass-etapes");
  ol.appendChild(etapeBac());
  ol.appendChild(etapeControle());
  ol.appendChild(etapeLeviers());
  ol.appendChild(etapeAdj());
  ol.appendChild(etapeCirc());
  railEl.appendChild(ol);
}

/* Une étape, comme au Massing : numéro, nom, ce qu'elle a décidé, son ÉTAT à
   droite. `ouvrir` : ouverte par défaut, tant qu'on ne l'a ni ouverte ni fermée. */
function etape(id, num, titre, sous, etat, corps, ouvrir){
  var li = el("li","mass-etape mass-etape--" + id);
  var d = el("details");
  d.open = OUVERT[id] != null ? OUVERT[id] : !!ouvrir;
  var s = el("summary","mass-etape__s");
  s.appendChild(el("span","mass-etape__num mono", num));
  var t = el("span","mass-etape__t");
  t.appendChild(el("b", null, titre));
  if(sous) t.appendChild(el("span", null, sous));
  s.appendChild(t);
  var e = el("span","mass-etape__e");
  (Array.isArray(etat) ? etat : etat ? [etat] : []).forEach(function(x){ e.appendChild(x); });
  s.appendChild(e);
  s.appendChild(ico("chevron", 14));
  d.appendChild(s);
  var b = el("div","mass-etape__b");
  d.appendChild(b);
  function remplir(){ if(!d.open || b.firstChild) return; corps(b); }
  d.addEventListener("toggle", function(){ OUVERT[id] = d.open; remplir(); });
  remplir();
  li.appendChild(d);
  return li;
}
function puce(txt, cls, titre){
  var c = el("i","chip chip--" + cls, txt);
  if(titre) c.title = titre;
  return c;
}
/* Le renvoi au volet Contraintes : chaque ligne qui gouverne la répartition. */
function versContraintes(b){
  var a = el("button","btn btn--quiet mass-renvoi","Régler ligne à ligne — volet Contraintes");
  a.type = "button";
  a.dataset.vue = "";
  a.addEventListener("click", function(){ if(mixNav) mixNav("contraintes"); });
  b.appendChild(a);
}

function blocProposer(){
  var b = el("section","mass-prop");
  b.appendChild(el("h2","mass-prop__h","Proposer"));
  /* Le tirage est la seule proposition : « Répartir », son jumeau ordonné,
     donnait la même chose à l'ordre des chapitres près, et la seed rend le
     tirage aussi rejouable qu'un ordre fixe. */
  var tir = el("button","btn btn--primary mass-tir");
  tir.type = "button";
  tir.appendChild(ico("de", 18));
  var t = el("span","mass-tir__t");
  t.appendChild(el("b", null, "Shuffle programme"));
  t.appendChild(el("span", null, "autre répartition dans les étages"));
  tir.appendChild(t);
  tir.title = "Une répartition tirée au sort, rejouable par sa seed. Les réglages "
            + "dont le dé est éteint sont respectés.";
  tir.addEventListener("click", function(){ proposer(); });
  b.appendChild(tir);
  /* dessous : le mode auto, et les shuffles des autres onglets */
  sousShuffle(tir, "mixer");

  var nav = el("div","mass-nav");
  var bVide = el("button","btn","Tout au bac");
  bVide.type = "button";
  bVide.title = "Vide les niveaux pour reposer le programme à la main";
  bVide.addEventListener("click", function(){
    toTray(); selU = null; drawMix(); saveSoon();
  });
  nav.appendChild(bVide);
  nav.appendChild(el("span","spacer"));
  nav.appendChild(champSeed());
  b.appendChild(nav);
  var chip = el("span","savechip");
  b.appendChild(chip);
  setChip(chip);
  return b;
}

/* --- 1 · le bac : ce qui reste à poser. L'étape entière reçoit un bloc
   glissé, même repliée. */
function etapeBac(){
  var bl = trayBlocks(), n = 0, reste = trayArea();
  bl.forEach(function(x){ n += x.q; });
  var li = etape("mix-bac", "1", "À placer", n ? n + " pièce" + (n > 1 ? "s" : "") + " au bac" : "tout est posé",
    puce(reste > 0 ? fmt(Math.round(reste)) + " m²" : "posé", reste > 0 ? "warn" : "ok"),
    function(b){ trayEl = b; drawTray(); }, reste > 0);
  li.classList.add("mix-tray");
  return li;
}
/* --- 2 · le contrôle ; un conflit ouvre l'étape d'elle-même --- */
function etapeControle(){
  var v = mixVerdict(dernierCheck);
  var etat = [];
  if(v.e) etat.push(puce(v.e + " conflit" + (v.e > 1 ? "s" : ""), "danger"));
  if(v.w) etat.push(puce(v.w + " à vérifier", "warn"));
  if(!v.e && !v.w) etat.push(puce("tenu", "ok"));
  return etape("mix-controle", "2", roleNom("cadre"),
    v.e ? "une règle enfreinte" : v.w ? "une préférence à revoir" : "rien à signaler", etat,
    function(b){ issuesEl = b; drawIssues(); versContraintes(b); }, v.e > 0);
}
/* --- 3 · ce que tire le Shuffle --- */
function etapeLeviers(){
  var postes = postesLibres().map(function(p){ return p.key; });
  var nLies = postes.filter(estLie).length;
  return etape("mix-leviers", "3", roleNom("levier"), "ce que Shuffle programme tire",
    puce(nLies + "/" + postes.length + " liés", "soft", "Postes liés sur ceux qui ont le choix"),
    function(b){ reglEl = b; drawRegl(); versContraintes(b); });
}
/* --- 4 · les adjacences exigées --- */
function etapeAdj(){
  var ids = liens().map(lienId), nAct = ids.filter(adjActive).length;
  var nBris = dernierCheck.filter(function(x){ return !x.ok && x.code.indexOf("adj:") === 0; }).length;
  return etape("mix-adj", "4", "Adjacences", nAct + " exigée" + (nAct > 1 ? "s" : "") + " sur " + ids.length,
    puce(nBris ? nBris + " rompue" + (nBris > 1 ? "s" : "") : "tenues", nBris ? "danger" : "ok"),
    function(b){ adjEl = b; drawAdj(); });
}
/* --- 5 · la circulation, en lecture seule --- */
function etapeCirc(){
  var pile = 0;
  for(var i = 0; i < FLOORS.length; i++) pile += flCirc(i);
  return etape("mix-circ", "5", "Circulation", dec(COULOIR) + " m de couloir",
    puce(fmt(Math.round(pile)) + " m²", "soft", "Circulation comptée sur cette pile"),
    function(b){ circEl = b; drawCirc(); });
}

function proposer(){
  seed(null);
  repartir({ alea: true, etages: dePile });
  selU = null; openIss = null; issFocus = null;
  drawMix();
  saveSoon();
}

/* ---------- la circulation, en lecture seule --------------------------------
   Elle se règle dans le cahier des charges et nulle part ailleurs : c'est une
   surface, et les surfaces se décident une fois. Ici on la lit. */
function drawCirc(){
  if(!circEl) return;
  var s = circEl;
  while(s.firstChild) s.removeChild(s.firstChild);
  var v = el("p","mix-circ__v mono", dec(COULOIR) + " m");
  v.appendChild(el("span","u", "de couloir"));
  s.appendChild(v);
  /* Deux chiffres, et ils ne se confondent pas : le cahier des charges
     l'ESTIME avant de connaître la pile, le mixer la COMPTE sur celle qu'il
     porte — les couloirs devant les pièces de chaque niveau, et ses cages. */
  var pile = 0, i;
  for(i = 0; i < FLOORS.length; i++) pile += flCirc(i);
  s.appendChild(el("p","mix-circ__n",
    fmt(Math.round(pile)) + " m² sur cette pile — couloirs devant les pièces de chaque "
    + "niveau, et ses cages d’escalier. Le cahier des charges en estime "
    + fmt(Math.round(CIRCA)) + " m² (" + Math.round(CIRC * 100) + " % du bâti)."));
  var b = el("button","btn btn--quiet mix-circ__go","Régler dans le cahier des charges");
  b.dataset.vue = "";
  b.type = "button";
  b.addEventListener("click", function(){
    /* La circulation se saisit dans le volet Surfaces : le lien menait au
       volet retenu de la visite précédente, donc parfois aux contraintes. */
    location.hash = "#programme/surfaces/" + view.group;
    setTimeout(function(){
      var f = document.getElementById("var-circ");
      if(f){ f.scrollIntoView({ block:"center", behavior:"smooth" }); f.focus({ preventScroll:true }); }
    }, 0);
  });
  s.appendChild(b);
}

/* ---------- le dé d'un réglage, et le lien d'un poste -----------------------
   Deux petites commandes qui reviennent partout — sur la pile, sur chaque
   niveau, sur chaque bloc, au flanc. Des icônes DESSINÉES plutôt que des
   caractères : le projet n'a pas de fonte d'icônes, et les glyphes de dé ou de
   chaîne d'Unicode ne sont pas dessinés partout. L'état se dit aussi en toutes
   lettres — « tiré », « figé », « lié », « délié » — : l'icône seule ne le
   dirait ni au lecteur d'écran, ni à qui ne l'a jamais vue. */
function icone(d, extra){
  var v = svg("svg", { width:14, height:14, viewBox:"0 0 16 16", "aria-hidden":"true",
    fill:"none", stroke:"currentColor", "stroke-width":1.4, "stroke-linecap":"round",
    "stroke-linejoin":"round" });
  d.forEach(function(x){ v.appendChild(svg("path", { d:x })); });
  (extra || []).forEach(function(c){
    v.appendChild(svg("circle", { cx:c[0], cy:c[1], r:1.1, fill:"currentColor", stroke:"none" }));
  });
  return v;
}
function iconeDe(){
  return icone(["M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"],
    [[5.6,5.6],[10.4,5.6],[8,8],[5.6,10.4],[10.4,10.4]]);
}
function iconeCadenas(){
  return icone(["M4 7.5h8v6H4z", "M5.8 7.5V5.4a2.2 2.2 0 0 1 4.4 0v2.1"]);
}
function iconeLien(lie){
  return lie
    ? icone(["M6.6 9.4l2.8-2.8", "M5.2 11.8a2.2 2.2 0 0 1-3.1-3.1l2-2a2.2 2.2 0 0 1 3.1 0",
             "M10.8 4.2a2.2 2.2 0 0 1 3.1 3.1l-2 2a2.2 2.2 0 0 1-3.1 0"])
    : icone(["M4.4 12.6a2.2 2.2 0 0 1-3.1-3.1l2-2a2.2 2.2 0 0 1 3.1 0",
             "M11.6 3.4a2.2 2.2 0 0 1 3.1 3.1l-2 2a2.2 2.2 0 0 1-3.1 0", "M7 7l2 2"]);
}
/* Le dé : `etat` vaut true (tiré au Shuffle), false (figé) ou "mixed" pour un
   dé maître dont la famille est partagée. Cliquer inverse — un maître mixte
   s'allume. `compact` : l'icône seule, sur un bloc où la place manque ; le nom
   de l'état reste dans le libellé accessible. */
export function deBtn(etat, quoi, fn, compact){
  var on = etat === true, mixte = etat === "mixed";
  var b = el("button","btn mix-de" + (compact ? " mix-de--compact" : ""));
  b.type = "button";
  b.setAttribute("aria-pressed", mixte ? "mixed" : String(on));
  b.appendChild(on || mixte ? iconeDe() : iconeCadenas());
  if(!compact) b.appendChild(el("span","mix-de__t", mixte ? "mixte" : (on ? "tiré" : "figé")));
  var lab = quoi + (mixte ? " : en partie tiré au Shuffle — cliquer pour tout laisser au hasard"
    : on ? " : tiré au Shuffle — cliquer pour le figer"
         : " : figé — cliquer pour le laisser au Shuffle");
  b.setAttribute("aria-label", lab);
  b.title = lab;
  b.addEventListener("click", function(e){ e.stopPropagation(); fn(!on); });
  return b;
}
/* Le lien d'un poste. Lier, c'est rassembler ce qui est posé ; délier, c'est
   rendre ses pièces indépendantes. Toucher au lien le fige : son dé s'éteint. */
function lienBtn(key, compact){
  var lie = estLie(key), p = PMAP[key];
  var b = el("button","btn mix-lien" + (compact ? " mix-lien--compact" : ""));
  b.type = "button";
  b.setAttribute("aria-pressed", String(lie));
  b.appendChild(iconeLien(lie));
  if(!compact) b.appendChild(el("span", null, lie ? "lié" : "délié"));
  var lab = p.n + (lie ? " : lié — ses pièces vont ensemble à un niveau. Cliquer pour les délier"
                       : " : délié — ses pièces sont indépendantes. Cliquer pour les lier");
  b.setAttribute("aria-label", lab);
  b.title = lab;
  b.addEventListener("click", function(e){
    e.stopPropagation();
    setLie(key, !lie);
    if(!lie) rassembler(key);
    drawMix(); saveSoon();
  });
  return b;
}

/* ---------- ce que tire le Shuffle -------------------------------------------
   Les quatre familles de réglages, et leur dé MAÎTRE : il bascule toute la
   famille d'un coup, et se lit « mixte » quand elle est partagée. Chaque
   réglage garde sa place — la pile, le niveau, le bloc — : ce panneau ne fait
   que les rassembler, et dire où ils sont. */
function postesLibres(){ return posables().filter(function(p){ return lienLibre(p.key); }); }
function drawRegl(){
  if(!reglEl) return;
  var s = reglEl;
  while(s.firstChild) s.removeChild(s.firstChild);
  s.appendChild(el("p","mix-regl__n",
    "Dé allumé, le Shuffle décide ; éteint, la valeur est la tienne et il la respecte. "
    + "Toucher une valeur la fige."));
  var postes = postesLibres().map(function(p){ return p.key; });
  var nLies = postes.filter(estLie).length;

  var ul = el("ul","mix-regl__l");
  function ligne(titre, ou, de, extra){
    var li = el("li");
    var t = el("div","mix-regl__t");
    t.appendChild(el("b", null, titre));
    t.appendChild(el("span", null, ou));
    li.appendChild(t);
    if(de) li.appendChild(de);
    if(extra) li.appendChild(extra);
    ul.appendChild(li);
  }
  ligne("Nombre de niveaux", "sur la pile", deBtn(dePile, "Nombre de niveaux", function(on){
    setDePile(on); drawMix(); saveSoon();
  }));
  var gl = el("div","btn-group mix-regl__g");
  gl.setAttribute("role","group");
  gl.setAttribute("aria-label","Lier ou délier tous les postes");
  [["Tout lier", true], ["Tout délier", false]].forEach(function(x){
    var b = el("button","btn", x[0]);
    b.type = "button";
    b.addEventListener("click", function(){
      postes.forEach(function(k){
        setLie(k, x[1]);
        if(x[1]) rassembler(k);
      });
      drawMix(); saveSoon();
    });
    gl.appendChild(b);
  });
  ligne("Lien des postes", "sur chaque bloc · " + nLies + " lié" + (nLies > 1 ? "s" : "")
    + " sur " + postes.length, null, gl);
  s.appendChild(ul);

  /* Les postes un à un : sur un bloc trop petit pour porter ses commandes, et
     au clavier, c'est ici qu'on les trouve. Un seul repli, qui dit ce qu'il
     contient. */
  var det = el("details","disclose mix-regl__det");
  det.open = !!OUVERT.postes;
  det.addEventListener("toggle", function(){ OUVERT.postes = det.open; });
  det.appendChild(el("summary", null, postes.length + " postes qui se lient ou se délient"));
  var pl = el("ul","mix-postes");
  postesLibres().forEach(function(p){
    var li = el("li");
    var sw = el("i","sw");
    sw.style.backgroundColor = "var(" + FMAP[p.f].c + ")";
    if(p.f === "tec") sw.classList.add("is-hatched");
    li.appendChild(sw);
    li.appendChild(el("span","mix-postes__n", p.n + " ×" + qOf(p.key)));
    li.appendChild(lienBtn(p.key, false));
    pl.appendChild(li);
  });
  det.appendChild(pl);
  s.appendChild(det);
}

/* ---------- les adjacences, lien par lien ------------------------------------
   Ce que le règlement EXIGE, et qui est du cadre : chaque adjacence exigée met
   ses deux postes au même niveau. Les mutualisations ne lient rien. La liste se
   lit, elle ne se règle pas. */
function drawAdj(){
  if(!adjEl) return;
  var s = adjEl;
  while(s.firstChild) s.removeChild(s.firstChild);
  s.appendChild(el("p","mix-regl__n",
    "Chaque adjacence exigée met ses deux postes au même niveau — une seule rompue, et le "
    + "massing ne propose aucun volume. Les mutualisations ne lient rien."));

  /* Une adjacence active qui ne tient pas porte la marque du contrôle. */
  var casse = {};
  dernierCheck.forEach(function(x){
    if(!x.ok && x.code.indexOf("adj:") === 0) casse[x.code.slice(4)] = 1;
  });
  var ul = el("ul","mix-adj__l");
  liens().forEach(function(lk){
    var id = lienId(lk), on = adjActive(id);
    var li = el("li", on ? "is-on" : null);
    var A = SMAP[lk.a], B = SMAP[lk.b];
    var nom = (A ? A.n : lk.a) + (lk.sep ? " ⊣ " : " ↔ ") + (B ? B.n : lk.b);
    var t = el("div","mix-adj__t");
    t.appendChild(el("b", null, nom));
    if(lk.opt) t.appendChild(el("span","esttag", lk.sep ? "mutualisation · indépendance" : "mutualisation"));
    t.appendChild(el("q", null, lk.q));
    /* La paire exacte de postes que le contrôle a relevée. */
    var bris = Object.keys(casse).some(function(c){
      var k = c.split("|");
      return (A && A.k && B && B.k) && ((A.k.indexOf(k[0]) >= 0 && B.k.indexOf(k[1]) >= 0)
        || (A.k.indexOf(k[1]) >= 0 && B.k.indexOf(k[0]) >= 0));
    });
    if(on && bris){ li.classList.add("is-bad"); t.appendChild(el("span","mix-adj__bad","ne tient pas — voir le contrôle")); }
    li.appendChild(t);
    ul.appendChild(li);
  });
  s.appendChild(ul);
}

/* ---------- rendu --------------------------------------------------------- */
export function drawMix(){
  if(!stackEl) return;
  drawSum();
  drawStack();
  dessineRail();
}

/* La seed est ce qui rend une proposition retrouvable : sans elle, on tire dix
   fois et la troisième, qui était la bonne, n'existe plus. */
function champSeed(){
  var w = el("div","mass-seed");
  w.appendChild(el("span","segcap","Seed"));
  var inp = document.createElement("input");
  inp.type = "text"; inp.className = "mono"; inp.value = seedLabel();
  inp.size = 7; inp.spellcheck = false; inp.autocomplete = "off";
  inp.setAttribute("aria-label", "Seed du tirage — retape-la pour rejouer une proposition");
  inp.title = "Retape une seed et rejoue la proposition à l’identique";
  /* Entrée redessine le rail : l'ancien champ peut encore lancer son « change ». */
  var joue = false;
  function rejouer(clavier){
    if(joue) return;
    var s = parseSeed(inp.value);
    if(s === null){ inp.value = seedLabel(); return; }
    joue = true;
    seed(s);
    repartir({ alea:true, etages: dePile });
    selU = null; drawMix(); saveSoon();
    var neuf = clavier && railEl ? railEl.querySelector(".mass-seed input") : null;
    if(neuf) neuf.focus();
  }
  inp.addEventListener("change", function(){ rejouer(false); });
  inp.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); rejouer(true); } });
  w.appendChild(inp);
  return w;
}

function drawSum(){
  while(sumEl.firstChild) sumEl.removeChild(sumEl.firstChild);
  var pose = 0, bati = 0, circ = 0, i;
  for(i = 0; i < FLOORS.length; i++){ pose += flArea(i); bati += flBuilt(i); circ += flCirc(i); }
  var reste = trayArea();

  function fig(lb, val, sub){
    var d = el("div","mix-fig");
    d.appendChild(el("b","mono", val));
    d.appendChild(el("span","mix-fig__l", lb));
    if(sub) d.appendChild(el("span","mix-fig__s", sub));
    return d;
  }
  sumEl.appendChild(fig("niveaux", String(FLOORS.length),
    (FLOORS[0].lvl < 0 ? (-FLOORS[0].lvl) + " sous-sol · " : "")
    + "rez" + (lvlOf(FLOORS.length - 1) > 0 ? " + " + lvlOf(FLOORS.length - 1) : "")));
  sumEl.appendChild(fig("posé", fmt(Math.round(pose)) + " m²", "surface utile"));
  sumEl.appendChild(fig("bâti", fmt(Math.round(bati)) + " m²",
    "dont " + fmt(Math.round(circ)) + " m² de circulation" + (bati > 0 ? ", " + Math.round(circ / bati * 100) + " %" : "")));
  sumEl.appendChild(fig("au bac", fmt(Math.round(reste)) + " m²",
    reste > 0 ? "encore à poser" : "tout est posé"));
}

function famList(bl){
  var by = {}, order = [];
  bl.forEach(function(b){
    var f = PMAP[b.key].f;
    if(!by[f]){ by[f] = []; order.push(f); }
    by[f].push(b);
  });
  order.forEach(function(f){ by[f].sort(function(a, b){ return areaOf(b) - areaOf(a); }); });
  order.sort(function(a, b){
    var sa = 0, sb = 0;
    by[a].forEach(function(x){ sa += areaOf(x); });
    by[b].forEach(function(x){ sb += areaOf(x); });
    return sb - sa;
  });
  return { by: by, order: order };
}

/* Une corbeille dessinée plutôt qu'un caractère : le projet n'a pas de fonte
   d'icônes, et les glyphes de corbeille d'Unicode ne sont pas dessinés partout
   — ⌫ tombait en carré vide sur la moitié des machines. */
function corbeille(){
  var v = svg("svg", { width:13, height:13, viewBox:"0 0 16 16", "aria-hidden":"true",
    fill:"none", stroke:"currentColor", "stroke-width":1.4, "stroke-linecap":"round" });
  v.appendChild(svg("path", { d:"M2.5 4.2h11" }));
  v.appendChild(svg("path", { d:"M6 4.2V2.6h4v1.6" }));
  v.appendChild(svg("path", { d:"M4 4.2l.8 9h6.4l.8-9" }));
  v.appendChild(svg("path", { d:"M6.6 6.6v4.4M9.4 6.6v4.4" }));
  return v;
}

/* Ajouter un niveau se fait LÀ où il apparaîtra : en tête de pile pour un
   étage, au pied pour un sous-sol. Deux segments dans une barre d'outils
   lointaine demandaient de viser un nombre au lieu d'un endroit. */
function addRow(label, hint, fn){
  var d = el("div","mix-add");
  var b = el("button","btn mix-add__b", "+ " + label);
  b.type = "button";
  b.title = hint;
  b.addEventListener("click", function(){
    fn(); selU = null; drawMix(); saveSoon();
  });
  d.appendChild(b);
  return d;
}

function drawStack(){
  while(stackEl.firstChild) stackEl.removeChild(stackEl.firstChild);
  /* Le nombre de niveaux se règle SUR la pile : son dé dit si le Shuffle la
     propose, ou s'il garde celle qu'on a composée. */
  var ph = el("div","mix-pilehd");
  ph.appendChild(el("span","label","Pile"));
  ph.appendChild(el("span","mix-pilehd__n mono", FLOORS.length + " niveau" + (FLOORS.length > 1 ? "x" : "")));
  ph.appendChild(deBtn(dePile, "Nombre de niveaux", function(on){ setDePile(on); drawMix(); saveSoon(); }));
  ph.appendChild(el("span","mix-pilehd__h", dePile
    ? "le Shuffle propose la pile, déduite du site"
    : "le Shuffle garde cette pile ; on l’édite en tête et au pied"));
  stackEl.appendChild(ph);
  stackEl.appendChild(addRow("Ajouter un étage",
    "Un niveau de plus au-dessus du dernier. Rien n\u2019y monte tout seul.",
    addFloorTop));
  /* Le niveau le plus haut en tête, le rez en bas, les sous-sols dessous :
     c'est la convention de coupe, la seule qu'un architecte lise sans
     traduire. */
  /* Les niveaux POSÉS l'un sur l'autre, sans écart : la pile est un bloc. */
  var pile = el("div","mix-pile");
  for(var i = FLOORS.length - 1; i >= 0; i--) pile.appendChild(floorNode(i));
  stackEl.appendChild(pile);
  /* Le sol, pour que la pile se lise comme une coupe et non comme une liste. */
  stackEl.appendChild(el("div","mix-ground"));
  stackEl.appendChild(addRow("Creuser un sous-sol",
    "Réservé au technique, au stockage, au nettoyage et à l\u2019abri PC.",
    addFloorBottom));
  requestAnimationFrame(function(){
    for(var i = 0; i < FLOORS.length; i++){
      var host = stackEl.querySelector('[data-canvas="' + i + '"]');
      if(host) paintFloor(host, i);
    }
  });
}

function floorNode(i){
  var F = FLOORS[i];
  var wrap = el("div","mix-fl");
  wrap.dataset.floor = String(i);
  var net = flNet(i), bati = flBuilt(i), brut = flBrut(i), hors = horsAt(i), plate = F.plate > 0 ? F.plate : 0;
  var over = plate > 0 && brut > plate + 1;
  if(over) wrap.classList.add("is-over");

  if(issFocus && issFocus.fl === i) wrap.classList.add("is-flagged", "is-" + issFocus.sev);

  var bar = el("div","mix-fl__bar");
  bar.appendChild(el("b","mix-fl__n", flName(i)));

  var pl = el("label","mix-fl__plate");
  pl.appendChild(el("span","vh", "Emprise du plateau au " + flName(i).toLowerCase() + ", en m²"));
  var inp = document.createElement("input");
  inp.type = "number"; inp.className = "mono";
  inp.min = String(PLATE_MIN); inp.max = String(PLATE_MAX); inp.step = "50";
  inp.value = String(F.plate);
  inp.dataset.plate = String(i);
  pl.appendChild(inp);
  pl.appendChild(el("span","mix-fl__u","m² de plateau"));
  bar.appendChild(pl);

  /* Utile, circulation, bâti : l'ADDITION en toutes lettres. Le niveau
     n'écrivait que ses deux bouts — « 2'236 m² utiles · 2'727 m² bâtis » — et
     les cinq cents mètres carrés du milieu, qui sont le premier poste du
     projet après les classes, se déduisaient de tête. */
  var meta = el("span","mix-fl__meta mono");
  meta.appendChild(document.createTextNode(
    flCount(i) + " pièces · " + fmt(Math.round(net)) + " m² utiles"));
  meta.appendChild(el("span","mix-fl__circ",
    "+ " + fmt(Math.round(bati - net)) + " m² de circulation"
    + (bati > 0 ? " (" + Math.round((bati - net) / bati * 100) + " %)" : "")));
  meta.appendChild(document.createTextNode(
    " + " + fmt(Math.round(brut - bati)) + " m² de murs = " + fmt(Math.round(brut)) + " m² bruts"));
  if(hors > 0) meta.appendChild(el("span","mix-fl__hors",
    "+ " + fmt(Math.round(hors)) + " m² hors enveloppe"));
  bar.appendChild(meta);

  /* La hauteur n'est pas un réglage : elle est une conséquence du programme
     porté par le niveau, et c'est elle qui donnera sa silhouette au volume. */
  var h = el("span","mix-fl__h mono", dec(flHeight(i)) + " m");
  h.title = "Hauteur de niveau : " + dec(flLibre(i))
    + " m libres + " + dec(RULES.haut.dalle) + " m de dalle";
  bar.appendChild(h);

  bar.appendChild(el("span","spacer"));
  var pct = plate > 0 ? Math.round(brut / plate * 100) : 0;
  var tag = el("span", "mix-fl__pct mono" + (over ? " is-over" : ""), pct + " %");
  tag.title = "Part du plateau occupée, circulation et murs compris";
  bar.appendChild(tag);

  /* Retirer CE niveau, depuis le niveau lui-même. La conséquence est dans le
     libellé accessible et dans l'infobulle : ce qu'il porte repart au bac. */
  if(FLOORS.length > 1){
    var n = floorCost(i);
    var bDel = el("button","btn btn--icon mix-fl__del");
    bDel.type = "button";
    bDel.appendChild(corbeille());
    var quoi = "Retirer le " + flName(i).toLowerCase()
      + (n ? " — ses " + n + " pièce" + (n > 1 ? "s repartent" : " repart") + " au bac" : "");
    bDel.title = quoi;
    bDel.appendChild(el("span","vh", quoi));
    bDel.addEventListener("click", function(){
      if(delFloorAt(i)){ selU = null; openIss = null; issFocus = null; drawMix(); saveSoon(); }
    });
    bar.appendChild(bDel);
  }
  wrap.appendChild(bar);

  var canvas = el("div","mix-fl__canvas");
  canvas.dataset.canvas = String(i);
  wrap.appendChild(canvas);
  return wrap;
}

function paintFloor(host, i){
  while(host.firstChild) host.removeChild(host.firstChild);
  var W = host.clientWidth || 600;
  var bl = onFloor(i);
  /* Deux bandes, et non une. La cour, la piscine et le chauffage à distance
     sont posés au terrain mais ne pèsent pas sur le plateau : mêlés au reste,
     ils repoussaient la ligne de plateau de 1'400 m² et le dessin ne disait
     plus la même chose que le pourcentage écrit à côté. Ils ont leur bande,
     sous un filet, hors du compte. */
  /* La circulation est DESSINÉE, et à l'échelle. Le niveau montrait ses seuls
     locaux et comparait leur surface utile à un plateau lui-même converti en
     utile : deux grandeurs justes, mais aucune des deux n'était celle du
     projet. On voit maintenant le BÂTI — locaux plus circulation — contre le
     plateau tel qu'on l'a saisi. Le pourcentage ne bouge pas d'un point : les
     deux termes étaient déjà divisés par le même (1 − part). */
  var net = flNet(i), hors = horsAt(i), circ = flBuilt(i) - net;
  var plate = FLOORS[i] && FLOORS[i].plate > 0 ? FLOORS[i].plate : Infinity;
  var capH = isFinite(plate) ? plate * AIRE / W : 0;
  var netH = net * AIRE / W, circH = circ * AIRE / W, horsH = hors * AIRE / W;

  if(!bl.length){
    host.style.height = "34px";
    host.appendChild(el("p","mix-empty","niveau vide — glisse une pièce ici"));
    return;
  }

  /* UN RECTANGLE PLEIN : le niveau est un rectangle de sa surface bâtie, à
     l'échelle commune (AIRE px² par m²), divisé en la surface de chaque poste
     — famille par famille, puis poste par poste — et de sa circulation. Ni
     goutte, ni trou, ni vide jusqu'à la ligne de plateau : la pile se lit comme
     un empilement de surfaces. Les cotes d'une pièce (`dimsDe`) restent dites
     sur le bloc : le massing et les Typologies les lisent. */
  function bande(list, rect){
    if(!list.length || rect.h <= 0) return;
    var fl = famList(list);
    squarify(fl.order.map(function(f){
      var s = 0;
      fl.by[f].forEach(function(b){ s += areaOf(b); });
      return { key:f, v:s };
    }), rect).forEach(function(c){
      squarify(fl.by[c.key].map(function(b){ return { key:b.u, v:areaOf(b) }; }), c).forEach(function(r){
        var b = blockOf(r.key);
        if(b) host.appendChild(blockNode(b, Object.assign(r, { d:dimsDe(b.key) })));
      });
    });
  }
  bande(bl.filter(function(b){ return !PMAP[b.key].hors; }), { x:0, y:0, w:W, h:netH });
  var horsL = bl.filter(function(b){ return PMAP[b.key].hors; });
  /* Hachurée, sans couleur de famille — comme sa ligne de légende au volet
     Surfaces, et comme le bloc qu'elle y occupe déjà. */
  if(circH > 0.5){
    var cb = el("div","mix-circband is-hatched");
    cb.style.top = netH.toFixed(1) + "px";
    cb.style.height = circH.toFixed(1) + "px";
    var cd = flCircDe(i);
    cb.setAttribute("data-tip", "Circulation|" + fmt(Math.round(circ)) + " m² à ce niveau — "
      + fmt(Math.round(cd.couloir)) + " de couloirs, " + fmt(Math.round(cd.cages)) + " de cages|"
      + fmt(Math.round(cd.front)) + " m de portes sur des couloirs de " + dec(COULOIR)
      + " m, réglés au cahier des charges");
    if(circH > 13) cb.appendChild(el("span", null, "circulation · "
      + fmt(Math.round(circ)) + " m² · " + Math.round(circ / (net + circ) * 100) + " %"));
    host.appendChild(cb);
  }
  if(!horsL.length) horsH = 0;
  bande(horsL, { x:0, y:netH + circH, w:W, h:horsH });
  host.style.height = Math.round(Math.max(netH + circH + horsH, 34)) + "px";
  if(horsH > 0){
    var sep = el("div","mix-hors");
    sep.style.top = (netH + circH).toFixed(1) + "px";
    sep.appendChild(el("span", null, "hors enveloppe scolaire · "
      + fmt(Math.round(hors)) + " m²"));
    host.appendChild(sep);
  }

  /* Après les blocs : le pavage remplit son rectangle sans laisser un pixel,
     donc tout repère posé avant lui disparaît sous les blocs. Le niveau ne
     s'allonge plus jusqu'au plateau : la ligne ne se dessine que là où le bâti
     le dépasse, avec la bande de dépassement. */
  if(isFinite(plate) && net + circ > plate + 0.5 && netH + circH > capH + 0.5){
    var oz = el("div","mix-over");
    oz.style.top = capH.toFixed(1) + "px";
    oz.style.height = (netH + circH - capH).toFixed(1) + "px";
    host.appendChild(oz);
    if(capH > 6){
      var cl = el("div","mix-cap");
      cl.style.top = capH.toFixed(1) + "px";
      cl.appendChild(el("span", null, "plateau · " + fmt(Math.round(plate)) + " m²"));
      host.appendChild(cl);
    }
  }
}

/* La DIVISION d'un bloc en ses pièces. Dix-huit salles de classe posées d'un
   coup formaient un rectangle muet : on lisait « ×18 » et il fallait un menu
   pour en détacher six. Divisé, le bloc porte ses dix-huit refends, et l'on
   tire hors de lui la pièce qu'on veut ailleurs — la scission est le
   déplacement d'une pièce, elle n'a pas à être un geste de plus.
   Le trait est TIRETÉ et va d'un bord à l'autre : c'est un refend de plan, il
   sépare sans clore. Des rectangles cernés, posés dans le bloc, donnaient à
   lire dix-huit objets rangés là plutôt qu'un poste découpé.
   Rien n'est divisé si une pièce devient trop petite pour être visée, ni pour
   un poste dont le règlement impose les dimensions : il ne se coupe pas. */
var PC_W = 9, PC_H = 7;

/* LES COTES D'UNE PIÈCE DU POSTE : celles qu'on a fixées (`coteDe`, au mixer
   ou aux Typologies), sinon la profondeur que le massing donne à ses bandes,
   sinon la plus carrée. Toujours une proportion qui garde la surface exacte,
   au module (`validDims`). */
function dimsDe(key){
  var u = uOf(key), w = coteDe(key);
  if(w) return Object.assign({ fixe:true }, nearestDims(u, w));
  var hb = bandeMassing();
  return hb ? dimsAProf(u, hb) : squarest(u);
}
/* Les régler : la liste des proportions admissibles, à surface exacte. Le
   choix vaut pour toutes les pièces du poste, et pour les Typologies et le
   massing, qui le lisent. */
function choixDims(key){
  var p = PMAP[key], cur = coteDe(key), s = el("select", "mixblk__dims mono");
  s.setAttribute("aria-label", "Cotes d'une pièce — " + p.n);
  var o0 = el("option", null, "auto · suit le massing"); o0.value = ""; s.appendChild(o0);
  validDims(uOf(key)).forEach(function(d){
    var o = el("option", null, dec(d.w) + " × " + dec(d.h) + " m");
    o.value = String(d.w); o.selected = cur != null && Math.abs(cur - d.w) < 1e-6;
    s.appendChild(o);
  });
  s.addEventListener("change", function(){
    setCote(key, s.value ? parseFloat(s.value) : null);
    drawMix(); saveSoon();
  });
  return s;
}

function pieceGrid(b, r){
  var p = PMAP[b.key];
  if(p.solid || b.q < 2) return null;
  var w = r.w, h = r.h;
  if(w < 3 * PC_W || h < 2 * PC_H) return null;
  /* Le nombre de colonnes se déduit de la forme du rectangle : il n'est pas un
     réglage. On cherche à la fois des pièces carrées ET une trame PLEINE —
     dix-huit salles sur huit colonnes laissaient six cases vides, et la
     dernière rangée semblait inachevée. Un partage exact vaut donc un peu
     d'allongement : d'où le poids donné au reste. */
  var cols = 1, best = Infinity, c, rw, cw, ch, sc;
  for(c = 1; c <= b.q; c++){
    rw = Math.ceil(b.q / c);
    cw = w / c; ch = h / rw;
    if(cw < PC_W || ch < PC_H) continue;
    sc = Math.abs(Math.log(cw / ch)) + 1.2 * (c * rw - b.q) / b.q;
    if(sc < best){ best = sc; cols = c; }
  }
  if(best === Infinity) return null;
  /* Des RANGÉES, chacune haute à proportion de ses pièces : une dernière
     rangée incomplète s'élargit sans laisser de case vide, et chaque pièce
     garde la même surface. */
  var g = el("div","mixblk__pcs"), row = null;
  for(var i = 0; i < b.q; i++){
    if(i % cols === 0){
      row = el("div","mixpc__row");
      row.style.flexGrow = String(Math.min(cols, b.q - i));
      g.appendChild(row);
    }
    var c = el("span","mixpc");
    c.dataset.u = String(b.u);
    c.dataset.pc = "1";
    row.appendChild(c);
  }
  return g;
}

function blockNode(b, r){
  var p = PMAP[b.key], a = areaOf(b);
  var d = el("div","mixblk");
  d.dataset.u = String(b.u);
  d.tabIndex = 0;
  d.style.left = r.x.toFixed(1) + "px";
  d.style.top = r.y.toFixed(1) + "px";
  d.style.width = Math.max(0, r.w - 1).toFixed(1) + "px";
  d.style.height = Math.max(0, r.h - 1).toFixed(1) + "px";
  /* `backgroundColor` et jamais `background` : le raccourci en ligne remet
     `background-image` à none et effacerait la hachure du technique.
     L'aplat reprend l'opacité de la légende (`--fill-op`), comme les rectangles
     SVG des diagrammes du programme : c'est la MÊME couleur, lue pareil. */
  var col = "var(" + FMAP[p.f].c + ")";
  /* LIÉ, le poste est UN bloc : ses pièces vont ensemble, on ne les voit pas
     une à une — c'est le « groupé » du cahier des charges. DÉLIÉ, ses pièces
     sont indépendantes et dessinées SÉPARÉES, côte à côte parce qu'elles sont
     au même niveau, mais chacune avec son cadre — le « détaillé ». */
  var libre = lienLibre(b.key), delie = libre && !estLie(b.key);
  d.style.setProperty("--c", col);
  if(!delie){
    d.style.backgroundColor = "color-mix(in srgb, " + col
      + " calc(var(--fill-op) * 100%), var(--background))";
    d.style.borderColor = col;
  }
  if(p.f === "tec") d.classList.add("is-hatched");
  if(p.est) d.classList.add("is-est");
  if(b.u === selU) d.classList.add("is-sel");
  /* L'écart ouvert dans le contrôle désigne ses coupables : les lire dans la
     liste et devoir ensuite les chercher dans la pile, c'était tout le travail
     laissé à faire. */
  if(issFocus && issFocus.keys.indexOf(b.key) >= 0) d.classList.add("is-flag", "is-" + issFocus.sev);
  if(r.w < TINY_W || r.h < TINY_H) d.classList.add("is-tiny");

  /* Le NOM est la prise du bloc entier, une CELLULE celle d'une pièce : deux
     prises distinctes valent mieux qu'un modificateur à retenir. */
  var lb = el("div","mixblk__lb");
  lb.appendChild(el("b", null, p.n + (b.q > 1 ? " ×" + b.q : "")));
  lb.appendChild(el("span","mixblk__a mono", fmt(Math.round(a)) + " m²"
    + (r.d ? " · " + dec(r.d.w) + " × " + dec(r.d.h) + " m" + (r.d.fixe ? " ●" : "") : "")));
  /* choisi, le bloc offre ses cotes ; un poste dont le règlement fixe les
     dimensions n'en a pas d'autres */
  if(b.u === selU && r.d && !p.solid) lb.appendChild(choixDims(b.key));
  d.appendChild(lb);
  var g = delie ? pieceGrid(b, r) : null;
  if(g){ d.appendChild(g); d.classList.add("has-pcs"); }
  if(delie){
    d.classList.add("is-delie");
    /* Trop petit pour dessiner ses pièces : le bloc reste un bloc, cerné de la
       couleur du poste, et son lien dit qu'il est délié. */
    if(!g){ d.classList.add("is-delie-plein"); d.style.borderColor = col; }
  }
  /* Le lien, SUR le bloc : c'est là que le poste se voit. */
  if(libre && !d.classList.contains("is-tiny") && r.w >= 64 && r.h >= 28){
    var ct = el("div","mixblk__ctl");
    ct.appendChild(lienBtn(b.key, true));
    d.appendChild(ct);
  }
  d.setAttribute("data-tip", p.n + (b.q > 1 ? " ×" + b.q : "")
    + (p.est ? "  (à préciser)" : "") + "|"
    + b.q + " × " + fmt(uOf(b.key)) + " m² = " + fmt(Math.round(a)) + " m²"
    + (r.d ? " · une pièce " + dec(r.d.w) + " × " + dec(r.d.h) + " m" + (r.d.fixe ? ", cote fixée" : ", suit le massing") : "") + "|"
    + FMAP[p.f].name + (p.note ? " · " + p.note : ""));
  d.setAttribute("aria-label", p.n + ", " + b.q + " pièce" + (b.q > 1 ? "s" : "")
    + ", " + fmt(Math.round(a)) + " mètres carrés, "
    + (b.fl === TRAY ? "au bac" : flName(b.fl))
    + ". Flèches haut et bas pour changer de niveau"
    + (delie && b.q > 1 ? ", majuscule pour n’en détacher qu’une pièce" : "")
    + (libre ? ". " + (delie ? "Délié" : "Lié") : ""));
  return d;
}

/* ---------- avertissements ------------------------------------------------ */
/* ---------- le contrôle, et ce qu'on en fait -------------------------------
   Un écart qui ne fait que s'afficher laisse tout le travail à faire : on le
   lisait, et il fallait retrouver soi-même le poste, le niveau et le geste. On
   clique dessus, il propose le geste qui le résoudrait — ou de le laisser tel
   quel, ce qui est une décision de projet et non un oubli. */
function drawIssues(){
  if(!issuesEl) return;
  while(issuesEl.firstChild) issuesEl.removeChild(issuesEl.firstChild);
  var list = dernierCheck;

  var vifs = list.filter(function(x){ return !x.ok; });
  var assumes = list.filter(function(x){ return x.ok; });

  if(!vifs.length){
    issuesEl.appendChild(el("p","mix-ok",
      "Aucun conflit : chaque poste est posé à un niveau que le programme autorise."));
  } else {
    issuesEl.appendChild(issList(vifs, false));
  }
  if(assumes.length){
    var ah = el("div","mix-issues__hd mix-issues__hd--soft");
    ah.appendChild(el("h3","label", "Laissés tels quels"));
    ah.appendChild(el("i","chip chip--soft", String(assumes.length)));
    var bAll = el("button","btn btn--quiet mix-reprendre","Tout reprendre");
    bAll.type = "button";
    bAll.addEventListener("click", function(){
      /* Les SIENS seulement : la liste des écarts assumés est commune au mixer
         et au massing — « je laisse comme ça » est une seule décision de projet
         et n'a pas à s'enregistrer à deux endroits —, mais reprendre les écarts
         d'un onglet ne doit pas défaire ceux de l'autre. */
      assumes.forEach(function(x){ unaccept(x.code); });
      openIss = null; issFocus = null; drawMix(); saveSoon();
    });
    ah.appendChild(bAll);
    issuesEl.appendChild(ah);
    issuesEl.appendChild(issList(assumes, true));
  }
}

function issList(list, assume){
  var ul = el("ul","mix-list");
  list.forEach(function(w){
    var li = el("li", (assume ? "ok" : (w.sev === "e" ? "e" : "w")) + (openIss === w.code ? " is-open" : ""));

    var bt = el("button","mix-iss");
    bt.type = "button";
    bt.setAttribute("aria-expanded", String(openIss === w.code));
    bt.appendChild(el("i", null, assume ? "assumé" : (w.sev === "e" ? "conflit" : "à vérifier")));
    var t = el("div");
    t.appendChild(document.createTextNode(w.msg));
    var ref = " — " + (/^\d/.test(w.ref) ? "art. " : "") + w.ref;
    if(w.ex) ref += " · " + w.ex + (w.n > 1 ? " et " + (w.n - 1) + " autre" + (w.n > 2 ? "s" : "") : "");
    t.appendChild(el("span", null, ref));
    bt.appendChild(t);
    bt.addEventListener("click", function(){
      var ouvre = openIss !== w.code;
      openIss = ouvre ? w.code : null;
      issFocus = ouvre ? { fl: w.fl, keys: w.keys || [], sev: w.sev } : null;
      drawIssues();
      versContraintes(issuesEl);
      drawStack();
      var again = issuesEl.querySelector("li.is-open .mix-iss");
      if(again) again.focus({ preventScroll:true });
      /* Le niveau visé remonte sous les yeux : il peut être à deux écrans. */
      if(ouvre){
        var cible = issuesEl.ownerDocument.querySelector(
          ".mix-fl.is-flagged, .mixblk.is-flag");
        if(cible) cible.scrollIntoView({ block:"nearest", behavior:"smooth" });
      }
    });
    li.appendChild(bt);

    if(openIss === w.code) li.appendChild(issPanel(w, assume));
    ul.appendChild(li);
  });
  return ul;
}

function issPanel(w, assume){
  var box = el("div","mix-iss__p");
  if(w.fl != null && FLOORS[w.fl]){
    box.appendChild(el("p","mix-iss__w", "Niveau concerné : " + flName(w.fl).toLowerCase() + "."));
  }
  if(!w.fixes.length){
    box.appendChild(el("p","mix-iss__w", w.note
      || "Aucun geste du mixer ne le résout : cela se joue plus loin, au dessin."));
  }
  w.fixes.forEach(function(f){
    var b = el("button","btn mix-act", f.label);
    b.type = "button";
    if(f.hint) b.appendChild(el("span","mix-why", f.hint));
    b.addEventListener("click", function(){
      if(f.run() === false) return;
      openIss = null; issFocus = null; selU = null;
      drawMix(); saveSoon();
    });
    box.appendChild(b);
  });

  /* « Laisser comme ça » n'efface rien : l'écart change de rang, garde sa place
     dans la liste, et se reprend d'un clic. */
  var bo = el("button","btn btn--quiet mix-act", assume ? "Reprendre cet écart" : "Laisser comme ça");
  bo.type = "button";
  bo.appendChild(el("span","mix-why", assume
    ? "il revient au contrôle et recompte dans le verdict"
    : "il quitte le verdict et passe dans « laissés tels quels »"));
  bo.addEventListener("click", function(){
    if(assume) unaccept(w.code); else accept(w.code);
    openIss = null; issFocus = null;
    drawMix(); saveSoon();
  });
  box.appendChild(bo);
  return box;
}

/* ---------- le bac -------------------------------------------------------- */
function drawTray(){
  if(!trayEl) return;
  while(trayEl.firstChild) trayEl.removeChild(trayEl.firstChild);
  var bl = trayBlocks();

  if(!bl.length){
    trayEl.appendChild(el("p","mix-ok","Tout le programme est posé."));
  } else {
    var by = {}, order = [];
    bl.forEach(function(b){
      var c = PMAP[b.key].chap;
      if(!by[c]){ by[c] = []; order.push(c); }
      by[c].push(b);
    });
    order.forEach(function(c){
      var g = el("div","mix-cat");
      var s = 0;
      by[c].forEach(function(b){ s += areaOf(b); });
      var ch = el("div","mix-cat__h");
      ch.appendChild(el("span", null, c));
      ch.appendChild(el("span","mono", fmt(Math.round(s)) + " m²"));
      g.appendChild(ch);
      var box = el("div","mix-chips");
      by[c].sort(function(a, b){ return areaOf(b) - areaOf(a); }).forEach(function(b){
        var p = PMAP[b.key];
        var k = el("button","mixchip");
        k.type = "button";
        k.dataset.u = String(b.u);
        var sw = el("i","sw");
        sw.style.backgroundColor = "var(" + FMAP[p.f].c + ")";
        if(p.f === "tec") sw.classList.add("is-hatched");
        k.appendChild(sw);
        k.appendChild(document.createTextNode(p.n + (b.q > 1 ? " ×" + b.q : "")));
        k.appendChild(el("span","mono", fmt(Math.round(areaOf(b))) + " m²"));
        box.appendChild(k);
      });
      g.appendChild(box);
      trayEl.appendChild(g);
    });
  }

  /* Ce qui n'est pas à poser, et pourquoi — sinon le compte ne tombe pas et on
     cherche une pièce qui n'a jamais eu à exister. */
  var dedans = posesDedans();
  if(dedans.length){
    var note = el("p","mix-tray__note");
    note.appendChild(el("b", null, "Hors répartition — "));
    note.appendChild(document.createTextNode(dedans.map(function(p){
      return p.n + " (" + fmt(aOf(p.key, qOf(p.key))) + " m²)";
    }).join(" · ")));
    note.appendChild(el("span", null,
      "déjà compris dans l’abri PC, que le règlement convertit depuis ces locaux."));
    trayEl.appendChild(note);
  }
}

/* Ce qu'un déplacement emmènerait en plus — pour le dire avant. Un bloc
   entier emmène ce que ses adjacences actives lui tiennent, au même niveau que
   lui ; une pièce seule ne dérange rien. */
function combien(u, seul){
  var b = blockOf(u);
  if(!b || seul) return 0;
  var n = 0;
  grappeBlocs(u).forEach(function(x){ if(x.u !== u) n += x.q; });
  return n;
}

/* Où va un bloc quand on le pousse d'un cran. Le bac est le cran d'en
   dessous du rez : la pile et le bac sont une seule échelle. */
function voisin(fl, dir){
  var t = fl + dir;
  if(t < TRAY || t >= FLOORS.length) return null;
  return t;
}
/* Retrouver le bloc après un déplacement : `fuse` peut l'avoir absorbé dans
   celui qui était déjà là, et le clavier perdrait son point d'appui. */
function refocus(key, fl){
  var n = null;
  (fl === TRAY ? trayBlocks() : onFloor(fl)).forEach(function(x){
    if(n || x.key !== key) return;
    n = document.querySelector('[data-u="' + x.u + '"]');
  });
  if(n) n.focus();
}
/* Déplacer au clavier, une pièce ou le bloc entier : le glisser n'est jamais
   le seul chemin. Maj détache UNE pièce — c'est la scission, au clavier. */
function pousser(u, fl, unePiece){
  var b = blockOf(u);
  if(!b || fl === null || fl === b.fl) return;
  var key = b.key, cu = u;
  /* Une pièce seule ne se détache que d'un poste délié : un poste lié part
     entier, c'est ce que « lié » veut dire. */
  if(unePiece && !estLie(key)){
    if(b.q > 1){ var nb = split(u, 1); if(nb) cu = nb.u; }
    move(cu, fl);
  } else moveGroupe(cu, fl);
  drawMix(); saveSoon();
  refocus(key, fl);
}

/* ---------- gestes -------------------------------------------------------- */
function wireMix(){
  wired = true;

  document.addEventListener("change", function(e){
    var t = e.target;
    if(!t || !t.dataset || t.dataset.plate === undefined) return;
    var i = parseInt(t.dataset.plate, 10);
    var v = parseFloat(String(t.value).replace(",", "."));
    if(!setPlate(i, v)){ t.value = String(FLOORS[i] ? FLOORS[i].plate : ""); return; }
    drawMix(); saveSoon();
  });

  document.addEventListener("pointerdown", function(e){
    var node = e.target.closest ? e.target.closest(".mixblk,.mixchip") : null;
    if(!node || e.button !== 0) return;
    /* Le lien et le dé posés sur un bloc sont des boutons, pas des prises. */
    if(e.target.closest("button:not(.mixchip),select")) return;
    /* Une cellule tirée n'emmène qu'elle : c'est là que se fait la scission. */
    var pc = e.target.closest ? e.target.closest(".mixpc") : null;
    drag = { u: parseInt(node.dataset.u, 10), pc: !!pc,
             x0: e.clientX, y0: e.clientY, live:false, el:node };
    try{ node.setPointerCapture(e.pointerId); }catch(_){}
  });
  document.addEventListener("pointermove", function(e){
    if(!drag) return;
    if(!drag.live){
      /* Cinq pixels : en deçà c'est un clic, au-delà c'est un glisser. Sans ce
         seuil, un clic net devient un déplacement d'un pixel. */
      if(Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 5) return;
      drag.live = true;
      var b = blockOf(drag.u);
      if(b){
        while(ghostEl.firstChild) ghostEl.removeChild(ghostEl.firstChild);
        var seul = drag.pc && b.q > 1 && !estLie(b.key);
        var suite = combien(drag.u, drag.pc);
        ghostEl.appendChild(document.createTextNode(
          PMAP[b.key].n + (seul ? " ×1" : (b.q > 1 ? " ×" + b.q : ""))
          + " · " + fmt(Math.round(seul ? uOf(b.key) : areaOf(b))) + " m²"
          + (suite ? "  + " + suite + " liée" + (suite > 1 ? "s" : "") : "")));
      }
      ghostEl.hidden = false;
      drag.el.classList.add("is-dragging");
    }
    ghostEl.style.left = (e.clientX + 12) + "px";
    ghostEl.style.top = (e.clientY + 12) + "px";
    var over = document.elementFromPoint(e.clientX, e.clientY);
    var fl = over && over.closest ? over.closest(".mix-fl") : null;
    var tr = over && over.closest ? over.closest(".mix-tray") : null;
    Array.prototype.forEach.call(document.querySelectorAll(".is-drop"),
      function(n){ n.classList.remove("is-drop"); });
    if(fl) fl.classList.add("is-drop");
    else if(tr) tr.classList.add("is-drop");
  });
  document.addEventListener("pointerup", function(e){
    if(!drag) return;
    var live = drag.live, u = drag.u, node = drag.el, pc = drag.pc;
    node.classList.remove("is-dragging");
    ghostEl.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll(".is-drop"),
      function(n){ n.classList.remove("is-drop"); });
    drag = null;
    /* Un clic net ne déplace rien : il désigne, et le clavier prend la suite. */
    if(!live){
      selU = (selU === u ? null : u);
      drawMix();
      var again = document.querySelector('[data-u="' + u + '"]');
      if(again) again.focus();
      return;
    }
    var over = document.elementFromPoint(e.clientX, e.clientY);
    var fl = over && over.closest ? over.closest(".mix-fl") : null;
    var tr = over && over.closest ? over.closest(".mix-tray") : null;
    if(fl) pousser(u, parseInt(fl.dataset.floor, 10), pc);
    else if(tr) pousser(u, TRAY, pc);
  });

  /* Le glisser au clavier : les flèches montent et descendent le bloc d'un
     cran — le bac étant le cran sous le rez —, Maj n'en emmène qu'une pièce,
     Suppr le renvoie au bac. Le menu qu'ils remplacent demandait de choisir
     un niveau dans une liste alors que la pile était là, sous les yeux. */
  document.addEventListener("keydown", function(e){
    var node = e.target.closest ? e.target.closest(".mixblk,.mixchip") : null;
    if(!node || e.target.closest("button:not(.mixchip)")) return;
    var u = parseInt(node.dataset.u, 10), b = blockOf(u);
    if(!b) return;
    var cible;
    if(e.key === "ArrowUp") cible = voisin(b.fl, 1);
    else if(e.key === "ArrowDown") cible = voisin(b.fl, -1);
    else if(e.key === "Delete" || e.key === "Backspace") cible = TRAY;
    else return;
    e.preventDefault();
    pousser(u, cible === undefined ? null : cible, e.shiftKey);
  });
}

/* Le redimensionnement change la largeur du canevas, donc le pavage. */
export function resizeMix(){
  if(!stackEl) return;
  for(var i = 0; i < FLOORS.length; i++){
    var host = stackEl.querySelector('[data-canvas="' + i + '"]');
    if(host) paintFloor(host, i);
  }
}

/* ---------- le volet « Contraintes » ----------------------------------------
   Le mixer FAIT une répartition ; ce volet dit ce qui la gouverne, et le règle.
   C'est la page Paramètres & contraintes filtrée sur le mixer (`render.js` la
   pose) : un seul dessin des lignes, où qu'on les lise. Le mixer lui donne
   deux choses — le geste qui rejoue, et les piles que le site admet.

   La navigation est INJECTÉE (`setMixNav`) plutôt qu'importée : `render.js`
   importe déjà ce module, et l'importer en retour ferait un cycle. C'est le
   même procédé que `setAreaHandler` dans la légende. */
var mixNav = null;
export function setMixNav(f){ mixNav = f; }

/* Le tirage du mixer, sans rien dessiner : le Shuffle d'ici, celui du volet
   Contraintes, et le mini-shuffle des autres onglets (`views/shuffles.js`). */
export function mixTirer(){
  if(fige("mixer")) return;
  seed(null);
  repartir({ alea: true, etages: dePile });
  selU = null; openIss = null; issFocus = null;
  saveSoon();
}
export function mixRejouer(){
  mixTirer();
  /* On revient sur la répartition : régler une ligne sans voir ce qu'elle
     change, c'est régler à l'aveugle. */
  if(mixNav) mixNav("repartition");
}

/* Les piles que le site admet. Le mixer ne tire pas un nombre d'étages : il
   construit la liste des piles admissibles — le CADRE : emprise d'un plateau,
   étages au plus, sous-sol — et le LEVIER en prend une. La montrer, c'est
   montrer d'où vient la pile qu'on a sous les yeux. */
export function mixPiles(){
  var s = el("section", "pr-piles");
  s.appendChild(el("h4", "label", "Les piles que ce site admet"));
  s.appendChild(el("p", "pr-note", "Déduites de l'aire posable, de la part qu'un plateau peut en "
    + "prendre et de ce que le règlement cloue au rez. Le levier « nombre de niveaux » en tire une, "
    + "l'orientation « pile compacte » préférant les plus basses."));
  var t = el("table", "pr-piles__t");
  var hr = el("tr");
  ["Pile", "Plateau du rez", "Plateau d'étage", "Emprise admise"].forEach(function(x){
    var th = el("th", null, x); th.scope = "col"; hr.appendChild(th);
  });
  t.appendChild(hr);
  pilesAdmissibles().forEach(function(P){
    var tr = el("tr");
    tr.appendChild(el("td", null, (P.sous ? P.sous + " sous-sol · " : "")
      + "rez" + (P.up ? " + " + P.up + " étage" + (P.up > 1 ? "s" : "") : " seul")
      + (P.serre ? " — à l'étroit" : "")));
    tr.appendChild(el("td", "mono n", fmt(P.plate) + " m²"));
    tr.appendChild(el("td", "mono n", P.plateUp ? fmt(P.plateUp) + " m²" : "—"));
    tr.appendChild(el("td", "mono n", fmt(P.emprise) + " m²"));
    t.appendChild(tr);
  });
  s.appendChild(t);
  return s;
}
