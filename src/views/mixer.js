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
   perd à se tromper. Trois interrupteurs gouvernent ces gestes (`mix/opts.js`)
   : le tirage propose-t-il aussi la pile, ce que le règlement veut côte à côte
   se déplace-t-il ensemble, et un bloc montre-t-il ses pièces.

   Ce qui agit sur l'ENSEMBLE est dans la barre du haut ; ce qui agit sur UN
   niveau — son plateau, son retrait — est sur le niveau lui-même ; et l'on
   ajoute un niveau à l'endroit où il apparaîtra, en tête ou au pied de la
   pile.
   ========================================================================= */
import { el, fmt } from "../core/format.js";
import { CIRC, CIRCA, FMAP } from "../core/model.js";
import { curSeed, parseSeed, seed, seedLabel } from "../core/rand.js";
import { s as svg } from "../core/svg.js";
import { squarify } from "../core/treemap.js";
import { view } from "../core/viewstate.js";
import { RULES } from "../data/rules.js";
import { accept, clearAccepts, unaccept } from "../mix/accept.js";
import { mixCheck, mixVerdict } from "../mix/checks.js";
import {
  FLOORS, PLATE_MAX, PLATE_MIN, TRAY,
  addFloorBottom, addFloorTop, areaOf, blockOf, delFloorAt, flArea, flBuilt,
  flCount, flHeight, flLibre, flName, flNet, floorCost, grappeBlocs, horsAt,
  lvlOf, move, moveGroupe, onFloor, regrouper, setPlate, split, toTray,
  trayArea, trayBlocks, usable
} from "../mix/floors.js";
import { grouper, pieces, setGrouper, setPieces, setTirer, tirerNiveaux } from "../mix/opts.js";
import { PMAP, aOf, posesDedans, qOf, uOf } from "../mix/prog.js";
import { repartir } from "../mix/shuffle.js";
import { saveSoon, setChip } from "../mix/store.js";

/* Surface d'un mètre carré, en pixels carrés. Constante pour toute la vue :
   c'est ce qui permet de comparer deux niveaux d'un coup d'œil. */
var AIRE = 70;
var TINY_W = 46, TINY_H = 21;

var stackEl = null, issuesEl = null, trayEl = null, sumEl = null, seedEl = null;
var ghostEl = null;
var selU = null, drag = null, wired = false;
/* Le code de l'écart déplié, s'il y en a un. Un seul à la fois : ouvrir le
   suivant referme le précédent, comme un menu. L'écart ouvert désigne aussi
   ses coupables dans la pile — c'est à quoi sert `issFocus`. */
var openIss = null, issFocus = null;

/* ---------- construction du panneau --------------------------------------- */
export function mixPanel(){
  var p = el("section","mix");

  /* --- barre d'outils ----------------------------------------------------
     Tout ce qui agit sur l'ensemble est ici, en un seul rang : proposer,
     grouper, vider. Ce qui agit sur UN niveau — son plateau, son retrait — est
     sur le niveau lui-même. Les commandes de pile vivaient sous la pile, à
     quatre cents pixels de ce qu'elles modifiaient. */
  var bar = el("div","controls mix-bar");

  /* Le tirage est la seule proposition : « Répartir », son jumeau ordonné,
     donnait la même chose à l'ordre des chapitres près, et la graine rend le
     tirage aussi rejouable qu'un ordre fixe. */
  var g = el("div","btn-group");
  g.setAttribute("role","group");
  g.setAttribute("aria-label","Proposer une répartition");
  var bAle = el("button","btn","Shuffle");
  bAle.type = "button";
  bAle.title = "Une répartition tirée au sort, rejouable par sa graine";
  bAle.addEventListener("click", function(){ proposer(); });
  g.appendChild(bAle);
  var bNiv = el("button","btn","Shuffle niveaux");
  bNiv.type = "button";
  bNiv.setAttribute("aria-pressed", String(tirerNiveaux));
  bNiv.title = "Le tirage déduit aussi la pile : surface bâtie à loger, plateau du rez, "
             + "et ce que le règlement admet en sous-sol";
  bNiv.addEventListener("click", function(){
    setTirer(!tirerNiveaux);
    bNiv.setAttribute("aria-pressed", String(tirerNiveaux));
    saveSoon();
  });
  g.appendChild(bNiv);
  bar.appendChild(g);

  /* La graine est ce qui rend une proposition retrouvable : sans elle, on tire
     dix fois et la troisième, qui était la bonne, n'existe plus. */
  seedEl = el("div","mix-seed");
  bar.appendChild(seedEl);

  /* L'interrupteur garde un libellé fixe et ne dit son état que par
     `aria-pressed` : « Grouper les liés » se lit pareil dans les deux sens. */
  var bGrp = el("button","btn","Grouper les liés");
  bGrp.type = "button";
  bGrp.setAttribute("aria-pressed", String(grouper));
  bGrp.title = "Déplacer une pièce emmène tout ce que le règlement lui demande de toucher";
  bGrp.addEventListener("click", function(){
    setGrouper(!grouper);
    bGrp.setAttribute("aria-pressed", String(grouper));
    /* Enclencher la règle la fait porter sur ce qui est DÉJÀ posé : sinon elle
       s'annonçait sans rien changer, et une grappe éparpillée le restait. */
    if(grouper) regrouper();
    selU = null; openIss = null; issFocus = null;
    drawMix(); saveSoon();
  });
  bar.appendChild(bGrp);

  /* Un bloc est un poste entier — dix-huit salles de classe posées d'un coup.
     Ouvert, il montre ses dix-huit salles, et chacune se prend séparément :
     c'est là que se fait la scission, sur le bloc et non dans un menu. */
  var bPcs = el("button","btn","Voir les pièces");
  bPcs.type = "button";
  bPcs.setAttribute("aria-pressed", String(pieces));
  bPcs.title = "Découpe chaque bloc en ses pièces : une pièce se glisse seule, "
             + "le bloc entier se prend par son nom";
  bPcs.addEventListener("click", function(){
    setPieces(!pieces);
    bPcs.setAttribute("aria-pressed", String(pieces));
    drawMix(); saveSoon();
  });
  bar.appendChild(bPcs);

  var bVide = el("button","btn","Tout au bac");
  bVide.type = "button";
  bVide.title = "Vide les niveaux pour reposer le programme à la main";
  bVide.addEventListener("click", function(){
    toTray(); selU = null; drawMix(); saveSoon();
  });
  bar.appendChild(bVide);

  bar.appendChild(el("span","spacer"));
  var chip = el("span","savechip");
  bar.appendChild(chip);
  setChip(chip);
  p.appendChild(bar);

  /* --- la pile et son flanc --- */
  var grid = el("div","mix-grid");
  var main = el("div","mix-main");
  sumEl = el("div","mix-sum");
  main.appendChild(sumEl);
  stackEl = el("div","mix-stack");
  main.appendChild(stackEl);

  grid.appendChild(main);

  var side = el("aside","mix-side");
  side.appendChild(circBlock());
  issuesEl = el("section","mix-issues");
  side.appendChild(issuesEl);
  trayEl = el("section","mix-tray");
  side.appendChild(trayEl);
  grid.appendChild(side);
  p.appendChild(grid);

  if(!ghostEl){
    ghostEl = el("div","mix-ghost");
    ghostEl.hidden = true;
    document.body.appendChild(ghostEl);
  }
  if(!wired) wireMix();
  /* Une graine existe dès le premier affichage : sans elle, la première
     proposition ne serait pas rejouable. */
  if(!curSeed) seed(null);
  return p;
}

function proposer(){
  seed(null);
  repartir({ alea: true, etages: tirerNiveaux });
  selU = null; openIss = null; issFocus = null;
  drawMix();
  saveSoon();
}

/* ---------- la part de circulation, en lecture seule -----------------------
   Elle se règle dans le cahier des charges et nulle part ailleurs : c'est une
   surface, et les surfaces se décident une fois. Ici on la lit. */
function circBlock(){
  var s = el("section","mix-circ");
  s.appendChild(el("h3","label","Circulation"));
  var v = el("p","mix-circ__v mono", Math.round(CIRC * 100) + " %");
  v.appendChild(el("span","u", "de la surface bâtie"));
  s.appendChild(v);
  s.appendChild(el("p","mix-circ__n",
    fmt(Math.round(CIRCA)) + " m² sur le bâti scolaire, déjà comptés dans les "
    + "capacités de plateau ci-contre."));
  var b = el("button","btn btn--quiet mix-circ__go","Régler dans le cahier des charges");
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
  return s;
}

/* ---------- rendu --------------------------------------------------------- */
export function drawMix(){
  if(!stackEl) return;
  drawSeed();
  drawSum();
  drawStack();
  drawIssues();
  drawTray();
}

function drawSeed(){
  if(!seedEl) return;
  while(seedEl.firstChild) seedEl.removeChild(seedEl.firstChild);
  var lb = seedLabel();
  seedEl.appendChild(el("span","segcap","Graine"));
  var inp = document.createElement("input");
  inp.type = "text"; inp.className = "mono"; inp.value = lb;
  inp.size = 7;
  inp.setAttribute("aria-label", "Graine du tirage — retape-la pour rejouer une proposition");
  inp.title = "Retape une graine et rejoue la proposition à l’identique";
  function rejouer(){
    var s = parseSeed(inp.value);
    if(s === null){ inp.value = seedLabel(); return; }
    seed(s);
    repartir({ alea:true, etages: tirerNiveaux });
    selU = null; drawMix(); saveSoon();
  }
  inp.addEventListener("change", rejouer);
  inp.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); rejouer(); } });
  seedEl.appendChild(inp);
}

function drawSum(){
  while(sumEl.firstChild) sumEl.removeChild(sumEl.firstChild);
  var pose = 0, bati = 0, i;
  for(i = 0; i < FLOORS.length; i++){ pose += flArea(i); bati += flBuilt(i); }
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
    "circulation à " + Math.round(CIRC * 100) + " % comprise"));
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
  stackEl.appendChild(addRow("Ajouter un étage",
    "Un niveau de plus au-dessus du dernier. Rien n\u2019y monte tout seul.",
    addFloorTop));
  /* Le niveau le plus haut en tête, le rez en bas, les sous-sols dessous :
     c'est la convention de coupe, la seule qu'un architecte lise sans
     traduire. */
  for(var i = FLOORS.length - 1; i >= 0; i--) stackEl.appendChild(floorNode(i));
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
  var net = flNet(i), cap = usable(i), bati = flBuilt(i), hors = horsAt(i);
  var over = isFinite(cap) && net > cap + 1;
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

  var meta = el("span","mix-fl__meta mono");
  meta.appendChild(document.createTextNode(
    flCount(i) + " pièces · " + fmt(Math.round(net)) + " m² utiles · "
    + fmt(Math.round(bati)) + " m² bâtis"));
  if(hors > 0) meta.appendChild(el("span","mix-fl__hors",
    "+ " + fmt(Math.round(hors)) + " m² hors enveloppe"));
  bar.appendChild(meta);

  /* La hauteur n'est pas un réglage : elle est une conséquence du programme
     porté par le niveau, et c'est elle qui donnera sa silhouette au volume. */
  var h = el("span","mix-fl__h mono", flHeight(i).toFixed(2).replace(".", ",") + " m");
  h.title = "Hauteur de niveau : " + flLibre(i).toFixed(2).replace(".", ",")
    + " m libres + " + RULES.haut.dalle.toFixed(2).replace(".", ",") + " m de dalle";
  bar.appendChild(h);

  bar.appendChild(el("span","spacer"));
  var pct = isFinite(cap) && cap > 0 ? Math.round(net / cap * 100) : 0;
  var tag = el("span", "mix-fl__pct mono" + (over ? " is-over" : ""), pct + " %");
  tag.title = "Part du plateau occupée, circulation comprise";
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
  var cap = usable(i);
  /* Deux bandes, et non une. La cour, la piscine et le chauffage à distance
     sont posés au terrain mais ne pèsent pas sur le plateau : mêlés au reste,
     ils repoussaient la ligne de plateau de 1'400 m² et le dessin ne disait
     plus la même chose que le pourcentage écrit à côté. Ils ont leur bande,
     sous un filet, hors du compte. */
  var net = flNet(i), hors = horsAt(i);
  var capH = isFinite(cap) ? cap * AIRE / W : 0;
  var netH = net * AIRE / W, horsH = hors * AIRE / W;
  var contentH = netH + horsH;
  var H = Math.max(capH, contentH, 34);
  host.style.height = Math.round(H) + "px";

  if(!bl.length){
    host.appendChild(el("p","mix-empty","niveau vide — glisse une pièce ici"));
    return;
  }

  function bande(list, rect){
    if(!list.length || rect.h <= 0) return;
    var fl = famList(list);
    squarify(fl.order.map(function(f){
      var s = 0;
      fl.by[f].forEach(function(b){ s += areaOf(b); });
      return { key:f, v:s };
    }), rect).forEach(function(c){
      squarify(fl.by[c.key].map(function(b){
        return { key:b.u, v:areaOf(b) };
      }), c).forEach(function(r){
        var b = blockOf(r.key);
        if(b) host.appendChild(blockNode(b, r));
      });
    });
  }
  bande(bl.filter(function(b){ return !PMAP[b.key].hors; }), { x:0, y:0, w:W, h:netH });
  if(horsH > 0){
    bande(bl.filter(function(b){ return PMAP[b.key].hors; }),
          { x:0, y:netH, w:W, h:horsH });
    var sep = el("div","mix-hors");
    sep.style.top = netH.toFixed(1) + "px";
    sep.appendChild(el("span", null, "hors enveloppe scolaire · "
      + fmt(Math.round(hors)) + " m²"));
    host.appendChild(sep);
  }

  /* Après les blocs : le pavage remplit son rectangle sans laisser un pixel,
     donc tout repère posé avant lui disparaît sous les blocs. */
  /* Le dépassement se mesure sur la seule bande de l'enveloppe : la bande hors
     enveloppe n'occupe aucun plateau, elle ne peut pas le dépasser. */
  if(isFinite(cap) && netH > capH + 0.5){
    var oz = el("div","mix-over");
    oz.style.top = capH.toFixed(1) + "px";
    oz.style.height = (netH - capH).toFixed(1) + "px";
    host.appendChild(oz);
  }
  if(isFinite(cap) && capH > 6){
    var cl = el("div","mix-cap");
    cl.style.top = capH.toFixed(1) + "px";
    cl.appendChild(el("span", null, "plateau · " + fmt(Math.round(cap)) + " m² utiles"));
    host.appendChild(cl);
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
function pieceGrid(b, r){
  var p = PMAP[b.key];
  if(!pieces || p.solid || b.q < 2) return null;
  var w = r.w - 2, h = r.h - 16;
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
  var rows = Math.ceil(b.q / cols);
  var g = el("div","mixblk__pcs");
  g.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
  for(var i = 0; i < b.q; i++){
    var c = el("span","mixpc");
    c.dataset.u = String(b.u);
    c.dataset.pc = "1";
    g.appendChild(c);
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
  d.style.backgroundColor = "color-mix(in srgb, " + col
    + " calc(var(--fill-op) * 100%), var(--paper))";
  d.style.borderColor = col;
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
  lb.appendChild(el("span","mixblk__a mono", fmt(Math.round(a)) + " m²"));
  d.appendChild(lb);
  var g = pieceGrid(b, r);
  if(g){ d.appendChild(g); d.classList.add("has-pcs"); }
  d.setAttribute("data-tip", p.n + (b.q > 1 ? " ×" + b.q : "")
    + (p.est ? "  (à préciser)" : "") + "|"
    + b.q + " × " + fmt(uOf(b.key)) + " m² = " + fmt(Math.round(a)) + " m²|"
    + FMAP[p.f].name + (p.note ? " · " + p.note : ""));
  d.setAttribute("aria-label", p.n + ", " + b.q + " pièce" + (b.q > 1 ? "s" : "")
    + ", " + fmt(Math.round(a)) + " mètres carrés, "
    + (b.fl === TRAY ? "au bac" : flName(b.fl))
    + ". Flèches haut et bas pour changer de niveau"
    + (b.q > 1 && !p.solid ? ", majuscule pour n’en détacher qu’une pièce" : ""));
  return d;
}

/* ---------- avertissements ------------------------------------------------ */
/* ---------- le contrôle, et ce qu'on en fait -------------------------------
   Un écart qui ne fait que s'afficher laisse tout le travail à faire : on le
   lisait, et il fallait retrouver soi-même le poste, le niveau et le geste. On
   clique dessus, il propose le geste qui le résoudrait — ou de le laisser tel
   quel, ce qui est une décision de projet et non un oubli. */
function drawIssues(){
  while(issuesEl.firstChild) issuesEl.removeChild(issuesEl.firstChild);
  var list = mixCheck(), v = mixVerdict(list);
  var hd = el("div","mix-issues__hd");
  hd.appendChild(el("h3","label","Contrôle"));
  if(v.e) hd.appendChild(el("i","chip chip--danger", v.e + " conflit" + (v.e > 1 ? "s" : "")));
  if(v.w) hd.appendChild(el("i","chip chip--warn", v.w + " à vérifier"));
  if(!v.e && !v.w) hd.appendChild(el("i","chip chip--ok", "rien à signaler"));
  issuesEl.appendChild(hd);

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
      clearAccepts(); openIss = null; issFocus = null; drawMix(); saveSoon();
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
  while(trayEl.firstChild) trayEl.removeChild(trayEl.firstChild);
  var bl = trayBlocks();
  var hd = el("div","mix-tray__hd");
  hd.appendChild(el("h3","label","À placer"));
  var n = 0;
  bl.forEach(function(b){ n += b.q; });
  hd.appendChild(el("span","mono", n + " pièces · " + fmt(Math.round(trayArea())) + " m²"));
  trayEl.appendChild(hd);

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

/* Déplacer, avec ou sans sa grappe. Un seul point de passage : le glisser, le
   glisser et le clavier doivent obéir à l'interrupteur de la même façon. */
function bouger(u, fl){
  return grouper ? moveGroupe(u, fl) : move(u, fl);
}
/* Ce qu'un déplacement groupé emmènerait en plus — pour le dire avant. */
function combien(u){
  if(!grouper) return 0;
  var b = blockOf(u);
  if(!b) return 0;
  var n = 0;
  grappeBlocs(u).forEach(function(x){ if(x.u !== u && x.fl !== b.fl) n += x.q; });
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
  if(unePiece && b.q > 1){
    var nb = split(u, 1);
    if(nb) cu = nb.u;
  }
  bouger(cu, fl);
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
        var seul = drag.pc && b.q > 1;
        var suite = combien(drag.u);
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
    if(!node) return;
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
