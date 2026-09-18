/* État de la vue — source unique de vérité.

   Trois destinations. « Chapitres du programme » et « Familles d'usage »
   produisaient le même objet `groups` et traversaient le même code : ce n'était
   jamais une destination, c'est un critère de tri, devenu `view.group`. De
   même, « Adjacences » lisait le règlement comme les surfaces : elle devient un
   volet de l'onglet Programme, `view.sub`.

   `view.tab`   quelle vue est à l'écran        → pilote body[data-view]
   `view.sub`   volet de l'onglet Programme      → surfaces, contraintes, adjacences
   `view.group` regroupement dans Surfaces       → chapitres ou familles
   `view.mode`  niveau de détail des diagrammes → groupé ou détaillé
*/

export var TABS = [
  { id:"programme",  label:"Programme",  kind:"doc"  },
  { id:"plan",       label:"Plan",       kind:"tool" },
  { id:"site",       label:"Site",       kind:"tool" }
];

/* Les trois volets de l'onglet Programme. « Adjacences » était une destination
   de premier rang à côté de « Plan » et « Site », alors qu'elle ne fait que
   lire le programme sous un autre angle — comme les surfaces et les
   contraintes. Les trois répondent à la même question : ce que le règlement
   demande. Composer, c'est « Plan » et « Site ». */
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
/* Le volet appartient à `viewstate` : les autres modules passent par ici pour
   en changer, comme pour l'onglet. */
export function setSub(id){ if(isSub(id)) view.sub = id; }
export function isSub(id){
  for(var i = 0; i < SUBS.length; i++) if(SUBS[i].id === id) return true;
  return false;
}

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
  var seg = (location.hash || "").replace(/^#/, "").split("/");
  var t = seg[0], known = false, i;
  /* `#adjacences` a circulé comme lien : il reste valable et mène au volet. */
  if(t === "adjacences"){ view.tab = "programme"; view.sub = "adjacences"; return true; }
  for(i = 0; i < TABS.length; i++) if(TABS[i].id === t) known = true;
  if(known) view.tab = t;
  /* `#programme/fam` a circulé lui aussi, sans volet : le segment peut être un
     volet ou un regroupement, on accepte les deux à la même place. Un lien vers
     Programme qui ne nomme aucun volet mène aux surfaces — sinon le volet
     retenu de la visite précédente décidait à sa place. */
  var named = false;
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
