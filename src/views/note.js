/* ============================================================================
   LE SCORE D'UNE COMPOSITION — une seule façon de le montrer

   Le score global sur 100, en grand ; puis chaque critère sous son rang —
   priorité forte, préférence —, avec son état : favorable, neutre,
   défavorable, ou désactivé. AUCUN chiffre par critère : ce qu'un critère pèse
   est une affaire de rang, pas de points à lire. Le volet « Contraintes » du
   massing et la fiche d'une variante l'appellent tous deux.

   `crit` : `[{ n, rang, niv, txt, actif }]` — `mass/juge.js — noter()`. Les
   variantes enregistrées avant ce score n'ont que `n` (et `pts`) : on les
   liste sans état.
   ========================================================================= */
import { el } from "../core/format.js";

var ETAT = [["warn", "défavorable"], ["soft", "neutre"], ["ok", "favorable"]];
var RANGS = [["forte", "Priorités fortes"], ["pref", "Préférences"]];

function ligne(c){
  var d = el("div", "vm-c" + (c.actif === false ? " is-off" : ""));
  var t = c.actif === false ? ["soft", "désactivé"] : ETAT[c.niv];
  if(t) d.appendChild(el("i", "chip chip--" + t[0], t[1]));
  d.appendChild(el("span", "vm-c__n", c.n));
  if(c.txt) d.appendChild(el("span", "vm-c__t", c.txt));
  return d;
}

export function noteVue(total, crit, texte){
  var s = el("div", "vm-noteb");
  var tete = el("div", "vm-note");
  var col = el("div", "vm-note__g");
  col.appendChild(el("span", "label", "Score global"));
  var gros = el("b", "vm-note__n mono" + (total != null ? " is-haut" : ""),
    total == null ? "—" : String(Math.round(total)));
  if(total != null) gros.appendChild(el("span", "vm-note__s", "/100"));
  col.appendChild(gros);
  tete.appendChild(col);
  tete.appendChild(el("p", null, texte || (total != null
    ? "✓ Toutes les règles dures sont respectées. 100 est la meilleure composition selon "
      + "les priorités et préférences actives ; une priorité forte pèse plus qu'une préférence."
    : "Une règle dure n'est pas respectée : une telle composition n'a pas de score.")));
  s.appendChild(tete);
  crit = crit || [];
  if(crit.some(function(c){ return c.rang; })){
    RANGS.forEach(function(g){
      var L = crit.filter(function(c){ return c.rang === g[0]; });
      if(!L.length) return;
      s.appendChild(el("h5", "vm-rang label", g[1]));
      L.forEach(function(c){ s.appendChild(ligne(c)); });
    });
  } else crit.forEach(function(c){ s.appendChild(ligne(c)); });
  return s;
}
