/* ============================================================================
   LA NOTE D'UN BÂTIMENT — une seule façon de la montrer

   La note générale sur 100, en grand ; puis chaque axe du jugement, sa barre
   et son score ; puis, repliés, les sous-axes et leurs critères — d'où vient
   chaque score : mesuré, noté à la main, moyenne des notes des autres, ou
   neutre. La fiche d'une variante l'appelle, avec de quoi poser les notes
   manuelles.

   `j` : le résultat de `data/jugement.js — noter()`. `o.main` : les notes
   manuelles de la variante ; `o.poser(id, s)` : les écrire. Une variante
   d'avant les mesures n'a que sa note enregistrée : `o.ancienne`.
   ========================================================================= */
import { el } from "../core/format.js";
import { AXES, CRITERES } from "../data/jugement.js";

var DE = { mesure:"mesuré", main:"noté", moyenne:"moyenne des autres", neutre:"neutre",
           "sans objet":"sans objet", "éteint":"éteint" };
var NIVEAUX = [[0, "0"], [0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1, "1"]];

function pct(s){ return s == null ? "—" : Math.round(s * 100) + " %"; }
function barre(s){
  var b = el("span", "vm-bar");
  var f = el("i");
  f.style.inlineSize = (s == null ? 0 : Math.round(s * 100)) + "%";
  b.appendChild(f);
  return b;
}

export function noteVue(j, o){
  o = o || {};
  var s = el("div", "vm-noteb");
  var tete = el("div", "vm-note");
  var col = el("div", "vm-note__g");
  col.appendChild(el("span", "label", "Jugement"));
  var total = j ? j.total : o.ancienne;
  var gros = el("b", "vm-note__n mono" + (total != null ? " is-haut" : ""), total == null ? "—" : String(total));
  if(total != null) gros.appendChild(el("span", "vm-note__s", "/100"));
  col.appendChild(gros);
  tete.appendChild(col);
  tete.appendChild(el("p", null, o.texte || (j
    ? "Le bâtiment vu par le jury, par ses seules mesures et les notes posées à la main : "
      + Math.round(j.couv * 100) + " % du poids est lu. Moyenne géométrique des axes — un axe faible "
      + "ne se rachète pas."
    : "Une note d'un ancien juge : « Reload » mesure la variante et la renote.")));
  s.appendChild(tete);
  if(!j) return s;

  AXES.forEach(function(a){
    var aj = j.axes.filter(function(x){ return x.id === a.id; })[0];
    var d = el("details", "vm-axe");
    var sm = el("summary", "vm-axe__h");
    sm.appendChild(el("span", "vm-axe__n", a.n));
    sm.appendChild(barre(aj.s));
    sm.appendChild(el("b", "mono", pct(aj.s)));
    d.appendChild(sm);
    aj.sous.forEach(function(sx){
      if(a.sous.length > 1) d.appendChild(el("h5", "vm-rang label", sx.n + " — " + pct(sx.s)));
      CRITERES.filter(function(x){ return x.axes[sx.id]; }).forEach(function(x){
        var c = j.crit[x.id], r = el("div", "vm-c");
        r.appendChild(el("i", "chip chip--" + (c.de === "mesure" ? (c.s >= .75 ? "ok" : c.s >= .4 ? "soft" : "warn") : "soft"),
          c.s == null ? DE[c.de] || c.de : pct(c.s)));
        r.appendChild(el("span", "vm-c__n", x.n));
        r.appendChild(el("span", "vm-c__t", DE[c.de] || c.de));
        /* un critère sans mesure se note ici, sur cinq crans */
        if(!x.mesure && o.poser){
          var g = el("div", "btn-group vm-main");
          g.setAttribute("role", "group");
          g.setAttribute("aria-label", "Note de « " + x.n + " »");
          NIVEAUX.forEach(function(nv){
            var b = el("button", "btn", nv[1]);
            b.type = "button";
            var pris = o.main && o.main[x.id] === nv[0];
            b.setAttribute("aria-pressed", String(!!pris));
            b.title = pris ? "Effacer la note" : "Noter " + nv[1];
            b.addEventListener("click", function(){ o.poser(x.id, pris ? null : nv[0]); });
            g.appendChild(b);
          });
          r.appendChild(g);
        }
        d.appendChild(r);
      });
    });
    s.appendChild(d);
  });
  return s;
}
