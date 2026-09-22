/* ============================================================================
   LE COMPTE ET L'ÉQUIPE

   Une identité, une équipe, ses membres. Rien de plus : ce module ne sait pas
   ce qu'est une variante.

   L'équipe est le PÉRIMÈTRE DE PARTAGE, et il n'y en a qu'un à la fois. Qui
   arrive sans invitation reçoit la sienne, vide — il ne voit rien de personne,
   et personne ne le voit. C'est la règle de lecture de la base qui le garantit,
   pas cette page.
   ========================================================================= */
import { SUPA } from "../data/supabase.js";
import { changerMotDePasse, connecte, connexionMdp, deconnecter, enRecuperation,
         finRecuperation, initSupa, inscription, insertApi, moi, onAuth, oubli,
         patchApi, deleteApi, selectApi, supaOn, upsertApi } from "./supa.js";

/* `hors` pas de base ou pas connecté · `charge` en cours · `dedans` on a une
   équipe · `verif` compte créé, adresse à confirmer · `recup` on revient d'un
   lien de réinitialisation, il reste à poser le mot de passe · `panne` la base
   a dit non */
export var CPT = { statut:"hors", profil:null, equipe:null, membres:[], invites:[], err:"" };

var abonnes = [];
export function onCompte(fn){
  abonnes.push(fn);
  return function(){ abonnes = abonnes.filter(function(f){ return f !== fn; }); };
}
function signale(){ abonnes.forEach(function(f){ try{ f(CPT); }catch(_){} }); }
function etat(s, err){ CPT.statut = s; CPT.err = err || ""; signale(); }

function prenomDe(mail){ return String(mail || "").split("@")[0]; }
export function initialesDe(p){
  var n = (p && (p.name || p.email)) || "?";
  var m = String(n).replace(/[^\p{L} .-]/gu, " ").trim().split(/[\s.\-_]+/);
  return ((m[0] || "?").charAt(0) + (m[1] ? m[1].charAt(0) : "")).toUpperCase();
}

/* ---------- l'amorçage ----------
   Le profil naît d'un déclencheur à l'inscription ; on le pose quand même ici,
   sans écraser ce qui existe. Un compte créé avant que le déclencheur existe
   n'aurait sinon jamais de profil, donc jamais d'équipe — et l'application
   resterait bloquée sur « chargement » sans dire pourquoi. */
async function assurerProfil(u){
  var l = await selectApi("profile", "id=eq." + u.id + "&select=id,name,email");
  if(l && l.length) return l[0];
  var r = await upsertApi("profile", { id:u.id, email:u.email, name:prenomDe(u.email) });
  return (r && r[0]) || { id:u.id, email:u.email, name:prenomDe(u.email) };
}

async function assurerEquipe(profil){
  var l = await selectApi("membership",
    "profile_id=eq." + profil.id + "&select=role,team:team_id(id,name,owner_id)&order=joined_at.asc");
  if(l && l.length && l[0].team) return { equipe:l[0].team, role:l[0].role };

  var t = await insertApi("team", { name: SUPA.equipeDefaut, owner_id: profil.id });
  var eq = t[0];
  await insertApi("membership", { team_id:eq.id, profile_id:profil.id, role:"owner" });
  /* La ligne de réglages naît avec l'équipe : sans elle, le premier partage
     d'une part de circulation devrait deviner s'il insère ou met à jour. */
  await insertApi("team_settings", { team_id:eq.id, updated_by:profil.id });
  return { equipe:eq, role:"owner" };
}

export async function rafraichirMembres(){
  if(!CPT.equipe) return;
  var m = await selectApi("membership",
    "team_id=eq." + CPT.equipe.id + "&select=role,joined_at,profil:profile_id(id,name,email)&order=joined_at.asc");
  CPT.membres = (m || []).filter(function(x){ return x.profil; });
  try{
    CPT.invites = await selectApi("invite",
      "team_id=eq." + CPT.equipe.id + "&select=id,email&order=created_at.asc") || [];
  }catch(_){ CPT.invites = []; }
  signale();
}

export function membreDe(id){
  for(var i = 0; i < CPT.membres.length; i++)
    if(CPT.membres[i].profil.id === id) return CPT.membres[i].profil;
  return null;
}
export function estProprietaire(){
  return !!(CPT.equipe && CPT.profil && CPT.equipe.owner_id === CPT.profil.id);
}

/* ---------- les gestes ----------
   Connexion et création portent les MÊMES champs et se distinguent par le
   bouton : ce sont deux réponses à la même question — « qui es-tu ? » —, et
   demander de choisir avant de taper quoi que ce soit ne sert personne. */
export async function connexion(email, mdp){
  etat("charge");
  try{ await connexionMdp(email, mdp); await chargerCompte(); }
  catch(e){ etat("hors", e.message); }
}

export async function creerCompte(email, mdp){
  etat("charge");
  try{
    var o = await inscription(email, mdp);
    /* Sans session en retour, le projet exige une confirmation par courriel :
       on le DIT, plutôt que de rester sur un écran qui ne bouge pas. */
    if(!o){ etat("verif"); return; }
    await chargerCompte();
  }catch(e){ etat("hors", e.message); }
}

export async function motDePasseOublie(email){
  try{ await oubli(email); etat("hors", "Un lien de réinitialisation vient de partir. Ouvre-le sur cet appareil."); }
  catch(e){ etat("hors", e.message); }
}

/* On arrive ici par le lien de réinitialisation : la session est ouverte, mais
   la seule chose qu'on veuille en faire est poser un nouveau mot de passe. */
export async function poserMotDePasse(mdp){
  etat("charge");
  try{
    await changerMotDePasse(mdp);
    finRecuperation();
    await chargerCompte();
  }catch(e){ CPT.statut = "recup"; etat("recup", e.message); }
}
/* L'état tombe AVANT de couper la session, et pas après : `deconnecter()`
   prévient ses abonnés, dont le gardien ci-dessous, qui aurait rappelé
   `sortir()` tant que le statut disait encore « dedans » — une récursion sans
   fond, et un onglet qui se fige au premier clic sur « Se déconnecter ». */
export async function sortir(){
  CPT.profil = null; CPT.equipe = null; CPT.membres = []; CPT.invites = [];
  etat("hors");
  await deconnecter();
}
export async function inviter(email){
  if(!CPT.equipe) return;
  await insertApi("invite", { team_id:CPT.equipe.id, email:String(email).trim().toLowerCase(),
                              invited_by:CPT.profil.id });
  await rafraichirMembres();
}
export async function annulerInvite(id){
  await deleteApi("invite", "id=eq." + id);
  await rafraichirMembres();
}
export async function retirer(profilId){
  if(!CPT.equipe) return;
  await deleteApi("membership", "team_id=eq." + CPT.equipe.id + "&profile_id=eq." + profilId);
  await rafraichirMembres();
}
export async function renommerEquipe(nom){
  if(!CPT.equipe) return;
  var r = await patchApi("team", "id=eq." + CPT.equipe.id, { name:nom });
  if(r && r[0]) CPT.equipe = r[0];
  signale();
}

/* ---------- le démarrage ----------
   `initSupa()` est SYNCHRONE et doit passer avant la lecture de la route : le
   lien de connexion revient dans le fragment, et le fragment porte la vue. */
export function initCompte(){
  if(!supaOn()){ etat("hors"); return; }
  initSupa();
  onAuth(function(){ if(!connecte() && CPT.statut === "dedans") sortir(); });
  /* Revenu d'un lien de réinitialisation : on ne charge PAS le compte, on
     s'arrête sur le champ du nouveau mot de passe. Charger d'abord ferait
     entrer dans l'application quelqu'un qui vient justement de dire qu'il ne
     sait plus entrer. */
  if(enRecuperation()){ etat("recup"); return; }
  if(connecte()) chargerCompte();
}

export async function chargerCompte(){
  etat("charge");
  try{
    var u = moi();
    /* Le retour du lien pose le jeton avant que l'identité soit connue : on
       attend qu'elle arrive plutôt que de deviner. */
    for(var i = 0; !u && i < 30; i++){
      await new Promise(function(r){ setTimeout(r, 100); });
      u = moi();
    }
    if(!u){ etat("hors", "identité introuvable"); return; }
    CPT.profil = await assurerProfil(u);
    var e = await assurerEquipe(CPT.profil);
    CPT.equipe = e.equipe;
    await rafraichirMembres();
    etat("dedans");
  }catch(err){ etat("panne", err.message); }
}
