/* ============================================================================
   LE PANNEAU DES VARIANTES, ET LE PROFIL

   Le panneau n'est PAS un onglet. Les onglets sont la chronologie du concours
   — cahier des charges, mixer, massing — et une variante ne s'y range nulle
   part : elle les traverse tous les trois. Elle vit donc à côté du compte,
   dans un panneau posé par-dessus ce qu'on faisait, et qu'on referme pour se
   retrouver exactement où l'on était.

   DEUX NIVEAUX, et c'est tout le dessin :

   — la CARTE porte ce qu'il faut pour RECONNAÎTRE une variante et la CHARGER.
     Miniature carrée, nom, note, qui et quand, ses étiquettes, et trois
     gestes : charger, les informations, et la poubelle — une mèche qui laisse
     quatre secondes pour annuler, comme « Supprimer » dans le modal.
   — le MODAL porte tout le reste — la note critère par critère, les graines,
     les surfaces, les contrôles.

   Le PROFIL est ailleurs, sur son propre badge : les groupes dont on fait
   partie, le mot de passe, la sortie. Ce ne sont pas des variantes, et les
   mettre dans le même panneau aurait mêlé « où je travaille » et « ce que
   j'ai fait ».
   ========================================================================= */
import { unVerrou } from "../core/verrou.js";
import { noteVue } from "./note.js";
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
import { VARIANTES, aJour, charger, chargerVariantes, enregistrer, invalide, jugementDe,
         moyennesMain, nomPropose, notifiee, noteDe, noterMain, onVariantes, poserTrouvees,
         rejouerTout, renommer, supprimer } from "../net/variantes.js";
import { AXES, scoreAxe } from "../data/jugement.js";
import { PREFS, onPrefs, setPref } from "../net/prefs.js";
import { icone } from "./icons.js";
import { deroulant, item, titre } from "./menu.js";
import { BORNES, RECH, TAG_RECHERCHE, rechercher } from "../net/recherche.js";
import { MASS, PARTIS, partiOf } from "../mass/model.js";
import { supaOn } from "../net/supa.js";

var SVGNS = "http://www.w3.org/2000/svg";
var panneau = null, modal = null, ouvert = false;
var apresCharge = null;          /* rendu à refaire quand on a chargé */
var reference = null;            /* l'état au dernier enregistrement ou chargement */
var occupe = false, message = "";
var vueEquipe = null;            /* le groupe dont la liste est à l'écran */
var cherche = null;              /* la recherche en cours : { i, n, top, arreter } */
var chercheEl = null, bilanRech = "";

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
   lu par personne. L'horodatage de l'instantané n'est pas l'état : deux
   signatures prises à une milliseconde d'écart différeraient toujours. */
function sig(){
  try{ var s = snapshot(); delete s.updatedAt; return JSON.stringify(s); }
  catch(_){ return ""; }
}
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
    else if(ouvertOutil){ ouvertOutil = null; peindre(); }
    else if(ouvert) fermer();
  });
  /* Un clic hors du réglage ouvert le referme ; un clic sur son propre bouton
     le bascule déjà. */
  panneau.addEventListener("pointerdown", function(e){
    if(!ouvertOutil || ouvertOutil === "cherche") return;
    if(e.target.closest(".vp-pop") || e.target.closest(".vp-outil")) return;
    ouvertOutil = null; peindre();
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
  /* Fermer le panneau, c'est avoir vu ce qu'on venait d'enregistrer. */
  NOUVELLES = {};
  /* Refermer, c'est renoncer aux suppressions en cours. */
  for(var k in ALLUMEES) ALLUMEES[k].lacher();
  ALLUMEES = {};
  ouvertOutil = null;
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

/* ---------- les nouvelles ----------
   Une variante qu'on vient d'enregistrer — à la main ou par la recherche — est
   « new » : elle monte en tête, hors tri et hors filtre, cernée et soulignée,
   pour qu'on la retrouve sans la chercher. C'est temporaire, et en mémoire
   seulement : le badge tombe quand on ferme l'application, quand on ferme le
   panneau, quand on ouvre ses informations, ou au Reload. */
var NOUVELLES = {};
function marquerNouvelles(rows){ (rows || []).forEach(function(r){ if(r && r.id) NOUVELLES[r.id] = 1; }); }
function estNouvelle(v){ return !!NOUVELLES[v.id]; }

/* ---------- une carte ----------
   Miniature CARRÉE à gauche. À droite, de haut en bas : le nom et la note, qui
   sont ce qu'on lit en premier ; qui l'a posée et quand ; ses étiquettes ; et,
   calés sur le bas de la miniature, les trois gestes — charger, les
   informations, supprimer. */
function tag(txt, cls, titre){
  var t = el("span", "vc-tag" + (cls ? " vc-tag--" + cls : ""), txt);
  if(titre) t.title = titre;
  return t;
}
function carte(v){
  var c = el("article", "vc");
  var vieux = perime(v.fingerprint);
  if(vieux.length) c.classList.add("is-perime");
  if(estNouvelle(v)) c.classList.add("is-new");

  var cadre = el("div", "vc__vig");
  cadre.appendChild(vignette(v.thumbnail));
  c.appendChild(cadre);

  var d = el("div", "vc__d");
  var t = el("div", "vc__t");
  t.appendChild(el("h3", "vc__nom", v.name));
  /* La note du jugement d'AUJOURD'HUI, refaite sur les mesures que la variante
     a gardées ; une variante d'avant garde la sienne, en italique. */
  var sc = noteDe(v, MOY);
  var note = el("b", "vc__note mono" + (aJour(v) ? "" : " is-vieux"), sc == null ? "—" : String(sc));
  if(sc != null) note.classList.add(invalide(v) ? "is-bas" : "is-haut");
  note.title = aJour(v) ? "Note du jugement, sur 100" : "Note d'un ancien juge — « Reload » la refait";
  t.appendChild(note);
  d.appendChild(t);

  var meta = el("p", "vc__meta");
  meta.appendChild(pastilleDe(v.author_id, "vp-av--mini"));
  meta.appendChild(el("span", "vc__qui", nomDe(v.author_id) + " · " + quand(v.created_at)));
  d.appendChild(meta);

  /* Les étiquettes se cumulent : une trouvaille de la recherche, neuve et déjà
     périmée, porte les trois. */
  var tags = [];
  if(estNouvelle(v)) tags.push(tag("new", "new", "Enregistrée à l'instant"));
  if(vieux.length) tags.push(tag("périmée", "perime", "Périmée — " + vieux.join(", ") + " depuis l'enregistrement. Elle reste chargeable."));
  if(estTrouvee(v)) tags.push(tag("algo", "algo", "Trouvée par la recherche automatique"));
  /* Hors du cadre : elle n'est pas supprimée, elle est dite. */
  if(invalide(v)) tags.push(tag("invalide", "perime", "Hors du cadre opposable — règlement ou AEAI. Elle reste notée et chargeable."));
  else if(notifiee(v).length) tags.push(tag("hors cadre", "perime", "Hors du cadre choisi : " + notifiee(v).join(", ")));
  if(tags.length){
    var tg = el("div", "vc__tags");
    tags.forEach(function(x){ tg.appendChild(x); });
    d.appendChild(tg);
  }

  var a = el("div", "vc__a");
  a.appendChild(btn("btn btn--primary vc__load", "Charger", function(){ demandeCharge(v); }));
  a.appendChild(btn("btn vc__info", "Infos", function(){ ouvrirModal(v); }));
  a.appendChild(meche("btn--icon vc__sup", null, "« " + v.name + " »", async function(){
    await supprimer(v.id); delete NOUVELLES[v.id]; peindre();
  }, v.id));
  d.appendChild(a);

  c.appendChild(d);
  return c;
}

/* ---------- la mèche ----------
   Une suppression ne se confirme pas : elle s'allume. Au clic, le bouton
   devient « Annuler » et une mèche rouge brûle son bord ; un clic ou Échap
   l'éteint, et la variante part quand la mèche arrive au bout. Revenir dessus à
   la souris la fige, le temps de réfléchir ; un onglet caché aussi.
   L'effacement part À LA FIN et pas au clic : la base est celle du groupe, et
   « Annuler » ne saurait pas rendre une ligne déjà effacée. Pour la même raison,
   un bouton qui a quitté l'écran — fenêtre ou panneau refermé, liste repeinte —
   n'efface rien. */
var MECHE = 4000;
/* Les mèches allumées sur des CARTES, par variante. Une suppression repeint
   toute la liste : sans ce registre, la première variante partie éteignait
   les mèches des autres. La carte neuve reprend celle de l'ancienne, au même
   point, figée ou non. */
var ALLUMEES = {};
function meche(cls, texte, quoi, faire, cle){
  var b = btn("btn meche " + cls, null, null), a = null, ici = false, figeable = false;
  var faces = el("span", "meche__faces");
  [["poubelle", texte], ["annuler", texte && "Annuler"]].forEach(function(f, i){
    var s = el("span", "meche__f" + (i ? " meche__f--arme" : ""));
    s.appendChild(icone(f[0]));
    if(f[1]) s.appendChild(document.createTextNode(f[1]));
    faces.appendChild(s);
  });
  b.appendChild(faces);
  var rim = sv("svg", { class:"meche__rim", "aria-hidden":"true" });
  rim.appendChild(sv("rect", {}));
  b.appendChild(rim);

  function arme(){ return b.classList.contains("is-arme"); }
  function jouer(){
    if(!a || !arme()) return;
    if(ici || document.hidden) a.pause(); else a.play();
  }
  function poser(on){
    b.classList.toggle("is-arme", on);
    b.setAttribute("aria-label", (on ? "Annuler la suppression de " : "Supprimer ") + quoi);
    b.title = on ? "Annuler (Échap)" : "Supprimer";
    document[on ? "addEventListener" : "removeEventListener"]("visibilitychange", jouer);
  }
  /* Éteinte, la mèche reste où elle en était : elle s'efface en fondu, sans
     revenir pleine. `lacher` éteint ce bouton-ci ; `eteindre` éteint la mèche
     pour de bon, registre compris. */
  function lacher(){ if(a){ a.onfinish = null; a.pause(); } poser(false); }
  function eteindre(){
    lacher();
    if(cle && ALLUMEES[cle] && ALLUMEES[cle].b === b) delete ALLUMEES[cle];
  }
  function allumer(depuis){
    if(a) a.cancel();
    poser(true);
    /* Le tour se mesure en pixels : `pathLength` ne règle pas le pointillé
       partout (Chromium ici, Safari aussi), et la mèche restait pleine. */
    var r = rim.firstChild, tour = r.getTotalLength();
    r.style.strokeDasharray = tour + "px";
    a = r.animate([{ strokeDashoffset:"0px" }, { strokeDashoffset:-tour + "px" }],
                  { duration:MECHE, easing:"linear", fill:"forwards" });
    a.currentTime = depuis;
    jouer();
    a.onfinish = async function(){
      eteindre();
      if(!b.getClientRects().length) return;
      b.disabled = true;
      try{ await faire(); }
      catch(e){ b.disabled = false; dit(e.message); }
    };
    if(cle) ALLUMEES[cle] = { b:b, lacher:lacher,
      etat:function(){ return { t:a.currentTime, ici:ici, figeable:figeable }; } };
  }
  poser(false);

  b.addEventListener("click", function(){
    if(arme()){ eteindre(); return; }
    ici = false; figeable = false;
    allumer(0);
  });
  b.addEventListener("keydown", function(e){
    if(e.key === "Escape" && arme()){ e.stopPropagation(); eteindre(); }
  });
  /* La souris qui vient de cliquer est déjà dessus : il faut qu'elle soit
     sortie une fois pour que revenir fige. */
  b.addEventListener("pointerenter", function(e){
    if(e.pointerType === "mouse" && figeable){ ici = true; jouer(); }
  });
  b.addEventListener("pointerleave", function(e){
    if(e.pointerType === "mouse"){ figeable = true; ici = false; jouer(); }
  });

  /* Reprendre la mèche d'une carte repeinte — une fois le bouton posé dans la
     liste, car le tour ne se mesure que sur un bouton à l'écran. */
  var vieille = cle && ALLUMEES[cle];
  if(vieille) queueMicrotask(function(){
    if(ALLUMEES[cle] !== vieille || !b.isConnected) return;
    var e = vieille.etat();
    vieille.lacher();
    ici = e.ici; figeable = e.figeable;
    allumer(e.t);
  });
  return b;
}

function estTrouvee(v){ return (v.tags || []).indexOf(TAG_RECHERCHE) >= 0; }
function partiReel(v){ return (v.thumbnail && v.thumbnail.parti) || v.parti || "auto"; }

/* ---------- trier, filtrer, chercher ----------
   Trois boutons au-dessus des enregistrements, et un quatrième à droite :
   Reload. Au repos, un bouton n'est qu'une icône ; dès qu'il règle quelque
   chose, il s'élargit pour dire QUOI — « Date ↑ », « Note ≥ 80 » — ou, si
   c'est trop long à dire, combien de choses. Les trois réglages suivent le
   compte (`net/prefs.js`). Le vocabulaire est celui des listes qu'on connaît
   — Linear, Notion : un tri, des filtres qui se cumulent, une recherche. */
/* La note générale, puis un sous-classement par axe du jugement : le plus
   économique, le mieux inséré… Tout se relit sur les mesures, au poids du jour. */
var TRIS = [
  { k:"score",  n:"Note",            asc:"la moins bonne d'abord", desc:"la meilleure d'abord" }
].concat(AXES.map(function(a){
  return { k:"ax:" + a.id, n:"Axe — " + a.n.split(",")[0].toLowerCase(),
           asc:"la moins bonne d'abord", desc:"la meilleure d'abord" };
})).concat([
  { k:"date",   n:"Date",            asc:"la plus ancienne d'abord", desc:"la plus récente d'abord" },
  { k:"name",   n:"Nom",             asc:"A → Z", desc:"Z → A" },
  { k:"author", n:"Auteur",          asc:"A → Z", desc:"Z → A" },
  { k:"parti",  n:"Type de massing", asc:"A → Z", desc:"Z → A" }
]);
var TRI_DEF = { k:"score", dir:"desc" };
/* La moyenne des notes manuelles, refaite à chaque peinture : ce que reçoit,
   critère par critère, une variante qu'on n'a pas notée. */
var MOY = {};
function triCourant(){ var t = PREFS.vTri; return t && t.k ? t : TRI_DEF; }
function triActif(){ var t = triCourant(); return t.k !== TRI_DEF.k || t.dir !== TRI_DEF.dir; }
function triDe(k){ for(var i = 0; i < TRIS.length; i++) if(TRIS[i].k === k) return TRIS[i]; return TRIS[0]; }
function cleTri(v, k){
  if(k === "score"){ var n = noteDe(v, MOY); return n == null ? -Infinity : n; }
  if(k.indexOf("ax:") === 0){ var a = scoreAxe(jugementDe(v, MOY), k.slice(3)); return a == null ? -Infinity : a; }
  if(k === "date") return v.created_at || "";
  if(k === "name") return (v.name || "").toLowerCase();
  if(k === "author") return nomDe(v.author_id).toLowerCase();
  return partiOf(partiReel(v)).n.toLowerCase();
}
function trier(L){
  var t = triCourant(), s = t.dir === "asc" ? 1 : -1;
  return L.slice().sort(function(a, b){
    var x = cleTri(a, t.k), y = cleTri(b, t.k);
    if(x < y) return -s;
    if(x > y) return s;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

var DATES = [["tout", "Toutes"], ["24h", "24 h"], ["7j", "7 jours"], ["30j", "30 jours"]];
var DUREES = { "24h":86400e3, "7j":7 * 86400e3, "30j":30 * 86400e3 };
var ETATS = [["tout", "Toutes"], ["ajour", "À jour"], ["perimee", "Périmées"]];
var ORIGINES = [["tout", "Toutes"], ["algo", "Recherche auto"], ["main", "À la main"]];
function filtreCourant(){
  var f = PREFS.vFiltre || {};
  return {
    smin: f.smin == null || f.smin === "" ? null : +f.smin,
    smax: f.smax == null || f.smax === "" ? null : +f.smax,
    auteurs: f.auteurs || [], partis: f.partis || [],
    etat: f.etat || "tout", date: f.date || "tout", origine: f.origine || "tout"
  };
}
function nomDeListe(L, id){ for(var i = 0; i < L.length; i++) if(L[i][0] === id) return L[i][1]; return id; }
/* Chaque critère réglé, dit en quelques mots — c'est ce que le bouton affiche. */
function critFiltre(f){
  var out = [];
  if(f.smin != null && f.smax != null) out.push("Note " + f.smin + "–" + f.smax);
  else if(f.smin != null) out.push("Note ≥ " + f.smin);
  else if(f.smax != null) out.push("Note ≤ " + f.smax);
  if(f.auteurs.length) out.push(f.auteurs.length === 1 ? "Par " + nomDe(f.auteurs[0]) : f.auteurs.length + " auteurs");
  if(f.etat !== "tout") out.push(nomDeListe(ETATS, f.etat));
  if(f.date !== "tout") out.push(nomDeListe(DATES, f.date));
  if(f.partis.length) out.push(f.partis.length === 1 ? partiOf(f.partis[0]).n : f.partis.length + " types");
  if(f.origine !== "tout") out.push(nomDeListe(ORIGINES, f.origine));
  return out;
}
function passeFiltre(v, f){
  var sc = noteDe(v, MOY);
  if(f.smin != null && !(sc != null && sc >= f.smin)) return false;
  if(f.smax != null && !(sc != null && sc <= f.smax)) return false;
  if(f.auteurs.length && f.auteurs.indexOf(v.author_id) < 0) return false;
  if(f.etat !== "tout"){
    var p = perime(v.fingerprint).length > 0;
    if(f.etat === "perimee" ? !p : p) return false;
  }
  if(f.date !== "tout" && !(Date.now() - new Date(v.created_at).getTime() <= DUREES[f.date])) return false;
  if(f.partis.length && f.partis.indexOf(partiReel(v)) < 0) return false;
  if(f.origine === "algo" && !estTrouvee(v)) return false;
  if(f.origine === "main" && estTrouvee(v)) return false;
  return true;
}
function passeRecherche(v, q){
  if(!q) return true;
  var txt = [v.name, nomDe(v.author_id), partiOf(partiReel(v)).n, (v.tags || []).join(" ")].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).every(function(m){ return !m || txt.indexOf(m) >= 0; });
}
function setFiltre(k, val){
  var f = filtreCourant();
  f[k] = val;
  setPref("vFiltre", f);
  peindre();
}

/* Un bouton d'outil : l'icône, et — une fois réglé — ce qu'il règle. Sans
   `id`, il n'ouvre rien lui-même : c'est un déroulant qui le mène. */
var LONG_MAX = 18;
var popNeuf = false;         /* le réglage vient de s'ouvrir : il s'ouvre en pop */
function boutonOutil(id, ic, nom, resume, compte){
  var b = btn("btn vp-outil" + (resume ? " is-actif" : ""), null, id ? function(){
    ouvertOutil = ouvertOutil === id ? null : id;
    popNeuf = !!ouvertOutil;
    peindre();
  } : null);
  b.appendChild(icone(ic));
  if(resume){
    var txt = resume.length > LONG_MAX && compte ? String(compte) : resume;
    b.appendChild(el("span", "vp-outil__r", txt));
  }
  if(id) b.setAttribute("aria-expanded", String(ouvertOutil === id));
  b.setAttribute("aria-label", nom + (resume ? " — " + resume : ""));
  b.title = nom + (resume ? " — " + resume : "");
  return b;
}
var ouvertOutil = null;      /* "filtre" · "cherche" · null */

function segment(liste, val, onPick, label){
  var g = el("div", "btn-group vp-seg");
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", label);
  liste.forEach(function(p){
    var b = btn("btn", p[1], function(){ onPick(p[0]); });
    b.setAttribute("aria-pressed", String(val === p[0]));
    g.appendChild(b);
  });
  return g;
}
function pilules(liste, choisis, onPick, label){
  var g = el("div", "vp-pils");
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", label);
  liste.forEach(function(p){
    var on = choisis.indexOf(p[0]) >= 0;
    var b = btn("vp-pil", p[1], function(){
      onPick(on ? choisis.filter(function(x){ return x !== p[0]; }) : choisis.concat([p[0]]));
    });
    b.setAttribute("aria-pressed", String(on));
    g.appendChild(b);
  });
  return g;
}
/* Le tri est UN choix — un critère, un sens : le déroulant du menu ◐
   (`menu.js`), un titre par critère et ses deux sens dessous. Choisir le tri
   par défaut, c'est revenir au défaut. */
function menuTri(){
  var t = triCourant();
  var b = boutonOutil(null, "trier", "Trier",
    triActif() ? triDe(t.k).n + (t.dir === "asc" ? " ↑" : " ↓") : "", 1);
  var r = el("div", "menu menu--gauche vp-tri"), l = el("div", "menu__list");
  r.appendChild(b); r.appendChild(l);
  deroulant(r, b, l, function(l){
    TRIS.forEach(function(x){
      l.appendChild(titre(x.n));
      ["desc", "asc"].forEach(function(dir){
        l.appendChild(item(x[dir], null, t.k === x.k && t.dir === dir, function(){
          setPref("vTri", x.k === TRI_DEF.k && dir === TRI_DEF.dir ? null : { k:x.k, dir:dir });
          peindre();
          /* La barre est refaite : le focus revient au bouton neuf. */
          var nb = panneau.querySelector(".vp-tri .vp-outil");
          if(nb) nb.focus({ preventScroll:true });
        }));
      });
    });
  });
  return r;
}
function popFiltre(){
  var f = filtreCourant();
  var pop = el("div", "vp-pop" + (popNeuf ? " is-neuf" : ""));
  popNeuf = false;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Filtrer les variantes");

  pop.appendChild(el("h4", null, "Note"));
  var r = el("div", "vp-pop__note");
  function champNote(k, lab){
    var l = el("label", null);
    l.appendChild(el("span", null, lab));
    var i = el("input", "mono");
    i.type = "number"; i.step = "1"; i.value = f[k] == null ? "" : String(f[k]);
    i.addEventListener("change", function(){ setFiltre(k, i.value === "" ? null : +i.value); });
    l.appendChild(i);
    return l;
  }
  r.appendChild(champNote("smin", "de"));
  r.appendChild(champNote("smax", "à"));
  pop.appendChild(r);

  var auteurs = [], vus = {};
  VARIANTES.forEach(function(v){ if(!vus[v.author_id]){ vus[v.author_id] = 1; auteurs.push([v.author_id, nomDe(v.author_id)]); } });
  if(auteurs.length > 1){
    pop.appendChild(el("h4", null, "Auteur"));
    pop.appendChild(pilules(auteurs, f.auteurs, function(x){ setFiltre("auteurs", x); }, "Auteur"));
  }
  pop.appendChild(el("h4", null, "État"));
  pop.appendChild(segment(ETATS, f.etat, function(x){ setFiltre("etat", x); }, "État"));
  pop.appendChild(el("h4", null, "Date"));
  pop.appendChild(segment(DATES, f.date, function(x){ setFiltre("date", x); }, "Date"));

  var partis = [], pv = {};
  VARIANTES.forEach(function(v){ var p = partiReel(v); if(!pv[p]){ pv[p] = 1; partis.push([p, partiOf(p).n]); } });
  if(partis.length > 1){
    pop.appendChild(el("h4", null, "Type de massing"));
    pop.appendChild(pilules(partis, f.partis, function(x){ setFiltre("partis", x); }, "Type de massing"));
  }
  pop.appendChild(el("h4", null, "Origine"));
  pop.appendChild(segment(ORIGINES, f.origine, function(x){ setFiltre("origine", x); }, "Origine"));

  if(critFiltre(f).length) pop.appendChild(btn("vp-lien", "Tout effacer", function(){ setPref("vFiltre", null); peindre(); }));
  return pop;
}
function champCherche(){
  var w = el("div", "vp-cherche");
  w.appendChild(icone("loupe"));
  var i = el("input");
  i.type = "search"; i.value = PREFS.vCherche || "";
  i.placeholder = "Nom, auteur, type…";
  i.setAttribute("aria-label", "Chercher une variante");
  var t = null;
  i.addEventListener("input", function(){
    clearTimeout(t);
    t = setTimeout(function(){ setPref("vCherche", i.value); peindreListe(); }, 160);
  });
  i.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
      e.stopPropagation();
      if(i.value){ i.value = ""; setPref("vCherche", ""); peindreListe(); }
      else { ouvertOutil = null; peindre(); }
    }
  });
  w.appendChild(i);
  w.champ = i;
  return w;
}

/* ---------- Reload ----------
   Il remet la liste d'aplomb : les « new » tombent, la liste est relue, et
   chaque variante est rejouée par le code d'aujourd'hui — sa note, ses
   critères, son verdict sont refaits et réécrits (`rejouerTout`). */
var rejeu = null;
async function faireRejouer(){
  if(rejeu || cherche) return;
  NOUVELLES = {};
  var stop = false;
  rejeu = { i:0, n:VARIANTES.length, arreter:function(){ stop = true; } };
  message = ""; bilanRech = "";
  peindre();
  try{
    var r = await rejouerTout(function(i, n){ rejeu.i = i; rejeu.n = n; majRejeu(); }, function(){ return stop; });
    if(apresCharge) apresCharge();
    bilanRech = r.faits + " variante" + (r.faits > 1 ? "s" : "") + " relue" + (r.faits > 1 ? "s" : "") + " et mesurée" + (r.faits > 1 ? "s" : "")
      + (r.changes ? ", " + r.changes + " note" + (r.changes > 1 ? "s" : "") + " refaite" + (r.changes > 1 ? "s" : "") : ", aucune note à refaire")
      + (r.rates ? " · " + r.rates + " illisible" + (r.rates > 1 ? "s" : "") : "") + ".";
  }catch(e){ message = e.message; }
  rejeu = null;
  peindre();
}
function majRejeu(){
  var s = panneau && panneau.querySelector(".vp-rejeu");
  if(s && rejeu) s.textContent = "Relecture " + rejeu.i + " / " + rejeu.n + "…";
}

/* ---------- peindre ----------
   Trois sections, et chacune a son rôle :
   — l'EN-TÊTE, qui reste accroché : « Variantes », le groupe, la croix ;
   — les OUTILS : le groupe à l'écran, enregistrer, chercher automatiquement ;
   — les ENREGISTREMENTS : les presets qui remettent tous les onglets en place,
     avec leurs outils de lecture — trier, filtrer, chercher, Reload. */
function peindre(){
  if(!panneau) return;
  var b = panneau.querySelector(".vp__body");
  while(b.firstChild) b.removeChild(b.firstChild);
  panneau.querySelector(".vp__cnt").textContent = CPT.equipe ? CPT.equipe.name : "";

  if(CPT.statut !== "dedans"){
    b.appendChild(blocAuth());
    if(message) b.appendChild(el("p", "vp-note is-bad", message));
    majBoutons();
    return;
  }

  /* --- les outils --- */
  var outils = el("section", "vp-sec vp-outils");
  outils.setAttribute("aria-label", "Outils");
  var ong = ongletsGroupes();
  if(ong) outils.appendChild(ong);
  if(message) outils.appendChild(el("p", "vp-note is-bad", message));
  if(REG.quand && REG.par && CPT.profil && REG.par !== CPT.profil.id){
    outils.appendChild(el("p", "vp-note", "Réglages du groupe modifiés par " + nomDe(REG.par) + " " + quand(REG.quand) + "."));
  }

  /* Le nom se donne AVANT d'enregistrer : le champ est la moitié du bouton,
     le « + » l'autre. Vide, la variante prend le nom proposé. */
  var f = el("form", "vp-save vp-save--nom");
  var nom = el("input", "vp-save__nom");
  nom.type = "text"; nom.value = nomSaisi;
  nom.placeholder = "Nommer la composition à l'écran — " + nomPropose();
  nom.setAttribute("aria-label", "Nom de la variante à enregistrer");
  nom.addEventListener("input", function(){ nomSaisi = nom.value; });
  var plus = btn("vp-save__plus", null, null);
  plus.type = "submit";
  plus.appendChild(icone("plus", 18));
  plus.setAttribute("aria-label", "Enregistrer la composition à l'écran");
  plus.title = "Enregistrer";
  nom.disabled = plus.disabled = occupe || !!cherche || !!rejeu;
  f.appendChild(nom); f.appendChild(plus);
  f.addEventListener("submit", function(e){ e.preventDefault(); faireEnregistrer(nom.value); });
  outils.appendChild(f);
  if(occupe) outils.appendChild(el("p", "vp-note", "Un instant…"));

  var rb = btn("vp-save", null, ouvrirRecherche);
  rb.appendChild(el("span", "vp-save__p", "⟳"));
  rb.appendChild(el("span", null, "Recherche automatique"));
  rb.disabled = occupe || !!cherche || !!rejeu;
  outils.appendChild(rb);
  if(cherche){ chercheEl = el("div", "vp-rech"); outils.appendChild(chercheEl); majCherche(); }
  else chercheEl = null;
  if(bilanRech) outils.appendChild(el("p", "vp-note", bilanRech));
  b.appendChild(outils);

  /* --- les enregistrements --- */
  var enr = el("section", "vp-sec vp-enreg");
  enr.setAttribute("aria-label", "Enregistrements");
  var barre = el("div", "vp-barre");
  var g = el("div", "vp-barre__g");
  var ft = filtreCourant(), cf = critFiltre(ft);
  g.appendChild(menuTri());
  g.appendChild(boutonOutil("filtre", "filtrer", "Filtrer",
    cf.length ? (cf.length === 1 ? cf[0] : cf.length + " filtres") : "", cf.length));
  if(ouvertOutil === "cherche" || PREFS.vCherche){
    var ch = champCherche();
    g.appendChild(ch);
    if(ouvertOutil === "cherche") setTimeout(function(){ ch.champ.focus(); }, 0);
  } else g.appendChild(boutonOutil("cherche", "loupe", "Chercher", "", 0));
  barre.appendChild(g);
  var rl = btn("btn vp-outil vp-reload", null, faireRejouer);
  rl.appendChild(icone("recharger"));
  if(rejeu) rl.appendChild(el("span", "vp-outil__r vp-rejeu", "Relecture " + rejeu.i + " / " + rejeu.n + "…"));
  rl.disabled = !!rejeu || !!cherche || !VARIANTES.length;
  rl.setAttribute("aria-label", "Reload — efface les « new », relit la liste et remesure chaque variante pour le jugement");
  rl.title = "Reload — efface les « new », relit la liste et remesure chaque variante pour le jugement";
  barre.appendChild(rl);
  /* Le réglage ouvert se pose SOUS la barre, par-dessus la liste : il ne la
     fait pas sauter à chaque ouverture. */
  if(ouvertOutil === "filtre") barre.appendChild(popFiltre());
  enr.appendChild(barre);

  var liste = el("div", "vp-liste");
  enr.appendChild(liste);
  b.appendChild(enr);
  peindreListe();
  majBoutons();
}

/* La liste seule : la recherche la refait à chaque lettre sans reconstruire
   le champ où l'on tape. */
function peindreListe(){
  var liste = panneau && panneau.querySelector(".vp-liste");
  if(!liste) return;
  while(liste.firstChild) liste.removeChild(liste.firstChild);
  MOY = moyennesMain();
  var neuves = VARIANTES.filter(estNouvelle)
                        .sort(function(a, b){ return (b.created_at || "").localeCompare(a.created_at || ""); });
  var f = filtreCourant(), q = (PREFS.vCherche || "").trim();
  var reste = trier(VARIANTES.filter(function(v){
    return !estNouvelle(v) && passeFiltre(v, f) && passeRecherche(v, q);
  }));
  neuves.concat(reste).forEach(function(v){ liste.appendChild(carte(v)); });

  var total = VARIANTES.length, vus = neuves.length + reste.length;
  var cnt = panneau.querySelector(".vp__cnt");
  if(cnt && CPT.equipe) cnt.textContent = (vus < total ? vus + " sur " + total : String(total)) + " · " + CPT.equipe.name;
  if(!total) liste.appendChild(el("p", "vp-note", "Aucune variante dans ce groupe. Compose au mixer et au massing, puis enregistre."));
  else if(!reste.length && (critFiltre(f).length || q)){
    var p = el("p", "vp-note", "Aucune variante ne passe " + (q ? "la recherche" : "le filtre") + ". ");
    p.appendChild(btn("vp-lien", "Tout effacer", function(){
      setPref("vFiltre", null); setPref("vCherche", ""); ouvertOutil = null; peindre();
    }));
    liste.appendChild(p);
  }
}

/* ---------- les gestes ---------- */
var nomSaisi = "";
async function faireEnregistrer(nom){
  occupe = true; peindre();
  try{
    var r = await enregistrer((nom && nom.trim()) || nomPropose());
    marquerNouvelles([r]);
    nomSaisi = "";
    marqueReference(); message = "";
  }
  catch(e){ message = e.message; }
  occupe = false; peindre();
}

/* Charger écrase : on prévient, et on propose d'enregistrer d'abord. Un seul
   endroit décide — la carte ne charge jamais directement. */
/* Une variante REMPLACE tout l'état, onglets verrouillés compris — et leurs
   cadenas par les siens : c'est un geste qu'on fait exprès, on le dit avant. */
function demandeCharge(v){
  var cad = unVerrou(), tec = travailEnCours();
  if(!tec && !cad){ faireCharger(v); return; }
  var d = el("div", "vp-alerte");
  d.appendChild(el("p", null, (tec ? "La composition à l'écran n'est pas enregistrée. La charger la remplacera." : "")
    + (cad ? (tec ? " " : "") + "Des onglets sont verrouillés : la variante les remplacera, cadenas compris." : "")));
  var r = el("div", "vp-alerte__a");
  if(tec) r.appendChild(btn("btn btn--primary", "Enregistrer d'abord", async function(){
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

/* ---------- la recherche ----------
   Le formulaire dit les quatre choses qu'on décide : ce qu'on rebat, combien
   de fois, ce qu'on garde, combien. Il se referme au lancement : la recherche
   se suit dans le panneau, là où ses résultats arrivent. */
function caseA(txt, on, aide){
  var l = el("label", "vr-case");
  var i = el("input"); i.type = "checkbox"; i.checked = !!on;
  l.appendChild(i);
  var t = el("span", null, txt);
  if(aide) t.appendChild(el("small", null, aide));
  l.appendChild(t);
  l.champ = i;
  return l;
}
function nombre(id, lab, v, b){
  var w = el("label", "vr-nb");
  w.htmlFor = id;
  w.appendChild(el("span", null, lab));
  var i = el("input", "mono");
  i.id = id; i.type = "number"; i.min = b[0]; i.max = b[1]; i.step = 1; i.value = v;
  w.appendChild(i);
  w.champ = i;
  return w;
}
/* Un essai de massing coûte près d'une seconde : le dire avant de lancer. */
var SEC_PAR_ESSAI = 0.8;
function duree(n){
  var s = n * SEC_PAR_ESSAI;
  return s < 90 ? "≈ " + Math.max(1, Math.round(s)) + " s" : "≈ " + Math.round(s / 60) + " min";
}

function ouvrirRecherche(){
  var box = boite(true);
  teteModal(box, el("h3", "vm__titre", "Recherche automatique"),
    el("p", "vm__meta", "Tirer beaucoup, garder les meilleures notes. Elles arrivent au groupe, étiquetées « " + TAG_RECHERCHE + " »."),
    "Recherche automatique");
  var body = el("div", "vm__body vm__body--un");

  var s1 = el("section", "vm-sec");
  s1.appendChild(el("h4", null, "Ce qu'on rebat à chaque essai"));
  var cP = caseA("Le programme", RECH.programme, "la répartition du mixer, pile comprise");
  var cM = caseA("Le massing", RECH.massing, "la volumétrie, à programme égal");
  s1.appendChild(cP); s1.appendChild(cM);
  body.appendChild(s1);

  var s2 = el("section", "vm-sec");
  s2.appendChild(el("h4", null, "Les partis essayés"));
  s2.appendChild(el("p", "vp-note", "Aucun coché : le parti à l'écran (" + partiOf(MASS.parti).n + "). Plusieurs : on tourne sur la liste."));
  var grille = el("div", "vr-partis");
  var cases = PARTIS.map(function(p){
    var c = caseA(p.n, RECH.partis.indexOf(p.id) >= 0);
    c.title = p.d;
    c.pid = p.id;
    grille.appendChild(c);
    return c;
  });
  s2.appendChild(grille);
  body.appendChild(s2);

  var s3 = el("section", "vm-sec");
  s3.appendChild(el("h4", null, "Combien"));
  var ligneN = el("div", "vr-nbs");
  var nE = nombre("vrEssais", "Essais", RECH.essais, BORNES.essais);
  var nG = nombre("vrGarder", "On en garde", RECH.garder, BORNES.garder);
  ligneN.appendChild(nE); ligneN.appendChild(nG);
  s3.appendChild(ligneN);
  var est = el("p", "vp-note", "");
  function majEst(){ est.textContent = "Durée : " + duree(+nE.champ.value || 0) + ". Ne touche à rien pendant ce temps : l'écran est remis tel quel à la fin."; }
  nE.champ.addEventListener("input", majEst); majEst();
  s3.appendChild(est);
  body.appendChild(s3);

  var s4 = el("section", "vm-sec");
  s4.appendChild(el("h4", null, "Ce qu'on garde"));
  s4.appendChild(el("p", "vp-note", "Les meilleures notes du jugement, sur 100 — à note égale, la moins fautive. Les générateurs cherchent par l’orientation ; le jugement classe ce qu’ils trouvent."));
  var cE = caseA("Sans erreur rouge", RECH.sansErreur, "ni au mixer, ni au massing");
  var cD = caseA("Un seul par parti", RECH.distincts, "pour ne pas garder trois fois le même peigne");
  s4.appendChild(cE); s4.appendChild(cD);
  body.appendChild(s4);
  box.appendChild(body);

  var pied = el("footer", "vm__pied");
  var dit3 = el("span", "vm__dit", "");
  var go = btn("btn btn--primary", "Lancer", function(){
    if(!cP.champ.checked && !cM.champ.checked){
      dit3.textContent = "Coche au moins le programme ou le massing."; return;
    }
    RECH.programme = cP.champ.checked;
    RECH.massing = cM.champ.checked;
    RECH.partis = cases.filter(function(c){ return c.champ.checked; }).map(function(c){ return c.pid; });
    RECH.essais = +nE.champ.value;
    RECH.garder = +nG.champ.value;
    RECH.sansErreur = cE.champ.checked;
    RECH.distincts = cD.champ.checked;
    fermerModal();
    lancerRecherche();
  });
  pied.appendChild(go);
  pied.appendChild(dit3);
  box.appendChild(pied);
  montrer();
  go.focus();
}

function majCherche(){
  if(!chercheEl || !cherche) return;
  while(chercheEl.firstChild) chercheEl.removeChild(chercheEl.firstChild);
  var h = el("div", "vp-rech__h");
  h.appendChild(el("b", null, cherche.enreg ? "Enregistrement…" : "Recherche"));
  h.appendChild(el("span", "mono", cherche.i + " / " + cherche.n));
  if(!cherche.enreg) h.appendChild(btn("btn", "Arrêter", cherche.arreter));
  chercheEl.appendChild(h);
  var pr = el("progress");
  pr.max = cherche.n; pr.value = cherche.i;
  chercheEl.appendChild(pr);
  if(cherche.top.length){
    var l = el("ol", "vp-rech__top");
    cherche.top.forEach(function(t){
      var li = el("li");
      li.appendChild(el("span", null, partiOf(t.pid).n));
      li.appendChild(el("b", "mono", t.row.score + "/100"));
      l.appendChild(li);
    });
    chercheEl.appendChild(l);
  } else chercheEl.appendChild(el("p", "vp-note", "Rien de retenu pour l'instant."));
}

async function lancerRecherche(){
  var stop = false;
  cherche = { i:0, n:RECH.essais, top:[], arreter:function(){ stop = true; } };
  bilanRech = ""; message = "";
  peindre();
  try{
    var r = await rechercher(RECH, function(i, n, top){
      cherche.i = i; cherche.n = n; cherche.top = top.slice(); majCherche();
    }, function(){ return stop; });
    if(apresCharge) apresCharge();            /* l'état est remis : on le redessine */
    cherche.enreg = true; majCherche();
    var poses = await poserTrouvees(r.trouves, TAG_RECHERCHE);
    bilanRech = r.trouves.length
      ? poses.length + " variante" + (poses.length > 1 ? "s" : "") + " trouvée" + (poses.length > 1 ? "s" : "")
        + " en " + r.essais + " essais, enregistrée" + (poses.length > 1 ? "s" : "") + " au groupe."
      : "Aucun des " + r.essais + " essais ne passe ce qu'on garde. Élargis les filtres ou tire davantage.";
    marquerNouvelles(poses);
  }catch(e){ message = e.message; }
  cherche = null;
  peindre();
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
export function ouvrirModal(v){
  if(NOUVELLES[v.id]){ delete NOUVELLES[v.id]; peindre(); }
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
  /* Le jugement d'aujourd'hui sur les mesures de la variante, et ses notes
     À LA MAIN : un clic les écrit en base, et toutes les variantes se
     reclassent — une variante notée se situe contre celles qu'on a notées. */
  var jj = jugementDe(v);
  s1.appendChild(noteVue(jj, {
    ancienne: v.score,
    main: v.criteria && v.criteria.main,
    poser: jj ? async function(id, s){
      try{ await noterMain(v.id, id, s); peindre(); ouvrirModal(v); }
      catch(e){ dit(e.message); }
    } : null
  }));
  body.appendChild(s1);

  var s2 = el("section", "vm-sec");
  s2.appendChild(el("h4", null, "Ce qui rejoue la variante"));
  s2.appendChild(ligne("Seed du programme", (v.seed_program >>> 0).toString(36)));
  s2.appendChild(ligne("Seed du massing", (v.seed_massing >>> 0).toString(36)));
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
  pied.appendChild(meche("vm__sup", "Supprimer", "« " + v.name + " »", async function(){
    await supprimer(v.id); fermerModal(); peindre();
  }));
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
  /* Le tri, le filtre et la recherche suivent le compte : relus d'un autre
     appareil, ils redessinent la liste. */
  onPrefs(function(){ if(ouvert) peindreListe(); });
}
