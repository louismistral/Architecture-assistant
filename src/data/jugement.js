/* ============================================================================
   LE JUGEMENT — COMBIEN VAUT LE BÂTIMENT POUR LE JURY ?

   Un moteur à part. Il note le bâtiment ENTIER — le programme réparti et la
   volumétrie —, et il ne lit que ses MESURES (`donnees.js — MESURES`) : jamais
   la façon dont il a été produit, pour pouvoir noter aussi bien le bâtiment
   d'un concurrent qu'une composition retouchée à la main.

   Les AXES sont les six critères de jugement du règlement (art. 1.26, « sans
   ordre hiérarchique »), avec des poids proposés, réglables. Chaque axe a ses
   SOUS-AXES — les familles des critères tirés de concours d'écoles gagnants.
   Un CRITÈRE est une mesure et une fonction de score, rattaché au sous-axe où
   il sert le mieux, avec un poids dans ce sous-axe : en ajouter un ne gonfle
   pas l'axe. Un critère qui sert deux axes y est partagé EXPLICITEMENT
   (`axes`) : il compte une fois, en deux parts.

   Un critère sans mesure attend une NOTE MANUELLE, posée sur une variante
   enregistrée (`net/variantes.js`) — l'expression architecturale surtout.
   Une variante qui n'en a pas n'est ni avantagée ni punie : elle reçoit, pour
   ce critère, la MOYENNE des notes posées sur les autres — 0,5 quand personne
   n'a encore rien noté. Noter une variante la situe donc par rapport à celles
   qu'on a notées, jamais au-dessus de celles qu'on n'a pas regardées. Exclure
   le critère aurait été pire : un axe presque entièrement à la main —
   l'expression — se serait lu sur son seul critère mesuré, qui aurait pesé à
   lui seul quinze points de la note. La COUVERTURE dit quelle part du poids a
   vraiment été lue, mesurée ou notée.

   PAS DE COMPENSATION AVEUGLE. Dans un sous-axe et dans un axe, les critères
   se compensent — c'est une moyenne. Entre les axes, non : la note générale
   est leur moyenne GÉOMÉTRIQUE pondérée. Un axe à 0,2 pèse bien plus lourd
   qu'une moyenne ne le dirait, et aucun autre ne le rachète.

   Tous les poids, et les bornes de chaque fonction, vivent dans l'état
   (`lignes.js — V`), réglés par le groupe : on les ajustera après le résultat
   de Saxon, pour retrouver le classement du jury.
   ========================================================================= */
import { RULES } from "./rules.js";
import { V, declarer, valeur, actif } from "./lignes.js";
import { MESURES } from "./donnees.js";
export { V };

/* ---------- les axes et leurs sous-axes ------------------------------------------ */
export var AXES = [
  { id:"site", n:"Insertion dans le site, relations à l'existant", w:20,
    sous:[{ id:"B", n:"Implantation et rapport au lieu", w:1 }] },
  { id:"fonc", n:"Qualités fonctionnelles, structurelles, spatiales", w:20,
    sous:[{ id:"D", n:"Organisation et fonctionnement", w:55 },
          { id:"F", n:"Structure et construction", w:30 },
          { id:"I", n:"Planification dans le temps", w:15 }] },
  { id:"expr", n:"Expression architecturale, adéquation au thème", w:15,
    sous:[{ id:"E", n:"Architecture et expression", w:80 },
          { id:"J", n:"Stratégie de rendu", w:20 }] },
  { id:"ext", n:"Aménagements extérieurs, accès, circulations", w:15,
    sous:[{ id:"C", n:"Espaces extérieurs", w:1 }] },
  { id:"eco", n:"Économie générale", w:15,
    sous:[{ id:"G", n:"Économie", w:1 }] },
  { id:"env", n:"Environnement, durabilité, énergie", w:15,
    sous:[{ id:"H", n:"Énergie et durabilité", w:1 }] }
];
var SOUS = {};
AXES.forEach(function(a){ a.sous.forEach(function(s){ s.axe = a.id; SOUS[s.id] = s; }); });
export function sousAxe(id){ return SOUS[id] || null; }
AXES.forEach(function(a){
  valeur("ax:" + a.id, a.w, { min:0, max:100 }, true);
  a.sous.forEach(function(s){ valeur("sx:" + s.id, s.w, { min:0, max:100 }, true); });
});

/* ---------- les critères ----------------------------------------------------------
   c(id, sous-axe, poids, intitulé, mesure, fonction, exemples)
   La fonction : `max` (moins vaut mieux : 1 jusqu'à `bon`, 0 à `nul`), `min`
   (plus vaut mieux), `bande` (1 entre `bon` et `haut`, 0 à `nul` de marge),
   `oui` (la mesure est déjà une part, de 0 à 1), `options` (une valeur par
   option), `cout` (le volume fois le
   prix au m³, contre le budget ; `nul` est le dépassement qui vaut 0). Sans
   mesure : un critère à noter à la main. */
function c(id, sx, w, n, m, f, ex){
  return { id:id, sx:sx, w:w, n:n, mesure:m || null, f:f || null, ex:ex || "" };
}
function mx(bon, nul){ return { t:"max", bon:bon, nul:nul }; }
function mn(bon, nul){ return { t:"min", bon:bon, nul:nul }; }

export var CRITERES = [
  /* ---- B · implantation et rapport au lieu ---- */
  c("b7",  "B", 9, "Implantation évidente, lisible en un seul croquis", "orientations", mx(1, 4), "Cugy, Matran"),
  c("b8",  "B", 8, "Peu de volumes (1 ou 2) plutôt que des pavillons éclatés", "ensembles", mx(2, 6)),
  c("b9",  "B", 7, "Volumes en bordure du site pour libérer le cœur de la parcelle", null, null, "Vignettaz, Champagne"),
  c("b10", "B", 7, "Échelle adaptée : 2 à 3 niveaux en village, pas trop massif", "niveauxMax",
    { t:"bande", bon:2, haut:3, nul:2 }, "Dorigny, Boswil"),
  c("b11", "B", 7, "Dialogue avec l'existant, sans le dominer, avec des vues vers lui", null, null, "Boswil, Praroman, Broc"),
  c("b12", "B", 6, "Un espace public : place de village ou parvis partagé", null, null, "Broc, Boswil"),
  c("b13", "B", 7, "Adapté à la pente : peu de déblais, entrées à plusieurs niveaux", "pente", mx(1, 3),
    "Courtételle, Cugy, Praroman"),
  c("b14", "B", 5, "Distances généreuses aux voisins", "distExistant", mn(15, 5), "Dorigny"),
  c("b15", "B", 6, "Vues et dégagements préservés", "vue", mx(30, 75), "Praroman"),
  c("b16", "B", 5, "Continuité avec les tracés : alignements, arbres, chemins", "alignPart", mn(1, 0), "Dorigny"),

  /* ---- C · espaces extérieurs ---- */
  c("c18", "C", 8, "Préau délimité par les bâtiments, fermé sur 2 ou 3 côtés", null, null, "Vignettaz, Val d'Arve, Champagne"),
  c("c19", "C", 6, "Préau protégé de la route et du bruit", null, null, "Boswil"),
  /* la cour utile se mesure à 30 m au plus devant UNE façade : elle plafonne
     vers 1'000 à 1'500 m², loin des 5 à 10 m² par élève de tout le préau */
  c("c20", "C", 7, "Préau bien dimensionné, d'un seul tenant, ni trop grand ni morcelé", "cour",
    mn(1000, 500), "Boswil"),
  c("c21", "C", 5, "Partie couverte : préau couvert ou avant-toit"),
  c("c22", "C", 4, "Espaces différents selon les âges", null, null, "Broc"),
  c("c23", "C", 5, "Sport extérieur bien placé, orienté nord-sud", null, null, "Champagne"),
  c("c24", "C", 5, "Arbres conservés, grands arbres locaux, surfaces perméables", null, null, "Schlieren"),
  c("c25", "C", 4, "Biodiversité et eau de pluie gérée sur place", null, null, "Saint-Aubin"),
  c("c26", "C", 6, "Voitures cachées : souterrain ou en bordure, jamais dans le préau", null, null, "Broc"),
  c("c27", "C", 7, "Accès séparés et sûrs : piétons, vélos, livraisons, dépose"),
  c("c28", "C", 4, "Vélos et trottinettes couverts, près des entrées"),
  /* la réserve de terrain (ancien b17), le stationnement et l'économie de
     terrain (ancien g62) lisent la même mesure — ce que les bâtiments laissent
     du périmètre : un critère, partagé entre trois sous-axes */
  Object.assign(c("j-terrain", "C", 7, "Faible emprise : du terrain pour la cour, 70 places, une extension",
    "terrainMarge", mn(7000, 5500), "Praroman"), { axes:{ C:.4, G:.4, B:.2 } }),

  /* ---- D · organisation et fonctionnement ---- */
  c("d29", "D", 7, "Plans simples, lisibles et flexibles", null, null, "Champagne, Matran"),
  c("d30", "D", 6, "Une entrée principale claire, un hall généreux", null, null, "Praroman"),
  c("d31", "D", 6, "Circulations qui servent d'espaces d'apprentissage", null, null, "Schlieren"),
  /* les grappes : des suites de 3 ou 4 classes contiguës, lues sur le plan des Typologies */
  c("d32", "D", 6, "Grappes de classes reliables, espaces de travail partagés", "grappes", mn(1, 0.3), "Schlieren, Raumstandards Zurich"),
  /* la classe elle-même, sur le plan : sa façade de jour à l'est ou au sud */
  Object.assign(c("d33", "D", 7, "Classes éclairées naturellement, bien orientées", "classesSoleil", mn(0.9, 0.5),
    "directives vaudoises 2002, Matran"),
    { axes:{ D:.5, H:.5 } }),
  c("d34", "D", 4, "Les plus jeunes au rez, accès direct à l'extérieur", null, null, "Broc"),
  c("d35", "D", 4, "Organisation par étage selon le cycle"),
  c("d36", "D", 4, "Pas le même plan répété à chaque étage sans réflexion", null, null, "Schlieren"),
  c("d37", "D", 4, "Vestiaires et garderobes près de l'entrée ou des classes", null, null, "Boswil"),
  c("d38", "D", 6, "Salle de sport intégrée ou semi-enterrée", "sportIntegre", { t:"options", v:{ 1:1, 0:0.6 } },
    "Vignettaz, Champagne"),
  c("d39", "D", 6, "Locaux ouverts à la commune, accessibles sans traverser l'école"),
  c("d40", "D", 5, "Parascolaire et cantine autonomes et reliés à l'école"),
  c("d41", "D", 4, "Salle des maîtres avec vue sur le préau"),
  c("d42", "D", 5, "Un ascenseur, une ou deux cages d'escalier au plus", "noyaux", mx(2, 4), "Broc"),
  c("d43", "D", 4, "Locaux techniques regroupés, accessibles aux livraisons", "techGroupes", mx(1, 4), "Broc"),
  /* au plan : bord à bord, au même niveau — le mixer ne disait que « au même niveau » */
  c("prox", "D", 8, "Les proximités du schéma fonctionnel sont tenues", "liensPlan", mn(1, 0.6)),
  c("calme", "D", 5, "Le bruyant séparé du calme", "murBruyant", mx(0, 9), "VS 400.200 art. 13"),
  c("etage", "D", 4, "Les classes à l'étage, l'accueil au rez", "classesEtage", mn(1, 0.5)),
  c("degre", "D", 5, "Un degré par niveau", "classesNiveauMax", mx(11, 16)),
  /* ce que le plan des Typologies ne loge pas dans le volume : au jury, comme au contrôle */
  c("d-pose", "D", 9, "Tout le programme tient dans les plans", "posePlan", mn(1, 0.9)),
  c("d-jour", "D", 5, "Couloirs éclairés naturellement à leurs bouts", "couloirsJour", mn(1, 0),
    "Raumstandards Zurich, Cugy"),

  /* ---- E · architecture et expression ---- */
  c("e44", "E", 7, "Une idée forte et claire, une identité", null, null, "Cugy"),
  c("e45", "E", 5, "Une façade qui découle de la structure", null, null, "Vignettaz"),
  c("e46", "E", 5, "Des intérieurs généreux et fluides", null, null, "Matran, Praroman"),
  c("e47", "E", 4, "Unité formelle entre les étapes de réalisation", null, null, "Vignettaz"),
  c("e48", "E", 5, "Matériaux simples et chaleureux qui vieillissent bien"),
  c("e49", "E", 6, "Lumière naturelle maîtrisée entre les corps", "jourRatio", mn(1.1, 0.5)),
  c("e50", "E", 5, "Une ambiance à l'échelle de l'enfant"),

  /* ---- F · structure et construction ---- */
  c("f51", "F", 6, "Structure claire sur une trame régulière", null, null, "Praroman, Schlieren"),
  c("f52", "F", 5, "Bois en priorité, ou bois-béton si l'incendie l'impose", null, null, "Courtételle, Cugy, Praroman"),
  c("f53", "F", 6, "Portées raisonnables : des corps de deux classes au plus", "profMax", mx(19.5, 26)),
  c("f54", "F", 4, "Pas de prouesse structurelle injustifiée", null, null, "Schlieren"),
  c("f55", "F", 4, "Préfabrication possible, chantier court"),
  /* « peu d'éléments enterrés » (F) et « hors-sol maximal » (G) mesurent la
     même chose : un critère, partagé */
  Object.assign(c("f56", "F", 5, "Peu d'éléments enterrés, hors-sol maximal", "sousSolPart", mx(0.05, 0.20)),
    { axes:{ F:.4, G:.6 } }),
  c("f57", "F", 3, "Démontage et réemploi possibles"),
  c("j-nappe", "F", 5, "Un sous-sol hors de la nappe", "couverture", mn(RULES.dist.couverture, 1)),

  /* ---- G · économie ---- */
  c("cout", "G", 10, "Coût dans le budget", "volume", { t:"cout", nul:0.25 }, "Vignettaz, Praroman"),
  Object.assign(c("g58", "G", 8, "Volume compact, peu de façade par m² de plancher", "compa", mx(0.95, 1.25), "Val d'Arve"),
    { axes:{ G:.5, H:.5 } }),
  /* la circulation DESSINÉE aux Typologies, et non plus son estimation */
  c("g59", "G", 5, "Circulations limitées, mais utiles", "circPlan", mx(0.25, 0.35)),
  c("g61", "G", 4, "Économie de moyens", null, null, "Schlieren"),
  c("g63", "G", 4, "Entretien et exploitation peu coûteux"),

  /* ---- H · énergie et durabilité ---- */
  c("h64", "H", 5, "Minergie-P, Minergie-ECO ou SNBS"),
  c("h65", "H", 4, "Façades vitrées à 30–40 %, contre la surchauffe", null, null, "Broc"),
  c("h66", "H", 4, "Protection solaire extérieure, ventilation de nuit"),
  c("h67", "H", 3, "Masse thermique : chape, terre crue, béton", null, null, "Broc"),
  c("h68", "H", 5, "Énergie grise faible : bois, compacité, peu d'enterré"),
  c("h69", "H", 4, "Photovoltaïque en toiture, CAD ou pompe à chaleur"),
  c("h70", "H", 3, "Réemploi de l'existant plutôt que démolition"),
  c("h71", "H", 4, "Bonne note au contrôle de durabilité", null, null, "Schlieren"),

  /* ---- I · planification dans le temps ---- */
  c("i72", "I", 5, "Étapes crédibles : le second temps trouve sa place", "secondPose", { t:"oui" }, "Vignettaz, Praroman"),
  c("i73", "I", 4, "L'école fonctionne pendant le chantier", null, null, "Saint-Aubin, Val d'Arve"),
  c("i74", "I", 4, "Extension future sans affaiblir le projet"),
  c("i75", "I", 4, "Plans adaptables à d'autres pédagogies ou usages"),

  /* ---- J · stratégie de rendu ---- */
  c("j76", "J", 5, "Un schéma conceptuel lisible en 5 secondes"),
  c("j77", "J", 4, "Un plan de situation qui montre le préau et l'espace public"),
  c("j78", "J", 4, "Une coupe qui montre la pente et l'existant"),
  c("j79", "J", 3, "Une vue intérieure de l'espace d'apprentissage"),
  c("j80", "J", 4, "Des tableaux de surfaces justes et vérifiables")
];

/* Chaque critère devient une ligne : son poids, sa fonction et son
   interrupteur sont des cases de `V`, du jury. */
CRITERES.forEach(function(x){
  if(!x.axes){ x.axes = {}; x.axes[x.sx] = 1; }
  x.role = "jugement"; x.qui = "groupe"; x.off = 1;
  x.sujet = SOUS[x.sx].n;
  x.onglet = "tous";
  x.src = { t:"concours", a: x.ex ? "— " + x.ex : "" };
  x.k = "w:" + x.id; x.def = x.w; x.min = 0; x.max = 10; x.pas = 1;
  x.lu = "src/data/jugement.js — noter()";
});
declarer(CRITERES);
CRITERES.forEach(function(x){
  if(!x.f) return;
  if(x.f.bon !== undefined) valeur("jb:" + x.id, x.f.bon, null, true);
  if(x.f.nul !== undefined) valeur("jn:" + x.id, x.f.nul, null, true);
  if(x.f.haut !== undefined) valeur("jh:" + x.id, x.f.haut, null, true);
});
var PAR_ID = {};
CRITERES.forEach(function(x){ PAR_ID[x.id] = x; });
export function critere(id){ return PAR_ID[id] || null; }
export function manuel(x){ return !x.mesure; }

/* ---------- la fonction de score --------------------------------------------------
   Rend un nombre de 0 à 1, ou null quand la mesure manque — un bâtiment sans
   sous-sol n'a pas de couverture sur la nappe, et ce critère ne le concerne
   pas. */
function lin(x, a, b){ return b === a ? (x >= a ? 1 : 0) : Math.max(0, Math.min(1, (x - b) / (a - b))); }
export function scoreDe(x, m){
  if(m == null || !isFinite(m) || !x.f) return null;
  var bon = V["jb:" + x.id], nul = V["jn:" + x.id];
  switch(x.f.t){
    case "max":  return lin(-m, -bon, -nul);
    case "min":  return lin(m, bon, nul);
    case "oui":  return Math.max(0, Math.min(1, m));
    case "options": return x.f.v[m] == null ? null : x.f.v[m];
    case "bande":
      var haut = V["jh:" + x.id];
      if(m >= bon && m <= haut) return 1;
      return m < bon ? lin(m, bon, bon - nul) : lin(-m, -haut, -(haut + nul));
    case "cout":
      var cout = m * V.m3, B = RULES.budget;
      return lin(-cout, -B, -B * (1 + nul));
  }
  return null;
}

/* ---------- la note ------------------------------------------------------------------
   `mes` : les mesures du bâtiment ; `main` : ses notes manuelles, `{ id: 0…1 }` ;
   `moy` : la moyenne des notes manuelles posées sur les autres variantes
   (`moyennes()`). Rend la note générale sur 100, chaque axe et chaque sous-axe
   sur 1, et, pour chaque critère, son score et d'où il vient. */
var PLANCHER = 0.02;       /* un axe nul ne rend pas la note nulle : il l'écrase */
var NEUTRE = 0.5;          /* un critère que personne n'a encore noté */
export function noter(mes, main, moy){
  mes = mes || {}; main = main || {}; moy = moy || {};
  var crit = {};
  CRITERES.forEach(function(x){
    var s = null, de = null;
    if(!actif(x.id) || !(V["w:" + x.id] > 0)){ crit[x.id] = { s:null, de:"éteint" }; return; }
    if(x.mesure){ s = scoreDe(x, mes[x.mesure]); de = s == null ? "sans objet" : "mesure"; }
    else if(main[x.id] != null){ s = Math.max(0, Math.min(1, +main[x.id])); de = "main"; }
    else if(moy[x.id] != null){ s = moy[x.id]; de = "moyenne"; }
    else { s = NEUTRE; de = "neutre"; }
    crit[x.id] = { s:s, de:de };
  });
  var axes = AXES.map(function(a){
    var sous = a.sous.map(function(sx){
      var som = 0, pois = 0, lu = 0;
      CRITERES.forEach(function(x){
        var part = x.axes[sx.id], c = crit[x.id];
        if(!part || c.s == null) return;
        var w = V["w:" + x.id] * part;
        som += w * c.s; pois += w;
        if(c.de === "mesure" || c.de === "main") lu += w;
      });
      return { id:sx.id, n:sx.n, w:V["sx:" + sx.id], s: pois ? som / pois : null,
               couv: pois ? lu / pois : 0 };
    });
    var som = 0, pois = 0, lu = 0, tout = 0;
    sous.forEach(function(s){
      if(!(s.w > 0)) return;
      tout += s.w;
      if(s.s == null) return;
      som += s.w * s.s; pois += s.w; lu += s.w * s.couv;
    });
    return { id:a.id, n:a.n, w:V["ax:" + a.id], s: pois ? som / pois : null,
             couv: tout ? lu / tout : 0, sous:sous };
  });
  var ln = 0, W = 0, lu = 0, tout = 0;
  axes.forEach(function(a){
    if(!(a.w > 0)) return;
    tout += a.w;
    if(a.s == null) return;
    ln += a.w * Math.log(Math.max(PLANCHER, a.s)); W += a.w; lu += a.w * a.couv;
  });
  return { total: W ? Math.round(100 * Math.exp(ln / W)) : null,
           couv: tout ? lu / tout : 0, axes:axes, crit:crit };
}
/* La moyenne, critère par critère, des notes manuelles de plusieurs variantes :
   ce que reçoit une variante qu'on n'a pas notée. */
export function moyennes(liste){
  var som = {}, n = {};
  (liste || []).forEach(function(m){
    for(var k in (m || {})) if(m[k] != null){ som[k] = (som[k] || 0) + +m[k]; n[k] = (n[k] || 0) + 1; }
  });
  var o = {};
  for(var k in som) o[k] = som[k] / n[k];
  return o;
}
/* LA PART TYPOLOGIE : la moyenne, au poids de chacun, des critères qui lisent
   le plan des Typologies (`MESURES`, `de:"typo"`). Ce n'est pas un axe : elle
   ne change pas la note, elle la lit — pour un même volume, la bonne et la
   mauvaise typologie. null quand aucun critère du plan n'a été lu. */
var TYPO_M = {};
MESURES.forEach(function(m){ if(m.de === "typo") TYPO_M[m.m] = 1; });
export function scoreTypo(j){
  if(!j) return null;
  var som = 0, pois = 0;
  CRITERES.forEach(function(x){
    var c = j.crit[x.id];
    if(!TYPO_M[x.mesure] || !c || c.s == null) return;
    som += V["w:" + x.id] * c.s; pois += V["w:" + x.id];
  });
  return pois ? som / pois : null;
}
/* Le rang d'une variante sur un axe : son score, ou null. `j` est un résultat
   de `noter()`. */
export function scoreAxe(j, id){
  if(!j) return null;
  if(!id) return j.total;
  for(var i = 0; i < j.axes.length; i++) if(j.axes[i].id === id)
    return j.axes[i].s == null ? null : Math.round(100 * j.axes[i].s);
  return null;
}
