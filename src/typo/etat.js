/* ============================================================================
   CE QUE LES TYPOLOGIES ENREGISTRENT

   Leur seed, et les largeurs de pièces réglées ici. Rien d'autre : les volumes
   sont ceux du Massing, que les plans LISENT sans jamais les réécrire — chaque
   onglet tire son Shuffle chez lui. Un module à part pour la même raison que
   `mass/etat.js` : `mix/store.js` le lit sans tirer derrière lui le générateur.
   ========================================================================= */
/* La seed par défaut : celle d'une variante d'avant les Typologies, et celle à
   laquelle le générateur du massing juge ses candidates (`mass/gen.js`). */
export var GRAINE0 = 1;
export var TYPO = { graine:GRAINE0, cotes:{} };

export function typoOf(){ return { graine:TYPO.graine, cotes:Object.assign({}, TYPO.cotes) }; }
/* Un instantané d'avant les Typologies (`o` absent) remet la seed d'origine :
   une variante ancienne ne garde pas la typologie de la dernière vue. */
export function setTypo(o){
  TYPO.graine = (o && o.graine) || GRAINE0;
  TYPO.cotes = Object.assign({}, o && o.cotes);
}
