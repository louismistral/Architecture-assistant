/* ============================================================================
   VOLET « CONTRAINTES » DE L'ONGLET PROGRAMME
   Le règlement ne donne pas que des surfaces : il fixe des hauteurs libres,
   des distances, des longueurs de fuite, une nappe à ne pas atteindre et un
   stationnement à loger. Ces valeurs décidaient déjà de la volumétrie sans
   jamais être lisibles nulle part — elles vivaient dans le code de l'onglet
   Site, entre un générateur et un contrôle.

   Tout ce qui est chiffré ici vient de `src/data/rules.js`, et de nulle part
   ailleurs : cette vue NOMME les valeurs, elle ne les redit pas. Changer une
   contrainte dans `rules.js` change cette page, le générateur de volumétrie et
   son contrôle d'un seul geste.
   ========================================================================= */
import { dec, el, fmt } from "../core/format.js";
import { GRAND, PROG } from "../core/model.js";
import { RULES, hNiv } from "../data/rules.js";
import { PERAIRE } from "../data/site.js";

/* Un panneau de contraintes : un titre, l'article qui l'énonce, et des lignes
   « ce qui est exigé / la valeur / ce que ça impose au projet ». Un quatrième
   champ dit que la valeur est du texte et non un nombre : la chasse fixe sert
   à aligner des chiffres. */
function bloc(titre, ref, sub, rows){
  var p = el("section","panel");
  var head = el("div","panel-head");
  head.appendChild(el("h2", null, titre));
  if(ref) head.appendChild(el("span","pct mono", "art. " + ref));
  p.appendChild(head);
  if(sub) p.appendChild(el("p","panel-sub", sub));
  var dl = el("dl","reg");
  rows.forEach(function(r){
    if(!r) return;
    var d = el("div");
    d.appendChild(el("dt", null, r[0]));
    var dd = el("dd", null);
    dd.appendChild(el("span", "reg__val" + (r[3] ? " reg__val--txt" : ""), r[1]));
    if(r[2]) dd.appendChild(el("small", null, r[2]));
    d.appendChild(dd);
    dl.appendChild(d);
  });
  p.appendChild(dl);
  return p;
}

/* Les hauteurs libres sont une table et non une liste : on les lit les unes
   contre les autres, et la colonne de droite dit ce qu'elles coûtent en
   hauteur de niveau une fois la dalle comptée. */
var HLAB = [
  ["cla", "Salles de classe", "vide d’étage"],
  ["spo", "Salle de sport double", "libre sous structure — donc au rez, sur un seul niveau"],
  ["cad", "Local de chauffage à distance", "accès camion de plain-pied"],
  ["pis", "Piscine", "le règlement donne 3 à 5 m"],
  ["abri", "Abri PC", "3 × 200 places"]
];
function hauteurs(){
  var p = el("section","panel");
  var head = el("div","panel-head");
  head.appendChild(el("h2", null, "Hauteurs libres exigées"));
  head.appendChild(el("span","pct mono", "art. 2.10"));
  p.appendChild(head);
  p.appendChild(el("p","panel-sub",
    "La zone ne fixe aucune hauteur de bâtiment ; ce sont les locaux qui la fixent, "
    + "par en dessous."));

  var tbl = el("table","reg-tab");
  var thead = el("thead"), tr = el("tr");
  ["Local", "Hauteur libre", "Hauteur de niveau", "Ce que cela impose"].forEach(function(c, i){
    var th = el("th", i ? (i < 3 ? "n" : null) : null, c);
    th.scope = "col";
    tr.appendChild(th);
  });
  thead.appendChild(tr); tbl.appendChild(thead);
  var tb = el("tbody");
  HLAB.forEach(function(h){
    var r = el("tr"), th = el("th", null, h[1]);
    th.scope = "row";
    r.appendChild(th);
    r.appendChild(el("td","n", dec(RULES.haut.libre[h[0]]) + " m"));
    r.appendChild(el("td","n", dec(hNiv(h[0])) + " m"));
    r.appendChild(el("td", null, h[2]));
    tb.appendChild(r);
  });
  tbl.appendChild(tb);
  p.appendChild(tbl);
  p.appendChild(el("p","reg__note",
    "La hauteur de niveau ajoute une dalle de " + dec(RULES.haut.dalle) + " m à la hauteur "
    + "libre, et l’acrotère " + dec(RULES.haut.acrotere) + " m au-dessus de la dernière. "
    + "Ces deux épaisseurs sont des hypothèses de projet, pas des valeurs du règlement : "
    + "elles servent à passer d’une exigence à une silhouette."));
  return p;
}

export function rulesPanels(){
  var out = [];
  var S = RULES.site, D = RULES.dist, F = RULES.feu, X = RULES.ext, Q = RULES.seisme;

  /* --- la règle première ------------------------------------------------- */
  var p0 = el("section","panel");
  var h0 = el("div","panel-head");
  h0.appendChild(el("h1", null, "Contraintes"));
  h0.appendChild(el("span","pct mono", "règlement-programme, juillet 2026"));
  p0.appendChild(h0);
  p0.appendChild(el("p","panel-sub",
    "Ce que le règlement impose au projet une fois les surfaces admises. Ces valeurs sont "
    + "celles que l’onglet Site vérifie sur chaque volumétrie proposée : elles ne sont "
    + "écrites qu’une fois, et les deux pages les lisent au même endroit."));
  var lead = el("div","unpriced");
  lead.appendChild(el("b", null, "Les surfaces du programme sont fixes — "));
  lead.appendChild(document.createTextNode(
    "les " + fmt(PROG) + " m² chiffrés au règlement ne se négocient pas. On change les "
    + "proportions d’une pièce ou d’un volume, à surface exacte, jamais ses m². "
    + "Les huit postes laissés « selon projet » font les " + fmt(GRAND - PROG) + " m² "
    + "restants du total vivant et sont les seuls à se saisir, dans le volet Surfaces."));
  p0.appendChild(lead);
  out.push(p0);

  /* --- le site ------------------------------------------------------------ */
  out.push(bloc("Le site", "2.3",
    "Neuf parcelles derrière l’ancien Casino, sans bâtiment existant à l’intérieur du périmètre.", [
    ["Parcelles", S.parcelles.join(" · "), "les neuf parcelles du périmètre du concours"],
    ["Surface du périmètre", fmt(S.aire) + " m²",
      "annoncés au règlement ; le polygone du géomètre en fait " + fmt(PERAIRE)
      + " m², car il englobe les bords de route"],
    ["Zone", S.zone,
      "aucune contrainte de gabarit, de hauteur ni de distance aux limites", 1],
    ["Distance entre bâtiments", D.entre + " m",
      "directives de protection incendie AEAI — la seule distance opposable dans cette zone, "
      + "avec les alignements routiers"],
    ["Recul sur le périmètre", D.retrait + " m",
      "règle de projet et non du règlement : les alignements routiers ne sont pas dans le "
      + "fichier du géomètre"],
    ["Altitude moyenne", dec(S.altMoy) + " m",
      "le terrain monte de 463,3 m au sud-ouest à 466,7 m à l’est, soit 1,94 %"],
    ["Nappe phréatique", dec(S.nappe[0]) + " à " + dec(S.nappe[1]) + " m", S.eaux],
    ["Couverture exigée sur la nappe", dec(D.couverture) + " m",
      "la marge disponible va de 1,0 m à l’ouest à 4,5 m à l’est : un sous-sol "
      + "excavé n’est tenable qu’au tiers est du site"],
    ["Sols", "à vérifier", S.pollution, 1]
  ]));

  /* --- hauteurs ----------------------------------------------------------- */
  out.push(hauteurs());

  /* --- incendie ----------------------------------------------------------- */
  out.push(bloc("Protection incendie", "2.6",
    "Directive AEAI DPI 16-15, art. 2.4 et 3.4 (écoles). Le règlement note que les voies "
    + "d’évacuation sont « trop souvent lacunaires dans les projets de concours ».", [
    ["Cages d’escalier", F.cageMin + " au minimum",
      "compartimentée ; c’est le plancher, pas le compte final"],
    ["Deux cages dès", fmt(F.cageSeuil) + " m²",
      "de surface d’étage — un plateau de barre ou de cour le dépasse vite"],
    ["Voie d’évacuation", F.fuiteSimple + " m",
      "vers une seule issue ou une seule cage donnant à l’air libre"],
    ["Voie d’évacuation", F.fuiteDouble + " m",
      "vers deux issues éloignées l’une de l’autre"],
    ["Dans une unité d’utilisation", F.fuiteUnite + " m",
      "au-delà, il faut une voie horizontale de liaison : couloir résistant au feu ou coursive"]
  ]));

  /* --- parasismique ------------------------------------------------------- */
  out.push(bloc("Exigences parasismiques", "2.5", null, [
    ["Zone de risque sismique", Q.zone, "a_gd = " + dec(Q.agd, 1) + " m/s² (SIA 261:2020)"],
    ["Classe de sol de fondation", Q.sol, null],
    ["Classe d’ouvrage", Q.ouvrage, "un prédimensionnement sommaire est demandé à la planche explicative"]
  ]));

  /* --- mobilité et extérieurs --------------------------------------------- */
  out.push(bloc("Mobilité et aménagements extérieurs", "2.4 et 2.10",
    "Flux piétons et véhicules séparés. Véhicules privés et bus par la rue du Casino, "
    + "mobilité douce par le chemin du Petit Mont.", [
    ["Places de parc", X.voitures,
      "à ciel ouvert, en lien avec la salle polyvalente — environ "
      + fmt(X.voitures * X.mPlace) + " m² de terrain, accès compris"],
    ["Vélos et trottinettes", X.velos, "depuis le chemin du Petit Mont"],
    ["Dépose des bus scolaires", X.bus, "petits bus, quatre courses par jour ; dépose sécurisée impérative"],
    ["Dépose-minute parents", X.depose, "séparée de la dépose des bus, de préférence côté rue du Casino"]
  ]));

  /* --- second temps -------------------------------------------------------- */
  out.push(bloc("Second temps", "2.2",
    "Deux infrastructures publiques indépendantes des bâtiments scolaires, réalisées plus "
    + "tard. Leur emplacement est à prévoir dès maintenant.", [
    ["À représenter", RULES.phase2.join(" · "),
      "en pointillé sur le plan de situation 1:500, sans organisation des locaux ni dessin "
      + "des façades", 1]
  ]));

  /* --- exigences qualitatives ---------------------------------------------- */
  var p9 = el("section","panel panel--plain");
  var h9 = el("div","panel-head");
  h9.appendChild(el("h2", null, "Exigences sans chiffre"));
  h9.appendChild(el("span","pct mono", "art. 2.7 à 2.9"));
  p9.appendChild(h9);
  p9.appendChild(el("p","panel-sub",
    "Elles ne se vérifient par aucun calcul, et orientent pourtant la volumétrie : le "
    + "règlement nomme lui-même la compacité et l’orientation."));
  var ul = el("ul","reg-list");
  RULES.qualitatif.forEach(function(t){ ul.appendChild(el("li", null, t)); });
  p9.appendChild(ul);
  out.push(p9);

  return out;
}
