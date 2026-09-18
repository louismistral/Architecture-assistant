/* ============================================================================
   LES CONTRAINTES DU CONCOURS, EN TÊTE DE L'ONGLET PROGRAMME

   Elles y sont à leur place : ce sont elles qui pèsent sur les surfaces, et
   l'onglet Programme est le premier de la chronologie — programme, puis
   répartition, puis volumétrie, puis typologie. Chaque valeur est lue dans
   `src/data/rules.js`. Aucune n'est réécrite ici : un chiffre qui change au
   règlement ne se change qu'à un endroit.
   ========================================================================= */
import { dec, el, fmt } from "../core/format.js";
import { RULES, hNiv } from "../data/rules.js";

/* Une ligne : [ terme, valeur, pourquoi, prose ? ].
   Le monospace est réservé aux VALEURS — un nombre, une cote, une part. Une
   énumération de noms de locaux en chasse fixe se lit comme du code et occupe
   deux fois la place : `prose` la rend au corps de texte. */
function grp(titre, lignes, note){
  var g = el("section","cons");
  g.appendChild(el("h3","label", titre));
  var dl = el("dl","cons__dl");
  lignes.forEach(function(r){
    if(!r) return;
    dl.appendChild(el("dt", null, r[0]));
    var dd = el("dd", r[3] ? "cons__tx" : "mono", r[1]);
    if(r[2]) dd.appendChild(el("span","cons__why", r[2]));
    dl.appendChild(dd);
  });
  g.appendChild(dl);
  if(note) g.appendChild(el("p","cons__note", note));
  return g;
}

export function constraintsSection(){
  var S = RULES.site, D = RULES.dist, H = RULES.haut, F = RULES.feu,
      Z = RULES.seisme, X = RULES.ext;

  var p = el("section","panel");
  var hd = el("div","panel-head");
  hd.appendChild(el("h2", null, "Contraintes du concours"));
  hd.appendChild(el("span","pct mono", "règlement-programme, juillet 2026"));
  p.appendChild(hd);
  p.appendChild(el("p","panel-sub",
    "Ce que le règlement impose avant qu'une surface soit posée quelque part. "
    + "Tout ce qui suit dans l'application — la répartition sur les niveaux, la "
    + "volumétrie, la typologie — en découle."));

  var grid = el("div","cons__grid");

  grid.appendChild(grp("Site — art. 2.3", [
    ["Parcelles", S.parcelles.join(", "), null, 1],
    ["Aire au règlement", fmt(S.aire) + " m²", "le polygone du géomètre en fait 12’783 : il englobe les bords de route"],
    ["Altitude moyenne", dec(S.altMoy) + " m"],
    ["Nappe phréatique", dec(S.nappe[0]) + " à " + dec(S.nappe[1]) + " m"],
    ["Couverture d'un sous-sol", dec(D.couverture) + " m", "tenable au seul tiers est du site"],
    ["Zone", S.zone, "aucune contrainte de gabarit, de hauteur ni de distance aux limites", 1],
    ["Eaux", S.eaux, null, 1],
    ["Sols", S.pollution, null, 1]
  ]));

  grid.appendChild(grp("Distances retenues", [
    ["Entre bâtiments", dec(D.entre, 0) + " m", "AEAI — opposable"],
    ["Recul sur le périmètre", dec(D.retrait, 0) + " m", "règle de projet, faute d'alignement routier numérisé"]
  ]));

  /* Les hauteurs libres sont EXIGÉES ; la hauteur de niveau qu'on en déduit est
     une hypothèse de projet, et elle est nommée comme telle. */
  grid.appendChild(grp("Hauteurs libres exigées — art. 2.10", [
    ["Salles de classe", dec(H.libre.cla) + " m", "vide d'étage · niveau " + dec(hNiv("cla")) + " m"],
    ["Salle de sport double", dec(H.libre.spo) + " m", "sous structure · niveau " + dec(hNiv("spo")) + " m — donc au rez, sur un seul niveau"],
    ["Local chauffage CAD", dec(H.libre.cad) + " m", "accès camion de plain-pied"],
    ["Piscine", dec(H.libre.pis) + " m", "le règlement donne 3 à 5 m"],
    ["Abri PC", dec(H.libre.abri) + " m"],
    ["Tout local non nommé", dec(H.libre.def) + " m"]
  ], "Hypothèses de projet pour passer de la hauteur libre à la hauteur de niveau : "
     + "dalle " + dec(H.dalle) + " m, acrotère " + dec(H.acrotere) + " m."));

  grid.appendChild(grp("Protection incendie — art. 2.6, AEAI DPI 16-15", [
    ["Cages d'escalier compartimentées", F.cageMin + " au minimum", null, 1],
    ["Deux cages", "dès " + fmt(F.cageSeuil) + " m²", "de surface d'étage"],
    ["Voie d'évacuation", F.fuiteSimple + " m", "vers une seule issue"],
    ["", F.fuiteDouble + " m", "vers deux issues éloignées"],
    ["", F.fuiteUnite + " m", "à l'intérieur d'une unité d'utilisation"]
  ]));

  grid.appendChild(grp("Parasismique — art. 2.5", [
    ["Zone", Z.zone],
    ["Accélération a_gd", dec(Z.agd, 1) + " m/s²", "SIA 261:2020"],
    ["Sol de fondation", Z.sol, null, 1],
    ["Classe d'ouvrage", Z.ouvrage, null, 1]
  ]));

  grid.appendChild(grp("Mobilité et extérieurs — art. 2.4 et 2.10", [
    ["Places de parc", X.voitures, "à ciel ouvert · " + fmt(X.voitures * X.mPlace) + " m² de terrain à garder libre"],
    ["Vélos et trottinettes", X.velos],
    ["Dépose-bus", X.bus, "rue du Casino"],
    ["Dépose-minute", X.depose],
    ["Cour d'école", "500 m²", "dont 120 m² de préau couvert"]
  ], "Flux piétons et véhicules séparés ; mobilité douce depuis le chemin du Petit Mont."));

  grid.appendChild(grp("Niveaux", [
    ["Classes", "au plus au " + RULES.niv.classeMax + "ᵉ étage", "évacuation et âge des élèves", 1],
    ["Au terrain", RULES.niv.solRez.join(", "), null, 1],
    ["Admis en sous-sol", RULES.niv.sousSol.join(", "), "les seuls locaux qui se passent de lumière naturelle", 1]
  ]));

  grid.appendChild(grp("Second temps — art. 2.2", [
    ["Ouvrages", RULES.phase2.join(", "), null, 1],
    ["Représentation", "pointillé 1:500", "sans organisation des locaux ni dessin des façades", 1]
  ], "Indépendants des bâtiments scolaires, réalisés plus tard."));

  p.appendChild(grid);

  var det = el("details","disclose");
  det.appendChild(el("summary", null,
    RULES.qualitatif.length + " exigences qui ne se vérifient pas par le calcul — art. 2.7 à 2.9"));
  var ul = el("ul","cons__qual");
  RULES.qualitatif.forEach(function(q){ ul.appendChild(el("li", null, q)); });
  det.appendChild(ul);
  det.appendChild(el("p","cons__note",
    "Elles orientent la volumétrie sans se chiffrer : la compacité et l'orientation "
    + "sont nommées par le règlement, l'intégration au bâtiment et aux jardins de "
    + "l'ancien Casino aussi."));
  p.appendChild(det);

  return p;
}
