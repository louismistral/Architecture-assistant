/* ============================================================================
   LA NOTE D'UN BÂTIMENT — une seule façon de la montrer

   Les deux notes sur 100, Massing et Typologies, en grand ; puis chaque axe du jugement, sa barre
   et son score ; puis, repliés, les sous-axes et leurs critères — d'où vient
   chaque score : mesuré, ou non mesuré — un critère sans mesure ne compte
   pas dans la note.

   `j` : le résultat de `data/jugement.js — noter()`. Une variante
   d'avant les mesures n'a que sa note enregistrée : `o.ancienne`.
   ========================================================================= */
import { el } from "../core/format.js";
import { AXES, CRITERES, NOTES } from "../data/jugement.js";

var DE = { mesure:"mesuré", "non mesuré":"non mesuré", "sans objet":"sans objet", "éteint":"éteint" };

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
  col.appendChild(el("span", "label", "Massing"));
  var total = j ? j.total : o.ancienne;
  var gros = el("b", "vm-note__n mono" + (total != null ? " is-haut" : ""), total == null ? "—" : String(total));
  if(total != null) gros.appendChild(el("span", "vm-note__s", "/100"));
  col.appendChild(gros);
  tete.appendChild(col);
  if(j){
    var ct = el("div", "vm-note__g"), tt = j.typo.total;
    ct.appendChild(el("span", "label", "Typologies"));
    var gt = el("b", "vm-note__n mono" + (tt != null ? " is-haut" : ""), tt == null ? "—" : String(tt));
    if(tt != null) gt.appendChild(el("span", "vm-note__s", "/100"));
    ct.appendChild(gt);
    tete.appendChild(ct);
  }
  tete.appendChild(el("p", null, o.texte || (j
    ? "Le bâtiment vu par le jury, par ses seules mesures et les notes posées à la main : "
      + Math.round(j.couv * 100) + " % du poids est lu. Moyenne géométrique des axes — un axe faible "
      + "ne se rachète pas."
    : "Une note d'un ancien juge : « Reload » mesure la variante et la renote.")));
  s.appendChild(tete);
  if(!j) return s;

  NOTES.forEach(function(nt){
  var J = nt.id === "typo" ? j.typo : j;
  s.appendChild(el("h5", "vm-rang label", nt.n));
  AXES.forEach(function(a){
    var aj = J.axes.filter(function(x){ return x.id === a.id; })[0];
    if(aj.s == null && !CRITERES.some(function(x){ return x.note === nt.id && a.sous.some(function(sx){ return x.axes[sx.id]; }); })) return;
    var d = el("details", "vm-axe");
    var sm = el("summary", "vm-axe__h");
    sm.appendChild(el("span", "vm-axe__n", a.n));
    sm.appendChild(barre(aj.s));
    sm.appendChild(el("b", "mono", pct(aj.s)));
    d.appendChild(sm);
    aj.sous.forEach(function(sx){
      if(a.sous.length > 1) d.appendChild(el("h5", "vm-rang label", sx.n + " — " + pct(sx.s)));
      CRITERES.filter(function(x){ return x.axes[sx.id] && x.note === nt.id; }).forEach(function(x){
        var c = j.crit[x.id], r = el("div", "vm-c");
        r.appendChild(el("i", "chip chip--" + (c.de === "mesure" ? (c.s >= .75 ? "ok" : c.s >= .4 ? "soft" : "warn") : "soft"),
          c.s == null ? DE[c.de] || c.de : pct(c.s)));
        r.appendChild(el("span", "vm-c__n", x.n));
        r.appendChild(el("span", "vm-c__t", DE[c.de] || c.de));
        d.appendChild(r);
      });
    });
    s.appendChild(d);
  });
  });
  return s;
}
