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
  if(!storeReady) return;
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
export var storeReady = false;
var badParts = null;

export function initStore(){
  if(storeReady) return;
  /* On LIT avant d'affirmer quoi que ce soit. La pastille annonçait
     « Enregistré sur cet appareil » dès l'entrée dans la fonction, avant toute
     lecture et sans vérifier que le stockage répond : en navigation privée
     l'utilisateur était assuré que son travail était sauvé jusqu'au premier
     échec d'écriture. */
  try {
    var raw = localStorage.getItem(LSKEY);
    if(raw){
      var o = JSON.parse(raw);
      /* Chaque section est restaurée indépendamment. Elles partageaient un seul
         `try` : un champ corrompu — un plan mémorisé sans date, un tableau là où
         un objet est attendu — faisait échouer TOUTE la restauration en silence,
         et la sauvegarde suivante écrasait alors le reste avec les valeurs par
         défaut. Perdre une section vaut mieux que perdre les quatre. */
      var lost = [];
      try{ applyAreas(o.areas); }catch(_){ lost.push("surfaces"); }
      try{ applyPlans(o.plans); }catch(_){ lost.push("plans mémorisés"); }
      try{ applyLevels(o.nlev, o.levels, o.plate, o.lvls); }catch(_){ lost.push("niveaux"); }
      try{ applyStored(o.rooms); }catch(_){ lost.push("positions"); }
      if(lost.length) badParts = lost;
    }
    localStorage.setItem(LSKEY + ".probe", "1");
    localStorage.removeItem(LSKEY + ".probe");
    if(badParts) chip("Restauration incomplète — " + badParts.join(", "), false);
    else chip(raw ? "Agencement retrouvé sur cet appareil" : "", !!raw);
  } catch(_){
    /* Le stockage lui-même ne répond pas. */
    failChip();
  }
  /* Rien ne doit être écrit avant cette lecture : une surface modifiée depuis
     l'onglet Programme déclenchait un enregistrement alors que la mémoire ne
     contenait encore que l'agencement par défaut — deux niveaux, aucun plan
     mémorisé — et écrasait la composition et les plans de l'utilisateur. */
  storeReady = true;
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
