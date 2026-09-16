import { dim, el, fmt } from "../core/format.js";
import { nearestDims, pack } from "../core/geometry.js";
import { FMAP } from "../core/model.js";
import { s } from "../core/svg.js";
import { view } from "../core/viewstate.js";
import { FAM } from "../data/families.js";
import { ENTRE, NAPPE, PER, PERAIRE, RETRAIT, SITE, SOUSSOL, VANG } from "../data/site.js";
import { layout, ty } from "../plan/editor.js";
import { FLOORS, HORS, TRAY, lvlOf } from "../plan/levels.js";
import { PART } from "../plan/links.js";
import { ROOMS } from "../plan/rooms.js";

export var VOLS = [
  { n:"Salle de sport double", sub:"896 m² · h. 7 m", w:32, h:28, f:"spo", x:24, y:21, lv:1 },
  { n:"Barre A — classes", sub:"R+1 · 1'728 m²", w:48, h:18, f:"cla", x:82, y:80, lv:2 },
  { n:"Barre B — classes", sub:"R+1 · 1'728 m²", w:48, h:18, f:"cla", x:73, y:50, lv:2 },
  { n:"Barre C — accueil, UAPE", sub:"R+1 · 1'296 m²", w:36, h:18, f:"uap", x:68, y:18, lv:2 },
  { n:"Abri PC + locaux engins", sub:"930 m² · h. 2,40 m", w:30, h:25, f:"tec", x:132, y:29, lv:1 }
];

export var HOME = VOLS.map(function(v){ return { x:v.x, y:v.y, w:v.w, h:v.h }; });
export var volNode = null, volMet = null, volEnterre = false;

/* ---- lien avec le plan interactif : un volume par niveau, le schéma posé dedans ----
   Le volume n'est pas un dessin de plus : c'est l'étage lui-même, ramené sur le site. Sa
   surface est celle du programme porté par ce niveau, augmentée de la part de circulation
   réglée à la barre. Le schéma garde ses positions exactes, centré dans le volume ; la bande
   qui l'entoure est la circulation qu'on vient d'ajouter. */
export var volLink = false, volCirc = 0.15, VOLS0 = null;
export var volCircIn = null, volCircOut = null, volLinkBtn = null;

/* Le plan interactif est une feuille de travail : entre ses rangées il reste des vides qui ne
   sont pas du bâtiment. Pour faire une emprise, on resserre le niveau — mêmes pièces, mêmes
   dimensions, même ordre de lecture (de haut en bas puis de gauche à droite), cloison de 10 cm
   entre elles, sans les jeux de la feuille. C'est ce paquet qui entre dans le volume. */
export function volPack(i){
  var rs = ROOMS.filter(function(r){ return r.fl === i && layout[r.id] && !HORS[r.ci]; });
  if(!rs.length) return null;
  var ford = {}; FAM.forEach(function(f, k){ ford[f.id] = k; });
  rs = rs.slice().sort(function(a, b){
    return (layout[b.id].h - layout[a.id].h) || (ford[a.f] - ford[b.f]) || (b.a - a.a);
  });
  var net = 0, fa = {}, best = "cla", bv = 0;
  rs.forEach(function(r){
    net += r.a;
    fa[r.f] = (fa[r.f] || 0) + r.a;
    if(fa[r.f] > bv){ bv = fa[r.f]; best = r.f; }
  });
  /* rangement en ligne d'horizon : chaque pièce tombe au point le plus bas où elle tient,
     la plus haute d'abord. C'est le rangement le plus dense à surfaces exactes ; le vide qui
     reste est le vrai jeu du calepinage, et non un artefact du plan de travail. */
  var Wt = Math.max(24, Math.sqrt(net * 1.55));
  rs.forEach(function(r){ Wt = Math.max(Wt, layout[r.id].w); });
  var sky = [{ x: 0, w: Wt, y: 0 }], cells = [], W = 0, H = 0;
  rs.forEach(function(r){
    var L = layout[r.id], bw = L.w + PART, bh = L.h + PART, best2 = null, i, j;
    for(i = 0; i < sky.length; i++){
      var sx = sky[i].x;
      if(sx + bw > Wt + 1e-6) continue;
      var sy = 0, rem = bw;
      for(j = i; j < sky.length && rem > 1e-6; j++){ sy = Math.max(sy, sky[j].y); rem -= sky[j].w; }
      if(rem > 1e-6) continue;
      if(!best2 || sy < best2.y - 1e-6 || (Math.abs(sy - best2.y) < 1e-6 && sx < best2.x))
        best2 = { x: sx, y: sy };
    }
    if(!best2){
      var top = 0;
      sky.forEach(function(sg){ top = Math.max(top, sg.y); });
      best2 = { x: 0, y: top };
    }
    cells.push({ id: r.id, r: r, u: best2.x, t: best2.y, w: L.w, h: L.h });
    W = Math.max(W, best2.x + L.w);
    H = Math.max(H, best2.y + L.h);
    /* la ligne d'horizon se relève sur l'emprise de la pièce */
    var x0 = best2.x, x1 = best2.x + bw, ny = best2.y + bh, keep = [];
    sky.forEach(function(sg){
      var a = sg.x, b = sg.x + sg.w;
      if(b <= x0 + 1e-6 || a >= x1 - 1e-6){ keep.push(sg); return; }
      if(a < x0 - 1e-6) keep.push({ x: a, w: x0 - a, y: sg.y });
      if(b > x1 + 1e-6) keep.push({ x: x1, w: b - x1, y: sg.y });
    });
    keep.push({ x: x0, w: Math.min(bw, Wt - x0), y: ny });
    keep.sort(function(u, v2){ return u.x - v2.x; });
    sky = [];
    keep.forEach(function(sg){
      var last = sky[sky.length - 1];
      if(last && Math.abs(last.y - sg.y) < 1e-6 && Math.abs(last.x + last.w - sg.x) < 1e-6) last.w += sg.w;
      else sky.push(sg);
    });
  });
  return { cells: cells, W: W, H: H, net: net, nb: rs.length, f: best };
}
export function volPlanLevels(){
  var out = [];
  FLOORS.forEach(function(F, i){
    var P = volPack(i);
    if(!P) return;
    /* la circulation est une couronne ajoutée tout autour du paquet : sa surface vaut
       exactement la part réglée à la barre, en pour cent du programme du niveau. */
    var S = P.W + P.H, add = P.net * volCirc;
    var m = (-S + Math.sqrt(S * S + 4 * add)) / 4;
    out.push({ fl: i, lvl: lvlOf(i), n: FLOORS[i].n, f: P.f, lv: 1, link: 1, pack: P,
      w: Math.round((P.W + 2 * m) * 10) / 10, h: Math.round((P.H + 2 * m) * 10) / 10,
      m: m, net: P.net, nb: P.nb, jeu: P.W * P.H - P.net, x: 0, y: 0,
      sub: fmt(Math.round(P.net)) + " m² + " + Math.round(volCirc * 100) + " % de circulation" });
  });
  out.sort(function(a, b){ return a.lvl - b.lvl; });
  return out;
}
/* Chaque niveau cherche la place la plus proche du centre du périmètre où il tient
   entièrement, à distance des limites, sans recouvrir un niveau déjà posé. */
export function volFindSpot(v, placed, sep){
  var xs = PER.map(function(p){ return p[0]; }), ys = PER.map(function(p){ return p[1]; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var best = null, bd = 1e9, gx, gy, i;
  for(gy = y0; gy <= y1; gy += 3) for(gx = x0; gx <= x1; gx += 3){
    var d = (gx - cx) * (gx - cx) + (gy - cy) * (gy - cy);
    if(d >= bd) continue;
    var ox = gx - (v.w / 2 * ca - v.h / 2 * sa);
    var oy = gy - (v.w / 2 * sa + v.h / 2 * ca);
    if(!volFits(v, ox, oy)) continue;
    var ok = true;
    for(i = 0; i < placed.length; i++) if(volGap(v, ox, oy, placed[i]) < sep){ ok = false; break; }
    if(!ok) continue;
    bd = d; best = { x: Math.round(ox * 2) / 2, y: Math.round(oy * 2) / 2 };
  }
  return best;
}
/* Les niveaux d'un bâtiment se superposent : ils reçoivent tous le même centre, celui que
   le plus grand d'entre eux trouve dans le périmètre. Chacun se déplace ensuite librement. */
export function volPlaceLinked(list){
  if(!list.length) return list;
  var xs = PER.map(function(p){ return p[0]; }), ys = PER.map(function(p){ return p[1]; });
  var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
  var cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var big = list[0];
  list.forEach(function(v){ if(v.w * v.h > big.w * big.h) big = v; });
  var sp = volFindSpot(big, [], 0);
  if(sp){ cx = sp.x + (big.w / 2 * ca - big.h / 2 * sa); cy = sp.y + (big.w / 2 * sa + big.h / 2 * ca); }
  list.forEach(function(v){
    v.x = Math.round((cx - (v.w / 2 * ca - v.h / 2 * sa)) * 2) / 2;
    v.y = Math.round((cy - (v.w / 2 * sa + v.h / 2 * ca)) * 2) / 2;
  });
  return list;
}
/* le niveau dont on voit le plan : celui qu'on a choisi, sinon le plus grand */
export function volShown(){
  var k = -1, a = -1;
  VOLS.forEach(function(v, i){
    if(!v.link) return;
    if(i === volSel){ k = i; a = 1e9; return; }
    if(v.w * v.h > a){ a = v.w * v.h; k = i; }
  });
  return k;
}
/* refait les volumes depuis le plan, en gardant l'implantation déjà trouvée */
export function volSync(place){
  var list = volPlanLevels(), keep = {}, ns = [];
  VOLS.forEach(function(v){ if(v.link) keep[v.fl] = { x: v.x, y: v.y }; });
  list.forEach(function(v){
    if(!place && keep[v.fl]){ v.x = keep[v.fl].x; v.y = keep[v.fl].y; }
    else ns.push(v);
  });
  if(place || ns.length === list.length) volPlaceLinked(list);
  else if(ns.length){
    var ref = list.filter(function(v){ return ns.indexOf(v) < 0; })[0];
    var ca2 = Math.cos(VANG), sa2 = Math.sin(VANG);
    var rx = ref.x + (ref.w / 2 * ca2 - ref.h / 2 * sa2);
    var ry = ref.y + (ref.w / 2 * sa2 + ref.h / 2 * ca2);
    ns.forEach(function(v){
      v.x = Math.round((rx - (v.w / 2 * ca2 - v.h / 2 * sa2)) * 2) / 2;
      v.y = Math.round((ry - (v.w / 2 * sa2 + v.h / 2 * ca2)) * 2) / 2;
    });
  }
  VOLS = list;
  if(volSel >= VOLS.length) volSel = -1;
}
export function volSetLink(on, place){
  if(on === volLink && !place) return;
  if(on){
    if(!volLink) VOLS0 = VOLS;
    volLink = true;
    volSync(place || VOLS0 === VOLS);
  } else {
    volLink = false;
    if(VOLS0) VOLS = VOLS0;
    volSel = -1;
  }
  if(volLinkBtn) volLinkBtn.setAttribute("aria-pressed", String(volLink));
  volFit();
}

export function terrain(x, y){ return SITE.z[0] + SITE.z[1] * x + SITE.z[2] * y; }
export function inPer(x, y){
  var c = false, n = PER.length;
  for(var i = 0; i < n; i++){
    var a = PER[i], b = PER[(i + 1) % n];
    if((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1] + 1e-12) + a[0]) c = !c;
  }
  return c;
}
export function dSeg(px0, py0, a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  var t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((px0 - a[0]) * dx + (py0 - a[1]) * dy) / L2));
  return Math.hypot(px0 - (a[0] + t * dx), py0 - (a[1] + t * dy));
}
export function clearPer(x, y){
  var m = 1e9;
  for(var i = 0; i < PER.length; i++) m = Math.min(m, dSeg(x, y, PER[i], PER[(i + 1) % PER.length]));
  return m;
}
export function vcorners(v, x, y){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  x = (x === undefined) ? v.x : x; y = (y === undefined) ? v.y : y;
  return [[0,0],[v.w,0],[v.w,v.h],[0,v.h]].map(function(u){
    return [x + u[0] * ca - u[1] * sa, y + u[0] * sa + u[1] * ca];
  });
}
export function volFits(v, x, y){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var N = Math.max(2, Math.round(v.w / 4)), M = Math.max(2, Math.round(v.h / 4));
  for(var i = 0; i <= N; i++) for(var j = 0; j <= M; j++){
    if(i !== 0 && i !== N && j !== 0 && j !== M) continue;
    var u = v.w * i / N, t = v.h * j / M;
    var px0 = x + u * ca - t * sa, py0 = y + u * sa + t * ca;
    if(!inPer(px0, py0) || clearPer(px0, py0) < RETRAIT) return false;
  }
  return true;
}
export function volGap(v, x, y, o){
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  function loc(p){ var dx = p[0] - x, dy = p[1] - y; return [dx * ca + dy * sa, -dx * sa + dy * ca]; }
  var A = vcorners(v, x, y).map(loc), B = vcorners(o).map(loc);
  function ext(P, k){ return [Math.min(P[0][k],P[1][k],P[2][k],P[3][k]), Math.max(P[0][k],P[1][k],P[2][k],P[3][k])]; }
  var au = ext(A,0), av = ext(A,1), bu = ext(B,0), bv = ext(B,1);
  var du = Math.max(0, Math.max(au[0] - bu[1], bu[0] - au[1]));
  var dv = Math.max(0, Math.max(av[0] - bv[1], bv[0] - av[1]));
  return Math.max(du, dv);
}
export function volOK(k, x, y){
  var v = VOLS[k];
  if(!volFits(v, x, y)){
    /* un niveau trop grand pour le périmètre resterait bloqué : on le laisse se déplacer */
    if(!v.link || volFits(v, v.x, v.y)) return false;
  }
  for(var i = 0; i < VOLS.length; i++){
    if(i === k) continue;
    if(v.link || VOLS[i].link) continue;   /* des niveaux d'un même bâtiment se superposent */
    if(volGap(v, x, y, VOLS[i]) < ENTRE - 1e-6) return false;
  }
  return true;
}


/* ---- rendu, zoom et manipulation ---- */
export var VS0 = 1, VZ = 1, VTX = 0, VTY = 0, VW = 900, VH = 700, VX0 = 0, VY1 = 0;
export var volSel = -1, volHost = null;
export function vpx(x, y){
  return [(x - VX0) * VS0 * VZ + VTX, (VY1 - y) * VS0 * VZ + VTY];
}
export function vinv(px0, py0){
  return [(px0 - VTX) / (VS0 * VZ) + VX0, VY1 - (py0 - VTY) / (VS0 * VZ)];
}
export function vpath(P, close){
  return "M " + P.map(function(p){ var q = vpx(p[0], p[1]); return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L ") + (close ? " Z" : "");
}
export function volFrame(){
  var xs = PER.map(function(p){ return p[0]; }), ys = PER.map(function(p){ return p[1]; });
  var M = 30;
  VX0 = Math.min.apply(null, xs) - M; VY1 = Math.max.apply(null, ys) + M;
  var Wm = (Math.max.apply(null, xs) + M) - VX0, Hm = VY1 - (Math.min.apply(null, ys) - M);
  VW = Math.max(volHost.clientWidth || 880, 700);
  VS0 = VW / Wm; VH = Hm * VS0;
}
export function volFit(){ VZ = 1; VTX = 0; VTY = 0; }

/* --- répartition du programme dans les volumes --- */
export function volCapacity(){
  var pool = ROOMS.filter(function(r){
    return r.ci < 4 && r.a < 700 && r.n.indexOf("Salle de sport") < 0;
  }).slice().sort(function(a, b){ return (a.ci - b.ci) || (b.a - a.a); });
  var bars = [1, 2, 3], out = {}, idx = 0;
  bars.forEach(function(k2){
    var v = VOLS[k2], cap = v.w * v.h * v.lv * 0.82, acc = 0, list = [];
    while(idx < pool.length && acc + pool[idx].a <= cap){ acc += pool[idx].a; list.push(pool[idx]); idx++; }
    out[k2] = { rooms: list, used: acc, cap: cap };
  });
  out.left = pool.slice(idx);
  return out;
}
/* --- plan intérieur d'une barre : corridor central, salles de part et d'autre --- */
export function interior(v, rooms){
  var CW = Math.min(2.4, v.h * 0.2), dep = (v.h - CW) / 2, out = [];
  var xa = 0.3, xb = 0.3;
  rooms.forEach(function(r){
    var w = Math.max(1.5, Math.round((r.a / dep) * 2) / 2);
    if(w > v.w * 0.9) return;
    if(xa <= xb){
      if(xa + w > v.w - 0.3) return;
      out.push({ r: r, u: xa, t: v.h - dep, w: w, d: dep, side: 0 }); xa += w + 0.1;
    } else {
      if(xb + w > v.w - 0.3) return;
      out.push({ r: r, u: xb, t: 0, w: w, d: dep, side: 1 }); xb += w + 0.1;
    }
  });
  return { cells: out, cw: CW, dep: dep, placed: out.length };
}

export function volCircLabel(){
  if(volCircIn) volCircIn.value = String(Math.round(volCirc * 100));
  if(!volCircOut) return;
  var t = Math.round(volCirc * 100) + " %";
  if(volLink){
    var add = 0;
    VOLS.forEach(function(v){ if(v.link) add += v.w * v.h - v.net; });
    t += "  ·  + " + fmt(Math.round(add)) + " m²";
  } else t += "  ·  volumes libres";
  volCircOut.textContent = t;
}
/* Panneau de l'onglet Volumes : construit une fois, puis réutilisé. */
export function volPanel(){
  if(volNode) return volNode;
  volNode = el("section","panel plan-full");
  var vh = el("div","panel-head");
  vh.appendChild(el("i","panel-rule"));
  vh.appendChild(el("h2", null, "Volumes sur le site"));
  vh.appendChild(el("span","pct mono", "périmètre du concours, 12'783 m²"));
  volNode.appendChild(vh);
  var psub = el("p","panel-sub"); volNode.appendChild(psub); psub.innerHTML = (
    "Le programme posé dans le périmètre réel du concours, relevé sur le plan du géomètre. Déplace les volumes\u00a0: ils ne peuvent ni sortir du périmètre, ni s\u2019approcher à moins de 5 m des limites. Le terrain monte de 1,94 % vers l\u2019est — le panneau recalcule à chaque déplacement la hauteur disponible au-dessus de la nappe phréatique. \u00ab\u00a0Depuis le plan interactif\u00a0\u00bb remplace les cinq volumes dessinés à la main par <b>un volume par niveau</b>, pris du plan interactif\u00a0: chaque étage devient une boîte qui porte à l\u2019intérieur son propre schéma, pièce par pièce, aux positions exactes. La <b>barre de circulation</b> fixe ce qu\u2019on ajoute au programme pour le desservir, en pour cent de mètres carrés\u00a0: le volume grandit d\u2019autant autour du schéma, et la bande claire qui apparaît est cette circulation. Les niveaux d\u2019un même bâtiment peuvent se superposer librement\u00a0; l\u2019axonométrie les empile à leur cote.");
  var vw = el("div","vol-wrap");
  volHost = vw;
  volNode.appendChild(vw);
  var vk = el("div","vol-key");
  [["Périmètre du concours","#7C3AED",2.6,null],
   ["Bâti existant","var(--ink-3)",3,null],
   ["Projet mis à l'enquête","var(--f-adm)",2,"4 3"],
   ["Courbes de niveau et parcelles","var(--rule)",1.5,null]].forEach(function(k){
    var sp = el("span"), i2 = el("i");
    i2.style.background = k[1]; i2.style.height = k[2] + "px";
    if(k[3]){ i2.style.background = "none"; i2.style.borderTop = "2px dashed " + k[1]; }
    sp.appendChild(i2); sp.appendChild(document.createTextNode(k[0])); vk.appendChild(sp);
  });
  volNode.appendChild(vk);
  var vt = el("div","plan-tools");
  var bHome = el("button","tbtn shuffle","Implantation calculée"); bHome.type = "button";
  bHome.addEventListener("click", function(){
    if(volLink){ volSync(true); volFit(); drawVol(); return; }
    VOLS.forEach(function(v, i){ v.x = HOME[i].x; v.y = HOME[i].y; v.w = HOME[i].w; v.h = HOME[i].h; });
    volFit(); drawVol();
  });
  volLinkBtn = el("button","tbtn lock","Depuis le plan interactif");
  volLinkBtn.type = "button";
  volLinkBtn.setAttribute("aria-pressed", String(volLink));
  volLinkBtn.addEventListener("click", function(){
    volSetLink(!volLink);
    drawVol();
  });
  vt.appendChild(volLinkBtn);
  var cb = el("div","circbar");
  cb.appendChild(el("span","segcap","Circulation"));
  volCircIn = document.createElement("input");
  volCircIn.type = "range"; volCircIn.min = "0"; volCircIn.max = "45"; volCircIn.step = "1";
  volCircIn.value = String(Math.round(volCirc * 100));
  volCircIn.setAttribute("aria-label", "Part de circulation ajoutée aux volumes, en pour cent du programme");
  volCircOut = el("b", null, "");
  volCircIn.addEventListener("input", function(){
    volCirc = parseInt(volCircIn.value, 10) / 100;
    if(!volLink) volSetLink(true);
    else volSync(false);
    drawVol();
  });
  cb.appendChild(volCircIn);
  cb.appendChild(volCircOut);
  vt.appendChild(cb);
  var ms = el("div","zoomseg");
  var mPlan = el("button", null, "Plan"); mPlan.type = "button";
  var mAxo  = el("button", null, "Axonométrie"); mAxo.type = "button";
  ms.appendChild(mPlan); ms.appendChild(mAxo);
  mPlan.addEventListener("click", function(){ volMode = "plan"; volFit(); drawVol(); });
  mAxo.addEventListener("click", function(){ volMode = "axo"; VZ = 1; VTX = 0; VTY = 0; drawVol(); });
  vt.appendChild(ms);
  var ns = el("div","zoomseg");
  ns.appendChild(el("span","segcap","Niveaux"));
  [1,2,3,4].forEach(function(nv){
    var bb2 = el("button", null, String(nv)); bb2.type = "button";
    bb2.addEventListener("click", function(){
      if(volSel < 0 || volSel === 0 || VOLS[volSel].link) return;
      VOLS[volSel].lv = nv;
      VOLS[volSel].sub = nv > 1 ? "R+" + (nv - 1) + " · " + fmt(VOLS[volSel].w * VOLS[volSel].h * nv) + " m²"
                                : fmt(VOLS[volSel].w * VOLS[volSel].h) + " m²";
      drawVol();
    });
    ns.appendChild(bb2);
  });
  vt.appendChild(ns);
  var be = el("button","tbtn","Abri enterré"); be.type = "button";
  be.setAttribute("aria-pressed","false");
  be.addEventListener("click", function(){
    volEnterre = !volEnterre;
    be.setAttribute("aria-pressed", String(volEnterre));
    drawVol();
  });
  vt.appendChild(be);
  var zs = el("div","zoomseg");
  var zM = el("button", null, "−"); zM.type = "button";
  var zF = el("button", null, "Ajuster"); zF.type = "button";
  var zP = el("button", null, "+"); zP.type = "button";
  zs.appendChild(zM); zs.appendChild(zF); zs.appendChild(zP);
  zM.addEventListener("click", function(){ VZ = Math.max(0.6, VZ / 1.4); drawVolumes(); });
  zP.addEventListener("click", function(){ VZ = Math.min(9, VZ * 1.4); drawVolumes(); });
  zF.addEventListener("click", function(){ volFit(); drawVolumes(); });
  vt.appendChild(zs);
  vt.appendChild(bHome);
  vt.appendChild(el("span","savechip",
    "glisser un volume · poignées pour redimensionner · molette pour zoomer · R pour pivoter · Niveaux agit sur le volume sélectionné"));
  volNode.appendChild(vt);
  volMet = el("dl","arch-metrics");
  volNode.appendChild(volMet);
  var vn = el("div","arch-note");
  vn.innerHTML = "<b>Ce que dit le site.</b> Le périmètre couvre les parcelles 5606 à 5614 et 4550. Le polygone du géomètre mesure 176,8 × 122,9 m pour 12&#8239;783 m², soit 8,9 % de plus que les 11&#8239;740 m² annoncés au règlement — le tracé englobe les bords de route. Aucun bâtiment existant à l'intérieur. Le grand axe du terrain est à 6,3° de l'est, ce qui oriente naturellement les barres de classes vers le sud.<br><b>La nappe commande l'abri PC.</b> Le terrain monte de 463,3 m au sud-ouest à 466,7 m à l'est, tandis que la nappe est à 462,25 m au plus haut, en zone de protection des eaux Au - Karst. La hauteur disponible passe de <b>1,0 m à l'ouest à 4,5 m à l'est</b>. Un abri enterré demande 3,00 m : il n'y a que le tiers est du site où c'est possible. Déplace le volume gris d'est en ouest et regarde le verdict basculer.<br><b>Réserves.</b> Le plan du terrain est une régression sur 99 points de courbe de niveau du périmètre, erreur moyenne 0,22 m — suffisant pour arbitrer, pas pour dimensionner. Les noms de rue ne figurent pas dans le fichier, les accès restent donc à placer à la main. La pollution des sols de la parcelle 4550 était encore à l'étude au moment du règlement.";
  volNode.appendChild(vn);
  return volNode;
}

export function drawVol(){
  if(volMode === "axo") drawAxo(); else drawVolumes();
  volCircLabel();
}
export function drawVolumes(){
  volFrame();
  var host = volHost;
  while(host.firstChild) host.removeChild(host.firstChild);
  var svg = s("svg", { viewBox: "0 0 " + VW.toFixed(0) + " " + VH.toFixed(0), width: "100%",
    height: VH.toFixed(0), role: "img",
    "aria-label": "Plan de situation : les volumes du centre scolaire dans le périmètre du concours" });
  var clip = s("clipPath", { id: "volclip" });
  clip.appendChild(s("rect", { x: 0, y: 0, width: VW, height: VH }));
  svg.appendChild(clip);
  var root = s("g", { "clip-path": "url(#volclip)" });
  svg.appendChild(root);

  function lay(key, col, sw, dash){
    var g = s("g", { fill: "none", stroke: col, "stroke-width": sw, "vector-effect": "non-scaling-stroke" });
    if(dash) g.setAttribute("stroke-dasharray", dash);
    (SITE[key] || []).forEach(function(P){ g.appendChild(s("path", { d: vpath(P) })); });
    root.appendChild(g);
  }
  lay("ctr", "var(--rule-soft)", 1);
  lay("par", "var(--rule)", 1);
  lay("mur", "var(--ink-3)", 1);
  lay("foo", "var(--f-spo)", 1);
  lay("rou", "var(--ink-3)", 1.6);
  var gb = s("g", { fill: "var(--ink-3)", "fill-opacity": ".45", stroke: "var(--ink-2)",
    "stroke-width": 1, "vector-effect": "non-scaling-stroke" });
  (SITE.bat || []).forEach(function(P){ gb.appendChild(s("path", { d: vpath(P, 1) })); });
  root.appendChild(gb);
  var ge = s("g", { fill: "none", stroke: "var(--f-adm)", "stroke-width": 1.6,
    "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" });
  (SITE.enq || []).forEach(function(P){ ge.appendChild(s("path", { d: vpath(P, 1) })); });
  root.appendChild(ge);
  root.appendChild(s("path", { d: vpath(PER, 1), fill: "#7C3AED", "fill-opacity": ".05",
    stroke: "#7C3AED", "stroke-width": 2.6, "vector-effect": "non-scaling-stroke" }));

  var ppm = VS0 * VZ, detail = ppm >= (volLink ? 2 : 6), cap = volLink ? null : volCapacity();
  var shown = volLink ? volShown() : -1;
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  VOLS.forEach(function(v, k){
    var col = "var(" + FMAP[v.f].c + ")";
    var bad = v.link && !volFits(v, v.x, v.y);
    var g = s("g", { "class": "vol" + (k === volSel ? " sel" : ""), "data-k": k, tabindex: "0" });
    g.appendChild(s("path", { d: vpath(vcorners(v), 1), fill: col,
      "fill-opacity": detail ? ".10" : ".26", stroke: bad ? "#d03b3b" : col,
      "stroke-width": k === volSel ? 3 : (bad ? 2.6 : 2),
      "stroke-dasharray": bad ? "9 5" : null, "vector-effect": "non-scaling-stroke" }));

    if(detail){
      var T = function(u, t){ return [v.x + u * ca - t * sa, v.y + u * sa + t * ca]; };
      if(v.link){                        /* le schéma du niveau, resserré, posé dans le volume */
        ((v.pack && k === shown) ? v.pack.cells : []).forEach(function(c2){
          var r = c2.r, L2 = { w: c2.w, h: c2.h };
          var u0 = c2.u + v.m;
          var t0 = v.h - v.m - c2.t - c2.h;              /* le plan se lit dans le même sens */
          var rc2 = [T(u0,t0),T(u0+L2.w,t0),T(u0+L2.w,t0+L2.h),T(u0,t0+L2.h)];
          var rc3 = "var(" + FMAP[r.f].c + ")";
          g.appendChild(s("path", { d: vpath(rc2, 1), fill: rc3, "fill-opacity": "var(--fill-op)",
            stroke: rc3, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
          if(L2.w * ppm > 46 && L2.h * ppm > 26){
            var md = T(u0 + L2.w/2, t0 + L2.h/2), q3 = vpx(md[0], md[1]);
            var fz = Math.min(11, L2.w * ppm / 7);
            var nm = r.n.replace(/ \d+$/, "");
            var maxc = Math.floor(L2.w * ppm / (fz * 0.53));
            if(nm.length > maxc) nm = maxc > 4 ? nm.slice(0, maxc - 1) + "…" : "";
            var tn = s("text", { x: q3[0], y: q3[1] - 1, "text-anchor": "middle",
              "font-size": fz, fill: "var(--ink-2)" });
            tn.textContent = nm;
            g.appendChild(tn);
            var ta = s("text", { x: q3[0], y: q3[1] + 10, "text-anchor": "middle",
              "font-size": Math.min(9.5, L2.w * ppm / 8), fill: "var(--ink-3)",
              "font-family": "'IBM Plex Mono', monospace" });
            ta.textContent = fmt(r.a) + " m²";
            g.appendChild(ta);
          }
        });
      } else if(k === 0){                 /* salle de sport : aire de jeu et refend */
        var pad = 2;
        g.appendChild(s("path", { d: vpath([T(pad,pad),T(v.w-pad,pad),T(v.w-pad,v.h-pad),T(pad,v.h-pad)], 1),
          fill: "none", stroke: col, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" }));
        g.appendChild(s("path", { d: vpath([T(v.w/2,0),T(v.w/2,v.h)]), fill: "none", stroke: col,
          "stroke-width": 1.4, "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" }));
      } else if(k === 4 && !volLink){    /* abri PC : trame de secteurs */
        for(var q = 1; q < 3; q++)
          g.appendChild(s("path", { d: vpath([T(v.w*q/3,0),T(v.w*q/3,v.h)]), fill: "none",
            stroke: col, "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }));
      } else if(cap && cap[k]){          /* barres : corridor central et salles */
        var iv = interior(v, cap[k].rooms);
        g.appendChild(s("path", { d: vpath([T(0,iv.dep),T(v.w,iv.dep),T(v.w,iv.dep+iv.cw),T(0,iv.dep+iv.cw)], 1),
          fill: "var(--paper)", "fill-opacity": ".7", stroke: "none" }));
        iv.cells.forEach(function(c){
          var rc = [T(c.u,c.t),T(c.u+c.w,c.t),T(c.u+c.w,c.t+c.d),T(c.u,c.t+c.d)];
          var rcol = "var(" + FMAP[c.r.f].c + ")";
          g.appendChild(s("path", { d: vpath(rc, 1), fill: rcol, "fill-opacity": "var(--fill-op)",
            stroke: rcol, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
          if(c.w * ppm > 46 && c.d * ppm > 26){
            var mid = T(c.u + c.w/2, c.t + c.d/2), q2 = vpx(mid[0], mid[1]);
            var tx = s("text", { x: q2[0], y: q2[1] - 1, "text-anchor": "middle",
              "font-size": Math.min(11, c.w * ppm / 7), fill: "var(--ink-2)" });
            tx.textContent = c.r.n.replace(/ \d+$/, "");
            g.appendChild(tx);
            var t3 = s("text", { x: q2[0], y: q2[1] + 10, "text-anchor": "middle",
              "font-size": Math.min(9.5, c.w * ppm / 8), fill: "var(--ink-3)",
              "font-family": "'IBM Plex Mono', monospace" });
            t3.textContent = fmt(c.r.a) + " m²";
            g.appendChild(t3);
          }
        });
      }
    } else if(v.lv > 1){
      var m2 = 1.6;
      g.appendChild(s("path", { d: vpath([[v.x+m2*ca-m2*sa, v.y+m2*sa+m2*ca],
        [v.x+(v.w-m2)*ca-m2*sa, v.y+(v.w-m2)*sa+m2*ca],
        [v.x+(v.w-m2)*ca-(v.h-m2)*sa, v.y+(v.w-m2)*sa+(v.h-m2)*ca],
        [v.x+m2*ca-(v.h-m2)*sa, v.y+m2*sa+(v.h-m2)*ca]], 1), fill: "none", stroke: col,
        "stroke-width": 1, "stroke-dasharray": "5 4", "vector-effect": "non-scaling-stroke" }));
    }

    var C = vcorners(v), cx = (C[0][0]+C[2][0])/2, cy = (C[0][1]+C[2][1])/2, q = vpx(cx, cy);
    if(v.link){
      var qt = vpx(C[3][0], C[3][1]);
      var lt = s("text", { x: qt[0] + 2, y: qt[1] - 6, "font-size": 11.5, "font-weight": 600,
        fill: "var(--ink)" });
      lt.textContent = v.n;
      root.appendChild(lt);
      var ls = s("text", { x: qt[0] + 2, y: qt[1] + 7, "font-size": 9.5, fill: "var(--ink-3)",
        "font-family": "'IBM Plex Mono', monospace" });
      ls.textContent = dim(v.w) + " × " + dim(v.h) + " m · " + fmt(Math.round(v.w * v.h)) + " m² · "
        + v.nb + " pièces" + (k === shown ? "" : " — clique pour voir son plan");
      root.appendChild(ls);
    }
    if(!v.link && (!detail || k === 0 || k === 4)){
      var t1 = s("text", { x: q[0], y: q[1] - 4, "text-anchor": "middle", "font-size": 11.5,
        "font-weight": 600, fill: "var(--ink)" });
      t1.textContent = v.n.split(" — ")[0];
      g.appendChild(t1);
      var t2 = s("text", { x: q[0], y: q[1] + 10, "text-anchor": "middle", "font-size": 10,
        fill: "var(--ink-2)", "font-family": "'IBM Plex Mono', monospace" });
      t2.textContent = dim(v.w) + " × " + dim(v.h) + " m · " + v.sub;
      g.appendChild(t2);
    }
    /* poignées de redimensionnement */
    if(k === volSel && k !== 0 && !v.link){
      [["e",1,.5],["w",0,.5],["n",.5,1],["s",.5,0],["ne",1,1],["nw",0,1],["se",1,0],["sw",0,0]]
        .forEach(function(hd){
          var pt = [v.x + v.w*hd[1]*ca - v.h*hd[2]*sa, v.y + v.w*hd[1]*sa + v.h*hd[2]*ca];
          var qq = vpx(pt[0], pt[1]);
          var r2 = s("rect", { x: qq[0]-5, y: qq[1]-5, width: 10, height: 10, rx: 2,
            fill: "var(--paper)", stroke: "var(--ink)", "stroke-width": 1.6,
            "class": "vh", "data-dir": hd[0] });
          g.appendChild(r2);
        });
    }
    root.appendChild(g);
  });

  var by = VH - 24;
  for(var i = 0; i < 4; i++)
    svg.appendChild(s("rect", { x: 14 + i*12.5*ppm, y: by, width: 12.5*ppm, height: 4,
      fill: i % 2 ? "var(--panel)" : "var(--ink-2)", stroke: "var(--ink-2)",
      "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
  var sc = s("text", { x: 14 + 50*ppm + 7, y: by + 4, "font-size": 10.5, fill: "var(--ink-3)",
    "font-family": "'IBM Plex Mono', monospace" });
  sc.textContent = "50 m  ·  " + (detail ? "plan intérieur visible" : "zoome pour voir les salles");
  svg.appendChild(sc);
  var nx = VW - 30;
  svg.appendChild(s("path", { d: "M "+nx+" 18 L "+(nx-6)+" 44 L "+nx+" 38 L "+(nx+6)+" 44 Z", fill: "var(--ink)" }));
  var nt = s("text", { x: nx, y: 58, "text-anchor": "middle", "font-size": 10.5, fill: "var(--ink-2)" });
  nt.textContent = "N";
  svg.appendChild(nt);
  host.appendChild(svg);
  volMetrics(cap);
}

export function volMetrics(cap){
  while(volMet.firstChild) volMet.removeChild(volMet.firstChild);
  function met(t, v, sub, cls){
    var d = el("div", cls || null);
    d.appendChild(el("dt", null, t));
    var dd = el("dd", null, v);
    if(sub) dd.appendChild(el("small", null, sub));
    d.appendChild(dd); volMet.appendChild(d);
  }
  if(volLink){
    var emp0 = 0, planch0 = 0, net0 = 0, nbp = 0;
    VOLS.forEach(function(v){
      planch0 += v.w * v.h; net0 += v.net; nbp += v.nb;
      if(v.lvl >= 0) emp0 = Math.max(emp0, v.w * v.h);
    });
    var hors = 0;
    ROOMS.forEach(function(r){ if(r.ci < 4 && r.fl === TRAY) hors++; });
    met("Emprise au sol", fmt(Math.round(emp0)) + " m²",
        "le plus grand niveau hors sol commande l'emprise : " + Math.round(emp0 / PERAIRE * 100)
        + " % des 12'783 m² du périmètre");
    met("Surface de plancher", fmt(Math.round(planch0)) + " m²",
        VOLS.length + (VOLS.length > 1 ? " niveaux repris du plan interactif" : " niveau repris du plan interactif"));
    var jeu0 = 0;
    VOLS.forEach(function(v){ jeu0 += v.jeu || 0; });
    met("Circulation ajoutée", fmt(Math.round(planch0 - net0 - jeu0)) + " m²",
        Math.round(volCirc * 100) + " % du programme — la couronne claire autour du schéma, à régler à la barre");
    met("Jeu du calepinage", fmt(Math.round(jeu0)) + " m²",
        "ce que le rangement des pièces laisse entre elles, en plus de la circulation réglée");
    met("Programme logé", fmt(Math.round(net0)) + " m² · " + nbp + " pièces",
        hors ? hors + " pièce" + (hors > 1 ? "s" : "") + " encore au bac « À placer »"
             : "tout le programme bâti est dans un niveau",
        hors ? "ko" : "ok");
    met("Terrain libre", fmt(Math.round(PERAIRE - emp0)) + " m²",
        "cour, 70 places de parc, 50 vélos, dépose des bus et 900 m² du 2ᵉ temps",
        (PERAIRE - emp0) > 3250 ? "ok" : "ko");
    var sous = VOLS.filter(function(v){ return v.lvl < 0; });
    if(sous.length){
      var Cs = vcorners(sous[0]);
      var sx = (Cs[0][0]+Cs[2][0])/2, sy = (Cs[0][1]+Cs[2][1])/2;
      var zs = terrain(sx, sy), mg = zs - NAPPE;
      met("Marge sur la nappe", mg.toFixed(2) + " m",
          "sous le " + sous[0].n.toLowerCase() + ", terrain à " + zs.toFixed(2) + " m. "
          + (mg >= SOUSSOL ? "Excavation possible." : "Excavation exclue — il faut 3,00 m. Pousse le volume vers l'est."),
          mg >= SOUSSOL ? "ok" : "ko");
    }
    return;
  }
  cap = cap || volCapacity();
  var emp = VOLS.reduce(function(t, v){ return t + v.w * v.h; }, 0);
  var planch = VOLS.reduce(function(t, v){ return t + v.w * v.h * v.lv; }, 0);
  var besoin = 0;
  ROOMS.forEach(function(r){ if(r.ci < 4) besoin += r.a; });
  met("Emprise au sol", fmt(Math.round(emp)) + " m²",
      Math.round(emp / PERAIRE * 100) + " % des 12'783 m² du périmètre");
  met("Surface de plancher", fmt(Math.round(planch)) + " m²",
      "il faut " + fmt(Math.round(besoin)) + " m² de programme plus la circulation",
      planch >= besoin * 1.15 ? "ok" : "ko");
  var reste = cap.left.length;
  met("Pièces non logées", String(reste),
      reste ? "agrandis les barres : " + cap.left.slice(0,3).map(function(r){ return r.n; }).join(", ")
            : "tout le programme entre dans les volumes",
      reste ? "ko" : "ok");
  met("Terrain libre", fmt(Math.round(PERAIRE - emp)) + " m²",
      "cour, 70 places de parc, 50 vélos, dépose des bus et 900 m² du 2ᵉ temps",
      (PERAIRE - emp) > 3250 ? "ok" : "ko");
  var abri = VOLS[4], C = vcorners(abri);
  var acx = (C[0][0]+C[2][0])/2, acy = (C[0][1]+C[2][1])/2;
  var zt = terrain(acx, acy), marge = zt - NAPPE;
  met("Marge sur la nappe", marge.toFixed(2) + " m",
      "sous l'abri PC, terrain à " + zt.toFixed(2) + " m. " + (marge >= SOUSSOL
        ? "Sous-sol possible : 3,00 m suffisent pour 2,40 m libres."
        : "Sous-sol exclu — il faut 3,00 m. Pousse l'abri vers l'est."),
      marge >= SOUSSOL ? "ok" : "ko");
}


/* ================= AXONOMÉTRIE =================
   Projection militaire : le plan reste vrai, tourné de 32°, les hauteurs montent
   verticalement. Chaque niveau est une boîte distincte, les dalles se lisent donc
   entre les étages. Les volumes reposent sur le terrain naturel, qui monte de
   1,94 % vers l'est — l'axonométrie montre ce dénivelé. */
export var AXO_T = 0.5585, AXO_K = 1.0;    /* 32° et hauteurs à l'échelle */
export var volMode = "plan";
export function axoP(x, y, z){
  var c = Math.cos(AXO_T), s2 = Math.sin(AXO_T);
  return [x * c - y * s2, -(x * s2 + y * c) - z * AXO_K];
}
export function axoDepth(x, y){ return x * Math.sin(AXO_T) + y * Math.cos(AXO_T); }

export function drawAxo(){
  var host = volHost;
  while(host.firstChild) host.removeChild(host.firstChild);
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  var items = [];

  function box(base, z0, z1, col, opTop, label, sub){
    var d = 0;
    base.forEach(function(p){ d += axoDepth(p[0], p[1]); });
    items.push({ d: d / base.length + z0 * 0.01, kind: "box",
      base: base, z0: z0, z1: z1, col: col, op: opTop, label: label, sub: sub });
  }
  function flat(P, col, sw, close, dash){
    var d = 0;
    P.forEach(function(p){ d += axoDepth(p[0], p[1]); });
    items.push({ d: d / P.length - 1e5, kind: "flat", P: P, col: col, sw: sw, close: close, dash: dash });
  }

  /* sol : périmètre, routes, parcelles, posés sur le terrain */
  flat(PER, "#7C3AED", 2.4, 1);
  (SITE.rou || []).forEach(function(P){ flat(P, "var(--ink-3)", 1.4, 0); });
  (SITE.par || []).forEach(function(P){ flat(P, "var(--rule)", 0.8, 0); });
  (SITE.foo || []).forEach(function(P){ flat(P, "var(--f-spo)", 0.9, 0); });
  /* bâti existant, extrudé forfaitairement à 7 m */
  (SITE.bat || []).forEach(function(P){
    if(P.length < 3) return;
    box(P, 0, 7, "var(--ink-3)", 0.5, null, null);
  });
  (SITE.enq || []).forEach(function(P){ flat(P, "var(--f-adm)", 1.4, 1, "5 4"); });

  /* volumes du projet, niveau par niveau */
  var cap = volLink ? null : volCapacity();
  VOLS.forEach(function(v, k){
    var C = vcorners(v);
    var cx = (C[0][0] + C[2][0]) / 2, cy = (C[0][1] + C[2][1]) / 2;
    var zt = terrain(cx, cy) - 463.3;            /* hauteur relative au point bas du site */
    var col = "var(" + FMAP[v.f].c + ")";
    var hl = v.link ? 3.5 : (k === 0) ? 9 : (k === 4) ? 3 : 3.5;
    var nz = v.link ? v.lvl : ((k === 4 && volEnterre) ? -1 : 0);
    for(var i = 0; i < v.lv; i++){
      var z0 = zt + (i + nz) * hl, z1 = z0 + hl;
      box(C, z0, z1, col, 0.34 - i * 0.05,
          i === v.lv - 1 ? v.n.split(" — ")[0] : null,
          i === v.lv - 1 ? (dim(v.w) + " × " + dim(v.h) + " m · " + v.lv + (v.lv > 1 ? " niveaux" : " niveau")) : null);
    }
  });

  /* cadrage */
  var pts = [];
  items.forEach(function(it){
    var P = it.kind === "box" ? it.base : it.P;
    P.forEach(function(p){
      pts.push(axoP(p[0], p[1], it.kind === "box" ? it.z1 : 0));
      pts.push(axoP(p[0], p[1], it.kind === "box" ? it.z0 : 0));
    });
  });
  var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
  var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs);
  var mny = Math.min.apply(null, ys), mxy = Math.max.apply(null, ys);
  var W = Math.max(host.clientWidth || 880, 700);
  var sc = (W - 40) / (mxx - mnx) * VZ;
  var H = (mxy - mny) * sc + 60;
  function P2(x, y, z){
    var q = axoP(x, y, z);
    return [(q[0] - mnx) * sc + 20 + VTX, (q[1] - mny) * sc + 30 + VTY];
  }
  var svg = s("svg", { viewBox: "0 0 " + W.toFixed(0) + " " + Math.max(H, 380).toFixed(0),
    width: "100%", height: Math.max(H, 380).toFixed(0), role: "img",
    "aria-label": "Axonométrie du centre scolaire, étage par étage, sur le terrain du concours" });

  items.sort(function(a, b){ return b.d - a.d; });
  items.forEach(function(it){
    if(it.kind === "flat"){
      var d = "M " + it.P.map(function(p){ var q = P2(p[0], p[1], 0); return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L ") + (it.close ? " Z" : "");
      var e = s("path", { d: d, fill: "none", stroke: it.col, "stroke-width": it.sw, "vector-effect": "non-scaling-stroke" });
      if(it.dash) e.setAttribute("stroke-dasharray", it.dash);
      svg.appendChild(e);
      return;
    }
    var B = it.base, n = B.length, faces = [];
    for(var i = 0; i < n; i++){
      var a = B[i], b = B[(i + 1) % n];
      faces.push({ d: (axoDepth(a[0], a[1]) + axoDepth(b[0], b[1])) / 2,
        pts: [[a[0],a[1],it.z0],[b[0],b[1],it.z0],[b[0],b[1],it.z1],[a[0],a[1],it.z1]] });
    }
    faces.sort(function(p, q){ return q.d - p.d; });
    faces.forEach(function(fc, idx){
      var d = "M " + fc.pts.map(function(p){ var q = P2(p[0], p[1], p[2]); return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L ") + " Z";
      svg.appendChild(s("path", { d: d, fill: it.col,
        "fill-opacity": (idx < 2 ? it.op * 0.55 : it.op * 0.85).toFixed(3),
        stroke: it.col, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
    });
    var top = "M " + B.map(function(p){ var q = P2(p[0], p[1], it.z1); return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" L ") + " Z";
    svg.appendChild(s("path", { d: top, fill: it.col, "fill-opacity": it.op,
      stroke: it.col, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" }));
    if(it.label){
      var cx2 = 0, cy2 = 0;
      B.forEach(function(p){ cx2 += p[0]; cy2 += p[1]; });
      var q2 = P2(cx2 / B.length, cy2 / B.length, it.z1);
      var t1 = s("text", { x: q2[0], y: q2[1] - 3, "text-anchor": "middle", "font-size": 11.5,
        "font-weight": 600, fill: "var(--ink)" });
      t1.textContent = it.label;
      svg.appendChild(t1);
      if(it.sub){
        var t2 = s("text", { x: q2[0], y: q2[1] + 10, "text-anchor": "middle", "font-size": 9.5,
          fill: "var(--ink-2)", "font-family": "'IBM Plex Mono', monospace" });
        t2.textContent = it.sub;
        svg.appendChild(t2);
      }
    }
  });
  var lg = s("text", { x: 16, y: Math.max(H, 380) - 14, "font-size": 10.5, fill: "var(--ink-3)",
    "font-family": "'IBM Plex Mono', monospace" });
  lg.textContent = "axonométrie militaire · plan vrai tourné de 32° · hauteurs d'étage 3,50 m, salle de sport 9 m"
    + (volEnterre ? " · abri PC enterré" : "");
  svg.appendChild(lg);
  host.appendChild(svg);
  volMetrics(cap);
}

export function wireVol(){
  var drag = null;
  function pt(e){
    var r = volHost.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  volHost.addEventListener("pointerdown", function(e){
    if(e.button !== 0 || volMode === "axo") return;
    var hd = e.target.closest ? e.target.closest(".vh") : null;
    var g = e.target.closest ? e.target.closest("g.vol") : null;
    var P = pt(e), Wm = vinv(P[0], P[1]);
    if(hd && g){
      var k = +g.dataset.k;
      drag = { mode: "size", k: k, dir: hd.dataset.dir, m0: Wm,
               v0: { x:VOLS[k].x, y:VOLS[k].y, w:VOLS[k].w, h:VOLS[k].h } };
      volSel = k;
    } else if(g){
      var k2 = +g.dataset.k;
      drag = { mode: "move", k: k2, m0: Wm, v0: { x:VOLS[k2].x, y:VOLS[k2].y } };
      volSel = k2;
    } else {
      drag = { mode: "pan", p0: P, tx: VTX, ty: VTY };
      volSel = -1;
    }
    volHost.setPointerCapture(e.pointerId);
    drawVol();
    e.preventDefault();
  });
  volHost.addEventListener("pointermove", function(e){
    if(!drag) return;
    var P = pt(e);
    if(drag.mode === "pan"){
      VTX = drag.tx + (P[0] - drag.p0[0]); VTY = drag.ty + (P[1] - drag.p0[1]);
      drawVol(); return;
    }
    var Wm = vinv(P[0], P[1]);
    var ca = Math.cos(VANG), sa = Math.sin(VANG);
    var dx = Wm[0] - drag.m0[0], dy = Wm[1] - drag.m0[1];
    var du = dx * ca + dy * sa, dv = -dx * sa + dy * ca;   /* delta dans le repère du volume */
    var v = VOLS[drag.k], V0 = drag.v0;
    if(drag.mode === "move"){
      var nx = Math.round((V0.x + dx) * 2) / 2, ny = Math.round((V0.y + dy) * 2) / 2, done = false;
      if(volOK(drag.k, nx, ny)){ v.x = nx; v.y = ny; done = true; }
      else if(volOK(drag.k, nx, v.y)){ v.x = nx; done = true; }
      else if(volOK(drag.k, v.x, ny)){ v.y = ny; done = true; }
      if(done) drawVol();
      return;
    }
    /* redimensionnement */
    if(drag.k === 0 || VOLS[drag.k].link) return;  /* dimensions imposées ou calculées */
    var d = drag.dir, nw = V0.w, nh = V0.h, ou = 0, ov = 0;
    if(d.indexOf("e") >= 0) nw = V0.w + du;
    if(d.indexOf("w") >= 0){ nw = V0.w - du; ou = du; }
    if(d.indexOf("n") >= 0) nh = V0.h + dv;
    if(d.indexOf("s") >= 0){ nh = V0.h - dv; ov = dv; }
    nw = Math.max(12, Math.min(90, Math.round(nw * 2) / 2));
    nh = Math.max(10, Math.min(40, Math.round(nh * 2) / 2));
    if(drag.k === 4){                             /* abri PC : surface constante */
      var A = 930, dd = nearestDims(A, nw);
      nw = dd.w; nh = dd.h;
    }
    ou = (d.indexOf("w") >= 0) ? V0.w - nw : 0;
    ov = (d.indexOf("s") >= 0) ? V0.h - nh : 0;
    var px0 = V0.x + ou * ca - ov * sa, py0 = V0.y + ou * sa + ov * ca;
    px0 = Math.round(px0 * 2) / 2; py0 = Math.round(py0 * 2) / 2;
    var ow = v.w, oh = v.h, ox = v.x, oy = v.y;
    v.w = nw; v.h = nh; v.x = px0; v.y = py0;
    if(!volOK(drag.k, px0, py0)){ v.w = ow; v.h = oh; v.x = ox; v.y = oy; }
    else drawVol();
  });
  function stop(e){
    if(!drag) return;
    drag = null;
    try { volHost.releasePointerCapture(e.pointerId); } catch(_){}
  }
  volHost.addEventListener("pointerup", stop);
  volHost.addEventListener("pointercancel", stop);
  volHost.addEventListener("wheel", function(e){
    e.preventDefault();
    if(volMode === "axo"){
      VZ = Math.max(0.5, Math.min(4, VZ * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      drawVol(); return;
    }
    var P = pt(e), before = vinv(P[0], P[1]);
    VZ = Math.max(0.6, Math.min(9, VZ * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    var after = vinv(P[0], P[1]);
    VTX += (after[0] - before[0]) * VS0 * VZ;
    VTY -= (after[1] - before[1]) * VS0 * VZ;
    drawVol();
  }, { passive: false });
  document.addEventListener("keydown", function(e){
    if(view.grouping !== "vol") return;
    var t = e.target;
    if(t && (t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if(e.key === "Escape"){ volSel = -1; drawVol(); return; }
    if(volSel < 0) return;
    var v = VOLS[volSel], st = e.shiftKey ? 5 : 0.5, nx = v.x, ny = v.y;
    if(e.key === "ArrowLeft") nx -= st;
    else if(e.key === "ArrowRight") nx += st;
    else if(e.key === "ArrowUp") ny += st;
    else if(e.key === "ArrowDown") ny -= st;
    else if(e.key.toLowerCase() === "r" && volSel !== 0 && !VOLS[volSel].link){
      var w = v.w; v.w = v.h; v.h = w;
      if(!volOK(volSel, v.x, v.y)){ v.h = v.w; v.w = w; }
      e.preventDefault(); drawVol(); return;
    } else return;
    e.preventDefault();
    nx = Math.round(nx * 2) / 2; ny = Math.round(ny * 2) / 2;
    if(volOK(volSel, nx, ny)){ v.x = nx; v.y = ny; drawVol(); }
  });
}

