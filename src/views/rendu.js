/* ============================================================================
   RENDU — les planches de chaque étape, prêtes à imprimer

   Un volet par étape (`ETAPES`, `data/planches.js`). Une planche est une
   fonction qui rend un dessin vectoriel (`core/pdf.js — trace`) ; la même
   sert à l'aperçu (SVG) et au fichier (PDF). Le massing en a deux : le plan de
   situation, posé SUR la base du géomètre, et la planche de diagrammes.
   ========================================================================= */
import { el } from "../core/format.js";
import { pdfNeuf, pdfSur, telecharger } from "../core/pdf.js";
import { BASE, ETAPES, FORMATS, MIDTERM } from "../data/planches.js";
import { MASS } from "../mass/model.js";
import { planSituation } from "../rendu/siteplan.js";
import { planDiagrammes } from "../rendu/diagramme.js";
import { planMidterm } from "../rendu/midterm.js";

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
      dessin:function(){ return planMidterm(vols()); }, fond:MIDTERM.apercu,
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
    b.disabled = false;
    b.addEventListener("click", function(){
      b.disabled = true;
      p.fichier(t).then(function(o){ telecharger(o, "saxon-" + (p.id === "midterm" ? "" : "massing-") + p.id + "-" + graine() + ".pdf"); })
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
  if(!e.pret || !PLANCHES[e.id]){
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
  PLANCHES[e.id].forEach(function(p){ g.appendChild(carte(p)); });
  s.appendChild(g);
  return s;
}
