import { dim, el, fmt, r2 } from "../core/format.js";
import { MINSIDE, S, nearestDims, squarest, validDims } from "../core/geometry.js";
import { FMAP } from "../core/model.js";
import { view } from "../core/viewstate.js";
import { FAM } from "../data/families.js";
import { groupOf, itemOf, markSiblings, setPosteArea, syncOn, syncSiblings, toggleSync } from "./areas.js";
import { shuffleFloors, spreadFloors } from "./distribute.js";
import { FLOORS, OV, TRAY, TRAYR, buildFloorBar, checkManualDone, curFl, drawNiv, drawPlates, flLvRange, flRange, flShort, floorAt, layoutPlates, lvName, markProblems, mountFloorBar, mountNiv, mountPlateLayer, ovOff, packTray, pullPartners, refloor, setCurFloor, setFloor, setFloorOf, setOverview, toTray, trayRooms, wpos } from "./levels.js";
import { PART, TOUCH, drawLinks, mountLinkCount, mountLinkLayer, setStray, toggleLinks } from "./links.js";
import { drawPlans, mountPlans } from "./plans.js";
import { menu } from "../views/menu.js";
import { PLINK, RMAP, ROOMS, defaultLayout } from "./rooms.js";
import { saveSoon } from "./store.js";

export var layout = defaultLayout(), sel = null, undoStack = [], btnRot = null, btnUndo = null;
export var tx = 0, ty = 0, z = 1, planNode = null, vp, world, propsEl, listEl, readout, saveChip;
export var elOf = {};
export var asidePanes = null;

/* Bascule de volet du panneau latéral. Sélectionner une pièce amène
   automatiquement « Propriétés » : le panneau ne flotte plus au-dessus du plan,
   il faut donc qu'il se montre de lui-même quand il a quelque chose à dire. */
export function showPane(id){
  if(!asidePanes) return;
  asidePanes.forEach(function(pane){
    var on = pane.id === id;
    pane.node.hidden = !on;
    pane.btn.setAttribute("aria-selected", String(on));
    pane.btn.tabIndex = on ? 0 : -1;
  });
}

export function clone(o){ var c = {}; for(var k in o) c[k] = { x:o[k].x, y:o[k].y, w:o[k].w, h:o[k].h }; return c; }

/* ---------- aide du plan ----------
   Remplace deux pavés de 6'159 signes qui encadraient le canevas : 373 mots
   entre le titre et le premier bouton, 704 mots en dessous, le second répétant
   largement le premier. Rien n'est perdu — ce sont les règles du concours et du
   plan, la vraie matière de l'outil — mais elles deviennent consultables :
   quatre sections nommées et une table de raccourcis, au lieu d'un bloc de
   prose séparé par des points médians. */
function helpBlock(title, rows){
  var sec = el("section","help__sec");
  sec.appendChild(el("h4","label", title));
  var dl = el("dl","help__dl");
  rows.forEach(function(r){
    dl.appendChild(el("dt", null, r[0]));
    dl.appendChild(el("dd", null, r[1]));
  });
  sec.appendChild(dl);
  return sec;
}

function planHelp(){
  var d = el("details","disclose plan-help");
  d.appendChild(el("summary", null, "Comment ce plan fonctionne — règles, gestes et raccourcis"));
  var grid = el("div","help__grid");

  grid.appendChild(helpBlock("Poser les pièces", [
    ["Surface constante",
     "En tirant une poignée tu changes les proportions d’une pièce, jamais sa surface : largeur et hauteur restent des multiples de 0,5 m, et seules les paires qui donnent exactement les m² du programme sont proposées."],
    ["Dimensions imposées",
     "La salle de sport double et le bassin de la piscine ont des dimensions fixées par le règlement : ils ne sont pas déformables."],
    ["Cloisons 10 cm",
     "Toutes les pièces sont séparées par exactement 10 cm, l’épaisseur d’une cloison. Tant que l’aide est active, une pièce déplacée ne peut se poser qu’accolée à une autre, à cette distance, en partageant au moins 50 cm de mur, et alignée sur elle — bords à fleur ou axes confondus. Aucune autre position n’est atteignable ; désactive-la pour placer librement."],
    ["Postes solidaires",
     "Les postes en plusieurs exemplaires restent identiques : redimensionner une salle de classe redimensionne les dix-huit."],
    ["Adjacences",
     "Les traits rouges sont les proximités demandées par le programme — dont le vestiaire posé devant l’entrée de chacune des dix-huit classes. Ils pâlissent dès que les deux pièces se touchent, et affichent sinon la distance qui reste à rattraper."]
  ]));

  grid.appendChild(helpBlock("Les niveaux", [
    ["Une feuille par niveau",
     "Chaque pièce porte un niveau et la coupe n’en montre qu’un à la fois ; celui du dessous reste visible en pointillé pour caler les superpositions."],
    ["Tous les niveaux empilés",
     "Les niveaux deviennent des planches en lignes, le plus haut en tête et le rez en bas, comme les plans d’un dossier. Les lignes partagent leur axe est-ouest : une pièce lue à la même abscisse d’une ligne à l’autre est bien celle qui se superpose, et la faire changer d’étage revient à la glisser d’une ligne à l’autre. La contrainte de 10 cm et les alignements continuent de ne comparer que des pièces d’un même étage."],
    ["Ce que le règlement refuse",
     "Une pièce posée à un niveau interdit est cerclée de rouge (conflit) ou d’ocre (à vérifier), et une adjacence dont les deux pièces ne sont plus au même étage est tracée en rouge tireté, avec l’étiquette « lien coupé »."],
    ["Sous-sol et nappe phréatique",
     "Seuls les locaux techniques, de stockage et de nettoyage y sont admis, plus l’abri PC que le règlement y autorise expressément ; toute autre pièce descendue là est signalée, faute de lumière naturelle. Un sous-sol occupé rappelle la nappe relevée à 462,25 m : la marge sous le terrain naturel va de 1,0 m à l’ouest à 4,5 m à l’est, donc une excavation n’est tenable qu’au tiers est du périmètre."],
    ["Sanitaires",
     "Tout niveau occupé doit avoir ses WC. « Répartir » et « Proposer un projet » distribuent les WC garçons et filles et les vestiaires de classe au prorata des classes portées par chaque étage, avec au moins un WC de chaque genre par niveau. Un niveau resté sans WC est signalé dans la coupe et dans l’onglet Contrôle. Un niveau purement technique n’appelle pas de sanitaires."]
  ]));

  grid.appendChild(helpBlock("Reposer tout", [
    ["Proposer un projet",
     "Propose un projet entier : la répartition sur les étages est tirée au sort, chapitre par chapitre, dans le respect des règles de niveau et de l’emprise ; puis chaque niveau est agencé, les pièces groupées par chapitre, toutes les adjacences satisfaites, chaque pièce séparée de sa voisine par une cloison de 10 cm. Relance autant que tu veux : Maj+clic garde la répartition des étages en place, Ctrl+Z revient en arrière."],
    ["Ranger",
     "Remet tout en bandes ordonnées, par chapitre du règlement ou par famille d’usage, en gardant les grappes d’adjacence soudées. Attention : cela remet aussi toutes les proportions au plus carré."],
    ["Répartir sur les niveaux",
     "Distribue tout le programme : ce que le règlement cloue au terrain reste au rez, le reste remplit les niveaux dans l’ordre des chapitres jusqu’à équilibrer les surfaces."],
    ["Vider le plan",
     "Verse tout le programme dans le bac « À placer ». Les pièces s’y reposent ensuite une à une, et une pièce sortie du bac entraîne avec elle toutes celles que le programme lui lie et qui sont encore au bac : poser la salle de sport amène sa scène, son rangement et l’abri PC ; poser le réfectoire amène la cuisine, l’économat et les salles d’activité ; poser une classe amène son vestiaire. Les pièces déjà posées ailleurs ne bougent pas, et une pièce au bac n’entre dans aucun bilan : ses adjacences sont dites en attente plutôt que coupées."],
    ["Plans mémorisés",
     "Tout agencement posé à la main est gardé de lui-même dès que la dernière pièce quitte le bac, sous la date et la composition des niveaux. « Mémoriser » en garde un à tout moment ; « Rappeler » le repose tel quel — niveaux, cotes, positions et emprise compris — après n’importe quelle proposition."]
  ]));

  /* Sept raccourcis clavier et cinq gestes n'existaient que noyés dans le pavé
     de 4'057 signes sous le canevas. Une table les rend consultables. */
  var sec = el("section","help__sec");
  sec.appendChild(el("h4","label","Gestes et raccourcis"));
  var t = el("table","help__keys");
  var tb = el("tbody");
  [["glisser une pièce", "la déplacer"],
   ["glisser une poignée", "changer ses proportions, à surface constante"],
   ["glisser le fond", "se déplacer dans le plan"],
   ["molette", "zoomer"],
   ["<kbd>R</kbd>", "pivoter la pièce sélectionnée"],
   ["<kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd>", "déplacer de 10 cm — avec <kbd>Maj</kbd>, de 1 m"],
   ["<kbd>⇞</kbd> <kbd>⇟</kbd>", "monter ou descendre la pièce d’un niveau"],
   ["<kbd>Ctrl</kbd>+<kbd>Z</kbd>", "annuler"],
   ["<kbd>Échap</kbd>", "désélectionner"]
  ].forEach(function(r){
    var tr = el("tr");
    var th = el("th"); th.scope = "row"; th.innerHTML = r[0];
    var td = el("td"); td.innerHTML = r[1];
    tr.appendChild(th); tr.appendChild(td);
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  sec.appendChild(t);
  grid.appendChild(sec);

  d.appendChild(grid);
  return d;
}

/* Le panneau du plan est construit une fois puis réutilisé. */
export function planPanel(){
  if(!planNode) planNode = buildPlan();
  return planNode;
}

function buildPlan(){
  var p = el("section","panel plan-full");

  /* --- titre ---------------------------------------------------------------
     « Plan — implantation libre » contredisait le bouton « Contrainte 10 cm »,
     actif par défaut trente lignes plus bas. L'onglet et le titre portent
     désormais le même mot. */
  var head = el("div","tool-head");
  head.appendChild(el("h1", null, "Plan"));
  head.appendChild(el("p","tool-sub", "Les " + ROOMS.length + " pièces du programme, à l’échelle."));
  var posed = ROOMS.reduce(function(t, r){ return t + r.a; }, 0);
  var posEst = ROOMS.reduce(function(t, r){ return t + (r.est ? r.a : 0); }, 0);
  head.appendChild(el("span","pct mono",
    fmt(posed) + " m² d’emprise, dont " + fmt(posEst) + " à préciser"));
  p.appendChild(head);

  /* --- rail de commandes --------------------------------------------------
     Onze contrôles d'intentions incompatibles étaient alignés au même poids,
     et le plus proéminent — seul fond encre plein de la barre — déclenchait un
     tirage au sort qui jetait l'implantation en cours. Il reste ici ce qu'on
     touche à chaque minute ; le reste est rangé par intention dans deux menus. */
  var tb = el("div","plan-rail");

  var zs = el("div","btn-group");
  var bMinus = el("button","btn btn--icon", "−"); bMinus.type = "button"; bMinus.title = "Dézoomer";
  var bFit   = el("button","btn", "Tout voir");        bFit.type = "button";
  var bPlus  = el("button","btn btn--icon", "+");      bPlus.type = "button"; bPlus.title = "Zoomer";
  zs.appendChild(bMinus); zs.appendChild(bFit); zs.appendChild(bPlus);
  tb.appendChild(zs);

  var bUndo = el("button","btn","Annuler"); bUndo.type = "button"; bUndo.disabled = true;
  bUndo.title = "Annuler la dernière action (Ctrl+Z)";
  tb.appendChild(bUndo);

  /* Ces quatre-là ne sont plus dans la barre mais doivent rester des éléments
     réels : wire() leur attache les gestes, et deux d'entre eux changent d'état. */
  var bSnap = el("button","tbtn lock","Cloisons 10 cm"); bSnap.type = "button";
  bSnap.setAttribute("aria-pressed","true");
  var bRot   = el("button","tbtn","Pivoter 90°"); bRot.type = "button"; bRot.disabled = true;
  var bReset = el("button","tbtn","Repartir de l’agencement initial"); bReset.type = "button";
  var bLink  = el("button","tbtn","Afficher les adjacences"); bLink.type = "button";
  bLink.setAttribute("aria-pressed","true");
  var bSync  = el("button","tbtn","Postes solidaires"); bSync.type = "button";
  bSync.setAttribute("aria-pressed","true");
  btnRot = bRot; btnUndo = bUndo;

  /* AGENCER — tout ce qui repose les pièces, donc tout ce qui peut écraser le
     travail en cours. Chaque entrée dit sa conséquence : « Manuel » vidait
     113 pièces dans un bac sans que son libellé l'annonce, et « Ranger »
     réécrit les proportions calées à la main. */
  tb.appendChild(menu("Agencer", function(){ return [
    { label:"Proposer un projet",
      hint:"repose tout : niveaux tirés au sort, chapitres groupés, adjacences satisfaites. Maj+clic garde tes étages",
      on:function(e){ shuffleLayout(e.shiftKey); } },
    { sep:true },
    { label:"Ranger par chapitre", hint:"remet les proportions au plus carré",
      on:function(){ arrange("ch"); } },
    { label:"Ranger par famille", hint:"remet les proportions au plus carré",
      on:function(){ arrange("f"); } },
    { label:"Répartir sur les niveaux", hint:"réagence tout",
      on:function(){ spreadFloors(); } },
    { sep:true },
    { label:"Vider le plan", danger:true,
      hint:"les " + ROOMS.length + " pièces retournent dans « À placer ». Ctrl+Z les ramène",
      on:function(){ toTray(); } },
    { label:"Repartir de l’agencement initial", danger:true,
      hint:"annule toutes tes positions", on:function(){ bReset.click(); } }
  ]; }, { title:"Reposer les pièces" }));

  /* AFFICHAGE — ce qui ne touche pas au projet, seulement à ce qu'on en voit,
     plus les deux aides au placement. Les libellés sont FIXES : deux boutons
     changeaient de texte au clic, et « Contrainte levée » pouvait se lire
     « elle est levée » comme « lever la contrainte ». */
  tb.appendChild(menu("Affichage", function(){ return [
    { label:"Tous les niveaux empilés", pressed:OV,
      hint:"le plus haut en tête, le rez en bas ; glisser une pièce d’une planche à l’autre la change de niveau",
      on:function(){ setOverview(!OV); } },
    { sep:true },
    { label:"Afficher les adjacences", pressed:bLink.getAttribute("aria-pressed") === "true",
      hint:"les liens que le règlement demande", on:function(){ bLink.click(); } },
    { sep:true },
    { head:"Aide au placement" },
    { label:"Cloisons 10 cm", pressed:snapOn,
      hint:"une pièce déplacée ne se pose qu’accolée à une autre, à 10 cm et alignée sur elle",
      on:function(){ bSnap.click(); } },
    { label:"Postes solidaires", pressed:syncOn,
      hint:"redimensionner une classe redimensionne les dix-huit",
      on:function(){ bSync.click(); } }
  ]; }, { title:"Ce qui est montré" }));

  tb.appendChild(el("span","spacer"));
  tb.appendChild(mountLinkCount());
  saveChip = el("span","savechip","");
  tb.appendChild(saveChip);

  bLink.addEventListener("click", function(){
    bLink.setAttribute("aria-pressed", String(toggleLinks()));
  });
  bSync.addEventListener("click", function(){
    var on = toggleSync();
    bSync.setAttribute("aria-pressed", String(on));   /* le libellé ne bouge plus */
    markSiblings();
    if(sel) drawProps();
  });
  p.appendChild(tb);

  /* --- trois colonnes : la coupe, le canevas, le panneau ------------------- */
  var body = el("div","plan-body");

  body.appendChild(mountFloorBar());

  vp = el("div","viewport");
  world = el("div","world");
  world.appendChild(mountPlateLayer());
  world.appendChild(mountLinkLayer());
  vp.appendChild(world);
  readout = el("div","readout"); readout.hidden = true;
  vp.appendChild(readout);
  body.appendChild(vp);

  /* Le panneau latéral absorbe les quatre blocs qui étaient éparpillés au-dessus,
     dedans et en dessous du canevas. Les propriétés flottaient AU-DESSUS du plan,
     recouvrant le quart droit de ce qu'elles décrivent ; le contrôle réglementaire
     était sous le canevas, donc jamais visible pendant qu'on édite. */
  var aside = el("aside","plan-aside");
  listEl  = el("div","roomlist");
  propsEl = el("div","props");
  var nivHost   = mountNiv();
  var plansHost = mountPlans();

  var PANES = [
    { id:"pieces", label:"Pièces",     node:listEl },
    { id:"props",  label:"Propriétés", node:propsEl },
    { id:"niv",    label:"Contrôle",   node:nivHost },
    { id:"plans",  label:"Plans",      node:plansHost }
  ];
  var tabsEl = el("div","btn-group plan-aside__tabs");
  tabsEl.setAttribute("role","tablist");
  tabsEl.setAttribute("aria-label","Panneau du plan");
  PANES.forEach(function(pane, i){
    var b = el("button","btn", pane.label);
    b.type = "button";
    b.setAttribute("role","tab");
    b.setAttribute("aria-selected", String(i === 0));
    b.tabIndex = i === 0 ? 0 : -1;
    pane.btn = b;
    pane.node.classList.add("plan-aside__pane");
    pane.node.hidden = i !== 0;
    b.addEventListener("click", function(){ showPane(pane.id); });
    tabsEl.appendChild(b);
  });
  asidePanes = PANES;
  aside.appendChild(tabsEl);
  PANES.forEach(function(pane){ aside.appendChild(pane.node); });
  body.appendChild(aside);

  p.appendChild(body);

  /* --- comment ça marche --------------------------------------------------
     Deux pavés de 6'159 signes encadraient le canevas — 373 mots entre le titre
     et le premier bouton, 704 mots en dessous, le second répétant le premier.
     Tout est conservé, mais structuré et replié : les règles du plan sont la
     vraie intelligence de cet outil, elles méritaient mieux qu'un bloc de prose. */
  p.appendChild(planHelp());

  ROOMS.forEach(function(r){
    var d = el("div","room");
    d.dataset.id = r.id;
    d.style.setProperty("--c", "var(" + FMAP[r.f].c + ")");
    d.style.borderColor = "var(" + FMAP[r.f].c + ")";
    if(r.split){ d.appendChild(el("i","split")); }
    if(r.inset){
      var ins = el("i","inset");
      ins.appendChild(el("span", null, r.inset.label));
      d.appendChild(ins);
    }
    d.appendChild(el("span","rn", r.n));
    d.appendChild(el("span","ra", fmt(r.a) + " m²"));
    if(r.est){ d.classList.add("est"); }
    if(r.fix){ d.classList.add("fix"); }
    else {
      ["nw","n","ne","e","se","s","sw","w"].forEach(function(dir){
        var h = el("i","h " + dir); h.dataset.dir = dir; d.appendChild(h);
      });
    }
    world.appendChild(d);
    elOf[r.id] = d;
  });

  buildList();
  buildFloorBar();
  drawNiv();
  drawPlans();
  markProblems();
  wire(bMinus, bFit, bPlus, bSnap, bRot, bUndo, bReset);
  applyAll();
  return p;
}

export var listQuery = "";

/* La liste était un registre plat de 113 boutons dans 206 px, sans recherche,
   sans repli, dont dix-huit portaient le même nom. On ne pouvait pas y trouver
   une pièce : on la parcourait. Elle gagne un champ de recherche et des familles
   repliables, et garde exactement le même comportement au clic. */
export function buildList(){
  if(!listEl) return;
  while(listEl.firstChild) listEl.removeChild(listEl.firstChild);

  var search = el("div","roomlist__search");
  var lab = el("label","vh","Chercher une pièce");
  lab.htmlFor = "roomSearch";
  var inp = document.createElement("input");
  inp.type = "search"; inp.id = "roomSearch"; inp.placeholder = "Chercher une pièce…";
  inp.value = listQuery;
  inp.addEventListener("input", function(){
    listQuery = inp.value;
    buildList();
    var f = document.getElementById("roomSearch");
    if(f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  });
  search.appendChild(lab); search.appendChild(inp);
  listEl.appendChild(search);

  var q = listQuery.trim().toLowerCase();
  var shown = 0;

  FAM.forEach(function(fm){
    var rs = ROOMS.filter(function(r){ return r.f === fm.id; });
    if(q) rs = rs.filter(function(r){
      return (r.n + " " + r.ch + " " + fm.name).toLowerCase().indexOf(q) >= 0;
    });
    if(!rs.length) return;
    shown += rs.length;
    var all = ROOMS.filter(function(r){ return r.f === fm.id; });
    var here = all.filter(function(r){ return r.fl === curFl; }).length;

    var det = el("details","roomlist__fam");
    /* Une recherche ouvre les familles qui répondent ; sinon seule celle du
       niveau courant s'ouvre, pour que la liste tienne dans un écran. */
    det.open = !!q || here > 0;
    var sum = el("summary");
    var sw = el("i"); sw.style.background = "var(" + fm.c + ")";
    if(fm.id === "tec") sw.classList.add("is-hatched");
    sum.appendChild(sw);
    sum.appendChild(el("span","roomlist__famname", fm.name));
    sum.appendChild(el("em", null, OV || q ? String(rs.length) : here + "/" + all.length));
    det.appendChild(sum);

    rs.forEach(function(r){
      var b = el("button"); b.type = "button"; b.dataset.id = r.id;
      if(!OV && r.fl !== curFl) b.classList.add("oth");
      b.setAttribute("aria-current", String(r.id === sel));
      var i = el("i"); i.style.background = "var(" + FMAP[r.f].c + ")";
      if(r.f === "tec") i.classList.add("is-hatched");
      b.appendChild(i);
      var nm = el("span", null, r.n);
      if(OV || r.fl !== curFl) nm.appendChild(el("u", null, flShort(r.fl)));
      b.appendChild(nm);
      b.appendChild(el("em", null, fmt(r.a)));
      b.addEventListener("click", function(){
        if(!OV && RMAP[r.id].fl !== curFl){ setCurFloor(RMAP[r.id].fl); refloor(); fit(); }
        select(r.id); centerOn(r.id);
      });
      det.appendChild(b);
    });
    listEl.appendChild(det);
  });

  if(q && !shown){
    listEl.appendChild(el("p","roomlist__none",
      "Aucune pièce ne correspond à « " + listQuery.trim() + " »."));
  }
}

export var snapOn = true;
export function snap(v){ return snapOn ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100; }

/* Accrochage dur : une pièce déplacée ne peut se poser QUE contre une autre,
   séparée d'exactement une cloison de 10 cm et partageant au moins 50 cm de mur.
   Aucune autre distance n'est atteignable tant que « Cloisons 10 cm » est actif. */
export var SHARE = 0.5;
export function g10(v){ return Math.round(v * 10) / 10; }
export function clampv(v, lo, hi){ return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
export function freeOf(id, x, y, w, h){
  var fl0 = RMAP[id].fl;
  for(var i = 0; i < ROOMS.length; i++){
    var r = ROOMS[i];
    if(r.id === id || r.fl !== fl0) continue;
    var o = layout[r.id];
    if(!o) continue;
    if(o.x > x + w + 1 || o.x + o.w < x - 1 || o.y > y + h + 1 || o.y + o.h < y - 1) continue;
    var dx = Math.max(0, Math.max(x - (o.x + o.w), o.x - (x + w)));
    var dy = Math.max(0, Math.max(y - (o.y + o.h), o.y - (y + h)));
    if(dx < PART - 1e-6 && dy < PART - 1e-6) return false;
  }
  return true;
}
/* Alignements possibles : la pièce déplacée cale son bord gauche, son bord droit ou son axe
   sur ceux d'une pièce existante. Recalculé au début de chaque déplacement, car il ne dépend
   que des dimensions de la pièce tirée. */
export var ALX = [], ALY = [];
export function buildAlign(id){
  var L = layout[id], w = L.w, h = L.h, sx = {}, sy = {}, fl0 = RMAP[id].fl;
  ROOMS.forEach(function(r){
    if(r.id === id || r.fl !== fl0) return;
    var o = layout[r.id];
    if(!o) return;
    sx[g10(o.x)] = 1; sx[g10(o.x + o.w - w)] = 1; sx[g10(o.x + (o.w - w) / 2)] = 1;
    sy[g10(o.y)] = 1; sy[g10(o.y + o.h - h)] = 1; sy[g10(o.y + (o.h - h) / 2)] = 1;
  });
  ALX = Object.keys(sx).map(Number).sort(function(a, b){ return a - b; });
  ALY = Object.keys(sy).map(Number).sort(function(a, b){ return a - b; });
}
/* les k valeurs alignées les plus proches de v, comprises dans [lo, hi] */
export function nearIn(arr, v, lo, hi, k, out){
  var a = 0, b = arr.length - 1, m;
  while(a <= b){ m = (a + b) >> 1; if(arr[m] < v) a = m + 1; else b = m - 1; }
  var i = a - 1, j = a, n = 0;
  while(n < k && (i >= 0 || j < arr.length)){
    var takeI = (i >= 0) && (j >= arr.length || (v - arr[i]) <= (arr[j] - v));
    var val = takeI ? arr[i--] : arr[j++];
    if(val >= lo - 1e-9 && val <= hi + 1e-9){ out.push(val); n++; }
    else if(takeI ? val < lo : val > hi){ if(takeI) i = -1; else j = arr.length; }
  }
}
export function dock(id, x, y){
  var L = layout[id], w = L.w, h = L.h, cands = [], fl0 = RMAP[id].fl;
  var near = [];
  ROOMS.forEach(function(r){
    if(r.id === id || r.fl !== fl0) return;
    var o = layout[r.id];
    if(!o) return;
    var cx0 = o.x + o.w / 2 - x - w / 2, cy0 = o.y + o.h / 2 - y - h / 2;
    near.push({ o: o, d: cx0 * cx0 + cy0 * cy0 });
  });
  if(!near.length) return { x: g10(x), y: g10(y) };
  near.sort(function(a, b){ return a.d - b.d; });
  near = near.slice(0, 40);

  near.forEach(function(p){
    var o = p.o, vals, i;
    /* accrochage est / ouest : la coordonnée libre est y */
    var lo = g10(o.y - h + SHARE), hi = g10(o.y + o.h - SHARE);
    vals = [g10(o.y), g10(o.y + o.h - h), g10(o.y + (o.h - h) / 2)];
    nearIn(ALY, y, lo, hi, 2, vals);
    for(i = 0; i < vals.length; i++){
      cands.push({ x: g10(o.x + o.w + PART), y: vals[i] });
      cands.push({ x: g10(o.x - w - PART), y: vals[i] });
    }
    /* accrochage nord / sud : la coordonnée libre est x */
    lo = g10(o.x - w + SHARE); hi = g10(o.x + o.w - SHARE);
    vals = [g10(o.x), g10(o.x + o.w - w), g10(o.x + (o.w - w) / 2)];
    nearIn(ALX, x, lo, hi, 2, vals);
    for(i = 0; i < vals.length; i++){
      cands.push({ x: vals[i], y: g10(o.y + o.h + PART) });
      cands.push({ x: vals[i], y: g10(o.y - h - PART) });
    }
  });
  cands.sort(function(a, b){
    return ((a.x - x) * (a.x - x) + (a.y - y) * (a.y - y))
         - ((b.x - x) * (b.x - x) + (b.y - y) * (b.y - y));
  });
  for(var i = 0; i < cands.length; i++){
    if(freeOf(id, cands[i].x, cands[i].y, w, h)) return cands[i];
  }
  return { x: L.x, y: L.y };
}

export function applyRoom(id){
  var L = layout[id], d = elOf[id];
  if(!L || !d) return;
  d.dataset.fl = RMAP[id].fl;
  d.classList.toggle("tray", RMAP[id].fl === TRAY);
  if(OV){
    var o = ovOff(id);
    d.classList.remove("hid"); d.classList.remove("ghost");
    d.style.left = ((L.x + o.x) * S) + "px";
    d.style.top = ((L.y + o.y) * S) + "px";
  } else if(RMAP[id].fl === TRAY){
    d.classList.add("hid"); d.classList.remove("ghost");
    d.style.left = (L.x * S) + "px";
    d.style.top = (L.y * S) + "px";
  } else {
    var df = RMAP[id].fl - curFl;
    d.classList.toggle("hid", df !== 0 && df !== -1);
    d.classList.toggle("ghost", df === -1);
    d.style.left = (L.x * S) + "px";
    d.style.top = (L.y * S) + "px";
  }
  d.style.width = (L.w * S) + "px";
  d.style.height = (L.h * S) + "px";
  var pw = L.w * S * z, ph = L.h * S * z;
  d.classList.toggle("tiny", pw < 36 || ph < 17);
  d.classList.toggle("sm", !(pw < 36 || ph < 17) && (pw < 84 || ph < 31));
  var r = RMAP[id];
  if(r.split){
    var sp = d.querySelector(".split"), thick = "calc(1.5px / var(--z,1))";
    if(L.w >= L.h){ sp.style.cssText = "left:50%;top:0;bottom:0;width:" + thick; }
    else { sp.style.cssText = "top:50%;left:0;right:0;height:" + thick; }
    sp.style.background = "var(--c)"; sp.style.opacity = ".6";
    sp.style.position = "absolute"; sp.style.zIndex = "1";
  }
  if(r.inset){
    var ins = d.querySelector(".inset"), iw = r.inset.w, ih = r.inset.h, ok = true;
    if(iw <= L.w + 1e-9 && ih <= L.h + 1e-9){ /* tel quel */ }
    else if(ih <= L.w + 1e-9 && iw <= L.h + 1e-9){ var t = iw; iw = ih; ih = t; }
    else { ok = false; }
    ins.style.width = (iw * S) + "px";
    ins.style.height = (ih * S) + "px";
    ins.style.display = ok ? "flex" : "none";
    ins.firstChild.style.display = (iw * S * z > 96) ? "block" : "none";
    d.classList.toggle("bad", !ok);
  }
}
export function insetFits(id){
  var r = RMAP[id], L = layout[id];
  if(!r.inset) return true;
  return (r.inset.w <= L.w + 1e-9 && r.inset.h <= L.h + 1e-9) ||
         (r.inset.h <= L.w + 1e-9 && r.inset.w <= L.h + 1e-9);
}
export function applyAll(){ ROOMS.forEach(function(r){ applyRoom(r.id); }); applyView(); drawLinks(); }
export function applyView(){
  world.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + z + ")";
  world.style.setProperty("--z", z);
  var g1 = 1 * S * z, g10 = 10 * S * z;
  vp.style.backgroundImage = (g1 > 5
    ? "linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px),"
    : "") + "linear-gradient(var(--rule) 1px,transparent 1px),linear-gradient(90deg,var(--rule) 1px,transparent 1px)";
  vp.style.backgroundSize = (g1 > 5 ? g1 + "px " + g1 + "px," + g1 + "px " + g1 + "px," : "")
    + g10 + "px " + g10 + "px," + g10 + "px " + g10 + "px";
  vp.style.backgroundPosition = tx + "px " + ty + "px";
}
export function setZoom(nz, ax, ay){
  nz = Math.max(0.22, Math.min(4.2, nz));
  var r = vp.getBoundingClientRect();
  if(ax == null){ ax = r.width / 2; ay = r.height / 2; }
  tx = ax - (ax - tx) * (nz / z);
  ty = ay - (ay - ty) * (nz / z);
  z = nz;
  ROOMS.forEach(function(rr){ applyRoom(rr.id); });
  applyView(); drawLinks();
}
export function fit(){
  var bx = 1e9, by = 1e9, bX = -1e9, bY = -1e9;
  ROOMS.forEach(function(r){
    if(!layout[r.id] || (!OV && r.fl !== curFl)) return;
    var L = wpos(r.id);
    bx = Math.min(bx, L.x); by = Math.min(by, L.y);
    bX = Math.max(bX, L.x + L.w); bY = Math.max(bY, L.y + L.h);
  });
  if(bx > bX) return;
  var r = vp.getBoundingClientRect(), nz;
  if(OV){
    FLOORS.forEach(function(F){ bx = Math.min(bx, F.px); by = Math.min(by, F.py);
      bX = Math.max(bX, F.px + F.pw); bY = Math.max(bY, F.py + F.ph); });
    if(TRAYR){ bx = Math.min(bx, TRAYR.px); by = Math.min(by, TRAYR.py);
      bX = Math.max(bX, TRAYR.px + TRAYR.pw); bY = Math.max(bY, TRAYR.py + TRAYR.ph); }
    /* la pile est haute : on cale sur la largeur et on se déplace d'une ligne à l'autre */
    nz = Math.max(0.22, Math.min(3, (r.width / ((bX - bx) * S)) * 0.96));
    z = nz;
    tx = (r.width - (bX - bx) * S * nz) / 2 - bx * S * nz;
    ty = 14 - by * S * nz;
    ROOMS.forEach(function(rr){ applyRoom(rr.id); });
    applyView(); drawLinks();
    return;
  }
  nz = Math.max(0.22, Math.min(3, Math.min(r.width / ((bX - bx) * S), r.height / ((bY - by) * S)) * 0.95));
  z = nz;
  tx = (r.width - (bX - bx) * S * nz) / 2 - bx * S * nz;
  ty = (r.height - (bY - by) * S * nz) / 2 - by * S * nz;
  ROOMS.forEach(function(rr){ applyRoom(rr.id); });
  applyView(); drawLinks();
}
export function centerOn(id){
  if(!layout[id]) return;
  var L = wpos(id);
  var r = vp.getBoundingClientRect();
  tx = r.width / 2 - (L.x + L.w / 2) * S * z;
  ty = r.height / 2 - (L.y + L.h / 2) * S * z;
  applyView();
}

/* ---- selection & properties ---- */
export function select(id){
  if(sel && elOf[sel]) elOf[sel].classList.remove("sel");
  sel = id;
  Array.prototype.forEach.call(listEl.querySelectorAll("button"), function(b){
    b.setAttribute("aria-current", String(b.dataset.id === id));
  });
  if(!id){
    /* On ne masque plus le volet : son onglet resterait sélectionné au-dessus
       d'un panneau vide. Il dit ce qu'il attend. */
    while(propsEl.firstChild) propsEl.removeChild(propsEl.firstChild);
    propsEl.appendChild(el("p","props__empty",
      "Aucune pièce sélectionnée. Clique une pièce du plan pour voir et modifier ses cotes."));
    if(btnRot) btnRot.disabled = true;
    markSiblings(); drawLinks();
    return;
  }
  elOf[id].classList.add("sel");
  markSiblings();
  drawLinks();
  if(btnRot) btnRot.disabled = false;
  drawProps();
  showPane("props");
}
export function drawProps(){
  if(!sel) return;
  var r = RMAP[sel], L = layout[sel];
  while(propsEl.firstChild) propsEl.removeChild(propsEl.firstChild);
  var pn = el("div","pn");
  var sw = el("i"); sw.style.background = "var(" + FMAP[r.f].c + ")";
  pn.appendChild(sw); pn.appendChild(el("span", null, r.n));
  propsEl.appendChild(pn);
  propsEl.appendChild(el("div","pc", r.ch + (r.note ? " · " + r.note : "")));
  propsEl.appendChild(el("div","parea", fmt(r.a) + " m²"));
  if(r.est){
    var box = el("div","pvar");
    box.appendChild(el("label", null, "Surface par pièce (m²)"));
    var row = el("div","pvarrow");
    var inp = document.createElement("input");
    inp.type = "number"; inp.step = "0.1"; inp.min = "1"; inp.max = "2000";
    inp.id = "areain"; inp.value = r.a;
    row.appendChild(inp);
    var ok = el("button", null, "Appliquer"); ok.type = "button";
    row.appendChild(ok);
    box.appendChild(row);
    var it0 = itemOf(sel);
    box.appendChild(el("span","pvarn",
      it0.nb > 1 ? "× " + it0.nb + " pièces = " + fmt(r.a * it0.nb) + " m²" : "poste d'une seule pièce"));
    box.appendChild(el("span","pvarw", it0.set
      ? "Valeur fixée par toi."
      : "À préciser — le règlement ne chiffre pas ce poste."));
    function commit(){
      var v = Math.round(parseFloat(inp.value) * 10) / 10;
      if(!(v > 0) || v > 2000){ inp.value = r.a; return; }
      if(v === r.a) return;
      setPosteArea(sel, v);
    }
    ok.addEventListener("click", commit);
    inp.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); commit(); } });
    propsEl.appendChild(box);
  }
  propsEl.appendChild(el("div","plock", r.fix
    ? "surface ET dimensions imposées par le programme"
    : (r.est ? "surface à préciser"
             : "surface verrouillée par le programme")));

  if(r.fix){
    var fx = el("div","fixed");
    fx.appendChild(el("b", null, dim(L.w) + " × " + dim(L.h) + " m"));
    fx.appendChild(el("span", null, "Dimensions non modifiables. L'orientation reste libre."));
    propsEl.appendChild(fx);
  } else {
    var wrap = el("div");
    wrap.appendChild(el("label", null, "Proportions (pas de 0,5 m)"));
    var selDim = document.createElement("select");
    selDim.id = "dimsel";
    var vlist = validDims(r.a);
    vlist.forEach(function(d){
      var o = document.createElement("option");
      o.value = d.w;
      o.textContent = dim(d.w) + " × " + dim(d.h) + " m";
      if(Math.abs(d.w - L.w) < 1e-6) o.selected = true;
      selDim.appendChild(o);
    });
    selDim.addEventListener("change", function(){
      pushUndo(groupOf(sel));
      setSide(sel, parseFloat(selDim.value), null);
      drawProps(); saveSoon();
    });
    wrap.appendChild(selDim);
    propsEl.appendChild(wrap);
    var gn = r.gn || 1;
    propsEl.appendChild(el("div","pcount", vlist.length + " proportions possibles à cette surface"));
    if(gn > 1){
      var gl = el("div", syncOn ? "psync" : "pcount");
      gl.textContent = syncOn
        ? "Les " + gn + " pièces de ce poste changent ensemble."
        : "Poste de " + gn + " pièces — dimensions indépendantes (postes déliés).";
      propsEl.appendChild(gl);
    }
  }

  var rr = el("div","ratios");
  var sb = el("button", null, "↻ Pivoter 90°"); sb.type = "button";
  sb.addEventListener("click", function(){ rotate(); });
  rr.appendChild(sb);
  propsEl.appendChild(rr);

  var fw = el("div","pflw");
  fw.appendChild(el("label", null, "Niveau"));
  var fb = el("div","pfl"), rg = flRange(r), lr = flLvRange(r);
  var tb = el("button", null, "Bac"); tb.type = "button";
  tb.setAttribute("aria-current", String(r.fl === TRAY));
  tb.title = "Remettre cette pièce dans le bac « À placer »";
  tb.addEventListener("click", function(){ setFloorOf(sel, TRAY); });
  fb.appendChild(tb);
  FLOORS.forEach(function(F, i){
    var b = el("button", null, flShort(i)); b.type = "button";
    b.setAttribute("aria-current", String(i === r.fl));
    b.title = F.n;
    if(i < rg.lo || i > rg.hi){ b.disabled = true; b.title = F.n + " — le programme n\u2019autorise pas ce poste à ce niveau"; }
    b.addEventListener("click", function(){ setFloorOf(sel, i); });
    fb.appendChild(b);
  });
  fw.appendChild(fb);
  var gnf = r.gn || 1;
  if(gnf > 1){
    var allb = el("button","pfla", "Déplacer les " + gnf + " pièces du poste à ce niveau");
    allb.type = "button";
    allb.addEventListener("click", function(){ setFloorOf(sel, RMAP[sel].fl, 1); });
    fw.appendChild(allb);
  }
  if(rg.lo > 0 || rg.hi < FLOORS.length - 1){
    fw.appendChild(el("div","pcount", (lr.min === 0 && lr.max === 0)
      ? "Le programme impose ce poste au rez-de-chaussée."
      : (lr.min < 0
        ? "Ce poste est admis en sous-sol comme jusqu\u2019au " + lvName(Math.min(lr.max, 9)).toLowerCase() + "."
        : "Le programme n\u2019autorise ce poste que jusqu\u2019au " + lvName(lr.max).toLowerCase() + ".")));
  }
  propsEl.appendChild(fw);

  if(r.inset && !insetFits(sel)){
    propsEl.appendChild(el("div","warn",
      "⚠ Le " + r.inset.label + " n'entre plus dans cette forme."));
  }
  propsEl.hidden = false;
}
export function setSide(id, w, h){
  var r = RMAP[id];
  if(r.fix) return;
  var L = layout[id], A = r.a, cx = L.x + L.w / 2, cy = L.y + L.h / 2;
  if(w == null) w = A / h;
  var d = nearestDims(A, w);
  L.w = d.w; L.h = d.h;
  L.x = snap(cx - L.w / 2); L.y = snap(cy - L.h / 2);
  applyRoom(id); drawLinks();
}
export function rotate(){
  if(!sel) return;
  pushUndo(groupOf(sel));
  var L = layout[sel], cx = L.x + L.w / 2, cy = L.y + L.h / 2, t = L.w;
  L.w = L.h; L.h = t;
  L.x = cx - L.w / 2; L.y = cy - L.h / 2;
  applyRoom(sel); syncSiblings(sel, L.w, L.h);
  drawProps(); drawLinks(); saveSoon();
}

/* ---- undo ---- */
export function pushUndo(ids){
  var snap0 = {};
  (ids || Object.keys(layout)).forEach(function(i){
    if(layout[i]) snap0[i] = { x:layout[i].x, y:layout[i].y, w:layout[i].w, h:layout[i].h,
      f: RMAP[i] ? RMAP[i].fl : 0 };
  });
  undoStack.push(snap0);
  if(undoStack.length > 60) undoStack.shift();
  if(btnUndo) btnUndo.disabled = false;
}
export function undo(){
  var st = undoStack.pop();
  if(!st) return;
  var fch = false;
  for(var i in st){
    layout[i] = { x:st[i].x, y:st[i].y, w:st[i].w, h:st[i].h };
    if(RMAP[i] && st[i].f !== undefined && RMAP[i].fl !== st[i].f){ RMAP[i].fl = st[i].f; fch = true; }
    applyRoom(i);
  }
  if(fch){ if(OV) layoutPlates(); buildFloorBar(); buildList(); drawNiv(); drawPlates();
    ROOMS.forEach(function(r){ applyRoom(r.id); }); }
  if(TRAYR && !trayRooms().length && OV){ layoutPlates(); drawPlates();
    ROOMS.forEach(function(r){ applyRoom(r.id); }); }
  markProblems();
  drawLinks();
  if(sel) drawProps();
  if(!undoStack.length && btnUndo) btnUndo.disabled = true;
  saveSoon();
}


/* ================= SHUFFLE : agencement respectant les adjacences =================
   Les pièces liées forment des grappes ; chaque grappe est posée par parcours en
   largeur, chaque voisin plaqué contre un côté libre de son parent. Les adjacences
   sont donc satisfaites par construction, pas par essais successifs. */
export function rnd(a){ return a[Math.floor(Math.random() * a.length)]; }
export function shuffled(a){
  a = a.slice();
  for(var i = a.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
/* Rejette toute position qui n'est pas séparée d'au moins une cloison sur un des deux axes. */
export function hits(x, y, w, h, ids, pos){
  for(var i = 0; i < ids.length; i++){
    var o = pos[ids[i]], r = RMAP[ids[i]];
    if(!o) continue;
    var dx = Math.max(0, Math.max(x - (o.x + r.w), o.x - (x + w)));
    var dy = Math.max(0, Math.max(y - (o.y + r.h), o.y - (y + h)));
    if(dx < PART - 1e-6 && dy < PART - 1e-6) return true;
  }
  return false;
}
export function placeCluster(comp, adj, det){
  var best = null, bestScore = -1, tries = det ? 1 : (comp.length > 2 ? 24 : 6);
  var ord = function(a){ return det ? a : shuffled(a); };
  for(var t = 0; t < tries; t++){
    var pos = {};
    var root = comp.slice().sort(function(a, b){
      return (RMAP[b].w * RMAP[b].h - RMAP[a].w * RMAP[a].h) || (a < b ? 1 : -1); })[0];
    pos[root] = { x: 0, y: 0 };
    var queue = [root], placed = [root];
    while(queue.length){
      var P = queue.shift(), pp = pos[P], pw = RMAP[P].w, ph = RMAP[P].h;
      ord(adj[P]).forEach(function(Q){
        if(pos[Q]) return;
        var qw = RMAP[Q].w, qh = RMAP[Q].h, cands = [];
        ord(["e", "s", "w", "n"]).forEach(function(side){
          var vert = (side === "e" || side === "w");
          var span = vert ? ph - qh : pw - qw;
          ord(det ? [0, span / 2, span] : [0, span / 2, span, span * Math.random()]).forEach(function(o){
            o = Math.round(o * 10) / 10;
            if(side === "e") cands.push({ x: pp.x + pw + PART, y: pp.y + o });
            else if(side === "w") cands.push({ x: pp.x - qw - PART, y: pp.y + o });
            else if(side === "s") cands.push({ x: pp.x + o, y: pp.y + ph + PART });
            else cands.push({ x: pp.x + o, y: pp.y - qh - PART });
          });
        });
        for(var i = 0; i < cands.length; i++){
          if(!hits(cands[i].x, cands[i].y, qw, qh, placed, pos)){ pos[Q] = cands[i]; break; }
        }
        if(!pos[Q]){
          /* aucun côté libre : plutôt que de superposer deux pièces, on pousse celle-ci vers
             l'est jusqu'à trouver de la place. L'adjacence est perdue — la tentative sera
             moins bien notée et écartée au profit d'une autre — mais jamais le plan. */
          var c0 = cands[0], st = Math.max(qw, qh) + PART, g0 = 0;
          while(hits(c0.x, c0.y, qw, qh, placed, pos) && g0 < 80){ c0 = { x: c0.x + st, y: c0.y }; g0++; }
          pos[Q] = c0;
        }
        placed.push(Q); queue.push(Q);
      });
    }
    var sc = 0;
    PLINK.forEach(function(l){
      if(!pos[l.a] || !pos[l.b]) return;
      var dx = Math.max(0, Math.max(pos[l.a].x - (pos[l.b].x + RMAP[l.b].w),
                                    pos[l.b].x - (pos[l.a].x + RMAP[l.a].w)));
      var dy = Math.max(0, Math.max(pos[l.a].y - (pos[l.b].y + RMAP[l.b].h),
                                    pos[l.b].y - (pos[l.a].y + RMAP[l.a].h)));
      if(Math.sqrt(dx * dx + dy * dy) <= TOUCH) sc++;
    });
    if(sc > bestScore){ bestScore = sc; best = pos; }
    if(bestScore === comp.length - 1) break;
  }
  return best;
}
/* Grappes d'adjacence d'un niveau : une adjacence qui enjambe deux niveaux ne peut pas
   être tenue, elle ne soude donc pas les deux pièces. */
export function clusters(fi, det){
  var rs = ROOMS.filter(function(r){ return r.fl === fi; });
  var adj = {}, seen = {}, units = [];
  rs.forEach(function(r){ adj[r.id] = []; });
  PLINK.forEach(function(l){ if(adj[l.a] && adj[l.b]){ adj[l.a].push(l.b); adj[l.b].push(l.a); } });
  rs.forEach(function(r){
    if(seen[r.id]) return;
    var comp = [], q = [r.id];
    seen[r.id] = 1;
    while(q.length){
      var id = q.shift(); comp.push(id);
      adj[id].forEach(function(n){ if(!seen[n]){ seen[n] = 1; q.push(n); } });
    }
    var pos = comp.length > 1 ? placeCluster(comp, adj, det) : {};
    if(comp.length === 1) pos[comp[0]] = { x: 0, y: 0 };
    var mx = 1e9, my = 1e9, MX = -1e9, MY = -1e9;
    comp.forEach(function(id){
      var o = pos[id];
      mx = Math.min(mx, o.x); my = Math.min(my, o.y);
      MX = Math.max(MX, o.x + RMAP[id].w); MY = Math.max(MY, o.y + RMAP[id].h);
    });
    comp.forEach(function(id){ pos[id].x -= mx; pos[id].y -= my; });
    units.push({ ids: comp, pos: pos, w: MX - mx, h: MY - my,
      a: comp.reduce(function(t, id){ return t + RMAP[id].a; }, 0) });
  });
  return units;
}
/* Mise en feuille d'un niveau : une bande par groupe (u.k), remplie de gauche à droite. */
export function sheet(units){
  var SHEET = 112, x = 0, y = 0, rowH = 0, cur = -1;
  units.forEach(function(u){
    if(u.k !== cur){                       /* nouvelle bande à chaque groupe */
      if(cur !== -1){ x = 0; y += rowH + 4; rowH = 0; }
      cur = u.k;
    } else if(x > 0 && x + u.w > SHEET){ x = 0; y += rowH + PART; rowH = 0; }
    u.ox = x; u.oy = y;
    x += u.w + PART; rowH = Math.max(rowH, u.h);
  });
  units.forEach(function(u){
    u.ids.forEach(function(id){
      var r = RMAP[id], o = u.pos[id];
      layout[id] = { x: Math.round((u.ox + o.x) * 10) / 10,
                     y: Math.round((u.oy + o.y) * 10) / 10, w: r.w, h: r.h };
    });
  });
}
/* Range toutes les pièces en bandes, par chapitre du règlement ou par famille d'usage.
   Chaque niveau est rangé pour lui-même, sur sa propre feuille. Les grappes d'adjacence
   restent soudées : une grappe est affectée à la bande de sa plus grande pièce, ce qui
   rend visibles les pièces que le programme force hors de leur zone. */
export function arrange(key, silent){
  if(!silent) pushUndo(null);
  var dims = {};
  ROOMS.forEach(function(r){ if(!dims[r.g]) dims[r.g] = r.fix ? { w:r.w, h:r.h } : squarest(r.a); });
  ROOMS.forEach(function(r){ r.w = dims[r.g].w; r.h = dims[r.g].h; });
  var famIdx = {}; FAM.forEach(function(f, i){ famIdx[f.id] = i; });
  var stray = 0;
  FLOORS.forEach(function(F, fi){
    var units = clusters(fi, 1);
    units.forEach(function(u){
      var lead = u.ids.slice().sort(function(a, b){ return RMAP[b].a - RMAP[a].a; })[0];
      u.k = key === "ch" ? RMAP[lead].ci : famIdx[RMAP[lead].f];
      u.ids.forEach(function(id){
        if(key === "ch" ? RMAP[id].ci !== u.k : famIdx[RMAP[id].f] !== u.k) stray++;
      });
    });
    units.sort(function(a, b){ return (a.k - b.k) || (b.a - a.a); });
    sheet(units);
  });
  setStray(key === "ch" ? stray : null);
  if(trayRooms().length){
    trayRooms().forEach(function(r){ var L = layout[r.id]; if(L){ L.w = r.w; L.h = r.h; } });
    packTray();
  }
  if(OV) layoutPlates();
  ROOMS.forEach(function(r){ applyRoom(r.id); });
  drawPlates(); drawLinks(); markProblems();
  if(!silent){ fit(); if(sel) drawProps(); saveSoon(); }
}

export function shuffleLayout(keepLevels){
  pushUndo(null);

  /* 0. répartition des niveaux tirée au sort — sauf si l'on veut garder celle en place */
  if(!keepLevels && FLOORS.length > 1) shuffleFloors();

  /* 1. proportions tirées au sort, une par poste, ratio plafonné à 3:1 */
  var dims = {};
  ROOMS.forEach(function(r){
    if(dims[r.g]) return;
    if(r.fix){ dims[r.g] = { w: r.w, h: r.h }; return; }
    var v = validDims(r.a).filter(function(d){
      if(Math.max(d.w, d.h) / Math.min(d.w, d.h) > 3) return false;
      if(r.inset){
        var iw = r.inset.w, ih = r.inset.h;
        if(!((iw <= d.w && ih <= d.h) || (ih <= d.w && iw <= d.h))) return false;
      }
      return true;
    });
    dims[r.g] = v.length ? rnd(v) : squarest(r.a);
  });
  ROOMS.forEach(function(r){ r.w = dims[r.g].w; r.h = dims[r.g].h; });

  /* 2. un agencement par niveau : grappes d'adjacence, puis une bande par chapitre du
     règlement, dans l'ordre du document. Une grappe qui enjambe deux chapitres est rangée
     dans celui de sa plus grande pièce ; les pièces ainsi tirées hors de leur chapitre
     sont comptées et signalées. */
  var stray = 0;
  FLOORS.forEach(function(F, fi){
    var units = clusters(fi, 0);
    units.forEach(function(u){
      var lead = u.ids.slice().sort(function(a, b){ return RMAP[b].a - RMAP[a].a; })[0];
      u.k = RMAP[lead].ci;
      u.ids.forEach(function(id){ if(RMAP[id].ci !== u.k) stray++; });
      u.sortKey = (u.w * u.h) * (0.75 + Math.random() * 0.5);
    });
    units.sort(function(a, b){ return (a.k - b.k) || (b.sortKey - a.sortKey); });
    sheet(units);
  });
  setStray(stray);

  if(trayRooms().length){
    trayRooms().forEach(function(r){ var L = layout[r.id]; if(L){ L.w = r.w; L.h = r.h; } });
    packTray();
  }
  if(!OV && sel && RMAP[sel].fl !== curFl) select(null);
  if(OV) layoutPlates();
  ROOMS.forEach(function(r){ applyRoom(r.id); });
  drawPlates(); drawLinks(); buildFloorBar(); buildList(); drawNiv(); markProblems(); fit();
  if(sel) drawProps();
  saveSoon();
}

/* ---- pointer interactions ---- */
export function toWorld(cx, cy){
  var r = vp.getBoundingClientRect();
  return { x: (cx - r.left - tx) / (S * z), y: (cy - r.top - ty) / (S * z) };
}
export function showReadout(id){
  var L = layout[id], r = vp.getBoundingClientRect();
  var gn = RMAP[id].gn || 1;
  readout.textContent = dim(L.w) + " × " + dim(L.h) + " m  ·  " + fmt(RMAP[id].a) + " m²"
    + (syncOn && gn > 1 ? "  ·  × " + gn : "")
    + (OV ? "  ·  " + (RMAP[id].fl === TRAY ? "à placer" : FLOORS[RMAP[id].fl].n) : "")
    + (snapOn ? "  ·  cloison 10 cm" : "");
  readout.hidden = false;
  var W = wpos(id), px = tx + W.x * S * z, py = ty + W.y * S * z;
  readout.style.left = Math.max(4, Math.min(r.width - 150, px)) + "px";
  readout.style.top = Math.max(4, py - 26) + "px";
}

export function wire(bMinus, bFit, bPlus, bSnap, bRot, bUndo, bReset){
  bMinus.addEventListener("click", function(){ setZoom(z / 1.25); });
  bPlus.addEventListener("click", function(){ setZoom(z * 1.25); });
  bFit.addEventListener("click", fit);
  bSnap.addEventListener("click", function(){
    snapOn = !snapOn;
    /* Le libellé reste FIXE et l'état est porté par aria-pressed. Il basculait
       entre « Contrainte 10 cm » et « Contrainte levée », deux textes dont on ne
       pouvait pas savoir s'ils décrivaient l'état courant ou l'action à venir :
       les deux lectures étaient plausibles, on testait, et le plan bougeait. */
    bSnap.setAttribute("aria-pressed", String(snapOn));
    bSnap.classList.toggle("off", !snapOn);
  });
  bRot.addEventListener("click", rotate);
  bUndo.addEventListener("click", undo);
  bReset.addEventListener("click", function(){
    pushUndo(null);
    layout = defaultLayout();
    ROOMS.forEach(function(r){ applyRoom(r.id); });
    fit(); saveSoon();
  });

  var mode = null, startPt = null, start = null, dir = null, id = null, moved = false;

  vp.addEventListener("pointerdown", function(e){
    if(e.button !== 0) return;
    /* le panneau de propriétés est posé dans le viewport : ses boutons et ses listes doivent
       recevoir le clic, pas le gestionnaire de déplacement du fond */
    if(e.target.closest(".props") || e.target.closest(".readout")) return;
    var h = e.target.closest(".h"), rm = e.target.closest(".room");
    moved = false;
    startPt = { x: e.clientX, y: e.clientY };
    if(h && rm && !RMAP[rm.dataset.id].fix){
      mode = "resize"; id = rm.dataset.id; dir = h.dataset.dir;
      start = { x:layout[id].x, y:layout[id].y, w:layout[id].w, h:layout[id].h };
      select(id); pushUndo(groupOf(id)); showReadout(id);
    } else if(rm){
      mode = "move"; id = rm.dataset.id;
      buildAlign(id);
      start = { x:layout[id].x, y:layout[id].y, w:layout[id].w, h:layout[id].h, f:RMAP[id].fl };
      select(id); pushUndo([id]); showReadout(id);
    } else {
      mode = "pan"; start = { tx: tx, ty: ty };
      vp.classList.add("panning");
    }
    vp.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  vp.addEventListener("pointermove", function(e){
    if(!mode) return;
    var dx = e.clientX - startPt.x, dy = e.clientY - startPt.y;
    if(Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    if(mode === "pan"){ tx = start.tx + dx; ty = start.ty + dy; applyView(); return; }
    var dxm = dx / (S * z), dym = dy / (S * z), L = layout[id], A = RMAP[id].a;
    if(mode === "move"){
      var lx = start.x + dxm, ly = start.y + dym;
      if(OV){
        /* la pièce suit le pointeur dans le monde ; la ligne sous son centre décide du niveau,
           le bac compris : glisser une pièce hors du bac la pose, l'y ramener la dépose */
        var F0 = (start.f === TRAY ? TRAYR : FLOORS[start.f]) || { ox: 0, oy: 0 };
        var wx = start.x + (F0.ox || 0) + dxm, wy = start.y + (F0.oy || 0) + dym;
        var tf = floorAt(wx + L.w / 2, wy + L.h / 2);
        if(tf !== RMAP[id].fl){
          RMAP[id].fl = tf;
          buildAlign(id);
          markProblems(); drawPlates();
        }
        var Ft = (tf === TRAY ? TRAYR : FLOORS[tf]) || { ox: 0, oy: 0 };
        lx = wx - (Ft.ox || 0); ly = wy - (Ft.oy || 0);
      }
      var np = snapOn ? dock(id, lx, ly) : { x: snap(lx), y: snap(ly) };
      L.x = np.x; L.y = np.y; setStray(null);
      applyRoom(id); showReadout(id); drawLinks();
    } else {
      var nw;
      if(dir === "n" || dir === "s"){
        var nh = Math.max(MINSIDE, start.h + (dir === "s" ? dym : -dym));
        nw = A / nh;
      } else {
        nw = start.w + (dir.indexOf("w") >= 0 ? -dxm : dxm);
      }
      var nd = nearestDims(A, nw);
      L.w = nd.w; L.h = nd.h;
      L.x = dir.indexOf("w") >= 0 ? start.x + start.w - L.w
            : (dir === "n" || dir === "s") ? start.x + start.w / 2 - L.w / 2 : start.x;
      L.y = dir.indexOf("n") >= 0 ? start.y + start.h - L.h
            : dir.indexOf("s") >= 0 ? start.y : start.y + start.h / 2 - L.h / 2;
      syncSiblings(id, L.w, L.h);
      applyRoom(id); showReadout(id); drawProps(); drawLinks();
    }
  });

  function end(e){
    if(!mode) return;
    if(mode === "pan"){ vp.classList.remove("panning"); if(!moved) select(null); undoStack.pop && 0; }
    else {
      if(!moved){
        undoStack.pop();
        if(!undoStack.length && btnUndo) btnUndo.disabled = true;
      } else saveSoon();
      if(mode === "move" && start && start.f !== undefined && id && RMAP[id].fl !== start.f){
        if(start.f === TRAY && RMAP[id].fl !== TRAY) pullPartners(id);
        if(start.f === TRAY || RMAP[id].fl === TRAY) packTray();
        if(OV) layoutPlates();
        ROOMS.forEach(function(rr){ applyRoom(rr.id); });
        buildFloorBar(); buildList(); drawNiv(); drawPlates(); drawLinks();
        checkManualDone();
      }
      markProblems();
      if(sel) drawProps();
    }
    readout.hidden = true;
    mode = null; id = null;
    try { vp.releasePointerCapture(e.pointerId); } catch(_){}
  }
  vp.addEventListener("pointerup", end);
  vp.addEventListener("pointercancel", end);

  vp.addEventListener("wheel", function(e){
    e.preventDefault();
    var r = vp.getBoundingClientRect();
    setZoom(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  document.addEventListener("keydown", function(e){
    if(view.tab !== "plan") return;
    var t = e.target;
    if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); undo(); return; }
    if(e.key === "Escape"){ select(null); return; }
    if(e.key === "PageUp" || e.key === "PageDown"){
      e.preventDefault();
      var up = e.key === "PageUp" ? 1 : -1;
      if(sel) setFloorOf(sel, Math.max(0, Math.min(FLOORS.length - 1, RMAP[sel].fl + up)));
      else setFloor(Math.max(0, Math.min(FLOORS.length - 1, curFl + up)));
      return;
    }
    if(!sel) return;
    if(e.key.toLowerCase() === "r"){ e.preventDefault(); rotate(); return; }
    var st = e.shiftKey ? 1 : 0.1, L = layout[sel], d = 0;
    if(e.key === "ArrowLeft"){ L.x = r2(L.x - st); d = 1; }
    else if(e.key === "ArrowRight"){ L.x = r2(L.x + st); d = 1; }
    else if(e.key === "ArrowUp"){ L.y = r2(L.y - st); d = 1; }
    else if(e.key === "ArrowDown"){ L.y = r2(L.y + st); d = 1; }
    if(d){
      e.preventDefault();
      if(snapOn){ buildAlign(sel); var q = dock(sel, L.x, L.y); L.x = q.x; L.y = q.y; }
      applyRoom(sel); drawLinks(); saveSoon();
    }
  });
}

