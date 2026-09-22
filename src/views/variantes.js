/* ============================================================================
   LE PANNEAU DES VARIANTES

   Il n'est PAS un onglet. Les onglets sont la chronologie du concours —
   cahier des charges, mixer, massing — et une variante ne s'y range nulle
   part : elle les traverse tous les trois. Elle vit donc à côté du compte,
   dans un panneau qui se pose par-dessus ce qu'on faisait, et qu'on referme
   pour se retrouver exactement où l'on était.

   DEUX NIVEAUX, et c'est tout le dessin :

   — la CARTE porte ce qu'il faut pour RECONNAÎTRE une variante et la CHARGER.
     Miniature, nom, auteur, note, deux boutons. Rien d'autre.
   — le MODAL porte tout le reste — la note critère par critère, les graines,
     les surfaces, les niveaux, les contrôles — et le seul geste qui détruit,
     « Supprimer », qui n'a rien à faire sur une carte de liste.

   « Charger » remet le cahier des charges, le mixer et le massing dans l'état
   exact. C'est la raison d'être de l'écran, donc le seul bouton plein.
   ========================================================================= */
import { el, fmt } from "../core/format.js";
import { perime } from "../core/empreinte.js";
import { SITE } from "../data/site.js";
import { snapshot } from "../mix/store.js";
import { CPT, connexion, estProprietaire, initialesDe, inviter, membreDe,
         onCompte, renommerEquipe, retirer, sortir } from "../net/compte.js";
import { REG, tirerReglages } from "../net/reglages.js";
import { VARIANTES, charger, chargerVariantes, enregistrer, nomPropose,
         onVariantes, renommer, supprimer } from "../net/variantes.js";
import { supaOn } from "../net/supa.js";

var SVGNS = "http://www.w3.org/2000/svg";
var panneau = null, modal = null, ouvert = false;
var apresCharge = null;          /* rendu à refaire quand on a chargé */
var reference = null;            /* l'état au dernier enregistrement ou chargement */
var occupe = false, message = "";

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
function depuis(iso){
  if(!iso) return "";
  var s = (Date.now() - new Date(iso).getTime()) / 1000;
  if(s < 90) return "à l'instant";
  if(s < 5400) return "il y a " + Math.round(s / 60) + " min";
  if(s < 72000) return "il y a " + Math.round(s / 3600) + " h";
  var d = new Date(iso);
  var mois = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  return d.getDate() + " " + mois[d.getMonth()];
}
function nomDe(id){
  var p = membreDe(id);
  if(p) return p.name || p.email;
  return CPT.profil && CPT.profil.id === id ? (CPT.profil.name || "vous") : "quelqu'un";
}
function pastille(id){
  var p = membreDe(id) || (CPT.profil && CPT.profil.id === id ? CPT.profil : null);
  var d = el("span", "vp-av", p ? initialesDe(p) : "?");
  if(p && CPT.profil && p.id === CPT.profil.id) d.classList.add("is-moi");
  return d;
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
    points: SITE.per.map(function(p){ return p[0] + "," + p[1]; }).join(" "),
    class:"vp-per" }));
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
   on ne le dit que si c'est vrai : comparer l'état à celui du dernier
   enregistrement coûte une chaîne, et évite un avertissement permanent que
   plus personne ne lirait. */
function sig(){ try{ return JSON.stringify(snapshot()); }catch(_){ return ""; } }
export function marqueReference(){ reference = sig(); }
function travailEnCours(){ return reference !== null && reference !== sig(); }

/* ---------- le panneau ---------- */
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
  box.setAttribute("aria-label", "Informations de la variante");
  modal.appendChild(box);
  document.body.appendChild(modal);

  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    if(!modal.hidden) fermerModal();
    else if(ouvert) fermer();
  });
}

/* La barre d'application s'enroule sur un portable : sa hauteur se mesure, elle
   ne se déclare pas. C'est une géométrie, pas une valeur de dessin. */
function caler(){
  if(!panneau) return;
  var bar = document.querySelector(".appbar");
  panneau.style.insetBlockStart = (bar ? Math.round(bar.getBoundingClientRect().height) : 0) + "px";
}

export function ouvrir(){
  bati();
  caler();
  ouvert = true;
  panneau.hidden = false;
  majBouton();
  peindre();
  if(CPT.statut === "dedans" && !VARIANTES.length) rafraichir();
}
export function fermer(){
  if(!panneau) return;
  ouvert = false;
  panneau.hidden = true;
  majBouton();
}
export function basculer(){ if(ouvert) fermer(); else ouvrir(); }

function majBouton(){
  var b = document.getElementById("varBtn");
  if(!b) return;
  b.setAttribute("aria-expanded", String(ouvert));
  b.classList.toggle("is-on", ouvert);
  var c = b.querySelector(".vb-cnt");
  if(c){
    c.textContent = VARIANTES.length ? String(VARIANTES.length) : "";
    c.hidden = !VARIANTES.length;
  }
}

async function rafraichir(){
  try{ await chargerVariantes(); }
  catch(e){ message = e.message; peindre(); }
}

function dit(txt){ message = txt || ""; peindre(); }

/* ---------- l'état du compte, en tête du panneau ---------- */
function blocCompte(){
  var d = el("div", "vp-compte");
  if(!supaOn()){
    d.appendChild(el("p", "vp-note", "La base n'est pas configurée : les variantes restent sur cet appareil."));
    return d;
  }
  if(CPT.statut === "attente"){
    d.appendChild(el("p", "vp-note", "Un lien vient de partir par courriel. Ouvre-le sur cet appareil."));
    return d;
  }
  if(CPT.statut === "charge"){ d.appendChild(el("p", "vp-note", "Connexion…")); return d; }
  if(CPT.statut === "panne"){
    d.appendChild(el("p", "vp-note is-bad", "La base a répondu : " + CPT.err));
    return d;
  }
  if(CPT.statut !== "dedans"){
    var f = el("form", "vp-conn");
    var lab = el("label", null, "Se connecter pour partager");
    lab.htmlFor = "vpMail";
    var i = el("input");
    i.id = "vpMail"; i.type = "email"; i.required = true;
    i.placeholder = "prenom.nom@exemple.ch";
    var b = btn("btn btn--primary", "Recevoir un lien");
    b.type = "submit";
    f.appendChild(lab);
    var r = el("div", "vp-conn__row");
    r.appendChild(i); r.appendChild(b);
    f.appendChild(r);
    f.appendChild(el("p", "vp-note", "Sans compte, le travail reste enregistré sur cet appareil, comme aujourd'hui."));
    if(CPT.err) f.appendChild(el("p", "vp-note is-bad", CPT.err));
    f.addEventListener("submit", function(e){ e.preventDefault(); connexion(i.value); });
    d.appendChild(f);
    return d;
  }

  var g = el("div", "vp-grp");
  g.appendChild(pastille(CPT.profil.id));
  var n = el("div", "vp-grp__n");
  n.appendChild(el("b", null, CPT.equipe ? CPT.equipe.name : "—"));
  var sub = el("span", null, CPT.membres.length + (CPT.membres.length > 1 ? " membres" : " membre"));
  n.appendChild(sub);
  g.appendChild(n);
  CPT.membres.forEach(function(m){
    if(CPT.profil && m.profil.id === CPT.profil.id) return;
    g.appendChild(pastille(m.profil.id));
  });
  g.appendChild(btn("btn btn--icon vp-grp__set", "⋯", function(){ ouvrirGroupe(); }));
  d.appendChild(g);
  if(REG.quand && REG.par && CPT.profil && REG.par !== CPT.profil.id){
    d.appendChild(el("p", "vp-note", "Réglages du groupe modifiés par " + nomDe(REG.par) + " " + depuis(REG.quand) + "."));
  }
  return d;
}

/* ---------- une carte ---------- */
function carte(v){
  var c = el("article", "vc");
  var vieux = perime(v.fingerprint);
  if(vieux.length) c.classList.add("is-perime");

  var cadre = el("div", "vc__vig");
  cadre.appendChild(vignette(v.thumbnail));
  if(vieux.length){
    var m = el("span", "vc__perime", "périmée");
    m.title = vieux.join(" · ") + " — depuis l'enregistrement";
    cadre.appendChild(m);
  }
  c.appendChild(cadre);

  var t = el("div", "vc__t");
  var g = el("div", "vc__g");
  g.appendChild(el("h3", "vc__nom", v.name));
  var meta = el("p", "vc__meta");
  meta.appendChild(pastille(v.author_id));
  meta.appendChild(document.createTextNode(nomDe(v.author_id) + " · " + depuis(v.created_at)));
  g.appendChild(meta);
  t.appendChild(g);
  var note = el("b", "vc__note mono", v.score == null ? "—" : (v.score > 0 ? "+" : "") + v.score);
  if(v.score != null) note.classList.add(v.score >= 0 ? "is-haut" : "is-bas");
  t.appendChild(note);
  c.appendChild(t);

  var a = el("div", "vc__a");
  var bc = btn("btn btn--primary vc__load", vieux.length ? "Charger quand même" : "Charger",
    function(){ demandeCharge(v); });
  a.appendChild(bc);
  a.appendChild(btn("btn", "Informations", function(){ ouvrirModal(v); }));
  c.appendChild(a);
  return c;
}

/* ---------- peindre ---------- */
function peindre(){
  if(!panneau) return;
  var b = panneau.querySelector(".vp__body");
  while(b.firstChild) b.removeChild(b.firstChild);
  panneau.querySelector(".vp__cnt").textContent =
    CPT.equipe ? VARIANTES.length + " · " + CPT.equipe.name : "";

  b.appendChild(blocCompte());
  if(message) b.appendChild(el("p", "vp-note is-bad", message));

  if(CPT.statut !== "dedans"){ majBouton(); return; }

  var save = btn("vp-save", null, function(){ faireEnregistrer(); });
  save.appendChild(el("span", "vp-save__p", "+"));
  save.appendChild(el("span", null, occupe ? "Enregistrement…" : "Enregistrer la composition à l'écran"));
  save.disabled = occupe;
  b.appendChild(save);

  if(!VARIANTES.length){
    b.appendChild(el("p", "vp-note", "Aucune variante pour l'instant. Compose au mixer et au massing, puis enregistre."));
  }
  var liste = el("div", "vp-liste");
  VARIANTES.forEach(function(v){ liste.appendChild(carte(v)); });
  b.appendChild(liste);
  majBouton();
}

/* ---------- les gestes ---------- */
async function faireEnregistrer(){
  occupe = true; peindre();
  try{
    await enregistrer(nomPropose());
    marqueReference();
    message = "";
  }catch(e){ message = e.message; }
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

/* ---------- le modal ---------- */
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
  bati();
  var box = modal.querySelector(".vm__box");
  while(box.firstChild) box.removeChild(box.firstChild);

  var head = el("header", "vm__head");
  var nom = el("input", "vm__nom");
  nom.type = "text"; nom.value = v.name;
  nom.setAttribute("aria-label", "Nom de la variante");
  nom.addEventListener("change", async function(){
    try{ await renommer(v.id, nom.value.trim() || v.name); peindre(); }
    catch(e){ dit(e.message); }
  });
  var g = el("div", "vm__g");
  g.appendChild(nom);
  var meta = el("p", "vm__meta");
  meta.appendChild(pastille(v.author_id));
  meta.appendChild(document.createTextNode(nomDe(v.author_id) + " · " + depuis(v.created_at)));
  [v.parti, v.floors + " niveaux", v.bodies + " corps"].forEach(function(t){
    if(t) meta.appendChild(el("span", "vm__chip", t));
  });
  g.appendChild(meta);
  head.appendChild(g);
  var x = btn("btn btn--icon", "✕", fermerModal);
  x.setAttribute("aria-label", "Fermer");
  head.appendChild(x);
  box.appendChild(head);

  var vieux = perime(v.fingerprint);
  if(vieux.length){
    var w = el("p", "vm-perime");
    w.textContent = "Périmée : " + vieux.join(", ") + " — depuis l'enregistrement. " +
                    "Les chiffres ci-dessous sont ceux de ce moment-là.";
    box.appendChild(w);
  }

  var body = el("div", "vm__body");

  /* la note */
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

  /* ce qui rejoue */
  var s2 = el("section", "vm-sec");
  s2.appendChild(el("h4", null, "Ce qui rejoue la variante"));
  s2.appendChild(ligne("Graine du programme", (v.seed_program >>> 0).toString(36)));
  s2.appendChild(ligne("Graine du massing", (v.seed_massing >>> 0).toString(36)));
  s2.appendChild(ligne("Parti", v.parti || "—"));
  body.appendChild(s2);

  /* les surfaces */
  var s3 = el("section", "vm-sec");
  s3.appendChild(el("h4", null, "Les surfaces"));
  s3.appendChild(ligne("Demandé", fmt(v.area_required) + " m²"));
  s3.appendChild(ligne("Posé", fmt(v.area_placed) + " m²"));
  s3.appendChild(ligne("Bâti, circulation comprise", fmt(v.area_gross) + " m²"));
  var ec = (v.area_placed || 0) - (v.area_required || 0);
  s3.appendChild(ligne("Écart", (ec > 0 ? "+" : "") + fmt(ec) + " m²", ec === 0 ? "" : "is-ecart"));
  body.appendChild(s3);

  /* les contrôles */
  var s4 = el("section", "vm-sec");
  s4.appendChild(el("h4", null, "Les contrôles"));
  var vm = (v.verdict && v.verdict.mass) || {}, vx = (v.verdict && v.verdict.mix) || {};
  s4.appendChild(el("p", "vm-v" + (vm.e ? " is-err" : " is-ok"),
    vm.e ? vm.e + " erreur" + (vm.e > 1 ? "s" : "") + " au massing" : "Massing : aucune erreur"));
  if(vm.w) s4.appendChild(el("p", "vm-v is-warn", vm.w + " à vérifier, " + (vm.i || 0) + " informations"));
  if(vx.e) s4.appendChild(el("p", "vm-v is-err", vx.e + " erreur" + (vx.e > 1 ? "s" : "") + " au mixer"));
  if(vx.w) s4.appendChild(el("p", "vm-v is-warn", "Mixer : " + vx.w + " écart" + (vx.w > 1 ? "s" : "")));
  body.appendChild(s4);

  /* l'implantation */
  var s5 = el("section", "vm-sec vm-sec--plan");
  s5.appendChild(el("h4", null, "L'implantation"));
  var p = el("div", "vm-plan");
  p.appendChild(vignette(v.thumbnail));
  s5.appendChild(p);
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

  modal.hidden = false;
  nom.focus();
}
export function fermerModal(){
  if(!modal) return;
  modal.hidden = true;
}

/* ---------- le groupe ---------- */
function ouvrirGroupe(){
  bati();
  var box = modal.querySelector(".vm__box");
  while(box.firstChild) box.removeChild(box.firstChild);

  var head = el("header", "vm__head");
  var g = el("div", "vm__g");
  var nom = el("input", "vm__nom");
  nom.type = "text"; nom.value = CPT.equipe ? CPT.equipe.name : "";
  nom.setAttribute("aria-label", "Nom du groupe");
  nom.disabled = !estProprietaire();
  nom.addEventListener("change", function(){ renommerEquipe(nom.value.trim() || CPT.equipe.name); });
  g.appendChild(nom);
  g.appendChild(el("p", "vm__meta", "Le groupe partage ses variantes et ses réglages de projet."));
  head.appendChild(g);
  var x = btn("btn btn--icon", "✕", fermerModal);
  x.setAttribute("aria-label", "Fermer");
  head.appendChild(x);
  box.appendChild(head);

  var body = el("div", "vm__body");
  var s = el("section", "vm-sec");
  s.appendChild(el("h4", null, "Membres"));
  CPT.membres.forEach(function(m){
    var r = el("div", "vm-membre");
    r.appendChild(pastille(m.profil.id));
    var n = el("div", "vm-membre__n");
    n.appendChild(el("b", null, (m.profil.name || m.profil.email) +
      (CPT.profil && m.profil.id === CPT.profil.id ? " — vous" : "")));
    n.appendChild(el("span", "mono", m.profil.email));
    r.appendChild(n);
    r.appendChild(el("span", "vm-role", m.role === "owner" ? "propriétaire" : "membre"));
    if(estProprietaire() && m.role !== "owner"){
      r.appendChild(btn("btn btn--icon", "✕", async function(){
        await retirer(m.profil.id); ouvrirGroupe();
      }));
    }
    s.appendChild(r);
  });
  CPT.invites.forEach(function(i){
    var r = el("div", "vm-membre is-invite");
    r.appendChild(el("span", "vp-av", "…"));
    var n = el("div", "vm-membre__n");
    n.appendChild(el("b", null, i.email));
    n.appendChild(el("span", null, "invitation envoyée"));
    r.appendChild(n);
    s.appendChild(r);
  });
  body.appendChild(s);

  if(estProprietaire()){
    var f = el("form", "vm-sec");
    f.appendChild(el("h4", null, "Inviter"));
    var i2 = el("input", "vm-mail");
    i2.type = "email"; i2.required = true; i2.placeholder = "prenom.nom@exemple.ch";
    i2.setAttribute("aria-label", "Adresse à inviter");
    var row = el("div", "vp-conn__row");
    row.appendChild(i2);
    var ok = btn("btn btn--primary", "Inviter"); ok.type = "submit";
    row.appendChild(ok);
    f.appendChild(row);
    f.appendChild(el("p", "vp-note", "La personne rejoint le groupe dès qu'elle se connecte avec cette adresse."));
    f.addEventListener("submit", async function(e){
      e.preventDefault();
      try{ await inviter(i2.value); ouvrirGroupe(); }catch(err){ dit(err.message); }
    });
    body.appendChild(f);
  }
  box.appendChild(body);

  var pied = el("footer", "vm__pied");
  pied.appendChild(btn("btn", "Se déconnecter", async function(){ await sortir(); fermerModal(); peindre(); }));
  pied.appendChild(el("span", "vm__dit", CPT.profil ? CPT.profil.email : ""));
  box.appendChild(pied);
  modal.hidden = false;
}

/* ---------- démarrage ---------- */
export function initVariantes(){
  bati();
  marqueReference();
  onCompte(function(){
    peindre();
    if(CPT.statut === "dedans"){
      tirerReglages().then(function(change){
        if(change && apresCharge) apresCharge();
        peindre();
      }).catch(function(){});
      rafraichir();
    }
  });
  onVariantes(function(){ peindre(); majBouton(); });
}
