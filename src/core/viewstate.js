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
   `view.sub`   volet de l'onglet Programme      → surfaces, contraintes, adjacences
   `view.group` regroupement dans Surfaces       → chapitres ou familles
   `view.mode`  niveau de détail des diagrammes → groupé ou détaillé
*/

export var TABS = [
  { id:"programme", label:"Programme",       kind:"doc"  },
  { id:"mixer",     label:"Programme mixer", kind:"tool" }
];

/* Les trois volets de l'onglet Programme. Ils étaient empilés sur une seule
   page, numérotés 1, 2, 3 : quatre écrans de défilement pour revenir d'une
   adjacence à la surface qu'elle commente. Ce sont trois lectures du même
   règlement, pas trois étapes — la chronologie du concours, elle, est dans les
   onglets. Ils deviennent des volets, et l'on passe de l'un à l'autre sans
   perdre sa place.

   Les surfaces d'abord : c'est ce qu'on ouvre, et c'est le seul volet où l'on
   saisit quelque chose. */
export var SUBS = [
  { id:"surfaces",    label:"Surfaces"    },
  { id:"contraintes", label:"Contraintes" },
  { id:"adjacences",  label:"Adjacences"  }
];

export var view = {
  tab: "programme",
  sub: "surfaces",    /* "surfaces" | "contraintes" | "adjacences" */
  group: "chap",      /* "chap" | "fam" */
  mode: "agg"         /* "agg" (groupé) | "unit" (détaillé) */
};
export function subOf(id){
  for(var i = 0; i < SUBS.length; i++) if(SUBS[i].id === (id || view.sub)) return SUBS[i];
  return SUBS[0];
}
export function isSub(id){
  for(var i = 0; i < SUBS.length; i++) if(SUBS[i].id === id) return true;
  return false;
}
/* Le volet appartient à `viewstate` : les autres modules passent par ici pour
   en changer, comme pour l'onglet. */
export function setSub(id){ if(isSub(id)) view.sub = id; }

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
  var seg = (location.hash || "").replace(/^#/, "").split("/");
  var t = seg[0], known = false, named = false, i;
  /* `#adjacences` a circulé comme lien du temps où c'était un onglet : il reste
     valable et mène au volet. */
  if(t === "adjacences"){ view.tab = "programme"; view.sub = "adjacences"; return true; }
  for(i = 0; i < TABS.length; i++) if(TABS[i].id === t) known = true;
  if(known) view.tab = t;
  /* `#programme/fam` a circulé lui aussi, sans volet : le segment peut être un
     volet ou un regroupement, on accepte les deux à la même place. Un lien vers
     Programme qui ne nomme aucun volet mène aux surfaces — sinon le volet
     retenu de la visite précédente décidait à sa place. */
  for(i = 1; i < seg.length; i++){
    if(isSub(seg[i])){ view.sub = seg[i]; named = true; }
    else if(seg[i] === "chap" || seg[i] === "fam") view.group = seg[i];
  }
  if(view.tab === "programme" && !named) view.sub = "surfaces";
  return known;
}
export function writeHash(){
  var h = "#" + view.tab;
  if(view.tab === "programme"){
    h += "/" + view.sub + (view.sub === "surfaces" ? "/" + view.group : "");
  }
  if(location.hash !== h) history.replaceState(null, "", h);
  document.title = "Saxon — " + (view.tab === "programme"
    ? subOf().label.toLowerCase() : tabOf(view.tab).label.toLowerCase());
}
