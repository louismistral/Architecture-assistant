/* ============================================================================
   PARAMÈTRES & CONTRAINTES — le cadre du projet, en lignes

   Tout ce qui influe sur une variante, au même endroit, et dit de la même
   façon : une ligne par critère — ce qu'il est, sa valeur, son importance.
   Aucune valeur n'est recopiée ici : chaque ligne lit et écrit la case même que
   les générateurs lisent (`rules.js`, `doctrine.js`, `core/model.js`,
   `mix/opts.js`, `mass/model.js`, `net/prefs.js`). Le détail — pourquoi, où,
   ce qu'une règle change — reste dans le volet « Contraintes » de l'onglet qui
   s'en sert.

   CINQ FAMILLES, de la plus opposable à la plus personnelle :

     Règlement       ce que le concours et l'AEAI imposent — se lit, ne se règle pas
     Doctrine        ce que nous avons arbitré pour que les générateurs tranchent
     Projet          les décisions partagées au groupe : couloir, surfaces à préciser
     Composition     les réglages de la composition à l'écran : parti, seeds, dés
     Préférences     ce qui ne suit que la personne : thème, mode

   L'IMPORTANCE se lit, elle ne se règle pas : c'est le rang de la règle — dure,
   ferme, forte, préférence, guide —, ou sa nature quand elle n'a pas de rang.
   Seul geste sur l'importance : compter ou non un critère NOTÉ du massing.
   ========================================================================= */
import { dec, el, fmt } from "../core/format.js";
import { COULOIR, GRAND, ITEMS, PROG, VARITEMS, setCirc, setItemArea } from "../core/model.js";
import { curSeed } from "../core/rand.js";
import { RULES } from "../data/rules.js";
import { DOC, REGLES, docDefaut, docSet, rangDe, RANGS_MASS } from "../data/doctrine.js";
import { MODES, THEMES } from "../data/themes.js";
import { FLOORS } from "../mix/floors.js";
import { adjActive, dePile, estLie, liens, lienId } from "../mix/opts.js";
import { saveSoon } from "../mix/store.js";
import { MASS, PARTIS, massSet } from "../mass/model.js";
import { PREFS, setPref } from "../net/prefs.js";
import { renderBar } from "./legend.js";
import { icone } from "./icons.js";
import { deroulant, item } from "./menu.js";

var filtre = "";
var rendre = null;

/* ---------- l'importance ----------
   Une pastille, et le même mot partout pour la même chose. */
var IMP = {
  regl:  { n:"règlement",   c:"danger", d:"Opposable : écrit au règlement ou à l'AEAI." },
  hyp:   { n:"hypothèse",   c:"warn",   d:"Hypothèse de projet, écrite avec le règlement parce qu'il ne dit rien." },
  groupe:{ n:"groupe",      c:"soft",   d:"Décision de projet, partagée à tout le groupe." },
  compo: { n:"composition", c:"soft",   d:"Réglage de la composition à l'écran ; enregistré avec chaque variante." },
  pref:  { n:"préférence",  c:"soft",   d:"Ne suit que toi ; ne change rien à une variante." },
  verif: { n:"à vérifier",  c:"warn",   d:"Le règlement est incomplet ou se contredit : à vérifier dans le PDF." }
};
function impDoctrine(r){
  if(r.dom === "mass"){
    for(var i = 0; i < RANGS_MASS.length; i++) if(RANGS_MASS[i].id === r.rang){
      return { n:RANGS_MASS[i].court, c: chipDe(r.rang), d:RANGS_MASS[i].d };
    }
  }
  var g = rangDe(r.rang);
  return { n:g.court, c:chipDe(r.rang), d:g.d };
}
function chipDe(id){
  return id === "dure" ? "danger" : id === "ferme" ? "warn" : id === "forte" ? "ok" : "soft";
}

/* ---------- une ligne ----------
   `ctl` est le contrôle (ou le texte) de la valeur ; `imp` son importance ;
   `ou` dit, en petit, d'où vient la valeur. */
function ligne(titre, ctl, imp, ou, opts){
  var o = opts || {};
  var r = el("div", "pr-l" + (o.modifie ? " is-modifie" : "") + (o.inactif ? " is-inactif" : ""));
  r.dataset.q = (titre + " " + (typeof ctl === "string" ? ctl : "") + " " + (ou || "") + " " + imp.n).toLowerCase();
  var c = el("div", "pr-l__c");
  if(o.bascule) c.appendChild(o.bascule);
  var t = el("div", "pr-l__t");
  t.appendChild(el("span", "pr-l__n", titre));
  if(ou) t.appendChild(el("span", "pr-l__o", ou));
  c.appendChild(t);
  r.appendChild(c);
  var v = el("div", "pr-l__v");
  /* Les chiffres en chasse fixe, le texte en texte : une liste de locaux
     composée en machine à écrire se lit mal. */
  if(typeof ctl === "string") v.appendChild(el("span", /^[\d−-]/.test(ctl) ? "mono" : null, ctl));
  else v.appendChild(ctl);
  r.appendChild(v);
  var i = el("span", "pr-l__i");
  var ch = el("i", "chip chip--" + imp.c, imp.n);
  ch.title = imp.d || "";
  i.appendChild(ch);
  r.appendChild(i);
  return r;
}
function nombre(val, min, max, pas, unite, onSet, aria){
  var w = el("label", "pr-nb");
  var i = el("input", "mono");
  i.type = "number"; i.value = String(val);
  if(min != null) i.min = String(min);
  if(max != null) i.max = String(max);
  if(pas != null) i.step = String(pas);
  i.setAttribute("aria-label", aria);
  i.addEventListener("change", function(){ if(onSet(i.value) === false) i.value = String(val); });
  w.appendChild(i);
  if(unite) w.appendChild(el("span", "pr-nb__u", unite));
  return w;
}
/* Une liste déroulante : le déroulant du menu ◐ (`menu.js`) sous un bouton qui
   dit le choix pris. Un nouveau choix y entre en fondu flou. */
function choix(liste, val, onSet, aria){
  var pris = liste.filter(function(o){ return o.id === val; })[0] || liste[0];
  var r = el("div", "menu menu--gauche menu--choix");
  var b = el("button", "pr-sel");
  b.type = "button";
  b.setAttribute("aria-label", aria);
  var lab = el("span", "pr-sel__v", pris.n);
  b.appendChild(lab);
  b.appendChild(icone("chevron", 14));
  var l = el("div", "menu__list");
  r.appendChild(b); r.appendChild(l);
  deroulant(r, b, l, function(l){
    liste.forEach(function(o){
      l.appendChild(item(o.n, o.d, o.id === val, function(){
        if(o.id === val) return;
        val = o.id;
        lab.textContent = o.n;
        lab.classList.remove("is-neuf"); void lab.offsetWidth; lab.classList.add("is-neuf");
        onSet(o.id);
      }));
    });
  });
  return r;
}
function famille(titre, sous, lignes){
  var s = el("section", "pr-f");
  var h = el("header", "pr-f__h");
  h.appendChild(el("h2", null, titre));
  if(sous) h.appendChild(el("p", null, sous));
  s.appendChild(h);
  var l = el("div", "pr-f__l");
  lignes.forEach(function(x){ l.appendChild(x); });
  s.appendChild(l);
  return s;
}
function nb(x){ return String(Math.round(x * 100) / 100).replace(".", ","); }
function m(x){ return nb(x) + " m"; }

/* ---------- 1 · le règlement ----------
   Par thème, dans l'ordre du règlement. Chaque thème lit d'abord les clés que
   les outils vérifient, puis `RULES.cadre`, ce qui ne se vérifie pas par le
   calcul. Une surface se lit dans `program.js`, jamais ici. */
function poste(n){
  for(var i = 0; i < ITEMS.length; i++) if(ITEMS[i].n === n) return ITEMS[i];
  return null;
}
function surf(n){ var it = poste(n); return it ? fmt(it.nb * it.u) + " m²" : "—"; }
function cadre(L, k){
  RULES.cadre[k].forEach(function(c){
    L.push(ligne(c.n, c.v, c.verif ? IMP.verif : IMP.regl, "règlement " + c.art));
  });
}
function reglement(){
  var R = RULES, regl = IMP.regl, hyp = IMP.hyp, F = [];
  function theme(t, sous, L){ F.push(famille("Règlement — " + t, sous, L)); }
  var NOMS = { cla:"classes", spo:"salle de sport double", cad:"chauffage à distance", pis:"piscine", abri:"abri PC", def:"tout autre local" };

  var L = [];
  L.push(ligne("Périmètre", "parcelles " + R.site.parcelles.join(", ") + " · " + fmt(R.site.aire) + " m²", regl, "règlement 2.3"));
  L.push(ligne("Zone", R.site.zone + " — ni gabarit, ni hauteur, ni distance aux limites", regl, "règlement 2.3"));
  L.push(ligne("Distance incendie entre bâtiments", m(R.dist.entre), regl, "AEAI 15-15 · la seule distance bloquante, avec les alignements routiers"));
  L.push(ligne("Recul sur le périmètre", m(R.dist.retrait), hyp, "rules.js — dist.retrait"));
  L.push(ligne("Nappe phréatique", nb(R.site.nappe[0]) + " – " + nb(R.site.nappe[1]) + " msm · terrain à " + nb(R.site.altMoy)
    + " — " + m(R.site.altMoy - R.site.nappe[1]) + " de marge", regl, "règlement 2.3 · presque pas de sous-sol"));
  L.push(ligne("Couverture au-dessus de la nappe", m(R.dist.couverture), hyp, "rules.js — dist.couverture"));
  L.push(ligne("Protection des eaux", R.site.eaux, regl, "règlement 2.3"));
  L.push(ligne("Pollution des sols", R.site.pollution, regl, "règlement 2.3"));
  L.push(ligne("Voisinage", "projet résidentiel voisin, parcelles " + R.site.voisins.join(" et "), regl, "règlement 2.3"));
  cadre(L, "site");
  L.push(ligne("Second temps", R.phase2.map(function(n){ return n + " " + surf(n); }).join(" · ")
    + " — hauteur libre " + m(R.haut.libre.pis) + " (3 à 5 m) et " + m(R.haut.libre.cad) + ", accès camion de plain-pied",
    regl, "règlement 2.2, 2.10 — en pointillé au 1:500, sans plans ni façades"));
  theme("site et urbanisme", "Ce que le concours et l'AEAI imposent. Se lit ; se change dans rules.js, et toute variante enregistrée avant devient périmée.", L);

  L = [];
  L.push(ligne("Bus scolaires", R.ext.bus + " bus, " + R.ext.busPassages + " passages par jour, accès par la " + R.ext.accesAuto, regl, "règlement 2.4"));
  L.push(ligne("Accès", "voitures par la " + R.ext.accesAuto + " · vélos et piétons par le " + R.ext.accesDoux, regl, "règlement 2.4"));
  L.push(ligne("Stationnement", R.ext.voitures + " voitures à ciel ouvert · " + R.ext.velos + " vélos et trottinettes · "
    + R.ext.depose + " déposes-minute", regl, "règlement 2.4, 2.10"));
  cadre(L, "mobilite");
  theme("mobilité", null, L);

  L = [];
  L.push(ligne("École", R.ecole.eleves + " élèves, de la " + R.ecole.degres, regl, "règlement 2.7"));
  L.push(ligne("Surfaces du programme", fmt(PROG) + " m² chiffrés · " + fmt(GRAND) + " m² au total",
    regl, "program.js — fixes, on change les proportions, jamais les m²"));
  var sp = poste("Salle de sport double");
  if(sp) L.push(ligne("Salle de sport double", sp.h + " × " + sp.w + " m · " + m(R.haut.libre.spo) + " libres sous structure", regl, "règlement 2.10"));
  L.push(ligne("Abri PC", surf("Abri PC") + " · locaux engins " + surf("Local engins de sports") + " convertibles en abri", regl, "règlement 2.10"));
  Object.keys(R.haut.libre).forEach(function(k){
    L.push(ligne("Hauteur libre — " + (NOMS[k] || k), m(R.haut.libre[k]), k === "def" || k === "abri" ? hyp : regl, "rules.js — haut.libre." + k));
  });
  L.push(ligne("Dalle · mur extérieur · acrotère", m(R.haut.dalle) + " · " + m(R.haut.mur) + " · " + m(R.haut.acrotere), hyp, "rules.js — haut"));
  L.push(ligne("Classes au plus au", R.niv.classeMax + "ᵉ étage", regl, "règlement 2.10"));
  L.push(ligne("Au rez-de-chaussée", R.niv.solRez.join(", "), regl, "règlement 2.10"));
  L.push(ligne("Admis en sous-sol", R.niv.sousSol.join(", "), regl, "règlement 2.10"));
  cadre(L, "programme");
  theme("programme", null, L);

  L = [];
  L.push(ligne("Parasismique", "zone " + R.seisme.zone + " · agd = " + nb(R.seisme.agd) + " m/s² · sol " + R.seisme.sol + " · classe d'ouvrage " + R.seisme.ouvrage, regl, "règlement 2.5"));
  L.push(ligne("Cages d'escalier compartimentées", "au moins " + R.feu.cageMin + " · deux au-delà de " + fmt(R.feu.cageSeuil) + " m² d'étage", regl, "règlement 2.6 · AEAI 16-15"));
  L.push(ligne("Voie d'évacuation — une issue · deux issues", m(R.feu.fuiteSimple) + " · " + m(R.feu.fuiteDouble), regl, "règlement 2.6 · AEAI 16-15"));
  cadre(L, "normes");
  theme("normes techniques", null, L);

  L = []; cadre(L, "economie"); theme("économie et durabilité", null, L);
  L = []; cadre(L, "rendu"); theme("rendu", null, L);
  L = []; cadre(L, "procedure"); theme("procédure", "« À vérifier » : ce que le règlement laisse incomplet ou contradictoire.", L);
  return F;
}

/* ---------- 2 · la doctrine ---------- */
function doctrine(){
  function lignes(dom){
    return REGLES.filter(function(r){ return r.dom === dom || r.dom === "deux"; }).map(function(r){
      var ctl, mod = r.k && DOC[r.k] !== docDefaut(r.k);
      if(r.k){
        var val = r.pct ? Math.round(DOC[r.k] * 100) / 100 : DOC[r.k];
        ctl = nombre(val, r.min, r.max, r.pas, r.unite, function(x){
          if(!docSet(r.k, x)) return false;
          saveSoon(); rendre();
        }, r.titre);
      } else ctl = r.val || "—";
      var bas = null;
      if(DOC["on_" + r.id] !== undefined){
        bas = document.createElement("input");
        bas.type = "checkbox"; bas.checked = DOC["on_" + r.id] !== 0;
        bas.setAttribute("aria-label", "Compter « " + r.titre + " » dans la note");
        bas.title = "Compter ce critère dans la note";
        bas.addEventListener("change", function(){
          docSet("on_" + r.id, bas.checked ? 1 : 0); saveSoon(); rendre();
        });
      }
      var ou = r.k ? "défaut " + (r.pct ? dec(docDefaut(r.k)) : docDefaut(r.k)) + " · doctrine.js — " + r.k : r.source;
      return ligne(r.titre, ctl, impDoctrine(r), ou,
        { modifie: mod, bascule: bas, inactif: bas && !bas.checked });
    });
  }
  var sous = "Ce que nous avons arbitré. Réglable ici comme dans le volet Contraintes de l'outil ; la valeur est partagée au groupe.";
  return [famille("Doctrine — répartition", sous, lignes("mix")),
          famille("Doctrine — volumétrie", "La case cochée compte un critère dans la note du massing ; décochée, la note se recalibre sur les autres.", lignes("mass"))];
}

/* ---------- 3 · le projet ---------- */
function projet(){
  var L = [], g = IMP.groupe;
  L.push(ligne("Largeur du couloir",
    nombre(COULOIR, RULES.circ.couloir.min, RULES.circ.couloir.max, 0.05, "m", function(x){
      if(!setCirc(parseFloat(String(x).replace(",", ".")))) return false;
      renderBar(); saveSoon(); rendre();
    }, "Largeur du couloir"),
    g, "la circulation se déduit des pièces — cahier des charges, volet Surfaces"));
  VARITEMS.forEach(function(it){
    L.push(ligne(it.n + (it.nb > 1 ? " ×" + it.nb : ""),
      nombre(it.u, 0, null, 1, "m²/pièce", function(x){
        if(!setItemArea(it.key, parseFloat(String(x).replace(",", ".")))) return false;
        renderBar(); saveSoon(); rendre();
      }, it.n),
      g, it.set ? "précisée" : "à préciser"));
  });
  return famille("Projet", "Les décisions partagées au groupe : si l'un travaille avec un couloir de 2,40 m et l'autre de 3 m, leurs variantes ne se comparent plus.", L);
}

/* ---------- 4 · la composition ---------- */
/* Les quatre valeurs de `MASS.second` (mass/model.js), lues par gen.js. */
var SECONDS = [
  { id:"auto", n:"au générateur" },
  { id:"sep",  n:"posés, deux volumes" },
  { id:"un",   n:"posés, un seul volume" },
  { id:"non",  n:"éteints — sans piscine" }
];
function composition(){
  var L = [], c = IMP.compo;
  var lies = 0, adjs = 0, tot = liens().length;
  liens().forEach(function(lk){ if(adjActive(lienId(lk))) adjs++; });
  ITEMS.forEach(function(it){ if(estLie(it.key)) lies++; });
  L.push(ligne("Type de massing", choix(PARTIS.map(function(p){ return { id:p.id, n:p.n }; }), MASS.parti,
    function(v){ massSet("parti", v); saveSoon(); rendre(); }, "Type de massing"), c, "au prochain Shuffle massing"));
  L.push(ligne("Piscine et local CAD", choix(SECONDS, MASS.second,
    function(v){ massSet("second", v); saveSoon(); rendre(); }, "Piscine et local CAD"), c,
    "au prochain Shuffle massing — l'école doit marcher avec et sans"));
  L.push(ligne("Seed du programme", (curSeed >>> 0).toString(36), c, "rejoue la répartition à l'identique"));
  L.push(ligne("Seed du massing", ((MASS.graine || 0) >>> 0).toString(36), c, "rejoue la volumétrie à l'identique"));
  L.push(ligne("Niveaux de la pile", String(FLOORS.length) + (dePile ? " · dé allumé" : " · figé"), c, "au mixer, sur la pile"));
  L.push(ligne("Adjacences actives", adjs + " sur " + tot, c, "au mixer, au flanc"));
  if(lies) L.push(ligne("Postes liés", String(lies), c, "au mixer, sur chaque bloc"));
  return famille("Composition", "Les réglages de la composition à l'écran. Ils restent à chacun, et chaque variante les enregistre.", L);
}

/* ---------- 5 · les préférences ---------- */
function preferences(){
  var p = IMP.pref;
  return famille("Préférences", "Ce qui ne suit que toi, d'un appareil à l'autre. Rien ici ne change une variante.", [
    ligne("Thème", choix(THEMES, PREFS.theme, function(v){ setPref("theme", v); }, "Thème"), p, "src/data/themes.js"),
    ligne("Mode", choix(MODES, PREFS.mode, function(v){ setPref("mode", v); }, "Mode"), p, "automatique suit le système")
  ]);
}

/* ---------- la page ---------- */
function appliquerFiltre(host){
  var q = filtre.trim().toLowerCase();
  host.querySelectorAll(".pr-f").forEach(function(f){
    var vus = 0;
    f.querySelectorAll(".pr-l").forEach(function(l){
      var ok = !q || l.dataset.q.indexOf(q) >= 0;
      l.hidden = !ok;
      if(ok) vus++;
    });
    f.hidden = !vus;
  });
}

export function parametresVue(render){
  rendre = function(){
    /* Le défilement survit à un réglage : la page se refait, on ne la quitte pas. */
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  };
  var s = el("section", "pr");
  var h = el("header", "pr__h");
  h.appendChild(el("h1", null, "Paramètres & contraintes"));
  h.appendChild(el("p", "pr__lead", "Tout ce qui influe sur une variante, en lignes : le critère, sa valeur, son importance. "
    + "Le règlement se lit ; la doctrine, le projet et la composition se règlent ici ou dans l'onglet qui s'en sert."));
  var q = el("input", "pr__q");
  q.type = "search"; q.placeholder = "Filtrer — « hauteur », « cour », « dure »…";
  q.value = filtre;
  q.setAttribute("aria-label", "Filtrer les paramètres");
  h.appendChild(q);
  s.appendChild(h);

  var tete = el("div", "pr-l pr-l--tete");
  tete.setAttribute("aria-hidden", "true");
  ["Critère", "Valeur", "Importance"].forEach(function(t){ tete.appendChild(el("span", null, t)); });
  s.appendChild(tete);

  reglement().forEach(function(f){ s.appendChild(f); });
  doctrine().forEach(function(f){ s.appendChild(f); });
  s.appendChild(projet());
  s.appendChild(composition());
  s.appendChild(preferences());

  q.addEventListener("input", function(){ filtre = q.value; appliquerFiltre(s); });
  if(filtre) appliquerFiltre(s);
  return s;
}
