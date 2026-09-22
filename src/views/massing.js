/* ============================================================================
   L'ONGLET MASSING

   Troisième temps : le cahier des charges a fixé les surfaces, le mixer les a
   réparties sur des niveaux, le massing les pose sur le terrain. Il ne redit
   rien du programme — il le lit, à chaque dessin. Changer un poste d'étage dans
   le mixer change la volumétrie ici sans qu'on ait à synchroniser quoi que ce
   soit ; et déplacer un volume ici ne touche pas au programme, parce que ce
   n'est pas la même question.

   DEUX TIRAGES, et c'est tout l'outil :

     Shuffle PROGRAMME  rebat la répartition dans les étages — c'est celui du
                        mixer, appelé d'ici. Le massing s'y adapte ;
     Shuffle MASSING    ne touche pas au programme. Mêmes postes, mêmes
                        surfaces, mêmes niveaux, même répartition ; une autre
                        solution architecturale.

   À gauche ce qui commande, au centre le PLAN et la 3D côte à côte. Les deux
   montrent le même modèle : ce qu'on déplace en plan tourne dans la 3D à
   l'instant même.

   Le massing n'essaie pas de finir un projet. Il répond à une question de début
   d'étude : à quoi ce programme ressemblerait-il, physiquement, sur ce site ?
   ========================================================================= */
import { dec, el, fmt } from "../core/format.js";
import { RULES } from "../data/rules.js";
import { lvlOf } from "../mix/floors.js";
import { repartir } from "../mix/shuffle.js";
import { saveSoon } from "../mix/store.js";
import { tirerNiveaux } from "../mix/opts.js";
import { massCheck, massVerdict } from "../mass/checks.js";
import { accept, unaccept } from "../mix/accept.js";
import { requilibre } from "../mass/fix.js";
import { admissible, genMass, noteCourante, poserSecondTemps, rectSol }
  from "../mass/gen.js";
import {
  MASS, PARTIS, PROF_MIN, bilan, bilanTotal, empreintePile, horsEnveloppe,
  massPar, massSet, massVols, niveaux, partiOf, profDe, profMax, profUsuel,
  secondTemps, volHaut, volNiv
} from "../mass/model.js";
import { doctrineSection, noteBloc } from "./doctrine.js";
import { planDraw, planFit, planMount, planOnChange, volDe } from "./plan.js";
import { camFit, camLabel, camVers, vue3dDraw, vue3dMount, vue3dOK, vue3dOnChange,
  vue3dPick } from "./vue3d.js";

var railEl = null, planEl = null, troisEl = null, camEl = null, monte = false;
/* L'alerte ouverte, s'il y en a une. Une seule à la fois : deux panneaux
   ouverts, et l'on ne sait plus lequel désigne le volume sélectionné. */
var openAl = null;

/* ---------- le panneau ------------------------------------------------------ */
export function massPanel(){
  var p = el("section", "mass");
  var grid = el("div", "mass-grid");

  railEl = el("aside", "mass-rail");
  grid.appendChild(railEl);

  var vues = el("div", "mass-vues");
  var cP = el("div", "mass-vue");
  var hP = el("div", "mass-vue__h");
  hP.appendChild(el("h3", "label", "Plan"));
  var bFit = el("button", "btn btn--quiet", "Recadrer");
  bFit.type = "button";
  bFit.addEventListener("click", function(){ planFit(); });
  hP.appendChild(el("span", "spacer"));
  hP.appendChild(bFit);
  cP.appendChild(hP);
  planEl = el("div", "plan");
  cP.appendChild(planEl);
  vues.appendChild(cP);

  var c3 = el("div", "mass-vue");
  var h3 = el("div", "mass-vue__h");
  h3.appendChild(el("h3", "label", "Volume"));
  camEl = el("span", "mass-cam mono", camLabel());
  h3.appendChild(el("span", "spacer"));
  h3.appendChild(camEl);
  c3.appendChild(h3);
  troisEl = el("div", "vue3d");
  c3.appendChild(troisEl);
  vues.appendChild(c3);
  grid.appendChild(vues);
  p.appendChild(grid);

  planOnChange(function(quoi){
    vue3dDraw();
    dessineRail();
    if(quoi === "fin") saveSoon();
  });
  /* D'où l'on regarde, écrit en toutes lettres : sans cela on tourne autour du
     projet sans savoir si l'on est au nord ou au sud, et l'orientation est la
     première chose qu'un massing doit dire. */
  vue3dOnChange(function(){ if(camEl) camEl.textContent = camLabel(); });

  /* La 3D sélectionne comme le plan : c'est le même modèle, il n'y a pas de
     raison qu'un clic y veuille dire autre chose. */
  troisEl.addEventListener("click", function(e){
    if(!vue3dOK()) return;
    var r = e.target.getBoundingClientRect();
    var v = vue3dPick(e.clientX - r.left, e.clientY - r.top);
    MASS.sel = v ? v.id : null;
    planDraw(); vue3dDraw(); dessineRail();
  });

  monte = false;
  return p;
}

/* Appelé après que le panneau est dans le document : le SVG et le canevas ont
   besoin d'une largeur mesurable, et WebGL d'un élément attaché. */
export function drawMass(){
  if(!planEl) return;
  if((!MASS.vol.length || perime()) && aPoser() > 0) regenere();
  planMount(planEl);
  if(!monte){ vue3dMount(troisEl); monte = true; }
  else vue3dDraw();
  dessineRail();
}
export function resizeMass(){
  if(!planEl) return;
  planDraw();
  vue3dDraw();
}

/* Ce que le mixer a effectivement posé. À l'ouverture d'une session neuve, tout
   est au bac : il n'y a alors RIEN à mettre en volume, et le dire vaut mieux que
   dessiner un cube d'un mètre carré. */
function aPoser(){
  var a = 0;
  niveaux().forEach(function(n){ a += n.A; });
  return a;
}
function regenere(){
  massVols(aPoser() > 0 ? genMass() : []);
  MASS.pile = empreintePile();
  MASS.sel = null;
  camFit();
}
/* La pile du mixer a-t-elle changé depuis que cette implantation a été
   composée ? Un volume désigne ses niveaux par leur indice : quand le mixer en
   ajoute ou en retire un, les indices ne veulent plus rien dire, et l'on
   regardait une volumétrie qui répondait à la pile précédente. */
function perime(){
  return !!MASS.vol.length && MASS.pile && MASS.pile !== empreintePile();
}
function redessine(){
  planDraw();
  vue3dDraw();
  dessineRail();
  if(camEl) camEl.textContent = camLabel();
  saveSoon();
}

/* ---------- le rail de gauche ------------------------------------------------
   Dans l'ordre où l'on s'en sert : ce qu'on tire, comment on compose, ce qu'on
   regarde, ce que le contrôle en dit. */
function dessineRail(){
  if(!railEl) return;
  while(railEl.firstChild) railEl.removeChild(railEl.firstChild);
  railEl.appendChild(blocTirage());
  railEl.appendChild(blocParti());
  railEl.appendChild(blocParams());
  railEl.appendChild(blocAffichage());
  railEl.appendChild(blocSel());
  railEl.appendChild(blocBilan());
  railEl.appendChild(blocAlertes());
}

function bloc(titre, chip){
  var b = el("section", "mass-bloc");
  var h = el("div", "mass-bloc__h");
  h.appendChild(el("h3", "label", titre));
  if(chip) h.appendChild(chip);
  b.appendChild(h);
  return b;
}

/* --- les deux tirages ---
   Ils sont côte à côte parce que c'est leur différence qui doit se lire, et le
   texte sous chacun la dit : l'un rebat le programme, l'autre n'y touche pas. */
function blocTirage(){
  var b = bloc("Proposer");
  if(aPoser() <= 0){
    b.appendChild(el("p", "mass-note", "Le mixer n’a encore rien posé : tout le "
      + "programme est au bac, il n’y a donc aucune surface à mettre en volume. "
      + "« Shuffle programme » ci-dessous en propose une répartition, et la "
      + "volumétrie suivra."));
  }
  var r = el("div", "mass-deux");

  var bp = el("button", "btn btn--primary", "Shuffle programme");
  bp.type = "button";
  bp.title = "Rebat la répartition du programme dans les étages — c'est le tirage "
           + "du mixer. La volumétrie s'y adapte.";
  bp.addEventListener("click", function(){
    repartir({ alea:true, etages: tirerNiveaux });
    regenere();
    redessine();
  });
  r.appendChild(bp);

  var bm = el("button", "btn btn--primary", "Shuffle massing");
  bm.type = "button";
  bm.title = "Ne touche pas au programme : mêmes postes, mêmes surfaces, mêmes "
           + "niveaux, même répartition. Une autre solution architecturale.";
  bm.addEventListener("click", function(){
    massSet("graine", (MASS.graine * 1103515245 + 12345) >>> 8 || 1);
    regenere();
    planFit();
    redessine();
  });
  r.appendChild(bm);
  b.appendChild(r);

  var n = el("p", "mass-note");
  n.appendChild(el("b", null, "Shuffle programme "));
  n.appendChild(document.createTextNode("change ce qui est à quel étage. "));
  n.appendChild(el("b", null, "Shuffle massing "));
  n.appendChild(document.createTextNode("garde tout cela et ne change que la forme "
    + "bâtie : nombre de volumes, position, orientation, proportions, hauteurs, retraits."));
  b.appendChild(n);
  return b;
}

/* --- le parti --- */
function blocParti(){
  var b = bloc("Type de massing");
  var g = el("div", "mass-partis");
  PARTIS.forEach(function(P){
    var t = el("button", "btn", P.n);
    t.type = "button";
    t.setAttribute("aria-current", String(MASS.parti === P.id));
    t.title = P.d;
    t.addEventListener("click", function(){
      massSet("parti", P.id);
      regenere();
      redessine();
    });
    g.appendChild(t);
  });
  b.appendChild(g);
  b.appendChild(el("p", "mass-note", partiOf(MASS.parti).d));
  return b;
}

/* --- les réglages ---
   Peu, et chacun avec son chiffre lisible : un curseur sans valeur ne se règle
   pas, il se tâtonne. */
function blocParams(){
  var b = bloc("Paramètres");
  function num(lb, k, min, max, pas, suf){
    var l = el("label", "mass-par");
    l.appendChild(el("span", "mass-par__n", lb));
    var i = document.createElement("input");
    i.type = "number"; i.className = "mono";
    i.min = String(min); i.max = String(max); i.step = String(pas);
    i.value = String(MASS.par[k]);
    i.addEventListener("change", function(){
      var v = parseFloat(String(i.value).replace(",", "."));
      if(!isFinite(v)) { i.value = String(MASS.par[k]); return; }
      massPar(k, Math.max(min, Math.min(max, v)));
      regenere(); redessine();
    });
    l.appendChild(i);
    if(suf) l.appendChild(el("span", "mass-par__u", suf));
    b.appendChild(l);
  }
  /* LA PROFONDEUR SE CHOISIT, SON PLAFOND NON. Un curseur, borné : en bas la
     largeur d'une salle de classe et de son couloir, en haut la petite cote de
     la salle de sport double — le local le plus profond que le règlement nous
     donne à loger. Aucun volume ne franchit ce plafond, ni le générateur ni la
     main. Le champ libre d'avant laissait écrire 46 ; la valeur figée qui l'a
     remplacé ne laissait plus rien essayer, alors que la profondeur est le
     premier choix d'un projet d'école. */
  function cur(lb, k, min, max, val, suf, fin){
    var l = el("label", "mass-cur");
    var h = el("span", "mass-cur__h");
    h.appendChild(el("span", "mass-par__n", lb));
    var chiffre = el("span", "mono", dec(val) + " " + suf);
    h.appendChild(chiffre);
    l.appendChild(h);
    var i = document.createElement("input");
    i.type = "range";
    i.min = String(min); i.max = String(max); i.step = "0.5";
    i.value = String(val);
    /* Le chiffre suit le doigt, la composition ne se rejoue qu'au relâcher :
       trente tirages par glissement rendaient le curseur inutilisable. */
    i.addEventListener("input", function(){
      chiffre.textContent = dec(parseFloat(i.value)) + " " + suf;
    });
    i.addEventListener("change", function(){ fin(parseFloat(i.value)); });
    l.appendChild(i);
    var pp = el("span", "mass-cur__p");
    pp.appendChild(el("span", null, dec(min) + " m · une classe et son couloir"));
    pp.appendChild(el("span", null, dec(max) + " m · la salle de sport"));
    l.appendChild(pp);
    b.appendChild(l);
  }
  num("Nombre de volumes", "nb", 0, 9, 1, "");
  num("Distance entre volumes", "dmin", RULES.dist.entre, 30, 1, "m");
  cur("Profondeur d’un volume", "prof", PROF_MIN, profMax(), profDe(), "m",
    function(x){ massPar("prof", x); regenere(); redessine(); });
  b.appendChild(el("p", "mass-note", "« 0 volume » laisse le parti en décider. "
    + "La distance ne descend pas sous les " + RULES.dist.entre + " m de l’AEAI : "
    + "c’est une règle écrite, pas un réglage."));
  var pn = el("p", "mass-note");
  pn.appendChild(document.createTextNode("La PROFONDEUR MAXIMALE est donnée, elle ne "
    + "se règle pas : le PACom range le site en zone de constructions publiques A, "
    + "SANS gabarit ni hauteur — il n’en impose donc aucune —, et le programme la "
    + "fixe à "));
  pn.appendChild(el("b", null, dec(profMax()) + " m"));
  pn.appendChild(document.createTextNode(", la petite cote de la salle de sport double. "
    + "Au-delà, on bâtirait de la profondeur que personne n’a demandée, et sans jour : "
    + "aucun volume ne la franchit. En deçà, le curseur est à vous ; il part de "));
  pn.appendChild(el("b", null, dec(profUsuel()) + " m"));
  pn.appendChild(document.createTextNode(", deux rangées de salles de classe prises à "
    + "leur surface bâtie — le couloir est déjà dans la circulation."));
  b.appendChild(pn);

  /* --- LE SECOND TEMPS ---
     La piscine et le local de chauffage à distance ne sont pas de l'école. Ne
     rien en dessiner laissait croire que les 900 m² qu'ils prennent sont
     disponibles pour la cour et le stationnement. */
  b.appendChild(el("h4", "label mass-sous", "Second temps"));
  var g2 = el("div", "btn-group");
  g2.setAttribute("role", "group");
  g2.setAttribute("aria-label", "Piscine et local de chauffage à distance");
  [["Deux volumes", "sep"], ["Un seul", "un"], ["Non posés", "non"]].forEach(function(o){
    var t = el("button", "btn", o[0]);
    t.type = "button";
    t.setAttribute("aria-current", String(MASS.second === o[1]));
    t.addEventListener("click", function(){
      massSet("second", o[1]);
      poserSecondTemps(MASS.vol);
      redessine();
    });
    g2.appendChild(t);
  });
  b.appendChild(g2);
  var S2 = secondTemps();
  b.appendChild(el("p", "mass-note", S2.map(function(x){
      return x.n + " " + fmt(Math.round(x.a)) + " m², " + dec(x.h) + " m de haut";
    }).join(" · ") + ". Le règlement les veut indépendants des bâtiments scolaires "
    + "et réalisés plus tard : ils ne pèsent sur aucun plateau et ne comptent pas au "
    + "bilan, mais ils occupent le terrain — et ils se dessinent en pointillé, comme "
    + "au plan de situation. Ils se posent APRÈS l’école, dans les marges du site."));
  return b;
}

/* --- ce qu'on regarde --- */
function blocAffichage(){
  var b = bloc("Affichage");
  var g = el("div", "btn-group");
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", "Couleurs");
  [["Couleurs programme", false], ["Massing monochrome", true]].forEach(function(o){
    var t = el("button", "btn", o[0]);
    t.type = "button";
    t.setAttribute("aria-current", String(MASS.mono === o[1]));
    t.addEventListener("click", function(){ massSet("mono", o[1]); redessine(); });
    g.appendChild(t);
  });
  b.appendChild(g);

  var e = el("div", "mass-etages");
  var all = el("button", "btn", "Tous les étages");
  all.type = "button";
  all.setAttribute("aria-current", String(MASS.etage < 0));
  all.addEventListener("click", function(){ massSet("etage", -1); redessine(); });
  e.appendChild(all);
  niveaux().slice().reverse().forEach(function(n){
    var t = el("button", "btn", court(n.lvl));
    t.type = "button";
    t.title = n.nom + " · " + fmt(Math.round(n.A)) + " m² bâtis · " + dec(n.h) + " m";
    t.setAttribute("aria-current", String(MASS.etage === n.i));
    t.addEventListener("click", function(){ massSet("etage", n.i); redessine(); });
    e.appendChild(t);
  });
  b.appendChild(e);
  return b;
}
function court(l){
  if(l === 0) return "Rez";
  if(l < 0) return l === -1 ? "S-sol" : (-l) + "ᵉ s-sol";
  return "R+" + l;
}

/* --- le volume choisi : ce qu'on peut lui faire à la main ---
   Déplacer et tourner se font dans le plan ; les cotes et le nombre d'étages
   se saisissent, parce qu'un demi-mètre ne se tire pas à la souris. */
function blocSel(){
  var v = MASS.sel ? volDe(MASS.sel) : null;
  var b = bloc("Volume", v ? el("i", "chip chip--soft",
    v.ph ? "second temps" : v.fix ? "cotes imposées" : v.id) : null);
  if(!v){
    b.appendChild(el("p", "mass-note", "Aucun volume choisi. Clique un volume dans le "
      + "plan ou dans la 3D : tu pourras le déplacer en le tirant, et le tourner par "
      + "sa poignée."));
    return b;
  }
  var rc = rectSol(v);
  var l = el("p", "mass-sel__l mono");
  l.textContent = dec(rc.w) + " × " + dec(rc.d) + " m · "
    + fmt(Math.round(rc.w * rc.d)) + " m² au sol · " + volNiv(v) + " niveau"
    + (volNiv(v) > 1 ? "x" : "") + " · " + dec(volHaut(v)) + " m de haut";
  b.appendChild(l);

  if(v.ph){
    b.appendChild(el("p", "mass-note", "Ouvrage du SECOND TEMPS — le règlement le veut "
      + "indépendant des bâtiments scolaires et réalisé plus tard. Il se déplace et se "
      + "tourne comme les autres, aux mêmes distances ; sa surface est au programme, et "
      + "le contrôle dit l’écart si on la change. Il ne porte aucun niveau de la pile : "
      + "sa hauteur est la sienne, " + dec(volHaut(v)) + " m."));
  }
  if(v.fix){
    b.appendChild(el("p", "mass-note", "La salle de sport double tient ses deux cotes du "
      + "règlement — 28 × 32 m, 7,00 m libres sous structure. Elle se déplace et se "
      + "tourne, elle ne se redimensionne pas."));
  } else {
    var r = el("div", "mass-deux");
    cote(r, "Largeur", v, "w");
    cote(r, "Profondeur", v, "d");
    b.appendChild(r);
    b.appendChild(el("p", "mass-note", "Changer une cote change la surface : l’écart au "
      + "programme s’écrit ci-dessous, il n’est pas corrigé en douce."));
  }

  /* Le PORTE-À-FAUX se règle, il ne s'obtient pas par accident. Un étage
     supérieur peut déborder de celui du dessous : le règlement ne l'interdit
     pas, la 3D le dessine et le marque, et le contrôle le chiffre. Il fallait
     pouvoir en faire un — sans quoi « autorisé » ne voulait rien dire. */
  if(volNiv(v) > 1){
    var pfl = el("label", "mass-par");
    pfl.appendChild(el("span", "mass-par__n", "Porte-à-faux du dernier étage"));
    var pfi = document.createElement("input");
    pfi.type = "number"; pfi.className = "mono";
    pfi.min = "-20"; pfi.max = "20"; pfi.step = "0.5";
    pfi.value = String(hautDe(v).dy || 0);
    pfi.addEventListener("change", function(){
      var x = parseFloat(String(pfi.value).replace(",", "."));
      if(!isFinite(x)){ pfi.value = String(hautDe(v).dy || 0); return; }
      var e0 = hautDe(v), av = e0.dy || 0;
      e0.dy = Math.round(x * 10) / 10;
      /* Un porte-à-faux ne fait pas sortir de la parcelle : s'il franchit la
         limite, il n'est pas pris. Le débord est permis, pas le hors-parcelle. */
      if(!admissible(v, MASS.vol)){ e0.dy = av; pfi.value = String(av); }
      redessine();
    });
    pfl.appendChild(pfi);
    pfl.appendChild(el("span", "mass-par__u", "m"));
    b.appendChild(pfl);
  }

  var e = el("div", "mass-deux");
  var moins = el("button", "btn", "− un étage");
  moins.type = "button";
  moins.disabled = v.ph || volNiv(v) <= 1;
  moins.addEventListener("click", function(){ etage(v, -1); });
  e.appendChild(moins);
  var plus = el("button", "btn", "+ un étage");
  plus.type = "button";
  plus.disabled = v.ph
    || volNiv(v) >= niveaux().filter(function(n){ return n.lvl >= 0; }).length;
  plus.addEventListener("click", function(){ etage(v, 1); });
  e.appendChild(plus);
  b.appendChild(e);

  var c = el("button", "btn btn--quiet", "Centrer la vue dessus");
  c.type = "button";
  c.addEventListener("click", function(){ camVers(v); vue3dDraw(); });
  b.appendChild(c);
  return b;
}
function cote(host, lb, v, k){
  var l = el("label", "mass-par");
  l.appendChild(el("span", "mass-par__n", lb));
  var e0 = basDe(v);
  var i = document.createElement("input");
  i.type = "number"; i.className = "mono";
  /* La profondeur est PLAFONNÉE ici aussi. Le générateur ne la franchit pas ;
     la main ne doit pas pouvoir la franchir non plus, sans quoi la règle ne
     serait qu'une préférence du tirage. */
  i.min = "5"; i.max = String(k === "d" ? profMax() : 160); i.step = "0.5";
  i.value = String(e0[k]);
  i.addEventListener("change", function(){
    var x = parseFloat(String(i.value).replace(",", "."));
    if(!isFinite(x) || x < 5){ i.value = String(e0[k]); return; }
    if(k === "d" && x > profMax()){ x = profMax(); i.value = String(x); }
    /* Toute la pile suit la cote du rez : un massing dont chaque étage aurait
       sa propre largeur ne serait plus un volume, mais une pile d'objets. */
    var f = x / e0[k];
    v.lv.forEach(function(e){ e[k] = Math.round(e[k] * f * 10) / 10; });
    redessine();
  });
  l.appendChild(i);
  l.appendChild(el("span", "mass-par__u", "m"));
  host.appendChild(l);
}
/* Le dernier étage hors sol — celui qui peut déborder. */
function hautDe(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i > e.i) e = x;
  });
  return e || v.lv[v.lv.length - 1];
}
function basDe(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i < e.i) e = x;
  });
  return e || v.lv[0];
}
/* Ajouter ou retirer un étage à CE volume : la surface du niveau se rejoue
   entre les corps qui le portent, sinon on créerait ou on perdrait du
   programme — et le programme, lui, ne se change qu'au cahier des charges. */
function etage(v, d){
  var N = niveaux().filter(function(n){ return n.lvl >= 0; });
  var haut = -1;
  v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0 && e.i > haut) haut = e.i; });
  if(d > 0){
    var suiv = null;
    N.forEach(function(n){ if(n.i > haut && (suiv === null || n.i < suiv)) suiv = n.i; });
    if(suiv === null) return;
    var e0 = basDe(v);
    v.lv.push({ i:suiv, w:e0.w, d:e0.d, dx:0, dy:0 });
  } else {
    if(haut < 0) return;
    v.lv = v.lv.filter(function(e){ return e.i !== haut; });
  }
  v.lv.sort(function(a, b){ return a.i - b.i; });
  requilibre();
  redessine();
}

/* --- le bilan : la question à laquelle l'outil doit répondre --- */
function blocBilan(){
  var T = bilanTotal();
  var b = bloc("Surfaces", el("i", "chip chip--"
    + (Math.abs(T.ecart) > Math.max(20, T.demande * .02) ? "warn" : "ok"),
    (T.ecart >= 0 ? "+" : "−") + fmt(Math.round(Math.abs(T.ecart))) + " m²"));
  var t = el("table", "mass-bil");
  bilan().forEach(function(x){
    var tr = el("tr");
    tr.appendChild(el("td", null, x.nom));
    tr.appendChild(el("td", "mono", fmt(Math.round(x.demande))));
    tr.appendChild(el("td", "mono", fmt(Math.round(x.pose))));
    var e = el("td", "mono mass-bil__e", (x.ecart >= 0 ? "+" : "−")
      + fmt(Math.round(Math.abs(x.ecart))));
    if(Math.abs(x.ecart) > Math.max(5, x.demande * .02)) e.classList.add("is-off");
    tr.appendChild(e);
    t.appendChild(tr);
  });
  var hd = el("tr", "mass-bil__h");
  hd.appendChild(el("th", null, "Niveau"));
  hd.appendChild(el("th", null, "Demandé"));
  hd.appendChild(el("th", null, "Posé"));
  hd.appendChild(el("th", null, "Écart"));
  t.insertBefore(hd, t.firstChild);
  b.appendChild(t);

  var H = horsEnveloppe();
  if(H.length){
    var n = el("p", "mass-note");
    n.appendChild(el("b", null, "Hors enveloppe — "));
    n.appendChild(document.createTextNode(H.map(function(h){
      return h.n + " (" + fmt(Math.round(h.a)) + " m²)";
    }).join(" · ") + ". Le règlement les veut indépendants des bâtiments scolaires "
      + "et réalisés au second temps : ils ne comptent dans aucun niveau du bilan. "
      + (MASS.second === "non"
         ? "La piscine et le local CAD ne sont pas posés — ils occupent pourtant du "
           + "terrain, et le réglage « Second temps » les fait apparaître."
         : "La piscine et le local CAD sont posés à part, en pointillé, parce qu’ils "
           + "occupent du terrain que la cour et le stationnement n’auront pas. "
           + "La cour, elle, n’est pas un volume : elle est le vide que la figure tient.")));
    b.appendChild(n);
  }
  return b;
}

/* --- le contrôle --- */
function blocAlertes(){
  var list = massCheck(), v = massVerdict(list);
  var chip = el("i", "chip chip--" + (v.e ? "danger" : v.w ? "warn" : "ok"),
    v.e ? v.e + " erreur" + (v.e > 1 ? "s" : "")
        : v.w ? v.w + " à vérifier" : "rien à signaler");
  var b = bloc("Alertes", chip);

  var vifs = list.filter(function(x){ return !x.ok; });
  var assumes = list.filter(function(x){ return x.ok; });
  b.appendChild(alListe(vifs, false));

  /* « Laisser comme ça » n'efface rien : l'alerte change de rang, va dans une
     liste à part, et se reprend d'un clic. */
  if(assumes.length){
    var ah = el("div", "mass-bloc__h mass-bloc__h--soft");
    ah.appendChild(el("h4", "label", "Laissés tels quels"));
    ah.appendChild(el("i", "chip chip--soft", String(assumes.length)));
    var bAll = el("button", "btn btn--quiet", "Tout reprendre");
    bAll.type = "button";
    bAll.addEventListener("click", function(){
      assumes.forEach(function(x){ unaccept(x.code); });
      openAl = null; redessine();
    });
    ah.appendChild(bAll);
    b.appendChild(ah);
    b.appendChild(alListe(assumes, true));
  }

  b.appendChild(el("p", "mass-note", "Une "
    + "erreur est une règle écrite — le règlement, l’AEAI — ou une géométrie "
    + "impossible ; un « à vérifier » est une règle de projet ou une marge qui se "
    + "discute ; une « info » n’attend aucune correction — un porte-à-faux, un "
    + "gradin, une cage d’escalier à prévoir —, elle est là pour qu’on le sache. "
    + "Une alerte se CLIQUE : elle s’ouvre sur le geste qui la résoudrait, ou sur "
    + "« laisser comme ça »."));
  return b;
}

/* La liste, et le panneau qu'une alerte ouvre. C'est exactement l'interaction du
   mixer, et ce n'est pas un hasard : un écart s'y lit, s'y répare ou s'y assume
   depuis le début, et le massing se contentait de dire. On lisait « volume 2 sort
   du périmètre de 7,49 m » et l'on allait le tirer à la souris jusqu'à ce que le
   message disparaisse. */
function alListe(list, assume){
  var ul = el("ul", "mass-al");
  ["e", "w", "i"].forEach(function(sev){
    list.filter(function(x){ return x.sev === sev; }).forEach(function(x){
      var li = el("li", "mass-al__i is-" + (assume ? "ok" : sev)
        + (openAl === x.code ? " is-open" : ""));
      var bt = el("button", "mass-al__b");
      bt.type = "button";
      bt.setAttribute("aria-expanded", String(openAl === x.code));
      bt.appendChild(el("i", "chip chip--"
        + (assume ? "soft" : sev === "e" ? "danger" : sev === "w" ? "warn" : "soft"),
        assume ? "assumé" : sev === "e" ? "erreur" : sev === "w" ? "à vérifier" : "info"));
      bt.appendChild(el("span", null, x.msg));
      if(x.ref) bt.appendChild(el("span", "mass-al__r", "— art. " + x.ref));
      bt.addEventListener("click", function(){
        openAl = openAl === x.code ? null : x.code;
        /* Le volume en cause se désigne : lire un conflit et devoir ensuite
           chercher le corps à la main, c'était tout le travail laissé à faire. */
        if(openAl && x.vol >= 0 && MASS.vol[x.vol]){
          MASS.sel = MASS.vol[x.vol].id;
          camVers(MASS.vol[x.vol]);
        }
        planDraw(); vue3dDraw(); dessineRail();
      });
      li.appendChild(bt);
      if(openAl === x.code) li.appendChild(alPanneau(x, assume));
      ul.appendChild(li);
    });
  });
  return ul;
}

function alPanneau(x, assume){
  var box = el("div", "mass-al__p");
  if(!x.fixes.length){
    box.appendChild(el("p", "mass-al__w", x.note
      || "Aucun geste du massing ne le résout : cela se joue plus loin, au dessin."));
  } else if(x.note){
    box.appendChild(el("p", "mass-al__w", x.note));
  }
  x.fixes.forEach(function(f){
    var t = el("button", "btn mass-act", f.label);
    t.type = "button";
    if(f.hint) t.appendChild(el("span", "mass-why", f.hint));
    t.addEventListener("click", function(){
      /* Un remède qui échoue ne laisse pas la composition entamée : `fix.js`
         remet en place et rend `false`. On le dit plutôt que de faire croire à
         un geste sans effet. */
      if(f.run() === false){
        t.appendChild(el("span", "mass-why", "— sans effet : rien d’admissible à "
          + "cette place. Essayez un autre geste."));
        return;
      }
      openAl = null;
      camFit();
      redessine();
      return;
    });
    box.appendChild(t);
  });
  var bo = el("button", "btn btn--quiet mass-act",
    assume ? "Reprendre cette alerte" : "Laisser comme ça");
  bo.type = "button";
  bo.appendChild(el("span", "mass-why", assume
    ? "elle revient au contrôle et recompte dans le verdict"
    : "elle quitte le verdict et passe dans « laissés tels quels »"));
  bo.addEventListener("click", function(){
    if(assume) unaccept(x.code); else accept(x.code);
    openAl = null;
    redessine();
  });
  box.appendChild(bo);
  return box;
}

/* ---------- le volet « Contraintes » ----------------------------------------
   Le massing POSE une volumétrie ; ce volet dit ce qui la gouverne, et le
   règle. Il porte en tête la NOTE de la composition à l'écran, critère par
   critère : c'est la réponse à « pourquoi obtient-on ce résultat », et sans
   elle les poids se règlent à l'aveugle.

   La navigation est injectée plutôt qu'importée : `render.js` importe déjà ce
   module, et l'importer en retour ferait un cycle. */
var massNav = null;
export function setMassNav(f){ massNav = f; }

export function massDoctrine(){
  /* On arrive parfois ici SANS être passé par la volumétrie — un lien direct,
     un rechargement sur `#massing/contraintes`. La note n'aurait alors rien à
     montrer, alors que le programme, lui, est réparti. */
  if((!MASS.vol.length || perime()) && aPoser() > 0) regenere();
  return doctrineSection("mass", function(){
    if(aPoser() > 0){
      massSet("graine", (MASS.graine * 1103515245 + 12345) >>> 8 || 1);
      regenere();
      saveSoon();
    }
    if(massNav) massNav("volumetrie");
  }, noteBloc(noteCourante()));
}
