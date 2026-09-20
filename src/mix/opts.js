/* ============================================================================
   LES DEUX INTERRUPTEURS DU MIXER

   Ils ne décrivent pas un dessin mais une manière de travailler, et ils
   survivent au rechargement : les retrouver éteints à chaque ouverture
   reviendrait à ne jamais pouvoir s'en servir.

   Ils vivent ici, et non dans la vue, pour que `store.js` les lise sans avoir
   à remonter dans `views/` — une couche ne dépend pas de celle qui la montre.
   ========================================================================= */

/* Le tirage propose aussi la pile : nombre de sous-sols et d'étages, déduits
   de la surface bâtie à loger et du plateau du rez. */
export var tirerNiveaux = false;
/* Ce que le règlement veut côte à côte se déplace ensemble. Éteint, une grappe
   de proximité peut s'éparpiller sur trois étages — et le contrôle le dira. */
export var grouper = false;

/* Un bloc montre-t-il les pièces qu'il contient ? Un poste de 18 salles est
   UNE part posée d'un coup ; ouvert, il montre ses dix-huit salles, et chacune
   se prend séparément. C'est là que se fait la scission — sur le bloc, pas
   dans un menu. */
export var pieces = true;

export function setTirer(on){ tirerNiveaux = !!on; }
export function setGrouper(on){ grouper = !!on; }
export function setPieces(on){ pieces = !!on; }

export function optsOf(){
  return { niv: tirerNiveaux ? 1 : 0, grp: grouper ? 1 : 0, pcs: pieces ? 1 : 0 };
}
export function setOpts(o){
  if(!o) return;
  tirerNiveaux = !!o.niv;
  grouper = !!o.grp;
  if(o.pcs !== undefined) pieces = !!o.pcs;
}
