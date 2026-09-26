/* ============================================================================
   LE VOLET « CONTRAINTES » DES DEUX OUTILS

   Le cahier des charges a le sien, et il montre ce que le RÈGLEMENT impose.
   Celui-ci est d'une autre nature : il montre ce que NOUS avons arbitré pour
   qu'un générateur produise quelque chose — et, à partir de là, plus rien n'est
   opposable. Tout y est un choix de projet, et tout s'y règle.

   Il répond à trois questions, dans cet ordre :

     1. QUELLES contraintes gouvernent ce que je vois ? Elles sont rangées de la
        plus dure à la plus molle, parce que c'est l'ordre dans lequel on les
        conteste : on ne discute pas les six mètres de l'AEAI, on discute le
        poids de l'alignement.
     2. QU'EST-CE QUE LE HASARD décide ? Un générateur dont on ne sait pas ce
        qu'il tire est un générateur qu'on subit.
     3. QUELS SCRIPTS produisent ce résultat, et sur quoi agissent-ils ?

   Les valeurs se saisissent ICI, dans la case même que le générateur lit
   (`src/data/doctrine.js`) : il n'y a pas de copie, donc rien ne peut diverger.
   Un bouton rejoue le tirage sans quitter le volet.
   ========================================================================= */
import { dec, el, fmt } from "../core/format.js";
import {
  DOC, docDefaut, docModifie, docReset, docSet, rangsDe, reglesDe,
  scriptsDe, tiragesDe
} from "../data/doctrine.js";

/* Un rang : le chapitre, et ce qu'il veut dire. Le nommer une fois en tête
   évite de le redire à chaque ligne. */
function rangHead(rg, n){
  var h = el("div", "doc-rang");
  h.appendChild(el("i", "chip chip--" + chipDe(rg.id), rg.n));
  h.appendChild(el("span", "doc-rang__n mono", n + (n > 1 ? " règles" : " règle")));
  h.appendChild(el("p", "doc-rang__d", rg.d));
  return h;
}
function chipDe(id){
  return id === "dure" ? "danger" : id === "ferme" ? "warn"
       : id === "forte" ? "ok" : "soft";
}
/* Ce qu'une règle dit de la composition à l'écran — jamais un nombre : une
   contrainte dure est respectée ou enfreinte, une priorité ou une préférence
   favorable, neutre ou défavorable. */
var ETAT = {
  dure: [["danger", "enfreinte"], null, ["ok", "respectée"]],
  autre: [["warn", "défavorable"], ["soft", "neutre"], ["ok", "favorable"]]
};
function etatChip(r, e){
  var t = ETAT[r.rang === "dure" ? "dure" : "autre"][e.niv] || ETAT.autre[1];
  var c = el("i", "chip chip--" + t[0], t[1]);
  if(e.txt) c.title = e.txt;
  return c;
}

/* Une règle. Quand elle porte une valeur, la valeur est SAISISSABLE : c'est
   tout le propos du volet. Quand elle n'en porte pas, c'est une règle de
   structure — elle s'applique ou non, et la changer demande de toucher au
   code ; la ligne dit alors où. */
function ligne(r, onChange, etat){
  var d = el("details", "doc-r" + (r.k && DOC[r.k] !== docDefaut(r.k) ? " is-off" : ""));
  var sm = el("summary", "doc-r__h");
  sm.appendChild(el("b", "doc-r__t", r.titre));
  var e = etat ? etat(r) : null;
  if(e) sm.appendChild(etatChip(r, e));
  var v = el("span", "doc-r__v mono");
  if(r.k) v.textContent = valTxt(r);
  else v.textContent = r.val || "—";
  sm.appendChild(v);
  d.appendChild(sm);

  var b = el("div", "doc-r__b");
  if(r.k){
    var l = el("label", "doc-r__set");
    l.appendChild(el("span", "doc-r__lab", "Valeur"));
    var inp = document.createElement("input");
    inp.type = "number"; inp.className = "mono";
    inp.min = String(r.min); inp.max = String(r.max); inp.step = String(r.pas);
    inp.value = String(r.pct ? Math.round(DOC[r.k] * 100) / 100 : DOC[r.k]);
    inp.addEventListener("change", function(){
      if(!docSet(r.k, inp.value)){ inp.value = String(DOC[r.k]); return; }
      v.textContent = valTxt(r);
      d.classList.toggle("is-off", DOC[r.k] !== docDefaut(r.k));
      if(onChange) onChange();
    });
    l.appendChild(inp);
    if(r.unite) l.appendChild(el("span", "doc-r__u", r.unite));
    b.appendChild(l);
    var def = el("p", "doc-r__def mono",
      "défaut " + (r.pct ? dec(docDefaut(r.k)) : docDefaut(r.k)));
    b.appendChild(def);
  }
  if(e && e.txt) b.appendChild(el("p", "doc-r__w", "À l'écran : " + e.txt));
  if(r.pourquoi) b.appendChild(el("p", "doc-r__w", r.pourquoi));
  var meta = el("dl", "doc-r__m");
  [["Source", r.source], ["Appliquée par", r.lu], ["Ce qu'elle change", r.agit]]
    .forEach(function(p){
      if(!p[1]) return;
      meta.appendChild(el("dt", null, p[0]));
      meta.appendChild(el("dd", p[0] === "Appliquée par" ? "mono" : null, p[1]));
    });
  b.appendChild(meta);
  d.appendChild(b);
  return d;
}
function valTxt(r){
  var x = DOC[r.k];
  if(r.pct) return Math.round(x * 100) + " %";
  return (Math.round(x * 100) / 100).toString().replace(".", ",")
       + (r.unite ? " " + r.unite : "");
}

/* ---------- le panneau ------------------------------------------------------
   `dom` vaut "mix" ou "mass" ; `rejouer` est le geste qui refait le tirage avec
   les valeurs qu'on vient de changer — sans lui, régler une contrainte ne
   montrerait rien, et il faudrait aller cliquer ailleurs pour voir l'effet. */
export function doctrineSection(dom, rejouer, extra, etat){
  var p = el("section", "panel doc");

  var hd = el("div", "panel-head");
  hd.appendChild(el("h3", null, dom === "mix"
    ? "Ce qui gouverne la répartition" : "Ce qui gouverne la volumétrie"));
  hd.appendChild(el("span", "pct mono", "src/data/doctrine.js"));
  p.appendChild(hd);
  p.appendChild(el("p", "panel-sub", dom === "mix"
    ? "Le cahier des charges dit ce que le règlement impose. Ici commence ce que "
      + "NOUS imposons : des arbitrages, des préférences et des poids, sans lesquels "
      + "aucun tirage ne rendrait autre chose qu'un remplissage. Rien n'est opposable, "
      + "tout se règle — et le tirage se rejoue sans quitter ce volet."
    : "Trois rangs, et aucun point. Le générateur jette toute variante qui enfreint une "
      + "CONTRAINTE DURE, écarte celles qu'une autre bat sur les PRIORITÉS FORTES, et ne "
      + "départage par les PRÉFÉRENCES que des variantes égales sur les fortes. Le parti est "
      + "tiré parmi tous ceux qui rendent une variante valide : la diversité est voulue. "
      + "Chaque ligne dit ce qu'elle pense de la composition à l'écran."));

  /* La barre d'action : rejouer, et rétablir. Elle est EN TÊTE parce qu'on y
     revient à chaque réglage, et qu'une commande qu'il faut aller chercher au
     bas d'une longue page n'est pas une commande. */
  var bar = el("div", "doc-bar");
  var bj = el("button", "btn btn--primary", dom === "mix"
    ? "Rejouer la répartition" : "Rejouer la volumétrie");
  bj.type = "button";
  bj.addEventListener("click", function(){ if(rejouer) rejouer(); });
  bar.appendChild(bj);
  var br = el("button", "btn btn--quiet", "Rétablir les valeurs d'origine");
  br.type = "button";
  br.disabled = !docModifie();
  br.addEventListener("click", function(){
    if(!docReset()) return;
    if(rejouer) rejouer(true);
  });
  bar.appendChild(br);
  bar.appendChild(el("span", "spacer"));
  if(docModifie()) bar.appendChild(el("i", "chip chip--warn", "doctrine modifiée"));
  p.appendChild(bar);

  /* --- ce qu'on regarde en ce moment : la note, ou la pile ---------------- */
  if(extra) p.appendChild(extra);

  /* --- les contraintes, de la plus dure à la plus molle ------------------- */
  var L = reglesDe(dom);
  rangsDe(dom).forEach(function(rg){
    var lot = L.filter(function(r){ return r.rang === rg.id; });
    if(!lot.length) return;
    var sec = el("section", "doc-sec");
    sec.appendChild(rangHead(rg, lot.length));
    lot.forEach(function(r){ sec.appendChild(ligne(r, function(){
      var b = document.querySelector(".doc-bar .btn--quiet");
      if(b) b.disabled = !docModifie();
    }, etat)); });
    p.appendChild(sec);
  });

  /* --- ce que le hasard décide ------------------------------------------- */
  var T = tiragesDe(dom);
  if(T.length){
    var dt = el("details", "disclose");
    dt.appendChild(el("summary", null, "Ce que le hasard décide — " + T.length
      + " tirages, et rien d'autre"));
    var ul = el("ul", "doc-tir");
    T.forEach(function(t){
      var li = el("li");
      li.appendChild(el("b", null, t.quoi + " — "));
      li.appendChild(document.createTextNode(t.comment));
      ul.appendChild(li);
    });
    dt.appendChild(ul);
    dt.appendChild(el("p", "cons__note", "Tout le reste est décidé par les contraintes "
      + "ci-dessus. Une graine rejoue un tirage à l'identique : sans elle, on tire dix "
      + "fois et la troisième, qui était la bonne, n'existe plus."));
    p.appendChild(dt);
  }

  /* --- les outils de génération ------------------------------------------- */
  var S = scriptsDe(dom);
  if(S.length){
    var ds = el("details", "disclose");
    ds.appendChild(el("summary", null, "Les scripts qui génèrent — " + S.length
      + " modules, et ce sur quoi ils agissent"));
    var tb = el("table", "doc-scr");
    var hr = el("tr");
    ["Module", "Ce qu'il lit", "Ce qu'il décide", "Ce sur quoi il agit", "Hasard"]
      .forEach(function(t){ var th = el("th", null, t); th.scope = "col"; hr.appendChild(th); });
    var th0 = el("thead"); th0.appendChild(hr); tb.appendChild(th0);
    var bd = el("tbody");
    S.forEach(function(x){
      var tr = el("tr");
      var c0 = el("th"); c0.scope = "row";
      c0.appendChild(el("b", null, x.n));
      c0.appendChild(el("span", "doc-scr__f mono", x.f));
      tr.appendChild(c0);
      tr.appendChild(el("td", null, x.lit));
      tr.appendChild(el("td", null, x.decide));
      tr.appendChild(el("td", null, x.agit));
      tr.appendChild(el("td", "doc-scr__h", x.hasard));
      bd.appendChild(tr);
    });
    tb.appendChild(bd);
    ds.appendChild(tb);
    p.appendChild(ds);
  }

  p.appendChild(el("p", "cons__note", "Une valeur réglée ici vit dans la mémoire de "
    + "cet appareil, avec la répartition et l'implantation. Pour qu'elle devienne celle "
    + "du projet, elle se corrige dans src/data/doctrine.js — qui est le seul endroit "
    + "où ces nombres existent."));
  return p;
}

/* ---------- le jugement de la composition posée -----------------------------
   « On obtient un tel résultat » : voilà pourquoi — sans un seul point. Les
   contraintes dures, respectées ou non ; puis chaque priorité et chaque
   préférence, favorable, neutre ou défavorable. Le détail est sur chaque ligne
   plus bas ; ici, d'un coup d'œil. */
export function jugementBloc(j){
  var s = el("section", "doc-note");
  if(!j){
    s.appendChild(el("p", "cons__note", "Aucune composition posée. « Shuffle massing » "
      + "en propose une."));
    return s;
  }
  s.appendChild(el("h4", "label", "La composition à l'écran"));
  var n = j.dures.filter(function(x){ return !x.pile; }).length;
  s.appendChild(el("p", "doc-note__i", n
    ? n + " contrainte" + (n > 1 ? "s dures enfreintes" : " dure enfreinte")
      + " : aucune variante valide n'a été trouvée, celle-ci est la moins fautive."
    : "Toutes les contraintes dures sont respectées."));
  [["Priorités fortes", j.fortes], ["Préférences", j.prefs]].forEach(function(g){
    var ul = el("ul", "doc-jug");
    ul.appendChild(el("li", "doc-jug__h", g[0]));
    g[1].forEach(function(c){
      var li = el("li");
      li.appendChild(etatChip({ rang:"forte" }, c));
      li.appendChild(el("b", null, c.n));
      li.appendChild(el("span", null, " — " + c.txt));
      ul.appendChild(li);
    });
    s.appendChild(ul);
  });
  return s;
}
/* Ce que le jugement dit d'une ligne de la table : l'id de la ligne est celui
   du critère. Une ligne sans critère (un sous-seuil, un paramètre) n'a rien à
   dire. */
export function etatDe(j){
  if(!j) return null;
  var F = {};
  j.fortes.concat(j.prefs).forEach(function(c){ F[c.id] = c; });
  var D = {};
  j.dures.forEach(function(x){ if(!D[x.k]) D[x.k] = x; });
  return function(r){
    if(r.rang === "dure")
      return D[r.id] ? { niv:0, txt:D[r.id].msg } : { niv:2, txt:"" };
    return F[r.id] || null;
  };
}

/* ---------- les piles que le site admet -------------------------------------
   Le mixer ne tire plus un nombre d'étages : il construit la liste des piles
   admissibles et en prend une. La montrer, c'est montrer d'où vient la pile
   qu'on a sous les yeux — et pourquoi il n'y en a pas d'autre. */
export function pilesBloc(piles){
  var s = el("section", "doc-note");
  s.appendChild(el("h4", "label", "Les piles que ce site admet"));
  s.appendChild(el("p", "doc-note__i", "Déduites de l'aire posable de la parcelle, de la "
    + "part qu'un plateau peut en prendre, et de ce que le règlement cloue au rez. Le "
    + "tirage en prend une, les plus compactes d'abord — il ne tire plus un nombre "
    + "d'étages au hasard pour le corriger ensuite."));
  var t = el("table", "doc-crit");
  var hr = el("tr", "doc-crit__t");
  ["Pile", "Plateau du rez", "Plateau d'étage", "Emprise admise"].forEach(function(x){
    var th = el("th", null, x); th.scope = "col"; hr.appendChild(th);
  });
  t.appendChild(hr);
  (piles || []).forEach(function(P){
    var tr = el("tr");
    tr.appendChild(el("td", null, (P.sous ? P.sous + " sous-sol · " : "")
      + "rez" + (P.up ? " + " + P.up + " étage" + (P.up > 1 ? "s" : "") : " seul")
      + (P.serre ? " — à l'étroit" : "")));
    tr.appendChild(el("td", "mono n", fmt(P.plate) + " m²"));
    tr.appendChild(el("td", "mono n", P.plateUp ? fmt(P.plateUp) + " m²" : "—"));
    tr.appendChild(el("td", "mono n", fmt(P.emprise) + " m²"));
    t.appendChild(tr);
  });
  s.appendChild(t);
  return s;
}
