/* ============================================================================
   LE MASSING — L'ÉTAT, ET CE QU'IL DOIT AU PROGRAMME MIXER

   Troisième temps de la chronologie. Le mixer a dit QUOI à QUEL NIVEAU ; le
   massing dit OÙ et SOUS QUELLE FORME, sur le terrain relevé. Il ne redit rien
   du programme : il le LIT. `niveaux()` relit `FLOORS` à chaque appel, donc un
   poste déplacé dans le mixer change la volumétrie sans qu'on ait à prévenir
   personne. C'est la seule façon d'avoir deux onglets qui ne divergent pas.

   Un VOLUME est un rectangle tourné qui porte une pile de niveaux. Ses niveaux
   sont ceux du mixer, désignés par leur INDICE dans `FLOORS` : deux volumes qui
   portent le niveau 1 se partagent la surface bâtie de ce niveau, et la somme
   de leurs emprises vaut cette surface. C'est l'invariant du massing, et c'est
   lui que `bilan()` vérifie — à la main comme après un tirage.

   Chaque niveau d'un volume porte ses propres cotes et son propre décalage :
   c'est ce qui donne les retraits et les terrasses sans
   ajouter le moindre réglage.

   Les DEUX TIRAGES ne se confondent jamais. « Shuffle programme » appartient au
   mixer et rebat la répartition ; « Shuffle massing » ne touche pas au
   programme — même postes, mêmes surfaces, mêmes niveaux, même répartition —
   et ne cherche qu'une autre solution architecturale. Ils ont donc deux graines
   distinctes : celle du mixer vit dans `core/rand.js`, celle du massing ici.
   ========================================================================= */
import { COULOIR, FMAP, ITEMS, cagesDe } from "../core/model.js";
import { squarify } from "../core/treemap.js";
import { V } from "../data/leviers.js";
import { enVigueur } from "../data/cadre.js";
import { vise } from "../data/orientation.js";
import "../data/donnees.js";
import { RULES } from "../data/rules.js";
import { BLOCKS, FLOORS, areaOf, avecCloisons, flInterieur, flHeight, flName, flNet, horsAt, lvlOf, onFloor }
  from "../mix/floors.js";
import { PMAP, uOf } from "../mix/prog.js";
import { coteDe, toutesCotes } from "../mix/opts.js";
import { aire, airePoly, assise, coins, diffRects, ecartAngle, interConvexe, local, longueurDans, unionRects } from "./geom.js";

/* ---------- les partis ------------------------------------------------------
   Chacun est une FAÇON DE COMPOSER, pas un style : il dit combien de corps, où
   ils se tiennent les uns par rapport aux autres, et comment la pile se
   dégrade en montant. Le texte est ce qu'on lit dans le panneau. */
export var PARTIS = [
  { id:"auto",      n:"Auto",              d:"Le générateur explore tous les partis et tire parmi ceux qui rendent une variante valide : des familles de compositions réellement différentes." },
  { id:"compact",   n:"Bloc compact",      d:"Deux rangs de volumes accolés par leurs longs côtés : un seul bâtiment ramassé, sans longue barre ni corps dispersés." },
  { id:"barre",     n:"Barre",             d:"Une seule file de volumes accolés, une direction dominante. Avec ce programme elle est très longue : le site la refuse souvent." },
  { id:"barres",    n:"Barres parallèles", d:"Deux à quatre barres parallèles de longueurs différentes, décalées, séparées de vides qui font cour." },
  { id:"L",         n:"Forme en L",        d:"Deux ailes perpendiculaires qui se rencontrent à l'une de leurs extrémités : l'angle cadre un dehors." },
  { id:"U",         n:"Forme en U",        d:"Une base et deux ailes du même côté, de longueurs libres, qui tiennent un espace central." },
  { id:"cour",      n:"Cour",              d:"Trois côtés accolés et un quatrième bâtiment qui ferme la cour à distance : un vide central au moins égal à la cour minimale." },
  { id:"pavillons", n:"Pavillons",         d:"Des volumes autonomes, en trame décalée, séparés par des dehors : aucun ne touche l'autre." },
  { id:"hameau",    n:"Hameau",            d:"Trois ou quatre groupes de volumes, chacun son orientation, autour d'une place : un ensemble, pas une dispersion." },
  { id:"terrasses", n:"Terrasses",         d:"Des rangs qui suivent les courbes de niveau, le plus haut en amont, et des étages qui se retirent en gradins vers l'amont." },
  { id:"peigne",    n:"Peigne",            d:"Un corps principal et plusieurs branches perpendiculaires d'un même côté, espacées d'au moins la distance entre bâtiments." },
  { id:"libre",     n:"Composition libre", d:"Des groupes — files, coudes, volumes seuls — aux orientations libres, rapprochés autant que les règles le permettent." }
];
export function partiOf(id){
  var p = null;
  PARTIS.forEach(function(x){ if(x.id === id) p = x; });
  return p || PARTIS[0];
}

/* ---------- l'état ----------------------------------------------------------
   `vol` est la solution posée ; `graine` la graine du SEUL tirage massing. Les
   LEVIERS du massing sont ici, leur état à chacun (`data/leviers.js`) : le
   parti (`auto` = libre), le second temps (`auto` = libre), et `lev` pour le
   reste, `null` voulant dire libre. Tout est persisté avec le reste du mixer :
   revenir d'un onglet à l'autre ne doit rien perdre. */
export var MASS = {
  parti: "auto",
  graine: 1,
  lev: {
    sport: null,    /* salle de sport : "accolee" · "part" */
    ponts: null,    /* passerelles : "oui" · "non" */
    prof: null      /* profondeur des corps, en m murs compris */
  },
  /* second temps : "auto" libre · "sep" deux volumes · "un" groupés — toujours posé */
  second: "auto",
  vol: [],
  pont: [],         /* passerelles : { a, b, i } — deux volumes et un niveau */
  mono: false,      /* affichage : couleurs du programme, ou masse seule */
  etages: null,     /* étages montrés : [bas, haut] en indices de FLOORS · null = tous */
  sel: null         /* volume sélectionné */
};
export function massSet(k, v){ MASS[k] = v; }

/* LES ÉTAGES MONTRÉS, au plan comme dans la 3D : une plage, bornes comprises.
   Toute la pile, c'est tout le bâtiment ; deux bornes égales, un seul étage.
   Relue bornée à la pile du moment — le mixer a pu retirer un niveau. */
export function plageVue(){
  var n = FLOORS.length, p = MASS.etages;
  if(!p || n < 1) return [0, Math.max(0, n - 1)];
  var lo = Math.max(0, Math.min(n - 1, p[0])), hi = Math.max(lo, Math.min(n - 1, p[1]));
  return [lo, hi];
}
export function vu(i){ var p = plageVue(); return i >= p[0] && i <= p[1]; }
export function toutVu(){ var p = plageVue(); return p[0] === 0 && p[1] === FLOORS.length - 1; }
/* Un levier du massing : sa valeur fixée, ou `null` pour le rendre libre. */
export function massLev(k, v){ MASS.lev[k] = v == null ? null : v; }
export function massVols(list){
  MASS.vol = list || []; MASS.pont = (list && list.ponts) || []; MASS.sel = null;
}

/* ---------- la profondeur, et ses deux bornes --------------------------------
   La profondeur d'un corps est sa PETITE cote, sa largeur la grande. Les deux
   leviers ne règlent que le MINIMUM (`V.profMin`, `V.largeurMin`,
   `data/leviers.js`) ; le maximum de la profondeur est celle de façade des
   classes. Un corps retouché qui en sort ne l'est que pour l'orientation. */
export function profBornes(){
  /* Le minimum, hors tout (murs compris), ramené aux cotes intérieures. */
  var lo = Math.max(1, V.profMin - 2 * RULES.haut.mur);
  return { lo:lo, hi:Math.max(lo, profFacade()) };
}
/* TOUTES LES CLASSES EN FAÇADE. Un corps qui porte des salles de classe n'a pas
   plus de deux salles de profondeur, et le couloir qui les dessert entre elles,
   sans quoi une salle se retrouve au milieu, sans fenêtre. La salle a la
   profondeur de la ligne `classe-dim` (9 m), à défaut le carré de sa surface,
   et le couloir la largeur réglée au cahier des charges : 2 × 9 + 2,40 = 20,4 m
   au module. */
export function profFacade(){
  var u = 0;
  ITEMS.forEach(function(it){
    if(it.f !== "cla") return;
    if(!u || it.nb > u.nb) u = it;
  });
  if(!u) return V.profMin;
  return auModule(2 * (enVigueur("classe-dim") ? V.classeP : Math.sqrt(u.u)) + COULOIR);
}
/* CE QUE LES PLANS PAVENT. Le mixer ESTIME la circulation d'un niveau sur le
   front de ses pièces ; les Typologies la DESSINENT dans la section du corps
   (`typo/plans.html — composer`) : un couloir sur toute la longueur, des
   bandes de pièces de part et d'autre, et devant une pièce que ses
   proportions (`RULES.plan.piece`) empêchent de prendre toute la bande, un
   dégagement. Le volume doit loger ce qu'elles dessinent, sans quoi des
   pièces restent au bac (« Ne tient pas dans le volume »). Pour des corps de
   profondeur intérieure D :
     pièce pavée  = a × b ÷ min(b, √(max(a, colonne) × ratio))     b : la bande ;
     niveau       = (Σ pièces pavées × D ÷ (D − couloir) + cages) × (1 + reste du pavage)
                    ÷ (1 − part des cloisons) + postes aux cotes imposées.
   Le reste (`V.pavage`, une hypothèse) : un rang finit rarement sur une pièce
   entière, et deux bandes rarement ensemble.
   Une petite pièce ne se pave pas seule : WC et cabines s'empilent en colonnes
   d'au moins `piece.colonne` m², et c'est la colonne qui prend la bande.
   Ce n'est pas du programme : c'est de la circulation, que le bilan demande. */
export function aPaver(i, D){
  var P = RULES.plan.piece, c = COULOIR, b = D >= RULES.plan.deuxRangs ? (D - c) / 2 : D - c;
  if(!(b > 0)) return flInterieur(i);
  var s = 0, imp = 0, net = 0;
  BLOCKS.forEach(function(k){
    var p = PMAP[k.key], u = uOf(k.key);
    if(k.fl !== i || p.hors) return;
    net += areaOf(k);
    if(p.solid){ imp += areaOf(k); return; }
    /* la profondeur la plus grande que ses proportions lui laissent */
    var R = u >= P.grand ? P.ratioGrand : P.ratio;
    s += k.q * u * b / Math.min(b, Math.sqrt(Math.max(u, P.colonne) * R));
  });
  if(!net) return 0;
  var h = s * D / (D - c);
  return avecCloisons((h + cagesDe(h)) * (1 + V.pavage / 100)) + imp;
}
/* Ce que le niveau `i` demande aux volumes `vols` : ce que les plans y
   pavent, à la profondeur de ses corps. Le bilan, le contrôle et les remèdes
   la lisent ; le générateur la calcule à la profondeur qu'il a tirée. */
export function demande(i, vols){ return aPaver(i, profNiveau(vols, i)); }
/* La profondeur intérieure des corps d'école qui portent le niveau `i` dans
   `vols`, pondérée par leur emprise ; celle de façade quand aucun ne le porte. */
export function profNiveau(vols, i){
  var a = 0, d = 0;
  (vols || []).forEach(function(v){
    if(v.ph || v.fix) return;
    var e = volEtage(v, i);
    if(!e || e.keys) return;
    var x = aireEtage(e);
    a += x; d += x * Math.min(e.w, e.d);
  });
  return a > 0 ? d / a : profFacade();
}

/* LE MODULE : toute cote de corps est un multiple de `V.module` (0,50 m, une
   ligne du cadre choisi). Une seule fonction arrondit, le générateur, les
   remèdes et la main l'appellent. */
export function auModule(x){ var m = V.module; return Math.round(x / m) * m; }
export function horsModule(x){
  var m = V.module, q = x / m;
  return Math.abs(q - Math.round(q)) > 1e-6;
}

/* ---------- le programme, tel que le mixer l'a laissé -----------------------
   Relu à chaque appel, jamais mis en cache : c'est ce qui fait que le massing
   suit le mixer sans qu'on ait à les synchroniser. */
export function niveaux(){
  var out = [], i;
  for(i = 0; i < FLOORS.length; i++){
    out.push({
      i: i,
      lvl: lvlOf(i),
      nom: flName(i),
      utile: flNet(i),
      A: flInterieur(i),      /* surface INTÉRIEURE : locaux + circulation + cloisons */
      h: flHeight(i),         /* la plus haute pièce du niveau — le mixer */
      hc: hauteurCourante(i), /* celle d'un corps d'école (`hauteurEtage`) */
      hors: horsAt(i)
    });
  }
  return out;
}
/* L'EMPREINTE DE LA PILE : de quoi savoir qu'elle a changé.

   Un volume désigne ses niveaux par leur INDICE dans `FLOORS`. Quand le mixer
   ajoute, retire ou renumérote un niveau, ces indices ne veulent plus rien dire
   — un corps porte alors un étage qui n'existe plus, ou en manque un. Rien ne
   le voyait : `drawMass()` ne régénérait que si AUCUN volume n'était posé, si
   bien qu'après un « Shuffle » au mixer on revenait au massing sur une
   implantation qui répondait à la pile PRÉCÉDENTE, et la note comme le bilan
   portaient sur un programme qui n'existait plus.

   On ne compare que la FORME de la pile — ses cotes —, et non les surfaces :
   un poste déplacé d'un étage à l'autre change les aires, et `bilan()` le dit
   déjà, niveau par niveau. Défaire une implantation composée à la main pour un
   poste déplacé serait pire que le mal. */
export function empreintePile(){
  /* les cotes des pièces en font partie : une pièce redimensionnée au mixer
     change la profondeur des corps, la volumétrie se recompose */
  return FLOORS.map(function(F){ return F.lvl; }).join(",") + "|" + JSON.stringify(toutesCotes());
}

/* LES PIÈCES DONNENT LEUR PROFONDEUR AUX CORPS — et les corps aux pièces.
   `profPieces()` : la profondeur intérieure qu'un corps à deux bandes doit
   avoir pour ses pièces redimensionnées (la plus profonde, deux fois, et le
   couloir) ; null si aucune cote n'est fixée. `bandeMassing()` : à l'inverse,
   la profondeur d'une bande dans les corps posés, que prennent les pièces
   sans cote ; null sans volumétrie. */
export function profPieces(){
  var h = 0, vu = {};
  BLOCKS.forEach(function(b){
    var w = coteDe(b.key), p = PMAP[b.key];
    if(!w || vu[b.key] || !p || p.hors || p.solid || b.fl < 0 || b.fl >= FLOORS.length || lvlOf(b.fl) < 0) return;
    vu[b.key] = 1;
    h = Math.max(h, uOf(b.key) / w);
  });
  return h ? 2 * h + COULOIR : null;
}
export function bandeMassing(){
  var P = [];
  MASS.vol.forEach(function(v){
    if(v.fix || v.ph) return;
    v.lv.forEach(function(e){ P.push(Math.min(e.w, e.d) - 2 * RULES.haut.mur); });
  });
  if(!P.length) return null;
  P.sort(function(a, b){ return a - b; });
  return Math.max(2, (P[P.length >> 1] - COULOIR) / 2);
}

/* Les niveaux hors sol et ceux qui s'enterrent : ils ne se composent pas de la
   même façon, un sous-sol n'ayant ni façade ni silhouette. */
export function horsSol(){ return niveaux().filter(function(n){ return n.lvl >= 0; }); }
export function sousSol(){ return niveaux().filter(function(n){ return n.lvl < 0; }); }

/* Ce qui est posé au terrain mais HORS enveloppe scolaire : la cour, la
   piscine et le chauffage à distance. Le règlement les veut indépendants des
   bâtiments scolaires — ils ne se mêlent donc pas aux volumes, ils ont leur
   propre emprise au sol. */
export function horsEnveloppe(){
  var out = [], i;
  for(i = 0; i < FLOORS.length; i++){
    onFloor(i).forEach(function(b){
      var p = PMAP[b.key];
      if(!p.hors) return;
      out.push({ key:b.key, n:p.n, f:p.f, a:areaOf(b), ph:2 });
    });
  }
  return out;
}

/* LES OUVRAGES DU SECOND TEMPS. Le règlement les veut INDÉPENDANTS des
   bâtiments scolaires et réalisés plus tard (art. 2.2) : ils ne se mêlent pas à
   l'enveloppe, ne pèsent sur aucun plateau, et ne se dessinent au plan de
   situation qu'en pointillé. Ils n'en sont pas moins des BÂTIMENTS — une
   piscine de 500 m² sous 4,00 m libres, un local de chauffage à distance de
   400 m² sous 5,20 m avec accès camion de plain-pied —, et ne rien en dessiner
   laissait croire que le terrain qu'ils occupent est disponible.

   Ce qui les distingue de la cour, elle aussi hors enveloppe : une HAUTEUR
   LIBRE. Ce qui n'a pas de hauteur n'est pas un volume, et c'est le programme
   qui le dit — pas une liste de noms réécrite ici. */
export function secondTemps(){
  var out = [], i;
  for(i = 0; i < FLOORS.length; i++){
    onFloor(i).forEach(function(b){
      var p = PMAP[b.key];
      if(!p.hors || !p.hlibre) return;
      out.push({ key:b.key, n:p.n, f:p.f, i:i, a:areaOf(b),
                 h: p.hlibre + RULES.haut.dalle + RULES.haut.acrotere });
    });
  }
  return out;
}

/* Les postes présents à un niveau, en parts de surface BÂTIE — la circulation
   comprise, au prorata. C'est ce qui permet de colorer un volume par son
   programme : un corps qui porte un tiers du niveau porte un tiers de chaque
   poste, et la couleur dit vrai. */
export function postesDe(i, avecHors){
  var bl = onFloor(i).filter(function(b){ return avecHors || !PMAP[b.key].hors; });
  var net = flNet(i);
  if(!net && !avecHors) return [];
  /* La circulation ne porte que sur le bâti SCOLAIRE : un ouvrage du second
     temps n'a pas de couloirs à nous, et sa surface est déjà sa surface. */
  var k = net ? flInterieur(i) / net : 1;
  return bl.map(function(b){
    var p = PMAP[b.key];
    return { key:b.key, n:p.n, f:p.f, q:b.q, a:areaOf(b) * (p.hors ? 1 : k) };
  }).sort(function(a, b){ return b.a - a.a; });
}

/* ---------- les volumes ----------------------------------------------------
   Un volume porte une liste d'étages, chacun désignant un niveau du mixer par
   son indice. Les cotes sont celles de CE niveau : un étage plus petit que
   celui d'en dessous est un retrait, un étage décalé est un porte-à-faux. */
/* LES MURS. `e.w × e.d` est la surface UTILE intérieure, celle que le programme
   demande et que le bilan compte ; le mur extérieur (`RULES.haut.mur`, 0,40 m)
   s'ajoute AUTOUR. `volRect` rend l'emprise ARCHITECTURALE, murs compris — c'est
   elle que mesurent le périmètre, les distances, la cour et le dessin —, et
   `volInt` l'intérieur, où l'on pave le programme. */
/* ÉTIRER un volume par un de ses côtés, À SURFACE CONSTANTE : le côté `cote`
   (0 : +largeur, 1 : +profondeur, 2 : −largeur, 3 : −profondeur, dans l'axe du
   volume) avance de `delta` mètres, le côté opposé ne bouge pas, et l'autre
   dimension se resserre ou s'élargit pour que chaque étage garde ses m² — une
   surface de programme ne se change pas, on change ses proportions. Les deux
   cotes tombent sur le module de 0,50 m ; la surface en garde l'écart le plus
   petit que le module permet. `base` est
   l'état de départ du geste (`{ x, y, lv }`), pour ne pas cumuler d'arrondis. */
export function etirer(v, base, cote, delta){
  var e0 = base.lv[0], k = cote % 2 ? "d" : "w", o = k === "w" ? "d" : "w", m = V.module;
  /* les deux cotes sur le module : parmi les longueurs voisines de celle que
     vise la souris, celle dont l'autre cote, arrondie au module, rend la
     surface la plus juste */
  /* aucun côté sous 6 m : en deçà, ce n'est plus un corps de bâtiment */
  var MIN = 6, A = e0[k] * e0[o];
  var vise = Math.max(MIN, Math.min(A / MIN, e0[k] + delta)), L = auModule(vise), err = Infinity;
  for(var c = auModule(vise - 1); c <= auModule(vise + 1) + 1e-9; c += m){
    var lo = auModule(A / c), er = Math.abs(lo * c - A) + Math.abs(c - vise) * .01;
    if(c >= MIN && lo >= MIN && er < err){ err = er; L = c; }
  }
  var f = L / e0[k], sg = cote < 2 ? 1 : -1, pas = (L - e0[k]) / 2 * sg;
  /* chaque étage garde le rapport de son autre cote à celle du rez (un étage
     en gradin reste en gradin) ; sa longueur s'ajuste à sa surface, sur le module */
  var O = Math.max(m, auModule(A / L));
  v.lv.forEach(function(e, i){
    var b = base.lv[i];
    e[o] = i === 0 ? O : Math.max(m, auModule(O * b[o] / e0[o]));
    e[k] = i === 0 ? L : Math.max(m, auModule(b[k] * b[o] / e[o]));
    e[k === "w" ? "dx" : "dy"] = (b[k === "w" ? "dx" : "dy"] || 0) * f;
    e[o === "w" ? "dx" : "dy"] = (b[o === "w" ? "dx" : "dy"] || 0) * O / e0[o];
  });
  var ux = Math.cos(v.a), uy = Math.sin(v.a);
  if(k === "w"){ v.x = base.x + pas * ux; v.y = base.y + pas * uy; }
  else { v.x = base.x - pas * uy; v.y = base.y + pas * ux; }
}
export function volInt(v, e){
  return local({ x:v.x, y:v.y, w:e.w, d:e.d, a:v.a }, e.dx || 0, e.dy || 0);
}
export function volRect(v, e){
  var m = 2 * RULES.haut.mur;
  return local({ x:v.x, y:v.y, w:e.w + m, d:e.d + m, a:v.a }, e.dx || 0, e.dy || 0);
}
/* ---------- le volume FUSIONNÉ -----------------------------------------------
   Deux corps d'école qui se touchent n'en font qu'un (`gen.js — fusionner`) :
   un L, un U, une cour deviennent UN volume, et chacun de ses niveaux n'est
   plus un rectangle mais une union de rectangles dans le repère du volume. Le
   rectangle du niveau (`w, d, dx, dy`) en est la PART 0 ; `e.ext` porte les
   autres, en cotes intérieures, décalées depuis `(e.dx, e.dy)` — un niveau qui
   glisse les emporte toutes. Les parts ne se recouvrent jamais : à la
   jonction, leurs intérieurs se touchent, le mur commun a disparu. Sans
   `ext`, tout se lit comme avant. */
export function partsDe(e){
  var dx = e.dx || 0, dy = e.dy || 0, P = [{ w:e.w, d:e.d, dx:dx, dy:dy }];
  (e.ext || []).forEach(function(p){ P.push({ w:p.w, d:p.d, dx:dx + (p.dx || 0), dy:dy + (p.dy || 0) }); });
  return P;
}
export function fusionne(e){ return !!(e && e.ext && e.ext.length); }
export function volFusionne(v){ return v.lv.some(fusionne); }
/* Les emprises de chaque part, murs compris — elles se recouvrent de
   l'épaisseur du mur commun disparu —, et leurs intérieurs. */
export function volRects(v, e){
  var m = 2 * RULES.haut.mur;
  return partsDe(e).map(function(p){ return local({ x:v.x, y:v.y, w:p.w + m, d:p.d + m, a:v.a }, p.dx, p.dy); });
}
export function volInts(v, e){
  return partsDe(e).map(function(p){ return local({ x:v.x, y:v.y, w:p.w, d:p.d, a:v.a }, p.dx, p.dy); });
}
/* La surface UTILE d'un niveau : la somme de ses parts, qui ne se recouvrent pas. */
export function aireEtage(e){
  var a = 0;
  partsDe(e).forEach(function(p){ a += p.w * p.d; });
  return a;
}
function boiteDe(p, m){ return { x0:p.dx - p.w / 2 - m, x1:p.dx + p.w / 2 + m, y0:p.dy - p.d / 2 - m, y1:p.dy + p.d / 2 + m }; }
function versSite(v){
  var c = Math.cos(v.a), s = Math.sin(v.a);
  return function(p){ return [v.x + p[0] * c - p[1] * s, v.y + p[0] * s + p[1] * c]; };
}
/* LE CONTOUR d'un niveau, murs compris : ses boucles au site (les trous d'une
   cour tournent à l'envers), son aire et son périmètre — la façade réelle,
   sans le mur commun. */
export function contourDe(v, e){
  if(!fusionne(e)){
    var r = volRect(v, e);
    return { loops:[coins(r)], aire:r.w * r.d, perim:2 * (r.w + r.d) };
  }
  var U = unionRects(partsDe(e).map(function(p){ return boiteDe(p, RULES.haut.mur); })), S = versSite(v);
  return { loops:U.loops.map(function(L){ return L.map(S); }), aire:U.aire, perim:U.perim,
           local:U.loops, bords:U.bords };
}
/* LES JONCTIONS : là où deux parts se touchent, le côté commun de leurs
   intérieurs — le passage d'une aile à l'autre. `u0..u1` / `v0..v1` dans le
   repère du volume, `A`, `B` au site. */
export function jonctions(v, e){
  var P = partsDe(e), out = [], S = versSite(v), T = .05;
  P.forEach(function(p, i){
    P.forEach(function(q, j){
      if(j <= i) return;
      var a = boiteDe(p, 0), b = boiteDe(q, 0), lo, hi;
      [["x1", "x0"], ["x0", "x1"]].forEach(function(k){
        if(Math.abs(a[k[0]] - b[k[1]]) > T) return;
        lo = Math.max(a.y0, b.y0); hi = Math.min(a.y1, b.y1);
        if(hi - lo > T) out.push({ i:i, j:j, u0:a[k[0]], u1:a[k[0]], v0:lo, v1:hi, L:hi - lo,
                                   A:S([a[k[0]], lo]), B:S([a[k[0]], hi]) });
      });
      [["y1", "y0"], ["y0", "y1"]].forEach(function(k){
        if(Math.abs(a[k[0]] - b[k[1]]) > T) return;
        lo = Math.max(a.x0, b.x0); hi = Math.min(a.x1, b.x1);
        if(hi - lo > T) out.push({ i:i, j:j, u0:lo, u1:hi, v0:a[k[0]], v1:a[k[0]], L:hi - lo,
                                   A:S([lo, a[k[0]]]), B:S([hi, a[k[0]]]) });
      });
    });
  });
  return out;
}
/* L'assise de plusieurs emprises : la moyenne pondérée par leur aire, les
   extrêmes de toutes. Une seule emprise rend exactement `assise()`. */
export function assiseDe(R){
  if(R.length === 1) return assise(R[0]);
  var z = 0, A = 0, lo = Infinity, hi = -Infinity;
  R.forEach(function(r){
    var q = assise(r), a = r.w * r.d;
    z += q.z * a; A += a; lo = Math.min(lo, q.lo); hi = Math.max(hi, q.hi);
  });
  return { z:z / A, lo:lo, hi:hi, d:hi - lo };
}
/* La tolérance d'un contact : les positions sont arrondies au décimètre, un
   contact exact n'existe pas. */
export var CONTACT = 0.15;
/* DEUX VOLUMES SONT-ILS UN MÊME BÂTIMENT ? `joint` désigne un voisin accolé (la
   salle de sport intégrée), `bat` le bâtiment d'un parti (les volumes d'une
   aile, d'une barre). Une seule définition, lue par l'implantation, le
   jugement et le dessin. */
export function lies(a, b){
  return a.joint === b.id || b.joint === a.id || (!!a.bat && a.bat === b.bat);
}

/* LE RECOUVREMENT : deux corps d'un même bâtiment peuvent se superposer — un
   bloc posé en biais sur le bout d'une barre ; leur union fait la jonction. Ce
   qu'ils partagent ne compte qu'UNE fois, et c'est ici seulement qu'on le
   mesure. `murs` faux : les intérieurs (surfaces de plancher) ; vrai : les
   emprises hors tout (emprise, volume) et `enfouie`, la façade de l'un prise
   dans l'autre. Un contact n'est pas un recouvrement : il rend 0 et 0, et
   aucune composition du générateur n'en bouge d'un chiffre. Le second temps
   n'est pas de l'enveloppe scolaire : il ne compte pas.
   ponytail: paire par paire — une zone commune à TROIS corps serait comptée de
   travers ; une vraie union de polygones le jour où ça arrive. */
function commun(a, ea, b, eb, murs){
  var R = murs ? volRects : volInts, A = R(a, ea).map(coins), B = R(b, eb).map(coins), aire = 0, enfouie = 0;
  A.forEach(function(P){
    B.forEach(function(Q){
      var X = interConvexe(P, Q);
      if(!X.length) return;
      aire += airePoly(X);
      if(murs) enfouie += longueurDans(P, Q) + longueurDans(Q, P);
    });
  });
  return { aire:aire, enfouie:enfouie };
}
/* `haut(v, e)` : la hauteur d'un étage de corps — alors `volume` et `facade`
   (façade enfouie × hauteur) se lisent à la plus basse des deux : c'est là
   que les deux prismes se recouvrent. */
export function recouvrement(vols, i, murs, haut){
  var E = (vols || []).filter(function(v){ return !v.ph && volEtage(v, i); }), aire = 0, enfouie = 0, volume = 0, facade = 0, j, k;
  for(j = 0; j < E.length; j++) for(k = j + 1; k < E.length; k++){
    if(!lies(E[j], E[k])) continue;
    var ea = volEtage(E[j], i), eb = volEtage(E[k], i), c = commun(E[j], ea, E[k], eb, murs);
    aire += c.aire; enfouie += c.enfouie;
    if(haut && c.aire){
      var h = Math.min(haut(E[j], ea), haut(E[k], eb));
      volume += c.aire * h; facade += c.enfouie * h;
    }
  }
  return { aire:aire, enfouie:enfouie, volume:volume, facade:facade };
}
/* Ce que `v` cède à l'étage `i` : la partie commune appartient au PLUS GRAND
   des deux corps à cet étage — la barre garde son programme, le bloc posé
   dessus en cède ; à égalité, le premier de la liste garde. Les parts cédées
   se resomment exactement au recouvrement : les typologies ne pavent la zone
   commune qu'une fois. */
export function partCedee(v, vols, i){
  var ev = volEtage(v, i);
  if(!ev || v.ph) return 0;
  var av = aireEtage(ev), iv = vols.indexOf(v), c = 0;
  vols.forEach(function(o, k){
    if(o === v || o.ph || !lies(v, o)) return;
    var eo = volEtage(o, i);
    if(!eo) return;
    var ao = aireEtage(eo);
    if(ao > av || (ao === av && k < iv)) c += commun(v, ev, o, eo, false).aire;
  });
  return c;
}

/* Les quatre bandes de mur d'un étage, pour le dessin : deux longs pans pleine
   largeur, deux pignons entre eux, 50 cm vers l'intérieur de l'emprise. */
export function mursDe(v, e){
  if(fusionne(e)){
    /* un volume fusionné : ce que le contour couvre et qu'aucun intérieur ne
       couvre — le mur commun d'une jonction n'y est plus */
    var P = partsDe(e), c = Math.cos(v.a), s = Math.sin(v.a);
    return diffRects(P.map(function(p){ return boiteDe(p, RULES.haut.mur); }),
                     P.map(function(p){ return boiteDe(p, 0); })).map(function(b){
      var u = (b.x0 + b.x1) / 2, w = (b.y0 + b.y1) / 2;
      return { x:v.x + u * c - w * s, y:v.y + u * s + w * c, w:b.x1 - b.x0, d:b.y1 - b.y0, a:v.a };
    });
  }
  var r = volInt(v, e), m = RULES.haut.mur;
  var R = { x:r.x, y:r.y, w:r.w + 2 * m, d:m, a:r.a };
  var P = { x:r.x, y:r.y, w:m, d:r.d, a:r.a };
  return [local(R, 0, -(r.d + m) / 2), local(R, 0, (r.d + m) / 2),
          local(P, -(r.w + m) / 2, 0), local(P, (r.w + m) / 2, 0)];
}

/* LES PASSERELLES. Une passerelle ne porte ni programme ni surface : c'est une
   CONNEXION `{ a, b, i }` — deux volumes, un niveau. Sa géométrie se DÉDUIT des
   deux volumes à chaque lecture : un corps déplacé à la main l'emporte avec
   lui, et une passerelle dont les façades ne se font plus face n'est plus
   dessinée. Elle relie deux façades parallèles, au droit de ce qu'elles ont en
   commun. */
export function pontRect(p, vols){
  var A = null, B = null;
  (vols || MASS.vol).forEach(function(v){ if(v.id === p.a) A = v; if(v.id === p.b) B = v; });
  if(!A || !B) return null;
  var ea = volEtage(A, p.i), eb = volEtage(B, p.i);
  if(!ea || !eb) return null;
  var ra = volRect(A, ea), rb = volRect(B, eb);
  var da = ecartAngle(rb.a, ra.a);
  var tourne = Math.abs(Math.abs(da) - Math.PI / 2) <= .05;
  if(!tourne && Math.abs(da) > .05) return null;
  /* B dans le repère de A. */
  var c = Math.cos(-ra.a), s = Math.sin(-ra.a);
  var u = (rb.x - ra.x) * c - (rb.y - ra.y) * s, v = (rb.x - ra.x) * s + (rb.y - ra.y) * c;
  var bw = (tourne ? rb.d : rb.w) / 2, bd = (tourne ? rb.w : rb.d) / 2;
  var L = V.passLarg, q = null;
  var ou0 = Math.max(-ra.w / 2, u - bw), ou1 = Math.min(ra.w / 2, u + bw);
  var ov0 = Math.max(-ra.d / 2, v - bd), ov1 = Math.min(ra.d / 2, v + bd);
  if(ou1 - ou0 >= L + 2){
    var g0 = v > 0 ? ra.d / 2 : v + bd, g1 = v > 0 ? v - bd : -ra.d / 2;
    if(g1 - g0 > .1) q = { u:(ou0 + ou1) / 2, v:(g0 + g1) / 2, w:L, d:g1 - g0, l:g1 - g0 };
  } else if(ov1 - ov0 >= L + 2){
    var h0 = u > 0 ? ra.w / 2 : u + bw, h1 = u > 0 ? u - bw : -ra.w / 2;
    if(h1 - h0 > .1) q = { u:(h0 + h1) / 2, v:(ov0 + ov1) / 2, w:h1 - h0, d:L, l:h1 - h0 };
  }
  if(!q) return null;
  var r = local({ x:ra.x, y:ra.y, w:q.w, d:q.d, a:ra.a }, q.u, q.v);
  r.long = q.l;
  return r;
}
export function volEtage(v, i){
  var e = null;
  v.lv.forEach(function(x){ if(x.i === i) e = x; });
  return e;
}
export function volAire(v){
  var a = 0;
  v.lv.forEach(function(e){ a += aireEtage(e); });
  return a;
}
/* L'emprise au sol : le plus bas étage hors sol, celui qui touche le terrain. */
export function volSol(v){
  var best = null;
  v.lv.forEach(function(e){
    if(lvlOf(e.i) < 0) return;
    if(!best || e.i < best.i) best = e;
  });
  return best ? volRect(v, best) : null;
}
/* Toutes les emprises du plus bas étage hors sol — une par part. */
export function solRects(v){
  var best = null;
  v.lv.forEach(function(e){
    if(lvlOf(e.i) < 0) return;
    if(!best || e.i < best.i) best = e;
  });
  return volRects(v, best || v.lv[0]);
}
export function volCoins(v){
  var r = volSol(v);
  return r ? coins(r) : [];
}
/* L'altitude du rez du volume : la moyenne du terrain sous son emprise. Un
   bâtiment posé sur l'altitude de son centre s'enterre d'un côté. */
export function volAssise(v){
  var r = volSol(v);
  return r ? assiseDe(solRects(v)) : { z:RULES.site.altMoy, lo:0, hi:0, d:0 };
}
/* La hauteur hors sol d'un volume : la somme des hauteurs de niveau qu'il
   porte au-dessus du terrain, plus l'acrotère. Elle n'est pas un réglage —
   elle est une conséquence du programme, comme au mixer. */
export function volHaut(v){
  var N = niveaux(), h = 0;
  v.lv.forEach(function(e){
    var n = N[e.i];
    if(n && n.lvl >= 0) h += hauteurEtage(e, n);
  });
  return h > 0 ? h + (v.ph ? 0 : RULES.haut.acrotere) : 0;
}
/* LA HAUTEUR D'UN ÉTAGE EST CELLE DU VOLUME, pas celle du niveau. Le mixer
   donne au niveau la hauteur de sa plus haute pièce : le rez prenait donc
   partout les 7,40 m de la salle de sport, et un corps de classes posé à côté
   d'elle montait d'autant. Chaque volume porte la hauteur de ce qu'IL porte :
   - un ouvrage du second temps, ou un corps importé, sa hauteur mesurée (`e.h`) ;
   - un volume aux postes nommés (`e.keys`, la salle de sport), la leur ;
   - un corps d'école, celle de son niveau SANS les postes aux cotes imposées,
     qui ont leur propre volume (`n.hc`). */
export function hauteurEtage(e, n){
  if(e && e.h) return e.h;
  if(e && e.keys && e.keys.length) return hauteurDe(e.keys);
  return n ? (n.hc != null ? n.hc : n.h) : 0;
}
function hauteurDe(keys){
  var hl = RULES.haut.libre.def;
  keys.forEach(function(k){ var p = PMAP[k]; if(p && p.hlibre > hl) hl = p.hlibre; });
  return Math.round((hl + RULES.haut.dalle) * 100) / 100;
}
/* La hauteur d'un niveau pour les corps d'école : celle de ses pièces, hors
   des postes qui ont leur propre volume — aux cotes imposées (`placerSport`)
   ou hors de l'enveloppe scolaire (le second temps, `secondTemps`). */
function hauteurCourante(i){
  var keys = [];
  BLOCKS.forEach(function(b){
    var p = PMAP[b.key];
    if(b.fl === i && !p.solid && !p.hors && keys.indexOf(b.key) < 0) keys.push(b.key);
  });
  return hauteurDe(keys);
}
export function volNiv(v){
  var n = 0;
  v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) n++; });
  return n;
}
/* LES NIVEAUX ALIGNÉS : tous les bâtiments d'école posent leur rez à la même
   altitude — la moyenne du terrain sous leurs emprises, pondérée par elles —,
   pour que leurs planchers se rejoignent. Une préférence plus forte que la
   mise au terrain (`orientation.js — nivalign`, Prioritaire ; « Peu de
   terrassement » est Souhaitée) : le terrain ne décide plus de l'altitude, il
   se lit dans le terrassement que cette altitude demande. Éteinte, chaque
   volume se pose sur le terrain sous son emprise. Le second temps garde la
   sienne : il n'est pas de l'école. */
function aligne(){ return vise("nivalign"); }
export function datumEcole(vols){
  var z = 0, A = 0;
  vols.forEach(function(v){
    if(v.ph) return;
    solRects(v).forEach(function(r){ var a = r.w * r.d; z += assise(r).z * a; A += a; });
  });
  return A ? z / A : null;
}
/* L'ASSISE D'UN VOLUME, celle où se pose son rez : son terrain, ou l'altitude
   commune de l'école. `d` est le terrassement : l'écart entre le plus haut et
   le plus bas de son terrain ET de son rez — le dénivelé sous l'emprise quand
   le rez suit le terrain, davantage quand l'altitude commune l'en écarte. */
export function assiseEff(v, vols){
  var t = assiseDe(solRects(v)), z = t.z;
  if(!v.ph && aligne()){
    var d0 = datumEcole(vols || (MASS.vol.indexOf(v) >= 0 ? MASS.vol : [v]));
    if(d0 != null) z = d0;
  }
  return { z:z, lo:t.lo, hi:t.hi, d:Math.max(t.hi, z) - Math.min(t.lo, z), terrain:t.z };
}
/* LES ÉTAGES D'UN VOLUME, À LEUR ALTITUDE : l'emprise de chacun, murs compris,
   son pied et sa tête en mètres ABSOLUS. Le rez se pose sur l'assise
   (`assiseEff`), les étages montent depuis elle, chacun de SA hauteur
   (`hauteurEtage`), les sous-sols descendent sous elle. La 3D et l'export la
   lisent ici : deux calculs auraient fini par poser le même bâtiment à deux
   altitudes. `vols` : la volumétrie dont il fait partie — l'écran par défaut. */
export function etagesDe(v, vols){
  var N = niveaux(), out = [], sous = 0;
  var lv = v.lv.slice().sort(function(a, b){ return a.i - b.i; });
  lv.forEach(function(e){ if(lvlOf(e.i) < 0 && N[e.i]) sous += hauteurEtage(e, N[e.i]); });
  var z = assiseEff(v, vols).z - sous;
  lv.forEach(function(e){
    var n = N[e.i];
    if(!n) return;
    var h = hauteurEtage(e, n);
    /* `rc` la part 0, `rcs` toutes, `contour` leur union */
    out.push({ e:e, n:n, rc:volRect(v, e), rcs:volRects(v, e), contour:contourDe(v, e), z0:z, z1:z + h, h:h });
    z += h;
  });
  return out;
}
/* Une passerelle à son altitude : au niveau qu'elle dessert, posée sur le pied
   de cet étage dans le premier des deux volumes qu'elle relie. */
export function pontEtage(p){
  var r = pontRect(p), A = null, N = niveaux(), s = null;
  MASS.vol.forEach(function(v){ if(v.id === p.a) A = v; });
  if(!r || !A || !N[p.i]) return null;
  etagesDe(A).forEach(function(x){ if(x.e.i === p.i) s = x; });
  if(!s) return null;
  return { rc:r, z0:s.z0, z1:s.z1, h:s.h };
}
/* Le nom d'un volume, tel que le plan l'écrit : le sien s'il en a un, « Sport »
   pour la salle aux cotes imposées, sinon son rang. L'export le reprend, pour
   qu'on retrouve dans Rhino le V3 qu'on a lu au plan. */
export function volNom(v, k){
  return v.nom ? v.nom : v.fix ? "Sport" : "V" + (k + 1);
}
/* Le même nom, en toutes lettres : pour les messages du contrôle et du juge,
   qui ne peuvent pas écrire « V3 sort du périmètre ». */
export function volTitre(v, k){
  return v.nom || (v.fix ? "Salle de sport" : "Volume " + (k + 1));
}

/* ---------- le bilan : ce que le massing doit au programme -------------------
   La question que l'outil doit savoir répondre à tout moment : la surface
   posée est-elle celle que le programme demande ? On la pose niveau par
   niveau, parce que c'est là qu'elle se règle. */
export function bilan(){
  var N = niveaux(), out = [], i;
  for(i = 0; i < N.length; i++){
    var dem = demande(i, MASS.vol), po = 0;
    MASS.vol.forEach(function(v){
      /* Un ouvrage du second temps n'est pas de l'enveloppe scolaire : il ne
         pèse sur aucun plateau, et le compter ici ferait croire à un excédent
         de cinq cents mètres carrés au rez. */
      if(v.ph) return;
      var e = volEtage(v, i);
      if(e) po += aireEtage(e);
    });
    /* deux corps du même bâtiment qui se recouvrent : la part commune, une fois */
    po -= recouvrement(MASS.vol, i, false).aire;
    out.push({ i:i, nom:N[i].nom, lvl:N[i].lvl, demande:dem, pose:po, ecart:po - dem });
  }
  return out;
}
export function bilanTotal(){
  var b = bilan(), d = 0, p = 0;
  b.forEach(function(x){ d += x.demande; p += x.pose; });
  return { demande:d, pose:p, ecart:p - d };
}

/* La couleur d'un volume quand on regarde le PROGRAMME : celle de la famille
   qui pèse le plus à ce niveau. Les couleurs sont celles du mixer, lues au
   même endroit — il n'y a pas deux palettes. */
export function familleDom(i){
  var par = {}, best = null, bv = -1;
  postesDe(i).forEach(function(p){ par[p.f] = (par[p.f] || 0) + p.a; });
  var k;
  for(k in par) if(par[k] > bv){ bv = par[k]; best = k; }
  return best || "cla";
}
export function famCol(f){ return FMAP[f] ? "var(" + FMAP[f].c + ")" : "var(--muted-foreground)"; }
export function famTok(f){ return FMAP[f] ? FMAP[f].c : "--muted-foreground"; }

export { aire };

/* ---------- le programme DANS le volume --------------------------------------
   Un volume n'est pas une boîte : c'est du programme extrudé. Un corps qui
   porte un tiers d'un niveau porte un tiers de chacun de ses postes, et l'on
   pave son rectangle avec eux — le même pavage squarifié que le mixer, la même
   règle « un bloc vaut sa surface », les mêmes couleurs de famille.

   C'est ce qui fait que le mode « couleurs du programme » dit quelque chose :
   on lit OÙ sont les classes, pas seulement qu'il y a un bâtiment. Les
   coordonnées rendues sont LOCALES au rectangle, centre en (0, 0) : la vue en
   plan et la 3D les tournent chacune à sa façon. */
/* Ce qu'un étage doit montrer quand on le pave. Un étage aux cotes imposées ne
   porte que SON poste — la salle de sport n'a pas de salles de classe dedans —
   et les autres ne portent pas le sien : sa surface est sortie du partage avant
   qu'il commence. C'est l'ÉTAGE qui décide, et non le volume : depuis que la
   salle de sport peut en porter un au-dessus d'elle, celui-là loge du programme
   ordinaire. Le plan et la 3D en tenaient chacun leur copie.  */
export function filtreDe(v, e){
  /* Un étage peut porter PLUSIEURS postes imposés — la piscine et le local CAD
     réunis en un seul ouvrage du second temps —, d'où une liste et non une clé.
     `hors` ouvre le pavage aux postes hors enveloppe, qui n'y entrent jamais
     autrement : c'est ce qui donne sa couleur à un volume du second temps. */
  if(e && e.keys && e.keys.length) return { seul:e.keys, hors:1 };
  var sans = [];
  MASS.vol.forEach(function(x){
    x.lv.forEach(function(q){
      if(q.keys) q.keys.forEach(function(k){ sans.push(k); });
    });
  });
  return { sans:sans };
}

export function cellules(i, w, d, o){
  var P = postesDe(i, o && o.hors), tot = 0;
  /* Un corps dont le règlement impose les cotes ne porte QUE son poste — la
     salle de sport double n'a pas de salles de classe dedans. Et les autres ne
     portent pas le sien : sa surface est sortie du partage avant qu'il
     commence, la remettre dans leur pavage l'aurait comptée deux fois. */
  if(o && o.seul) P = P.filter(function(p){ return o.seul.indexOf(p.key) >= 0; });
  else if(o && o.sans && o.sans.length)
    P = P.filter(function(p){ return o.sans.indexOf(p.key) < 0; });
  P.forEach(function(p){ tot += p.a; });
  if(!tot || w <= 0 || d <= 0) return [];
  var part = (w * d) / tot;
  var cel = squarify(P.map(function(p){ return { key:p.key, v:p.a * part }; }),
                     { x:-w / 2, y:-d / 2, w:w, h:d });
  var by = {};
  P.forEach(function(p){ by[p.key] = p; });
  return cel.map(function(c){
    var p = by[c.key];
    return { key:c.key, n:p ? p.n : c.key, f:p ? p.f : "cla",
             x:c.x, y:c.y, w:c.w, d:c.h, a:c.w * c.h };
  });
}
