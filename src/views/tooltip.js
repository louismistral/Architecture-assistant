import { el } from "../core/format.js";

/* ---------- tooltip ---------- */
export var tip = document.getElementById("tip");
export function showTip(target, x, y){
  var d = target.getAttribute("data-tip");
  if(!d) return;
  var p = d.split("|");
  while(tip.firstChild) tip.removeChild(tip.firstChild);
  tip.appendChild(el("span","t", p[0]));
  tip.appendChild(el("span","m", p[1]));
  if(p[2]) tip.appendChild(el("span", null, p[2]));
  tip.style.opacity = "1";
  tip.style.left = Math.min(Math.max(x, 90), window.innerWidth - 90) + "px";
  tip.style.top = Math.max(y - 12, 60) + "px";
}
/* Les deux porteurs d'infobulle : les blocs SVG des diagrammes du programme et
   les blocs du mixer, qui sont des div. Même contrat — `data-tip` en trois
   parties séparées par une barre verticale. */
var SEL = "g.blk,.mixblk";
document.addEventListener("pointermove", function(e){
  var g = e.target.closest ? e.target.closest(SEL) : null;
  if(g) showTip(g, e.clientX, e.clientY); else tip.style.opacity = "0";
});
document.addEventListener("focusin", function(e){
  var g = e.target.closest ? e.target.closest(SEL) : null;
  if(g){ var r = g.getBoundingClientRect(); showTip(g, r.left + r.width/2, r.top); }
  else tip.style.opacity = "0";
});


