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
import { parseSeed } from "../core/rand.js";
import { RULES } from "../data/rules.js";
import { lvlOf } from "../mix/floors.js";
import { repartir } from "../mix/shuffle.js";
import { saveSoon } from "../mix/store.js";
import { dePile } from "../mix/opts.js";
import { massCheck, massVerdict } from "../mass/checks.js";
import { accept, unaccept } from "../mix/accept.js";
import { requilibre } from "../mass/fix.js";
import { dansPerimetre, genMass, poser, rectSol } from "../mass/gen.js";
import { TOITS, arDe, capCote, jeuDe, jeuNiveaux } from "../mass/archi.js";
import { objMassing } from "../mass/export.js";
import { evaluationCourante } from "../mass/mesures.js";
import { V, reculVise } from "../data/cadre.js";
import { OPTIONS } from "../data/leviers.js";
import { noter } from "../data/jugement.js";
import { ligne } from "../data/lignes.js";
import {
  MASS, PARTIS, auModule, bilan, bilanTotal, empreintePile, horsEnveloppe,
  massLev, massSet, massVols, niveaux, partiOf, plageVue,
  volHaut, volNiv
} from "../mass/model.js";
import { moyennesMain } from "../net/variantes.js";
import { deBtn } from "./mixer.js";
import { apercu } from "./rendu.js";
import { planDiagrammes } from "../rendu/diagramme.js";
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
  if(((!MASS.vol.length && !MASS.vol.impossible) || perime()) && aPoser() > 0) regenere();
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
  /* un tirage qui casse ne laisse pas un écran muet : l'erreur se dit au rail */
  try { poser(aPoser() > 0 ? genMass() : []); }
  catch(e){ console.error(e); massVols([]); MASS.vol.erreur = e.message || String(e); }
  MASS.pile = empreintePile();
  MASS.sel = null;
  camFit();
}
/* La pile du mixer a-t-elle changé depuis que cette implantation a été
   composée ? Un volume désigne ses niveaux par leur indice : quand le mixer en
   ajoute ou en retire un, les indices ne veulent plus rien dire, et l'on
   regardait une volumétrie qui répondait à la pile précédente. */
function perime(){
  return (!!MASS.vol.length || !!MASS.vol.impossible) && MASS.pile && MASS.pile !== empreintePile();
}
function redessine(){
  planDraw();
  vue3dDraw();
  dessineRail();
  if(camEl) camEl.textContent = camLabel();
  saveSoon();
}
/* Rejouer le massing sur une seed : celle que tire « Shuffle massing », ou
   celle qu'on retape. UN seul chemin pour les deux — sans quoi une seed
   retapée pourrait rendre autre chose que ce que le tirage avait montré. */
function rejouerMassing(g){
  massSet("graine", g);
  regenere();
  planFit();
  redessine();
}
/* La seed suivante. Jamais nulle : `setMass()` ne relit pas un zéro, et la
   volumétrie enregistrée ne se retrouverait plus. */
function graineSuivante(){ return (MASS.graine * 1103515245 + 12345) >>> 8 || 1; }
/* Elle s'écrit comme celle du mixer, en base 36 : c'est l'écriture que
   `parseSeed()` relit. */
function seedMass(){ return (MASS.graine >>> 0).toString(36); }

/* ---------- le rail de gauche ------------------------------------------------
   Dans l'ordre où l'on s'en sert : ce qu'on tire, comment on compose, ce qu'on
   regarde, ce que le contrôle en dit, ce qu'on emporte. */
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
  railEl.appendChild(blocDiagramme());
  railEl.appendChild(blocExport());
}

/* --- le diagramme de la composition ---
   La planche de diagrammes du rendu, refaite à chaque génération : c'est le
   raisonnement qui mène à ce volume. Elle se calcule après l'affichage (la
   mobilité prend une seconde), et une fois par volumétrie. */
var DIAG = { vol:null, el:null };
function blocDiagramme(){
  var b = bloc("Diagramme");
  b.classList.add("mass-diag");
  if(!MASS.vol.length){ b.appendChild(el("p", "mass-note", "Aucune volumétrie posée.")); return b; }
  if(DIAG.vol === MASS.vol && DIAG.el){ b.appendChild(DIAG.el); }
  else {
    var at = el("p", "mass-note", "Calcul du diagramme…");
    b.appendChild(at);
    var v = MASS.vol;
    setTimeout(function(){
      if(v !== MASS.vol) return;
      v.ponts = MASS.pont;
      var d = apercu(planDiagrammes(v));
      d.title = "Ouvrir les planches du rendu";
      d.addEventListener("click", function(){ location.hash = "#rendu/massing"; });
      DIAG = { vol:v, el:d };
      if(at.parentNode) at.replaceWith(d);
    }, 60);
  }
  b.appendChild(el("p", "mass-note", "Le raisonnement, du site au volume. En A2 dans l'onglet Rendu."));
  return b;
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
    repartir({ alea:true, etages: dePile });
    regenere();
    redessine();
  });
  r.appendChild(bp);

  var bm = el("button", "btn btn--primary", "Shuffle massing");
  bm.type = "button";
  bm.title = "Ne touche pas au programme : mêmes postes, mêmes surfaces, mêmes "
           + "niveaux, même répartition. Une autre solution architecturale.";
  /* Shuffle massing montre la PROPOSITION SUIVANTE du classement ; au bout du
     classement, il tire une nouvelle seed. La seed reste donc la même tant qu'on
     parcourt le classement qu'elle a produit : elle et le rang désignent la
     proposition à l'écran. */
  bm.addEventListener("click", function(){
    var P = MASS.vol.props, k = MASS.vol.rang;
    if(P && k != null && k + 1 < P.length){
      poser(P[k + 1]);
      planFit();
      redessine();
    } else rejouerMassing(graineSuivante());
  });
  r.appendChild(bm);
  r.appendChild(champSeed());
  b.appendChild(r);

  /* LA NOTE DU JURY pour le bâtiment à l'écran — le jugement, qui ne sait rien
     de la façon dont il a été produit. Une composition hors cadre est notée
     comme les autres ; le cadre, lui, se dit à côté. */
  if(MASS.vol.length){
    var ev = evaluationCourante(), sc = el("div", "mass-score");
    var j = ev ? noter(ev.mes, null, moyennesMain()) : null;
    sc.appendChild(el("b", "mass-score__n mono" + (ev && ev.invalide ? " is-bas" : ""),
      j && j.total != null ? j.total + "/100" : "—"));
    sc.appendChild(el("span", null, "au jugement"
      + (ev && ev.invalide ? " · hors du cadre opposable : invalide"
         : ev && ev.notifie ? " · hors du cadre choisi, voir le contrôle" : " · dans le cadre")
      + (MASS.vol.props ? " · proposition " + (MASS.vol.rang + 1) + " sur "
        + MASS.vol.props.length + (MASS.parti === "auto" ? ", la mieux orientée de chaque parti" : "")
        : "")));
    b.appendChild(sc);
  }

  /* RIEN À L'ÉCRAN : on dit pourquoi, ici, là où l'on vient de cliquer — le
     volet Contraintes le détaille avec ses remèdes */
  if(!MASS.vol.length && (MASS.vol.impossible || MASS.vol.erreur) && aPoser() > 0){
    var pq = MASS.vol.erreur ? "Le générateur s'est arrêté sur une erreur : " + MASS.vol.erreur
      : (massCheck()[0] || {}).msg;
    if(pq) b.appendChild(el("p", "mass-note is-bas", pq));
  }

  var n = el("p", "mass-note");
  n.appendChild(el("b", null, "Shuffle programme "));
  n.appendChild(document.createTextNode("change ce qui est à quel étage. "));
  n.appendChild(el("b", null, "Shuffle massing "));
  n.appendChild(document.createTextNode("garde tout cela et ne change que la forme "
    + "bâtie : nombre de volumes, position, orientation, proportions, hauteurs, retraits."));
  b.appendChild(n);
  return b;
}
/* LA SEED du massing, sous le bouton qu'elle rejoue. Sans elle, une
   implantation tirée ne se retrouvait plus : on tirait dix fois, la troisième
   était la bonne, et elle n'existait plus. C'est le champ du mixer à
   l'identique — base 36, retapée puis Entrée, et la même volumétrie revient,
   pourvu que le programme et le parti soient les mêmes. Elle s'appelle
   « Seed » à l'écran ; dans le code, elle reste `MASS.graine`. */
function champSeed(){
  var s = el("div", "mass-seed");
  s.appendChild(el("span", "segcap", "Seed"));
  var inp = document.createElement("input");
  inp.type = "text"; inp.className = "mono"; inp.value = seedMass();
  inp.size = 7; inp.spellcheck = false; inp.autocomplete = "off";
  inp.setAttribute("aria-label", "Seed du tirage massing — retape-la pour rejouer "
    + "la même volumétrie");
  inp.title = "Retape une seed et rejoue la volumétrie à l’identique";
  /* Entrée rejoue, et le rail se redessine : l'ancien champ sort du document
     et peut encore lancer son « change ». Un tirage suffit. */
  var joue = false;
  function rejouer(clavier){
    if(joue) return;
    var g = parseSeed(String(inp.value).replace(/^\s*seed[\s:]+/i, ""));
    if(!g){ inp.value = seedMass(); return; }
    joue = true;
    rejouerMassing(g);
    /* Au clavier, on reste dans le champ : on retape souvent deux seeds de
       suite pour les comparer. */
    var neuf = clavier && railEl ? railEl.querySelector(".mass-seed input") : null;
    if(neuf) neuf.focus();
  }
  inp.addEventListener("change", function(){ rejouer(false); });
  inp.addEventListener("keydown", function(e){
    if(e.key === "Enter"){ e.preventDefault(); rejouer(true); }
  });
  s.appendChild(inp);
  return s;
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

/* --- les leviers ---
   Ce que « Shuffle massing » tire, chacun avec le dé du mixer : allumé, le
   hasard le tire dans son domaine ; éteint, la valeur est la nôtre. Toucher
   une valeur la fige. Le parti a ses boutons au-dessus — Auto est son dé. Les
   domaines, eux, sont au groupe : Paramètres & contraintes. */
function blocParams(){
  var b = bloc("Leviers");
  /* Un levier touché rejoue la volumétrie à l'instant, comme un parti choisi :
     le classement d'avant répondait à d'autres leviers. */
  function relever(){ saveSoon(); regenere(); redessine(); }
  var ul = el("ul", "mass-lev");
  function rangee(id, etat, onDe, ctl){
    var l = ligne(id), li = el("li");
    li.appendChild(el("span", "mass-lev__n", l.n));
    li.appendChild(deBtn(etat, l.n, onDe));
    if(ctl) li.appendChild(ctl);
    ul.appendChild(li);
  }
  function opts(k, id){
    var v = MASS.lev[k], sel = null;
    if(v != null){
      sel = el("select", "mass-lev__s");
      sel.setAttribute("aria-label", ligne(id).n);
      OPTIONS[k].forEach(function(o){
        var op = el("option", null, o.n); op.value = o.id; op.selected = o.id === v; sel.appendChild(op);
      });
      sel.addEventListener("change", function(){ massLev(k, sel.value); relever(); });
    }
    rangee(id, v == null, function(on){
      massLev(k, on ? null : OPTIONS[k][0].id); relever();
    }, sel);
  }
  opts("cap", "lev-cap");
  opts("sport", "lev-sport");
  opts("ponts", "lev-ponts");
  ["toit", "pf", "jeu", "puits", "entree", "rampe", "sous"].forEach(function(k){ opts(k, "lev-" + k); });
  var pf = null;
  if(MASS.lev.prof != null){
    pf = el("input", "mono mass-lev__s");
    pf.type = "number"; pf.step = "0.5"; pf.min = "1"; pf.value = String(MASS.lev.prof);
    pf.setAttribute("aria-label", "Profondeur fixée, en m");
    pf.addEventListener("change", function(){
      var x = parseFloat(String(pf.value).replace(",", "."));
      if(isFinite(x)) massLev("prof", x);
      relever();
    });
  }
  rangee("lev-prof", MASS.lev.prof == null, function(on){
    massLev("prof", on ? null : Math.round((V.profMin + V.profMax) / 2)); relever();
  }, pf);
  var sc = null;
  if(MASS.second !== "auto"){
    sc = el("select", "mass-lev__s");
    sc.setAttribute("aria-label", "Second temps");
    [["un", "Réunis"], ["sep", "Séparés"], ["non", "Non représentés"]].forEach(function(o){
      var op = el("option", null, o[1]); op.value = o[0]; op.selected = o[0] === MASS.second; sc.appendChild(op);
    });
    sc.addEventListener("change", function(){ massSet("second", sc.value); relever(); });
  }
  rangee("lev-second", MASS.second === "auto", function(on){
    massSet("second", on ? "auto" : "sep"); relever();
  }, sc);
  b.appendChild(ul);
  b.appendChild(el("p", "mass-note", "Toucher un levier rejoue la volumétrie. Domaines, cadre, orientation "
    + "et jugement : Paramètres & contraintes."));
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

  b.appendChild(plageEtages());
  return b;
}
/* LES ÉTAGES MONTRÉS, au plan comme dans la 3D : deux poignées sur la pile, un
   cran par étage. Toute la plage, c'est tout le bâtiment ; les deux poignées
   sur le même cran, un seul étage.
   Fait main plutôt que deux `<input type="range">` superposés : deux poignées
   sur le même cran, l'input du dessus prenait tout, et l'on ne pouvait plus
   rouvrir la plage vers le bas. Ici on prend la poignée la plus proche, et sur
   un même cran celle du côté où l'on tire. Glisser redessine le plan et la 3D,
   pas le rail : le curseur qu'on tient ne se refait pas sous la main. */
function plageEtages(){
  var N = niveaux(), max = N.length - 1, w = el("div", "mass-plage");
  if(max < 1) return w;
  var val = plageVue().slice(), tient = -1;
  var piste = el("div", "mass-plage__piste");
  piste.appendChild(el("span", "mass-plage__fil"));
  var po = ["bas", "haut"].map(function(c, k){
    var g = el("span", "mass-plage__glis mass-plage__glis--" + c);
    var t = el("span", "mass-plage__poi");
    t.tabIndex = 0;
    t.setAttribute("role", "slider");
    t.setAttribute("aria-label", k ? "Étage le plus haut montré" : "Étage le plus bas montré");
    t.setAttribute("aria-valuemin", "0");
    t.setAttribute("aria-valuemax", String(max));
    t.addEventListener("keydown", function(e){
      var d = { ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1, Home:-max, End:max }[e.key];
      if(!d) return;
      e.preventDefault();
      regler(k, val[k] + d);
    });
    g.appendChild(t);
    piste.appendChild(g);
    return t;
  });
  var crans = el("div", "mass-plage__crans");
  var labs = N.map(function(n, i){
    var s = el("span", null, court(n.lvl));
    s.style.setProperty("--t", String(i / max));
    crans.appendChild(s);
    return s;
  });
  w.appendChild(piste);
  w.appendChild(crans);

  function poser(){
    w.style.setProperty("--lo", String(val[0] / max));
    w.style.setProperty("--hi", String(val[1] / max));
    labs.forEach(function(s, i){ s.classList.toggle("is-vu", i >= val[0] && i <= val[1]); });
    po.forEach(function(t, k){
      t.setAttribute("aria-valuenow", String(val[k]));
      t.setAttribute("aria-valuetext", N[val[k]].nom);
    });
  }
  function regler(k, v){
    v = Math.max(k ? val[0] : 0, Math.min(k ? max : val[1], v));
    if(v === val[k]) return;
    val[k] = v;
    massSet("etages", val[0] === 0 && val[1] === max ? null : val.slice());
    poser(); planDraw(); vue3dDraw(); saveSoon();
  }
  function cran(e){
    var r = piste.getBoundingClientRect();
    return Math.max(0, Math.min(max, Math.round((e.clientX - r.left) / Math.max(1, r.width) * max)));
  }
  function prendre(k){ tient = k; po[k].classList.add("is-tenu"); po[k].focus({ preventScroll:true }); }
  piste.addEventListener("pointerdown", function(e){
    if(e.button !== 0) return;
    var v = cran(e);
    piste.setPointerCapture(e.pointerId);
    e.preventDefault();
    /* Sur les deux poignées réunies, on attend de savoir de quel côté on tire. */
    if(val[0] === val[1] && v === val[0]){ tient = -2; return; }
    prendre(val[0] === val[1] ? (v < val[0] ? 0 : 1)
                              : Math.abs(v - val[0]) <= Math.abs(v - val[1]) ? 0 : 1);
    regler(tient, v);
  });
  piste.addEventListener("pointermove", function(e){
    if(tient === -1) return;
    var v = cran(e);
    if(tient === -2){
      if(v === val[0]) return;
      prendre(v < val[0] ? 0 : 1);
    }
    regler(tient, v);
  });
  function lacher(){
    tient = -1;
    po.forEach(function(t){ t.classList.remove("is-tenu"); });
  }
  piste.addEventListener("pointerup", lacher);
  piste.addEventListener("pointercancel", lacher);
  poser();
  return w;
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
      if(!dansPerimetre(v)){ e0.dy = av; pfi.value = String(av); }
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

  b.appendChild(blocArchi(v));

  var c = el("button", "btn btn--quiet", "Centrer la vue dessus");
  c.type = "button";
  c.addEventListener("click", function(){ camVers(v); vue3dDraw(); });
  b.appendChild(c);
  return b;
}
/* L'ARCHITECTURE du volume : ce que le cube a de plus qu'une boîte. Les choix
   vivent dans `v.ar`, la géométrie dans `mass/archi.js`. Porte-à-faux,
   passerelles et étages se règlent plus haut et dans les leviers. */
function blocArchi(v){
  var d = el("div", "mass-archi"), ar = arDe(v);
  d.appendChild(el("h4", "mass-archi__t", "Architecture"));
  function poser(k, x){ var a = arDe(v); a[k] = x; v.ar = a; redessine(); }
  function liste(lb, k, o){
    var l = el("label", "mass-par"), sel = el("select", "mass-lev__s");
    l.appendChild(el("span", "mass-par__n", lb));
    o.forEach(function(x){
      var op = el("option", null, x.n); op.value = String(x.id); op.selected = String(x.id) === String(ar[k]);
      sel.appendChild(op);
    });
    sel.addEventListener("change", function(){ poser(k, k === "toit" ? sel.value : +sel.value); });
    l.appendChild(sel);
    d.appendChild(l);
  }
  function nombre(lb, val, u, min, max, pas, ok){
    var l = el("label", "mass-par"), i = document.createElement("input");
    l.appendChild(el("span", "mass-par__n", lb));
    i.type = "number"; i.className = "mono"; i.min = min; i.max = max; i.step = pas; i.value = String(val);
    i.addEventListener("change", function(){
      var x = parseFloat(String(i.value).replace(",", "."));
      if(!isFinite(x) || !ok(Math.max(+min, Math.min(+max, x)))) i.value = String(val);
    });
    l.appendChild(i);
    l.appendChild(el("span", "mass-par__u", u));
    d.appendChild(l);
  }
  var cotes = [{ id:-1, n:"Aucune" }].concat([0, 1, 2, 3].map(function(s){
    return { id:s, n:"Façade " + capCote(v, s) };
  }));
  liste("Toiture", "toit", TOITS);
  nombre("Puits de lumière", ar.puits, "", "0", "12", "1", function(x){ poser("puits", Math.round(x)); return true; });
  liste("Entrée (auvent)", "entree", cotes);
  liste("Rampe", "rampe", cotes);
  liste("Sous-passage", "sous", [{ id:0, n:"Aucun" }, { id:1, n:"Au rez, de part en part" }]);
  if(volNiv(v) > 1 && !v.fix){
    nombre("Jeu de niveaux", jeuDe(v), "m", "-10", "10", "0.5", function(x){
      var av = v.lv.map(function(e){ return e.dx || 0; });
      jeuNiveaux(v, Math.round(x * 2) / 2);
      /* comme le porte-à-faux : permis tant qu'il reste dans la parcelle */
      if(!dansPerimetre(v)){ v.lv.forEach(function(e, k){ e.dx = av[k]; }); return false; }
      redessine(); return true;
    });
  }
  if(ar.sous) d.appendChild(el("p", "mass-note", "Le sous-passage traverse le rez : les "
    + "locaux qu’il coupe restent comptés au programme, ils sont à reloger."));
  return d;
}
function cote(host, lb, v, k){
  var l = el("label", "mass-par");
  l.appendChild(el("span", "mass-par__n", lb));
  var e0 = basDe(v);
  var i = document.createElement("input");
  i.type = "number"; i.className = "mono";
  /* Libre : les dimensions souhaitées ne bloquent pas, elles se notent. Seul
     le module s'applique à la main comme au générateur. */
  i.min = String(V.module); i.step = String(V.module);
  i.value = String(e0[k]);
  i.addEventListener("change", function(){
    var x = parseFloat(String(i.value).replace(",", "."));
    if(!isFinite(x) || x < V.module){ i.value = String(e0[k]); return; }
    x = auModule(x);
    i.value = String(x);
    /* Toute la pile suit la cote du rez : un massing dont chaque étage aurait
       sa propre largeur ne serait plus un volume, mais une pile d'objets. */
    var f = x / e0[k];
    v.lv.forEach(function(e){ e[k] = auModule(e[k] * f); });
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
           + "terrain."
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

/* --- ce qu'on emporte ---
   Le massing se poursuit dans Rhino, sur le relevé du géomètre. Le fichier est
   écrit par `mass/export.js` ; ici, on ne fait que le donner. La ligne sous le
   bouton dit les deux cases de l'import qui décident de tout : une case mal
   cochée, et le projet se couche sur le flanc ou arrive sur un seul calque. */
function blocExport(){
  var b = bloc("Exporter");
  var t = el("button", "btn", "Exporter pour Rhino (.obj)");
  t.type = "button";
  t.addEventListener("click", telecharger);
  b.appendChild(t);
  b.appendChild(el("p", "mass-note", "Coordonnées du relevé DOC/site_plan.3dm, en "
    + "centimètres, Z vers le haut : le fichier s’y pose en place. À l’import, ne coche "
    + "pas « Map OBJ Y to Rhino Z » et coche « Import OBJ groups as layers » — un calque "
    + "par niveau, plus le périmètre et le recul de " + dec(reculVise(), 0)
    + " m, drapés sur le terrain."));
  return b;
}
function telecharger(){
  var url = URL.createObjectURL(new Blob([objMassing()], { type:"text/plain" }));
  var a = document.createElement("a");
  a.href = url;
  a.download = "saxon-massing-" + seedMass() + ".obj";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Révoquer dans la foulée du clic coupe le téléchargement dans certains
     navigateurs : on lui laisse le temps de partir. */
  setTimeout(function(){ URL.revokeObjectURL(url); }, 40000);
}

/* ---------- le volet « Contraintes » ----------------------------------------
   Le massing POSE une volumétrie ; ce volet dit ce qui la gouverne. C'est la
   page Paramètres & contraintes filtrée sur le massing (`render.js` la pose),
   chaque ligne disant ce qu'elle pense de la composition à l'écran, et le
   jugement en tête : c'est la réponse à « pourquoi obtient-on ce résultat ».

   La navigation est injectée plutôt qu'importée : `render.js` importe déjà ce
   module, et l'importer en retour ferait un cycle. */
var massNav = null;
export function setMassNav(f){ massNav = f; }

/* On arrive parfois au volet SANS être passé par la volumétrie — un lien
   direct, un rechargement sur `#massing/contraintes`. Les lignes n'auraient
   alors rien à dire, alors que le programme, lui, est réparti. */
export function massPrepare(){
  if(((!MASS.vol.length && !MASS.vol.impossible) || perime()) && aPoser() > 0) regenere();
}
export function massRejouer(){
  if(aPoser() > 0){
    massSet("graine", graineSuivante());
    regenere();
    saveSoon();
  }
  if(massNav) massNav("volumetrie");
}
