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
import { admissible, genMass, rectSol } from "../mass/gen.js";
import {
  MASS, PARTIS, bilan, bilanTotal, horsEnveloppe, massPar, massSet,
  massVols, niveaux, partiOf, volHaut, volNiv
} from "../mass/model.js";
import { planDraw, planFit, planMount, planOnChange, volDe } from "./plan.js";
import { camFit, camLabel, camVers, vue3dDraw, vue3dMount, vue3dOK, vue3dOnChange,
  vue3dPick } from "./vue3d.js";

var railEl = null, planEl = null, troisEl = null, camEl = null, monte = false;

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
  if(!MASS.vol.length && aPoser() > 0) regenere();
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
  MASS.sel = null;
  camFit();
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
    + "bâtie : nombre de corps, position, orientation, proportions, hauteurs, retraits."));
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
  function cur(lb, k, gauche, droite){
    var l = el("label", "mass-cur");
    var h = el("span", "mass-cur__h");
    h.appendChild(el("span", "mass-par__n", lb));
    h.appendChild(el("span", "mono", Math.round(MASS.par[k] * 100) + " %"));
    l.appendChild(h);
    var i = document.createElement("input");
    i.type = "range"; i.min = "0"; i.max = "100"; i.step = "5";
    i.value = String(Math.round(MASS.par[k] * 100));
    i.addEventListener("change", function(){
      massPar(k, parseInt(i.value, 10) / 100);
      regenere(); redessine();
    });
    l.appendChild(i);
    var p = el("span", "mass-cur__p");
    p.appendChild(el("span", null, gauche));
    p.appendChild(el("span", null, droite));
    l.appendChild(p);
    b.appendChild(l);
  }
  num("Nombre de corps · 0 = au parti", "nb", 0, 9, 1, "");
  num("Profondeur maximale", "prof", 9, 46, 1, "m");
  num("Distance entre corps", "dmin", RULES.dist.entre, 30, 1, "m");
  cur("Force d’alignement", "align", "libre", "aligné");
  cur("Compacité", "compact", "fragmenté", "compact");
  cur("Régularité", "regul", "libre", "régulier");
  cur("Intensité des terrasses", "grad", "plat", "gradins");
  b.appendChild(el("p", "mass-note", "La distance entre corps ne descend pas sous les "
    + RULES.dist.entre + " m de l’AEAI : c’est une règle écrite, pas un réglage. "
    + "Les alignements, eux, sont des préférences — le générateur les cherche, il ne "
    + "s’y soumet pas."));
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
  var b = bloc("Volume", v ? el("i", "chip chip--soft", v.fix ? "cotes imposées" : v.id) : null);
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
  moins.disabled = volNiv(v) <= 1;
  moins.addEventListener("click", function(){ etage(v, -1); });
  e.appendChild(moins);
  var plus = el("button", "btn", "+ un étage");
  plus.type = "button";
  plus.disabled = volNiv(v) >= niveaux().filter(function(n){ return n.lvl >= 0; }).length;
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
  i.min = "5"; i.max = "160"; i.step = "0.5";
  i.value = String(e0[k]);
  i.addEventListener("change", function(){
    var x = parseFloat(String(i.value).replace(",", "."));
    if(!isFinite(x) || x < 5){ i.value = String(e0[k]); return; }
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
/* Après une modification manuelle du nombre d'étages, chaque niveau se
   repartage entre les corps qui le portent : la SOMME doit rester la surface
   bâtie que le mixer demande. Les cotes changent, les mètres carrés non. */
function requilibre(){
  niveaux().forEach(function(n){
    var port = MASS.vol.filter(function(v){
      var ok = false;
      v.lv.forEach(function(e){ if(e.i === n.i) ok = true; });
      return ok;
    });
    if(!port.length) return;
    var som = 0;
    port.forEach(function(v){
      v.lv.forEach(function(e){ if(e.i === n.i) som += e.w * e.d; });
    });
    if(som <= 0) return;
    var k = Math.sqrt(n.A / som);
    port.forEach(function(v){
      v.lv.forEach(function(e){
        if(e.i !== n.i) return;
        e.w = Math.round(e.w * k * 10) / 10;
        e.d = Math.round(e.d * k * 10) / 10;
      });
    });
  });
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
      + "et réalisés au second temps : ils ne comptent pas dans les volumes."));
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
  var ul = el("ul", "mass-al");
  ["e", "w", "i"].forEach(function(sev){
    list.filter(function(x){ return x.sev === sev; }).forEach(function(x){
      var li = el("li", "mass-al__i is-" + sev);
      var bt = el("button", "mass-al__b");
      bt.type = "button";
      bt.appendChild(el("i", "chip chip--"
        + (sev === "e" ? "danger" : sev === "w" ? "warn" : "soft"),
        sev === "e" ? "erreur" : sev === "w" ? "à vérifier" : "info"));
      bt.appendChild(el("span", null, x.msg));
      if(x.ref) bt.appendChild(el("span", "mass-al__r", "— art. " + x.ref));
      bt.addEventListener("click", function(){
        if(x.vol >= 0 && MASS.vol[x.vol]){
          MASS.sel = MASS.vol[x.vol].id;
          camVers(MASS.vol[x.vol]);
          planDraw(); vue3dDraw(); dessineRail();
        }
      });
      li.appendChild(bt);
      ul.appendChild(li);
    });
  });
  b.appendChild(ul);
  b.appendChild(el("p", "mass-note", "Le massing ne refuse rien : on doit pouvoir poser "
    + "un corps à cheval sur la limite pour voir ce que ça donne. Une erreur est une "
    + "règle écrite — le règlement, l’AEAI — ou une géométrie impossible ; un « à "
    + "vérifier » est une règle de projet ou une marge qui se discute."));
  return b;
}

