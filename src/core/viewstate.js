/* État de la vue, partagé par tous les onglets : source unique de vérité pour
   le mode de représentation et l'onglet affiché. */
export var view = {
  mode: "agg",        /* "agg" (par poste) | "unit" (pièce par pièce) */
  grouping: "chap"    /* "chap" | "fam" | "sch" | "plan" | "vol" */
};
