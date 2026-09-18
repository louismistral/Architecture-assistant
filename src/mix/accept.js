/* ============================================================================
   LES ÉCARTS QU'ON ASSUME

   Le mixer ne refuse rien, et tout écart qu'il signale n'est pas une erreur :
   un concours se gagne parfois en sortant d'une règle de projet, à condition de
   l'avoir vu. « Laisser comme ça » n'efface donc rien — l'écart change de rang
   et va dans une liste à part, avec la date où on l'a assumé, et il se reprend
   d'un clic.

   Un écart est retenu par son CODE, pas par son message : le message contient
   des surfaces et des noms de niveaux qui changent au premier réglage, et une
   décision assumée ne doit pas resurgir parce qu'un plateau a bougé de 10 m².
   ========================================================================= */
export var ACCEPTS = {};        /* code → { at } */

export function isAccepted(code){ return !!(code && ACCEPTS[code]); }
export function accept(code){
  if(!code || ACCEPTS[code]) return false;
  ACCEPTS[code] = { at: Date.now() };
  return true;
}
export function unaccept(code){
  if(!code || !ACCEPTS[code]) return false;
  delete ACCEPTS[code];
  return true;
}
export function acceptCount(){
  var n = 0;
  for(var k in ACCEPTS) n++;
  return n;
}
/* Persistance : `store.js` écrit ce que rend `acceptList()` et rend ce qu'il a
   lu à `setAccepts()`. Un code qui ne correspond plus à aucun écart est
   simplement sans effet — il ne coûte rien et se nettoie au prochain « Tout
   reprendre ». */
export function acceptList(){
  var out = [];
  for(var k in ACCEPTS) out.push(k);
  return out;
}
export function setAccepts(list){
  ACCEPTS = {};
  if(!list || !list.length) return;
  list.forEach(function(k){ if(typeof k === "string" && k.length < 200) ACCEPTS[k] = { at:0 }; });
}
export function clearAccepts(){ ACCEPTS = {}; }
