/* ============================================================================
   LE COMPTE ET SES GROUPES

   Une identité, des groupes, et UN groupe actif à la fois. Ce module ne sait
   pas ce qu'est une variante : il dit qui l'on est et où l'on travaille.

   Le groupe est le PÉRIMÈTRE DE PARTAGE. On peut en avoir plusieurs — un par
   concours —, et tout ce qui s'enregistre appartient à celui qui est actif.
   Qui arrive sans invitation reçoit le sien, vide : il ne voit rien de
   personne, et personne ne le voit. C'est la règle de lecture de la base qui
   le garantit, pas cette page.
   ========================================================================= */
import { SUPA } from "../data/supabase.js";
import { api, changerMotDePasse, connecte, connexionMdp, deconnecter,
         enRecuperation, finRecuperation, initSupa, inscription, insertApi,
         moi, onAuth, oubli, patchApi, deleteApi, selectApi, supaOn,
         upsertApi } from "./supa.js";

var EKEY = "saxon.equipe";     /* le groupe actif, sur cet appareil */

/* `hors` pas de base ou pas connecté · `charge` en cours · `dedans` on a un
   groupe · `verif` compte créé, adresse à confirmer · `recup` on revient d'un
   lien de réinitialisation · `panne` la base a dit non */
export var CPT = {
  statut: "hors", profil: null,
  equipes: [],        /* [{ equipe, role }] — tous ceux dont on est membre */
  equipe: null,       /* l'actif : c'est lui que les variantes regardent */
  role: "member",
  membres: [],        /* du groupe actif */
  invites: [],        /* invitations ÉMISES par le groupe actif */
  invitations: [],    /* invitations REÇUES, sur des groupes qu'on n'a pas */
  err: ""
};

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
   n'aurait sinon jamais de profil, donc jamais de groupe — et l'application
   resterait bloquée sur « chargement » sans dire pourquoi. */
async function assurerProfil(u){
  var l = await selectApi("profile", "id=eq." + u.id + "&select=id,name,email");
  if(l && l.length) return l[0];
  var r = await upsertApi("profile", { id:u.id, email:u.email, name:prenomDe(u.email) });
  return (r && r[0]) || { id:u.id, email:u.email, name:prenomDe(u.email) };
}

async function lireEquipes(profil){
  var l = await selectApi("membership",
    "profile_id=eq." + profil.id + "&select=role,team:team_id(id,name,owner_id)&order=joined_at.asc");
  return (l || []).filter(function(x){ return x.team; })
                  .map(function(x){ return { equipe:x.team, role:x.role }; });
}

/* Les invitations qui me sont adressées et que je n'ai pas encore acceptées.
   La règle de lecture les laisse voir à qui porte l'adresse — sans quoi
   « Rejoindre » n'aurait rien à afficher. */
async function lireInvitations(){
  var l = await selectApi("invite",
    "select=id,email,team:team_id(id,name,owner_id)&order=created_at.asc");
  var miennes = {};
  CPT.equipes.forEach(function(e){ miennes[e.equipe.id] = 1; });
  return (l || []).filter(function(i){ return i.team && !miennes[i.team.id]; });
}

async function creerEquipePour(profil, nom){
  var t = await insertApi("team", { name: nom || SUPA.equipeDefaut, owner_id: profil.id });
  var eq = t[0];
  await insertApi("membership", { team_id:eq.id, profile_id:profil.id, role:"owner" });
  /* La ligne de réglages naît avec le groupe : sans elle, le premier partage
     d'une part de circulation devrait deviner s'il insère ou met à jour. */
  await insertApi("team_settings", { team_id:eq.id, updated_by:profil.id });
  return { equipe:eq, role:"owner" };
}

function equipeRetenue(){
  try{ return localStorage.getItem(EKEY) || ""; }catch(_){ return ""; }
}
function retenirEquipe(id){
  try{ if(id) localStorage.setItem(EKEY, id); else localStorage.removeItem(EKEY); }catch(_){}
}

function poserActive(id){
  var choisi = null;
  CPT.equipes.forEach(function(e){ if(e.equipe.id === id) choisi = e; });
  if(!choisi) choisi = CPT.equipes[0] || null;
  CPT.equipe = choisi ? choisi.equipe : null;
  CPT.role = choisi ? choisi.role : "member";
  retenirEquipe(CPT.equipe ? CPT.equipe.id : "");
}

/* Les onglets de groupe montrent qui est dedans : il faut donc les membres de
   TOUS les groupes, pas seulement de l'actif. Une requête, et non une par
   onglet — sinon changer de groupe en coûterait autant qu'on en a. */
export var MEMBRES_PAR_EQUIPE = {};
async function lireTousMembres(){
  MEMBRES_PAR_EQUIPE = {};
  if(!CPT.equipes.length) return;
  var ids = CPT.equipes.map(function(e){ return e.equipe.id; }).join(",");
  var l = await selectApi("membership",
    "team_id=in.(" + ids + ")&select=team_id,profil:profile_id(id,name,email)&order=joined_at.asc");
  (l || []).forEach(function(x){
    if(!x.profil) return;
    (MEMBRES_PAR_EQUIPE[x.team_id] = MEMBRES_PAR_EQUIPE[x.team_id] || []).push(x.profil);
  });
}

export async function rafraichirMembres(){
  if(!CPT.equipe){ CPT.membres = []; CPT.invites = []; signale(); return; }
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
export function estProprietaire(eq){
  var e = eq || CPT.equipe;
  return !!(e && CPT.profil && e.owner_id === CPT.profil.id);
}

/* ---------- entrer ---------- */
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
export async function poserMotDePasse(mdp){
  etat("charge");
  try{ await changerMotDePasse(mdp); finRecuperation(); await chargerCompte(); }
  catch(e){ etat("recup", e.message); }
}
/* Changer son mot de passe alors qu'on est déjà entré : on ne sort pas, on ne
   recharge rien — seul le mot de passe change. */
export async function majMotDePasse(mdp){
  await changerMotDePasse(mdp);
}

/* L'état tombe AVANT de couper la session : `deconnecter()` prévient ses
   abonnés, dont le gardien du démarrage, qui aurait rappelé `sortir()` tant
   que le statut disait encore « dedans » — une récursion sans fond. */
export async function sortir(){
  CPT.profil = null; CPT.equipe = null; CPT.equipes = [];
  CPT.membres = []; CPT.invites = []; CPT.invitations = [];
  retenirEquipe("");
  etat("hors");
  await deconnecter();
}

/* ---------- les groupes ---------- */
export async function choisirEquipe(id){
  if(CPT.equipe && CPT.equipe.id === id) return;
  poserActive(id);
  await rafraichirMembres();
  etat("dedans");
}

export async function creerEquipe(nom){
  var e = await creerEquipePour(CPT.profil, nom);
  CPT.equipes.push(e);
  poserActive(e.equipe.id);
  await lireTousMembres();
  await rafraichirMembres();
  etat("dedans");
}

export async function renommerEquipe(nom, eq){
  var e = eq || CPT.equipe;
  if(!e) return;
  var r = await patchApi("team", "id=eq." + e.id, { name:nom });
  if(r && r[0]){
    CPT.equipes.forEach(function(x){ if(x.equipe.id === e.id) x.equipe = r[0]; });
    if(CPT.equipe && CPT.equipe.id === e.id) CPT.equipe = r[0];
  }
  signale();
}

/* Transmettre touche trois lignes — l'équipe et deux rôles — et l'ordre décide
   de tout : dès que `owner_id` a changé, l'ancien propriétaire n'a plus le
   droit de toucher aux rôles, et sa mise à jour ne touche aucune ligne SANS
   RIEN DIRE. Un seul appel, côté base, qui porte son propre contrôle. */
export async function transfererPropriete(versId, eq){
  var e = eq || CPT.equipe;
  if(!e) return;
  await api("rpc/transferer_propriete", { method:"POST", body:{ equipe:e.id, vers:versId } });
  await chargerCompte();
}

export async function quitterEquipe(id){
  await deleteApi("membership", "team_id=eq." + id + "&profile_id=eq." + CPT.profil.id);
  CPT.equipes = CPT.equipes.filter(function(x){ return x.equipe.id !== id; });
  if(CPT.equipe && CPT.equipe.id === id) poserActive("");
  if(!CPT.equipes.length) await creerEquipe(SUPA.equipeDefaut);
  else { await lireTousMembres(); await rafraichirMembres(); etat("dedans"); }
}

export async function rejoindre(inv){
  await insertApi("membership", { team_id:inv.team.id, profile_id:CPT.profil.id, role:"member" });
  await deleteApi("invite", "id=eq." + inv.id);
  await chargerCompte(inv.team.id);
}
export async function refuserInvitation(inv){
  await deleteApi("invite", "id=eq." + inv.id);
  CPT.invitations = CPT.invitations.filter(function(i){ return i.id !== inv.id; });
  signale();
}

/* ---------- inviter ---------- */
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

/* ---------- le démarrage ----------
   `initSupa()` est SYNCHRONE et doit passer avant la lecture de la route : le
   lien de réinitialisation revient dans le fragment, et le fragment porte la
   vue. */
export function initCompte(){
  if(!supaOn()){ etat("hors"); return; }
  initSupa();
  onAuth(function(){ if(!connecte() && CPT.statut === "dedans") sortir(); });
  /* Revenu d'un lien de réinitialisation : on ne charge PAS le compte, on
     s'arrête sur le champ du nouveau mot de passe. Charger d'abord ferait
     entrer quelqu'un qui vient justement de dire qu'il ne sait plus entrer. */
  if(enRecuperation()){ etat("recup"); return; }
  if(connecte()) chargerCompte();
}

export async function chargerCompte(veut){
  etat("charge");
  try{
    var u = moi();
    /* Le jeton arrive avant l'identité : on attend qu'elle vienne plutôt que
       de deviner. */
    for(var i = 0; !u && i < 30; i++){
      await new Promise(function(r){ setTimeout(r, 100); });
      u = moi();
    }
    if(!u){ etat("hors", "identité introuvable"); return; }
    CPT.profil = await assurerProfil(u);
    CPT.equipes = await lireEquipes(CPT.profil);
    if(!CPT.equipes.length) CPT.equipes = [await creerEquipePour(CPT.profil, SUPA.equipeDefaut)];
    poserActive(veut || equipeRetenue());
    await lireTousMembres();
    CPT.invitations = await lireInvitations();
    await rafraichirMembres();
    etat("dedans");
  }catch(err){ etat("panne", err.message); }
}
