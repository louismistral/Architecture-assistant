/* ============================================================================
   RÉPARTIR LE PROGRAMME SUR LES NIVEAUX

   Un seul moteur, et il NOTE avant de poser. Chaque niveau candidat reçoit une
   note — la place qui y reste, les adjacences exigées déjà satisfaites, la
   grappe qui y pèse, la famille d'usage, ce que l'usage scolaire veut au rez et
   ce qu'il veut à l'étage —, un bruit d'amplitude réglable s'y ajoute, et le
   meilleur gagne. À température nulle, le tirage est déterministe et rend la
   meilleure répartition ; plus elle monte, plus il propose des variantes.

   CE QUI A PRÉCÉDÉ, et pourquoi c'était faux :

     — un poste allait au niveau LE PLUS VIDE, pondéré par la place restante.
       C'était la seule note. On remplissait, on ne composait pas ;
     — « Shuffle » mélangeait les postes puis les RETRIAIT par surface : le tri
       écrasait le mélange, qui ne servait plus que de départage entre postes de
       même taille. La variation ne venait que du tirage pondéré caché ;
     — le nombre d'étages se déduisait d'un plateau de 2'400 m², un nombre rond
       sans rapport avec le site, et le sous-sol se décidait à PILE OU FACE —
       ce qui contredisait frontalement l'analyse de nappe du projet ;
     — les dix-huit classes se répartissaient au prorata de la place libre, donc
       débordaient d'un étage à l'autre par simple remplissage. Aucune école qui
       existe ne fait cela : un degré tient sur un niveau.

   Les contraintes de CONNEXION ne sont toujours jamais dures. Elles sont des
   préférences notées, et `src/mix/checks.js` dit après coup ce qui n'a pas pu
   tenir. C'est la règle du projet : rien n'est empêché, rien n'est silencieux.

   Tous les poids, seuils et plafonds de ce fichier vivent dans
   `src/data/doctrine.js`, et se règlent dans le volet « Contraintes » du mixer.
   ========================================================================= */
import { CIRC } from "../core/model.js";
import { rng, shuffled } from "../core/rand.js";
import { DOC } from "../data/doctrine.js";
import { RULES } from "../data/rules.js";
/* L'aire POSABLE de la parcelle, recul compris. Elle vit dans `mass/geom.js`
   parce que c'est là qu'est la géométrie du site — mais c'est une mesure de
   terrain, pas une décision de volumétrie, et c'est bien le mixer qui doit s'en
   servir : le nombre d'étages est une conséquence de ce que la parcelle peut
   porter, et non d'un nombre rond. */
import { airePosable } from "../mass/geom.js";
import {
  BLOCKS, FLOORS, PLATE_MAX, PLATE_MIN, TRAY, delFloorAt, flBuilt, flCount,
  flNet, fuse, grade, nextUid, onFloor, place, setPlate, setStack, toTray, usable
} from "./floors.js";
import { CLSRE, UNITE, VESTC, WCF, WCG, WCRE, ancreDe, lvRange } from "./niv.js";
import { PMAP, PROX, aOf, grappeDe, posables, qOf, uOf } from "./prog.js";

/* Indices de niveaux qu'un poste peut occuper, dans la pile courante. */
export function rangeOf(p){
  var lr = lvRange(p), lo = 1e9, hi = -1e9;
  FLOORS.forEach(function(F, i){
    if(F.lvl >= lr.min && F.lvl <= lr.max){ lo = Math.min(lo, i); hi = Math.max(hi, i); }
  });
  if(lo > hi){ var z = grade(); lo = z; hi = z; }
  var out = [];
  for(var i = lo; i <= hi; i++) out.push(i);
  return out;
}
function libre(i){ return usable(i) - flNet(i); }

/* ---------- ce que la note regarde ------------------------------------------ */

/* Les adjacences, indexées par poste une fois pour toutes : la table `PROX` est
   parcourue des centaines de fois par tirage, et elle ne bouge pas. */
var VOIS = {};
PROX.forEach(function(l){
  (VOIS[l.a] = VOIS[l.a] || []).push({ o:l.b, opt:l.opt });
  (VOIS[l.b] = VOIS[l.b] || []).push({ o:l.a, opt:l.opt });
});

/* Ce qui fait du bruit, et ce qui demande le calme. Aucun article ne l'écrit :
   c'est de l'usage scolaire, et c'est assumé comme tel dans la doctrine. */
var BRUYANT = /Salle de sport double|Scène|^Cuisine|Réfectoire|foyer/;

/* Ce poste est-il attaché à un autre par une proximité EXIGÉE ? */
function attache(key){
  var l = VOIS[key] || [], i;
  for(i = 0; i < l.length; i++) if(!l[i].opt) return true;
  return false;
}
function aireFam(f, i){
  var a = 0;
  BLOCKS.forEach(function(b){
    if(b.fl !== i || b.fl === TRAY) return;
    if(PMAP[b.key].f === f) a += aOf(b.key, b.q);
  });
  return a;
}
function aireDes(set, i){
  var a = 0;
  BLOCKS.forEach(function(b){
    if(b.fl !== i || b.fl === TRAY || !set[b.key]) return;
    a += aOf(b.key, b.q);
  });
  return a;
}
function porteDes(re, i){
  var n = 0;
  BLOCKS.forEach(function(b){ if(b.fl === i && re.test(PMAP[b.key].n)) n += b.q; });
  return n;
}

/* La NOTE d'un niveau pour un poste. Positive = ce niveau lui va. Tous les
   poids sont dans `doctrine.js` : c'est là qu'on corrige une répartition qui
   déplaît, et nulle part ailleurs. */
function noteNiveau(p, f, pose){
  var s = 0, lv = FLOORS[f] ? FLOORS[f].lvl : 0;
  var besoin = aOf(p.key, qOf(p.key));

  /* 1 — la place. Elle ne décide plus à elle seule, mais elle décide encore :
     poser six cents mètres carrés là où il en reste cinquante n'est pas une
     variante, c'est une erreur qu'il faudra défaire. */
  var l = libre(f);
  if(l <= 0) s -= DOC.debordPoids;
  else s += DOC.placePoids * Math.min(1, l / Math.max(1, besoin));

  /* 2 — les adjacences exigées déjà posées. Au même niveau elles rapportent
     plein ; à un niveau d'écart, la moitié ; au-delà, elles coûtent. */
  (VOIS[p.key] || []).forEach(function(v){
    var ls = pose[v.o];
    if(!ls || !ls.length) return;
    var d = Infinity;
    ls.forEach(function(g){ d = Math.min(d, Math.abs(g - f)); });
    var w = DOC.adjPoids * (v.opt ? DOC.adjOpt : 1);
    /* Plus c'est loin, plus ça coûte : une pénalité plate faisait qu'un dépôt
       descendait au sous-sol pour quatorze points de commodité technique en
       laissant la salle qu'il dessert deux niveaux plus haut. */
    s += d === 0 ? w : (d === 1 ? w * 0.25 : -w * 0.5 * d);
  });

  /* 3 — la grappe : là où elle pèse déjà, elle appelle le reste. C'est la même
     notion que « Grouper les liés » déplace d'un bloc dans la vue. */
  var gr = grappeDe(p.key);
  if(gr.length > 1){
    var set = {}, tot = 0, ici;
    gr.forEach(function(k){ if(k !== p.key) set[k] = 1; });
    FLOORS.forEach(function(F, i){ tot += aireDes(set, i); });
    ici = aireDes(set, f);
    if(tot > 0) s += DOC.grappePoids * (ici / tot);
  }

  /* 4 — la famille d'usage : à défaut d'exigence écrite, ce qui se ressemble
     s'assemble. Poids faible, c'est un départage. */
  var ft = 0, fi = aireFam(p.f, f);
  FLOORS.forEach(function(F, i){ ft += aireFam(p.f, i); });
  if(ft > 0) s += DOC.famPoids * (fi / ft);

  /* 5 — l'usage scolaire. Le rez reçoit le public, les parents, les livraisons
     et les usages hors horaire ; les classes montent ; le technique descend. */
  if(CLSRE.test(p.n) && lv > 0) s += DOC.classeEtage * Math.min(lv, RULES.niv.classeMax);
  /* …sauf s'il est attaché à un local précis par le schéma fonctionnel : le
     dépôt de la salle ACM descendait au sous-sol pour dix points de commodité
     technique, en laissant deux niveaux plus haut la salle qu'il dessert. */
  if(p.f === "tec" && lv < 0 && !attache(p.key)) s += DOC.techSousSol;

  /* 6 — bruyant contre calme, dans les deux sens. */
  if(BRUYANT.test(p.n) && porteDes(CLSRE, f) > 0) s -= DOC.bruitCalme;
  if(CLSRE.test(p.n) && porteDes(BRUYANT, f) > 0) s -= DOC.bruitCalme;

  return s;
}

/* Le bruit de Gumbel : ajouté à des notes puis pris au maximum, il ÉCHANTILLONNE
   exactement la loi softmax de ces notes à la température donnée. C'est le seul
   endroit d'où vient la variation d'une répartition à l'autre — et à
   température nulle il disparaît, donc « Shuffle » rend la meilleure. */
var BRUIT = 40;
function bruit(alea){
  if(!alea || DOC.temperature <= 0) return 0;
  var u = rng();
  if(u <= 0) u = 1e-9;
  if(u >= 1) u = 1 - 1e-9;
  return -Math.log(-Math.log(u)) * DOC.temperature * BRUIT;
}

/* Combien d'unités d'un poste un même niveau accepte. L'unité pédagogique est
   la seule limite de ce genre : un degré tient sur un niveau, avec ses
   dégagements — au-delà, on fait un couloir d'hôpital. */
function capParNiveau(p, f){
  if(!UNITE.test(p.n)) return Infinity;
  /* Le plafond porte sur le NIVEAU, pas sur le poste : les salles standard et
     celles de réserve sont deux postes, et chacun respectait le sien — onze plus
     trois faisaient quatorze salles sur un plateau qui n'en admet que onze. */
  var deja = 0;
  BLOCKS.forEach(function(b){
    if(b.fl === f && UNITE.test(PMAP[b.key].n)) deja += b.q;
  });
  return Math.max(0, Math.round(DOC.clsParNiveau) - deja);
}
/* Le contingent de salles de classe, et les niveaux qu'il demande. C'est une
   contrainte sur la PILE, pas seulement sur le remplissage : vingt et une
   salles à onze par niveau ne tiennent pas sur un seul étage, et proposer une
   pile qui ne peut pas les loger revient à proposer un avertissement. */
function etagesDeClasses(){
  var n = 0;
  posables().forEach(function(p){ if(UNITE.test(p.n)) n += qOf(p.key); });
  return Math.ceil(n / Math.max(1, Math.round(DOC.clsParNiveau)));
}

/* ---------- poser un poste ---------------------------------------------------
   Les niveaux candidats sont notés, triés, et remplis dans cet ordre : au mieux
   d'abord, le débord ensuite. Un poste aux cotes imposées ne se coupe pas — il
   va entier au meilleur niveau, quitte à le faire déborder, et le contrôle le
   dira. Le mixer ne refuse rien. */
function poser(p, cand, alea, pose){
  var key = p.key, q = qOf(key), u = uOf(key);
  if(q <= 0 || !cand.length) return;
  var notes = cand.map(function(f){
    return { f:f, s: noteNiveau(p, f, pose) + bruit(alea) };
  }).sort(function(a, b){ return b.s - a.s; });

  var want = {}, rest = q, i;
  if(p.solid){
    want[notes[0].f] = q; rest = 0;
  } else {
    for(i = 0; i < notes.length && rest > 0; i++){
      var f = notes[i].f;
      var tient = u > 0 ? Math.floor(Math.max(0, libre(f)) / u) : rest;
      var n = Math.min(rest, capParNiveau(p, f), Math.max(0, tient));
      if(n <= 0) continue;
      want[f] = (want[f] || 0) + n;
      rest -= n;
      /* La pose est écrite au fur et à mesure : le niveau suivant doit voir la
         place que celui-ci vient de prendre. */
      place(key, want);
    }
    /* Plus de place nulle part : le reste se pose quand même, réparti sur les
       niveaux candidats du mieux noté au moins bon, une unité à la fois. Le
       verser en bloc au mieux noté y entassait quatre salles de plus et
       déclenchait l'avertissement d'unité pédagogique sur un niveau que le
       tirage venait de remplir — alors que le voisin avait de la marge. */
    var tour = 0;
    while(rest > 0 && tour < 200){
      var g = notes[tour % notes.length].f;
      want[g] = (want[g] || 0) + 1; rest--; tour++;
    }
  }
  place(key, want);
  pose[key] = Object.keys(want).map(function(k){ return parseInt(k, 10); });
}

/* ---------- sanitaires ---------------------------------------------------
   Les WC garçons et filles et les vestiaires de classe suivent les classes, au
   prorata de celles que porte chaque niveau, avec au moins un WC de chaque
   genre là où il y a des classes. Un étage sans sanitaires ne se dessine pas.
   Aucun article ne l'écrit : c'est une règle de projet, et elle est nommée
   comme telle dans la doctrine. */
function equilibrerWC(){
  var cls = [], use = [], i, tc = 0;
  for(i = 0; i < FLOORS.length; i++){ cls[i] = 0; use[i] = 0; }
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    var p = PMAP[b.key];
    if(p.f !== "tec") use[b.fl] += b.q;         /* un niveau technique n'appelle pas de WC */
    if(CLSRE.test(p.n)) cls[b.fl] += b.q;
  });
  for(i = 0; i < FLOORS.length; i++) tc += cls[i];

  function repartir(re, minPar){
    posables().forEach(function(p){
      if(!re.test(p.n)) return;
      var cand = rangeOf(p), q = qOf(p.key), want = {}, rest = q, frac = [];
      if(q <= 0 || !cand.length) return;
      cand.forEach(function(f){
        var n = (use[f] && minPar) ? Math.min(minPar, Math.max(0, rest)) : 0;
        want[f] = n; rest -= n;
      });
      cand.forEach(function(f){
        var part = tc > 0 ? rest * cls[f] / tc : (use[f] ? rest / cand.length : 0);
        want[f] += Math.floor(part);
        frac.push({ f:f, r: part - Math.floor(part), o: use[f] ? 1 : 0 });
      });
      var pose = 0;
      cand.forEach(function(f){ pose += want[f]; });
      frac.sort(function(a, b){ return (b.o - a.o) || (b.r - a.r); });
      var k = 0;
      while(pose < q && frac.length){ want[frac[k % frac.length].f]++; pose++; k++; }
      place(p.key, want);
    });
  }
  repartir(WCG, 1);
  repartir(WCF, 1);
  repartir(VESTC, 0);

  /* Repêchage : un niveau occupé sans le moindre WC en reçoit un, pris là où
     il y en a plusieurs. */
  var has = [];
  for(i = 0; i < FLOORS.length; i++) has[i] = 0;
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    if(WCRE.test(PMAP[b.key].n)) has[b.fl] += b.q;
  });
  for(i = 0; i < FLOORS.length; i++){
    if(!use[i] || has[i]) continue;
    var don = null;
    BLOCKS.forEach(function(b){
      if(don || b.fl === TRAY || b.fl === i) return;
      if(!WCRE.test(PMAP[b.key].n) || b.q < 1 || has[b.fl] <= 1) return;
      if(rangeOf(PMAP[b.key]).indexOf(i) < 0) return;
      don = b;
    });
    if(!don) continue;
    has[don.fl]--; don.q--;
    if(don.q <= 0) BLOCKS.splice(BLOCKS.indexOf(don), 1);
    BLOCKS.push({ u: nextUid(), key: don.key, q: 1, fl: i });
    has[i]++;
  }
}

/* ---------- la pile elle-même --------------------------------------------
   Combien de niveaux ? La question se pose AVANT la répartition, et sa réponse
   se déduit du site : l'aire réellement posable de la parcelle — le périmètre
   moins le recul, soit 10'528 m² — multipliée par la part qu'un plateau peut en
   prendre. Le reste va à la cour, aux accès, au stationnement et aux six mètres
   entre corps.

   On ne tire donc plus un nombre d'étages : on construit la LISTE des piles
   admissibles — celles dont le plateau déduit tient dans l'emprise, dont les
   étages ne dépassent pas le plafond, et dont le rez porte au moins ce que le
   règlement y cloue — et l'on en prend une, les plus compactes d'abord. Une
   variante tirée est alors une variante VALABLE, et non une pile à corriger. */
export function pilesAdmissibles(){
  var besoinNet = 0, enterrable = 0, rezOblige = 0;
  posables().forEach(function(p){
    if(p.hors) return;
    var a = aOf(p.key, qOf(p.key)), lr = lvRange(p);
    besoinNet += a;
    if(lr.min < 0 && p.f === "tec") enterrable += a;
    if(lr.max === 0) rezOblige += a;
  });
  var k = 1 / (1 - CIRC);
  var bati = besoinNet * k, rezMin = rezOblige * k;
  var emprise = airePosable(RULES.dist.retrait) * DOC.plateauPart;
  var sous = enterrable >= DOC.sousSolMin ? 1 : 0;
  var horsSol = Math.max(0, bati - (sous ? enterrable * k : 0));

  /* Les plateaux ne sont PAS uniformes, et c'est le point. Le rez porte tout ce
     que le règlement y cloue — la salle de sport, les halls, l'administration,
     l'UAPE, le chauffage —, soit beaucoup plus qu'un étage courant. Un plateau
     unique pour toute la pile donnait au dernier étage la taille du rez, donc
     des niveaux vides qu'aucun programme ne demandait. */
  function arrondi(a){ return Math.max(PLATE_MIN, Math.ceil(a / 10) * 10); }
  var pSous = sous ? Math.min(emprise, arrondi(enterrable * k * DOC.margePlateau)) : 0;

  /* Les niveaux que les classes réclament. Elles vont de préférence à l'étage,
     et le règlement ne les admet pas au-delà du 2ᵉ : la pile doit donc offrir
     assez de niveaux ADMISSIBLES pour le contingent, sinon elle produit une
     répartition qu'on avertit au lieu d'une pile qu'on propose. */
  /* Le rez ne compte PAS parmi eux : il porte déjà tout ce que le règlement y
     cloue — salle de sport, halls, administration, UAPE, chauffage —, et il n'y
     reste pas de quoi loger un degré. Le compter donnait des piles où les vingt
     et une salles se retrouvaient toutes au premier, et l'outil avertissait
     d'une répartition qu'il venait lui-même de proposer. */
  var upCla = Math.max(0, Math.min(RULES.niv.classeMax, etagesDeClasses()));

  var out = [], up;
  for(up = Math.min(upCla, Math.max(0, Math.round(DOC.etagesMax)));
      up <= Math.max(0, Math.round(DOC.etagesMax)); up++){
    var pRez = Math.max(rezMin, horsSol / (1 + up)) * DOC.margePlateau;
    if(pRez > emprise) continue;                      /* le rez ne tient pas sur la parcelle */
    pRez = arrondi(pRez);
    /* Ce que le rez laisse aux étages se mesure sur sa CAPACITÉ, marge déduite,
       et non sur son plateau : le plateau du rez est gonflé du jeu qu'on lui
       laisse, et compter ce jeu comme du programme déjà logé rognait les étages
       de cent mètres carrés chacun — qui débordaient ensuite. */
    var reste = horsSol - pRez / DOC.margePlateau;
    if(up > 0 && reste <= 1) continue;                /* un étage vide n'est pas une pile */
    var pUp = up > 0 ? arrondi(reste / up * DOC.margePlateau) : 0;
    if(pUp > emprise) continue;
    if(pRez + up * pUp < horsSol - 1) continue;       /* la pile ne loge pas le programme */
    var plates = [];
    if(sous) plates.push(pSous);
    plates.push(pRez);
    for(var j = 0; j < up; j++) plates.push(pUp);
    out.push({ sous:sous, up:up, plates:plates, plate:pRez, plateUp:pUp,
               emprise:Math.round(emprise) });
  }
  /* Rien ne tient : on rend quand même la pile la plus haute, à l'emprise
     maximale. Le contrôle dira qu'il manque de la surface — c'est mieux qu'une
     pile d'un seul niveau qu'on n'a pas demandée. */
  if(!out.length){
    var nu = Math.max(0, Math.round(DOC.etagesMax)), pl = [], m = arrondi(emprise);
    if(sous) pl.push(pSous);
    for(var q = 0; q <= nu; q++) pl.push(m);
    out.push({ sous:sous, up:nu, plates:pl, plate:m, plateUp:m,
               emprise:Math.round(emprise), serre:1 });
  }
  return out;
}
export function proposerPile(alea){
  var P = pilesAdmissibles(), choix = P[0];
  if(alea && P.length > 1){
    /* Les plus compactes d'abord : les poids décroissent géométriquement, donc
       la pile la plus basse reste la plus probable sans que les autres soient
       hors d'atteinte. */
    var tot = 0, w = [], i;
    for(i = 0; i < P.length; i++){ w[i] = Math.pow(0.55, i); tot += w[i]; }
    var r = rng() * tot;
    for(i = 0; i < P.length; i++){ r -= w[i]; if(r <= 0){ choix = P[i]; break; } }
  }
  setStack(choix.sous, choix.up, choix.plates);
  return FLOORS.length;
}

/* ---------- la répartition ------------------------------------------------ */
export function repartir(opts){
  var alea = !!(opts && opts.alea);
  if(opts && opts.etages) proposerPile(alea);

  toTray();
  var pose = {};                      /* key → niveaux retenus */
  var libres = [], ancres = [], fixes = [];

  posables().forEach(function(p){
    var cand = rangeOf(p);
    var rec = { p:p, cand:cand, a: aOf(p.key, qOf(p.key)) };
    if(cand.length === 1) fixes.push(rec);
    else if(ancreDe(p)) ancres.push(rec);
    else libres.push(rec);
  });

  /* 1 — ce que le règlement cloue : un seul niveau possible. Les plus grands
         d'abord, parce qu'ils décident du reste. */
  fixes.sort(function(a, b){ return b.a - a.a; })
       .forEach(function(r){ poser(r.p, r.cand, alea, pose); });

  /* 2 — ce qui doit suivre un autre poste : la scène suit la salle de sport.
         L'ancre est une contrainte de niveau, pas une préférence : on restreint
         donc les candidats au niveau de l'ancre quand il est admissible. */
  ancres.sort(function(a, b){ return b.a - a.a; }).forEach(function(r){
    var anc = ancreDe(r.p);
    var chez = (pose[anc] || []).filter(function(f){ return r.cand.indexOf(f) >= 0; });
    poser(r.p, chez.length ? chez : r.cand, alea, pose);
  });

  /* 3 — le reste, du plus gros au plus petit : un grand poste décide, un petit
         s'adapte. L'ordre ne porte plus la variation — c'est la note qui la
         porte —, donc il peut rester le bon ordre. Le mélange ne sert qu'à
         départager les postes de même surface, et c'est tout ce qu'il faisait
         déjà sans qu'on le sache. */
  shuffled(libres).sort(function(a, b){ return b.a - a.a; })
                  .forEach(function(r){ poser(r.p, r.cand, alea, pose); });

  equilibrerWC();

  /* Un dernier étage VIDE n'est pas un étage : la pile en annonçait un que rien
     n'occupait, et le massing allait ensuite chercher une emprise pour un
     niveau de zéro mètre carré. On ne rogne que la pile qu'on vient de
     proposer — celle que l'utilisateur a composée à la main lui appartient,
     même vide. */
  if(opts && opts.etages){
    while(FLOORS.length > 1 && FLOORS[FLOORS.length - 1].lvl > 0
          && flCount(FLOORS.length - 1) === 0){
      delFloorAt(FLOORS.length - 1);
    }
    tasserSommet();
    ajusterPlateaux();
  }
}

/* Un dernier étage qui ne porte que ses sanitaires n'est pas un étage : c'est
   un reste. On redescend ce qu'il porte et on le retire — tant qu'il pèse moins
   du tiers de celui du dessous. Le vider entièrement aurait renvoyé ses pièces
   au bac ; ce n'est pas la même chose, et le bac se remarque. */
function tasserSommet(){
  var tour = 0;
  while(FLOORS.length > 2 && tour++ < 6){
    var t = FLOORS.length - 1;
    if(FLOORS[t].lvl <= 0) break;
    var haut = flNet(t), bas = flNet(t - 1);
    if(haut <= 0 || bas <= 0 || haut > bas * 0.33) break;
    var dur = false;
    onFloor(t).forEach(function(b){
      if(rangeOf(PMAP[b.key]).indexOf(t - 1) < 0){ dur = true; return; }
      b.fl = t - 1;
    });
    if(dur) break;                      /* un poste que la règle n'admet pas plus bas */
    onFloor(t - 1).forEach(function(b){ fuse(b.key); });
    delFloorAt(t);
  }
}

/* LE PLATEAU SUIT LA RÉPARTITION, comme la hauteur de niveau suit le programme
   qu'il porte. Il servait de CAPACITÉ pendant la pose — c'est lui qui répartit
   —, puis restait figé à la valeur estimée : un étage qui portait 1'259 m² en
   annonçait 1'160 et le contrôle criait au débordement sur une pile que l'outil
   venait lui-même de proposer. Le vrai plafond n'a jamais été le plateau, il est
   l'EMPRISE que la parcelle admet ; c'est elle qu'on garde comme borne, et un
   niveau qui la dépasse est alors un vrai conflit, qu'il faut dire. */
function ajusterPlateaux(){
  var emprise = airePosable(RULES.dist.retrait) * DOC.plateauPart;
  FLOORS.forEach(function(F, i){
    var besoin = flBuilt(i);
    if(besoin <= 0) return;
    var p = Math.min(Math.max(PLATE_MIN, Math.ceil(besoin / 10) * 10),
                     Math.min(PLATE_MAX, Math.ceil(emprise / 10) * 10));
    setPlate(i, p);
  });
}
