/* ============================================================================
   LE PROGRAMME, VU COMME DES PARTS À POSER

   Le cahier des charges tient les surfaces ; le mixer les répartit sur des
   niveaux. Il ne les réécrit jamais : ce module ne fait que relire
   `src/data/program.js` et `src/data/schema.js` sous la forme dont la
   répartition a besoin.

   Un POSTE est une ligne du programme (18 salles de classe standard).
   Une PART est un morceau de poste posé à un niveau (6 de ces 18 salles au
   1ᵉʳ étage). Un poste peut donc se scinder entre plusieurs niveaux — c'est
   tout l'objet de l'outil — sauf ceux dont le règlement impose les
   dimensions, qui ne se coupent pas.
   ========================================================================= */
import { ITEMBYKEY, ITEMS } from "../core/model.js";
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";
import { SLINK, SNODE } from "../data/schema.js";

/* Hors enveloppe scolaire : le second temps (piscine, chauffage à distance) et
   les extérieurs (cour, préau). Ils n'ont pas de couloirs à nous et ne pèsent
   pas sur le plateau — ils restent posés au terrain, comme le règlement le
   demande, mais hors du bilan d'emprise. */
export var HORS = {}; CHAP.forEach(function(c, i){ if(c.id === "infra" || c.id === "ext") HORS[i] = 1; });

/* Hauteur libre exigée, quand elle dépasse l'ordinaire. Elle sert à une seule
   chose ici : rien ne peut être bâti au-dessus d'un local qui traverse deux
   niveaux. Les valeurs viennent de `RULES.haut.libre`, jamais d'ici. */
var HL = {};
HL["sport|Salle de sport double"] = RULES.haut.libre.spo;
HL["infra|Local chauffage CAD"]   = RULES.haut.libre.cad;
HL["infra|Piscine"]               = RULES.haut.libre.pis;

export var POSTES = [], PMAP = {};
CHAP.forEach(function(ch, ci){
  ch.items.forEach(function(it){
    var p = {
      key: it.key, n: it.n, f: it.f, ci: ci, chapId: ch.id, chap: ch.short,
      note: it.note || "", est: it.est || 0,
      /* dimensions imposées au règlement (28 × 32 m) : la pièce est une, elle
         ne se coupe pas en deux niveaux */
      solid: (it.w && it.h) ? 1 : 0,
      hors: HORS[ci] ? 1 : 0,
      hlibre: HL[it.key] || 0,
      /* déjà compté ailleurs : les locaux engins de la salle de gym sont
         convertis en abri PC, dont les 750 m² les contiennent. Les poser une
         seconde fois compterait 180 m² deux fois. */
      dedans: it.planSkip ? 1 : 0
    };
    POSTES.push(p);
    PMAP[it.key] = p;
  });
});

/* Quantité et surface unitaire sont relues à chaque appel : une surface « à
   préciser » se change dans le cahier des charges et le mixer suit sans rien
   mémoriser. */
export function qOf(key){ var it = ITEMBYKEY[key]; return it ? it.nb : 0; }
export function uOf(key){ var it = ITEMBYKEY[key]; return it ? it.u : 0; }
export function aOf(key, q){ return q * uOf(key); }

/* Les postes que le mixer pose réellement. */
export function posables(){
  return POSTES.filter(function(p){ return !p.dedans; });
}
export function posesDedans(){
  return POSTES.filter(function(p){ return p.dedans; });
}

/* ---------- adjacences, ramenées aux postes -------------------------------
   `src/data/schema.js` reste la source unique : chaque nœud y dit lui-même
   quels postes il désigne (`nd.k`). La table vivait ici, en double du schéma :
   un nœud ajouté là-bas restait muet tant qu'on ne l'inscrivait pas ici. */
var SMAPK = {}; SNODE.forEach(function(nd){ SMAPK[nd.id] = nd; });

/* Filet de sécurité : si un poste est renommé dans `program.js`, le schéma le
   dit tout de suite au lieu de laisser une adjacence disparaître en silence.
   Un nœud sans poste est voulu — il est mentionné au règlement sans surface à
   lui, et il est hors bilan. */
export var LIENS_ORPHELINS = [];
SNODE.forEach(function(nd){
  (nd.k || []).forEach(function(k){ if(!PMAP[k]) LIENS_ORPHELINS.push(nd.id + " → " + k); });
});

function keysOf(node){
  var nd = SMAPK[node];
  return ((nd && nd.k) || []).filter(function(k){ return !!PMAP[k] && !PMAP[k].dedans; });
}
/* PROX : « ces deux postes se tiennent ». Un lien optionnel du schéma (une
   mutualisation possible) reste optionnel ici : on le signale, on ne
   l'impose pas. */
export var PROX = [];
SLINK.forEach(function(lk){
  var A = keysOf(lk.a), B = keysOf(lk.b);
  A.forEach(function(a){
    B.forEach(function(b){
      if(a !== b) PROX.push({ a:a, b:b, q:lk.q, opt:lk.opt ? 1 : 0 });
    });
  });
});

/* Surface utile totale du programme posable, et sa part bâtie. */
export function netTotal(){
  var t = 0;
  posables().forEach(function(p){ t += aOf(p.key, qOf(p.key)); });
  return t;
}
export function netBati(){
  var t = 0;
  posables().forEach(function(p){ if(!p.hors) t += aOf(p.key, qOf(p.key)); });
  return t;
}
export var ITEM_COUNT = ITEMS.length;
