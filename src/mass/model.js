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
   c'est ce qui donne les retraits, les terrasses et les porte-à-faux sans
   ajouter le moindre réglage.

   Les DEUX TIRAGES ne se confondent jamais. « Shuffle programme » appartient au
   mixer et rebat la répartition ; « Shuffle massing » ne touche pas au
   programme — même postes, mêmes surfaces, mêmes niveaux, même répartition —
   et ne cherche qu'une autre solution architecturale. Ils ont donc deux graines
   distinctes : celle du mixer vit dans `core/rand.js`, celle du massing ici.
   ========================================================================= */
import { CIRC, FMAP, ITEMS } from "../core/model.js";
import { squarify } from "../core/treemap.js";
import { RULES } from "../data/rules.js";
import { FLOORS, areaOf, flBuilt, flHeight, flName, flNet, horsAt, lvlOf, onFloor }
  from "../mix/floors.js";
import { PMAP } from "../mix/prog.js";
import { aire, assise, coins, local } from "./geom.js";

/* ---------- les partis ------------------------------------------------------
   Chacun est une FAÇON DE COMPOSER, pas un style : il dit combien de corps, où
   ils se tiennent les uns par rapport aux autres, et comment la pile se
   dégrade en montant. Le texte est ce qu'on lit dans le panneau. */
export var PARTIS = [
  { id:"auto",      n:"Auto",              d:"Le générateur essaie tous les partis et garde celui qui tient le mieux sur ce site, avec ce programme." },
  { id:"compact",   n:"Bloc compact",      d:"Un seul corps, aussi carré que le plateau le permet. Le plus court en façade, le plus avare en terrain — et le plus sourd au site." },
  { id:"barre",     n:"Barre",             d:"Un seul corps allongé, d'une profondeur qui laisse les classes en façade. Il fait une limite et libère tout le reste." },
  { id:"barres",    n:"Barres parallèles", d:"Plusieurs corps allongés, parallèles entre eux, séparés de la distance incendie. Entre eux, des cours en bandes." },
  { id:"L",         n:"Forme en L",        d:"Deux ailes perpendiculaires. L'angle tient un dehors, sans le fermer." },
  { id:"U",         n:"Forme en U",        d:"Trois ailes autour d'une cour ouverte d'un côté — la cour d'école dans sa forme la plus ancienne." },
  { id:"cour",      n:"Cour",              d:"Quatre ailes, une cour fermée. Elle demande beaucoup d'emprise : sur un site étroit, le générateur le dira." },
  { id:"pavillons", n:"Pavillons",         d:"Le programme éclaté en plusieurs petits corps, bas, posés séparément." },
  { id:"hameau",    n:"Hameau",            d:"Des corps de tailles et d'orientations différentes, qui gardent une relation entre eux — ni alignés, ni étrangers." },
  { id:"terrasses", n:"Terrasses",         d:"Chaque niveau se retire sur le précédent : le volume descend en gradins vers le sud." },
  { id:"peigne",    n:"Peigne",            d:"Un corps principal, et des ailes perpendiculaires qui s'y accrochent." },
  { id:"libre",     n:"Composition libre", d:"Aucune règle de figure : les corps se posent où le site les prend, orientés vers ce qui les attire." }
];
export function partiOf(id){
  var p = null;
  PARTIS.forEach(function(x){ if(x.id === id) p = x; });
  return p || PARTIS[0];
}

/* ---------- l'état ----------------------------------------------------------
   `vol` est la solution posée ; `par` les réglages du générateur ; `graine` la
   graine du SEUL tirage massing. Tout est persisté avec le reste du mixer :
   revenir d'un onglet à l'autre ne doit rien perdre. */
export var MASS = {
  parti: "auto",
  graine: 1,
  par: {
    nb: 0,          /* nombre de volumes · 0 = au parti d'en décider */
    dmin: RULES.dist.entre,
    cap: null       /* orientation générale · null = l'axe du périmètre */
  },
  vol: [],
  mono: false,      /* affichage : couleurs du programme, ou masse seule */
  etage: -1,        /* niveau montré · -1 = tous */
  sel: null         /* volume sélectionné */
};
export function massSet(k, v){ MASS[k] = v; }
export function massPar(k, v){ MASS.par[k] = v; }
export function massVols(list){ MASS.vol = list || []; MASS.sel = null; }

/* ---------- la profondeur, DONNÉE et non réglée ------------------------------
   C'était un champ à saisir, 18 m par défaut : un chiffre de projet sans
   source, qu'on pouvait mettre à 9 ou à 46 sans que rien ne le contredise. Or
   la profondeur d'un corps n'est pas un goût, elle est donnée — par le plan
   d'affectation communal, ou par le programme.

     — le PACom de Saxon range le site en zone de constructions et
       d'installations publiques A : AUCUNE contrainte de gabarit, de hauteur
       ni de distance aux limites (art. 2.3). Il n'impose donc pas de
       profondeur, et il faut le dire plutôt que d'inventer un chiffre ;
     — le programme, lui, en impose deux. La COURANTE est celle d'un corps de
       classes : deux rangées de salles, prises à leur surface BÂTIE — le
       couloir est dans la part de circulation, il ne s'ajoute pas par-dessus.
       Le MAXIMUM est celui du local le plus profond qu'on ait à loger, la
       salle de sport double, 28 m dans sa petite cote. Au-delà, on bâtit de la
       profondeur que personne n'a demandée, et sans jour. */
export function profUsuel(){
  var u = 0;
  ITEMS.forEach(function(it){
    if(it.f !== "cla") return;
    if(!u || it.nb > u.nb) u = it;
  });
  if(!u) return 18;
  return Math.round(2 * Math.sqrt(u.u / (1 - CIRC)) * 10) / 10;
}
export function profMax(){
  var p = 0;
  ITEMS.forEach(function(it){
    if(!it.w || !it.h) return;
    p = Math.max(p, Math.min(it.w, it.h));
  });
  return p || profUsuel();
}

/* ---------- le porte-à-faux --------------------------------------------------
   Ce qu'un étage dépasse de celui du dessous, mesuré dans le repère du volume.
   Positif = porte-à-faux, négatif = retrait. Le générateur s'en sert pour
   PRÉFÉRER les compositions d'aplomb, la 3D pour marquer l'étage qui déborde,
   le contrôle pour le chiffrer : une seule mesure, et les trois disent donc la
   même chose. Elle vivait dans `checks.js`, où le générateur ne pouvait pas
   l'atteindre sans se mordre la queue. */
export function debord(bas, haut){
  var dx = (haut.dx || 0) - (bas.dx || 0), dy = (haut.dy || 0) - (bas.dy || 0);
  return Math.max(Math.abs(dx) + (haut.w - bas.w) / 2,
                  Math.abs(dy) + (haut.d - bas.d) / 2);
}
export function porteAFaux(v){
  var max = 0, i;
  /* Hors sol SEULEMENT. Un rez plus large que son sous-sol n'est pas un
     porte-à-faux : le terrain le porte. Compter la marche entre le sous-sol et
     le rez annonçait trente mètres de dépassement sur des volumes qui n'en
     avaient aucun. */
  var lv = v.lv.filter(function(x){ return lvlOf(x.i) >= 0; })
               .sort(function(a, b){ return a.i - b.i; });
  for(i = 1; i < lv.length; i++) max = Math.max(max, debord(lv[i - 1], lv[i]));
  return max;
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
      A: flBuilt(i),          /* surface BÂTIE : locaux + circulation */
      h: flHeight(i),
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
  return FLOORS.map(function(F){ return F.lvl; }).join(",");
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

/* Les postes présents à un niveau, en parts de surface BÂTIE — la circulation
   comprise, au prorata. C'est ce qui permet de colorer un volume par son
   programme : un corps qui porte un tiers du niveau porte un tiers de chaque
   poste, et la couleur dit vrai. */
export function postesDe(i){
  var bl = onFloor(i).filter(function(b){ return !PMAP[b.key].hors; });
  var net = flNet(i);
  if(!net) return [];
  var k = flBuilt(i) / net;
  return bl.map(function(b){
    var p = PMAP[b.key];
    return { key:b.key, n:p.n, f:p.f, q:b.q, a:areaOf(b) * k };
  }).sort(function(a, b){ return b.a - a.a; });
}

/* ---------- les volumes ----------------------------------------------------
   Un volume porte une liste d'étages, chacun désignant un niveau du mixer par
   son indice. Les cotes sont celles de CE niveau : un étage plus petit que
   celui d'en dessous est un retrait, un étage décalé est un porte-à-faux. */
export function volRect(v, e){
  return local({ x:v.x, y:v.y, w:e.w, d:e.d, a:v.a }, e.dx || 0, e.dy || 0);
}
export function volEtage(v, i){
  var e = null;
  v.lv.forEach(function(x){ if(x.i === i) e = x; });
  return e;
}
export function volAire(v){
  var a = 0;
  v.lv.forEach(function(e){ a += e.w * e.d; });
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
export function volCoins(v){
  var r = volSol(v);
  return r ? coins(r) : [];
}
/* L'altitude du rez du volume : la moyenne du terrain sous son emprise. Un
   bâtiment posé sur l'altitude de son centre s'enterre d'un côté. */
export function volAssise(v){
  var r = volSol(v);
  return r ? assise(r) : { z:RULES.site.altMoy, lo:0, hi:0, d:0 };
}
/* La hauteur hors sol d'un volume : la somme des hauteurs de niveau qu'il
   porte au-dessus du terrain, plus l'acrotère. Elle n'est pas un réglage —
   elle est une conséquence du programme, comme au mixer. */
export function volHaut(v){
  var N = niveaux(), h = 0;
  v.lv.forEach(function(e){
    var n = N[e.i];
    if(n && n.lvl >= 0) h += n.h;
  });
  return h > 0 ? h + RULES.haut.acrotere : 0;
}
export function volNiv(v){
  var n = 0;
  v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) n++; });
  return n;
}
/* Le pied d'un étage, en mètres au-dessus de l'assise du volume : les niveaux
   du dessous s'empilent, les sous-sols descendent. */
export function etageZ(v, e){
  var N = niveaux(), z = 0, k;
  for(k = 0; k < v.lv.length; k++){
    var x = v.lv[k], n = N[x.i];
    if(!n) continue;
    if(n.lvl >= 0 && x.i < e.i) z += n.h;
    if(n.lvl < 0 && x.i > e.i) z -= 0;
  }
  if(N[e.i] && N[e.i].lvl < 0){
    /* Un sous-sol se compte vers le bas, depuis le rez. */
    z = 0;
    for(k = 0; k < N.length; k++){
      if(N[k].lvl < 0 && N[k].lvl >= N[e.i].lvl) z -= N[k].h;
    }
  }
  return z;
}

/* ---------- le bilan : ce que le massing doit au programme -------------------
   La question que l'outil doit savoir répondre à tout moment : la surface
   posée est-elle celle que le programme demande ? On la pose niveau par
   niveau, parce que c'est là qu'elle se règle. */
export function bilan(){
  var N = niveaux(), out = [], i;
  for(i = 0; i < N.length; i++){
    var dem = N[i].A, po = 0;
    MASS.vol.forEach(function(v){
      var e = volEtage(v, i);
      if(e) po += e.w * e.d;
    });
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
export function famCol(f){ return FMAP[f] ? "var(" + FMAP[f].c + ")" : "var(--ink-3)"; }
export function famTok(f){ return FMAP[f] ? FMAP[f].c : "--ink-3"; }

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
  if(e && e.key) return { seul:[e.key] };
  var sans = [];
  MASS.vol.forEach(function(x){
    x.lv.forEach(function(q){ if(q.key) sans.push(q.key); });
  });
  return { sans:sans };
}

export function cellules(i, w, d, o){
  var P = postesDe(i), tot = 0;
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
