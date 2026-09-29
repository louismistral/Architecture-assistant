/* État de la vue — source unique de vérité.

   HUIT destinations numérotées, et le cadre. Les onglets ne sont pas un
   sommaire : ils sont la CHRONOLOGIE du concours. Chacun se sert de ce que le
   précédent a décidé.

       ⚙ Paramètres & contraintes   le cadre, hors chronologie
       01 Cahier des charges        surfaces, contraintes, adjacences
       02 Forensics                 le moodboard : ce qu'on a vu, lu, relevé
       03 Programme mixer           répartition du programme sur les niveaux
       04 Massing                   volumétrie sur le site
       05 Typologies · 06 Tectonics · 07 Materiality · 08 Rendu   à construire

   L'ancien ordre faisait l'inverse : on dessinait le Plan d'un niveau avant
   d'avoir choisi le Site, donc la typologie décidait du volume. La typologie
   a son onglet, vide : elle reste à construire.

   CHAQUE ONGLET A SES VOLETS, et chacun garde le sien. Le cahier des charges
   avait seul des volets ; les deux outils en ont désormais deux — ce qu'ils
   FONT, et les CONTRAINTES qui gouvernent ce qu'ils font. Un volet unique et
   partagé aurait fait qu'en quittant les contraintes du programme on serait
   tombé sur celles du mixer : ce ne sont pas les mêmes, et l'on ne les visite
   pas au même moment.

   `view.tab`   quelle vue est à l'écran        → pilote body[data-view]
   `view.subs`  le volet retenu, PAR onglet
   `view.group` regroupement dans Surfaces       → chapitres ou familles
   `view.mode`  ce que dessine la nomenclature   → un carré par poste ou par pièce
*/

export var TABS = [
  /* Le CADRE du projet, hors chronologie : tout ce qui influe sur une
     variante, en lignes — critère, valeur, importance. Il n'a pas de numéro
     parce qu'il n'est pas une étape : il porte une icône. */
  { id:"parametres", label:"Paramètres & contraintes", kind:"doc", icon:"reglages" },
  { id:"programme",  label:"Cahier des charges", kind:"doc",  n:"01" },
  /* Le moodboard du groupe : images, notes, liens, sur une toile. */
  { id:"forensics",  label:"Forensics",          kind:"tool", n:"02" },
  { id:"mixer",      label:"Programme mixer",    kind:"tool", n:"03" },
  { id:"massing",    label:"Massing",            kind:"tool", n:"04" },
  /* À construire. Les onglets existent pour que la chronologie soit entière,
     et qu'on sache où chaque chose viendra : la typologie après le volume,
     jamais avant. */
  { id:"typologie",  label:"Typologies",         kind:"tool", n:"05" },
  { id:"tectonique", label:"Tectonics",          kind:"tool", n:"06" },
  { id:"materialite",label:"Materiality",        kind:"tool", n:"07" },
  { id:"rendu",      label:"Rendu",              kind:"tool", n:"08" }
];

/* Les volets, onglet par onglet. Ils étaient trois pour le seul cahier des
   charges, empilés sur une seule page avant cela : quatre écrans de défilement
   pour revenir d'une adjacence à la surface qu'elle commente.

   Les adjacences ont été un onglet, puis un volet, puis la fin des
   contraintes. Elles sont de nouveau un volet : rangées sous les contraintes,
   elles se lisaient après quatre écrans de tableaux, et une planche unique
   laissait trois petites grappes flotter dans le vide de la grande. Chaque
   grappe a maintenant sa carte, et les cartes demandent leur propre page.

   Le volet « Contraintes » d'un OUTIL est d'une autre nature que celui du
   cahier des charges : là on lit ce que le règlement impose, ici on lit — et
   l'on règle — ce que NOUS avons arbitré pour que le générateur produise
   quelque chose. Rien n'y est opposable, tout s'y discute. */
export var SUBS_BY = {
  programme: [
    { id:"surfaces",    label:"Surfaces"    },
    { id:"contraintes", label:"Contraintes" },
    { id:"adjacences",  label:"Adjacences"  }
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
   ils restent valables. Aucun n'a disparu aujourd'hui : `adjacences`, qui a
   été un alias des contraintes, est redevenu un volet à part entière. */
var SALIAS = {};

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
  if(t === "adjacences"){ view.tab = "programme"; view.subs.programme = "adjacences"; return true; }
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
