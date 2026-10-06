/* ============================================================================
   RENDU — les planches de chaque étape, prêtes à imprimer

   Un volet par étape (`ETAPES`, `data/planches.js`). Une planche est une
   fonction qui rend un dessin vectoriel (`core/pdf.js — trace`) ; la même
   sert à l'aperçu (SVG) et au fichier (PDF). Le massing en a deux : le plan de
   situation, posé SUR la base du géomètre, et la planche de diagrammes.
   ========================================================================= */
import { el } from "../core/format.js";
import { dxf, pdfNeuf, pdfSur, telecharger } from "../core/pdf.js";
import { AXO, BASE, ETAGES, ETAPES, FINAL, FORMATS, MIDTERM } from "../data/planches.js";
import { MASS } from "../mass/model.js";
import { planSituation } from "../rendu/siteplan.js";
import { planDiagrammes } from "../rendu/diagramme.js";
import { planMidterm, planMidterm2 } from "../rendu/midterm.js";
import { cadrage, planEtage } from "../rendu/etages.js";
import { axoEclatee, axoVolume } from "../rendu/axo.js";
import { finalExplicative, finalNiveauxFacades, finalRez, finalSituation } from "../rendu/final.js";
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
      dessin:function(){ return planMidterm(vols()); }, fond:MIDTERM.apercu,
      /* la seconde page, sur les plans des Typologies */
      suite:function(){ return plansTypo().then(function(N){ return planMidterm2(N, cadrage(N)); }); },
      fond2:MIDTERM.apercu2,
      nom:"saxon-midterm",
      fichier:function(t, t2){ return base(MIDTERM.pdf).then(function(b){ return pdfSur(b, t, t2); }); } }
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

/* Les formats d'export. Le PDF s'imprime tel quel (sur sa base s'il en a une) ;
   le SVG s'ouvre dans Illustrator, le DXF dans AutoCAD, Rhino, Archicad —
   polylignes, hachures, textes, à retravailler comme un dessin fait à la main,
   sans la base du géomètre ni le gabarit. Le choix vaut pour toutes les cartes. */
var EXPORT = "pdf";
var SORTIES = {
  pdf: { n:"PDF", type:"application/pdf", fichier:function(p, t, t2){ return p.fichier(t, t2); } },
  svg: { n:"SVG", type:"image/svg+xml", fichier:function(p, t, t2){ return Promise.resolve([t, t2].filter(Boolean).map(function(x){ return x.svg(); })); } },
  dxf: { n:"DXF", type:"application/dxf", fichier:function(p, t, t2){ return Promise.resolve(dxf(t, t2)); } }
};

function carte(p){
  var c = el("article", "rd-carte");
  var h = el("header", "rd-carte__h");
  h.appendChild(el("h2", null, p.n));
  h.appendChild(el("span", "rd-carte__s mono", p.spec));
  /* l'export, en tête : le format, puis le bouton */
  var act = el("div", "rd-carte__a");
  var g = el("div", "btn-group");
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", "Format d'export");
  var b = el("button", "btn btn--primary");
  b.type = "button"; b.disabled = true; b.setAttribute("data-vue", "");
  function libelle(){
    b.textContent = "Exporter en " + SORTIES[EXPORT].n + (EXPORT === "pdf" ? " (" + FORMATS[p.format || "A2"].n + ")" : "");
    g.querySelectorAll(".btn").forEach(function(x){ x.setAttribute("aria-pressed", String(x.dataset.f === EXPORT)); });
  }
  Object.keys(SORTIES).forEach(function(f){
    var x = el("button", "btn", SORTIES[f].n);
    x.type = "button"; x.dataset.f = f; x.setAttribute("data-vue", "");
    x.title = { pdf:"Pour imprimer, sur la base du géomètre ou le gabarit", svg:"Pour Illustrator : calques, aplats et textes modifiables",
      dxf:"Pour AutoCAD, Rhino, Archicad : polylignes, hachures et textes modifiables, en mm sur le papier" }[f];
    x.addEventListener("click", function(){
      EXPORT = f;
      document.querySelectorAll(".rd-carte__a").forEach(function(a){ a.libelle(); });
    });
    g.appendChild(x);
  });
  act.libelle = libelle;
  act.appendChild(g); act.appendChild(b);
  h.appendChild(act);
  libelle();
  c.appendChild(h);
  var zone = el("div", "rd-carte__z");
  zone.appendChild(el("p", "rd-attente", "Calcul de la planche…"));
  c.appendChild(zone);
  var note = el("p", "rd-note");
  c.appendChild(note);
  /* la page s'affiche d'abord, la planche ensuite */
  setTimeout(function(){
    var t;
    try { t = p.dessin(); }
    catch(e){ zone.textContent = "La planche n'a pas pu être dessinée : " + e.message; return; }
    zone.replaceChildren(apercu(t, p.fond));
    /* la page suivante, si la planche en a une : dessinée à son tour */
    var t2 = null, prete = Promise.resolve();
    if(p.suite){
      var at2 = el("p", "rd-attente", "Calcul de la page suivante…");
      zone.appendChild(at2);
      prete = p.suite().then(function(x){ t2 = x; at2.replaceWith(apercu(x, p.fond2)); })
        .catch(function(e){ at2.textContent = "La page suivante n'a pas pu être dessinée : " + e.message; });
    }
    prete.then(function(){ b.disabled = false; });
    b.addEventListener("click", function(){
      var f = EXPORT, so = SORTIES[f], nom = (p.nom || "saxon-massing-" + p.id) + "-" + graine();
      b.disabled = true; note.textContent = "";
      so.fichier(p, t, t2).then(function(o){
        /* le SVG : un fichier par page */
        if(Array.isArray(o)) o.forEach(function(x, i){ telecharger(x, nom + (o.length > 1 ? "-p" + (i + 1) : "") + ".svg", so.type); });
        else telecharger(o, nom + "." + f, so.type);
      }).catch(function(e){ note.textContent = e.message; })
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
  if(!e.pret || !(PLANCHES[e.id] || e.id === "typologies" || e.id === "final")){
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
  else if(e.id === "final") final(g);
  else PLANCHES[e.id].forEach(function(p){ g.appendChild(carte(p)); });
  s.appendChild(g);
  return s;
}

/* Les plans d'étage : la page des Typologies, chargée hors de la vue, rend la
   géométrie de chaque niveau ; une carte, un PDF par niveau. */
/* Les plans des Typologies, niveau par niveau : la page des plans, chargée
   hors de la vue, les dessine et en rend la géométrie (`typoPlanches`). Une
   seule fois par passage dans le Rendu. */
var PLANS = null;
function plansTypo(){
  if(PLANS) return PLANS;
  PLANS = new Promise(function(ok, ko){
    typoHote();
    var fr = el("iframe", "rd-hors");
    fr.src = "src/typo/plans.html";
    fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
    fr.addEventListener("load", function(){
      var N = null, err = null;
      try { N = fr.contentWindow.typoPlanches ? fr.contentWindow.typoPlanches() : null; } catch(e){ err = e; }
      fr.remove();
      if(N) ok(N); else ko(err || new Error("aucun plan"));
    });
    document.body.appendChild(fr);
  });
  PLANS.catch(function(){ PLANS = null; });
  return PLANS;
}

function etages(g){
  var att = el("p", "rd-attente", "Calcul des plans des Typologies…");
  g.appendChild(att);
  plansTypo().then(function(N){
    var cad = cadrage(N);
    att.remove();
    g.appendChild(carte({ id:"axo", n:"Axonométrie", format:AXO.format, nom:"saxon-typologie-axonometrie",
      spec:AXO.format + " paysage · le volume, nommé par programme · PDF vectoriel",
      dessin:function(){ return axoVolume(N); }, fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }));
    g.appendChild(carte({ id:"eclatee", n:"Axonométrie éclatée", format:AXO.format, nom:"saxon-typologie-axonometrie-eclatee",
      spec:AXO.format + (AXO.eclateePortrait ? " portrait" : " paysage") + " · un plan par niveau, murs coupés · PDF vectoriel",
      dessin:function(){ return axoEclatee(N); }, fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }));
    N.slice().sort(function(a, b){ return a.lvl - b.lvl; }).forEach(function(n){
      g.appendChild(carte({ id:"etage-" + n.i, n:n.name, format:cad.format, nom:"saxon-typologie-" + n.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        spec:cad.format + " paysage · 1:" + ETAGES.echelle + " · PDF vectoriel",
        dessin:function(){ return planEtage(n, cad); },
        fichier:function(t){ return Promise.resolve(pdfNeuf(t)); } }));
    });
  }).catch(function(e){ att.textContent = "Les plans n'ont pas pu être lus : " + e.message; });
}

/* LE RENDU FINAL — les cinq planches A1 du règlement (`rendu/final.js`). La
   situation se dessine tout de suite ; les quatre autres attendent les plans
   des Typologies. */
function final(g){
  var neuf = function(t){ return Promise.resolve(pdfNeuf(t)); }, spec = FINAL.format + " paysage · ";
  g.appendChild(carte({ id:"final-1", n:"1 · Situation", format:FINAL.format, nom:"saxon-final-1-situation",
    spec:spec + "1:500 · sur la base du géomètre", dessin:function(){ return finalSituation(vols()); }, fond:FINAL.apercu,
    fichier:function(t){ return base(FINAL.pdf).then(function(b){ return pdfSur(b, t); }); } }));
  var att = el("p", "rd-attente", "Calcul des plans des Typologies…");
  g.appendChild(att);
  plansTypo().then(function(N){
    var cad = cadrage(N), p34 = null;
    /* les planches 3 et 4 se rangent ensemble : ce qui déborde de l'une va à l'autre */
    function deux(){ return p34 || (p34 = finalNiveauxFacades(N, cad, vols())); }
    att.remove();
    [["2 · Plan du rez-de-chaussée", "rez", "1:" + FINAL.echelle + " · trait noir · abords", function(){ return finalRez(N, cad, vols()); }],
     ["3 · Plans des niveaux", "niveaux", "1:" + FINAL.echelle + " · trait noir", function(){ return deux().t3; }],
     ["4 · Façades et coupes", "facades-coupes", "1:" + FINAL.echelle + " · trait noir · terrain naturel", function(){ return deux().t4; }],
     ["5 · Planche explicative", "explicative", "rendu libre", function(){ return finalExplicative(N, vols()); }]
    ].forEach(function(x, i){
      g.appendChild(carte({ id:"final-" + (i + 2), n:x[0], format:FINAL.format, nom:"saxon-final-" + (i + 2) + "-" + x[1],
        spec:spec + x[2], dessin:x[3], fichier:neuf }));
    });
  }).catch(function(e){ att.textContent = "Les plans n'ont pas pu être lus : " + e.message; });
}
