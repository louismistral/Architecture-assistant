import { el, fmt } from "../core/format.js";
import { S } from "../core/geometry.js";
import { CHAP } from "../data/program.js";
import { sibsOf } from "./areas.js";
import { spreadFloors } from "./distribute.js";
import { applyRoom, buildList, drawProps, elOf, fit, freeOf, g10, layout, listEl, pushUndo, sel, select } from "./editor.js";
import { PART, drawLinks } from "./links.js";
import { NIV, checkNiv, flOfName, flWC, nivHit } from "./niv.js";
import { planLabel, planStamp, savePlan } from "./plans.js";
import { PLINK, RMAP, ROOMS } from "./rooms.js";
import { saveSoon } from "./store.js";

export function lvName(l){
  if(l === 0) return "Rez-de-chaussée";
  if(l < 0) return l === -1 ? "Sous-sol" : (-l) + "ᵉ sous-sol";
  return l === 1 ? "1ᵉʳ étage" : l + "ᵉ étage";
}
export function lvShort(l){
  if(l === 0) return "Rez";
  if(l < 0) return l === -1 ? "S-s" : "S" + (-l);
  return l === 1 ? "1ᵉʳ" : l + "ᵉ";
}
export function flName(i){ return lvName(FLOORS[i] ? FLOORS[i].lvl : 0); }
export function flShort(i){ return i === TRAY ? "bac" : lvShort(FLOORS[i] ? FLOORS[i].lvl : 0); }
export function lvlOf(i){ return FLOORS[i] ? FLOORS[i].lvl : 0; }
export function idxOfLvl(l){
  for(var i = 0; i < FLOORS.length; i++) if(FLOORS[i].lvl === l) return i;
  return -2;
}
export function nameFloors(){ FLOORS.forEach(function(F){ F.n = lvName(F.lvl); }); }
export var FLOORS = [{ lvl:0, n: lvName(0) }, { lvl:1, n: lvName(1) }];
export var curFl = 0, CIRC = 0.18, floorEl = null, nivEl = null;
/* Emprise au sol admissible par niveau. 4'022 m² est l'emprise retenue à l'étude
   d'implantation : 31 % du périmètre de 12'783 m², le reste en cour, accès et dégagements. */
export var PLATE = 4022;
/* Vue d'ensemble : chaque niveau devient une planche posée à côté des autres dans le même
   monde. Les coordonnées des pièces restent locales à leur niveau ; la planche n'ajoute
   qu'un décalage à l'affichage, ce qui laisse intactes les collisions, l'accrochage à
   10 cm et les alignements, qui ne comparent que des pièces d'un même étage. */
export var OV = false, plateLayer = null, GAPP = 9, manualRun = false;
/* Bac « à placer » : un niveau fictif, à gauche des lignes, où l'on peut vider tout le
   programme pour le reposer à la main. Une pièce du bac n'appartient à aucun étage : elle
   n'entre dans aucun bilan, aucune règle de niveau, et ses adjacences sont dites en attente
   plutôt que coupées. */
export var TRAY = -1, TRAYR = null;
/* Le bac s'élargit avec ce qu'il contient, pour rester un bloc à peu près carré plutôt
   qu'une colonne interminable à côté des lignes. */
export function trayWidth(){
  var w = Math.sqrt(Math.max(1, trayArea()) * 1.8);
  return Math.max(52, Math.min(150, Math.round(w / 2) * 2));
}
/* hors enveloppe scolaire : chapitre « Infrastructures » (piscine, chauffage CAD,
   bâtis au second temps) et chapitre « Extérieurs » (cour et préau) */
export var HORS = {}; CHAP.forEach(function(c, i){ if(c.id === "infra" || c.id === "ext") HORS[i] = 1; });
export function flNet(i){
  var a = 0;
  ROOMS.forEach(function(r){ if(r.fl === i && !HORS[r.ci]) a += r.a; });
  return a;
}
export function flBuilt(i){ return flNet(i) / (1 - CIRC); }
export function flBBox(i){
  var bx = 1e9, by = 1e9, bX = -1e9, bY = -1e9, n = 0;
  ROOMS.forEach(function(r){
    if(r.fl !== i) return;
    var L = layout[r.id]; if(!L) return;
    n++; bx = Math.min(bx, L.x); by = Math.min(by, L.y);
    bX = Math.max(bX, L.x + L.w); bY = Math.max(bY, L.y + L.h);
  });
  return n ? { x:bx, y:by, w:bX - bx, h:bY - by } : { x:0, y:0, w:0, h:0 };
}
/* Les planches s'empilent en lignes, comme les plans d'un dossier : le niveau le plus haut
   en tête, le rez-de-chaussée en bas. Elles ont toutes la même largeur et la même profondeur,
   et partagent donc leur axe est-ouest : une pièce lue à la même abscisse d'une ligne à l'autre
   est bien celle qui se superpose. */
export function layoutPlates(){
  var PW = 40, bb = [], n = FLOORS.length, i, y = 0;
  for(i = 0; i < n; i++){ bb[i] = flBBox(i); PW = Math.max(PW, bb[i].w); }
  PW = Math.ceil(PW / 5) * 5 + 8;
  /* le bac occupe une colonne à gauche ; les lignes se décalent d'autant */
  var tn = trayRooms().length, x0 = 0, tb = null;
  if(tn){
    tb = { x:1e9, y:1e9, w:0, h:0 };
    var bX = -1e9, bY = -1e9;
    trayRooms().forEach(function(r){
      var L = layout[r.id]; if(!L) return;
      tb.x = Math.min(tb.x, L.x); tb.y = Math.min(tb.y, L.y);
      bX = Math.max(bX, L.x + L.w); bY = Math.max(bY, L.y + L.h);
    });
    if(tb.x > bX){ tb = { x:0, y:0, w:0, h:0 }; }
    else { tb.w = bX - tb.x; tb.h = bY - tb.y; }
    x0 = Math.max(trayWidth(), Math.ceil(tb.w / 2) * 2) + 8 + GAPP * 2;
  }
  /* chaque ligne prend la profondeur de ce qu'elle porte ; on empile du haut vers le bas */
  for(i = n - 1; i >= 0; i--){
    FLOORS[i].pw = PW;
    FLOORS[i].ph = Math.max(16, Math.ceil(bb[i].h / 2) * 2 + 11);
    FLOORS[i].px = x0; FLOORS[i].py = y;
    FLOORS[i].ox = x0 - bb[i].x + 4;
    FLOORS[i].oy = y - bb[i].y + 7;
    y += FLOORS[i].ph + GAPP;
  }
  if(tn){
    TRAYR = { px:0, py:0, pw: x0 - 8 - GAPP * 2, ph: Math.max(24, Math.ceil(tb.h / 2) * 2 + 11) };
    TRAYR.ox = -tb.x + 4; TRAYR.oy = -tb.y + 7;
  } else TRAYR = null;
}
export function ovOff(id){
  if(!OV) return { x: 0, y: 0 };
  var f = RMAP[id].fl;
  var F = f === TRAY ? TRAYR : FLOORS[f];
  return F ? { x: F.ox || 0, y: F.oy || 0 } : { x: 0, y: 0 };
}
/* position d'une pièce dans le monde affiché */
export function wpos(id){
  var L = layout[id], o = ovOff(id);
  return { x: L.x + o.x, y: L.y + o.y, w: L.w, h: L.h };
}
export function floorAt(wx, wy){
  var best = 0, bd = Infinity;
  function test(F, k){
    if(!F) return;
    var cx = Math.max(F.px, Math.min(F.px + F.pw, wx));
    var cy = Math.max(F.py, Math.min(F.py + F.ph, wy));
    var d = (wx - cx) * (wx - cx) + (wy - cy) * (wy - cy);
    if(d < bd){ bd = d; best = k; }
  }
  FLOORS.forEach(function(F, i){ test(F, i); });
  test(TRAYR, TRAY);
  return best;
}
export function mountFloorBar(){ floorEl = el("div","coupe"); return floorEl; }
export function mountNiv(){ nivEl = el("div","niv"); return nivEl; }
export function mountPlateLayer(){
  plateLayer = el("div","platelayer");
  plateLayer.style.cssText = "position:absolute;inset:0;display:none";
  return plateLayer;
}

export function drawPlates(){
  if(!plateLayer) return;
  while(plateLayer.firstChild) plateLayer.removeChild(plateLayer.firstChild);
  plateLayer.style.display = OV ? "block" : "none";
  if(!OV) return;
  if(TRAYR){
    var tp = el("div","plate tray");
    tp.style.left = (TRAYR.px * S) + "px"; tp.style.top = (TRAYR.py * S) + "px";
    tp.style.width = (TRAYR.pw * S) + "px"; tp.style.height = (TRAYR.ph * S) + "px";
    var tl = el("b", null, "À placer");
    tl.appendChild(el("span", null, "   " + trayRooms().length + " pièces · "
      + fmt(Math.round(trayArea())) + " m²"));
    tp.appendChild(tl);
    plateLayer.appendChild(tp);
  }
  FLOORS.forEach(function(F, i){
    var p = el("div","plate");
    p.style.left = (F.px * S) + "px"; p.style.top = (F.py * S) + "px";
    p.style.width = (F.pw * S) + "px"; p.style.height = (F.ph * S) + "px";
    var bu = Math.round(flBuilt(i)), over = PLATE > 0 && bu > PLATE + 1;
    if(over) p.classList.add("over");
    var lb = el("b", null, F.n);
    lb.appendChild(el("span", null, "   " + fmt(Math.round(flArea(i))) + " m² · "
      + flCount(i) + " pièces · " + fmt(bu) + " m² bâtis"
      + (PLATE > 0 ? " · " + Math.round(bu / PLATE * 100) + " % du plateau" : "")));
    if(over) lb.style.color = "var(--danger)";
    p.appendChild(lb);
    plateLayer.appendChild(p);
  });
}
/* Marque sur les pièces elles-mêmes ce que le règlement refuse à leur niveau, et les
   adjacences dont les deux pièces ne sont plus au même étage. */
export var PB = {};
export function markProblems(){
  PB = {};
  function flag(id, sev){ if(PB[id] !== "e") PB[id] = sev; }
  ROOMS.forEach(function(r){
    if(r.fl === TRAY) return;
    NIV.forEach(function(rl){
      if(!nivHit(rl, r)) return;
      var bad = false, lv = lvlOf(r.fl);
      if(rl.lvl){ if(lv < rl.lvl.min || lv > rl.lvl.max) bad = true; }
      else if(rl.grade){ if(lv !== 0) bad = true; }
      else if(rl.max !== undefined){ if(lv > rl.max || lv < 0) bad = true; }
      else if(rl.same){ if(r.fl !== flOfName(rl.same)) bad = true; }
      if(bad) flag(r.id, rl.sev);
    });
  });
  ROOMS.forEach(function(r){
    if(r.fl === TRAY || lvlOf(r.fl) >= 0 || r.f === "tec") return;
    flag(r.id, "e");                       /* en sous-sol sans lumière naturelle */
  });
  PLINK.forEach(function(l){
    if(!RMAP[l.a] || !RMAP[l.b]) return;
    if(RMAP[l.a].fl === TRAY || RMAP[l.b].fl === TRAY) return;   /* pas encore posée */
    if(RMAP[l.a].fl !== RMAP[l.b].fl){ flag(l.a, "e"); flag(l.b, "e"); }
  });
  ROOMS.forEach(function(r){
    var d = elOf[r.id];
    if(d){ d.classList.toggle("nivE", PB[r.id] === "e"); d.classList.toggle("nivW", PB[r.id] === "w"); }
  });
  if(listEl) Array.prototype.forEach.call(listEl.querySelectorAll("button"), function(b){
    b.classList.toggle("pbE", PB[b.dataset.id] === "e");
    b.classList.toggle("pbW", PB[b.dataset.id] === "w");
  });
  return PB;
}
/* Pose une pièce contre une ancre déjà posée, cloison de 10 cm comprise. */
export function placeBeside(id, anchor){
  var L = layout[id], A = layout[anchor], i, c;
  var cands = [ { x: A.x + A.w + PART, y: A.y },
                { x: A.x - L.w - PART,  y: A.y },
                { x: A.x, y: A.y + A.h + PART },
                { x: A.x, y: A.y - L.h - PART },
                { x: A.x + A.w + PART, y: A.y + A.h - L.h },
                { x: A.x - L.w - PART,  y: A.y + A.h - L.h } ];
  for(i = 0; i < cands.length; i++){
    c = { x: g10(cands[i].x), y: g10(cands[i].y) };
    if(freeOf(id, c.x, c.y, L.w, L.h)){ L.x = c.x; L.y = c.y; return; }
  }
  var x = A.x + A.w + PART, y = A.y, k = 0;
  while(!freeOf(id, g10(x), g10(y), L.w, L.h) && k < 300){ x += Math.max(2, L.w) + PART; k++; }
  L.x = g10(x); L.y = g10(y);
}
/* Une pièce sortie du bac entraîne avec elle toutes celles auxquelles le programme la lie et
   qui sont encore au bac : la grappe d'adjacence se pose d'un coup, chaque voisine plaquée
   contre celle qui l'a appelée. Les pièces déjà posées ailleurs ne bougent pas. */
export function pullPartners(id){
  var f = RMAP[id].fl, moved = [], adj = {}, seen = {}, q = [id];
  if(f === TRAY) return moved;
  ROOMS.forEach(function(r){ adj[r.id] = []; });
  PLINK.forEach(function(l){ if(adj[l.a] && adj[l.b]){ adj[l.a].push(l.b); adj[l.b].push(l.a); } });
  seen[id] = 1;
  while(q.length){
    var p = q.shift();
    adj[p].forEach(function(n){
      if(seen[n]) return;
      seen[n] = 1;
      if(RMAP[n].fl !== TRAY) return;
      RMAP[n].fl = f;
      placeBeside(n, p);
      moved.push(n);
      q.push(n);
    });
  }
  return moved;
}
/* Vide tout le programme dans le bac, pour le reposer à la main. */
export function toTray(){
  pushUndo(null);
  ROOMS.forEach(function(r){ r.fl = TRAY; });
  packTray();
  OV = true; manualRun = true;
  if(sel) select(null);
  refloor(); fit(); saveSoon();
}
/* Un plan posé à la main est mémorisé de lui-même dès que la dernière pièce quitte le bac. */
export function checkManualDone(){
  if(!manualRun || trayRooms().length) return;
  manualRun = false;
  savePlan("Plan manuel — " + planStamp() + "  (" + planLabel() + ")", "manuel");
}
/* ================= PLANS MÉMORISÉS =================
   Un agencement manuel se perd au premier Shuffle : on en garde donc une copie, prise
   automatiquement dès qu'un plan posé à la main est complet — c'est-à-dire dès que le bac se
   vide — et à la demande par le bouton « Mémoriser ». Chaque plan garde les niveaux, leurs
   cotes, les positions et le plateau ; on le rappelle d'un clic. */
export function setOverview(on){
  OV = !!on;
  if(OV) layoutPlates();
  refloor(); fit();
}

export function flArea(i){
  var a = 0;
  ROOMS.forEach(function(r){ if(r.fl === i) a += r.a; });
  return a;
}
export function flCount(i){
  var n = 0;
  ROOMS.forEach(function(r){ if(r.fl === i) n++; });
  return n;
}
export function trayRooms(){ return ROOMS.filter(function(r){ return r.fl === TRAY; }); }
export function trayArea(){
  var a = 0;
  ROOMS.forEach(function(r){ if(r.fl === TRAY) a += r.a; });
  return a;
}
/* Rangement du bac : les plus grandes d'abord, en étagères, cloison de 10 cm comprise. */
export function packTray(){
  var rs = trayRooms().sort(function(a, b){ return (b.a - a.a) || (a.id < b.id ? -1 : 1); });
  var x = 0, y = 0, rowH = 0, W = trayWidth();
  rs.forEach(function(r){
    var L = layout[r.id];
    if(!L) return;
    if(x > 0 && x + L.w > W){ x = 0; y += rowH + PART; rowH = 0; }
    L.x = Math.round(x * 10) / 10; L.y = Math.round(y * 10) / 10;
    x += L.w + PART; rowH = Math.max(rowH, L.h);
  });
}
/* Cotes admissibles pour une pièce, puis l'intervalle d'indices correspondant. Par défaut rien
   ne descend en sous-sol : seuls les locaux techniques, de stockage et de nettoyage y sont
   admis, plus l'abri PC que le règlement y autorise explicitement. */
export function flLvRange(r){
  var lmin = (r.f === "tec") ? -9 : 0, lmax = 99;
  NIV.forEach(function(rl){
    if(!nivHit(rl, r)) return;
    if(rl.lvl){ lmin = Math.max(lmin, rl.lvl.min); lmax = Math.min(lmax, rl.lvl.max); }
    else if(rl.grade){ lmin = Math.max(lmin, 0); lmax = Math.min(lmax, 0); }
    else if(rl.max !== undefined){ lmin = Math.max(lmin, 0); lmax = Math.min(lmax, rl.max); }
  });
  return { min: lmin, max: lmax };
}
export function flRange(r){
  var lr = flLvRange(r), lo = 1e9, hi = -1e9;
  FLOORS.forEach(function(F, i){
    if(F.lvl >= lr.min && F.lvl <= lr.max){ lo = Math.min(lo, i); hi = Math.max(hi, i); }
  });
  if(lo > hi){ var z = Math.max(0, idxOfLvl(0)); lo = z; hi = z; }
  return { lo: lo, hi: hi };
}
export function flMaxOf(r){ return flRange(r).hi; }

/* ---- affichage d'un niveau ---- */
export function refloor(){
  if(!OV && sel && RMAP[sel].fl !== curFl) select(null);
  if(OV) layoutPlates();
  ROOMS.forEach(function(r){ applyRoom(r.id); });
  drawPlates(); drawLinks(); buildFloorBar(); buildList(); drawNiv(); markProblems();
  if(sel) drawProps();
}
export function setCurFloor(i){ curFl = i; }

export function setFloor(i){
  if(i < 0 || i >= FLOORS.length || i === curFl) return;
  curFl = i;
  refloor();
  fit();
}
export function setFloorOf(id, f, all){
  if(f < TRAY || f >= FLOORS.length) return;
  var ids = all ? sibsOf(id) : [id], was = RMAP[id].fl;
  pushUndo(null);
  ids.forEach(function(sid){
    var from = RMAP[sid].fl;
    RMAP[sid].fl = f;
    if(f !== TRAY && from === TRAY){
      /* posée depuis le bac : on la cale sur une pièce déjà posée du même niveau */
      var host = null;
      ROOMS.forEach(function(rr){ if(!host && rr.id !== sid && rr.fl === f) host = rr.id; });
      if(host) placeBeside(sid, host);
      pullPartners(sid);
    }
  });
  if(f === TRAY || was === TRAY) packTray();
  if(f !== TRAY) curFl = f;
  if(OV) layoutPlates();
  refloor();
  checkManualDone();
  saveSoon();
}
export function addFloor(){
  FLOORS.push({ lvl: lvlOf(FLOORS.length - 1) + 1 });
  nameFloors();
  curFl = FLOORS.length - 1;
  refloor(); saveSoon();
}
export function delFloor(){
  if(FLOORS.length < 2) return;
  if(lvlOf(FLOORS.length - 1) <= 0) return;      /* on ne retire ici que des étages */
  if(flCount(FLOORS.length - 1) > 0) return;
  FLOORS.pop(); nameFloors();
  if(curFl >= FLOORS.length) curFl = FLOORS.length - 1;
  refloor(); saveSoon();
}
/* Un sous-sol s'insère sous la pile : tous les indices montent d'un cran, les cotes ne bougent
   pas. Rien n'y descend tout seul — c'est à la main, ou par le rangement pour le technique. */
export function addBasement(){
  FLOORS.unshift({ lvl: lvlOf(0) - 1 });
  nameFloors();
  ROOMS.forEach(function(r){ if(r.fl !== TRAY) r.fl += 1; });
  curFl = 0;
  if(OV) layoutPlates();
  refloor(); fit(); saveSoon();
}
export function delBasement(){
  if(FLOORS.length < 2 || lvlOf(0) >= 0) return;
  if(flCount(0) > 0) return;
  FLOORS.shift(); nameFloors();
  ROOMS.forEach(function(r){ if(r.fl !== TRAY) r.fl -= 1; });
  curFl = Math.max(0, Math.min(curFl - 1, FLOORS.length - 1));
  if(OV) layoutPlates();
  refloor(); fit(); saveSoon();
}
export function buildFloorBar(){
  if(!floorEl) return;
  while(floorEl.firstChild) floorEl.removeChild(floorEl.firstChild);

  /* LA COUPE. Une pile de niveaux était représentée par une rangée horizontale :
     le sous-sol à gauche, l'étage à droite — alors que `layoutPlates()` et
     l'infobulle annonçaient l'inverse, soit deux modèles mentaux contradictoires
     à quarante pixels d'écart. On parcourt donc FLOORS à l'envers et on empile :
     dernier étage en haut, rez en bas, sous-sols dessous. C'est la convention de
     coupe, la seule qu'un architecte lise sans traduire.

     Chaque bande porte le nom et UNE mesure. L'ancien libellé concaténait
     « 6'845 m² · 113 pièces · 6'640 m² bâtis, circulation comprise · 165 % du
     plateau » — soixante-quatorze signes — contre « niveau vide » pour le
     voisin, d'où des boutons de 530 px et de 130 px côte à côte dont la largeur
     changeait à chaque geste : on n'apprenait jamais où cliquer. Le détail
     chiffré complet vit dans l'onglet Contrôle. */
  floorEl.appendChild(el("h4","label","Niveaux"));

  var list = el("div","coupe__stack");
  for(var i = FLOORS.length - 1; i >= 0; i--){
    (function(i){
      var F = FLOORS[i];
      var b = el("button","coupe__lvl");
      b.type = "button";
      b.setAttribute("aria-current", String(!OV && i === curFl));

      var n = flCount(i), bu = Math.round(flBuilt(i));
      var pct = PLATE > 0 ? Math.round(bu / PLATE * 100) : 0;
      var over = n && PLATE > 0 && bu > PLATE + 1;
      var noWC = n && flWC(i).use && !flWC(i).wc;

      b.appendChild(el("b","coupe__name", F.n));
      /* Une seule mesure : l'occupation du plateau, celle qui décide. */
      b.appendChild(el("span","coupe__fig mono",
        n ? pct + " % du plateau" : "vide — « Répartir » pour le remplir"));

      /* Une jauge donne la mesure en forme, pas seulement en chiffre. */
      var g = el("span","coupe__gauge");
      var f = el("i");
      f.style.width = Math.min(100, pct) + "%";
      if(over) f.classList.add("is-over");
      g.appendChild(f);
      b.appendChild(g);

      /* Les verdicts ne sont jamais portés par la seule couleur. */
      if(over || noWC){
        var ch = el("span","coupe__chips");
        if(over) ch.appendChild(el("i","chip chip--danger","emprise dépassée"));
        if(noWC) ch.appendChild(el("i","chip chip--warn","sans WC"));
        b.appendChild(ch);
      }

      b.addEventListener("click", function(){
        if(OV){ OV = false; curFl = i; refloor(); fit(); return; }
        setFloor(i);
      });
      list.appendChild(b);
    })(i);
  }
  floorEl.appendChild(list);

  /* Le sol, pour que la pile se lise comme une coupe et non comme une liste. */
  floorEl.appendChild(el("div","coupe__ground"));

  /* ÉDITER LA PILE. Ces six commandes étaient dans le même rang de boutons que
     la navigation entre niveaux : deux intentions différentes, un seul rang. */
  var det = el("details","disclose coupe__edit");
  det.appendChild(el("summary", null, "Modifier la pile"));

  function act(label, hint, fn, disabled, why){
    var b = el("button","btn coupe__act");
    b.type = "button";
    b.appendChild(el("span", null, label));
    if(disabled){
      b.disabled = true;
      /* La raison d'une commande indisponible passe du `title` — invisible au
         clavier, au doigt et sur mobile — à une ligne lisible. */
      if(why) b.appendChild(el("span","coupe__why", why));
    } else if(hint){
      b.appendChild(el("span","coupe__why", hint));
    }
    if(fn) b.addEventListener("click", fn);
    return b;
  }

  var topEmpty = flCount(FLOORS.length - 1) === 0;
  var canDelTop = FLOORS.length >= 2 && lvlOf(FLOORS.length - 1) > 0 && topEmpty;
  var botEmpty = flCount(0) === 0;
  var canDelBot = FLOORS.length >= 2 && lvlOf(0) < 0 && botEmpty;

  det.appendChild(act("Ajouter un étage", null, addFloor, false));
  det.appendChild(act("Retirer l\u2019étage", null, delFloor, !canDelTop,
    FLOORS.length < 2 || lvlOf(FLOORS.length - 1) <= 0
      ? "il ne reste que le rez-de-chaussée"
      : FLOORS[FLOORS.length-1].n + " porte " + flCount(FLOORS.length-1)
        + " pièce" + (flCount(FLOORS.length-1) > 1 ? "s" : "") + " — vide-le d\u2019abord"));
  det.appendChild(act("Creuser un sous-sol",
    "réservé au technique, au stockage, au nettoyage et à l\u2019abri PC",
    addBasement, false));
  det.appendChild(act("Combler le sous-sol", null, delBasement, !canDelBot,
    lvlOf(0) >= 0 ? "aucun sous-sol creusé"
      : FLOORS[0].n + " porte " + flCount(0) + " pièce" + (flCount(0) > 1 ? "s" : "")
        + " — vide-le d\u2019abord"));
  floorEl.appendChild(det);
}
export function drawNiv(){
  if(!nivEl) return;
  while(nivEl.firstChild) nivEl.removeChild(nivEl.firstChild);
  var hd = el("h4", null, "Contrôle des niveaux");
  nivEl.appendChild(hd);
  var pr = el("div","plateau");
  pr.appendChild(el("label", null, "Emprise au sol admise par niveau"));
  var pin = document.createElement("input");
  pin.type = "number"; pin.step = "50"; pin.min = "0"; pin.max = "20000"; pin.value = PLATE;
  pr.appendChild(pin);
  pr.appendChild(el("span", null, "m²  ·  circulation comptée à " + Math.round(CIRC * 100)
    + " % de la surface utile  ·  cour, piscine et chauffage CAD hors emprise bâtie"
    + "  ·  périmètre du concours : 12’783 m²"));
  function commitP(){
    var v = Math.round(parseFloat(pin.value) || 0);
    if(v < 0 || v > 20000){ pin.value = PLATE; return; }
    if(v === PLATE) return;
    PLATE = v; buildFloorBar(); drawNiv(); saveSoon();
  }
  pin.addEventListener("change", commitP);
  pin.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); commitP(); } });
  nivEl.appendChild(pr);
  var list = checkNiv();
  if(!list.length){
    nivEl.appendChild(el("p","okmsg",
      "Aucun conflit : chaque poste est posé à un niveau que le programme autorise."));
    return;
  }
  list.sort(function(a, b){ return (a.sev === "e" ? 0 : 1) - (b.sev === "e" ? 0 : 1); });
  var ul = el("ul");
  list.forEach(function(w){
    var li = el("li", w.sev);
    li.appendChild(el("i", null, w.sev === "e" ? "conflit" : "à vérifier"));
    var t = el("div");
    t.appendChild(document.createTextNode(w.msg));
    var ref = " — art. " + w.ref;
    if(w.ex) ref += " · " + w.ex + (w.n > 1 ? " et " + (w.n - 1) + " autre" + (w.n > 2 ? "s" : "") : "");
    t.appendChild(el("span", null, ref));
    li.appendChild(t);
    ul.appendChild(li);
  });
  nivEl.appendChild(ul);
}
/* Distribue le programme sur les niveaux : ce que le règlement cloue au terrain reste au
   rez, le reste remplit les niveaux dans l'ordre des chapitres jusqu'à équilibrer les
   surfaces. Une grappe d'adjacence n'est jamais coupée entre deux niveaux. */
/* Unités indéplaçables l'une sans l'autre : grappes d'adjacence, élargies par les règles
   « au même niveau que ». Chaque unité porte le niveau le plus haut que le règlement lui
   consent, sa surface utile bâtie (la cour, la piscine et le CAD ne comptent pas, ils ne
   pèsent pas sur le plateau) et son chapitre. */
export function applyLevels(nlev, levels, plate, lvls){
  if(typeof plate === "number" && plate >= 0 && plate <= 20000) PLATE = plate;
  if(!levels && !(nlev > 0) && !lvls){ buildFloorBar(); drawNiv(); return; }
  if(lvls && lvls.length && lvls.length <= 12){
    FLOORS = lvls.map(function(l){ return { lvl: l }; });
    nameFloors();
  } else if(nlev > 0 && nlev <= 12){
    while(FLOORS.length < nlev) FLOORS.push({ lvl: lvlOf(FLOORS.length - 1) + 1 });
    while(FLOORS.length > nlev && FLOORS.length > 1) FLOORS.pop();
    nameFloors();
  }
  if(levels){
    ROOMS.forEach(function(r){
      var v = levels[r.id];
      if(typeof v === "number" && v >= TRAY && v < FLOORS.length) r.fl = v;
    });
  }
  if(curFl >= FLOORS.length) curFl = FLOORS.length - 1;
  refloor();
}
