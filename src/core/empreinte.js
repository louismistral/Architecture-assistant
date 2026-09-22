/* ============================================================================
   L'EMPREINTE DES FICHIERS DU DÉPÔT

   Une variante enregistre un état ; mais cet état s'appuie sur des nombres
   qu'on ne peut PAS changer depuis l'application — le programme, le règlement,
   les adjacences, le relevé, et les valeurs par défaut de la doctrine. Ceux-là
   changent en éditant le code et en poussant sur GitHub.

   Quand ils changent, une variante enregistrée avant ne dit plus la vérité :
   ses surfaces, sa note et son bilan portent sur un programme qui n'existe
   plus. Elle est PÉRIMÉE. On l'enregistre donc avec une empreinte de ces cinq
   sources, et l'on compare à la relecture.

   Ce n'est pas une empreinte de sécurité : c'est un détecteur de changement.
   FNV-1a suffit, et reste synchrone — une variante ne doit pas attendre le
   navigateur pour savoir si elle est à jour.
   ========================================================================= */
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";
import { SLINK, SNODE, SPOLE } from "../data/schema.js";
import { SITE } from "../data/site.js";
import { DOC, docDefaut } from "../data/doctrine.js";

function fnv(s){
  var h = 0x811c9dc5, i;
  for(i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

/* Les cinq sources, NOMMÉES : on ne veut pas seulement savoir QUE quelque
   chose a bougé, on veut pouvoir dire QUOI. */
/* Le programme, tel que le FICHIER le déclare.
   `CHAP` ne peut pas être haché tel quel : `recompute()` écrit sur ses objets
   mêmes — `total`, `circ`, `gross`, `key`, `tot` — et `applyAreas` remplace le
   `u` des huit postes « à préciser » par la valeur saisie. L'empreinte
   changeait donc entre deux chargements de la même page, et TOUTE variante se
   déclarait périmée dès qu'on avait précisé une surface ou touché à la
   circulation. On ne garde donc que ce que le fichier écrit.

   Et la surface des huit postes « à préciser » n'en fait PAS partie : c'est
   une décision de projet, saisie par nous, partagée au groupe et enregistrée
   avec chaque variante. Ce que `program.js` en dit n'est qu'un point de
   départ. (`u0` n'aurait pas aidé : `recompute()` le réécrit à chaque passage,
   donc il vaut « u au dernier calcul », pas « u du fichier ».) */
/* L'ordre ne fait pas partie de la déclaration : `recompute()` RETRIE les
   postes par surface décroissante, donc préciser une surface changeait leur
   place dans le tableau — et l'empreinte avec, sans qu'un seul nombre du
   fichier ait bougé. On range par nom avant de hacher. */
function trie(a){ return a.slice().sort(); }
function programmeDeclare(){
  return trie(CHAP.map(function(c){
    return JSON.stringify([c.id, c.name, c.short, c.sub, c.off,
      trie(c.items.map(function(i){
        return JSON.stringify([i.n, i.nb, i.est ? "à préciser" : i.u, i.f, i.note]);
      }))]);
  }));
}

var SOURCES = [
  { k:"p", nom:"les surfaces du programme",      de:programmeDeclare },
  { k:"r", nom:"le règlement du concours",       de:function(){ return RULES; } },
  { k:"s", nom:"les adjacences exigées",         de:function(){ return [SPOLE, SNODE, SLINK]; } },
  { k:"t", nom:"le relevé du terrain",           de:function(){ return SITE; } },
  { k:"d", nom:"les valeurs par défaut de la doctrine",
    de:function(){
      var o = {}, k;
      for(k in DOC) o[k] = docDefaut(k);
      return o;
    } }
];

/* `p1a2b.r3c4d.s5e6f.t7g8h.d9i0j` — une part par source, pour que la
   comparaison sache laquelle a bougé. */
export function empreinte(){
  return SOURCES.map(function(s){
    try{ return s.k + fnv(JSON.stringify(s.de())); }
    catch(_){ return s.k + "?"; }
  }).join(".");
}

/* Ce qui a changé entre une empreinte enregistrée et celle d'aujourd'hui.
   Une empreinte absente — une variante d'avant cette version — ne se déclare
   PAS périmée : on ne sait pas, et accuser à tort est pire que se taire. */
export function perime(emp){
  if(!emp) return [];
  var vieux = String(emp).split("."), neuf = empreinte().split("."), out = [];
  SOURCES.forEach(function(s, i){
    if(vieux[i] && neuf[i] && vieux[i] !== neuf[i]) out.push(s.nom);
  });
  return out;
}
