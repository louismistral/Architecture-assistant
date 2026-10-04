/* ============================================================================
   RENDU — les planches de chaque étape, prêtes à imprimer

   Un volet par étape (`ETAPES`, `data/planches.js`). Une planche est une
   fonction qui rend un dessin vectoriel (`core/pdf.js — trace`) ; la même
   sert à l'aperçu (SVG) et au fichier (PDF). Le massing en a deux : le plan de
   situation, posé SUR la base du géomètre, et la planche de diagrammes.
   ========================================================================= */
import { el } from "../core/format.js";
import { pdfNeuf, pdfSur, telecharger } from "../core/pdf.js";
import { AXO, BASE, ETAGES, ETAPES, FORMATS, MIDTERM } from "../data/planches.js";
import { MASS } from "../mass/model.js";
import { planSituation } from "../rendu/siteplan.js";
import { planDiagrammes } from "../rendu/diagramme.js";
import { planMidterm } from "../rendu/midterm.js";
import { cadrage, planEtage } from "../rendu/etages.js";
import { axoEclatee, axoVolume } from "../rendu/axo.js";
import { typoHote } from "./render.js";

var OCTETS = {};
function base(pdf){
  if(!OCTETS[pdf]) OCTETS[pdf] = fetch(pdf).then(function(r){
    if(!r.ok) throw new Error(pdf + " introuvable");
    return r.arrayBuffer();
  }).then(function(b){ return new Uint8Array(b); });
  return OCTETS[pdf];
}
function vols(){ var v = MASS.vol; v.ponts = MASS.pont; return v; }
function graine(){ return ((MASS.graine || 0) >>> 0).toString(36); }

/* Les planches du massing. `fond` : l'image de la base sous l'aperçu. */
var PLANCHES = {
  massing: [
    { id:"situation", n:"Plan de situation", spec:"A2 paysage · 1:" + BASE.echelle + " · PDF vectoriel",
      dessin:function(){ return planSituation(vols()); }, fond:BASE.apercu,
      fichier:function(t){ return base(BASE.pdf).then(function(b){ return pdfSur(b, t); }); } },
    { id:"diagrammes", n:"Diagrammes", spec:"A2 paysage · PDF vectoriel",
      dessin:function(){ return planDiagrammes(vols()); },
      fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }
  ],
  midterm: [
    { id:"midterm", n:"Midterm", format:MIDTERM.format,
      spec:"2 pages A1 paysage · gabarit MID_TERM · site plan 1:" + BASE.echelle + ", nord en haut · PDF vectoriel",
      dessin:function(){ return planMidterm(vols()); }, fond:MIDTERM.apercu, suite:[MIDTERM.apercu2],
      nom:"saxon-midterm",
      fichier:function(t){ return base(MIDTERM.pdf).then(function(b){ return pdfSur(b, t); }); } }
  ]
};

/* L'aperçu : le SVG de la planche, avec son fond s'il en a un. */
export function apercu(t, fond){
  var s = t.svg();
  if(fond) s = s.replace(/>/, '><image href="' + fond + '" x="0" y="0" width="' + t.w + '" height="' + t.h + '" preserveAspectRatio="none"/>');
  var d = el("div", "rd-apercu");
  d.innerHTML = s;
  return d;
}

function carte(p){
  var c = el("article", "rd-carte");
  var h = el("header", "rd-carte__h");
  h.appendChild(el("h2", null, p.n));
  h.appendChild(el("span", "rd-carte__s mono", p.spec));
  c.appendChild(h);
  var zone = el("div", "rd-carte__z");
  zone.appendChild(el("p", "rd-attente", "Calcul de la planche…"));
  c.appendChild(zone);
  var b = el("button", "btn btn--primary", "Télécharger le PDF (" + FORMATS[p.format || "A2"].n + ")");
  b.type = "button"; b.disabled = true;
  c.appendChild(b);
  var note = el("p", "rd-note");
  c.appendChild(note);
  /* la page s'affiche d'abord, la planche ensuite */
  setTimeout(function(){
    var t;
    try { t = p.dessin(); }
    catch(e){ zone.textContent = "La planche n'a pas pu être dessinée : " + e.message; return; }
    zone.replaceChildren(apercu(t, p.fond));
    /* les pages suivantes du fichier, telles quelles */
    (p.suite || []).forEach(function(src){
      var d = el("div", "rd-apercu"), im = el("img");
      im.src = src; im.alt = p.n + " — page suivante";
      d.appendChild(im); zone.appendChild(d);
    });
    b.disabled = false;
    b.addEventListener("click", function(){
      b.disabled = true;
      p.fichier(t).then(function(o){ telecharger(o, (p.nom || "saxon-massing-" + p.id) + "-" + graine() + ".pdf"); })
        .catch(function(e){ note.textContent = e.message; })
        .then(function(){ b.disabled = false; });
    });
  }, 30);
  return c;
}

export function renduVue(sub){
  var s = el("section", "rd");
  var e = ETAPES.filter(function(x){ return x.id === sub; })[0] || ETAPES[0];
  var h = el("header", "rd__h");
  h.appendChild(el("h1", null, "Rendu · " + e.n));
  if(!e.pret || !(PLANCHES[e.id] || e.id === "typologies")){
    h.appendChild(el("p", "rd__lead", "Les planches de cette étape sont à construire."));
    s.appendChild(h);
    return s;
  }
  h.appendChild(el("p", "rd__lead", "Les planches de l'étape, prêtes à imprimer : elles se refont à partir de la "
    + "composition à l'écran. Chaque fichier porte la graine du massing (" + graine() + ")."));
  s.appendChild(h);
  if(!MASS.vol.length){
    s.appendChild(el("p", "rd-attente", "Aucune volumétrie posée : lance d'abord « Shuffle massing » dans l'onglet Massing."));
    return s;
  }
  var g = el("div", "rd-grille");
  if(e.id === "typologies") etages(g);
  else PLANCHES[e.id].forEach(function(p){ g.appendChild(carte(p)); });
  s.appendChild(g);
  return s;
}

/* Les plans d'étage : la page des Typologies, chargée hors de la vue, rend la
   géométrie de chaque niveau ; une carte, un PDF par niveau. */
function etages(g){
  var att = el("p", "rd-attente", "Calcul des plans des Typologies…");
  g.appendChild(att);
  typoHote();
  var fr = el("iframe", "rd-hors");
  fr.src = "src/typo/plans.html";
  fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
  fr.addEventListener("load", function(){
    var N;
    try { N = fr.contentWindow.typoPlanches ? fr.contentWindow.typoPlanches() : null; }
    catch(e){ att.textContent = "Les plans n'ont pas pu être lus : " + e.message; }
    fr.remove();
    if(!N) return;
    var cad = cadrage(N);
    att.remove();
    g.appendChild(carte({ id:"axo", n:"Axonométrie", format:AXO.format, nom:"saxon-typologie-axonometrie",
      spec:AXO.format + " paysage · le volume sur la parcelle · PDF vectoriel",
      dessin:function(){ return axoVolume(vols()); }, fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }));
    g.appendChild(carte({ id:"eclatee", n:"Axonométrie éclatée", format:AXO.format, nom:"saxon-typologie-axonometrie-eclatee",
      spec:AXO.format + " paysage · un plan par niveau · PDF vectoriel",
      dessin:function(){ return axoEclatee(N); }, fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }));
    N.slice().sort(function(a, b){ return a.lvl - b.lvl; }).forEach(function(n){
      g.appendChild(carte({ id:"etage-" + n.i, n:n.name, format:cad.format, nom:"saxon-typologie-" + n.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        spec:cad.format + " paysage · 1:" + ETAGES.echelle + " · PDF vectoriel",
        dessin:function(){ return planEtage(n, cad); },
        fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }));
    });
  });
  document.body.appendChild(fr);
}
