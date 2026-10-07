/* ============================================================================
   LES LIGNES — UN SCHÉMA POUR TOUT CE QUI INFLUE SUR UNE VARIANTE

   Deux moteurs, et rien ne passe de l'un à l'autre :

     la RECHERCHE   produit beaucoup de variantes, diverses. Elle porte nos
                    choix : ce qu'on fait varier (LEVIERS), ce qui rend une
                    variante valide (CADRE), où chercher d'abord (ORIENTATION) ;
     le JUGEMENT    note un bâtiment comme le ferait le jury, par ses mesures.
                    Il ne sait rien de la recherche : il noterait aussi bien le
                    bâtiment d'un concurrent.

   Chaque ligne a UN rôle. Un même sujet — le parti, la compacité, la cour —
   peut en porter plusieurs, une par rôle, et elles peuvent diverger : ce qu'on
   préfère n'est pas forcément ce que le jury récompense.

   Hors rôles : les DONNÉES (le contexte — site, programme, règlement, nos
   hypothèses — et les mesures du bâtiment), que les rôles lisent sans que rien
   n'y soit tiré ni noté ; et les PARAMÈTRES DU GÉNÉRATEUR, la machine et non
   le bâtiment.

   Une ligne se range sur plusieurs niveaux, toujours les mêmes :

     sujet    ce dont elle parle — ce qui rapproche les lignes des quatre rôles
     role     levier · cadre · orientation · jugement · donnee · recherche
     onglet   où elle agit — le cahier des charges, le mixer, le massing…
     src      d'où elle vient — le règlement et son article, l'AEAI, notre
              choix, une hypothèse, l'usage scolaire, le site, le générateur
     qui      qui la règle — le code, le groupe, chacun
     tag      sa force, pour le cadre et l'orientation (voir TAGS)
     k        la case de `V` qu'elle lit et écrit, quand elle a une valeur

   Ce fichier tient le schéma et le MAGASIN : `V`, les valeurs vivantes, lues
   par les générateurs à chaque appel. Aucune copie : une ligne de la page, un
   générateur, le jugement lisent et écrivent la même case. Les lignes
   elles-mêmes sont dans les fichiers de leur rôle — `leviers.js`, `cadre.js`,
   `orientation.js`, `jugement.js`, `recherche.js` — et dans `donnees.js`.
   ========================================================================= */

/* Les noms sont ceux de la page ; les `id` sont restés, le code les lit.
   Cinq rubriques, une question chacune :
     Contraintes  (cadre)        valide ou non, par des forces extérieures ;
     Leviers      (levier)       ce que nous décidons pour borner la recherche,
                                 la machine comprise (recherche) ;
     Préférences  (orientation)  ce qui guide le moteur sans le borner ;
     Évaluation   (jugement)     mesurer puis noter — rien n'y sert à générer ;
     Données      (donnee)       le contexte que tout lit. */
export var ROLES = [
  { id:"donnee",      n:"Données",      moteur:"—",
    q:"Le contexte que tout lit : le site, le règlement, nos hypothèses de construction. Rien n'y est tiré ni noté." },
  { id:"levier",      n:"Leviers",      moteur:"recherche",
    q:"Ce que nous décidons pour limiter ou élargir la recherche : le domaine où le moteur tire, les surfaces que nous précisons, la machine elle-même. Aucun effet propre sur la note." },
  { id:"cadre",       n:"Contraintes",  moteur:"recherche",
    q:"La variante est-elle valide ? Oui ou non, fixé de l'extérieur — le site, le règlement, l'AEAI, le cahier des charges. Le générateur ne propose jamais une variante qui en sort." },
  { id:"orientation", n:"Préférences",  moteur:"recherche",
    q:"Ce qui guide le moteur sans définir ce qu'il a le droit de chercher : nos intentions, dosées par leur tag — Imposé, Prioritaire, Souhaité, Indicatif. Elles n'entrent pas dans la note." },
  { id:"jugement",    n:"Évaluation",   moteur:"jugement",
    q:"Une variante est mesurée, puis jugée — critères, fonctions, poids — jusqu'à une note. Rien ici ne sert à générer : une géométrie venue d'ailleurs s'évalue de même." },
  { id:"recherche",   n:"Moteur de recherche", moteur:"recherche",
    q:"La machine, pas le bâtiment : essais, seeds, dosage entre le hasard et les préférences." }
];
export function roleNom(id){
  for(var i = 0; i < ROLES.length; i++) if(ROLES[i].id === id) return ROLES[i].n;
  return id;
}

/* ---------- les tags de force -------------------------------------------------
   Du rouge au vert : ce qui influe forcément, ce qui influe peut-être, ce qui
   n'influe pas. Ils ne portent que sur le CADRE et l'ORIENTATION, parce que la
   force est du côté de la recherche. Le jugement n'a pas de tag : son
   importance est son poids, et ce n'est jamais le même nombre.

   Passer la frontière Imposé / Prioritaire change le RÔLE de la ligne — c'est
   la façon d'assouplir ou de durcir un choix. Intangible ne se change pas. */
export var TAGS = [
  { id:"intangible",  n:"Intangible",  role:"cadre",
    d:"Contrainte — site, règlement, AEAI. Jamais enfreint par le générateur ; hors générateur, la variante est invalide. Ne se change pas." },
  { id:"impose",      n:"Imposé",      role:"cadre",
    d:"Préférence ferme — un arbitrage à nous, appliqué comme une règle. Jamais enfreint par le générateur ; hors générateur, l'écart est notifié. Se relâche en Prioritaire." },
  { id:"prioritaire", n:"Prioritaire", role:"orientation",
    d:"La recherche n'y renonce que s'il n'y a pas d'autre issue." },
  { id:"souhaite",    n:"Souhaité",    role:"orientation",
    d:"Départage deux variantes." },
  { id:"indicatif",   n:"Indicatif",   role:null,
    d:"N'influe sur aucune variante ; se lit — contrôle, alertes." }
];
export function tagInfo(id){
  for(var i = 0; i < TAGS.length; i++) if(TAGS[i].id === id) return TAGS[i];
  return TAGS[TAGS.length - 1];
}

export var ONGLETS = {
  programme: "Cahier des charges",
  mixer:     "Programme mixer",
  massing:   "Massing",
  typologie: "Typologies",
  rendu:     "Rendu",
  tous:      "Tous les onglets"
};
export var SOURCES = {
  reglement: "règlement",
  aeai:      "AEAI",
  programme: "programme",
  site:      "relevé du site",
  choix:     "notre choix",
  hypothese: "hypothèse",
  usage:     "usage scolaire",
  construction:"construction",
  concours:  "concours gagnants",
  generateur:"générateur",
  mesure:    "formule de mesure"
};
export function sourceTxt(src){
  if(!src) return "";
  return (SOURCES[src.t] || src.t) + (src.a ? " " + src.a : "");
}
export var QUI = { code:"le code", groupe:"le groupe", chacun:"chacun",
                   mixte:"domaine : le groupe · état : chacun" };

/* ---------- le magasin -------------------------------------------------------
   `V` est un objet plat. Une valeur réglée est persistée, mais seulement son
   ÉCART au défaut : tout enregistrer figerait les valeurs du jour, et une
   correction apportée au code ne parviendrait jamais à qui a déjà ouvert
   l'application.

   Les valeurs du JURY — poids, axes, fonctions de score, prix au m³ — sont
   marquées : une variante qu'on recharge remet la recherche dans l'état où
   elle l'a produite, jamais le jury. Deux variantes se comparent avec le même
   jury, ou ne se comparent pas. */
export var V = {};
var DEF = {}, BORNE = {}, JURY = {};

export function valeur(k, def, b, jury){
  if(k in DEF) return;
  DEF[k] = def; V[k] = def;
  if(b) BORNE[k] = b;
  if(jury) JURY[k] = 1;
}
export function defaut(k){ return DEF[k]; }
export function connue(k){ return k in DEF; }
export function borne(k){ return BORNE[k] || null; }
export function estJury(k){ return !!JURY[k]; }

/* Rend vrai si la valeur a changé. Le type suit celui du défaut : un nombre
   se relit d'une saisie (virgule comprise) et se borne ; un tag reste un mot. */
export function regler(k, v){
  if(!(k in DEF)) return false;
  var n = v;
  if(typeof DEF[k] === "number"){
    n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : +v;
    if(!isFinite(n)) return false;
    var b = BORNE[k];
    if(b && b.min !== undefined) n = Math.max(b.min, Math.min(b.max, n));
  } else if(typeof DEF[k] === "string"){
    if(typeof v !== "string") return false;
    if(BORNE[k] && BORNE[k].parmi && BORNE[k].parmi.indexOf(v) < 0) return false;
  }
  if(n === V[k]) return false;
  V[k] = n;
  return true;
}
function garde(k, sansJury){ return !(sansJury && JURY[k]); }
export function ecarts(sansJury){
  var o = {};
  for(var k in V) if(V[k] !== DEF[k] && garde(k, sansJury)) o[k] = V[k];
  return o;
}
export function poser(o, sansJury){
  if(!o) return;
  for(var k in o) if(k in DEF && garde(k, sansJury)) regler(k, o[k]);
}
/* Le jury seul — ce que l'appareil garde à part de l'instantané, pour qui
   travaille sans groupe. */
export function ecartsJury(){
  var o = {};
  for(var k in V) if(JURY[k] && V[k] !== DEF[k]) o[k] = V[k];
  return o;
}
export function poserJury(o){
  if(!o) return;
  for(var k in o) if(JURY[k]) regler(k, o[k]);
}
export function retablir(sansJury, filtre){
  var n = 0;
  for(var k in DEF){
    if(!garde(k, sansJury) || (filtre && !filtre(k))) continue;
    if(V[k] !== DEF[k]){ V[k] = DEF[k]; n++; }
  }
  return n;
}
export function modifie(filtre){
  for(var k in DEF) if(V[k] !== DEF[k] && (!filtre || filtre(k))) return true;
  return false;
}
/* Les défauts de ce qui fait une variante — la recherche, pas le jury : ils
   entrent dans l'empreinte (`core/empreinte.js`). Le jury change sans périmer
   aucune variante : il la renote. */
export function defautsRecherche(){
  var o = {};
  for(var k in DEF) if(!JURY[k]) o[k] = DEF[k];
  return o;
}

/* ---------- le registre -------------------------------------------------------
   Chaque fichier de rôle déclare ses lignes ici. Une ligne à valeur (`k`)
   inscrit sa case ; une ligne à tag inscrit `t:<id>` ; une ligne qui se
   désactive, `on:<id>`. */
export var LIGNES = [];
var PAR_ID = {};
export function declarer(liste){
  liste.forEach(function(l){
    if(PAR_ID[l.id]) throw new Error("ligne en double : " + l.id);
    PAR_ID[l.id] = l;
    LIGNES.push(l);
    var jury = l.role === "jugement";
    if(l.k && l.def !== undefined) valeur(l.k, l.def, { min:l.min, max:l.max }, jury || l.jury);
    /* une seconde valeur — la borne haute d'un domaine, un seuil défavorable */
    if(l.k2 && l.def2 !== undefined) valeur(l.k2, l.def2, { min:l.min2, max:l.max2 }, jury || l.jury);
    if(l.tag) valeur("t:" + l.id, l.tag, { parmi: l.admet || [l.tag] });
    /* `eteint` : une ligne livrée éteinte, qu'on rallume à la main */
    if(l.off !== undefined) valeur("on:" + l.id, l.eteint ? 0 : 1, { min:0, max:1 }, jury);
  });
}
export function ligne(id){ return PAR_ID[id] || null; }

/* ---------- ce que les moteurs demandent à une ligne ---------------------------- */
export function tagDe(id){
  var l = PAR_ID[id];
  if(!l || !l.tag) return null;
  return V["t:" + id] || l.tag;
}
export function setTag(id, t){
  var l = PAR_ID[id];
  if(!l || !l.tag || l.tag === "intangible") return false;
  return regler("t:" + id, t);
}
export function actif(id){
  var l = PAR_ID[id];
  if(!l) return false;
  return l.off === undefined || V["on:" + id] !== 0;
}
export function setActif(id, on){ return regler("on:" + id, on ? 1 : 0); }
/* Le rôle VIVANT : celui que le tag donne, pour une ligne qui en porte un. Une
   ligne indicative garde son rôle de départ, sans effet. */
export function roleDe(id){
  var l = PAR_ID[id];
  if(!l) return null;
  if(!l.tag) return l.role;
  var r = tagInfo(tagDe(id)).role;
  return r || l.role;
}
/* Le cadre s'applique : tag Intangible ou Imposé, et la ligne n'est pas
   éteinte. Une ligne inconnue ne s'applique pas. */
export function enVigueur(id){
  var t = tagDe(id);
  return (t === "intangible" || t === "impose") && actif(id);
}
/* L'orientation s'applique : Prioritaire ou Souhaité, et allumée. */
export function oriente(id){
  var t = tagDe(id);
  return (t === "prioritaire" || t === "souhaite") && actif(id);
}
/* Le contrôle en parle : tout ce qui n'est pas éteint. Indicatif compris —
   c'est même tout ce qu'il fait. */
export function lu(id){ return actif(id); }
/* La sévérité d'un écart à la ligne, pour le contrôle : rouge pour un cadre
   opposable, ambre pour le reste. */
export function severite(id){ return tagDe(id) === "intangible" ? "e" : "w"; }
