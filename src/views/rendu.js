/* ============================================================================
   RENDU — les planches de chaque étape, prêtes à imprimer

   Un volet par étape (`ETAPES`, `data/planches.js`). Une planche est une
   fonction qui rend un dessin vectoriel (`core/pdf.js — trace`) ; la même
   sert à l'aperçu (SVG) et au fichier (PDF). Le massing en a deux : le plan de
   situation, posé SUR la base du géomètre, et la planche de diagrammes.
   ========================================================================= */
import { el } from "../core/format.js";
import { pdfNeuf, pdfSur, telecharger } from "../core/pdf.js";
import { BASE, ETAPES, FORMATS } from "../data/planches.js";
import { MASS } from "../mass/model.js";
import { planSituation } from "../rendu/siteplan.js";
import { planDiagrammes } from "../rendu/diagramme.js";

var BASE_OCTETS = null;
function base(){
  if(!BASE_OCTETS) BASE_OCTETS = fetch(BASE.pdf).then(function(r){
    if(!r.ok) throw new Error(BASE.pdf + " introuvable");
    return r.arrayBuffer();
  }).then(function(b){ return new Uint8Array(b); });
  return BASE_OCTETS;
}
function vols(){ var v = MASS.vol; v.ponts = MASS.pont; return v; }
function graine(){ return ((MASS.graine || 0) >>> 0).toString(36); }

/* Les planches du massing. `fond` : l'image de la base sous l'aperçu. */
var PLANCHES = {
  massing: [
    { id:"situation", n:"Plan de situation", spec:"A2 paysage · 1:500 · PDF vectoriel",
      d:"La base du géomètre, et dans la seule parcelle : la volumétrie à l'écran, dans le style de la base, "
        + "les voies, la baie des bus, la dépose-minute, les parkings, l'abri à vélos et le cheminement piéton.",
      dessin:function(){ return planSituation(vols()); }, fond:BASE.apercu,
      fichier:function(t){ return base().then(function(b){ return pdfSur(b, t); }); } },
    { id:"diagrammes", n:"Diagrammes", spec:"A2 paysage · PDF vectoriel",
      d:"Huit axonométries, du site au volume : les limites, le programme, le parti, l'empilement, "
        + "le soleil et la vue, la mobilité, le résultat et sa note.",
      dessin:function(){ return planDiagrammes(vols()); },
      fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }
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
  c.appendChild(el("p", "rd-carte__d", p.d));
  var zone = el("div", "rd-carte__z");
  zone.appendChild(el("p", "rd-attente", "Calcul de la planche…"));
  c.appendChild(zone);
  var b = el("button", "btn btn--primary", "Télécharger le PDF (" + FORMATS.A2.n + ")");
  b.type = "button"; b.disabled = true;
  c.appendChild(b);
  var note = el("p", "rd-note");
  c.appendChild(note);
  /* la mobilité demande une seconde : la page s'affiche d'abord */
  setTimeout(function(){
    var t;
    try { t = p.dessin(); }
    catch(e){ zone.textContent = "La planche n'a pas pu être dessinée : " + e.message; return; }
    zone.replaceChildren(apercu(t, p.fond));
    if(t.mobilite && t.mobilite.manque.length) note.textContent = "Ne tient pas dans la parcelle : " + t.mobilite.manque.join(", ") + ".";
    b.disabled = false;
    b.addEventListener("click", function(){
      b.disabled = true;
      p.fichier(t).then(function(o){ telecharger(o, "saxon-massing-" + p.id + "-" + graine() + ".pdf"); })
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
