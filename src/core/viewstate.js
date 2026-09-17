/* État de la vue — source unique de vérité.

   DEUX destinations, là où il y en avait quatre. Les onglets ne sont pas un
   sommaire : ils sont la CHRONOLOGIE du concours. Chacun se sert de ce que le
   précédent a décidé.

       Programme  →  Programme mixer  →  (Massing)  →  (Typologie)
       contraintes    répartition du     volumétrie     plans et coupes
       et surfaces    programme sur
                      les niveaux

   L'ancien ordre faisait l'inverse : on dessinait le Plan d'un niveau avant
   d'avoir choisi le Site, donc la typologie décidait du volume. Les deux
   dernières étapes sont à reconstruire ; le code 3D reste en place pour cela
   (`src/core/gl.js`, `src/vol/`).

   `view.tab`   quelle vue est à l'écran        → pilote body[data-view]
   `view.group` regroupement dans Programme     → chapitres ou familles
   `view.mode`  niveau de détail des diagrammes → groupé ou détaillé
*/

export var TABS = [
  { id:"programme", label:"Programme",       kind:"doc"  },
  { id:"mixer",     label:"Programme mixer", kind:"tool" }
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
   L'agencement était persisté, mais pas l'endroit où l'on se trouve : on
   rechargeait après une heure de composition et on retombait sur la page de
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
