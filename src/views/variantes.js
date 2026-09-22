/* ============================================================================
   LE PANNEAU DES VARIANTES, ET LE PROFIL

   Le panneau n'est PAS un onglet. Les onglets sont la chronologie du concours
   — cahier des charges, mixer, massing — et une variante ne s'y range nulle
   part : elle les traverse tous les trois. Elle vit donc à côté du compte,
   dans un panneau posé par-dessus ce qu'on faisait, et qu'on referme pour se
   retrouver exactement où l'on était.

   DEUX NIVEAUX, et c'est tout le dessin :

   — la CARTE porte ce qu'il faut pour RECONNAÎTRE une variante et la CHARGER.
     Miniature carrée, nom, note, deux boutons, et le reste en petit.
   — le MODAL porte tout le reste — la note critère par critère, les graines,
     les surfaces, les contrôles — et le seul geste qui détruit, « Supprimer »,
     qui n'a rien à faire sur une carte de liste.

   Le PROFIL est ailleurs, sur son propre badge : les groupes dont on fait
   partie, le mot de passe, la sortie. Ce ne sont pas des variantes, et les
   mettre dans le même panneau aurait mêlé « où je travaille » et « ce que
   j'ai fait ».
   ========================================================================= */
import { el, fmt } from "../core/format.js";
import { perime } from "../core/empreinte.js";
import { SITE } from "../data/site.js";
import { snapshot } from "../mix/store.js";
import { CPT, MEMBRES_PAR_EQUIPE, annulerInvite, choisirEquipe, connexion,
         creerCompte, creerEquipe, estProprietaire, initialesDe, inviter,
         majMotDePasse, membreDe, motDePasseOublie, onCompte, poserMotDePasse,
         quitterEquipe, refuserInvitation, rejoindre, renommerEquipe, retirer,
         sortir, transfererPropriete } from "../net/compte.js";
import { REG, tirerReglages } from "../net/reglages.js";
import { VARIANTES, charger, chargerVariantes, enregistrer, nomPropose,
         onVariantes, renommer, supprimer } from "../net/variantes.js";
import { supaOn } from "../net/supa.js";

var SVGNS = "http://www.w3.org/2000/svg";
var panneau = null, modal = null, ouvert = false;
var apresCharge = null;          /* rendu à refaire quand on a chargé */
var reference = null;            /* l'état au dernier enregistrement ou chargement */
var occupe = false, message = "";
var vueEquipe = null;            /* le groupe dont la liste est à l'écran */

export function setApresCharge(fn){ apresCharge = fn; }

/* ---------- petites choses ---------- */
function sv(tag, attrs){
  var e = document.createElementNS(SVGNS, tag), k;
  for(k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function btn(cls, txt, fn){
  var b = el("button", cls, txt);
  b.type = "button";
  if(fn) b.addEventListener("click", fn);
  return b;
}
var MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function relatif(s){
  if(s < 90) return "à l'instant";
  if(s < 5400) return "il y a " + Math.round(s / 60) + " min";
  if(s < 172800) return "il y a " + Math.round(s / 3600) + " h";
  return "il y a " + Math.round(s / 86400) + " j";
}
/* La date ET le temps écoulé : l'une situe dans le projet, l'autre dans la
   journée, et l'on veut les deux tant que c'est frais. */
function quand(iso){
  if(!iso) return "";
  var d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  var court = d.getDate() + " " + MOIS[d.getMonth()];
  return s < 604800 ? court + " · " + relatif(s) : court;
}
function nomDe(id){
  var p = membreDe(id);
  if(p) return p.name || p.email;
  return CPT.profil && CPT.profil.id === id ? (CPT.profil.name || "vous") : "quelqu'un";
}
function pastille(p, cls){
  var d = el("span", "vp-av" + (cls ? " " + cls : ""), p ? initialesDe(p) : "?");
  if(p && CPT.profil && p.id === CPT.profil.id) d.classList.add("is-moi");
  if(p) d.title = p.name || p.email;
  return d;
}
function pastilleDe(id, cls){
  var p = membreDe(id) || (CPT.profil && CPT.profil.id === id ? CPT.profil : null);
  return pastille(p, cls);
}

/* Un mot de passe qu'on ne peut pas relire se retape trois fois. L'œil est un
   VRAI bouton, pas une icône posée sur un div : au clavier il faut pouvoir
   l'atteindre. */
function champMdp(id, auto, lab){
  var w = el("span", "vp-mdp");
  var i = el("input");
  i.id = id; i.type = "password"; i.required = true;
  i.autocomplete = auto; i.minLength = 6;
  if(lab) i.placeholder = lab;
  var b = btn("vp-mdp__oeil", "Afficher", function(){
    var vu = i.type === "password";
    i.type = vu ? "text" : "password";
    b.textContent = vu ? "Masquer" : "Afficher";
  });
  w.appendChild(i); w.appendChild(b);
  w.champ = i;
  return w;
}
function champ(id, type, ph, auto){
  var i = el("input");
  i.id = id; i.type = type; i.required = true;
  if(ph) i.placeholder = ph;
  if(auto) i.autocomplete = auto;
  return i;
}

/* ---------- la miniature ----------
   Le périmètre vient du relevé D'AUJOURD'HUI, les corps de la variante : si le
   terrain a changé, on le voit tout de suite, et c'est justement ce qu'une
   variante périmée doit montrer. */
var CADRE = (function(){
  var xs = SITE.per.map(function(p){ return p[0]; });
  var ys = SITE.per.map(function(p){ return p[1]; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  return { x0:x0 - 6, y0:y0 - 6, w:(x1 - x0) + 12, h:(y1 - y0) + 12, y1:y1 + 6 };
})();

function vignette(thumb){
  var s = sv("svg", { viewBox: CADRE.x0 + " " + CADRE.y0 + " " + CADRE.w + " " + CADRE.h,
                      class:"vp-vig", "aria-hidden":"true", preserveAspectRatio:"xMidYMid meet" });
  var g = sv("g", { transform:"translate(0," + (CADRE.y0 + CADRE.y1) + ") scale(1,-1)" });
  g.appendChild(sv("polygon", {
    points: SITE.per.map(function(p){ return p[0] + "," + p[1]; }).join(" "), class:"vp-per" }));
  ((thumb && thumb.vol) || []).forEach(function(v){
    g.appendChild(sv("polygon", {
      points: v.p.map(function(p){ return p[0] + "," + p[1]; }).join(" "),
      class: v.s ? "vp-corps is-sport" : "vp-corps" }));
  });
  s.appendChild(g);
  return s;
}

/* ---------- le travail non enregistré ----------
   Charger écrase ce qui est à l'écran. On ne le fait pas sans le dire — mais
   on ne le dit que si c'est vrai : un avertissement permanent ne serait plus
   lu par personne. */
function sig(){ try{ return JSON.stringify(snapshot()); }catch(_){ return ""; } }
export function marqueReference(){ reference = sig(); }
function travailEnCours(){ return reference !== null && reference !== sig(); }

/* ---------- la charpente ---------- */
function bati(){
  if(panneau) return;
  panneau = el("aside", "vp");
  panneau.id = "vpanel";
  panneau.hidden = true;
  panneau.setAttribute("aria-label", "Variantes");

  var h = el("header", "vp__head");
  h.appendChild(el("h2", null, "Variantes"));
  h.appendChild(el("span", "vp__cnt"));
  var x = btn("btn btn--icon vp__x", "✕", fermer);
  x.setAttribute("aria-label", "Fermer le panneau");
  h.appendChild(x);
  panneau.appendChild(h);
  panneau.appendChild(el("div", "vp__body"));
  document.body.appendChild(panneau);
  caler();
  window.addEventListener("resize", caler);

  modal = el("div", "vm");
  modal.hidden = true;
  var voile = el("div", "vm__voile");
  voile.addEventListener("click", fermerModal);
  modal.appendChild(voile);
  var box = el("div", "vm__box");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  modal.appendChild(box);
  document.body.appendChild(modal);

  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(!modal.hidden) fermerModal();
    else if(ouvert) fermer();
  });
}

/* La barre d'application s'enroule sur un portable : sa hauteur se mesure,
   elle ne se déclare pas. C'est une géométrie, pas une valeur de dessin. */
function caler(){
  if(!panneau) return;
  var bar = document.querySelector(".appbar");
  panneau.style.insetBlockStart = (bar ? Math.round(bar.getBoundingClientRect().height) : 0) + "px";
}

export function ouvrir(){
  bati(); caler();
  ouvert = true;
  panneau.hidden = false;
  majBoutons();
  peindre();
  if(CPT.statut === "dedans" && !VARIANTES.length) rafraichir();
}
export function fermer(){
  if(!panneau) return;
  ouvert = false;
  panneau.hidden = true;
  majBoutons();
}
export function basculer(){ if(ouvert) fermer(); else ouvrir(); }

function majBoutons(){
  var b = document.getElementById("varBtn");
  if(b){
    b.setAttribute("aria-expanded", String(ouvert));
    b.classList.toggle("is-on", ouvert);
    var c = b.querySelector(".vb-cnt");
    if(c){
      c.textContent = VARIANTES.length ? String(VARIANTES.length) : "";
      c.hidden = !VARIANTES.length;
    }
  }
  var p = document.getElementById("profBtn");
  if(p){
    while(p.firstChild) p.removeChild(p.firstChild);
    if(CPT.profil){
      p.appendChild(pastille(CPT.profil));
      p.title = (CPT.profil.name || CPT.profil.email) +
                (CPT.equipe ? " · " + CPT.equipe.name : "");
      p.setAttribute("aria-label", "Profil de " + (CPT.profil.name || CPT.profil.email));
    } else {
      var s = sv("svg", { width:"16", height:"16", viewBox:"0 0 24 24", fill:"none",
                          stroke:"currentColor", "stroke-width":"1.9", "aria-hidden":"true" });
      s.appendChild(sv("path", { d:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }));
      s.appendChild(sv("circle", { cx:"12", cy:"7", r:"4" }));
      p.appendChild(s);
      p.title = "Se connecter";
      p.setAttribute("aria-label", "Se connecter");
    }
    if(CPT.invitations.length) p.classList.add("is-invite");
    else p.classList.remove("is-invite");
  }
}

async function rafraichir(){
  try{ await chargerVariantes(); vueEquipe = CPT.equipe ? CPT.equipe.id : null; }
  catch(e){ message = e.message; peindre(); }
}
function dit(txt){ message = txt || ""; peindre(); }

/* ---------- entrer ---------- */
function blocAuth(){
  var d = el("div", "vp-compte");
  if(!supaOn()){
    d.appendChild(el("p", "vp-note", "La base n'est pas configurée : les variantes restent sur cet appareil."));
    return d;
  }
  if(CPT.statut === "charge"){ d.appendChild(el("p", "vp-note", "Un instant…")); return d; }
  if(CPT.statut === "panne"){
    d.appendChild(el("p", "vp-note is-bad", "La base a répondu : " + CPT.err));
    return d;
  }
  if(CPT.statut === "verif"){
    d.appendChild(el("p", "vp-note", "Compte créé. Ouvre le lien reçu par courriel pour confirmer l'adresse, puis reviens te connecter."));
    return d;
  }
  if(CPT.statut === "recup"){
    var fr = el("form", "vp-conn");
    fr.appendChild(el("h3", "vp-conn__t", "Choisis un nouveau mot de passe"));
    var lr = el("label", null, "Nouveau mot de passe"); lr.htmlFor = "vpNeuf";
    var ir = champMdp("vpNeuf", "new-password");
    var br = btn("btn btn--primary", "Enregistrer"); br.type = "submit";
    fr.appendChild(lr);
    var rr = el("div", "vp-conn__row"); rr.appendChild(ir); rr.appendChild(br);
    fr.appendChild(rr);
    if(CPT.err) fr.appendChild(el("p", "vp-note is-bad", CPT.err));
    fr.addEventListener("submit", function(e){ e.preventDefault(); poserMotDePasse(ir.champ.value); });
    d.appendChild(fr);
    return d;
  }

  /* Les MÊMES champs pour entrer et pour s'inscrire, et deux boutons : ce sont
     deux réponses à la même question, et faire choisir avant d'avoir tapé quoi
     que ce soit n'aide personne. */
  var f = el("form", "vp-conn");
  f.appendChild(el("h3", "vp-conn__t", "Se connecter pour partager"));
  var lm = el("label", null, "Adresse de courriel"); lm.htmlFor = "vpMail";
  var im = champ("vpMail", "email", "prenom.nom@exemple.ch", "email");
  f.appendChild(lm); f.appendChild(im);
  var lp = el("label", null, "Mot de passe"); lp.htmlFor = "vpMdp";
  var ip = champMdp("vpMdp", "current-password");
  f.appendChild(lp); f.appendChild(ip);

  var ligne = el("div", "vp-conn__row");
  var go = btn("btn btn--primary", "Se connecter"); go.type = "submit";
  ligne.appendChild(go);
  ligne.appendChild(btn("btn", "Créer un compte", function(){
    if(!f.reportValidity()) return;
    creerCompte(im.value, ip.champ.value);
  }));
  f.appendChild(ligne);
  var bas = el("div", "vp-conn__bas");
  bas.appendChild(btn("vp-lien", "Mot de passe oublié ?", function(){
    if(!im.value){ im.focus(); dit("Tape d'abord ton adresse."); return; }
    motDePasseOublie(im.value);
  }));
  f.appendChild(bas);
  f.appendChild(el("p", "vp-note", "Sans compte, le travail reste enregistré sur cet appareil, comme aujourd'hui."));
  if(CPT.err) f.appendChild(el("p", "vp-note is-bad", CPT.err));
  f.addEventListener("submit", function(e){ e.preventDefault(); connexion(im.value, ip.champ.value); });
  d.appendChild(f);
  return d;
}

/* ---------- les onglets de groupe ----------
   Un onglet par groupe, avec les pastilles de qui est dedans. Ils ne
   s'affichent qu'à partir de deux : un seul onglet n'est pas un choix, c'est
   un titre, et le nom du groupe est déjà en tête du panneau. */
function ongletsGroupes(){
  if(CPT.equipes.length < 2) return null;
  var nav = el("nav", "vg");
  nav.setAttribute("aria-label", "Groupes");
  CPT.equipes.forEach(function(e){
    var on = CPT.equipe && e.equipe.id === CPT.equipe.id;
    var b = btn("vg__t" + (on ? " is-on" : ""), null, function(){ allerGroupe(e.equipe.id); });
    b.setAttribute("aria-current", String(on));
    b.appendChild(el("span", "vg__n", e.equipe.name));
    var av = el("span", "vg__av");
    (MEMBRES_PAR_EQUIPE[e.equipe.id] || []).slice(0, 3).forEach(function(p){
      av.appendChild(pastille(p, "vp-av--mini"));
    });
    b.appendChild(av);
    nav.appendChild(b);
  });
  return nav;
}

async function allerGroupe(id){
  occupe = true; peindre();
  try{
    await choisirEquipe(id);
    await rafraichir();
    await tirerReglages();
    if(apresCharge) apresCharge();
    message = "";
  }catch(e){ message = e.message; }
  occupe = false; peindre();
}

/* ---------- une carte ----------
   Miniature CARRÉE à gauche, le nom et la note en grand, les deux gestes,
   et le reste en petit dessous. La carte d'avant était haute comme une
   affiche : trois variantes remplissaient le panneau, et comparer demandait
   de faire défiler. */
function carte(v){
  var c = el("article", "vc");
  var vieux = perime(v.fingerprint);
  if(vieux.length) c.classList.add("is-perime");

  var cadre = el("div", "vc__vig");
  cadre.appendChild(vignette(v.thumbnail));
  if(vieux.length){
    var m = el("span", "vc__perime", "!");
    m.title = "Périmée — " + vieux.join(", ") + " depuis l'enregistrement";
    cadre.appendChild(m);
  }
  c.appendChild(cadre);

  var d = el("div", "vc__d");

  var t = el("div", "vc__t");
  t.appendChild(el("h3", "vc__nom", v.name));
  var note = el("b", "vc__note mono", v.score == null ? "—" : (v.score > 0 ? "+" : "") + v.score);
  if(v.score != null) note.classList.add(v.score >= 0 ? "is-haut" : "is-bas");
  t.appendChild(note);
  d.appendChild(t);

  var a = el("div", "vc__a");
  a.appendChild(btn("btn btn--primary vc__load", vieux.length ? "Charger quand même" : "Charger",
    function(){ demandeCharge(v); }));
  a.appendChild(btn("btn vc__info", "Informations", function(){ ouvrirModal(v); }));
  d.appendChild(a);

  var meta = el("p", "vc__meta");
  meta.appendChild(pastilleDe(v.author_id, "vp-av--mini"));
  meta.appendChild(document.createTextNode(nomDe(v.author_id) + " · " + quand(v.created_at)));
  d.appendChild(meta);

  c.appendChild(d);
  return c;
}

/* ---------- peindre ---------- */
function peindre(){
  if(!panneau) return;
  var b = panneau.querySelector(".vp__body");
  while(b.firstChild) b.removeChild(b.firstChild);
  panneau.querySelector(".vp__cnt").textContent =
    CPT.equipe ? VARIANTES.length + " · " + CPT.equipe.name : "";

  if(CPT.statut !== "dedans"){
    b.appendChild(blocAuth());
    if(message) b.appendChild(el("p", "vp-note is-bad", message));
    majBoutons();
    return;
  }

  var ong = ongletsGroupes();
  if(ong) b.appendChild(ong);
  if(message) b.appendChild(el("p", "vp-note is-bad", message));
  if(REG.quand && REG.par && CPT.profil && REG.par !== CPT.profil.id){
    b.appendChild(el("p", "vp-note", "Réglages du groupe modifiés par " + nomDe(REG.par) + " " + quand(REG.quand) + "."));
  }

  var save = btn("vp-save", null, function(){ faireEnregistrer(); });
  save.appendChild(el("span", "vp-save__p", "+"));
  save.appendChild(el("span", null, occupe ? "Un instant…" : "Enregistrer la composition à l'écran"));
  save.disabled = occupe;
  b.appendChild(save);

  if(!VARIANTES.length){
    b.appendChild(el("p", "vp-note", "Aucune variante dans ce groupe. Compose au mixer et au massing, puis enregistre."));
  }
  var liste = el("div", "vp-liste");
  VARIANTES.forEach(function(v){ liste.appendChild(carte(v)); });
  b.appendChild(liste);
  majBoutons();
}

/* ---------- les gestes ---------- */
async function faireEnregistrer(){
  occupe = true; peindre();
  try{ await enregistrer(nomPropose()); marqueReference(); message = ""; }
  catch(e){ message = e.message; }
  occupe = false; peindre();
}

/* Charger écrase : on prévient, et on propose d'enregistrer d'abord. Un seul
   endroit décide — la carte ne charge jamais directement. */
function demandeCharge(v){
  if(!travailEnCours()){ faireCharger(v); return; }
  var d = el("div", "vp-alerte");
  d.appendChild(el("p", null, "La composition à l'écran n'est pas enregistrée. La charger la remplacera."));
  var r = el("div", "vp-alerte__a");
  r.appendChild(btn("btn btn--primary", "Enregistrer d'abord", async function(){
    await faireEnregistrer(); faireCharger(v);
  }));
  r.appendChild(btn("btn", "Charger quand même", function(){ faireCharger(v); }));
  r.appendChild(btn("btn", "Annuler", function(){ peindre(); }));
  d.appendChild(r);
  var b = panneau.querySelector(".vp__body");
  b.insertBefore(d, b.querySelector(".vp-liste"));
  d.scrollIntoView({ block:"nearest" });
}

async function faireCharger(v){
  occupe = true; message = "Chargement…"; peindre();
  try{
    var perdu = await charger(v.id);
    marqueReference();
    message = perdu.length ? "Repris, sauf : " + perdu.join(", ") : "";
    fermerModal();
    if(apresCharge) apresCharge();
  }catch(e){ message = e.message; }
  occupe = false; peindre();
}

/* ---------- les modaux ---------- */
function boite(etroite){
  bati();
  var box = modal.querySelector(".vm__box");
  while(box.firstChild) box.removeChild(box.firstChild);
  box.classList.toggle("vm__box--etroit", !!etroite);
  return box;
}
function teteModal(box, titreEl, sous, label){
  var head = el("header", "vm__head");
  var g = el("div", "vm__g");
  g.appendChild(titreEl);
  if(sous) g.appendChild(sous);
  head.appendChild(g);
  var x = btn("btn btn--icon", "✕", fermerModal);
  x.setAttribute("aria-label", "Fermer");
  head.appendChild(x);
  box.appendChild(head);
  box.setAttribute("aria-label", label);
  return head;
}
export function fermerModal(){ if(modal) modal.hidden = true; }
function montrer(){ modal.hidden = false; }

function ligne(k, v, cls){
  var d = el("div", "vm-r" + (cls ? " " + cls : ""));
  d.appendChild(el("span", null, k));
  d.appendChild(el("b", "mono", v));
  return d;
}
function critere(c, max){
  var d = el("div", "vm-c");
  d.appendChild(el("span", "vm-c__n", c.n));
  var t = el("span", "vm-c__t");
  var bar = el("span", "vm-c__b");
  var p = Math.min(1, Math.abs(c.pts) / (max || 1));
  bar.style.width = (p * 50) + "%";
  if(c.pts >= 0){ bar.style.left = "50%"; bar.classList.add("is-haut"); }
  else { bar.style.left = (50 - p * 50) + "%"; bar.classList.add("is-bas"); }
  t.appendChild(el("span", "vm-c__z"));
  t.appendChild(bar);
  d.appendChild(t);
  var v = el("b", "vm-c__v mono", (c.pts > 0 ? "+" : c.pts < 0 ? "−" : "") + Math.abs(Math.round(c.pts)));
  if(c.pts > 0) v.classList.add("is-haut");
  if(c.pts < 0) v.classList.add("is-bas");
  d.appendChild(v);
  return d;
}

export function ouvrirModal(v){
  var box = boite();
  var nom = el("input", "vm__nom");
  nom.type = "text"; nom.value = v.name;
  nom.setAttribute("aria-label", "Nom de la variante");
  nom.addEventListener("change", async function(){
    try{ await renommer(v.id, nom.value.trim() || v.name); peindre(); }
    catch(e){ dit(e.message); }
  });
  var meta = el("p", "vm__meta");
  meta.appendChild(pastilleDe(v.author_id));
  meta.appendChild(document.createTextNode(nomDe(v.author_id) + " · " + quand(v.created_at)));
  [v.parti, v.floors + " niveaux", v.bodies + " corps"].forEach(function(t){
    if(t) meta.appendChild(el("span", "vm__chip", t));
  });
  teteModal(box, nom, meta, "Informations de la variante");

  var vieux = perime(v.fingerprint);
  if(vieux.length){
    box.appendChild(el("p", "vm-perime",
      "Périmée : " + vieux.join(", ") + " — depuis l'enregistrement. Les chiffres ci-dessous sont ceux de ce moment-là."));
  }

  var body = el("div", "vm__body");

  var s1 = el("section", "vm-sec");
  var tete = el("div", "vm-note");
  var gros = el("b", "vm-note__n mono", v.score == null ? "—" : (v.score > 0 ? "+" : "") + v.score);
  if(v.score != null) gros.classList.add(v.score >= 0 ? "is-haut" : "is-bas");
  tete.appendChild(gros);
  tete.appendChild(el("p", null, "La somme des critères de la composition. Elle sert à trier, pas à juger."));
  s1.appendChild(tete);
  var crit = (v.criteria || []).slice();
  var max = crit.reduce(function(m, c){ return Math.max(m, Math.abs(c.pts)); }, 1);
  var nuls = crit.filter(function(c){ return Math.round(c.pts) === 0; });
  crit.filter(function(c){ return Math.round(c.pts) !== 0; })
      .sort(function(a, b){ return b.pts - a.pts; })
      .forEach(function(c){ s1.appendChild(critere(c, max)); });
  if(nuls.length){
    s1.appendChild(el("p", "vm-nuls", nuls.length + " critères sans effet — " +
      nuls.map(function(c){ return c.n.toLowerCase(); }).join(", ") + "."));
  }
  body.appendChild(s1);

  var s2 = el("section", "vm-sec");
  s2.appendChild(el("h4", null, "Ce qui rejoue la variante"));
  s2.appendChild(ligne("Graine du programme", (v.seed_program >>> 0).toString(36)));
  s2.appendChild(ligne("Graine du massing", (v.seed_massing >>> 0).toString(36)));
  s2.appendChild(ligne("Parti", v.parti || "—"));
  body.appendChild(s2);

  var s3 = el("section", "vm-sec");
  s3.appendChild(el("h4", null, "Les surfaces"));
  s3.appendChild(ligne("Demandé", fmt(v.area_required) + " m²"));
  s3.appendChild(ligne("Posé", fmt(v.area_placed) + " m²"));
  s3.appendChild(ligne("Bâti, circulation comprise", fmt(v.area_gross) + " m²"));
  var ec = (v.area_placed || 0) - (v.area_required || 0);
  s3.appendChild(ligne("Écart", (ec > 0 ? "+" : "") + fmt(ec) + " m²", ec === 0 ? "" : "is-ecart"));
  body.appendChild(s3);

  var s4 = el("section", "vm-sec");
  s4.appendChild(el("h4", null, "Les contrôles"));
  var vm = (v.verdict && v.verdict.mass) || {}, vx = (v.verdict && v.verdict.mix) || {};
  s4.appendChild(el("p", "vm-v" + (vm.e ? " is-err" : " is-ok"),
    vm.e ? vm.e + " erreur" + (vm.e > 1 ? "s" : "") + " au massing" : "Massing : aucune erreur"));
  if(vm.w) s4.appendChild(el("p", "vm-v is-warn", vm.w + " à vérifier, " + (vm.i || 0) + " informations"));
  if(vx.e) s4.appendChild(el("p", "vm-v is-err", vx.e + " erreur" + (vx.e > 1 ? "s" : "") + " au mixer"));
  if(vx.w) s4.appendChild(el("p", "vm-v is-warn", "Mixer : " + vx.w + " écart" + (vx.w > 1 ? "s" : "")));
  body.appendChild(s4);

  var s5 = el("section", "vm-sec vm-sec--plan");
  s5.appendChild(el("h4", null, "L'implantation"));
  var pl = el("div", "vm-plan");
  pl.appendChild(vignette(v.thumbnail));
  s5.appendChild(pl);
  body.appendChild(s5);
  box.appendChild(body);

  var pied = el("footer", "vm__pied");
  pied.appendChild(btn("btn btn--primary", "Charger cette variante", function(){ demandeCharge(v); fermerModal(); }));
  pied.appendChild(el("span", "vm__dit", "Remet le cahier des charges, le mixer et le massing dans cet état."));
  var sup = btn("btn vm__sup", "Supprimer", async function(){
    if(sup.dataset.sur !== "1"){
      sup.dataset.sur = "1";
      sup.textContent = "Confirmer la suppression";
      return;
    }
    try{ await supprimer(v.id); fermerModal(); peindre(); }
    catch(e){ dit(e.message); }
  });
  pied.appendChild(sup);
  box.appendChild(pied);
  montrer();
  nom.focus();
}

/* ---------- le profil ----------
   Où je suis, comment j'entre, comment je sors. Trois questions de compte, et
   aucune de projet : les variantes sont dans le panneau, à côté. */
export function ouvrirProfil(){
  if(CPT.statut !== "dedans"){
    ouvrir();
    var m = document.getElementById("vpMail");
    if(m) m.focus();
    return;
  }
  var box = boite(true);
  var t = el("h3", "vm__titre", CPT.profil.name || CPT.profil.email);
  var sous = el("p", "vm__meta");
  sous.appendChild(pastille(CPT.profil));
  sous.appendChild(el("span", "mono", CPT.profil.email));
  teteModal(box, t, sous, "Profil");

  var body = el("div", "vm__body vm__body--un");

  /* mes groupes */
  var g = el("section", "vm-sec");
  g.appendChild(el("h4", null, "Mes groupes"));
  CPT.equipes.forEach(function(e){
    var actif = CPT.equipe && e.equipe.id === CPT.equipe.id;
    var r = el("div", "vm-grp" + (actif ? " is-on" : ""));
    var n = el("div", "vm-grp__n");
    n.appendChild(el("b", null, e.equipe.name));
    var qui = el("span", "vm-grp__qui");
    (MEMBRES_PAR_EQUIPE[e.equipe.id] || []).forEach(function(p){
      qui.appendChild(pastille(p, "vp-av--mini"));
    });
    qui.appendChild(document.createTextNode(
      (e.role === "owner" ? "propriétaire" : "membre") + (actif ? " · à l'écran" : "")));
    n.appendChild(qui);
    r.appendChild(n);
    if(!actif){
      r.appendChild(btn("btn", "Ouvrir", function(){ fermerModal(); allerGroupe(e.equipe.id); }));
    }
    r.appendChild(btn("btn", "Gérer", function(){ ouvrirGroupe(e.equipe); }));
    g.appendChild(r);
  });
  var neuf = el("form", "vm-ligne");
  var inom = champ("vpGrpNeuf", "text", "Nom du nouveau groupe");
  var iok = btn("btn", "Créer un groupe"); iok.type = "submit";
  neuf.appendChild(inom); neuf.appendChild(iok);
  neuf.addEventListener("submit", async function(ev){
    ev.preventDefault();
    try{ await creerEquipe(inom.value.trim()); fermerModal(); await rafraichir(); peindre(); }
    catch(err){ dit(err.message); }
  });
  g.appendChild(neuf);
  body.appendChild(g);

  /* invitations reçues */
  if(CPT.invitations.length){
    var i = el("section", "vm-sec");
    i.appendChild(el("h4", null, "On t'invite"));
    CPT.invitations.forEach(function(inv){
      var r = el("div", "vm-grp");
      var n = el("div", "vm-grp__n");
      n.appendChild(el("b", null, inv.team.name));
      n.appendChild(el("span", "vm-grp__qui", "invitation en attente"));
      r.appendChild(n);
      r.appendChild(btn("btn btn--primary", "Rejoindre", async function(){
        try{ await rejoindre(inv); fermerModal(); await rafraichir(); peindre(); }
        catch(err){ dit(err.message); }
      }));
      r.appendChild(btn("btn", "Refuser", async function(){
        try{ await refuserInvitation(inv); ouvrirProfil(); }catch(err){ dit(err.message); }
      }));
      i.appendChild(r);
    });
    body.appendChild(i);
  }

  /* mot de passe */
  var mp = el("form", "vm-sec");
  mp.appendChild(el("h4", null, "Changer le mot de passe"));
  var im = champMdp("vpMdpNeuf", "new-password", "Au moins 6 caractères");
  var ok = btn("btn", "Enregistrer"); ok.type = "submit";
  var l2 = el("div", "vm-ligne"); l2.appendChild(im); l2.appendChild(ok);
  mp.appendChild(l2);
  var dit2 = el("p", "vp-note", "");
  mp.appendChild(dit2);
  mp.addEventListener("submit", async function(ev){
    ev.preventDefault();
    dit2.className = "vp-note"; dit2.textContent = "Un instant…";
    try{ await majMotDePasse(im.champ.value); im.champ.value = ""; dit2.textContent = "Mot de passe changé."; }
    catch(err){ dit2.className = "vp-note is-bad"; dit2.textContent = err.message; }
  });
  body.appendChild(mp);
  box.appendChild(body);

  var pied = el("footer", "vm__pied");
  pied.appendChild(btn("btn", "Se déconnecter", async function(){
    await sortir(); fermerModal(); peindre();
  }));
  pied.appendChild(el("span", "vm__dit", "Le travail en cours reste sur cet appareil."));
  box.appendChild(pied);
  montrer();
}

/* ---------- un groupe ---------- */
export function ouvrirGroupe(eq){
  var e = eq || CPT.equipe;
  if(!e) return;
  var proprio = estProprietaire(e);
  var actif = CPT.equipe && CPT.equipe.id === e.id;
  var box = boite(true);

  var nom = el("input", "vm__nom");
  nom.type = "text"; nom.value = e.name;
  nom.setAttribute("aria-label", "Nom du groupe");
  nom.addEventListener("change", async function(){
    try{ await renommerEquipe(nom.value.trim() || e.name, e); peindre(); }
    catch(err){ dit(err.message); }
  });
  teteModal(box, nom,
    el("p", "vm__meta", "Le groupe partage ses variantes et ses réglages de projet. N'importe quel membre peut le renommer."),
    "Le groupe " + e.name);

  var body = el("div", "vm__body vm__body--un");
  var s = el("section", "vm-sec");
  s.appendChild(el("h4", null, "Membres"));
  var liste = actif ? CPT.membres
                    : (MEMBRES_PAR_EQUIPE[e.id] || []).map(function(p){
                        return { profil:p, role: p.id === e.owner_id ? "owner" : "member" }; });
  liste.forEach(function(m){
    var r = el("div", "vm-membre");
    r.appendChild(pastille(m.profil));
    var n = el("div", "vm-membre__n");
    n.appendChild(el("b", null, (m.profil.name || m.profil.email) +
      (CPT.profil && m.profil.id === CPT.profil.id ? " — vous" : "")));
    n.appendChild(el("span", "mono", m.profil.email));
    r.appendChild(n);
    r.appendChild(el("span", "vm-role", m.role === "owner" ? "propriétaire" : "membre"));
    if(proprio && m.role !== "owner"){
      r.appendChild(btn("btn", "Transmettre", async function(){
        try{ await transfererPropriete(m.profil.id, e); ouvrirGroupe(); peindre(); }
        catch(err){ dit(err.message); }
      }));
      if(actif){
        var x = btn("btn btn--icon", "✕", async function(){
          try{ await retirer(m.profil.id); ouvrirGroupe(e); }catch(err){ dit(err.message); }
        });
        x.setAttribute("aria-label", "Retirer " + (m.profil.name || m.profil.email));
        r.appendChild(x);
      }
    }
    s.appendChild(r);
  });
  if(actif) CPT.invites.forEach(function(i){
    var r = el("div", "vm-membre is-invite");
    r.appendChild(el("span", "vp-av", "…"));
    var n = el("div", "vm-membre__n");
    n.appendChild(el("b", null, i.email));
    n.appendChild(el("span", null, "invitation envoyée"));
    r.appendChild(n);
    if(proprio) r.appendChild(btn("btn", "Annuler", async function(){
      try{ await annulerInvite(i.id); ouvrirGroupe(e); }catch(err){ dit(err.message); }
    }));
    s.appendChild(r);
  });
  body.appendChild(s);

  if(proprio && actif){
    var f = el("form", "vm-sec");
    f.appendChild(el("h4", null, "Inviter"));
    var i2 = champ("vpInv", "email", "prenom.nom@exemple.ch", "email");
    var row = el("div", "vm-ligne");
    row.appendChild(i2);
    var okb = btn("btn btn--primary", "Inviter"); okb.type = "submit";
    row.appendChild(okb);
    f.appendChild(row);
    f.appendChild(el("p", "vp-note", "La personne rejoint le groupe depuis son profil, ou dès sa première connexion si elle n'a pas encore de compte."));
    f.addEventListener("submit", async function(ev){
      ev.preventDefault();
      try{ await inviter(i2.value); ouvrirGroupe(e); }catch(err){ dit(err.message); }
    });
    body.appendChild(f);
  }
  box.appendChild(body);

  var pied = el("footer", "vm__pied");
  var q = btn("btn vm__sup", "Quitter ce groupe", async function(){
    if(q.dataset.sur !== "1"){ q.dataset.sur = "1"; q.textContent = "Confirmer le départ"; return; }
    try{ await quitterEquipe(e.id); fermerModal(); await rafraichir(); peindre(); }
    catch(err){ dit(err.message); q.dataset.sur = ""; q.textContent = "Quitter ce groupe"; }
  });
  pied.appendChild(q);
  pied.appendChild(el("span", "vm__dit", proprio && liste.length > 1
    ? "Transmets d'abord la propriété : un groupe sans propriétaire ne peut plus inviter personne."
    : "Les variantes que tu y as posées restent au groupe."));
  box.appendChild(pied);
  montrer();
}

/* ---------- démarrage ---------- */
export function initVariantes(){
  bati();
  marqueReference();
  onCompte(function(){
    peindre();
    if(CPT.statut !== "dedans") return;
    /* Le groupe actif a changé — au démarrage, ou par un onglet : la liste et
       les réglages sont ceux d'un AUTRE groupe tant qu'on ne les relit pas. */
    var id = CPT.equipe ? CPT.equipe.id : null;
    if(id && id !== vueEquipe){
      vueEquipe = id;
      tirerReglages().then(function(change){
        if(change && apresCharge) apresCharge();
        peindre();
      }).catch(function(){});
      rafraichir();
    }
  });
  onVariantes(function(){ peindre(); majBoutons(); });
}
