import { el, fmt } from "../core/format.js";
import { squarest } from "../core/geometry.js";
import { recompute } from "../core/model.js";
import { ITEMBYKEY, updatePlanHead, userAreas } from "./areas.js";
import { applyRoom, buildList, drawProps, elOf, layout, saveChip, sel } from "./editor.js";
import { FLOORS, OV, PLATE, applyLevels, drawPlates, layoutPlates, markProblems } from "./levels.js";
import { drawLinks } from "./links.js";
import { SAVED, applyPlans } from "./plans.js";
import { ROOMS } from "./rooms.js";
import { renderLegend } from "../views/legend.js";
import { renderTotals } from "../views/render.js";

/* ---- persistance ---- */
export var CLIENT = Math.random().toString(36).slice(2), dbRef = null, saveT = null, LSKEY = "saxon-plan-v1";
export /* Le seul message d'échec de toute l'app était « non enregistré » : deux mots,
   sans cause ni remède, dans le même gris que « sauvegarde locale ». */
function failChip(){
  if(!saveChip) return;
  while(saveChip.firstChild) saveChip.removeChild(saveChip.firstChild);
  saveChip.appendChild(document.createTextNode(
    "Enregistrement impossible — mémorise ton agencement dans « Plans » avant de fermer"));
  saveChip.classList.add("is-bad");
}
function chip(txt, ok){
  if(!saveChip) return;
  while(saveChip.firstChild) saveChip.removeChild(saveChip.firstChild);
  saveChip.classList.remove("is-bad");
  if(ok){ saveChip.appendChild(el("b", null, "● ")); }
  saveChip.appendChild(document.createTextNode(txt));
}
export function saveSoon(){
  clearTimeout(saveT);
  chip("Enregistrement…", false);
  saveT = setTimeout(function(){
    var lv = {}; ROOMS.forEach(function(r){ lv[r.id] = r.fl; });
    var payload = { rooms: layout, areas: userAreas, levels: lv, nlev: FLOORS.length,
      lvls: FLOORS.map(function(F){ return F.lvl; }), plans: SAVED,
      plate: PLATE, client: CLIENT, updatedAt: Date.now() };
    if(dbRef){
      dbRef.set(payload).then(function(){ chip("Enregistré · partagé avec l\u2019atelier", true); })
        .catch(function(){ failChip(); });
    } else {
      try { localStorage.setItem(LSKEY, JSON.stringify(payload)); chip("Enregistré sur cet appareil", true); }
      catch(_){ failChip(); }
    }
  }, 700);
}
export function applyAreas(areas){
  if(!areas) return;
  var touched = 0;
  for(var k in areas){
    var it = ITEMBYKEY[k], v = areas[k];
    if(!it || !it.est || !(v > 0)) continue;
    it.u = v; it.set = 1; userAreas[k] = v; touched++;
  }
  if(!touched) return;
  recompute();
  var d = {};
  ROOMS.forEach(function(r){
    var it2 = ITEMBYKEY[r.key];
    if(!it2 || it2.u === r.a) return;
    r.a = it2.u;
    if(!d[r.a]) d[r.a] = squarest(r.a);
    r.w = d[r.a].w; r.h = d[r.a].h;
    var ra = elOf[r.id] && elOf[r.id].querySelector(".ra");
    if(ra) ra.textContent = fmt(r.a) + " m²";
    var L = layout[r.id];
    if(L){ L.w = r.w; L.h = r.h; }
  });
  renderLegend(); renderTotals(); updatePlanHead(); buildList();
}
export function applyStored(rooms){
  if(!rooms) return false;
  var n = 0;
  ROOMS.forEach(function(r){
    var v = rooms[r.id];
    if(v && typeof v.x === "number" && v.w > 0 && v.h > 0){
      layout[r.id] = { x:v.x, y:v.y, w:v.w, h:v.h }; n++;
    }
  });
  if(n){ if(OV) layoutPlates(); ROOMS.forEach(function(r){ applyRoom(r.id); });
    drawPlates(); drawLinks(); markProblems(); }
  return n > 0;
}
export function initStore(){
  chip("Enregistré sur cet appareil", true);
  try {
    var raw = localStorage.getItem(LSKEY);
    if(raw){ var o = JSON.parse(raw); applyAreas(o.areas); applyPlans(o.plans); applyLevels(o.nlev, o.levels, o.plate, o.lvls); applyStored(o.rooms); }
  } catch(_){}
  if(!(window.claude && window.claude.use)) return;
  window.claude.use("db").then(function(db){
    if(!db) return;
    dbRef = db.doc("plans/atelier");
    chip("agencement partagé", true);
    dbRef.onSnapshot(function(snap0){
      if(!snap0.exists) return;
      var d = snap0.data();
      if(d.client === CLIENT) return;
      applyAreas(d.areas);
      applyPlans(d.plans);
      applyLevels(d.nlev, d.levels, d.plate, d.lvls);
      if(applyStored(d.rooms)){ if(sel) drawProps(); chip("agencement partagé", true); }
    }, function(){});
  }).catch(function(){});
}


/* ================= VOLUMES — implantation sur le site réel =================
   Données extraites du plan du géomètre (site_plan.3dm, unité cm, coordonnées locales,
   origine au coin sud-ouest du périmètre). Le plan du terrain z = 463.273 + 0.01939·x
   − 0.00305·y est ajusté sur 99 points de courbe de niveau situés dans le périmètre
   (erreur moyenne 0,22 m). Nappe phréatique 461,77 à 462,25 m, chapitre 2.3. */
