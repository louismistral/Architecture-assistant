/* ============================================================================
   02 FORENSICS — le moodboard du groupe

   Une toile sans bord où l'on pose ce qu'on a vu, lu, relevé : des images, des
   notes, des liens, et des flèches qui les relient. Tout le groupe voit la même
   planche (`net/forensics.js`) ; la vue — où l'on regarde, à quel zoom — reste
   à chacun, sur son appareil.

   LES GESTES, dans l'ordre où on les cherche :
   — glisser le fond : déplacer la vue ; molette : défiler ; Ctrl + molette ou
     pincer : zoomer autour du pointeur ;
   — « Tout voir » (F) : si l'on s'est perdu, la vue se recadre sur ce qui est
     posé ;
   — double-clic sur le fond : une note ; glisser des images ou les coller : des
     images ; coller une adresse : un lien ;
   — glisser une carte : la déplacer ; son coin : la redimensionner ;
     double-clic : la modifier ; Suppr : la retirer ;
   — l'outil Flèche (A) : cliquer une carte, puis une autre.

   Sans compte, la planche ne s'ouvre pas : elle appartient au groupe, et rien
   ne s'y pose hors de lui.
   ========================================================================= */
import { el } from "../core/format.js";
import { view } from "../core/viewstate.js";
import { CPT, onCompte } from "../net/compte.js";
import { supaOn } from "../net/supa.js";
import { imageAdmise, lirePlanche, modifier, oublierSignatures, poser, retirer, signer,
         televerser, urlDe } from "../net/forensics.js";
import { icone } from "./icons.js";
import { ouvrirProfil } from "./variantes.js";

var racine = null, D = {};              /* la planche, construite une fois */
var ITEMS = [], PAR = {};
var equipeLue = null, lueA = 0;
var vue = { tx: 0, ty: 0, k: 1 }, vueLue = null;
var outil = "select";                   /* select · main · note · lien · fleche */
var sel = null, flecheDe = null;
var geste = null;                       /* le glisser en cours */
var edition = null;                     /* l'id de la carte en cours de modification */
var rerendre = null;
var ZMIN = 0.1, ZMAX = 4;

function dans(){ return view.tab === "forensics"; }
function connecte(){ return supaOn() && CPT.statut === "dedans" && !!CPT.equipe; }

/* ---------- la vue ---------- */
function cleVue(){ return "saxon.forensics.vue." + (CPT.equipe ? CPT.equipe.id : ""); }
function lireVue(){
  try{ var v = JSON.parse(localStorage.getItem(cleVue()) || "null"); if(v && isFinite(v.k)) return v; }catch(_){}
  return null;
}
function garderVue(){ try{ localStorage.setItem(cleVue(), JSON.stringify(vue)); }catch(_){} }
function appliquerVue(){
  if(!D.monde) return;
  D.monde.style.transform = "translate(" + vue.tx + "px," + vue.ty + "px) scale(" + vue.k + ")";
  /* La trame de points suit la vue : elle dit qu'on a bougé, même sur du vide. */
  var pas = 24 * vue.k;
  D.toile.style.backgroundSize = pas + "px " + pas + "px";
  D.toile.style.backgroundPosition = vue.tx + "px " + vue.ty + "px";
  D.zoom.textContent = Math.round(vue.k * 100) + " %";
}
function versMonde(cx, cy){
  var r = D.toile.getBoundingClientRect();
  return { x: (cx - r.left - vue.tx) / vue.k, y: (cy - r.top - vue.ty) / vue.k };
}
function centreVue(){
  var r = D.toile.getBoundingClientRect();
  return versMonde(r.left + r.width / 2, r.top + r.height / 2);
}
function zoomer(f, cx, cy){
  var r = D.toile.getBoundingClientRect();
  if(cx == null){ cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  var k = Math.max(ZMIN, Math.min(ZMAX, vue.k * f));
  var px = cx - r.left, py = cy - r.top;
  vue.tx = px - (px - vue.tx) * (k / vue.k);
  vue.ty = py - (py - vue.ty) * (k / vue.k);
  vue.k = k;
  appliquerVue(); garderVue();
}
/* « Tout voir » : la vue se recadre sur ce qui est posé. Une planche vide
   ramène l'origine au centre. */
export function toutVoir(){
  if(!D.toile) return;
  var r = D.toile.getBoundingClientRect(), L = ITEMS.filter(function(i){ return i.kind !== "arrow"; });
  if(!L.length){ vue = { tx: r.width / 2, ty: r.height / 2, k: 1 }; appliquerVue(); garderVue(); return; }
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  L.forEach(function(i){ x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y); x1 = Math.max(x1, i.x + i.w); y1 = Math.max(y1, i.y + i.h); });
  var m = 48, k = Math.min((r.width - 2 * m) / Math.max(1, x1 - x0), (r.height - 2 * m) / Math.max(1, y1 - y0), 1.5);
  k = Math.max(ZMIN, Math.min(ZMAX, k));
  vue = { k: k, tx: r.width / 2 - (x0 + x1) / 2 * k, ty: r.height / 2 - (y0 + y1) / 2 * k };
  appliquerVue(); garderVue();
}

/* ---------- les messages ---------- */
var tMsg = null;
function dire(txt, mauvais){
  if(!D.msg) return;
  D.msg.textContent = txt || "";
  D.msg.classList.toggle("is-bad", !!mauvais);
  D.msg.hidden = !txt;
  clearTimeout(tMsg);
  if(txt && mauvais !== "reste") tMsg = setTimeout(function(){ D.msg.hidden = true; }, 5000);
}

/* ---------- lire ---------- */
async function charger(){
  if(!connecte()) return;
  var eq = CPT.equipe.id;
  try{
    var l = await lirePlanche();
    if(!CPT.equipe || CPT.equipe.id !== eq) return;
    if(equipeLue !== eq){ oublierSignatures(); sel = null; }
    equipeLue = eq; lueA = Date.now();
    if(geste || edition) return;               /* on ne tire pas la carte de sous la main */
    ITEMS = l; indexer();
    await signer(ITEMS.filter(function(i){ return i.kind === "image"; }).map(function(i){ return i.path; }));
    dessiner();
    if(vueLue !== eq){ vueLue = eq; var v = lireVue(); if(v){ vue = v; appliquerVue(); } else toutVoir(); }
  }catch(e){ dire("La planche n'a pas pu être lue : " + e.message, true); }
}
function indexer(){ PAR = {}; ITEMS.forEach(function(i){ PAR[i.id] = i; }); }
function zMax(){ var z = 0; ITEMS.forEach(function(i){ if(i.z > z) z = i.z; }); return z; }

/* ---------- poser ---------- */
async function ajouter(item){
  item.z = zMax() + 1;
  /* Deux cartes posées au même endroit — deux collages de suite au centre de
     la vue — ne se couvrent pas : la seconde descend en cascade. */
  if(item.kind !== "arrow"){
    for(var n = 0; n < 40 && ITEMS.some(function(i){
      return i.kind !== "arrow" && Math.abs(i.x - item.x) < 12 && Math.abs(i.y - item.y) < 12; }); n++){
      item.x += 24; item.y += 24;
    }
  }
  try{
    var r = await poser(item);
    if(!r) return null;
    ITEMS.push(r); PAR[r.id] = r;
    if(r.kind === "image") await signer([r.path]);
    dessiner();
    choisir(r.id);
    return r;
  }catch(e){ dire("Rien n'a été posé : " + e.message, true); return null; }
}
function note(x, y, texte){
  return ajouter({ kind:"note", x:x - 110, y:y - 70, w:220, h:140, body: texte || "" }).then(function(r){
    if(r && !texte) editer(r.id);
  });
}
function domaine(u){ try{ return new URL(u).hostname.replace(/^www\./, ""); }catch(_){ return u; } }
function normaliserUrl(u){
  u = String(u || "").trim();
  if(u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
  return u;
}
function lien(x, y, url, titre){
  return ajouter({ kind:"link", x:x - 130, y:y - 48, w:260, h:96, url: normaliserUrl(url), title: titre || "" });
}
/* Une image garde ses proportions : on lit sa taille avant de l'envoyer. */
function tailleImage(f){
  return new Promise(function(ok){
    var u = URL.createObjectURL(f), im = new Image();
    im.onload = function(){ ok([im.naturalWidth || 320, im.naturalHeight || 240]); URL.revokeObjectURL(u); };
    im.onerror = function(){ ok([320, 240]); URL.revokeObjectURL(u); };
    im.src = u;
  });
}
async function images(fichiers, x, y){
  var L = Array.prototype.filter.call(fichiers || [], imageAdmise);
  if(!L.length){ if(fichiers && fichiers.length) dire("Seules les images passent : PNG, JPEG, WebP, GIF, SVG ou AVIF.", true); return; }
  for(var i = 0; i < L.length; i++){
    dire("Téléversement " + (i + 1) + " / " + L.length + "…", "reste");
    try{
      var t = await tailleImage(L[i]), s = Math.min(1, 320 / Math.max(t[0], t[1]));
      var path = await televerser(L[i]);
      await ajouter({ kind:"image", x: x + i * 24 - t[0] * s / 2, y: y + i * 24 - t[1] * s / 2,
                      w: Math.round(t[0] * s), h: Math.round(t[1] * s), path: path, title: "" });
    }catch(e){ dire(L[i].name + " : " + e.message, true); return; }
  }
  dire("");
}
async function fleche(a, b){
  if(a === b) return;
  var dejà = ITEMS.some(function(i){ return i.kind === "arrow" && i.src === a && i.dst === b; });
  if(dejà) return;
  await ajouter({ kind:"arrow", src:a, dst:b, x:0, y:0, w:0, h:0 });
}
async function enlever(id){
  var it = PAR[id];
  if(!it) return;
  try{
    await retirer(it);
    ITEMS = ITEMS.filter(function(i){ return i.id !== id && i.src !== id && i.dst !== id; });
    indexer();
    if(sel === id) sel = null;
    dessiner();
  }catch(e){ dire("Rien n'a été retiré : " + e.message, true); }
}

/* ---------- dessiner ---------- */
function choisir(id){
  sel = id;
  if(!D.monde) return;
  D.monde.querySelectorAll(".fx-it.is-sel").forEach(function(n){ n.classList.remove("is-sel"); });
  D.fleches.querySelectorAll(".is-sel").forEach(function(n){ n.classList.remove("is-sel"); });
  if(!id) return;
  var n = D.monde.querySelector('[data-id="' + id + '"]');
  if(n) n.classList.add("is-sel");
}
function poserGeometrie(n, it){
  n.style.left = it.x + "px"; n.style.top = it.y + "px";
  n.style.width = it.w + "px"; n.style.height = it.h + "px";
  n.style.zIndex = String(it.z || 0);
}
function carte(it){
  var n = el("div", "fx-it fx-" + it.kind);
  n.dataset.id = it.id;
  poserGeometrie(n, it);
  if(it.kind === "note"){
    if(edition === it.id){
      var ta = el("textarea", "fx-note__ta");
      ta.value = it.body || "";
      ta.setAttribute("aria-label", "Texte de la note");
      ta.addEventListener("keydown", function(e){
        if(e.key === "Escape"){ e.stopPropagation(); finirEdition(); }
      });
      ta.addEventListener("blur", function(){ sauverTexte(it, ta.value); });
      n.appendChild(ta);
      setTimeout(function(){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    } else {
      var t = el("div", "fx-note__t", it.body || "");
      if(!it.body) t.appendChild(el("span", "fx-vide", "Double-clic pour écrire"));
      n.appendChild(t);
    }
  } else if(it.kind === "link"){
    if(edition === it.id) n.appendChild(formLien(it));
    else {
      /* Le titre s'il y en a un, le domaine sinon ; dessous, ce qui ne se
         répète pas — le domaine sous un titre, l'adresse sous un domaine. */
      n.appendChild(el("b", "fx-lien__t", it.title || domaine(it.url)));
      n.appendChild(el("span", "fx-lien__d", it.title ? domaine(it.url)
        : String(it.url || "").replace(/^[a-z]+:\/\/(www\.)?/i, "")));
      var a = el("a", "fx-lien__a");
      a.href = it.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.appendChild(document.createTextNode("Ouvrir"));
      a.appendChild(icone("ext", 12));
      n.appendChild(a);
    }
  } else if(it.kind === "image"){
    var im = el("img");
    im.alt = it.title || "image";
    im.draggable = false;
    var u = urlDe(it.path);
    if(u) im.src = u;
    n.appendChild(im);
    if(edition === it.id){
      var c = el("input", "fx-img__leg");
      c.value = it.title || ""; c.placeholder = "Légende";
      c.setAttribute("aria-label", "Légende de l'image");
      c.addEventListener("keydown", function(e){
        if(e.key === "Enter") c.blur();
        if(e.key === "Escape"){ e.stopPropagation(); finirEdition(); }
      });
      c.addEventListener("blur", function(){ sauverChamps(it, { title: c.value.trim() }); });
      n.appendChild(c);
      setTimeout(function(){ c.focus(); }, 0);
    } else if(it.title) n.appendChild(el("span", "fx-img__leg", it.title));
  }
  var p = el("span", "fx-it__poignee");
  p.setAttribute("aria-hidden", "true");
  n.appendChild(p);
  if(flecheDe === it.id) n.classList.add("is-source");
  if(sel === it.id) n.classList.add("is-sel");
  return n;
}
function formLien(it){
  var f = el("form", "fx-form");
  var u = el("input"); u.type = "url"; u.value = it.url || ""; u.placeholder = "https://…";
  u.setAttribute("aria-label", "Adresse du lien");
  var t = el("input"); t.type = "text"; t.value = it.title || ""; t.placeholder = "Titre (facultatif)";
  t.setAttribute("aria-label", "Titre du lien");
  f.appendChild(u); f.appendChild(t);
  f.addEventListener("submit", function(e){
    e.preventDefault();
    sauverChamps(it, { url: normaliserUrl(u.value), title: t.value.trim() });
  });
  f.addEventListener("keydown", function(e){ if(e.key === "Escape"){ e.stopPropagation(); finirEdition(); } });
  f.addEventListener("focusout", function(){
    setTimeout(function(){ if(edition === it.id && !f.contains(document.activeElement)) f.requestSubmit(); }, 0);
  });
  setTimeout(function(){ u.focus(); }, 0);
  return f;
}

/* Une flèche va du bord d'une carte au bord de l'autre, pas de centre à centre :
   la pointe doit se voir. */
function bord(r, vx, vy){
  var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  var sx = vx ? (r.w / 2) / Math.abs(vx) : Infinity, sy = vy ? (r.h / 2) / Math.abs(vy) : Infinity;
  var s = Math.min(sx, sy);
  return [cx + vx * s, cy + vy * s];
}
function dessinerFleches(){
  var g = D.fleches;
  while(g.childNodes.length > 1) g.removeChild(g.lastChild);
  ITEMS.forEach(function(it){
    if(it.kind !== "arrow") return;
    var a = PAR[it.src], b = PAR[it.dst];
    if(!a || !b) return;
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    var vx = bx - ax, vy = by - ay;
    var p = bord(a, vx, vy), q = bord(b, -vx, -vy);
    var d = "M" + p[0] + " " + p[1] + " L" + q[0] + " " + q[1];
    var NS = "http://www.w3.org/2000/svg";
    var grp = document.createElementNS(NS, "g");
    grp.setAttribute("class", "fx-fl" + (sel === it.id ? " is-sel" : ""));
    grp.dataset.id = it.id;
    var hit = document.createElementNS(NS, "path");
    hit.setAttribute("d", d); hit.setAttribute("class", "fx-fl__hit");
    var ln = document.createElementNS(NS, "path");
    ln.setAttribute("d", d); ln.setAttribute("class", "fx-fl__l");
    ln.setAttribute("marker-end", "url(#fxPointe)");
    grp.appendChild(hit); grp.appendChild(ln);
    g.appendChild(grp);
  });
}
function dessiner(){
  if(!D.monde) return;
  D.monde.querySelectorAll(".fx-it").forEach(function(n){ n.remove(); });
  ITEMS.forEach(function(it){ if(it.kind !== "arrow") D.monde.appendChild(carte(it)); });
  dessinerFleches();
  D.vide.hidden = ITEMS.length > 0;
}
function bouger(it){
  var n = D.monde.querySelector('[data-id="' + it.id + '"]');
  if(n) poserGeometrie(n, it);
  dessinerFleches();
}

/* ---------- modifier ---------- */
function editer(id){ edition = id; dessiner(); }
function finirEdition(){
  var it = PAR[edition];
  edition = null;
  /* Un lien sans adresse n'est rien : on ne le laisse pas vide sur la planche. */
  if(it && it.kind === "link" && !it.url){ enlever(it.id); return; }
  dessiner();
  if(D.toile) D.toile.focus({ preventScroll:true });
}
async function sauverChamps(it, champs){
  if(it.kind === "link" && "url" in champs && !champs.url){ edition = null; enlever(it.id); return; }
  var change = Object.keys(champs).some(function(k){ return (it[k] || "") !== (champs[k] || ""); });
  edition = null;
  if(change){
    Object.assign(it, champs);
    try{ await modifier(it.id, champs); }catch(e){ dire("Modification non enregistrée : " + e.message, true); }
  }
  dessiner();
}
function sauverTexte(it, txt){
  if(edition !== it.id) return;
  sauverChamps(it, { body: txt });
}

/* ---------- les outils ---------- */
var OUTILS = [
  { id:"select", ic:"curseur", n:"Sélectionner et déplacer", k:"v" },
  { id:"main",   ic:"main",    n:"Déplacer la vue", k:"h" },
  { id:"note",   ic:"note",    n:"Poser une note", k:"n" },
  { id:"lien",   ic:"lien",    n:"Poser un lien", k:"l" },
  { id:"image",  ic:"image",   n:"Ajouter des images", k:"i" },
  { id:"fleche", ic:"fleche",  n:"Relier deux cartes par une flèche", k:"a" }
];
function prendre(id){
  if(id === "image"){ D.fichier.click(); return; }
  outil = id; flecheDe = null;
  D.barre.querySelectorAll("[data-outil]").forEach(function(b){
    b.setAttribute("aria-pressed", String(b.dataset.outil === outil));
  });
  D.toile.dataset.outil = outil;
  if(outil === "fleche") dire("Clique la carte de départ, puis celle d'arrivée.", "reste");
  else if(outil === "note") dire("Clique où poser la note.", "reste");
  else if(outil === "lien") dire("Clique où poser le lien.", "reste");
  else dire("");
  dessiner();
}
function bouton(ic, nom, fn, cls){
  var b = el("button", "btn btn--icon fx-b" + (cls ? " " + cls : ""));
  b.type = "button";
  b.appendChild(icone(ic));
  b.setAttribute("aria-label", nom); b.title = nom;
  b.addEventListener("click", fn);
  return b;
}

/* ---------- la charpente ---------- */
function construire(){
  racine = el("section", "fx");
  racine.setAttribute("aria-label", "Forensics");

  var barre = el("div", "fx__barre");
  barre.setAttribute("role", "toolbar");
  barre.setAttribute("aria-label", "Outils de la planche");
  var g1 = el("div", "btn-group fx__g");
  OUTILS.forEach(function(o){
    var b = bouton(o.ic, o.n + " (" + o.k.toUpperCase() + ")", function(){ prendre(o.id); });
    b.classList.remove("btn--icon"); b.classList.add("btn--icon");
    b.dataset.outil = o.id;
    if(o.id !== "image") b.setAttribute("aria-pressed", String(outil === o.id));
    g1.appendChild(b);
  });
  barre.appendChild(g1);
  var g2 = el("div", "btn-group fx__g");
  g2.appendChild(bouton("moins", "Dézoomer (−)", function(){ zoomer(1 / 1.2); }));
  var z = el("button", "btn fx__zoom mono", "100 %");
  z.type = "button"; z.title = "Revenir à 100 % (0)"; z.setAttribute("aria-label", "Revenir à 100 %");
  z.addEventListener("click", function(){ zoomer(1 / vue.k); });
  g2.appendChild(z);
  g2.appendChild(bouton("plus", "Zoomer (+)", function(){ zoomer(1.2); }));
  barre.appendChild(g2);
  var tv = el("button", "btn fx__tout");
  tv.type = "button";
  tv.appendChild(icone("cadrer"));
  tv.appendChild(el("span", null, "Tout voir"));
  tv.title = "Recadrer sur tout ce qui est posé (F)";
  tv.addEventListener("click", toutVoir);
  barre.appendChild(tv);
  barre.appendChild(bouton("recharger", "Relire la planche du groupe", function(){ charger(); }, "fx__relire"));
  racine.appendChild(barre);

  var toile = el("div", "fx__toile");
  toile.tabIndex = 0;
  toile.setAttribute("role", "application");
  toile.setAttribute("aria-label", "Planche Forensics — glisser pour déplacer la vue, double-clic pour une note, coller une image ou une adresse");
  toile.dataset.outil = outil;
  var monde = el("div", "fx__monde");
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "fx__fleches");
  var defs = document.createElementNS(NS, "defs");
  defs.innerHTML = '<marker id="fxPointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>';
  svg.appendChild(defs);
  monde.appendChild(svg);
  toile.appendChild(monde);
  var vide = el("div", "fx__vide");
  vide.appendChild(el("b", null, "La planche est vide."));
  vide.appendChild(el("span", null, "Glisse des images ici ou colle-les, colle une adresse pour un lien, double-clique pour une note."));
  toile.appendChild(vide);
  racine.appendChild(toile);

  var msg = el("p", "fx__msg");
  msg.hidden = true;
  msg.setAttribute("role", "status");
  racine.appendChild(msg);

  var f = el("input");
  f.type = "file"; f.accept = "image/*"; f.multiple = true; f.hidden = true;
  f.addEventListener("change", function(){
    var c = centreVue();
    images(f.files, c.x, c.y).then(function(){ f.value = ""; });
  });
  racine.appendChild(f);

  D = { barre:barre, toile:toile, monde:monde, fleches:svg, msg:msg, vide:vide, zoom:z, fichier:f };
  brancher();
}

/* ---------- les gestes ---------- */
function brancher(){
  var T = D.toile;
  T.addEventListener("pointerdown", function(e){
    if(e.button !== 0 && e.button !== 1) return;
    if(e.target.closest("a, input, textarea, .fx-form")) return;
    var n = e.target.closest(".fx-it"), fl = e.target.closest(".fx-fl");
    var pan = e.button === 1 || outil === "main" || espace;
    T.focus({ preventScroll:true });
    if(!pan && n){
      var it = PAR[n.dataset.id];
      if(outil === "fleche"){
        if(!flecheDe){ flecheDe = it.id; dessiner(); dire("Et maintenant la carte d'arrivée.", "reste"); }
        else { var a = flecheDe; flecheDe = null; fleche(a, it.id).then(function(){ prendre("select"); }); }
        e.preventDefault();
        return;
      }
      if(edition && edition !== it.id) finirEdition();
      choisir(it.id);
      /* Saisir une carte la passe devant les autres. */
      var z = zMax(), z0 = it.z;
      if(it.z < z){ it.z = z + 1; n.style.zIndex = String(it.z); }
      geste = { mode: e.target.classList.contains("fx-it__poignee") ? "taille" : "bouge",
                it: it, x0: e.clientX, y0: e.clientY, ox: it.x, oy: it.y, ow: it.w, oh: it.h, z0: z0, bouge: false };
    } else if(!pan && fl){
      choisir(fl.dataset.id); fl.classList.add("is-sel");
      return;
    } else {
      if(!pan && outil === "note"){ var p = versMonde(e.clientX, e.clientY); note(p.x, p.y); prendre("select"); return; }
      if(!pan && outil === "lien"){
        var q = versMonde(e.clientX, e.clientY);
        lien(q.x, q.y, "", "").then(function(r){ if(r) editer(r.id); });
        prendre("select");
        return;
      }
      if(edition) finirEdition();
      choisir(null);
      geste = { mode: "vue", x0: e.clientX, y0: e.clientY, tx: vue.tx, ty: vue.ty };
      T.classList.add("is-pan");
    }
    T.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  T.addEventListener("pointermove", function(e){
    if(!geste) return;
    var dx = e.clientX - geste.x0, dy = e.clientY - geste.y0;
    if(geste.mode === "vue"){ vue.tx = geste.tx + dx; vue.ty = geste.ty + dy; appliquerVue(); return; }
    if(Math.abs(dx) + Math.abs(dy) > 2) geste.bouge = true;
    var it = geste.it;
    if(geste.mode === "bouge"){ it.x = geste.ox + dx / vue.k; it.y = geste.oy + dy / vue.k; }
    else {
      var w = Math.max(80, geste.ow + dx / vue.k), h = Math.max(48, geste.oh + dy / vue.k);
      /* Une image garde ses proportions, sauf Maj enfoncée. */
      if(it.kind === "image" && !e.shiftKey){ h = w * geste.oh / geste.ow; }
      it.w = w; it.h = h;
    }
    bouger(it);
  });
  function fin(){
    if(!geste) return;
    var g = geste; geste = null;
    D.toile.classList.remove("is-pan");
    if(g.mode === "vue"){ garderVue(); return; }
    var it = g.it, champs = { z: it.z };
    if(g.bouge){ champs.x = Math.round(it.x); champs.y = Math.round(it.y); champs.w = Math.round(it.w); champs.h = Math.round(it.h); }
    if(!g.bouge && it.z === g.z0) return;
    modifier(it.id, champs).catch(function(e){ dire("Déplacement non enregistré : " + e.message, true); });
  }
  T.addEventListener("pointerup", fin);
  T.addEventListener("pointercancel", fin);

  T.addEventListener("dblclick", function(e){
    if(e.target.closest("a, input, textarea, .fx-form")) return;
    var n = e.target.closest(".fx-it");
    if(n){ editer(n.dataset.id); return; }
    var p = versMonde(e.clientX, e.clientY);
    note(p.x, p.y);
  });

  /* La molette défile, Ctrl + molette (et le pincement du pavé) zoome. */
  T.addEventListener("wheel", function(e){
    e.preventDefault();
    /* Un cran de molette vaut ~100 : un pas de 20 %. Le pincement du pavé
       envoie de petits deltas continus : on les suit tels quels. */
    if(e.ctrlKey || e.metaKey){
      var f = Math.abs(e.deltaY) >= 40 ? Math.pow(1.2, -Math.sign(e.deltaY)) : Math.exp(-e.deltaY * 0.01);
      zoomer(f, e.clientX, e.clientY);
    }
    else { vue.tx -= e.deltaX; vue.ty -= e.deltaY; appliquerVue(); garderVue(); }
  }, { passive:false });

  T.addEventListener("keydown", function(e){
    if(e.target !== T) return;
    var k = e.key.toLowerCase();
    if((k === "delete" || k === "backspace") && sel){ e.preventDefault(); enlever(sel); return; }
    if(k === "escape"){ flecheDe = null; choisir(null); prendre("select"); return; }
    if(k === "enter" && sel){ editer(sel); e.preventDefault(); return; }
    if(k === "f"){ toutVoir(); return; }
    if(k === "+" || k === "="){ zoomer(1.2); return; }
    if(k === "-"){ zoomer(1 / 1.2); return; }
    if(k === "0"){ zoomer(1 / vue.k); return; }
    if(k === " "){ espace = true; T.classList.add("is-main"); e.preventDefault(); return; }
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    for(var i = 0; i < OUTILS.length; i++) if(OUTILS[i].k === k){ prendre(OUTILS[i].id); return; }
  });
  T.addEventListener("keyup", function(e){ if(e.key === " "){ espace = false; T.classList.remove("is-main"); } });

  /* Déposer des images, ou une adresse tirée d'un autre onglet. */
  T.addEventListener("dragover", function(e){ e.preventDefault(); T.classList.add("is-depot"); });
  T.addEventListener("dragleave", function(){ T.classList.remove("is-depot"); });
  T.addEventListener("drop", function(e){
    e.preventDefault();
    T.classList.remove("is-depot");
    var p = versMonde(e.clientX, e.clientY), dt = e.dataTransfer;
    if(dt.files && dt.files.length){ images(dt.files, p.x, p.y); return; }
    var u = dt.getData("text/uri-list") || dt.getData("text/plain");
    if(u && /^https?:\/\//i.test(u.trim())) lien(p.x, p.y, u.trim().split(/\s/)[0], "");
    else if(u) note(p.x, p.y, u);
  });

  /* Coller : une image devient une carte image, une adresse un lien, un texte
     une note — posés au centre de la vue. */
  document.addEventListener("paste", function(e){
    if(!dans() || !racine || !racine.isConnected) return;
    var a = document.activeElement;
    if(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
    var dt = e.clipboardData, c = centreVue();
    var fichiers = Array.prototype.filter.call(dt.files || [], imageAdmise);
    if(fichiers.length){ e.preventDefault(); images(fichiers, c.x, c.y); return; }
    var t = (dt.getData("text/plain") || "").trim();
    if(!t) return;
    e.preventDefault();
    if(/^https?:\/\/\S+$/i.test(t)) lien(c.x, c.y, t, "");
    else note(c.x, c.y, t);
  });
}
var espace = false;

/* ---------- hors du groupe ---------- */
function invite(){
  var s = el("section", "tab-vide fx-hors");
  s.appendChild(el("h2", null, "02 Forensics"));
  s.appendChild(el("p", null, supaOn()
    ? "La planche appartient au groupe : images, notes et liens s'y posent pour tous ses membres. Connecte-toi pour l'ouvrir."
    : "La base n'est pas configurée : la planche du groupe ne peut pas s'ouvrir."));
  if(supaOn()){
    var b = el("button", "btn btn--primary", CPT.statut === "charge" ? "Un instant…" : "Se connecter");
    b.type = "button";
    b.disabled = CPT.statut === "charge";
    b.addEventListener("click", function(){ ouvrirProfil(); });
    s.appendChild(b);
  }
  return s;
}

/* ---------- l'entrée ----------
   La planche se construit une fois et se RACCROCHE : un redimensionnement ou
   l'ouverture de la barre latérale refont le rendu, et la reconstruire perdrait
   la carte en cours de modification. Elle se relit quand on change de groupe,
   quand on revient sur l'onglet après un moment, et quand la fenêtre reprend
   le focus — c'est là que l'autre a pu poser quelque chose. */
var abonne = false;
export function forensicsVue(host, rendre){
  rerendre = rendre;
  if(!abonne){
    abonne = true;
    var statut = CPT.statut, eq = CPT.equipe && CPT.equipe.id;
    onCompte(function(){
      var e2 = CPT.equipe && CPT.equipe.id;
      if(CPT.statut === statut && e2 === eq) return;
      statut = CPT.statut; eq = e2;
      if(dans() && rerendre) rerendre();
    });
    window.addEventListener("focus", function(){ if(dans() && connecte()) charger(); });
  }
  if(!connecte()){ host.appendChild(invite()); return; }
  if(!racine) construire();
  host.appendChild(racine);
  requestAnimationFrame(appliquerVue);
  if(equipeLue !== CPT.equipe.id || Date.now() - lueA > 30000) charger();
  else dessiner();
}
