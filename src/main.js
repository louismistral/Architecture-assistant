import { view } from "./core/viewstate.js";
import { renderLegend } from "./views/legend.js";
import { render } from "./views/render.js";
import { drawVol } from "./vol/volumes.js";

/* ---------- barres de contrôle ----------
   Chaque segment est une liste (id du bouton → valeur d'état) : la valeur
   n'est écrite qu'ici, et l'état `aria-pressed` en découle. */
var SEGMENTS = [
  { key:"grouping", pairs:[["grpChap","chap"],["grpFam","fam"],["grpSch","sch"],
                           ["grpPlan","plan"],["grpVol","vol"]] },
  { key:"mode",     pairs:[["modeAgg","agg"],["modeUnit","unit"]] }
];

function wireSegment(seg){
  var btns = seg.pairs.map(function(p){ return [document.getElementById(p[0]), p[1]]; });
  function paint(){
    btns.forEach(function(b){ b[0].setAttribute("aria-pressed", String(view[seg.key] === b[1])); });
  }
  btns.forEach(function(b){
    b[0].addEventListener("click", function(){ view[seg.key] = b[1]; paint(); render(); });
  });
  paint();
}
SEGMENTS.forEach(wireSegment);

renderLegend();
render();

var rt;
window.addEventListener("resize", function(){
  clearTimeout(rt);
  rt = setTimeout(function(){
    if(view.grouping === "vol") drawVol();
    else if(view.grouping !== "plan") render();
  }, 140);
});
