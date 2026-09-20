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

   Trois gestes : glisser un bloc d'un niveau à l'autre, cliquer pour le
   déplacer ou le scinder au clavier, et demander une proposition — ordonnée
   ou tirée au sort.
   ========================================================================= */
import { el, fmt } from "../core/format.js";
import { CIRC, CIRCA, FMAP } from "../core/model.js";
import { curSeed, parseSeed, seed, seedLabel } from "../core/rand.js";
import { squarify } from "../core/treemap.js";
import { view } from "../core/viewstate.js";
import { RULES } from "../data/rules.js";
import { accept, clearAccepts, unaccept } from "../mix/accept.js";
import { mixCheck, mixVerdict } from "../mix/checks.js";
import {
  FLOORS, PLATE_MAX, PLATE_MIN, SUB_MAX, TRAY,
  areaOf, blockOf, flArea, flBuilt, flCount, flHeight,
  flLibre, flName, flNet, horsAt, lvlOf, move, nSub, nUp, onFloor, resetBlocks,
  setPlate, setStack, split, stackCost, toTray, trayArea, trayBlocks, usable
} from "../mix/floors.js";
import { PMAP, aOf, posesDedans, qOf, uOf } from "../mix/prog.js";
import { rangeOf, repartir } from "../mix/shuffle.js";
import { saveSoon, setChip } from "../mix/store.js";

/* Surface d'un mètre carré, en pixels carrés. Constante pour toute la vue :
   c'est ce qui permet de comparer deux niveaux d'un coup d'œil. */
var AIRE = 70;
var TINY_W = 46, TINY_H = 21;

var stackEl = null, issuesEl = null, trayEl = null, sumEl = null, seedEl = null, editEl = null;
var popEl = null, ghostEl = null;
var tirerNiveaux = false, selU = null, drag = null, wired = false;
/* Le code de l'écart déplié, s'il y en a un. Un seul à la fois : ouvrir le
   suivant referme le précédent, comme un menu. */
var openIss = null;

/* ---------- construction du panneau --------------------------------------- */
export function mixPanel(){
  var p = el("section","mix");

  /* --- barre d'outils --- */
  var bar = el("div","controls mix-bar");

  var g = el("div","btn-group");
  g.setAttribute("role","group");
  g.setAttribute("aria-label","Proposer une répartition");
  g.appendChild(el("span","segcap","Proposer"));
  var bOrd = el("button","btn","Répartir");
  bOrd.type = "button";
  bOrd.title = "L'ordre des chapitres du règlement, sans hasard";
  bOrd.addEventListener("click", function(){ proposer(false); });
  var bAle = el("button","btn","Shuffle");
  bAle.type = "button";
  bAle.title = "Une autre répartition, tirée au sort";
  bAle.addEventListener("click", function(){ proposer(true); });
  g.appendChild(bOrd); g.appendChild(bAle);
  bar.appendChild(g);

  /* La graine est ce qui rend une proposition retrouvable : sans elle, on tire
     dix fois et la troisième, qui était la bonne, n'existe plus. */
  seedEl = el("div","mix-seed");
  bar.appendChild(seedEl);

  var lab = el("label","mix-opt");
  var cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = tirerNiveaux;
  cb.addEventListener("change", function(){ tirerNiveaux = cb.checked; });
  lab.appendChild(cb);
  lab.appendChild(document.createTextNode("tirer aussi le nombre de niveaux"));
  lab.title = "Le tirage déduit la pile de la surface bâtie à loger et du plateau du rez";
  bar.appendChild(lab);

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

  /* Éditer la pile : un rang à part, sous la pile, jamais mêlé aux niveaux
     eux-mêmes — ajouter un étage et choisir un étage sont deux intentions. */
  editEl = el("div","mix-edit-host");
  main.appendChild(editEl);
  grid.appendChild(main);

  var side = el("aside","mix-side");
  side.appendChild(circBlock());
  issuesEl = el("section","mix-issues");
  side.appendChild(issuesEl);
  trayEl = el("section","mix-tray");
  side.appendChild(trayEl);
  grid.appendChild(side);
  p.appendChild(grid);

  popEl = el("div","mix-pop");
  popEl.hidden = true;
  p.appendChild(popEl);

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

function proposer(alea){
  if(alea) seed(null);
  repartir({ alea: alea, etages: alea && tirerNiveaux });
  selU = null;
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

/* ---------- éditer la pile ------------------------------------------------
   La pile se composait à coups d'« Ajouter un étage » / « Retirer l'étage »,
   quatre commandes repliées sous un `<details>` : pour passer d'un rez seul à
   un R+3 avec sous-sol il fallait déplier, puis cliquer quatre fois, sans
   jamais voir la pile qu'on visait. Le nombre d'étages et la présence d'un
   sous-sol sont deux décisions de projet : elles se CHOISISSENT, d'un geste,
   et à découvert. */
var UP_CHOIX = 5;                 /* rez seul, puis R+1 à R+4 */

function pileSeg(caption, n, cur, titre, pick){
  /* `.btn-group` et `.btn`, comme partout ailleurs : le projet a compté jusqu'à
     sept groupes de boutons concurrents, et `.zoomseg` n'a plus de feuille. */
  var g = el("div","btn-group");
  g.setAttribute("role","group");
  g.setAttribute("aria-label", caption + " de la pile");
  g.appendChild(el("span","segcap", caption));
  for(var v = 0; v < n; v++){
    (function(v){
      var b = el("button","btn", String(v));
      b.type = "button";
      b.setAttribute("aria-current", String(v === cur));
      b.title = titre(v);
      b.addEventListener("click", function(){
        if(v === cur) return;
        pick(v);
        selU = null;
        drawMix();
        saveSoon();
      });
      g.appendChild(b);
    })(v);
  }
  return g;
}
function stackEdit(){
  var box = el("div","mix-edit");
  var row = el("div","mix-edit__row");
  var sub = nSub(), up = nUp();

  row.appendChild(pileSeg("Étages", UP_CHOIX, up, function(v){
    var c = stackCost(sub, v);
    return (v === 0 ? "Rez-de-chaussée seul" : "Rez + " + v + " étage" + (v > 1 ? "s" : ""))
         + (c ? " — " + c + " pièce" + (c > 1 ? "s" : "") + " repartiraient au bac" : "");
  }, function(v){ setStack(sub, v); }));

  row.appendChild(pileSeg("Sous-sols", SUB_MAX, sub, function(v){
    var c = stackCost(v, up);
    return (v === 0 ? "Aucun sous-sol" : v === 1 ? "Un sous-sol"
           : v + " sous-sols")
         + (c ? " — " + c + " pièce" + (c > 1 ? "s" : "") + " repartiraient au bac" : "");
  }, function(v){ setStack(v, up); }));

  var bRaz = el("button","btn btn--quiet mix-act","Repartir du programme");
  bRaz.type = "button";
  bRaz.appendChild(el("span","mix-why","tout revient au bac, y compris les parts scindées"));
  bRaz.addEventListener("click", function(){
    resetBlocks(); selU = null; drawMix(); saveSoon();
  });
  row.appendChild(bRaz);
  box.appendChild(row);

  /* La conséquence est écrite, pas seulement mise en `title` : réduire la pile
     défait du travail posé, et cela doit se lire avant le clic. */
  var perdu = 0, v;
  for(v = 0; v < UP_CHOIX; v++) perdu = Math.max(perdu, stackCost(sub, v));
  for(v = 0; v < SUB_MAX; v++) perdu = Math.max(perdu, stackCost(v, up));
  box.appendChild(el("p","mix-why mix-edit__note",
    "Le sous-sol est réservé au technique, au stockage, au nettoyage et à l\u2019abri PC. "
    + (perdu
      ? "Réduire la pile renvoie au bac les pièces des niveaux retirés — jusqu\u2019à "
        + perdu + " d\u2019un seul geste."
      : "Réduire la pile renvoie au bac les pièces des niveaux retirés.")
    + " Les plateaux réglés niveau par niveau sont conservés."));
  return box;
}

/* ---------- rendu --------------------------------------------------------- */
export function drawMix(){
  if(!stackEl) return;
  drawSeed();
  drawSum();
  drawStack();
  drawEdit();
  drawIssues();
  drawTray();
}

/* Les commandes de pile disent leur disponibilité et sa raison : elles se
   refont donc à chaque rendu, comme le reste. */
function drawEdit(){
  if(!editEl) return;
  while(editEl.firstChild) editEl.removeChild(editEl.firstChild);
  editEl.appendChild(stackEdit());
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

function drawStack(){
  while(stackEl.firstChild) stackEl.removeChild(stackEl.firstChild);
  /* Le niveau le plus haut en tête, le rez en bas, les sous-sols dessous :
     c'est la convention de coupe, la seule qu'un architecte lise sans
     traduire. */
  for(var i = FLOORS.length - 1; i >= 0; i--) stackEl.appendChild(floorNode(i));
  /* Le sol, pour que la pile se lise comme une coupe et non comme une liste. */
  stackEl.appendChild(el("div","mix-ground"));
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
  if(r.w < TINY_W || r.h < TINY_H) d.classList.add("is-tiny");

  d.appendChild(el("b", null, p.n + (b.q > 1 ? " ×" + b.q : "")));
  d.appendChild(el("span","mixblk__a mono", fmt(Math.round(a)) + " m²"));
  d.setAttribute("data-tip", p.n + (b.q > 1 ? " ×" + b.q : "")
    + (p.est ? "  (à préciser)" : "") + "|"
    + b.q + " × " + fmt(uOf(b.key)) + " m² = " + fmt(Math.round(a)) + " m²|"
    + FMAP[p.f].name + (p.note ? " · " + p.note : ""));
  d.setAttribute("aria-label", p.n + ", " + b.q + " pièce" + (b.q > 1 ? "s" : "")
    + ", " + fmt(Math.round(a)) + " mètres carrés");
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
      clearAccepts(); openIss = null; drawMix(); saveSoon();
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
      openIss = (openIss === w.code) ? null : w.code;
      drawIssues();
      var again = issuesEl.querySelector("li.is-open .mix-iss");
      if(again) again.focus({ preventScroll:true });
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
      openIss = null; selU = null;
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
    openIss = null;
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

/* ---------- popover : déplacer, scinder -----------------------------------
   Le clavier et le doigt ont le même accès que la souris : le glisser n'est
   jamais le seul chemin. */
function openPop(u, anchor){
  var b = blockOf(u);
  if(!b || !popEl) return;
  selU = u;
  while(popEl.firstChild) popEl.removeChild(popEl.firstChild);
  var p = PMAP[b.key];
  popEl.appendChild(el("h4", null, p.n + (b.q > 1 ? " ×" + b.q : "")));
  popEl.appendChild(el("p","mix-pop__s",
    fmt(Math.round(areaOf(b))) + " m² · " + FMAP[p.f].name));

  var cand = rangeOf(p);
  popEl.appendChild(el("div","mix-pop__l","Déplacer vers"));
  var row = el("div","mix-pop__r");
  for(var i = FLOORS.length - 1; i >= 0; i--){
    (function(i){
      var bt = el("button","btn", flName(i));
      bt.type = "button";
      bt.disabled = (b.fl === i);
      /* Un niveau que le règlement n'admet pas reste cliquable : rien n'est
         empêché. Il est seulement marqué, et le contrôle le dira. */
      if(cand.indexOf(i) < 0) bt.classList.add("is-warn");
      bt.addEventListener("click", function(){
        move(u, i); closePop(); drawMix(); saveSoon();
      });
      row.appendChild(bt);
    })(i);
  }
  var bt0 = el("button","btn","Au bac");
  bt0.type = "button";
  bt0.disabled = (b.fl === TRAY);
  bt0.addEventListener("click", function(){ move(u, TRAY); closePop(); drawMix(); saveSoon(); });
  row.appendChild(bt0);
  popEl.appendChild(row);

  if(b.q > 1 && !p.solid){
    popEl.appendChild(el("div","mix-pop__l","Scinder"));
    var row2 = el("div","mix-pop__r"), vus = {};
    [1, Math.floor(b.q / 2), b.q - 1].forEach(function(v){
      if(v < 1 || v >= b.q || vus[v]) return;
      vus[v] = 1;
      var bs = el("button","btn", v + " sur " + b.q);
      bs.type = "button";
      bs.addEventListener("click", function(){
        var nb = split(u, v);
        closePop();
        drawMix(); saveSoon();
        if(nb) openPopById(nb.u);
      });
      row2.appendChild(bs);
    });
    popEl.appendChild(row2);
  } else if(p.solid){
    popEl.appendChild(el("p","mix-pop__s",
      "Dimensions imposées au règlement : ce poste ne se scinde pas."));
  }

  popEl.hidden = false;
  var host = popEl.offsetParent || popEl.parentNode;
  var hr = host.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
  var x = ar.left - hr.left, y = ar.bottom - hr.top + 6;
  popEl.style.left = Math.max(4, Math.min(x, hr.width - popEl.offsetWidth - 4)) + "px";
  popEl.style.top = y + "px";
  var f = popEl.querySelector("button:not(:disabled)");
  if(f) f.focus();
}
function openPopById(u){
  var node = document.querySelector('[data-u="' + u + '"]');
  if(node) openPop(u, node);
}
function closePop(){
  if(!popEl) return;
  popEl.hidden = true;
  selU = null;
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
    drag = { u: parseInt(node.dataset.u, 10), x0: e.clientX, y0: e.clientY, live:false, el:node };
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
        ghostEl.appendChild(document.createTextNode(
          PMAP[b.key].n + (b.q > 1 ? " ×" + b.q : "") + " · " + fmt(Math.round(areaOf(b))) + " m²"));
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
    var live = drag.live, u = drag.u, node = drag.el;
    node.classList.remove("is-dragging");
    ghostEl.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll(".is-drop"),
      function(n){ n.classList.remove("is-drop"); });
    drag = null;
    if(!live){ openPop(u, node); return; }
    var over = document.elementFromPoint(e.clientX, e.clientY);
    var fl = over && over.closest ? over.closest(".mix-fl") : null;
    var tr = over && over.closest ? over.closest(".mix-tray") : null;
    if(fl){ move(u, parseInt(fl.dataset.floor, 10)); drawMix(); saveSoon(); }
    else if(tr){ move(u, TRAY); drawMix(); saveSoon(); }
  });

  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && popEl && !popEl.hidden){ closePop(); drawMix(); return; }
    if(e.key !== "Enter" && e.key !== " ") return;
    var node = e.target.closest ? e.target.closest(".mixblk") : null;
    if(!node) return;
    e.preventDefault();
    openPop(parseInt(node.dataset.u, 10), node);
  });
  document.addEventListener("pointerdown", function(e){
    if(!popEl || popEl.hidden) return;
    if(e.target.closest && (e.target.closest(".mix-pop") || e.target.closest(".mixblk,.mixchip"))) return;
    closePop();
  }, true);
}

/* Le redimensionnement change la largeur du canevas, donc le pavage. */
export function resizeMix(){
  if(!stackEl) return;
  for(var i = 0; i < FLOORS.length; i++){
    var host = stackEl.querySelector('[data-canvas="' + i + '"]');
    if(host) paintFloor(host, i);
  }
}
