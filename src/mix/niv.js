/* ============================================================================
   RÈGLES DE NIVEAU

   Ce que le règlement dit du niveau auquel un local peut se trouver. Reprises
   telles quelles de l'ancien plan interactif, ramenées du niveau « pièce » au
   niveau « poste » : c'est le programme qu'on répartit, pas des rectangles.

   Deux sévérités, la convention du projet :
     "e"  rouge — une règle écrite au règlement ou à l'AEAI
     "w"  ambre — une règle de projet, ou une marge qui se discute

   AUCUNE de ces règles n'empêche quoi que ce soit. Le mixer laisse poser ce
   qu'on veut où on veut ; il le dit, c'est tout.
   ========================================================================= */
import { CHAP } from "../data/program.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "./prog.js";

export var NIV = [
  { re:/Salle de sport double/, grade:1, sev:"e",
    msg:"7 m de hauteur libre sous structure — la salle double ne peut être qu'au rez", ref:"2.10" },
  { re:/Abri PC/, lvl:{ min:-9, max:0 }, sev:"e",
    msg:"Abri PC au rez ou en sous-sol, accès et dalle de protection", ref:"2.10" },
  { re:/Local chauffage CAD/, grade:1, sev:"e",
    msg:"Accessible de plain-pied par camion, hauteur libre 5,20 m", ref:"2.10" },
  { re:/Piscine/, grade:1, sev:"e",
    msg:"Bassin, vestiaires et locaux techniques au niveau du terrain", ref:"2.10" },
  { re:/Cour d'école/, grade:1, sev:"e",
    msg:"La cour et son préau sont des aménagements de plain-pied", ref:"2.10" },
  { re:/^Hall/, grade:1, sev:"e",
    msg:"Tous les halls sont au rez-de-chaussée, au niveau du terrain", ref:"2.10" },
  { re:/Scène/, same:"sport|Salle de sport double", sev:"e",
    msg:"Attenante à la salle de sport", ref:"2.10" },
  { key:"sport|Local de rangement", same:"sport|Salle de sport double", sev:"w",
    msg:"Rangement des tables et chaises de la salle polyvalente", ref:"2.10" },
  { re:/Vestiaires (élèves|professeurs)/, same:"sport|Salle de sport double", sev:"w",
    msg:"À proximité des vestiaires de la salle de sport", ref:"2.10" },
  { key:"sport|Local de nettoyage", same:"sport|Salle de sport double", sev:"w",
    msg:"Local de nettoyage de la salle polyvalente", ref:"2.10" },
  { re:/Réfectoire|^Cuisine/, grade:1, sev:"w",
    msg:"Livraisons et lien avec le foyer : de préférence au rez", ref:"2.10" },
  { chap:"uape", grade:1, sev:"e",
    msg:"L'UAPE tient sur un seul niveau, au rez-de-chaussée : accès direct à l'extérieur et aux parents, sans traverser l'école", ref:"2.10" },
  { fam:"adm", grade:1, sev:"e",
    msg:"Bureaux, direction et administration au rez-de-chaussée : ils reçoivent le public et les parents de plain-pied", ref:"2.10" },
  { re:/Salles de classe|Salle de classe|Salle de dédoublement|Salle ACM|Salles d'appui/,
    max: RULES.niv.classeMax, sev:"w",
    msg:"Classes situées au-delà du " + RULES.niv.classeMax
      + "ᵉ étage — évacuation et âge des élèves (9 à 12 ans)", ref:"2.10" },
  { re:/Conciergerie/, grade:1, sev:"w",
    msg:"Local de nettoyage et vestiaires du personnel : accès de service", ref:"2.10" }
];

export function nivHit(rl, p){
  if(rl.key) return rl.key === p.key;
  if(rl.fam) return p.f === rl.fam;
  if(rl.chap) return p.chapId === rl.chap;
  return rl.re.test(p.n);
}

/* Cotes admissibles pour un poste. Par défaut rien ne descend en sous-sol :
   seuls les locaux techniques, de stockage et de nettoyage y sont admis, plus
   l'abri PC que le règlement y autorise explicitement. */
export function lvRange(p){
  var lmin = (p.f === "tec") ? -9 : 0, lmax = 99;
  NIV.forEach(function(rl){
    if(!nivHit(rl, p)) return;
    if(rl.lvl){ lmin = Math.max(lmin, rl.lvl.min); lmax = Math.min(lmax, rl.lvl.max); }
    else if(rl.grade){ lmin = Math.max(lmin, 0); lmax = Math.min(lmax, 0); }
    else if(rl.max !== undefined){ lmin = Math.max(lmin, 0); lmax = Math.min(lmax, rl.max); }
  });
  return { min: lmin, max: lmax };
}

/* Postes qu'une règle « au même niveau que » attache à un autre poste. */
export function ancreDe(p){
  var a = null;
  NIV.forEach(function(rl){
    if(rl.same && nivHit(rl, p) && rl.same !== p.key && PMAP[rl.same]) a = rl.same;
  });
  return a;
}

/* Sanitaires : règle de projet, aucun article ne l'écrit, mais un étage sans
   WC ne se dessine pas. */
export var WCRE  = /^(WC |Toilette)/;
export var WCG   = /^WC garçons/;
export var WCF   = /^WC filles/;
export var CLSRE = /^(Salles? de classe|Salle de dédoublement|Salle ACM|Salles d'appui)/;
export var VESTC = /^Vestiaires de classe/;

/* Le nom du chapitre, pour les messages. */
export function chapName(ci){ return CHAP[ci] ? CHAP[ci].short : ""; }
