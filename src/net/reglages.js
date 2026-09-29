/* ============================================================================
   LES RÉGLAGES DU GROUPE

   Trois choses ne peuvent pas différer entre deux membres sans que l'outil
   mente : les huit surfaces « à préciser », la largeur du couloir, et les
   écarts des LIGNES au défaut (`data/lignes.js — V`) — le cadre choisi,
   l'orientation, les tags, les domaines des leviers, les paramètres du
   générateur, et le JURY : les poids, les axes, les fonctions de score, le
   prix au m³. Ce ne sont pas des préférences d'affichage, ce sont des
   DÉCISIONS DE PROJET — si l'un travaille avec un couloir de 2,40 m et l'autre
   de 3 m, leurs deux variantes ne se comparent plus ; deux membres ne peuvent
   pas travailler avec deux jurys différents.

   La colonne s'appelle encore `doctrine` : c'est le nom qu'elle a en base, et
   il ne vaut pas une migration. Les clés d'avant (rangs, bacs, poids d'un
   ancien juge) y sont ignorées à la lecture.

   La colonne `circulation` de la table porte la LARGEUR du couloir depuis que
   la circulation se déduit des pièces. Une ligne écrite avant y a laissé une
   part (0,18) : hors des bornes d'une largeur, elle se refuse d'elle-même.

   Elles se lisent à l'ouverture et s'écrivent au fil de l'eau. Le dernier qui
   écrit gagne, et l'on dit QUI : à deux, sur un concours, se voler un réglage
   se règle en se parlant, pas en verrouillant une table.

   Ce qui reste à chacun : la composition à l'écran, les écarts assumés, l'état
   fixe ou libre des leviers. Travailler n'est pas publier.
   ========================================================================= */
import { CIRCSET, COULOIR, loadCirc, recompute, userAreas } from "../core/model.js";
import { ecarts, poser } from "../data/lignes.js";
import { applyAreas, onSave } from "../mix/store.js";
import { CPT } from "./compte.js";
import { selectApi, upsertApi } from "./supa.js";

export var REG = { charge:false, par:null, quand:null };
var dernier = null;      /* la signature de ce qu'on a écrit ou lu en dernier */
var occupe = false;      /* on applique du distant : ne pas le renvoyer aussitôt */
var minuteur = null;

function partDeLEtat(){
  return { areas: userAreas, circulation: CIRCSET ? COULOIR : null, doctrine: ecarts(false) };
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
    if(r.doctrine) poser(r.doctrine, false);
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
