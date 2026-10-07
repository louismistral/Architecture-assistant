/* ============================================================================
   LE CADRE — LA VARIANTE EST-ELLE VALIDE ?

   Le cadre ne note pas : il dit oui ou non. Le générateur ne propose JAMAIS
   une variante qui en sort. Deux espèces :

     Intangible   le cadre OPPOSABLE — le règlement-programme, l'AEAI, le
                  programme dont les surfaces sont fixes. Il ne se désactive
                  pas et ne se règle pas : il se change dans le code ;
     Imposé       le cadre CHOISI — un arbitrage à nous, faute de donnée
                  opposable, appliqué comme une règle. Il se règle, se
                  désactive, ou s'assouplit en orientation (tag Prioritaire).

   Ce qui ne vient pas du générateur n'est jamais supprimé — une composition
   retouchée à la main, le bâtiment d'un concurrent, une variante enregistrée
   qu'un changement de cadre rend invalide. Elle est notée comme les autres,
   et ses écarts sont NOTIFIÉS par le contrôle (`mix/checks.js`,
   `mass/checks.js`) : un écart au cadre opposable la marque invalide (rouge),
   un écart au cadre choisi se signale (ambre).

   Chaque ligne nomme le module qui l'applique (`lu`). Les règles de niveau du
   mixer sont ici, en table (`NIV`) : c'est le règlement qui les donne, et
   `mix/niv.js` n'en garde que la mécanique.
   ========================================================================= */
import { CHAP } from "./program.js";
import { RULES } from "./rules.js";
import { V, declarer, enVigueur, oriente } from "./lignes.js";
export { V };
export { enVigueur, lu, severite } from "./lignes.js";

var TOUS = ["impose", "prioritaire", "souhaite", "indicatif"];
var DURS = ["impose", "indicatif"];
function r(a){ return { t:"reglement", a:a }; }
var CHOIX = { t:"choix" };

/* ---------- les règles de niveau ----------------------------------------------
   Ce que le règlement dit du niveau d'un local. `re`, `key`, `fam` ou `chap`
   désignent les postes ; `grade` le rez, `lvl` une plage de cotes, `max` un
   étage au plus (et jamais en sous-sol), `same` le niveau d'un autre poste.
   Une règle ASSOUPLIE en orientation (Prioritaire, Souhaité) ne ferme plus
   aucun niveau : elle ajoute `pts:<id>` points au niveau qu'elle voudrait. */
var SPORT = "sport|Salle de sport double";
export var NIV = [
  { id:"niv-sport", re:/Salle de sport double/, grade:1, tag:"prioritaire", admet:TOUS, src:r("2.10"),
    n:"Salle de sport double au rez", msg:"7 m de hauteur libre sous structure — la salle double ne peut être qu'au rez" },
  { id:"niv-abri", re:/Abri PC/, lvl:{ min:-9, max:0 }, tag:"intangible", src:r("2.10"),
    n:"Abri PC au rez ou en sous-sol", msg:"Abri PC au rez ou en sous-sol, accès et dalle de protection" },
  { id:"niv-cad", re:/Local chauffage CAD/, grade:1, tag:"intangible", src:r("2.10"),
    n:"Local CAD de plain-pied", msg:"Accessible de plain-pied par camion, hauteur libre 5,20 m" },
  { id:"niv-piscine", re:/Piscine/, grade:1, tag:"prioritaire", admet:TOUS, src:r("2.10"),
    n:"Piscine au niveau du terrain", msg:"Bassin, vestiaires et locaux techniques au niveau du terrain" },
  { id:"niv-cour", re:/Cour d'école/, grade:1, tag:"intangible", src:r("2.10"),
    n:"Cour et préau de plain-pied", msg:"La cour et son préau sont des aménagements de plain-pied" },
  { id:"niv-halls", re:/^Hall/, grade:1, tag:"prioritaire", admet:TOUS, src:r("2.10"),
    n:"Chaque hall est l'entrée de sa famille", msg:"Le hall ouvre sa famille sur l'extérieur : au rez, de plain-pied, en tête des locaux qu'il dessert" },
  { id:"niv-scene", re:/Scène/, same:SPORT, tag:"intangible", src:r("2.10"),
    n:"Scène attenante à la salle de sport", msg:"Attenante à la salle de sport" },
  { id:"niv-rangement", key:"sport|Local de rangement", same:SPORT, tag:"impose", admet:TOUS, src:r("2.10"),
    n:"Rangement au niveau de la salle de sport", msg:"Rangement des tables et chaises de la salle polyvalente" },
  { id:"niv-vestiaires", re:/Vestiaires (élèves|professeurs)/, same:SPORT, tag:"impose", admet:TOUS, src:r("2.10"),
    n:"Vestiaires au niveau de la salle de sport", msg:"À proximité des vestiaires de la salle de sport" },
  { id:"niv-refectoire", re:/Réfectoire|^Cuisine/, grade:1, tag:"impose", admet:TOUS, src:r("2.10"),
    n:"Réfectoire et cuisine au rez", msg:"Livraisons et lien avec le foyer : de préférence au rez" },
  { id:"niv-uape", chap:"uape", grade:1, tag:"prioritaire", admet:TOUS, src:r("2.10"),
    n:"UAPE sur un seul niveau, au rez", msg:"L'UAPE tient sur un seul niveau, au rez-de-chaussée : accès direct à l'extérieur et aux parents, sans traverser l'école" },
  { id:"niv-admin", fam:"adm", grade:1, tag:"prioritaire", admet:TOUS, src:r("2.10"),
    n:"Administration au rez", msg:"Bureaux, direction et administration au rez-de-chaussée : ils reçoivent le public et les parents de plain-pied" },
  { id:"niv-classes", re:/Salles de classe|Salle de classe|Salle de dédoublement|Salle ACM|Salles d'appui/,
    etageMax: RULES.niv.classeMax, tag:"prioritaire", admet:TOUS, src:r("2.10"),
    n:"Classes au plus au " + RULES.niv.classeMax + "ᵉ étage",
    msg:"Classes situées au-delà du " + RULES.niv.classeMax + "ᵉ étage — évacuation et âge des élèves (9 à 12 ans)" }
];
NIV.forEach(function(x){
  x.role = "cadre"; x.sujet = "Niveau d'un local"; x.onglet = "mixer";
  x.qui = x.tag === "intangible" ? "code" : "groupe";
  x.lu = "src/mix/niv.js — lvRange(), ancreDe() · src/mix/checks.js";
  x.d = x.msg + ".";
  x.val = x.grade ? "au rez" : x.lvl ? "rez ou sous-sol" : x.same ? "au niveau de la salle de sport"
        : "au plus au " + x.etageMax + "ᵉ étage";
  if(x.tag !== "intangible"){
    x.off = 1; x.k = "pts:" + x.id; x.def = 40; x.min = 0; x.max = 400; x.pas = 5;
    x.unite = "points au niveau voulu, en orientation";
  }
});

/* ---------- le mixer ---------------------------------------------------------- */
export var CADRE_MIX = [
  { id:"jour-ss", sujet:"Sous-sol", tag:"intangible", src:r("2.10"), qui:"code",
    n:"Pas de local occupé en sous-sol", val:"technique, stockage et nettoyage seulement",
    lu:"src/mix/niv.js — lvRange() · src/mix/checks.js — jour:",
    d:"Lumière naturelle : un sous-sol ne loge que ce qui s'en passe." },
  { id:"solid", sujet:"Salle de sport", tag:"intangible", src:r("2.10"), qui:"code",
    n:"Un poste aux cotes imposées ne se scinde pas", val:"salle de sport double, 28 × 32 m",
    lu:"src/mix/prog.js — p.solid · src/mix/shuffle.js — poser()",
    d:"Le règlement donne les deux cotes : la pièce est une, elle va entière à un niveau." },
  { id:"bac", sujet:"Programme", tag:"intangible", src:{ t:"programme" }, qui:"code",
    n:"Tout le programme est posé", val:"aucune pièce au bac",
    lu:"src/mix/shuffle.js — repartir() · src/mix/checks.js — bac",
    d:"Les surfaces sont fixes : un local manquant écarte un projet d'office." },
  { id:"gabarit", sujet:"Salle de sport", tag:"intangible", src:r("2.10"), qui:"code",
    n:"Rien au-dessus d'une grande hauteur libre", val:"hors ce que le niveau laisse à côté d'elle",
    lu:"src/mix/checks.js — gab:",
    d:"7 m libres sous la salle de sport : le plateau du dessus ne peut couvrir que le reste du rez. "
      + "La grande portée est donc en tête de son corps — jamais au milieu de la pile." },
  { id:"plateau", sujet:"Plateau", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Emprise d'un plateau", k:"plateauPart", def:0.40, min:0.15, max:0.85, pas:0.01, pct:1,
    unite:"de l'aire posable", lu:"src/mix/shuffle.js — pilesAdmissibles(), ajusterPlateaux()",
    d:"L'aire posable est de 10'528 m² (périmètre moins le recul). Le reste va à la cour, aux "
      + "accès, au stationnement et aux distances entre corps. C'est LE réglage du nombre "
      + "d'étages : plus on l'ouvre, plus le bâtiment s'étale. Éteint : toute l'aire posable." },
  { id:"soussol", sujet:"Sous-sol", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Seuil d'ouverture d'un sous-sol", k:"sousSolMin", def:300, min:0, max:2000, pas:50,
    unite:"m² enterrables", lu:"src/mix/shuffle.js — pilesAdmissibles()",
    d:"Un sous-sol se creuse trois mètres au-dessus d'une nappe à 462,25 m, et n'est tenable "
      + "qu'au tiers est du site. En deçà du seuil, il ne se justifie pas. Éteint : dès le "
      + "premier mètre carré enterrable." },
  { id:"adj", sujet:"Adjacences", tag:"intangible", src:r("2.10 — schéma et remarques"), qui:"code",
    n:"Les adjacences exigées sont respectées", val:"chaque lien du schéma, ses deux postes au même niveau",
    lu:"src/mix/shuffle.js — noteNiveau(), poser() · src/mix/checks.js — adj: · src/mass/gen.js — genMass()",
    d:"LA contrainte du mixer : le schéma fonctionnel et les remarques du programme. Chaque lien "
      + "exigé met ses deux postes au même niveau ; les mutualisations ne lient rien. Une "
      + "répartition qui en enfreint un est invalide, et le massing n'en propose aucun volume." },
  { id:"wc", sujet:"Sanitaires", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Chaque niveau occupé a ses sanitaires", val:"superposés d'un étage à l'autre, filles et garçons séparés, chacun sur la circulation",
    lu:"src/mix/shuffle.js — equilibrerWC() · src/mix/checks.js — wc:",
    d:"Aucun article ne l'écrit, mais un étage sans WC ne se dessine pas. Les blocs sanitaires se "
      + "superposent d'un étage à l'autre (gaines), les WC filles et garçons sont séparés, et "
      + "chacun a un accès direct à la circulation. Le mixer tient le premier point ; les trois "
      + "autres se dessinent à la typologie." },
  { id:"classe-dim", sujet:"Classes", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Dimension d'une salle de classe", k:"classeL", def:8, min:6, max:12, pas:0.5, unite:"m de front",
    k2:"classeP", def2:9, min2:6, max2:12, unite2:"m de profondeur",
    lu:"src/mass/model.js — profFacade()",
    d:"8 × 9 m, les 72 m² du programme. La profondeur donne celle d'un corps de classes : deux "
      + "salles et leur couloir." }
];
CADRE_MIX.forEach(function(x){ x.role = "cadre"; x.onglet = "mixer"; });

/* ---------- le massing ----------------------------------------------------------
   L'`id` d'une ligne est celui de l'écart que `mass/mesures.js — ecarts()`
   rend : le contrôle et la page disent la même chose, avec les mêmes mots. */
export var CADRE_MASS = [
  { id:"perimetre", sujet:"Périmètre", tag:"intangible", src:r("2.3"), qui:"code",
    n:"Tout le bâti dans le périmètre du concours", val:"aucun étage ne dépasse — porte-à-faux et passerelles compris",
    lu:"src/mass/gen.js — admissible() · src/mass/mesures.js — ecarts()",
    d:"On ne construit que dans le périmètre du concours, et aucun étage n'en dépasse." },
  { id:"recul", sujet:"Périmètre", tag:"impose", admet:TOUS, off:1,
    src:{ t:"choix", a:"— le règlement (2.3) ne fixe pas de distance aux limites" }, qui:"groupe",
    n:"Recul sur le périmètre", k:"recul", def:5, min:0, max:20, pas:0.5, unite:"m",
    lu:"src/mass/gen.js — admissible() · src/mass/mesures.js — ecarts()",
    d:"Tout le bâti à 5 m au moins de la limite. Le règlement communal ne fixe aucune distance "
      + "aux limites en zone A : c'est notre recul, et il décide aussi de l'aire posable, donc "
      + "du nombre d'étages du mixer." },
  { id:"sport", sujet:"Salle de sport", tag:"intangible", src:r("2.10"), qui:"code",
    n:"Salle de sport double", val:"28 × 32 m, 7,00 m libres, rien au-dessus",
    lu:"src/mass/gen.js — corpsImpose() · src/mass/mesures.js — ecarts()",
    d:"Ses cotes et sa hauteur sont obligatoires, et aucun étage ne la surmonte." },
  { id:"scene-sport", sujet:"Salle de sport", tag:"intangible", src:r("2.10"), qui:"code",
    n:"Scène collée à la salle de sport", val:"sur un de ses côtés, mur contre mur",
    lu:"src/mass/gen.js — placerSport() · src/mass/mesures.js — ecarts() · src/typo/plans.html — contrôle",
    d:"Le programme la veut attenante à la salle de sport : la salle est toujours accolée à "
      + "l'école, et les Typologies posent la scène contre l'un de ses murs." },
  { id:"abri", sujet:"Sous-sol", tag:"intangible", src:r("2.10"), qui:"code",
    n:"Abri PC au moins partiellement enterré", val:"au sous-sol, ou au rez d'un corps posé sur la pente",
    lu:"src/mass/mesures.js — ecarts()",
    d:"Le niveau de l'abri est décidé au mixer ; s'il est au rez, un corps qui le porte doit "
      + "s'enterrer d'un mètre dans la pente." },
  { id:"surfaces", sujet:"Programme", tag:"intangible", src:{ t:"programme" }, qui:"code",
    n:"Chaque niveau loge sa surface", val:"à 2 % près, 5 m² au moins",
    lu:"src/mass/partis.js — programme() · src/mass/mesures.js — ecarts()",
    d:"Règle première : une surface de programme ne se change pas. Le générateur la tient par "
      + "construction ; une composition retouchée à la main peut la perdre." },
  { id:"cour-prog", sujet:"Cour", tag:"intangible", src:{ t:"programme", a:"— chapitre Extérieurs" }, qui:"code",
    n:"La cour du programme tient sur le terrain", val:"sa surface, préau compris, d'un seul tenant",
    lu:"src/mass/mesures.js — courUtile(), ecarts()",
    d:"La cour et son préau couvert sont au programme : le terrain libre d'un seul tenant devant "
      + "une façade d'école doit au moins les loger." },
  { id:"cour", sujet:"Cour", tag:"impose", admet:TOUS, off:1, src:CHOIX, qui:"groupe",
    n:"Cour utile minimale", k:"courMin", def:620, min:0, max:5000, pas:20, unite:"m²",
    lu:"src/mass/mesures.js — courUtile(), ecarts() · src/mass/partis.js — signature()",
    d:"Notre marge sur le programme : 500 m² de cour ET 120 m² de préau, comptés en plus. Le "
      + "programme donne 500 m² préau compris — la ligne du dessus le tient." },
  { id:"facade", sujet:"Classes", tag:"impose", admet:TOUS, off:1, src:{ t:"choix", a:"— jour naturel" }, qui:"groupe",
    n:"Toutes les salles de classe en façade", val:"chaque salle a sa fenêtre",
    lu:"src/mass/model.js — profFacade() · src/mass/mesures.js — ecarts()",
    d:"Toutes les salles de classe sont en façade." },
  { id:"fusion", sujet:"Volumes", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Deux volumes qui se touchent n'en font qu'un", k:"fusionDist", def:1, min:0, max:3, pas:0.1,
    unite:"m d'écart au plus — côtés parallèles ou en équerre",
    lu:"src/mass/gen.js — fusionner(), recoller(), assembler() · src/typo/plans.html — fusion",
    d:"Ce qui s'approche à moins de cet écart se recolle : les deux murs qui se faisaient face "
      + "disparaissent, leur épaisseur entre dans le corps, et le volume devient un assemblage de "
      + "rectangles — un L, un U, un peigne d'un seul tenant. La salle de sport, à ses cotes et à "
      + "sa hauteur, reste un volume accolé : un même bâtiment, un seul mur entre eux. Éteint : "
      + "les corps restent des volumes accolés." },
  { id:"alignement", sujet:"Volumes", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Deux volumes recollés s'alignent", k:"alignDist", def:3, min:0, max:5, pas:0.5,
    unite:"m de décrochement au plus",
    lu:"src/mass/gen.js — recoller(), aligner()",
    d:"Deux volumes qui se recollent glissent le long de leur jonction pour aligner la façade la "
      + "plus proche, si le décrochement est sous cet écart. À même profondeur, ils deviennent un "
      + "seul rectangle ; sinon, le décrochement ne reste que d'un côté. Rien ne change de cotes." },
  { id:"module", sujet:"Module", tag:"intangible", src:CHOIX, qui:"groupe",
    n:"Module dimensionnel", k:"module", def:0.5, min:0.1, max:3, pas:0.1, unite:"m",
    lu:"src/mass/model.js — auModule(), horsModule()",
    d:"Toutes les cotes des corps sont des multiples du module, comme les proportions des "
      + "pièces." },
  { id:"second", sujet:"Second temps", tag:"intangible", src:r("2.2"), qui:"code",
    n:"L'école fonctionne avec et sans piscine", val:"piscine et local CAD à part — et dessinés dans toute variante",
    lu:"src/mass/gen.js — poserSecond(), secondPose() · src/mass/checks.js — second",
    d:"Indépendants des bâtiments scolaires et réalisés plus tard : ils ne sont jamais accolés "
      + "à l'école, et ne comptent dans aucun niveau. Mais ils sont pensés dès maintenant : "
      + "toute variante les pose et les dessine." }
];
CADRE_MASS.forEach(function(x){ x.role = "cadre"; x.onglet = "massing"; });

/* ---------- les typologies ------------------------------------------------------ */
export var CADRE_TYPO = [
  { id:"trame", sujet:"Trame", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Une trame pour placer les pièces", k:"trame", def:1.2, min:0.3, max:9, pas:0.1, unite:"m",
    lu:"à construire — src/typo/plans.html",
    d:"Un quadrillage commun sur lequel se posent les pièces, leurs cloisons et leurs portes." },
  { id:"couloir-acces", sujet:"Circulation", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Toutes les pièces ont accès à un couloir", val:"une porte sur la circulation, pour chaque pièce",
    lu:"src/typo/gen.js — composer(), contrôle",
    d:"Aucune pièce ne se traverse pour en atteindre une autre, sauf si c'est voulu : une enfilade, "
      + "une antichambre (le vestiaire en sas)." },
  { id:"sol-vide", sujet:"Circulation", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Pas de sol inutilisé dans un corps", k:"solVide", def:100, min:0, max:300, pas:5,
    unite:"m² de sol libre au plus, par corps et par niveau",
    lu:"src/typo/gen.js — genNiveau() · src/typo/mesures.js — contrôle",
    d:"Ce que les pièces, le couloir et les noyaux laissent libre dans un corps devient un "
      + "dégagement ; au-delà de ce seuil, c'est un plateau vide, et le contrôle le signale." },
  /* Mesurées sur le plan (`src/typo/mesures.js`) : un écart ne jette aucun
     volume — le générateur du massing ne voit pas les plans —, il rend la
     variante invalide (Intangible) ou le notifie (Imposé). Les noyaux du
     générateur de plans tiennent l'évacuation et desservent chaque niveau
     (`typo/gen.js — hotes()`) : ce qui reste rouge vient du volume. */
  { id:"fuites", sujet:"Incendie", tag:"intangible", src:{ t:"aeai", a:"16-15" }, qui:"code",
    n:"Voies d'évacuation", val: RULES.feu.fuiteSimple + " m vers un escalier, " + RULES.feu.fuiteDouble
      + " m vers deux ; deux noyaux au-delà de " + RULES.feu.cageSeuil + " m² d'étage",
    lu:"src/typo/mesures.js — ecartsTypo()" },
  { id:"sia500", sujet:"Accessibilité", tag:"intangible", src:r("1.5"), qui:"code",
    n:"Accessibilité SIA 500", val:"un noyau escalier + ascenseur à chaque niveau",
    lu:"src/typo/mesures.js — ecartsTypo()" },
  { id:"noyaux-empiles", sujet:"Structure", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Les noyaux s'empilent", val:"mêmes cotes et même place à chaque niveau",
    lu:"src/typo/mesures.js — ecartsTypo()",
    d:"Un escalier qui se décale d'un niveau à l'autre ne se construit pas : il se dessine." },
  { id:"typo-pose", sujet:"Programme", tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe",
    n:"Tout le programme tient dans les plans", val:"aucune pièce au bac d'un niveau",
    lu:"src/typo/mesures.js — ecartsTypo()",
    d:"Le règlement chiffre chaque local ; une pièce que le plan ne loge pas manque au projet. "
      + "Notifiée et non opposable : le massing dimensionne ses volumes sur la circulation estimée, "
      + "et les plans en dessinent davantage. Le jury la note aussi (« Tout le programme tient dans les plans »)." },

  /* LES RÈGLES DE PLAN — trente règles du métier (docs/typologies.md — *Les
     règles de plan*). Celles qu'une mesure du plan lit ont un seuil et un écart
     (`typo/mesures.js — ecartsDe()`) ; les autres attendent leur mesure (`lu`
     « à construire »). La règle 1 est `couloir-acces`, la 8 `classesSoleil`. */
  P("plan-couloir-bout", "Circulation", "Un couloir mène quelque part", {
    k:"couloirBout", def:0.6, min:0, max:1, pas:0.05, unite:"des bouts de couloir sur une façade, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), couloirsJour",
    d:"Pas de cul-de-sac long : chaque couloir finit sur une lumière, une vue ou une destination." }),
  P("plan-largeur", "Circulation", "La largeur d'un couloir dit son importance", {
    val:"la circulation principale plus large que celle de service", lu:"à construire — src/typo/gen.js (un seul COULOIR)" }),
  P("plan-double-rive", "Circulation", "Un couloir dessert ses deux rives", {
    k:"doubleRive", def:0.7, min:0, max:1, pas:0.05, unite:"du linéaire de corps à deux rangs, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), doubleRive",
    d:"On n'additionne pas les couloirs : des pièces de part et d'autre, quand la profondeur le permet." }),
  P("plan-escalier-lisible", "Circulation", "Les escaliers se lisent depuis l'entrée",
    { val:"comprendre le bâtiment sans signalétique", lu:"à construire" }),
  P("plan-hierarchie", "Circulation", "Public, puis semi-public, puis privé", {
    val:"d'un espace privé à un autre sans repasser par le public",
    lu:"à construire — pubGroupe (d39) n'en lit que le public" }),
  P("plan-facade-vie", "Lumière", "Pièces de vie en façade, servantes au centre ou au nord", {
    val:"technique, rangement et sanitaires au centre ou au nord", lu:"à construire" }),
  P("plan-classes-orient", "Lumière", "Classes orientées à l'est, au sud-est ou au nord", {
    k:"classesOrient", def:0.5, min:0, max:1, pas:0.05, unite:"des classes bien orientées, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), classesSoleil (E à SSO, SO à O pour moitié)",
    d:"Lumière stable, pas de surchauffe l'après-midi." }),
  P("plan-lumiere-gauche", "Lumière", "Dans une classe, la lumière vient de la gauche", {
    val:"jamais de face ni de dos par rapport au tableau", lu:"à construire — le plan ne pose pas de tableau" }),
  P("plan-aveugle", "Lumière", "Une pièce sans fenêtre se justifie", {
    k:"aveugleMax", def:0.1, min:0, max:1, pas:0.05, unite:"de la surface de séjour sans façade, au plus",
    lu:"src/typo/mesures.js — ecartsDe(), aveugles" }),
  P("plan-murs-porteurs", "Structure", "Les murs porteurs se superposent", {
    k:"mursPorteurs", def:0.7, min:0, max:1, pas:0.05, unite:"des murs d'étage sur un mur du dessous, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), mursEmpiles",
    d:"Sinon il faut des reprises coûteuses." }),
  P("plan-trame", "Structure", "Une trame récurrente, des exceptions rares", {
    k:"trameMin", def:0.5, min:0, max:1, pas:0.05, unite:"des murs en façade sur la trame structurelle, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), murTrame" }),
  P("plan-gaines", "Structure", "Les gaines techniques s'empilent et se regroupent", {
    k:"gainesMax", def:2, min:1, max:6, pas:1, unite:"groupes de locaux techniques, au plus",
    lu:"src/typo/mesures.js — ecartsDe(), techGroupes" }),
  P("plan-sanitaires", "Structure", "Les sanitaires s'empilent, près des gaines", {
    k:"sanitEmpiles", def:0.7, min:0, max:1, pas:0.05, unite:"des WC d'étage sur un WC du dessous, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), sanitairesEmpiles" }),
  P("plan-residuel", "Pièces", "Pas d'angle aigu ni de pièce résiduelle", {
    val:"des pièces rectangulaires, meublables",
    lu:"tenu par construction — src/typo/gen.js pave en rectangles ; le sol libre, `sol-vide`" }),
  P("plan-proportions", "Pièces", "Des proportions de 1:1 à 1:2", {
    val:"le côté long au plus " + RULES.plan.piece.ratio + " fois le court",
    lu:"src/typo/plans.html — contrôle « proportions vivables » (RULES.plan.piece)",
    d:"Une pièce trop étirée devient un couloir." }),
  P("plan-meuble", "Pièces", "Chaque pièce se meuble", {
    val:"vérifié avec du mobilier dessiné", lu:"à construire — le mobilier est dessiné, pas vérifié" }),
  P("plan-portes", "Pièces", "Les portes ne se battent pas", {
    val:"ni entre elles, ni contre un interrupteur ou un radiateur", lu:"à construire" }),
  P("plan-porte-angle", "Pièces", "Une porte près d'un angle", {
    val:"pas au milieu d'un mur : de la surface murale libre", lu:"à construire" }),
  P("plan-adjacences", "Relations", "Les espaces qui travaillent ensemble sont adjacents", {
    k:"adjPlan", def:0.75, min:0, max:1, pas:0.05, unite:"des liens du schéma tenus au plan, au moins",
    lu:"src/typo/mesures.js — ecartsDe(), liensPlan",
    d:"La salle des maîtres voit le préau (maitresCour, d41), les vestiaires sont entre l'extérieur et la salle de gym." }),
  P("plan-surveillance", "Usage", "L'entrée se surveille depuis l'administration", { lu:"à construire" }),
  P("plan-recoins", "Usage", "Pas de recoin invisible", {
    val:"dans les circulations et les sanitaires des élèves", lu:"à construire" }),
  P("plan-flux", "Usage", "Les flux sont séparés", {
    val:"élèves, livraisons, usagers externes", lu:"à construire — au Massing, accesSepares (c27)" }),
  P("plan-hors-heures", "Usage", "Ce qui sert hors des heures scolaires s'isole", {
    val:"la salle de gym le soir, sans ouvrir l'école", lu:"à construire" }),
  P("plan-deux-fuites", "Incendie", "Deux directions de fuite dans un long couloir", {
    val:"même quand la norme ne l'impose pas encore", lu:"à construire — `fuites` ne lit que la distance" }),
  P("plan-circ-utile", "Circulation", "Peu de circulation pour la surface utile", {
    k:"circUtileMax", def:0.25, min:0.1, max:0.5, pas:0.01, unite:"de circulation ÷ surface utile, au plus",
    lu:"src/typo/mesures.js — ecartsDe(), circPlan",
    d:"Environ 20 à 25 % pour une école." }),
  P("plan-diagramme", "Lisibilité", "Le plan se résume en un diagramme", {
    val:"une barre, un peigne, une cour, un carré", lu:"mesuré au Massing — unGeste (e44) ; jugé par j76" }),
  P("plan-facade", "Lisibilité", "La façade découle du plan", { lu:"se juge, ne se mesure pas" }),
  P("plan-entree", "Lisibilité", "L'entrée est un événement", {
    val:"un retrait, un couvert ou un volume plus haut", lu:"à construire" }),
  P("plan-topographie", "Site", "Le plan tire parti de la pente", {
    val:"un accès par plusieurs niveaux", lu:"jugé au Massing — b13 (pente)" })
];
/* une règle de plan : Imposée, désactivable, notre choix */
function P(id, sujet, n, o){
  return Object.assign({ id:id, sujet:sujet, tag:"impose", admet:DURS, off:1, src:{ t:"choix", a:"— règles de plan" },
                         qui:"groupe", n:n }, o);
}
CADRE_TYPO.forEach(function(x){ x.role = "cadre"; x.onglet = "typologie"; });

/* ---------- ce que le massing ne sait pas encore lire ------------------------------
   Opposable, mais sans mesure ici : la typologie, le rendu le vérifieront. Ils
   sont au cadre pour qu'on sache qu'ils attendent. */
export var CADRE_APRES = [
  { id:"seisme", sujet:"Structure", onglet:"typologie", src:r("2.5"),
    n:"Parasismique", val:"zone " + RULES.seisme.zone + " · sol " + RULES.seisme.sol + " · classe " + RULES.seisme.ouvrage },
  { id:"minergie", sujet:"Énergie", onglet:"typologie", src:r("2.9"),
    n:"Standard énergétique", val:"Minergie A ou P, ou CECB A/A" },
  { id:"rendu-conforme", sujet:"Rendu", onglet:"rendu", src:r("1.21"),
    n:"Rendu conforme", val:"5 A1 au plus, échelles, maquette 1:500 blanche" },
  { id:"anonymat", sujet:"Rendu", onglet:"rendu", src:r("1.21"),
    n:"Anonymat", val:"une devise sur tout le rendu, aucune variante" }
];
CADRE_APRES.forEach(function(x){
  x.role = "cadre"; x.tag = "intangible"; x.qui = "code"; x.lu = "à vérifier — onglet " + x.onglet;
});

export var CADRE = NIV.concat(CADRE_MIX, CADRE_MASS, CADRE_TYPO, CADRE_APRES);
declarer(CADRE);

/* La règle de niveau d'un id. */
export function nivDe(id){
  for(var i = 0; i < NIV.length; i++) if(NIV[i].id === id) return NIV[i];
  return null;
}

/* ---------- ce que les générateurs demandent au cadre ----------------------------
   Le RECUL que la composition doit tenir : zéro quand la ligne n'est pas du
   cadre. Et celui qu'on VISE — cadre ou orientation : c'est lui qui donne
   l'aire posable, donc les plateaux du mixer et les positions que le massing
   essaie. */
export function recul(){ return enVigueur("recul") ? V.recul : 0; }
export function reculVise(){ return enVigueur("recul") || oriente("recul") ? V.recul : 0; }
/* La cour et son préau au PROGRAMME (chapitre Extérieurs) : la surface qu'elle
   déclare, préau compris. Lue dans le fichier, jamais recopiée. */
export function courProgramme(){
  var a = 0;
  CHAP.forEach(function(c){ c.items.forEach(function(it){ if(it.f === "ext") a += it.nb * it.u; }); });
  return Math.round(a) || 500;
}
/* Son préau couvert au programme : l'encart de la cour (`inset.a`), lu dans le fichier. */
export function preauProgramme(){
  var a = 0;
  CHAP.forEach(function(c){ c.items.forEach(function(it){ if(it.f === "ext" && it.inset) a += it.inset.a; }); });
  return a;
}
/* La cour qu'une composition doit offrir : le programme, et notre marge quand
   elle est du cadre. */
export function courExigee(){
  return Math.max(courProgramme(), enVigueur("cour") ? V.courMin : 0);
}
