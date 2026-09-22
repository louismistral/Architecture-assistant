/* État de la vue — source unique de vérité.

   TROIS destinations. Les onglets ne sont pas un sommaire : ils sont la
   CHRONOLOGIE du concours. Chacun se sert de ce que le précédent a décidé.

       Cahier des charges  →  Programme mixer  →  Massing  →  (Typologie)
       contraintes            répartition du     volumétrie   plans et coupes
       et surfaces            programme sur      sur le site
                              les niveaux

   L'ancien ordre faisait l'inverse : on dessinait le Plan d'un niveau avant
   d'avoir choisi le Site, donc la typologie décidait du volume. Seule la
   typologie reste à construire.

   CHAQUE ONGLET A SES VOLETS, et chacun garde le sien. Le cahier des charges
   avait seul des volets ; les deux outils en ont désormais deux — ce qu'ils
   FONT, et les CONTRAINTES qui gouvernent ce qu'ils font. Un volet unique et
   partagé aurait fait qu'en quittant les contraintes du programme on serait
   tombé sur celles du mixer : ce ne sont pas les mêmes, et l'on ne les visite
   pas au même moment.

   `view.tab`   quelle vue est à l'écran        → pilote body[data-view]
   `view.subs`  le volet retenu, PAR onglet
   `view.group` regroupement dans Surfaces       → chapitres ou familles
   `view.mode`  niveau de détail des diagrammes → groupé ou détaillé
*/

export var TABS = [
  { id:"programme", label:"Cahier des charges", kind:"doc"  },
  { id:"mixer",     label:"Programme mixer", kind:"tool" },
  { id:"massing",   label:"Massing", kind:"tool" }
];

/* Les volets, onglet par onglet. Ils étaient trois pour le seul cahier des
   charges, empilés sur une seule page avant cela : quatre écrans de défilement
   pour revenir d'une adjacence à la surface qu'elle commente.

   Les adjacences ne sont plus un volet du programme : une proximité exigée
   entre deux locaux n'est pas d'une autre nature qu'une hauteur libre ou une
   distance au voisin. C'est une contrainte, et elle se lit avec les autres.

   Le volet « Contraintes » d'un OUTIL est d'une autre nature que celui du
   cahier des charges : là on lit ce que le règlement impose, ici on lit — et
   l'on règle — ce que NOUS avons arbitré pour que le générateur produise
   quelque chose. Rien n'y est opposable, tout s'y discute. */
export var SUBS_BY = {
  programme: [
    { id:"surfaces",    label:"Surfaces"    },
    { id:"contraintes", label:"Contraintes" }
  ],
  mixer: [
    { id:"repartition", label:"Répartition" },
    { id:"contraintes", label:"Contraintes" }
  ],
  massing: [
    { id:"volumetrie",  label:"Volumétrie"  },
    { id:"contraintes", label:"Contraintes" }
  ]
};
/* Un volet qui a disparu mène à celui qui l'a repris : les liens ont circulé,
   ils restent valables. */
var SALIAS = { adjacences:"contraintes" };

export var view = {
  tab: "programme",
  subs: { programme:"surfaces", mixer:"repartition", massing:"volumetrie" },
  group: "chap",      /* "chap" | "fam" */
  mode: "agg"         /* "agg" (groupé) | "unit" (détaillé) */
};

export function subsOf(tab){ return SUBS_BY[tab || view.tab] || []; }
export function curSub(tab){
  var t = tab || view.tab;
  return view.subs[t] || (SUBS_BY[t] ? SUBS_BY[t][0].id : "");
}
export function subOf(id, tab){
  var L = subsOf(tab), want = id || curSub(tab), i;
  for(i = 0; i < L.length; i++) if(L[i].id === want) return L[i];
  return L[0] || { id:"", label:"" };
}
export function isSub(id, tab){
  var L = subsOf(tab), want = SALIAS[id] || id, i;
  for(i = 0; i < L.length; i++) if(L[i].id === want) return true;
  return false;
}
/* Le volet appartient à `viewstate` : les autres modules passent par ici pour
   en changer, comme pour l'onglet. */
export function setSub(id, tab){
  var t = tab || view.tab, want = SALIAS[id] || id;
  if(isSub(want, t)) view.subs[t] = want;
}
/* L'identifiant du bouton d'un volet, pour `aria-labelledby` : il doit être
   unique d'un onglet à l'autre, deux onglets ayant un volet « contraintes ». */
export function subBtnId(tab, id){
  return "sub-" + (tab || view.tab) + "-" + id;
}

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
  if(t === "adjacences"){ view.tab = "programme"; view.subs.programme = "contraintes"; return true; }
  for(i = 0; i < TABS.length; i++) if(TABS[i].id === t) known = true;
  if(known) view.tab = t;
  /* `#programme/fam` a circulé lui aussi, sans volet : le segment peut être un
     volet ou un regroupement, on accepte les deux à la même place. Un lien vers
     un onglet qui ne nomme aucun volet mène à son PREMIER volet — sinon le volet
     retenu de la visite précédente décidait à sa place. */
  for(i = 1; i < seg.length; i++){
    if(isSub(seg[i])){ setSub(seg[i]); named = true; }
    else if(seg[i] === "chap" || seg[i] === "fam") view.group = seg[i];
  }
  if(!named && subsOf().length) view.subs[view.tab] = subsOf()[0].id;
  return known;
}
export function writeHash(){
  var h = "#" + view.tab, s = curSub();
  if(subsOf().length > 1){
    h += "/" + s;
    if(view.tab === "programme" && s === "surfaces") h += "/" + view.group;
  }
  if(location.hash !== h) history.replaceState(null, "", h);
  document.title = "Saxon — " + (subOf().label || tabOf(view.tab).label).toLowerCase();
}
