/* ============================================================================
   LA NOTE D'UNE COMPOSITION — une seule façon de la dessiner

   Le total en grand, puis un critère par ligne : ce qu'il rapporte à droite du
   zéro, en vert, ce qu'il coûte à gauche, en rouge ; les critères à zéro sont
   rassemblés sur une ligne en bas. Le volet « Contraintes » du massing et la
   fiche d'une variante l'appellent tous deux : il n'y a pas deux dessins.

   `crit` : `[{ n, pts }]` — `mass/juge.js — noter()`. Les variantes enregistrées
   avant l'abandon des points portent la même forme et se lisent pareil.
   ========================================================================= */
import { el } from "../core/format.js";

function signe(x){ return (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(Math.round(x)); }

function ligne(c, max){
  var d = el("div", "vm-c");
  d.appendChild(el("span", "vm-c__n", c.n));
  if(c.txt) d.lastChild.title = c.txt;
  var t = el("span", "vm-c__t");
  var bar = el("span", "vm-c__b");
  var p = Math.min(1, Math.abs(c.pts) / (max || 1));
  bar.style.width = (p * 50) + "%";
  if(c.pts >= 0){ bar.style.left = "50%"; bar.classList.add("is-haut"); }
  else { bar.style.left = (50 - p * 50) + "%"; bar.classList.add("is-bas"); }
  t.appendChild(el("span", "vm-c__z"));
  t.appendChild(bar);
  d.appendChild(t);
  var v = el("b", "vm-c__v mono", signe(c.pts));
  if(c.pts > 0) v.classList.add("is-haut");
  if(c.pts < 0) v.classList.add("is-bas");
  d.appendChild(v);
  return d;
}

export function noteVue(total, crit, texte){
  var s = el("div", "vm-noteb");
  var tete = el("div", "vm-note");
  var col = el("div", "vm-note__g");
  col.appendChild(el("span", "label", "Note"));
  var gros = el("b", "vm-note__n mono", total == null ? "—" : signe(total));
  if(total != null) gros.classList.add(total >= 0 ? "is-haut" : "is-bas");
  col.appendChild(gros);
  tete.appendChild(col);
  tete.appendChild(el("p", null, texte || ("La somme des " + (crit || []).length
    + " critères de la composition, sur 100 — une composition qui répond pleinement à "
    + "tout vaut 100. Elle sert à lire, pas à choisir : le générateur "
    + "suit la hiérarchie — contraintes dures, priorités fortes, préférences.")));
  s.appendChild(tete);
  var L = (crit || []).filter(function(c){ return Math.round(c.pts) !== 0; })
                      .sort(function(a, b){ return b.pts - a.pts; });
  var max = L.reduce(function(m, c){ return Math.max(m, Math.abs(c.pts)); }, 1);
  L.forEach(function(c){ s.appendChild(ligne(c, max)); });
  var nuls = (crit || []).filter(function(c){ return Math.round(c.pts) === 0; });
  if(nuls.length){
    var z = el("div", "vm-c vm-nuls");
    z.appendChild(el("span", "vm-c__n", nuls.map(function(c){ return c.n; }).join(", ")));
    z.appendChild(el("b", "vm-c__v mono", "0"));
    s.appendChild(z);
  }
  return s;
}
