/* ============================================================================
   LE CLIENT — `fetch` et rien d'autre.

   Le projet n'a AUCUNE dépendance et AUCUN build ; ce n'est pas un détail de
   confort, c'est ce qui permet de servir le dossier tel quel. Tirer la
   bibliothèque officielle par un CDN aurait ajouté un tiers au chemin critique
   d'une application qu'on ouvre pour regarder un plan. Ce qu'il nous faut d'un
   serveur Supabase tient en deux protocoles — un jeton, et du REST sur des
   tables —, et les deux se parlent en `fetch`.

   Ce module NE SAIT RIEN du projet : ni variantes, ni équipes. Il ouvre une
   session et passe des requêtes. Le sens est au-dessus, dans `net/compte.js`
   et `net/variantes.js`.
   ========================================================================= */
import { SUPA } from "../data/supabase.js";

var SKEY = "saxon.session";     /* le jeton, sur cet appareil */
var RKEY = "saxon.retour";      /* où l'on était avant d'aller chercher son courriel */
var sess = null, abonnes = [];

export function supaOn(){ return !!(SUPA.url && SUPA.key); }
export function session(){ return sess; }
export function connecte(){ return !!(sess && sess.user); }
export function moi(){ return sess ? sess.user : null; }

/* Un seul canal : tout ce qui regarde la connexion s'y abonne, et personne
   n'interroge le stockage à la main. */
export function onAuth(fn){ abonnes.push(fn); return function(){ abonnes = abonnes.filter(function(f){ return f !== fn; }); }; }
function signale(){ abonnes.forEach(function(f){ try{ f(sess); }catch(_){} }); }

function lire(){
  try{ return JSON.parse(localStorage.getItem(SKEY) || "null"); }catch(_){ return null; }
}
function ecrire(s){
  sess = s;
  try{
    if(s) localStorage.setItem(SKEY, JSON.stringify(s));
    else localStorage.removeItem(SKEY);
  }catch(_){ /* navigation privée : la session ne survivra pas, tant pis */ }
  signale();
}

function entetes(avecJeton){
  var h = { apikey: SUPA.key, "Content-Type": "application/json" };
  if(avecJeton && sess && sess.access_token) h.Authorization = "Bearer " + sess.access_token;
  return h;
}

async function auth(chemin, corps, avecJeton){
  var r = await fetch(SUPA.url + "/auth/v1/" + chemin, {
    method: "POST", headers: entetes(avecJeton),
    body: corps ? JSON.stringify(corps) : undefined
  });
  var t = await r.text();
  var o = t ? JSON.parse(t) : {};
  if(!r.ok) throw new Error(o.error_description || o.msg || o.message || ("erreur " + r.status));
  return o;
}

function pose(o){
  ecrire({
    access_token: o.access_token,
    refresh_token: o.refresh_token,
    /* On garde l'échéance en clair : relire le jeton pour l'apprendre
       demanderait de le décoder, et il n'a pas à être décodé ici. */
    expire: Date.now() + ((o.expires_in || 3600) * 1000),
    user: o.user ? { id:o.user.id, email:o.user.email } : (sess && sess.user)
  });
}

/* ---------- le lien par courriel ----------
   On mémorise l'endroit où l'on était : le lien revient sur la page nue, et
   retomber sur la couverture après avoir cliqué dans sa boîte est une petite
   punition pour s'être connecté. */
export async function envoyerLien(email){
  try{ localStorage.setItem(RKEY, location.hash || ""); }catch(_){}
  var retour = location.origin + location.pathname;
  await auth("otp?redirect_to=" + encodeURIComponent(retour), { email: email, create_user: true });
}

/* Le retour du lien arrive DANS LE FRAGMENT — et le fragment, ici, porte la
   vue. On le consomme et on rend la main à la route : sans cela l'application
   démarrerait sur `#access_token=…`, qui n'est l'onglet de personne. */
export function consommeRetour(){
  var h = location.hash || "";
  if(h.indexOf("access_token=") < 0) return false;
  var q = new URLSearchParams(h.replace(/^#/, ""));
  var at = q.get("access_token");
  if(!at) return false;
  ecrire({
    access_token: at,
    refresh_token: q.get("refresh_token"),
    expire: Date.now() + ((parseInt(q.get("expires_in"), 10) || 3600) * 1000),
    user: null                      /* `rafraichirMoi()` ira le chercher */
  });
  var route = "";
  try{ route = localStorage.getItem(RKEY) || ""; localStorage.removeItem(RKEY); }catch(_){}
  history.replaceState(null, "", location.pathname + location.search + route);
  return true;
}

export async function rafraichirMoi(){
  if(!sess || !sess.access_token) return null;
  var r = await fetch(SUPA.url + "/auth/v1/user", { headers: entetes(true) });
  if(!r.ok) return null;
  var u = await r.json();
  ecrire(Object.assign({}, sess, { user: { id:u.id, email:u.email } }));
  return sess.user;
}

export async function deconnecter(){
  try{ if(sess) await auth("logout", null, true); }catch(_){}
  ecrire(null);
}

/* Un jeton dure une heure. On le renouvelle AVANT qu'il expire plutôt que de
   réparer un 401 : une requête qui échoue en cours de route laisserait une
   moitié d'écriture. */
var enCours = null;
async function jetonValide(){
  if(!sess) return false;
  if(Date.now() < sess.expire - 60000) return true;
  if(!sess.refresh_token){ ecrire(null); return false; }
  if(!enCours){
    enCours = auth("token?grant_type=refresh_token", { refresh_token: sess.refresh_token })
      .then(function(o){ pose(o); return true; })
      .catch(function(){ ecrire(null); return false; })
      .then(function(v){ enCours = null; return v; });
  }
  return enCours;
}

/* ---------- les tables ----------
   `Prefer: return=representation` partout où l'on écrit : on veut la ligne
   telle que la base l'a acceptée, pas celle qu'on croit avoir envoyée. */
export async function api(chemin, opts){
  var o = opts || {};
  if(!supaOn()) throw new Error("base non configurée");
  if(!(await jetonValide())) throw new Error("session expirée");
  var h = entetes(true);
  if(o.prefer) h.Prefer = o.prefer;
  var r = await fetch(SUPA.url + "/rest/v1/" + chemin, {
    method: o.method || "GET", headers: h,
    body: o.body === undefined ? undefined : JSON.stringify(o.body)
  });
  var t = await r.text();
  var d = t ? JSON.parse(t) : null;
  if(!r.ok) throw new Error((d && (d.message || d.hint)) || ("erreur " + r.status));
  return d;
}
export function selectApi(table, q){ return api(table + "?" + q); }
export function insertApi(table, row){
  return api(table, { method:"POST", body:row, prefer:"return=representation" });
}
export function upsertApi(table, row){
  return api(table, { method:"POST", body:row,
                      prefer:"return=representation,resolution=merge-duplicates" });
}
export function patchApi(table, q, row){
  return api(table + "?" + q, { method:"PATCH", body:row, prefer:"return=representation" });
}
export function deleteApi(table, q){ return api(table + "?" + q, { method:"DELETE" }); }

/* Au démarrage : on consomme d'abord un éventuel retour de lien, PUIS on relit
   la session. L'ordre compte — l'inverse écraserait le jeton tout neuf. */
export function initSupa(){
  sess = null;
  if(!supaOn()) return false;
  var neuf = consommeRetour();
  if(!neuf) sess = lire();
  if(sess && !sess.user) rafraichirMoi();
  return !!sess;
}
