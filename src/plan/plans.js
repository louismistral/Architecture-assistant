import { el } from "../core/format.js";
import { fit, layout, pushUndo, sel, select } from "./editor.js";
import { FLOORS, OV, PLATE, TRAY, applyLevels, curFl, flCount, flShort, layoutPlates, packTray, refloor, trayRooms } from "./levels.js";
import { RMAP, ROOMS } from "./rooms.js";
import { saveSoon } from "./store.js";

export var SAVED = [], plansEl = null;
export function planSnapshot(name, kind){
  var lv = {}, rm = {};
  ROOMS.forEach(function(r){
    lv[r.id] = r.fl;
    var L = layout[r.id];
    if(L) rm[r.id] = { x: L.x, y: L.y, w: L.w, h: L.h };
  });
  return { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name, kind: kind || "manuel", at: Date.now(),
    lvls: FLOORS.map(function(F){ return F.lvl; }), plate: PLATE,
    levels: lv, rooms: rm };
}
export function planStamp(){
  var d = new Date();
  function p2(v){ return (v < 10 ? "0" : "") + v; }
  return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + " à " + p2(d.getHours()) + "h" + p2(d.getMinutes());
}
export function planLabel(){
  var parts = [];
  FLOORS.forEach(function(F, i){ if(flCount(i)) parts.push(flShort(i) + " " + flCount(i)); });
  return parts.join(" · ");
}
export function savePlan(name, kind){
  SAVED.unshift(planSnapshot(name || ("Plan manuel — " + planStamp()), kind));
  while(SAVED.length > 12) SAVED.pop();
  drawPlans(); saveSoon();
}
export function applyPlans(list){
  if(!list || !list.length) return;
  SAVED = list.slice(0, 12);
  drawPlans();
}
export function loadPlan(id){
  var pl = null, i;
  for(i = 0; i < SAVED.length; i++) if(SAVED[i].id === id) pl = SAVED[i];
  if(!pl) return;
  pushUndo(null);
  applyLevels(0, pl.levels, pl.plate, pl.lvls);
  ROOMS.forEach(function(r){
    var o = pl.rooms ? pl.rooms[r.id] : null;
    if(o && o.w > 0 && o.h > 0){ layout[r.id] = { x:o.x, y:o.y, w:o.w, h:o.h }; r.w = o.w; r.h = o.h; }
  });
  if(sel && RMAP[sel].fl !== curFl && !OV) select(null);
  if(trayRooms().length) packTray();
  if(OV) layoutPlates();
  refloor(); fit(); saveSoon();
}
export function dropPlan(id){
  SAVED = SAVED.filter(function(p){ return p.id !== id; });
  drawPlans(); saveSoon();
}
export function mountPlans(){ plansEl = el("div","plans"); return plansEl; }

export function drawPlans(){
  if(!plansEl) return;
  while(plansEl.firstChild) plansEl.removeChild(plansEl.firstChild);
  var h = el("h4", null, "Plans mémorisés");
  var bSave = el("button", null, "Mémoriser l\u2019agencement en cours"); bSave.type = "button";
  bSave.addEventListener("click", function(){ savePlan(null, "manuel"); });
  h.appendChild(bSave);
  plansEl.appendChild(h);
  if(!SAVED.length){
    plansEl.appendChild(el("p","none",
      "Aucun plan gardé pour l\u2019instant. Tout agencement posé à la main est mémorisé de "
      + "lui-même dès que le bac est vide ; les autres se gardent par le bouton ci-dessus."));
    return;
  }
  var ul = el("ul");
  SAVED.forEach(function(p){
    var li = el("li");
    li.appendChild(el("b", null, p.name));
    var np = 0, na = 0, nf = (p.lvls || []).length;
    for(var k in (p.levels || {})){ if(p.levels[k] !== TRAY) np++; }
    li.appendChild(el("em", null, nf + " niveau" + (nf > 1 ? "x" : "") + " · " + np + " pièces posées"));
    li.appendChild(el("i","sp"));
    var bl = el("button", null, "Rappeler"); bl.type = "button";
    bl.addEventListener("click", function(){ loadPlan(p.id); });
    var bd = el("button","del", "Oublier"); bd.type = "button";
    bd.addEventListener("click", function(){ dropPlan(p.id); });
    li.appendChild(bl); li.appendChild(bd);
    ul.appendChild(li);
  });
  plansEl.appendChild(ul);
}
