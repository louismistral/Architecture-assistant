import { fmt } from "../core/format.js";
import { squarest } from "../core/geometry.js";
import { ITEMS, recompute } from "../core/model.js";
import { applyRoom, buildList, drawProps, elOf, layout, planNode, pushUndo, sel, snap } from "./editor.js";
import { drawLinks } from "./links.js";
import { RMAP, ROOMS } from "./rooms.js";
import { saveSoon } from "./store.js";
import { renderLegend } from "../views/legend.js";
import { renderTotals } from "../views/render.js";

export var ITEMBYKEY = {}; ITEMS.forEach(function(it){ ITEMBYKEY[it.key] = it; });
export function itemOf(id){ return ITEMBYKEY[RMAP[id].key]; }
/* Une pièce représentative pour un poste du programme : permet de saisir une
   surface depuis l'onglet Programme, où l'on tient un poste et non une pièce. */
export function roomForKey(key){
  for(var i = 0; i < ROOMS.length; i++) if(ROOMS[i].key === key) return ROOMS[i].id;
  return null;
}
export var userAreas = {};

/* Change la surface d'un poste « à préciser » et propage partout. */
export function setPosteArea(id, v){
  var it = itemOf(id), g = RMAP[id].g;
  pushUndo(sibsOf(id));
  it.u = v; it.set = 1;
  userAreas[it.key] = v;
  recompute();
  var d = squarest(v);
  ROOMS.forEach(function(r){
    if(r.g !== g) return;
    r.a = v; r.w = d.w; r.h = d.h;
    var L = layout[r.id], cx = L.x + L.w / 2, cy = L.y + L.h / 2;
    L.w = d.w; L.h = d.h;
    L.x = snap(cx - d.w / 2); L.y = snap(cy - d.h / 2);
    var d0 = elOf[r.id];                 /* null tant que le plan n'a pas été ouvert */
    var ra = d0 && d0.querySelector(".ra");
    if(ra) ra.textContent = fmt(v) + " m²";
    applyRoom(r.id);
  });
  renderLegend();
  renderTotals();
  updatePlanHead();
  buildList();
  drawProps();
  drawLinks();
  saveSoon();
}
export function updatePlanHead(){
  if(!planNode) return;
  var posed = ROOMS.reduce(function(t, r){ return t + r.a; }, 0);
  var pe = ROOMS.reduce(function(t, r){ return t + (r.est ? r.a : 0); }, 0);
  var sp = planNode.querySelectorAll(".panel-head .pct")[0];
  if(sp) sp.textContent = fmt(posed) + " m² d\u2019emprise, dont " + fmt(pe) + " à préciser";
}

export var syncOn = true;
export function toggleSync(){ syncOn = !syncOn; return syncOn; }

export function sibsOf(id){
  var g = RMAP[id].g, out = [];
  ROOMS.forEach(function(r){ if(r.g === g) out.push(r.id); });
  return out;
}
export function groupOf(id){ return syncOn ? sibsOf(id) : [id]; }
export function syncSiblings(id, w, h){
  if(!syncOn) return;
  var g = RMAP[id].g;
  ROOMS.forEach(function(r){
    if(r.g !== g || r.id === id) return;
    var L = layout[r.id], cx = L.x + L.w / 2, cy = L.y + L.h / 2;
    L.w = w; L.h = h;
    L.x = snap(cx - w / 2); L.y = snap(cy - h / 2);
    applyRoom(r.id);
  });
}
export function markSiblings(){
  ROOMS.forEach(function(r){ elOf[r.id].classList.remove("sib"); });
  if(!sel || !syncOn) return;
  var g = RMAP[sel].g;
  ROOMS.forEach(function(r){ if(r.g === g && r.id !== sel) elOf[r.id].classList.add("sib"); });
}

