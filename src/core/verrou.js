/* ============================================================================
   LES CADENAS — ce qu'on ne veut plus toucher par erreur.

   Chaque onglet qui DÉCIDE quelque chose porte un cadenas : fermé, ses
   décisions sont figées ; on regarde encore (zoom, niveaux, couleurs,
   export), on ne change plus rien. Une fondation qu'on a arrêtée ne se défait
   pas d'un clic de trop.

   UN VERROU FIGE AUSSI L'AMONT. Chaque onglet se sert de ce que le précédent a
   décidé : le Massing se recompose quand la pile du mixer change, les
   Typologies dessinent dans les volumes du Massing. Verrouiller le Massing
   sans figer le mixer laissait donc soit le Massing se réécrire sous le
   cadenas, soit des volumes qui répondent à une pile disparue. L'amont d'un
   onglet verrouillé est donc figé « par » lui, et son cadenas le dit.

   Paramètres & contraintes est hors chronologie : ses lignes jugent et
   orientent, elles ne recomposent rien d'elles-mêmes. Il a son cadenas, et
   n'est figé par personne.

   Le cadenas du cahier des charges et celui des Paramètres sont des décisions
   du GROUPE, comme les surfaces, le couloir et les lignes qu'ils protègent
   (`net/reglages.js`) ; les autres sont de l'état du projet, et voyagent avec
   lui dans une variante (`mix/store.js — snapshot`).
   ========================================================================= */

/* l'amont, dans l'ordre de la chronologie */
export var CHAINE = ["programme", "mixer", "massing", "typologie"];
export var VERROUILLABLES = ["parametres"].concat(CHAINE);
export var PARTAGES = ["parametres", "programme"];

export var VERROU = {};
VERROUILLABLES.forEach(function(t){ VERROU[t] = false; });

var ecoute = [];
export function surVerrou(fn){ ecoute.push(fn); }
function dire(){ ecoute.forEach(function(f){ try{ f(); }catch(_){} }); }

/* l'onglet en aval qui fige celui-ci, ou null */
export function figePar(tab){
  var k = CHAINE.indexOf(tab);
  if(k < 0) return null;
  for(var j = CHAINE.length - 1; j > k; j--) if(VERROU[CHAINE[j]]) return CHAINE[j];
  return null;
}
/* rien ne doit y changer : son cadenas, ou celui d'un onglet en aval */
export function fige(tab){ return !!VERROU[tab] || !!figePar(tab); }

export function setVerrou(tab, on){
  if(!(tab in VERROU) || VERROU[tab] === !!on) return;
  VERROU[tab] = !!on;
  dire();
}
export function verrousOf(quels){
  var o = {};
  (quels || VERROUILLABLES).forEach(function(t){ if(VERROU[t]) o[t] = 1; });
  return o;
}
/* `o` absent : un état d'avant les cadenas, tout s'ouvre. `quels` : ne
   toucher qu'à ceux-là (les partagés, venus du groupe). */
export function setVerrous(o, quels){
  (quels || VERROUILLABLES).forEach(function(t){ VERROU[t] = !!(o && o[t]); });
  dire();
}
export function unVerrou(){ return VERROUILLABLES.some(function(t){ return VERROU[t]; }); }
