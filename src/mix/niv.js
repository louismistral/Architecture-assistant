/* ============================================================================
   RÈGLES DE NIVEAU — LA MÉCANIQUE

   La table est au CADRE (`data/cadre.js — NIV`) : ce que le règlement dit du
   niveau d'un local, chaque règle avec son tag. Ici, ce qu'on en fait :

     — une règle EN VIGUEUR (Intangible, Imposé) ferme des niveaux : `lvRange()`
       ne rend que ceux qu'elle admet, `ancreDe()` attache un poste à un autre ;
     — une règle ASSOUPLIE (Prioritaire, Souhaité) ne ferme rien : elle ajoute
       ses points au niveau qu'elle voudrait (`prefereNiveau()`, lu par la note
       du tirage) ;
     — éteinte, elle ne dit plus rien.

   Aucune n'empêche la main : le mixer laisse poser ce qu'on veut où on veut, et
   le contrôle le dit (`checks.js`).
   ========================================================================= */
import { CHAP } from "../data/program.js";
import { NIV, enVigueur } from "../data/cadre.js";
import { V } from "../data/lignes.js";
import { force } from "../data/orientation.js";
import { PMAP } from "./prog.js";
export { NIV };

export function nivHit(rl, p){
  if(rl.key) return rl.key === p.key;
  if(rl.fam) return p.f === rl.fam;
  if(rl.chap) return p.chapId === rl.chap;
  return rl.re.test(p.n);
}
/* La cote `lv` est-elle admise par la règle ? Une règle « au même niveau
   que » se juge sur les niveaux de son ancre : `chez`. */
export function nivAdmet(rl, lv, chez){
  if(rl.lvl) return lv >= rl.lvl.min && lv <= rl.lvl.max;
  if(rl.grade) return lv === 0;
  if(rl.etageMax !== undefined) return lv >= 0 && lv <= rl.etageMax;
  if(rl.same) return !chez || !chez.length || chez.indexOf(lv) >= 0;
  return true;
}

/* Cotes admissibles pour un poste. Par défaut rien ne descend en sous-sol :
   seuls les locaux techniques, de stockage et de nettoyage y sont admis, plus
   l'abri PC que le règlement y autorise explicitement (`jour-ss`, opposable). */
export function lvRange(p){
  var lmin = (p.f === "tec") ? -9 : 0, lmax = 99;
  NIV.forEach(function(rl){
    if(!nivHit(rl, p) || !enVigueur(rl.id)) return;
    if(rl.lvl){ lmin = Math.max(lmin, rl.lvl.min); lmax = Math.min(lmax, rl.lvl.max); }
    else if(rl.grade){ lmin = Math.max(lmin, 0); lmax = Math.min(lmax, 0); }
    else if(rl.etageMax !== undefined){ lmin = Math.max(lmin, 0); lmax = Math.min(lmax, rl.etageMax); }
  });
  return { min: lmin, max: lmax };
}

/* Le poste qu'une règle « au même niveau que », EN VIGUEUR, attache à celui-ci. */
export function ancreDe(p){
  var a = null;
  NIV.forEach(function(rl){
    if(rl.same && nivHit(rl, p) && rl.same !== p.key && PMAP[rl.same] && enVigueur(rl.id)) a = rl.same;
  });
  return a;
}

/* Les points qu'ajoutent au niveau `lv` les règles ASSOUPLIES en orientation.
   `chezDe(key)` rend les cotes où un poste est déjà posé — pour les règles
   « au même niveau que ». */
export function prefereNiveau(p, lv, chezDe){
  var s = 0;
  NIV.forEach(function(rl){
    var f = force(rl.id);
    if(!f || !nivHit(rl, p)) return;
    var chez = rl.same ? chezDe(rl.same) : null;
    if(rl.same && (!chez || !chez.length)) return;
    if(nivAdmet(rl, lv, chez)) s += f * V["pts:" + rl.id];
  });
  return s;
}

/* Sanitaires : règle de projet, aucun article ne l'écrit, mais un étage sans
   WC ne se dessine pas. */
export var WCRE  = /^(WC |Toilette)/;
export var WCG   = /^WC garçons/;
export var WCF   = /^WC filles/;
export var CLSRE = /^(Salles? de classe|Salle de dédoublement|Salle ACM|Salles d'appui)/;
/* L'UNITÉ PÉDAGOGIQUE ne compte que les vraies salles de classe — les standard
   et celles de réserve. `CLSRE` ratisse plus large : il sert à savoir où sont
   les élèves, pour les sanitaires et pour le bruit. Compter le dédoublement,
   l'ACM et l'appui dans l'unité portait le contingent à vingt-neuf salles, donc
   à quatre niveaux de classes là où le règlement n'en admet que trois. */
export var UNITE = /^Salles? de classe/;
/* LA CLASSE STANDARD : celle qui a son vestiaire et son WC au même niveau. */
export var CLASSE = /^Salles de classe standard/;
export var VESTC = /^Vestiaires de classe/;
/* Ce qui fait du bruit, et ce qui demande le calme. Aucun article ne l'écrit :
   c'est de l'usage scolaire. La note du tirage l'évite (orientation
   `bruit-calme`), le jugement le mesure (`mix/mesures.js`). */
export var BRUYANT = /Salle de sport double|Scène|^Cuisine|Réfectoire|foyer/;

/* Le nom du chapitre, pour les messages. */
export function chapName(ci){ return CHAP[ci] ? CHAP[ci].short : ""; }
