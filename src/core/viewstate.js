/* État de la vue — source unique de vérité.

   Quatre destinations, là où il y en avait cinq. « Chapitres du programme » et
   « Familles d'usage » produisaient le même objet `groups` et traversaient le
   même code : ce n'était jamais une destination, c'est un critère de tri. Il
   devient `view.group`, un réglage de l'onglet Programme.

   `view.tab`   quelle vue est à l'écran        → pilote body[data-view]
   `view.group` regroupement dans Programme     → chapitres ou familles
   `view.mode`  niveau de détail des diagrammes → groupé ou détaillé
*/

export var TABS = [
  { id:"programme",  label:"Programme",  kind:"doc"  },
  { id:"adjacences", label:"Adjacences", kind:"doc"  },
  { id:"plan",       label:"Plan",       kind:"tool" },
  { id:"site",       label:"Site",       kind:"tool" }
];

export var view = {
  tab: "programme",
  group: "chap",      /* "chap" | "fam" */
  mode: "agg"         /* "agg" (groupé) | "unit" (détaillé) */
};

export function tabOf(id){
  for(var i = 0; i < TABS.length; i++) if(TABS[i].id === id) return TABS[i];
  return TABS[0];
}
export function isTool(id){ return tabOf(id || view.tab).kind === "tool"; }

/* --- orientation ---------------------------------------------------------
   L'agencement du plan était persisté, mais pas l'endroit où l'on se trouve :
   on rechargeait après une heure de composition et on retombait sur la page de
   couverture. Le fragment d'URL rend la vue partageable et survit au
   rechargement, sans stockage. */
export function readHash(){
  var h = (location.hash || "").replace(/^#/, "");
  var t = h.split("/")[0], g = h.split("/")[1];
  var known = false;
  for(var i = 0; i < TABS.length; i++) if(TABS[i].id === t) known = true;
  if(known) view.tab = t;
  if(g === "chap" || g === "fam") view.group = g;
  return known;
}
export function writeHash(){
  var h = "#" + view.tab + (view.tab === "programme" ? "/" + view.group : "");
  if(location.hash !== h) history.replaceState(null, "", h);
  document.title = "Saxon — " + tabOf(view.tab).label.toLowerCase();
}
