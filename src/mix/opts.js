/* ============================================================================
   LES DEUX INTERRUPTEURS DU MIXER

   Ils ne décrivent pas un dessin mais une manière de travailler, et ils
   survivent au rechargement : les retrouver éteints à chaque ouverture
   reviendrait à ne jamais pouvoir s'en servir.

   Ils vivent ici, et non dans la vue, pour que `store.js` les lise sans avoir
   à remonter dans `views/` — une couche ne dépend pas de celle qui la montre.
   ========================================================================= */

/* Le tirage propose aussi la pile : nombre de sous-sols et d'étages, déduits de
   l'aire posable de la parcelle, de la part qu'un plateau peut en prendre, et
   de ce que le règlement cloue au rez.

   ENCLENCHÉ PAR DÉFAUT, désormais. Il ne l'était pas, et pour une bonne raison :
   la pile se tirait alors à pile ou face — un sous-sol une fois sur deux, un
   étage de plus ou de moins trois fois sur dix — et il valait mieux ne pas s'en
   servir. Depuis que `proposerPile()` CONSTRUIT la liste des piles que le site
   admet et en choisit une, l'éteindre revient à proposer une école de plain-pied
   de trois mille quatre cents mètres carrés d'emprise : ce n'est pas un choix
   de projet, c'est l'absence de choix. */
export var tirerNiveaux = true;
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
