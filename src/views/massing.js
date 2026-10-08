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
import { fige } from "../core/verrou.js";
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
import { dansPerimetre, empSol, genMass, poser, rectSol } from "../mass/gen.js";
import { TOITS, arDe, capCote, jeuDe, jeuNiveaux } from "../mass/archi.js";
import { dm3Massing } from "../mass/export.js";
import { poserLibres, solides3dm, volsDe3dm } from "../mass/import.js";
import { RHINO } from "../data/site.js";
import { evaluationCourante, rougesTypo } from "../mass/mesures.js";
import { V, reculVise } from "../data/cadre.js";
import { OPTIONS } from "../data/leviers.js";
import { noter } from "../data/jugement.js";
import { actif, ligne, roleDe, roleNom } from "../data/lignes.js";
import {
  MASS, PARTIS, auModule, bilan, bilanTotal, empreintePile, etagesDe, horsEnveloppe,
  massLev, massSet, massVols, niveaux, partiOf, plageVue, profFacade,
  volAire, volHaut, volNiv, volNom
} from "../mass/model.js";
import { CHAP } from "../data/program.js";
import { moyennesMain, setSource, source } from "../net/variantes.js";
import { deBtn } from "./mixer.js";
import { icone } from "./icons.js";
import { planDraw, planFit, planMount, planOnChange, volDe } from "./plan.js";
import { sousShuffle } from "./shuffles.js";
import { camFit, camLabel, camVers, vue3dDraw, vue3dMount, vue3dOK, vue3dOnChange,
  vue3dPick } from "./vue3d.js";

var railEl = null, planEl = null, troisEl = null, camEl = null, barEl = null, selEl = null, vuesEl = null, monte = false;
/* Ce qu'on montre : le plan, la 3D, ou les deux. Une préférence de regard, pas
   une décision de projet : elle ne s'enregistre pas. */
var MONTRE = "deux";
/* L'alerte ouverte, s'il y en a une. Une seule à la fois : deux panneaux
   ouverts, et l'on ne sait plus lequel désigne le volume sélectionné. */
var openAl = null;

/* ---------- le panneau ------------------------------------------------------
   Une nature, un lieu. Le rail suit l'ordre du générateur — proposer, puis
   parti, programme, leviers, cadre, orientation, jugement, et ce qu'on emporte ;
   ce qu'on REGARDE se règle dans la barre posée sur les vues ; le volume qu'on
   a cliqué s'édite sur le plan, là où on l'a cliqué. */
export function massPanel(){
  var p = el("section", "mass");
  var grid = el("div", "mass-grid");

  railEl = el("aside", "mass-rail");
  grid.appendChild(railEl);

  var col = el("div", "mass-main");
  barEl = el("div", "mass-barre");
  barEl.setAttribute("role", "toolbar");
  barEl.setAttribute("aria-label", "Affichage du plan et du volume");
  col.appendChild(barEl);
  var vues = vuesEl = el("div", "mass-vues mass-vues--" + MONTRE);
  var cP = el("div", "mass-vue");
  var hP = el("div", "mass-vue__h");
  hP.appendChild(el("h3", "label", "Plan"));
  cP.appendChild(hP);
  var cadre = el("div", "mass-vue__cadre");
  planEl = el("div", "plan");
  cadre.appendChild(planEl);
  selEl = el("div", "mass-carte");
  selEl.hidden = true;
  cadre.appendChild(selEl);
  cP.appendChild(cadre);
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
  col.appendChild(vues);
  grid.appendChild(col);
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
  /* verrouillé, le Massing ne se recompose pas de lui-même */
  if(!fige("massing") && ((!MASS.vol.length && !MASS.vol.impossible) || perime()) && aPoser() > 0) regenere();
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

/* ---------- le rail de gauche : la chaîne ----------------------------------------
   En tête ce qui PROPOSE, toujours visible. Puis les étapes, dans l'ordre où le
   générateur les franchit (`docs/massing.md`) : chacune dit son état replié, et
   s'ouvre sur ce qui la règle ou la détaille. Le volet Contraintes reste à côté
   pour tout régler ligne à ligne ; les étapes y renvoient.

   Le corps d'une étape ne se construit que si elle est ouverte : le rail se refait
   à chaque geste. */
var OUVERT = { parti:true };
function dessineRail(){
  if(!railEl) return;
  while(railEl.firstChild) railEl.removeChild(railEl.firstChild);
  railEl.appendChild(blocProposer());
  var ev = null;
  try { ev = MASS.vol.length ? evaluationCourante() : null; } catch(e){ console.error(e); }
  var ol = el("ol", "mass-etapes");
  ol.appendChild(etapeParti());
  ol.appendChild(etapeJugement(ev));
  ol.appendChild(etapeProgramme());
  ol.appendChild(etapeLeviers());
  ol.appendChild(etapeCadre(ev));
  ol.appendChild(etapeOrientation(ev));
  railEl.appendChild(ol);
  railEl.appendChild(blocEmporter());
  dessineBarre();
  dessineCarte();
}

/* Une étape : son numéro, son nom, une ligne qui dit ce qu'elle a décidé, et son
   ÉTAT à droite — la seule chose qu'on lise sans l'ouvrir. `ouvrir` : ouverte
   par défaut, tant qu'on ne l'a ni ouverte ni fermée soi-même. */
function etape(id, num, titre, sous, etat, corps, ouvrir){
  var li = el("li", "mass-etape mass-etape--" + id);
  var d = el("details");
  d.open = OUVERT[id] != null ? OUVERT[id] : !!ouvrir;
  var s = el("summary", "mass-etape__s");
  s.appendChild(el("span", "mass-etape__num mono", num));
  var t = el("span", "mass-etape__t");
  t.appendChild(el("b", null, titre));
  if(sous) t.appendChild(el("span", null, sous));
  s.appendChild(t);
  var e = el("span", "mass-etape__e");
  (Array.isArray(etat) ? etat : etat ? [etat] : []).forEach(function(x){ e.appendChild(x); });
  s.appendChild(e);
  s.appendChild(icone("chevron", 14));
  d.appendChild(s);
  var b = el("div", "mass-etape__b");
  d.appendChild(b);
  function remplir(){ if(!d.open || b.firstChild) return; corps(b); }
  d.addEventListener("toggle", function(){ OUVERT[id] = d.open; remplir(); });
  remplir();
  li.appendChild(d);
  return li;
}
function puce(txt, cls, titre){
  var c = el("i", "chip chip--" + cls, txt);
  if(titre) c.title = titre;
  return c;
}
/* Le renvoi au volet Contraintes : tout ce qui gouverne l'étape, ligne à ligne,
   avec sa valeur et son tag. */
function versContraintes(b){
  var a = el("button", "btn btn--quiet mass-renvoi", "Régler ligne à ligne — volet Contraintes");
  a.type = "button";
  a.dataset.vue = "";
  a.addEventListener("click", function(){ if(massNav) massNav("contraintes"); });
  b.appendChild(a);
}

/* Le grand bouton de l'Atelier : une icône, ce qu'il fait, et ce qu'il garde.
   C'est leur DIFFÉRENCE qui doit se lire entre les deux tirages. */
function tirBtn(ic, titre, sous, plein, fn){
  var b = el("button", "btn mass-tir" + (plein ? " btn--primary" : ""));
  b.type = "button";
  b.appendChild(icone(ic, 18));
  var t = el("span", "mass-tir__t");
  t.appendChild(el("b", null, titre));
  t.appendChild(el("span", null, sous));
  b.appendChild(t);
  b.addEventListener("click", fn);
  return b;
}

/* --- proposer ---
   Shuffle MASSING en tête : c'est le geste de l'onglet. Il montre la PROPOSITION
   SUIVANTE du classement, et au bout du classement tire une nouvelle seed — la
   seed reste donc la même tant qu'on parcourt le classement qu'elle a produit :
   elle et le rang désignent la proposition à l'écran. Les flèches parcourent ce
   même classement dans les deux sens, sans rien tirer. Shuffle PROGRAMME est à
   l'étape Programme, parce que c'est le programme qu'il rebat. */
function blocProposer(){
  var b = el("section", "mass-prop");
  b.appendChild(el("h2", "mass-prop__h", "Proposer"));
  var P = MASS.vol.props, k = MASS.vol.rang;
  var tir = tirBtn("shuffle", "Shuffle massing", "autre forme bâtie, même programme", true, function(){
    if(P && k != null && k + 1 < P.length){
      poser(P[k + 1]);
      planFit();
      redessine();
    } else rejouerMassing(graineSuivante());
  });
  b.appendChild(tir);
  /* dessous : le mode auto, et les shuffles des autres onglets */
  sousShuffle(tir, "massing");

  var nav = el("div", "mass-nav");
  function fleche(ic, d, lab){
    var f = el("button", "btn btn--icon");
    f.type = "button";
    f.setAttribute("aria-label", lab);
    f.title = lab;
    f.appendChild(icone(ic, 16));
    f.disabled = !P || k == null || k + d < 0 || k + d >= P.length;
    f.addEventListener("click", function(){ poser(P[k + d]); planFit(); redessine(); });
    return f;
  }
  nav.appendChild(fleche("gauche", -1, "Proposition précédente"));
  var r = el("span", "mass-nav__r");
  if(P && k != null){
    r.appendChild(el("b", "mono", String(k + 1)));
    r.appendChild(document.createTextNode(" sur " + P.length));
    r.title = MASS.parti === "auto" ? "La mieux orientée de chaque parti, classées par le jugement"
                                     : "Les mieux orientées de ce parti, classées par le jugement";
  } else r.textContent = "—";
  nav.appendChild(r);
  nav.appendChild(fleche("droite", 1, "Proposition suivante"));
  nav.appendChild(champSeed());
  b.appendChild(nav);

  if(aPoser() <= 0){
    b.appendChild(el("p", "mass-note", "Le mixer n’a encore rien posé : tout le programme est au "
      + "bac. « Shuffle programme », à l’étape 3, en propose une répartition, et la volumétrie suivra."));
  } else if(!MASS.vol.length && (MASS.vol.impossible || MASS.vol.erreur)){
    /* RIEN À L'ÉCRAN : on le dit ici, là où l'on vient de cliquer ; l'étape Contraintes
       en donne les causes et les remèdes. */
    b.appendChild(el("p", "mass-note is-bas", MASS.vol.erreur
      ? "Le générateur s'est arrêté sur une erreur : " + MASS.vol.erreur
      : "Aucune composition ne tient dans le cadre — l’étape Contraintes dit pourquoi."));
  }
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

/* --- 1 · le parti ---
   Une tuile par parti, sa figure en plein : on les compare du regard, et l'on voit
   d'un coup combien il y en a. En Auto, un point marque celui qui a été retenu. */
var COURT = { compact:"Compact", barres:"Barres", L:"En L", U:"En U", libre:"Libre" };
function etapeParti(){
  var pris = MASS.vol.parti && MASS.vol.parti !== "auto" ? partiOf(MASS.vol.parti) : null;
  var sous = MASS.parti === "auto" ? "Auto" + (pris ? " a retenu : " + pris.n : "") : partiOf(MASS.parti).n + ", imposé";
  return etape("parti", "1", "Parti", sous, null, function(b){
    var g = el("div", "mass-partis");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", "Parti de la composition");
    PARTIS.forEach(function(P){
      var t = el("button", "mass-parti" + (MASS.parti === "auto" && pris && pris.id === P.id ? " is-retenu" : ""));
      t.type = "button";
      t.setAttribute("aria-pressed", String(MASS.parti === P.id));
      t.title = P.n + " — " + P.d;
      t.appendChild(icone("p-" + P.id, 24));
      t.appendChild(el("span", null, COURT[P.id] || P.n));
      t.addEventListener("click", function(){
        massSet("parti", P.id);
        regenere();
        redessine();
      });
      g.appendChild(t);
    });
    b.appendChild(g);
  }, true);
}

/* --- les leviers ---
   Ce que « Shuffle massing » tire, chacun avec le dé du mixer : allumé, le
   hasard le tire dans son domaine ; éteint, la valeur est la nôtre. Toucher
   une valeur la fige. Le parti a ses boutons au-dessus — Auto est son dé. Les
   domaines, eux, sont au groupe : Paramètres & contraintes. */
var LEV_COMPO = ["sport", "ponts"];
function etapeLeviers(){
  var n = 0, t = 0;
  LEV_COMPO.concat(["prof"]).forEach(function(k){ n++; if(MASS.lev[k] == null) t++; });
  n++; if(MASS.second === "auto") t++;
  return etape("leviers", "4", roleNom("levier"), "ce que Shuffle massing tire",
    puce(t === n ? "tous tirés" : t + " tirés · " + (n - t) + " figés", t === n ? "soft" : "warn"),
    leviersCorps);
}
function leviersCorps(b){
  /* Un levier touché rejoue la volumétrie à l'instant, comme un parti choisi :
     le classement d'avant répondait à d'autres leviers. */
  function relever(){ saveSoon(); regenere(); redessine(); }
  var ul = null;
  function groupe(titre){
    b.appendChild(el("h4", "mass-sous", titre));
    ul = el("ul", "mass-lev");
    b.appendChild(ul);
  }
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
  groupe("Composition");
  LEV_COMPO.forEach(function(k){ opts(k, "lev-" + k); });
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
    massLev("prof", on ? null : profFacade()); relever();
  }, pf);
  var sc = null;
  if(MASS.second !== "auto"){
    sc = el("select", "mass-lev__s");
    sc.setAttribute("aria-label", "Second temps");
    [["un", "Réunis"], ["sep", "Séparés"]].forEach(function(o){
      var op = el("option", null, o[1]); op.value = o[0]; op.selected = o[0] === MASS.second; sc.appendChild(op);
    });
    sc.addEventListener("change", function(){ massSet("second", sc.value); relever(); });
  }
  rangee("lev-second", MASS.second === "auto", function(on){
    massSet("second", on ? "auto" : "sep"); relever();
  }, sc);
  b.appendChild(el("p", "mass-note", "Toucher un levier rejoue la volumétrie."));
  versContraintes(b);
}

/* --- ce qu'on regarde : la barre posée sur les deux vues ---
   Les couleurs, les étages montrés, le recadrage : tout ce qui change ce qu'on
   VOIT sans rien changer au projet, au même endroit. */
function dessineBarre(){
  if(!barEl) return;
  while(barEl.firstChild) barEl.removeChild(barEl.firstChild);
  var gv = el("div", "btn-group");
  gv.setAttribute("role", "group");
  gv.setAttribute("aria-label", "Vues montrées");
  [["plan", "Plan"], ["trois", "3D"], ["deux", "Plan + 3D"]].forEach(function(o){
    var t = el("button", "btn", o[1]);
    t.type = "button";
    t.setAttribute("aria-pressed", String(MONTRE === o[0]));
    t.addEventListener("click", function(){
      if(MONTRE === o[0]) return;
      MONTRE = o[0];
      if(vuesEl) vuesEl.className = "mass-vues mass-vues--" + MONTRE;
      dessineBarre();
      /* la vue qui reste change de largeur : elle se remesure et se recadre */
      resizeMass();
      if(MONTRE !== "trois") planFit();
      if(MONTRE !== "plan"){ camFit(); vue3dDraw(); }
    });
    gv.appendChild(t);
  });
  barEl.appendChild(gv);
  var g = el("div", "btn-group");
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", "Couleurs");
  [["Programme", false, "Couleurs du programme, famille par famille"],
   ["Monochrome", true, "La forme seule, en blanc de maquette"]].forEach(function(o){
    var t = el("button", "btn", o[0]);
    t.type = "button";
    t.title = o[2];
    t.setAttribute("aria-pressed", String(MASS.mono === o[1]));
    t.addEventListener("click", function(){ massSet("mono", o[1]); redessine(); });
    g.appendChild(t);
  });
  barEl.appendChild(g);
  var et = el("div", "mass-barre__et");
  et.appendChild(el("span", "mass-barre__l", "Étages"));
  et.appendChild(plageEtages());
  barEl.appendChild(et);
  barEl.appendChild(el("span", "spacer"));
  var fit = el("button", "btn btn--icon");
  fit.type = "button";
  fit.setAttribute("aria-label", "Recadrer le plan et le volume");
  fit.title = "Recadrer le plan et le volume";
  fit.appendChild(icone("cadrer", 16));
  fit.addEventListener("click", function(){ planFit(); camFit(); vue3dDraw(); });
  barEl.appendChild(fit);
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

/* --- le volume choisi : une carte posée sur le plan, là où on l'a cliqué ---
   Déplacer, tourner et étirer se font dans le plan ; les cotes et le nombre
   d'étages se saisissent ici, parce qu'un demi-mètre ne se tire pas à la souris.
   Rien de choisi, rien d'affiché : le plan dit lui-même qu'on clique un volume. */
var ARCHI_OUVERTE = false;
function dessineCarte(){
  if(!selEl) return;
  while(selEl.firstChild) selEl.removeChild(selEl.firstChild);
  var v = MASS.sel ? volDe(MASS.sel) : null;
  selEl.hidden = !v;
  if(!v) return;
  selEl.appendChild(carteSel(v));
  /* La carte se pose dans le coin OPPOSÉ au volume : elle ne cache pas ce
     qu'elle décrit. */
  var g = planEl.querySelector(".plan-vol.is-sel");
  if(!g) return;
  var P = planEl.getBoundingClientRect(), r = g.getBoundingClientRect();
  selEl.classList.toggle("is-droite", (r.left + r.right) / 2 - P.left < P.width / 2);
  selEl.classList.toggle("is-haut", (r.top + r.bottom) / 2 - P.top > P.height / 2);
}
function carteSel(v){
  var b = el("section", "mass-carte__c");
  b.setAttribute("aria-label", "Volume choisi");
  var h = el("div", "mass-carte__h");
  var k = MASS.vol.indexOf(v);
  h.appendChild(el("b", "mass-carte__id mono", volNom(v, k)));
  if(v.ph || v.fix) h.appendChild(puce(v.ph ? "second temps" : "cotes imposées", "soft",
    v.ph ? "Ouvrage du second temps — indépendant des bâtiments scolaires, réalisé plus tard (art. 2.2). "
           + "Il ne porte aucun niveau de la pile : sa hauteur est la sienne."
         : "La salle de sport double tient ses deux cotes du règlement — 28 × 32 m, 7,00 m libres. "
           + "Elle se déplace et se tourne, elle ne se redimensionne pas."));
  var cen = el("button", "btn btn--quiet btn--icon");
  cen.type = "button";
  cen.dataset.vue = "";
  cen.setAttribute("aria-label", "Centrer la vue dessus");
  cen.title = "Centrer la vue dessus";
  cen.appendChild(icone("cible", 15));
  cen.addEventListener("click", function(){ camVers(v); vue3dDraw(); });
  h.appendChild(cen);
  var x = el("button", "btn btn--quiet btn--icon");
  x.type = "button";
  x.setAttribute("aria-label", "Ne plus choisir ce volume");
  x.dataset.vue = "";
  x.title = "Ne plus choisir ce volume";
  x.appendChild(icone("croix", 15));
  x.addEventListener("click", function(){ MASS.sel = null; planDraw(); vue3dDraw(); dessineRail(); });
  h.appendChild(x);
  b.appendChild(h);

  /* UN CORPS LIBRE, un solide de Rhino : il est tel qu'il a été dessiné. Il se
     déplace et se tourne ; sa forme, ses étages et son architecture se
     retouchent dans Rhino. */
  if(v.libre){
    var e0 = v.lv.slice().sort(function(p, q){ return p.i - q.i; })[0], S = etagesDe(v);
    var ch = CHAP.filter(function(c){ return c.id === e0.chap; })[0];
    b.appendChild(el("p", "mass-sel__l mono", "de Rhino · " + (ch ? ch.short : "sans chapitre") + " · "
      + fmt(Math.round(empSol(v))) + " m² au sol · " + fmt(Math.round(volAire(v))) + " m² utiles · "
      + v.lv.length + " niv. · " + dec(S[0].z0 - RHINO.z0) + " → " + dec(S[S.length - 1].z1 - RHINO.z0) + " m"));
    b.appendChild(el("p", "mass-note", "Sa forme, sa hauteur et son calque viennent de Rhino : on la retouche là-bas, puis on réimporte."
      + (e0.couvert < .995 ? " Ses plans couvrent " + Math.round(100 * e0.couvert) + " % de son intérieur : un côté en biais laisse une frange." : "")));
    return b;
  }

  var rc = rectSol(v), fu = v.lv.some(function(e){ return e.ext && e.ext.length; });
  /* un volume fusionné n'a pas deux cotes : il dit ses ailes */
  b.appendChild(el("p", "mass-sel__l mono", (fu ? "fusionné · " + ((basDe(v).ext || []).length + 1) + " ailes"
      : dec(rc.w) + " × " + dec(rc.d) + " m") + " · "
    + fmt(Math.round(empSol(v))) + " m² au sol · " + volNiv(v) + " niv. · " + dec(volHaut(v)) + " m"));

  /* ses cotes ne se changent pas d'un bloc : les ailes se tiennent */
  if(!v.fix && !fu){
    var r = el("div", "mass-deux");
    cote(r, "Largeur", v, "w");
    cote(r, "Profondeur", v, "d");
    r.title = "Changer une cote change la surface : l’écart au programme s’écrit à l’étape Programme, "
      + "il n’est pas corrigé en douce.";
    b.appendChild(r);
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

  /* l'architecture se déplie : on ne la règle pas à chaque clic sur un volume */
  var ar = el("details", "mass-carte__ar");
  ar.open = ARCHI_OUVERTE;
  ar.addEventListener("toggle", function(){ ARCHI_OUVERTE = ar.open; });
  ar.appendChild(el("summary", null, "Architecture"));
  ar.appendChild(blocArchi(v));
  b.appendChild(ar);
  return b;
}
/* L'ARCHITECTURE du volume : ce que le cube a de plus qu'une boîte. Les choix
   vivent dans `v.ar`, la géométrie dans `mass/archi.js`. Porte-à-faux,
   passerelles et étages se règlent plus haut et dans les leviers. */
function blocArchi(v){
  var d = el("div", "mass-archi"), ar = arDe(v);
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
    /* l'étage copié garde les ailes d'un volume fusionné, à leur place */
    var nv = { i:suiv, w:e0.w, d:e0.d, dx:0, dy:0 };
    if(e0.ext && e0.ext.length){
      nv.dx = e0.dx || 0; nv.dy = e0.dy || 0;
      nv.ext = e0.ext.map(function(p){ return Object.assign({}, p); });
    }
    v.lv.push(nv);
  } else {
    if(haut < 0) return;
    v.lv = v.lv.filter(function(e){ return e.i !== haut; });
  }
  v.lv.sort(function(a, b){ return a.i - b.i; });
  requilibre();
  redessine();
}

/* --- 2 · le programme : ce que le mixer a réparti, et ce qui en est posé ---
   Shuffle PROGRAMME vit ici : c'est le tirage du mixer, appelé d'ici, et il obéit
   à l'interrupteur « Shuffle niveaux » qui se règle au mixer. L'état est l'écart
   du bilan — la question à laquelle l'outil doit répondre à tout moment. */
function etapeProgramme(){
  var T = bilanTotal(), vide = aPoser() <= 0;
  var pile = niveaux().map(function(n){ return court(n.lvl); }).join(" · ");
  return etape("programme", "3", "Programme", vide ? "rien de posé au mixer" : pile,
    vide ? puce("au bac", "warn") : puce((T.ecart >= 0 ? "+" : "−") + fmt(Math.round(Math.abs(T.ecart))) + " m²",
      Math.abs(T.ecart) > Math.max(20, T.demande * .02) ? "warn" : "ok", "Écart entre le posé et le demandé, tous niveaux"),
    programmeCorps, vide);
}
function programmeCorps(b){
  var shp = tirBtn("de", "Shuffle programme", "autre répartition dans les étages", false, function(){
    repartir({ alea:true, etages: dePile });
    regenere();
    redessine();
  });
  /* il rebat le programme : c'est le cadenas du mixer qui le garde */
  shp.dataset.onglet = "mixer";
  b.appendChild(shp);
  if(aPoser() > 0) b.appendChild(blocBilan());
}
function blocBilan(){
  var b = el("div", "mass-bilan");
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

  /* le hors-enveloppe en une ligne ; le pourquoi au survol */
  var H = horsEnveloppe();
  if(H.length){
    var n = el("p", "mass-note");
    n.appendChild(el("b", null, "Hors enveloppe : "));
    n.appendChild(document.createTextNode(H.map(function(h){
      return h.n.replace(/ avec préau couvert/, "") + " " + fmt(Math.round(h.a));
    }).join(" · ") + " m² — posés à part, en pointillé"));
    n.title = "Le règlement les veut indépendants des bâtiments scolaires et réalisés au second temps : "
      + "ils ne comptent dans aucun niveau du bilan. "
      + (MASS.second === "non" ? "La piscine et le local CAD ne sont pas posés — ils occupent pourtant du terrain."
         : "La piscine et le local CAD sont posés à part parce qu’ils occupent du terrain que la cour et le "
           + "stationnement n’auront pas. La cour n’est pas un volume : elle est le vide que la figure tient.");
    b.appendChild(n);
  }
  return b;
}

/* --- 4 · le cadre : la variante est-elle valide ? ---
   Le contrôle, et rien d'autre : ce qui est enfreint, avec le geste qui le
   résoudrait ou « laisser comme ça ». Les infos — un gradin, une nappe qui tient —
   se replient : elles n'attendent rien. Une erreur ouvre l'étape d'elle-même. */
function etapeCadre(ev){
  var list = massCheck(), v = massVerdict(list);
  /* le cadre du MASSING : ce que les plans des Typologies enfreignent se lit à
     leur onglet, et rougit la note (étape Évaluation) */
  var em = ev ? ev.ecarts.filter(function(x){ return x.c !== "typo"; }) : [];
  var sous = !MASS.vol.length ? "rien n’est posé"
    : em.some(function(x){ return x.sev === "e" && !x.pile; }) ? "une contrainte enfreinte : invalide"
    : em.some(function(x){ return x.sev !== "e"; }) ? "une préférence ferme enfreinte" : "valide";
  return etape("cadre", "5", roleNom("cadre"), sous,
    puce(v.e ? v.e + " erreur" + (v.e > 1 ? "s" : "") : v.w ? v.w + " à vérifier" : "tenu",
      v.e ? "danger" : v.w ? "warn" : "ok",
      "Une erreur est une règle écrite — le règlement, l’AEAI — ou une géométrie impossible ; "
      + "un « à vérifier » est une règle de projet ou une marge qui se discute. Une alerte se clique : "
      + "elle s’ouvre sur le geste qui la résoudrait, ou sur « laisser comme ça »."),
    function(b){ cadreCorps(b, list); }, v.e > 0);
}
function cadreCorps(b, list){
  var vifs = list.filter(function(x){ return !x.ok && x.sev !== "i"; });
  var infos = list.filter(function(x){ return !x.ok && x.sev === "i"; });
  var assumes = list.filter(function(x){ return x.ok; });
  if(vifs.length) b.appendChild(alListe(vifs, false));
  else b.appendChild(el("p", "mass-note", "Rien d’enfreint : la composition est valide."));
  if(infos.length){
    var di = el("details", "mass-infos");
    di.open = openAl != null && infos.some(function(x){ return x.code === openAl; });
    di.appendChild(el("summary", null, infos.length + " info" + (infos.length > 1 ? "s" : "") + " — rien à corriger"));
    di.appendChild(alListe(infos, false));
    b.appendChild(di);
  }

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
  versContraintes(b);
}

/* --- 5 · l'orientation : où le générateur a cherché d'abord ---
   Nos intentions, ligne par ligne, et ce que chacune lit sur la composition à
   l'écran — les défavorables en tête. Elles n'entrent pas dans la note. */
var NIV = [["warn", "défavorable"], ["soft", "neutre"], ["ok", "favorable"]];
function orientations(ev){
  if(!ev) return [];
  return Object.keys(ev.qualites).filter(function(id){
    return roleDe(id) === "orientation" && actif(id) && ligne(id);
  }).map(function(id){ return { id:id, n:ligne(id).n, q:ev.qualites[id] }; })
    .sort(function(a, b){ return a.q.niv - b.q.niv; });
}
function etapeOrientation(ev){
  var L = orientations(ev), c = [0, 0, 0];
  L.forEach(function(x){ c[x.q.niv]++; });
  var etat = L.length ? [2, 1, 0].filter(function(i){ return c[i]; }).map(function(i){
    return puce(String(c[i]), NIV[i][0], c[i] + " " + NIV[i][1] + (c[i] > 1 ? "s" : ""));
  }) : null;
  return etape("orientation", "6", roleNom("orientation"), "ce qui guide le moteur", etat, function(b){
    if(!L.length){ b.appendChild(el("p", "mass-note", "Aucune composition posée.")); return; }
    var ul = el("ul", "mass-ori");
    L.forEach(function(x){
      var li = el("li", "mass-ori__i is-" + NIV[x.q.niv][0]);
      li.appendChild(el("i", "mass-ori__p"));
      var t = el("span", "mass-ori__t");
      t.appendChild(el("b", null, x.n));
      if(x.q.txt) t.appendChild(el("span", null, x.q.txt));
      li.appendChild(t);
      li.title = NIV[x.q.niv][1];
      ul.appendChild(li);
    });
    b.appendChild(ul);
    versContraintes(b);
  });
}

/* --- 6 · le jugement : ce que vaut le bâtiment pour le jury ---
   La note du bâtiment à l'écran, qui ne sait rien de la façon dont il a été
   produit — une composition hors cadre est notée comme les autres. Elle n'est
   écrite qu'ici, sur l'étape, repliée ou non. */
function etapeJugement(ev){
  var J = null;
  try { J = ev ? noter(ev.mes, null, moyennesMain()) : null; } catch(e){ console.error(e); }
  var etat = J && J.total != null ? el("b", "mass-etape__note mono" + (ev.invalide ? " is-bas" : ""), J.total + "/100") : null;
  if(etat) etat.title = "Moyenne géométrique des axes, pondérée — " + Math.round(J.couv * 100) + " % du poids lu"
    /* rouge à cause des plans : le dire, le contrôle du massing n'en sait rien */
    + (rougesTypo(ev).length ? ". Invalide par les plans des Typologies : "
       + rougesTypo(ev).map(function(k){ return (ligne(k) || { n:k }).n.toLowerCase(); }).join(", ") : "");
  return etape("jugement", "2", roleNom("jugement"), J ? Math.round(J.couv * 100) + " % du poids lu" : "aucune composition", etat, function(b){
    if(!J){ b.appendChild(el("p", "mass-note", "Aucune composition posée.")); return; }
    J.axes.forEach(function(a){
      var r = el("div", "mass-axe");
      r.appendChild(el("span", "mass-axe__n", a.n.split(",")[0]));
      r.title = a.n;
      var bar = el("span", "mass-axe__b"), f = el("i");
      f.style.inlineSize = (a.s != null ? Math.round(a.s * 100) : 0) + "%";
      bar.appendChild(f);
      r.appendChild(bar);
      r.appendChild(el("span", "mass-axe__s mono", a.s == null ? "—" : Math.round(a.s * 100) + " %"));
      b.appendChild(r);
    });
    versContraintes(b);
  });
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

/* --- ce qu'on emporte, ce qu'on rapporte ---
   Le massing se poursuit dans Rhino, sur le relevé du géomètre, et peut en
   revenir. Le fichier est écrit par `mass/export.js` et relu par
   `mass/import.js` ; ici, on ne fait que le donner et le prendre. rhino3dm —
   la bibliothèque de McNeel qui lit et écrit le .3dm — ne se charge qu'au
   premier clic : 3 Mo de WebAssembly que personne d'autre ne demande. */
var RHINO3DM = "https://cdn.jsdelivr.net/npm/rhino3dm@8.35.0/rhino3dm.module.min.js";
var rh3dm = null, statutRhino = "";
function rhino(){
  if(!rh3dm) rh3dm = import(RHINO3DM).then(function(m){ return m.default(); })
    .catch(function(e){ rh3dm = null; throw new Error("rhino3dm ne se charge pas (" + (e.message || e) + ")."); });
  return rh3dm;
}
/* Emporter : deux boutons au pied du rail, Rhino dans les deux sens. Le repère
   se lit au survol ; un message de l'export ou de l'import s'écrit dessous. */
function blocEmporter(){
  var b = el("section", "mass-emporter");
  b.setAttribute("aria-label", "Rhino");
  (function(){
    var r = el("div", "mass-deux");
    var t = el("button", "btn", "Exporter (.3dm)");
    t.type = "button";
    t.dataset.vue = "";
    t.prepend(icone("telecharger", 15));
    t.disabled = !MASS.vol.length;
    t.addEventListener("click", function(){
      t.disabled = true;
      rhino().then(function(rh){ telecharger(dm3Massing(rh, { variante:source() })); statutRhino = ""; })
        .catch(function(e){ console.error(e); statutRhino = e.message || String(e); })
        .then(function(){ t.disabled = false; dessineRail(); });
    });
    r.appendChild(t);
    var f = el("input");
    f.type = "file"; f.accept = ".3dm"; f.hidden = true;
    f.addEventListener("change", function(){ if(f.files[0]) importer(f.files[0]); });
    var i = el("button", "btn", "Importer (.3dm)");
    i.type = "button";
    i.title = "Remplace la volumétrie : seul le calque 3D::Projet::Volume (ou Volume 01…) est relu s’il existe. "
      + "Chaque solide revient tel quel — son contour, son altitude, sa hauteur — et son sous-calque dit son "
      + "programme (Ecole, UAPE, Salle de sport…) ; la pile du mixer suit ses niveaux. La couleur dit qui "
      + "l’a touché : gris, un humain.";
    t.title = "Repère du relevé DOC/site_plan.3dm, en centimètres, Z = 0 à " + dec(RHINO.z0, 0)
      + " m : le fichier s’y pose en place. Calques de la convention : 3D::Projet::Volume, par "
      + "chapitre et par niveau, en orange (l’algorithme), bleu (une IA) ou gris (un humain) ; le périmètre et le recul de " + dec(reculVise(), 0)
      + " m dans AIDE, drapés sur le terrain.";
    i.addEventListener("click", function(){ f.click(); });
    r.appendChild(i);
    b.appendChild(r);
    b.appendChild(f);
    if(statutRhino) b.appendChild(el("p", "mass-note", statutRhino));
  })();
  return b;
}
function telecharger(octets){
  var url = URL.createObjectURL(new Blob([octets], { type:"application/octet-stream" }));
  var a = document.createElement("a");
  a.href = url;
  a.download = "saxon-massing-" + seedMass() + ".3dm";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Révoquer dans la foulée du clic coupe le téléchargement dans certains
     navigateurs : on lui laisse le temps de partir. */
  setTimeout(function(){ URL.revokeObjectURL(url); }, 40000);
}
/* L'import REMPLACE la volumétrie : on dit ce qui arrive avant de le poser. */
function importer(fichier){
  Promise.all([rhino(), fichier.arrayBuffer()]).then(function(x){
    var sol = solides3dm(x[0], new Uint8Array(x[1])), r = volsDe3dm(sol);
    var n = r.vols.filter(function(v){ return !v.ph; }).length;
    if(MASS.vol.length && !window.confirm("Remplacer la volumétrie actuelle ("
      + MASS.vol.length + " volumes) par celle de « " + fichier.name + " » ("
      + n + " volume" + (n > 1 ? "s" : "") + ") ? Elle sera perdue si elle n’est pas "
      + "enregistrée dans une variante.")) return;
    /* des solides de Rhino, tels quels : la pile du mixer suit, le programme s'y répartit */
    if(r.mode === "libre") poserLibres(r);
    massVols(r.vols);
    MASS.pile = empreintePile();
    /* le fichier dit de quelle variante il part : celle qu'on en tirera sera sa fille */
    setSource(sol.variante);
    var mains = r.vols.filter(function(v){ return v.par === "humain"; }).length;
    statutRhino = "« " + fichier.name + " » : " + n + " volume" + (n > 1 ? "s" : "")
      + (r.mode === "libre" ? ", tels quels — " + niveaux().length + " niveaux, le programme réparti par calque"
         : r.mode === "boites" ? ", lus boîte par boîte" : ", découpés par leurs toits"
         + (r.mode === "classe" ? " — étages comptés à " + dec(RULES.haut.libre.cla + RULES.haut.dalle) + " m" : ""))
      + (r.horsPile ? " ; " + r.horsPile + " étage(s) hors de la pile du mixer, ignorés" : "")
      + (mains ? " ; " + mains + " retouché" + (mains > 1 ? "s" : "") + " à la main" : "")
      + (r.cours && r.cours.length ? " ; « " + r.cours.join(" », « ") + " » a une cour : elle revient pleine, dessine-la en plusieurs solides" : "") + ".";
    camFit();
    planFit();
    redessine();
  }).catch(function(e){
    console.error(e);
    statutRhino = "Import impossible : " + (e.message || e);
    dessineRail();
  });
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
  /* verrouillé, le Massing ne se recompose pas de lui-même */
  if(!fige("massing") && ((!MASS.vol.length && !MASS.vol.impossible) || perime()) && aPoser() > 0) regenere();
}
/* Une autre volumétrie, sans rien dessiner : le volet Contraintes, et le
   mini-shuffle des autres onglets (`views/shuffles.js`). */
export function massTirer(){
  if(aPoser() > 0 && !fige("massing")){
    massSet("graine", graineSuivante());
    regenere();
    saveSoon();
  }
}
export function massRejouer(){
  massTirer();
  if(massNav) massNav("volumetrie");
}
