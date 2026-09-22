/* ============================================================================
   LES RÉGLAGES DU GROUPE

   Trois choses ne peuvent pas différer entre deux membres sans que l'outil
   mente : les huit surfaces « à préciser », la part de circulation, et les
   écarts à la doctrine. Ce ne sont pas des préférences d'affichage, ce sont
   des DÉCISIONS DE PROJET — si l'un travaille à 0,18 de circulation et
   l'autre à 0,20, leurs deux variantes ne se comparent plus.

   Elles se lisent à l'ouverture et s'écrivent au fil de l'eau. Le dernier qui
   écrit gagne, et l'on dit QUI : à deux, sur un concours, se voler un réglage
   se règle en se parlant, pas en verrouillant une table.

   Ce qui reste à chacun : la composition à l'écran, les écarts assumés, les
   interrupteurs du mixer. Travailler n'est pas publier.
   ========================================================================= */
import { CIRC, CIRCSET, loadCirc, recompute, userAreas } from "../core/model.js";
import { docOf, setDocs } from "../data/doctrine.js";
import { applyAreas, onSave } from "../mix/store.js";
import { CPT } from "./compte.js";
import { selectApi, upsertApi } from "./supa.js";

export var REG = { charge:false, par:null, quand:null };
var dernier = null;      /* la signature de ce qu'on a écrit ou lu en dernier */
var occupe = false;      /* on applique du distant : ne pas le renvoyer aussitôt */
var minuteur = null;

function partDeLEtat(){
  return { areas: userAreas, circulation: CIRCSET ? CIRC : null, doctrine: docOf() };
}
function signature(o){ return JSON.stringify([o.areas, o.circulation, o.doctrine]); }

/* ---------- lire ----------
   Au chargement, le distant GAGNE : c'est la décision du groupe, et celui qui
   ouvre son navigateur après trois jours ne doit pas ramener ses vieux
   chiffres sans le savoir. */
export async function tirerReglages(){
  if(!CPT.equipe) return false;
  var l = await selectApi("team_settings",
    "team_id=eq." + CPT.equipe.id + "&select=areas,circulation,doctrine,updated_at,updated_by");
  if(!l || !l.length) return false;
  var r = l[0];
  occupe = true;
  try{
    if(r.areas) applyAreas(r.areas);
    if(r.circulation != null) loadCirc(r.circulation);
    if(r.doctrine) setDocs(r.doctrine);
    recompute();
  } finally { occupe = false; }
  dernier = signature({ areas:r.areas || {}, circulation:r.circulation, doctrine:r.doctrine || {} });
  REG.charge = true;
  REG.par = r.updated_by;
  REG.quand = r.updated_at;
  return true;
}

/* ---------- écrire ----------
   Rien ne part si rien n'a changé : le mixer enregistre à chaque bloc
   déplacé, et la composition n'est pas un réglage. */
export async function pousserReglages(){
  if(!CPT.equipe || !CPT.profil || occupe) return;
  var o = partDeLEtat(), sig = signature(o);
  if(sig === dernier) return;
  dernier = sig;
  try{
    /* UPSERT et non PATCH : une équipe sans ligne de réglages verrait chaque
       envoi toucher zéro ligne, sans erreur — le groupe cesserait de partager
       ses décisions sans que rien ne le dise. */
    var r = await upsertApi("team_settings",
      { team_id:CPT.equipe.id, areas:o.areas, circulation:o.circulation,
        doctrine:o.doctrine, updated_by:CPT.profil.id });
    if(r && r[0]){ REG.par = r[0].updated_by; REG.quand = r[0].updated_at; }
  }catch(_){ dernier = null; }   /* raté : on réessaiera au prochain changement */
}

export function initReglages(){
  onSave(function(){
    clearTimeout(minuteur);
    minuteur = setTimeout(pousserReglages, 1200);
  });
}
