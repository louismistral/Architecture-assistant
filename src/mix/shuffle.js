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

   Les adjacences sont un CHOIX, lien par lien (`opts.js`) : active, elle met
   ses deux postes au même niveau — d'un poids qui écrase toute autre raison ;
   éteinte, elle ne pèse rien. Le tirage ne refuse toujours rien : quand une
   adjacence active ne peut pas tenir, il pose quand même, et `checks.js` le dit
   en rouge. Rien n'est empêché, rien n'est silencieux.

   Au-dessus des réglages, leurs DÉS : un réglage dont le dé est allumé est
   tiré à chaque Shuffle — la pile —, un réglage dont le dé est éteint est
   respecté tel quel.

   Trois espèces de lignes gouvernent ce fichier, et chacune se lit dans
   l'état (`data/lignes.js — V`) :

     le CADRE        ce qui ferme des niveaux ou plafonne la pile — les règles
                     de niveau (`niv.js`), les adjacences exigées, l'emprise
                     d'un plateau (`data/cadre.js`) ;
     l'ORIENTATION   les points de la note, chacun fois la force de son tag
                     (`data/orientation.js`) ;
     le GÉNÉRATEUR   la part du hasard (`data/recherche.js`).

   Ce que le dé tire — la pile — est un LEVIER (`data/leviers.js`), tiré à parts
   égales.
   ========================================================================= */
import { CIRC } from "../core/model.js";
import { rng, shuffled } from "../core/rand.js";
import { V, enVigueur, reculVise } from "../data/cadre.js";
import { force } from "../data/orientation.js";
import "../data/recherche.js";
import { RULES } from "../data/rules.js";
/* L'aire POSABLE de la parcelle, recul compris. Elle vit dans `mass/geom.js`
   parce que c'est là qu'est la géométrie du site — mais c'est une mesure de
   terrain, pas une décision de volumétrie, et c'est bien le mixer qui doit s'en
   servir : le nombre d'étages est une conséquence de ce que la parcelle peut
   porter, et non d'un nombre rond. */
import { airePosable } from "../mass/geom.js";
import {
  BLOCKS, FLOORS, PLATE_MAX, PLATE_MIN, TRAY, areaOf, delFloorAt, flBrut, flCount,
  flNet, fuse, grade, lvlOf, nextUid, onFloor, place, setPlate, setStack, toTray, usable
} from "./floors.js";
import { BRUYANT, CLASSE, CLSRE, VESTC, WCF, WCG, WCRE, ancreDe, lvRange, prefereNiveau } from "./niv.js";
import {
  adjActive, estLie, setLie
} from "./opts.js";
import { PMAP, PROX, aOf, grappeDe, lienLibre, posables, qOf, uOf } from "./prog.js";

/* Indices de niveaux qu'un poste peut occuper, dans la pile courante. */
export function rangeOf(p){
  var lr = lvRange(p), lo = 1e9, hi = -1e9;
  FLOORS.forEach(function(F, i){
    if(F.lvl >= lr.min && F.lvl <= lr.max){ lo = Math.min(lo, i); hi = Math.max(hi, i); }
  });
  if(lo > hi){ var z = grade(); lo = z; hi = z; }
  var out = [];
  for(var i = lo; i <= hi; i++) out.push(i);
  /* un massing de Rhino dit où va chaque chapitre : ses niveaux seulement — et
     s'il n'en reste aucun que la règle admette, ceux du dessin : c'est lui qui
     décide, le contrôle dira la règle */
  var m = chapDe(p);
  if(m){
    var s = Object.keys(m).map(Number).sort(function(a, b){ return a - b; });
    var x = out.filter(function(f){ return s.indexOf(f) >= 0; });
    out = x.length ? x : s;
  }
  return out;
}
/* LES CHAPITRES D'UN MASSING DE RHINO. Ses solides sont rangés sur un calque par
   chapitre (`data/calques.js — chapDuCalque`) : le dessin dit quel programme va
   dans quel solide. `{ chapitre: { niveau: surface intérieure } }`, lu chez le
   massing (`mass/model.js` l'enregistre : il n'est pas importé d'ici) ; null,
   la répartition est libre. */
var chapitres = function(){ return null; }, CH = null;
export function setChapitres(f){ chapitres = f; }
function chapDe(p){
  var M = CH || chapitres(), q = PMAP[p.key];
  return M && q && M[q.chapId] || null;
}
/* La place qui reste à un chapitre sur un niveau : sa surface intérieure, hors
   couloirs, moins ce qu'il y porte déjà. */
function libreChap(p, f){
  var m = chapDe(p);
  if(!m) return Infinity;
  var c = PMAP[p.key].chapId, pris = 0;
  onFloor(f).forEach(function(b){ if(PMAP[b.key].chapId === c) pris += areaOf(b); });
  return (m[f] || 0) * (1 - CIRC) - pris;
}
function libre(i){ return usable(i) - flNet(i); }

/* ---------- ce que la note regarde ------------------------------------------ */

/* Les adjacences, indexées par poste une fois pour toutes : la table `PROX` est
   parcourue des centaines de fois par tirage, et elle ne bouge pas. */
var VOIS = {};
PROX.forEach(function(l){
  (VOIS[l.a] = VOIS[l.a] || []).push({ o:l.b, id:l.id });
  (VOIS[l.b] = VOIS[l.b] || []).push({ o:l.a, id:l.id });
});

/* Ce poste est-il attaché à un autre par une adjacence ACTIVE ? */
function attache(key){
  var l = VOIS[key] || [], i;
  for(i = 0; i < l.length; i++) if(adjActive(l[i].id)) return true;
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

/* La force d'une ligne du CADRE dans la note : ce qui fait d'une adjacence
   active une règle et non une préférence — elle écrase toute autre raison,
   débordement compris. Ce n'est pas un réglage : c'est le sens du tag Imposé
   dans la langue de la note. Assouplie en orientation, l'adjacence ne pèse
   plus que ses points. */
var IMPOSE = 400;

/* La NOTE d'un niveau pour un poste. Positive = ce niveau lui va. Chaque terme
   est une ligne d'orientation — sa valeur fois la force de son tag — ou le
   poids d'un cadre. C'est dans les lignes qu'on corrige une répartition qui
   déplaît, et nulle part ailleurs. */
function noteNiveau(p, f, pose){
  var s = 0, lv = FLOORS[f] ? FLOORS[f].lvl : 0;
  var besoin = aOf(p.key, qOf(p.key));

  /* 1 — la place. Elle ne décide plus à elle seule, mais elle décide encore :
     poser six cents mètres carrés là où il en reste cinquante n'est pas une
     variante, c'est une erreur qu'il faudra défaire. */
  var l = Math.min(libre(f), libreChap(p, f));
  if(l <= 0) s -= force("place") * V.placePoids;
  else s += force("place") * V.placePoids * Math.min(1, l / Math.max(1, besoin));

  /* 2 — les adjacences ACTIVES déjà posées : le niveau où est son partenaire,
     d'un poids qui écrase le reste — c'est une règle, pas une préférence. Plus
     c'est loin, plus ça coûte. Une adjacence éteinte ne pèse rien : les deux
     postes sont indépendants. */
  var ADJ = enVigueur("adj") ? IMPOSE : force("adj") * V["pts:adj"];
  (VOIS[p.key] || []).forEach(function(v){
    if(!ADJ || !adjActive(v.id)) return;
    var ls = pose[v.o];
    if(!ls || !ls.length) return;
    var d = Infinity;
    ls.forEach(function(g){ d = Math.min(d, Math.abs(g - f)); });
    s += d === 0 ? ADJ : -ADJ * d;
  });

  /* 3 — la grappe : là où elle pèse déjà, elle appelle le reste. C'est la même
     notion que la vue déplace d'un bloc — les postes que des adjacences
     actives tiennent ensemble. */
  var gr = grappeDe(p.key);
  if(gr.length > 1){
    var set = {}, tot = 0, ici;
    gr.forEach(function(k){ if(k !== p.key) set[k] = 1; });
    FLOORS.forEach(function(F, i){ tot += aireDes(set, i); });
    ici = aireDes(set, f);
    if(tot > 0) s += force("grappe") * V.grappePts * (ici / tot);
  }

  /* 4 — la famille d'usage : à défaut d'exigence écrite, ce qui se ressemble
     s'assemble. Poids faible, c'est un départage. */
  var ft = 0, fi = aireFam(p.f, f);
  FLOORS.forEach(function(F, i){ ft += aireFam(p.f, i); });
  if(ft > 0) s += force("fam") * V.famPoids * (fi / ft);

  /* 5 — l'usage scolaire. Le rez reçoit le public, les parents, les livraisons
     et les usages hors horaire ; les classes montent ; le technique descend. */
  if(CLSRE.test(p.n) && lv > 0) s += force("cla-haut") * V.classeEtage * Math.min(lv, RULES.niv.classeMax);
  /* …sauf s'il est attaché à un local précis par le schéma fonctionnel : le
     dépôt de la salle ACM descendait au sous-sol pour dix points de commodité
     technique, en laissant deux niveaux plus haut la salle qu'il dessert. */
  if(p.f === "tec" && lv < 0 && !attache(p.key)) s += force("tec-bas") * V.techSousSol;

  /* 6 — bruyant contre calme, dans les deux sens. */
  var bc = force("bruit-calme") * V.bruitCalme;
  if(BRUYANT.test(p.n) && porteDes(CLSRE, f) > 0) s -= bc;
  if(CLSRE.test(p.n) && porteDes(BRUYANT, f) > 0) s -= bc;

  /* 7 — une règle de niveau qu'on a assouplie en orientation : ses points,
     au niveau qu'elle voudrait. En vigueur, elle a déjà fermé les autres. */
  s += prefereNiveau(p, lv, function(k){
    return (pose[k] || []).map(function(i){ return lvlOf(i); });
  });

  return s;
}

/* Le bruit de Gumbel : ajouté à des notes puis pris au maximum, il ÉCHANTILLONNE
   exactement la loi softmax de ces notes à la température donnée. C'est le seul
   endroit d'où vient la variation d'une répartition à l'autre — et à
   température nulle il disparaît, donc « Shuffle » rend la mieux orientée. */
function bruit(alea){
  if(!alea || V.temperature <= 0) return 0;
  var u = rng();
  if(u <= 0) u = 1e-9;
  if(u >= 1) u = 1 - 1e-9;
  return -Math.log(-Math.log(u)) * V.temperature * V.bruitEchelle;
}

/* ---------- poser un poste ---------------------------------------------------
   Les niveaux candidats sont notés, triés, et remplis dans cet ordre : au mieux
   d'abord, le débord ensuite. Un poste aux cotes imposées ne se coupe pas — il
   va entier au meilleur niveau, quitte à le faire déborder, et le contrôle le
   dira ; un poste LIÉ non plus, par choix. Le mixer ne refuse rien. */
function poser(p, cand, alea, pose){
  var key = p.key, q = qOf(key), u = uOf(key);
  if(q <= 0 || !cand.length) return;
  var notes = cand.map(function(f){
    return { f:f, s: noteNiveau(p, f, pose) + bruit(alea) };
  }).sort(function(a, b){ return b.s - a.s; });

  /* Les niveaux où une adjacence ACTIVE a déjà posé son partenaire : là, la
     place ne décide pas. Une adjacence active est une règle — le poste y va,
     quitte à déborder, et le contrôle dira le débordement. Sans cela, un niveau
     plein renvoyait la salle ACM un étage au-dessus du dépôt qui la sert. */
  var durs = {};
  if(enVigueur("adj")) (VOIS[key] || []).forEach(function(v){
    if(adjActive(v.id)) (pose[v.o] || []).forEach(function(g){ durs[g] = 1; });
  });
  var want = {}, rest = q, i;
  if(p.solid || estLie(key)){
    want[notes[0].f] = q; rest = 0;
  } else {
    for(i = 0; i < notes.length && rest > 0; i++){
      var f = notes[i].f;
      var tient = durs[f] ? rest : (u > 0 ? Math.floor(Math.max(0, Math.min(libre(f), libreChap(p, f))) / u) : rest);
      var n = Math.min(rest, Math.max(0, tient));
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
   Chaque classe standard a son vestiaire et son WC AU MÊME NIVEAU qu'elle
   (`schema.js`, liens classes–vestiaires et classes–WC) : un niveau porte
   autant de vestiaires et de WC — garçons et filles en alternance — que de
   classes. Ce qui reste (des classes au bac) suit leur prorata. Un étage sans
   sanitaires ne se dessine pas. Aucun article ne l'écrit : c'est notre choix,
   la ligne `wc` du cadre choisi — éteinte, les sanitaires se répartissent
   comme le reste. */
/* REMPLIR LE VOLUME. Un massing de Rhino donne à chaque chapitre une place par
   niveau ; la note du mixer préfère pourtant les classes en haut, et vestiaires
   et WC les suivent : un niveau déborde quand son voisin reste à moitié vide.
   Chaque niveau d'un chapitre se remplit donc dans la MÊME proportion que les
   autres — sa part du chapitre est celle que le dessin lui donne. Tant qu'une
   unité qui passe d'un niveau à l'autre rapproche les deux de leur part, elle
   passe — la plus grande d'abord —, puis les sanitaires se refont sur les
   classes. Les sanitaires eux-mêmes ne bougent pas ici : `equilibrerWC` les suit. */
function remplirChapitres(){
  if(!CH) return;
  var suit = enVigueur("wc") ? [WCG, WCF, VESTC] : [];
  for(var tour = 0; tour < 300; tour++){
    var best = null;
    Object.keys(CH).forEach(function(c){
      var m = CH[c], N = Object.keys(m).map(Number), pris = {}, tot = 0, place = 0;
      N.forEach(function(f){
        pris[f] = 0;
        onFloor(f).forEach(function(b){ if(PMAP[b.key].chapId === c) pris[f] += areaOf(b); });
        tot += pris[f]; place += m[f];
      });
      if(N.length < 2 || !place) return;
      function ecart(f){ return pris[f] - tot * m[f] / place; }
      N.forEach(function(fo){
        if(ecart(fo) <= 0) return;
        N.forEach(function(fu){
          if(fu === fo || ecart(fu) >= 0) return;
          onFloor(fo).forEach(function(b){
            var p = PMAP[b.key], u = uOf(b.key);
            if(p.chapId !== c || p.solid || estLie(b.key) || !(u > 0)) return;
            if(suit.some(function(re){ return re.test(p.n); }) || rangeOf(p).indexOf(fu) < 0) return;
            var o1 = ecart(fo), o2 = ecart(fu), gain = Math.abs(o1) + Math.abs(o2) - Math.abs(o1 - u) - Math.abs(o2 + u);
            if(!best || gain > best.gain + 1e-6 || (Math.abs(gain - best.gain) <= 1e-6 && u > best.u))
              best = { key:b.key, fo:fo, fu:fu, u:u, gain:gain };
          });
        });
      });
    });
    if(!best || best.gain < 1) return;
    var want = {};
    BLOCKS.forEach(function(b){ if(b.key === best.key && b.fl !== TRAY) want[b.fl] = (want[b.fl] || 0) + b.q; });
    want[best.fo]--; want[best.fu] = (want[best.fu] || 0) + 1;
    place(best.key, want);
    equilibrerWC();
  }
}

function equilibrerWC(){
  if(!enVigueur("wc")) return;
  var cls = [], use = [], gars = [], i, tc = 0, impair = 0;
  for(i = 0; i < FLOORS.length; i++){ cls[i] = 0; use[i] = 0; }
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    var p = PMAP[b.key];
    if(p.f !== "tec") use[b.fl] += b.q;         /* un niveau technique n'appelle pas de WC */
    if(CLASSE.test(p.n)) cls[b.fl] += b.q;
  });
  for(i = 0; i < FLOORS.length; i++){
    tc += cls[i];
    /* un nombre impair de classes : le WC de trop est garçon, puis fille */
    gars[i] = Math.floor(cls[i] / 2) + (cls[i] % 2 && !(impair++ % 2) ? 1 : 0);
  }

  function repartir(re, cible){
    posables().forEach(function(p){
      /* Un poste lié reste d'un seul tenant, là où le tirage l'a posé. */
      if(!re.test(p.n) || estLie(p.key)) return;
      var cand = rangeOf(p), q = qOf(p.key), want = {}, rest = q, frac = [];
      if(q <= 0 || !cand.length) return;
      cand.forEach(function(f){
        var n = Math.min(cible(f), rest);
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
  repartir(WCG, function(f){ return gars[f]; });
  repartir(WCF, function(f){ return cls[f] - gars[f]; });
  repartir(VESTC, function(f){ return cls[f]; });

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
      if(!WCRE.test(PMAP[b.key].n) || b.q < 1 || has[b.fl] <= 1 || estLie(b.key)) return;
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
/* L'emprise qu'un plateau peut prendre : la part que le cadre admet de l'aire
   posable — toute l'aire, quand la ligne est éteinte. */
function empriseMax(){
  return airePosable(reculVise()) * (enVigueur("plateau") ? V.plateauPart : 1);
}
export function pilesAdmissibles(){
  var besoinNet = 0, enterrable = 0, rezOblige = 0, haut = 0;
  posables().forEach(function(p){
    if(p.hors) return;
    var a = aOf(p.key, qOf(p.key)), lr = lvRange(p);
    besoinNet += a;
    /* une grande hauteur libre au rez : rien au-dessus (cadre `gabarit`) */
    if(p.hlibre > RULES.haut.libre.def) haut += a;
    if(lr.min < 0 && p.f === "tec") enterrable += a;
    if(lr.max === 0) rezOblige += a;
  });
  var k = 1 / ((1 - CIRC) * (1 - V.partMurs));      /* le plateau est brut : murs compris */
  var bati = besoinNet * k, rezMin = rezOblige * k;
  var emprise = empriseMax();
  var seuil = enVigueur("soussol") ? V.sousSolMin : 0;
  var sous = enterrable > 0 && enterrable >= seuil ? 1 : 0;
  var etMax = RULES.niv.etagesMax;
  var horsSol = Math.max(0, bati - (sous ? enterrable * k : 0));

  /* Les plateaux ne sont PAS uniformes, et c'est le point. Le rez porte tout ce
     que le règlement y cloue — la salle de sport, les halls, l'administration,
     l'UAPE, le chauffage —, soit beaucoup plus qu'un étage courant. Un plateau
     unique pour toute la pile donnait au dernier étage la taille du rez, donc
     des niveaux vides qu'aucun programme ne demandait. */
  function arrondi(a){ return Math.max(PLATE_MIN, Math.ceil(a / 10) * 10); }
  var pSous = sous ? Math.min(emprise, arrondi(enterrable * k * V.margePlateau)) : 0;

  var out = [], up;
  for(up = 0; up <= etMax; up++){
    /* Le rez porte au moins sa part, et assez pour que les étages tiennent à
       côté de la grande hauteur libre : R − haut ≥ (horsSol − R) / up. */
    var pRez = Math.max(rezMin, (horsSol + up * haut) / (1 + up)) * V.margePlateau;
    if(pRez > emprise) continue;                      /* le rez ne tient pas sur la parcelle */
    pRez = arrondi(pRez);
    /* Ce que le rez laisse aux étages se mesure sur sa CAPACITÉ, marge déduite,
       et non sur son plateau : le plateau du rez est gonflé du jeu qu'on lui
       laisse, et compter ce jeu comme du programme déjà logé rognait les étages
       de cent mètres carrés chacun — qui débordaient ensuite. */
    var reste = horsSol - pRez / V.margePlateau;
    if(up > 0 && reste <= 1) continue;                /* un étage vide n'est pas une pile */
    var pUp = up > 0 ? arrondi(reste / up * V.margePlateau) : 0;
    if(pUp > emprise) continue;
    if(up > 0 && pUp > pRez - haut) continue;          /* un étage surmonterait la salle de sport */
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
    var nu = etMax, pl = [], m = arrondi(emprise);
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
    /* Le LEVIER tire parmi les piles admissibles ; l'ORIENTATION « pile
       compacte » retire ses points par étage de plus, et le hasard du mixer
       s'y ajoute. La plus basse reste la plus probable, sans que les autres
       soient hors d'atteinte. */
    var best = -Infinity, pts = force("pile") * V.pileCompacte;
    P.forEach(function(x, i){
      var n = -pts * i + bruit(alea);
      if(n > best){ best = n; choix = x; }
    });
  }
  setStack(choix.sous, choix.up, choix.plates);
  return FLOORS.length;
}
/* La pile est figée, mais des plateaux sont au hasard : ils reprennent ceux de
   la pile admissible de même forme, quand il y en a une. Sinon ils gardent leur
   valeur le temps de la pose, et `ajusterPlateaux()` les ramène ensuite à ce
   que chaque niveau porte. */
function plateauxDeLaPile(){
  var sous = Math.max(0, -lvlOf(0)), up = Math.max(0, lvlOf(FLOORS.length - 1)), m = null;
  pilesAdmissibles().forEach(function(P){ if(!m && P.sous === sous && P.up === up) m = P; });
  if(!m) return;
  FLOORS.forEach(function(F, i){ if(m.plates[i] > 0) F.plate = m.plates[i]; });
}

/* ---------- la répartition ------------------------------------------------ */
export function repartir(opts){
  var alea = !!(opts && opts.alea);
  CH = (opts && opts.chapitres) || chapitres();
  /* `garder` : la pile ET ses plateaux sont ceux qu'on a posés (un massing de Rhino) */
  if(opts && opts.etages) proposerPile(alea);
  else if(!(opts && opts.garder)) plateauxDeLaPile();

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
  /* Une ancre qui n'est pas encore posée fait ATTENDRE ce qui la suit : le
     dépôt ACM suit la salle ACM, qui n'est posée qu'avec le reste. Posé
     avant elle, il choisissait son niveau seul, et elle ne l'y rejoignait pas
     toujours. */
  var enAttente = [];
  function suivre(r){
    var anc = ancreDe(r.p);
    var chez = (pose[anc] || []).filter(function(f){ return r.cand.indexOf(f) >= 0; });
    poser(r.p, chez.length ? chez : r.cand, alea, pose);
  }
  ancres.sort(function(a, b){ return b.a - a.a; }).forEach(function(r){
    var anc = ancreDe(r.p);
    if(!pose[anc] && libres.some(function(x){ return x.p.key === anc; })){ enAttente.push(r); return; }
    suivre(r);
  });

  /* 3 — le reste, du plus gros au plus petit : un grand poste décide, un petit
         s'adapte. L'ordre ne porte plus la variation — c'est la note qui la
         porte —, donc il peut rester le bon ordre. Le mélange ne sert qu'à
         départager les postes de même surface, et c'est tout ce qu'il faisait
         déjà sans qu'on le sache. */
  shuffled(libres).sort(function(a, b){ return b.a - a.a; })
                  .forEach(function(r){ poser(r.p, r.cand, alea, pose); });
  enAttente.forEach(suivre);

  equilibrerWC();
  remplirChapitres();

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
  }
  ajusterPlateaux();
  CH = null;
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
  var emprise = empriseMax();
  FLOORS.forEach(function(F, i){
    var besoin = flBrut(i);
    if(besoin <= 0) return;
    var p = Math.min(Math.max(PLATE_MIN, Math.ceil(besoin / 10) * 10),
                     Math.min(PLATE_MAX, Math.ceil(emprise / 10) * 10));
    setPlate(i, p);
  });
}
