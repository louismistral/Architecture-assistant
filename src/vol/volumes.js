import { dec, dim, el, fmt } from "../core/format.js";
import { nearestDims, pack } from "../core/geometry.js";
import { FMAP } from "../core/model.js";
import { s } from "../core/svg.js";
import { view } from "../core/viewstate.js";
import { FAM } from "../data/families.js";
import { ENTRE, RULES, SOUSSOL } from "../data/rules.js";
import { NAPPE, PER, PERAIRE, SITE, VANG } from "../data/site.js";
import { layout } from "../plan/editor.js";
import { FLOORS, HORS, TRAY, lvlOf } from "../plan/levels.js";
import { PART } from "../plan/links.js";
import { ROOMS } from "../plan/rooms.js";
import { massCheck, massVerdict } from "./checks.js";
import { MASS, PARTIS, massGen, massSet, partiOf } from "./massing.js";
import { terrain, vcorners, vmid, volFits, volGap, volPlaceLinked } from "./place.js";
import { camLabel, scene3dDraw, scene3dFit, scene3dMount, scene3dPan, scene3dPick,
         scene3dTurn, scene3dZoom, setSceneSel } from "./scene3d.js";

/* ---- d'où viennent les volumes ----
   Cinq volumes étaient écrits à la main ici, avec leurs surfaces : « Barre A —
   classes, R+1, 1'728 m² ». Le programme y était redit une deuxième fois, et
   rien ne le tenait à jour. Les volumes viennent maintenant du générateur
   (`massing.js`), qui les déduit du programme et des règles ; la main reste
   entière pour les déplacer, les tourner et les redimensionner. */
export var VOLS = massGen().vols;
export var volGen = massGen();
export function volRegen(){
  volGen = massGen();
  VOLS = volGen.vols;
  volSel = -1;
  setSceneSel(-1);
}
export var volNode = null, volMet = null, volChk = null, volCam = null, volEnterre = !MASS.enterre;
var volLvPaint = null, volLvWhy = null, volGenPaint = null;

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
  if(volGenPaint) volGenPaint();
  volFit();
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
  /* Les corps qui reçoivent des salles : l'école, ses barres ou ses pavillons,
     et l'UAPE. Ils étaient désignés par leur index — 1, 2, 3 — ce qui ne tenait
     que tant que les volumes étaient écrits à la main. */
  var out = {}, idx = 0, bars = [];
  VOLS.forEach(function(v, i){
    if(!v.sol && v.ph !== 2 && v.nz >= 0 && /^(ecole|uape)/.test(v.key || "")) bars.push(i);
  });
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
/* ---- réglages du parti ----
   Le programme est fixe ; ces quatre réglages sont tout ce qu'on peut vraiment
   décider à ce stade : la figure, le nombre de corps, le nombre de niveaux et
   la profondeur du bâti. Chacun refait la proposition et refait le contrôle. */
function segment(caption, list, get, set){
  var g = el("div","zoomseg");
  if(caption) g.appendChild(el("span","segcap", caption));
  var btns = [];
  list.forEach(function(o){
    var b = el("button", null, o.n); b.type = "button";
    if(o.d) b.title = o.d;
    b.addEventListener("click", function(){
      if(b.disabled) return;
      set(o.v);
      volRegen();
      volFit(); if(volMode === "3d") scene3dFit(VOLS);
      drawVol(); if(volLvPaint) volLvPaint(); if(volGenPaint) volGenPaint();
    });
    btns.push({ b:b, v:o.v });
    g.appendChild(b);
  });
  g._paint = function(dis){
    btns.forEach(function(o){
      o.b.setAttribute("aria-current", String(!dis && get() === o.v));
      o.b.disabled = !!dis;
    });
  };
  return g;
}
function genControls(){
  var box = el("div","vol-gen");
  var sParti = segment(null, PARTIS.map(function(P){ return { n:P.n, v:P.id, d:P.d }; }),
    function(){ return MASS.parti; }, function(v){ massSet("parti", v); });
  var sNiv = segment("Niveaux", [1,2,3,4].map(function(n){
      return { n:String(n), v:n, d:n + " niveau" + (n > 1 ? "x" : "") + " hors sol" }; }),
    function(){ return MASS.niv; }, function(v){ massSet("niv", v); });
  var sNb = segment("Corps", [1,2,3,4].map(function(n){
      return { n:String(n), v:n, d:n + " corps de bâtiment scolaire" }; }),
    function(){ return MASS.nb; }, function(v){ massSet("nb", v); });

  var pr = el("div","circbar");
  pr.appendChild(el("span","segcap","Profondeur"));
  var pin = document.createElement("input");
  pin.type = "range"; pin.min = "12"; pin.max = "30"; pin.step = "1";
  pin.value = String(MASS.prof);
  pin.setAttribute("aria-label", "Profondeur du bâti scolaire, en mètres");
  var pout = el("b", null, "");
  pin.addEventListener("input", function(){
    massSet("prof", parseInt(pin.value, 10));
    volRegen(); volFit();
    if(volMode === "3d") scene3dFit(VOLS);
    drawVol(); if(volGenPaint) volGenPaint();
  });
  pr.appendChild(pin); pr.appendChild(pout);

  var desc = el("p","vol-gen__d");
  box.appendChild(sParti);
  var row = el("div","vol-grp__row");
  row.appendChild(sNiv); row.appendChild(sNb); row.appendChild(pr);
  box.appendChild(row);
  box.appendChild(desc);

  volGenPaint = function(){
    /* Le nombre de corps ne veut rien dire pour un parti qui n'en a qu'un, ou
       dont la figure fixe le nombre d'ailes : le réglage est éteint, pas caché. */
    var libre = MASS.parti === "barres" || MASS.parti === "pavillons";
    sParti._paint(volLink); sNiv._paint(volLink); sNb._paint(volLink || !libre);
    pin.disabled = volLink;
    pout.textContent = MASS.prof + " m"
      + (MASS.prof <= 16 ? "  ·  simple orientation" : MASS.prof >= 22 ? "  ·  cœur sans lumière" : "  ·  couloir central");
    desc.textContent = volLink
      ? "Les volumes viennent du plan interactif : le parti ne s\u2019applique pas."
      : partiOf(MASS.parti).d;
  };
  volGenPaint();
  return box;
}

/* ---- ce que la proposition respecte, et ce qu'elle ne respecte pas ----
   Une proposition hors règles est autorisée : elle est dite, pas empêchée. Le
   rouge nomme une règle écrite au règlement ou à l'AEAI, l'ambre une règle de
   projet ou une marge qui se discute. */
export function paintChecks(){
  if(!volChk) return;
  while(volChk.firstChild) volChk.removeChild(volChk.firstChild);
  var G = volLink ? { vols: VOLS, prog: volGen.prog } : volGen;
  var list = massCheck({ vols: VOLS, prog: G.prog }), V = massVerdict(list);
  var h = el("h2","vol-chk__head");
  h.appendChild(el("i", "chip chip--" + (V.sev === "e" ? "danger" : V.sev === "w" ? "warn" : "ok"),
    V.sev === "ok" ? "conforme" : V.e ? V.e + " écart" + (V.e > 1 ? "s" : "") : V.w + " réserve" + (V.w > 1 ? "s" : "")));
  h.appendChild(document.createTextNode("Règles et contraintes du concours"));
  volChk.appendChild(h);
  if(!list.length){
    volChk.appendChild(el("p", null, "Tout ce qui se vérifie sur une volumétrie est respecté : "
      + "périmètre et recul, distances entre bâtiments, cages et longueurs de fuite, hauteurs "
      + "libres imposées, couverture de la nappe, surfaces du programme."));
    return;
  }
  var ul = el("ul","vol-chk__list");
  list.slice().sort(function(a, b){ return (a.sev === "e" ? 0 : 1) - (b.sev === "e" ? 0 : 1); })
    .forEach(function(k){
      var li = el("li", k.sev === "e" ? "is-e" : "is-w");
      li.appendChild(el("b", null, k.msg));
      if(k.ref) li.appendChild(el("small", null, "art. " + k.ref));
      ul.appendChild(li);
    });
  volChk.appendChild(ul);
}

/* Panneau de l'onglet Volumes : construit une fois, puis réutilisé. */
function siteNote(title, build){
  var d = el("details","disclose");
  d.appendChild(el("summary", null, title));
  var p = el("p");
  build(p);
  d.appendChild(p);
  return d;
}
function siteNotes(){
  var box = el("div","site-notes");

  box.appendChild(siteNote("Ce que dit le site", function(p){
    p.textContent = "Le périmètre couvre les parcelles 5606 à 5614 et 4550. Le polygone du géomètre "
      + "mesure 176,8 × 122,9 m pour " + fmt(PERAIRE) + " m², soit 8,9 % de plus que les "
      + fmt(11740) + " m² annoncés au règlement — le tracé englobe les bords de route. Aucun bâtiment "
      + "existant à l\u2019intérieur. Le grand axe du terrain est à 6,3° de l\u2019est, ce qui oriente "
      + "naturellement les barres de classes vers le sud.";
  }));

  box.appendChild(siteNote("La nappe commande l\u2019abri PC", function(p){
    /* L'impératif de démonstration « Déplace le volume gris d'est en ouest et
       regarde le verdict basculer » est retiré : au milieu de données de
       géomètre, c'est exactement le registre que la refonte cherche à sortir.
       Le verdict est déjà dit par la métrique « Marge sur la nappe ». */
    p.textContent = "Le terrain monte de 463,3 m au sud-ouest à 466,7 m à l\u2019est, tandis que la "
      + "nappe est à 462,25 m au plus haut, en zone de protection des eaux Au - Karst. La hauteur "
      + "disponible passe de 1,0 m à l\u2019ouest à 4,5 m à l\u2019est. Un abri enterré demande "
      + "3,00 m : il n\u2019y a que le tiers est du site où c\u2019est possible.";
  }));

  box.appendChild(siteNote("Réserves sur le relevé", function(p){
    p.textContent = "Le plan du terrain est une régression sur 99 points de courbe de niveau du "
      + "périmètre, erreur moyenne 0,22 m — suffisant pour arbitrer, pas pour dimensionner. Les noms "
      + "de rue ne figurent pas dans le fichier, les accès restent donc à placer à la main. La "
      + "pollution des sols de la parcelle 4550 était encore à l\u2019étude au moment du règlement.";
  }));

  box.appendChild(siteNote("Gestes et raccourcis", function(p){
    p.innerHTML = "<b>Plan</b> — glisser un volume pour le déplacer · poignées pour le "
      + "redimensionner à surface constante · molette pour zoomer · <kbd>R</kbd> pour pivoter · "
      + "<kbd>Échap</kbd> pour désélectionner.<br><b>3D</b> — glisser pour tourner autour du "
      + "projet · <kbd>Maj</kbd> + glisser pour déplacer la vue · molette pour s\u2019approcher · "
      + "cliquer un volume pour le désigner · flèches pour tourner au clavier. "
      + "« Niveaux » agit sur le volume sélectionné dans les deux vues.";
  }));
  return box;
}

export function volPanel(){
  if(volNode) return volNode;
  volNode = el("section","panel plan-full");
  var vh = el("div","tool-head");
  vh.appendChild(el("h1", null, "Site"));
  vh.appendChild(el("span","pct mono", "périmètre du concours, " + fmt(PERAIRE) + " m²"));
  volNode.appendChild(vh);
  var psub = el("p","tool-sub");
  /* Le chapeau faisait 118 mots et expliquait trois commandes avant qu'on les
     ait vues : ces explications sont devenues leurs propres `title`. */
  psub.textContent = "Une proposition de volumétrie déduite du programme et des règles, posée dans "
    + "le périmètre réel du concours, en plan et en 3D. Les surfaces du programme sont fixes ; le "
    + "parti, les niveaux et la profondeur se règlent. Une proposition hors règles reste possible : "
    + "elle est signalée, pas empêchée.";
  volNode.appendChild(psub);
  var vw = el("div","vol-wrap");
  volHost = vw;
  var vk = el("div","vol-key");
  [["Périmètre du concours","var(--site-perimetre)",2.6,null],
   ["Bâti existant","var(--ink-4)",3,null],
   ["Projet mis à l'enquête","var(--f-adm)",2,"4 3"],
   ["Courbes de niveau et parcelles","var(--rule)",1.5,null]].forEach(function(k){
    var sp = el("span"), i2 = el("i");
    i2.style.background = k[1]; i2.style.height = k[2] + "px";
    if(k[3]){ i2.style.background = "none"; i2.style.borderTop = "2px dashed " + k[1]; }
    sp.appendChild(i2); sp.appendChild(document.createTextNode(k[0])); vk.appendChild(sp);
  });
  var vt = el("div","plan-tools");
  var bHome = el("button","tbtn shuffle","Implantation calculée"); bHome.type = "button";
  bHome.title = "Repose les volumes dans le périmètre à partir du parti et des réglages";
  bHome.addEventListener("click", function(){
    if(volLink){ volSync(true); volFit(); drawVol(); return; }
    volRegen();
    volFit(); if(volMode === "3d") scene3dFit(VOLS);
    drawVol(); if(volLvPaint) volLvPaint(); if(volGenPaint) volGenPaint();
  });
  volLinkBtn = el("button","tbtn lock","Depuis le plan interactif");
  volLinkBtn.type = "button";
  volLinkBtn.setAttribute("aria-pressed", String(volLink));
  volLinkBtn.addEventListener("click", function(){
    volSetLink(!volLink);
    drawVol();
    /* Changer de source remplace les volumes : sans ce repeint, les boutons
       « Niveaux » gardaient un état actif et cliquaient dans le vide. */
    if(volLvPaint) volLvPaint();
  });
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
    if(volLvPaint) volLvPaint();
  });
  cb.appendChild(volCircIn);
  cb.appendChild(volCircOut);
  var ms = el("div","zoomseg");
  var mPlan = el("button", null, "Plan"); mPlan.type = "button";
  var mAxo  = el("button", null, "3D"); mAxo.type = "button";
  mAxo.title = "Vue en perspective : glisser pour tourner, molette pour s\u2019approcher";
  ms.appendChild(mPlan); ms.appendChild(mAxo);
  /* Aucun des deux ne portait d'état : on ne savait jamais dans quelle vue on
     était. Même remarque pour « Niveaux 1-4 » plus bas. */
  function paintMode(){
    mPlan.setAttribute("aria-current", String(volMode === "plan"));
    mAxo.setAttribute("aria-current", String(volMode === "3d"));
  }
  mPlan.addEventListener("click", function(){ volMode = "plan"; volFit(); drawVol(); paintMode(); });
  mAxo.addEventListener("click", function(){
    volMode = "3d"; scene3dFit(VOLS); drawVol(); paintMode();
  });
  paintMode();
  var ns = el("div","zoomseg");
  ns.appendChild(el("span","segcap","Niveaux"));
  var lvBtns = [];
  volLvPaint = function(){
    var v = (volSel >= 0 && VOLS[volSel]) ? VOLS[volSel] : null;
    var actif = v && !v.fix && !v.sol && !v.link;
    lvBtns.forEach(function(o){
      o.b.setAttribute("aria-current", String(!!actif && v.lv === o.nv));
      o.b.disabled = !actif;
    });
    if(volLvWhy){
      volLvWhy.textContent = actif ? ""
        : (volSel < 0 ? "sélectionne un volume"
          : v && v.link ? "volume repris du plan interactif"
          : v && v.sol ? "la cour n\u2019a pas de niveaux"
          : "surface imposée par le programme");
    }
  };
  [1,2,3,4].forEach(function(nv){
    var bb2 = el("button", null, String(nv)); bb2.type = "button";
    bb2.title = nv + " niveau" + (nv > 1 ? "x" : "");
    lvBtns.push({ b:bb2, nv:nv });
    bb2.addEventListener("click", function(){
      if(volSel < 0 || VOLS[volSel].fix || VOLS[volSel].sol || VOLS[volSel].link) return;
      VOLS[volSel].lv = nv;
      VOLS[volSel].sub = nv > 1 ? "R+" + (nv - 1) + " · " + fmt(VOLS[volSel].w * VOLS[volSel].h * nv) + " m²"
                                : fmt(VOLS[volSel].w * VOLS[volSel].h) + " m²";
      drawVol();
      volLvPaint();
    });
    ns.appendChild(bb2);
  });
  volLvWhy = el("span","vol-why");
  ns.appendChild(volLvWhy);
  var be = el("button","tbtn","Abri enterré"); be.type = "button";
  be.setAttribute("aria-pressed","false");
  be.setAttribute("aria-pressed", String(MASS.enterre));
  be.addEventListener("click", function(){
    /* L'abri PC descend ou reste au rez : c'est un réglage du parti, pas un
       effet de vue. Il était purement graphique et ne touchait que
       l'axonométrie — le contrôle de la nappe ne le voyait pas. */
    massSet("enterre", !MASS.enterre);
    be.setAttribute("aria-pressed", String(MASS.enterre));
    if(!volLink) volRegen();
    drawVol(); if(volLvPaint) volLvPaint();
  });
  var zs = el("div","zoomseg");
  var zM = el("button", null, "−"); zM.type = "button";
  var zF = el("button", null, "Ajuster"); zF.type = "button";
  var zP = el("button", null, "+"); zP.type = "button";
  zs.appendChild(zM); zs.appendChild(zF); zs.appendChild(zP);
  /* Ces trois boutons appelaient drawVolumes(), qui dessine le PLAN : zoomer
     depuis l'axonométrie y faisait retomber silencieusement. drawVol() respecte
     le mode courant. */
  zM.addEventListener("click", function(){
    if(volMode === "3d") scene3dZoom(1.3); else VZ = Math.max(0.6, VZ / 1.4);
    drawVol();
  });
  zP.addEventListener("click", function(){
    if(volMode === "3d") scene3dZoom(1 / 1.3); else VZ = Math.min(9, VZ * 1.4);
    drawVol();
  });
  zF.addEventListener("click", function(){
    if(volMode === "3d") scene3dFit(VOLS); else volFit();
    drawVol();
  });
  /* Cette phrase de 128 signes était posée dans un composant en
     `white-space:nowrap` : ~780 px insécables qui débordaient du cadre à 390 px
     et ajoutaient un défilement horizontal à toute la page. Elle rejoint l'aide. */
  /* Treize commandes étaient alignées à plat, dans un ordre qui ne disait rien,
     et POSÉES SOUS la carte : on réglait la circulation à l'aveugle sous sept
     cents pixels de plan. Trois groupes nommés, au-dessus de ce qu'ils pilotent. */
  function grp(caption){
    var g = el("div","vol-grp");
    g.appendChild(el("span","label", caption));
    var row = el("div","vol-grp__row");
    g.appendChild(row);
    vt.appendChild(g);
    return row;
  }
  var gGen = grp("Le parti proposé");
  gGen.appendChild(genControls());
  var gSrc = grp("D\u2019où vient le volume");
  gSrc.appendChild(volLinkBtn); gSrc.appendChild(cb); gSrc.appendChild(bHome);
  var gVue = grp("Ce qu\u2019on voit");
  gVue.appendChild(ms); gVue.appendChild(zs); gVue.appendChild(be);
  var gSel = grp("Volume sélectionné");
  gSel.appendChild(ns);

  volNode.appendChild(vt);
  volNode.appendChild(vw);
  volCam = el("p","vol-cam");
  volNode.appendChild(volCam);
  volLvPaint();
  volMet = el("dl","arch-metrics");
  volNode.appendChild(vk);
  volChk = el("section","vol-chk");
  volNode.appendChild(volChk);
  volNode.appendChild(volMet);
  /* Trois paragraphes de ~1'150 signes en 12 px et en gris atténué. Le contenu
     est du relevé de géomètre : il compte. Il devient consultable. */
  volNode.appendChild(siteNotes());
  return volNode;
}

export function drawVol(){
  if(volMode === "3d") draw3d(); else drawVolumes();
  volCircLabel();
  paintChecks();
  if(volCam) volCam.textContent = volMode === "3d" ? camLabel()
    : "plan de situation · nord en haut · le terrain monte de 1,94 % vers l\u2019est";
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
  lay("foo", "var(--site-emprise)", 1);
  lay("rou", "var(--ink-3)", 1.6);
  var gb = s("g", { fill: "var(--ink-3)", "fill-opacity": ".45", stroke: "var(--ink-2)",
    "stroke-width": 1, "vector-effect": "non-scaling-stroke" });
  (SITE.bat || []).forEach(function(P){ gb.appendChild(s("path", { d: vpath(P, 1) })); });
  root.appendChild(gb);
  var ge = s("g", { fill: "none", stroke: "var(--f-adm)", "stroke-width": 1.6,
    "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" });
  (SITE.enq || []).forEach(function(P){ ge.appendChild(s("path", { d: vpath(P, 1) })); });
  root.appendChild(ge);
  root.appendChild(s("path", { d: vpath(PER, 1), fill: "var(--site-perimetre)", "fill-opacity": ".05",
    stroke: "var(--site-perimetre)", "stroke-width": 2.6, "vector-effect": "non-scaling-stroke" }));

  var ppm = VS0 * VZ, detail = ppm >= (volLink ? 2 : 6), cap = volLink ? null : volCapacity();
  var shown = volLink ? volShown() : -1;
  var ca = Math.cos(VANG), sa = Math.sin(VANG);
  VOLS.forEach(function(v, k){
    var col = "var(" + FMAP[v.f].c + ")";
    var bad = v.link && !volFits(v, v.x, v.y);
    var g = s("g", { "class": "vol" + (k === volSel ? " sel" : ""), "data-k": k, tabindex: "0" });
    g.appendChild(s("path", { d: vpath(vcorners(v), 1), fill: col,
      "fill-opacity": detail ? ".10" : ".26", stroke: bad ? "var(--danger)" : col,
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
      } else if(v.key === "sport"){       /* salle de sport : aire de jeu et refend */
        var pad = 2;
        g.appendChild(s("path", { d: vpath([T(pad,pad),T(v.w-pad,pad),T(v.w-pad,v.h-pad),T(pad,v.h-pad)], 1),
          fill: "none", stroke: col, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" }));
        g.appendChild(s("path", { d: vpath([T(v.w/2,0),T(v.w/2,v.h)]), fill: "none", stroke: col,
          "stroke-width": 1.4, "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" }));
      } else if(v.key === "abri" && !volLink){   /* abri PC : trame de secteurs */
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
    if(!v.link && (!detail || v.key === "sport" || v.key === "abri")){
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
    if(k === volSel && !v.fix && !v.sol && !v.link){
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
  /* Le verdict conforme/non conforme ne reposait que sur la couleur du texte,
     dans un rouge qui échouait AA dans les deux thèmes. Il porte désormais un
     mot, et les sept métriques cessent d'être strictement au même poids : celles
     qui disent si le projet tient passent au premier rang. */
  function met(t, v, sub, cls, lead){
    var d = el("div", (cls || "") + (lead ? " metric--lead" : ""));
    d.appendChild(el("dt", null, t));
    var dd = el("dd", null);
    if(cls){
      dd.appendChild(el("i", "chip chip--" + (cls === "ok" ? "ok" : "danger"),
        cls === "ok" ? "conforme" : "insuffisant"));
    }
    dd.appendChild(el("span","metric__val", v));
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
        + " % des " + fmt(PERAIRE) + " m² du périmètre");
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
        hors ? "ko" : "ok", true);
    met("Terrain libre", fmt(Math.round(PERAIRE - emp0)) + " m²",
        "cour, 70 places de parc, 50 vélos, dépose des bus et 900 m² du 2ᵉ temps",
        (PERAIRE - emp0) > 3250 ? "ok" : "ko", true);
    var sous = VOLS.filter(function(v){ return v.lvl < 0; });
    if(sous.length){
      var Cs = vcorners(sous[0]);
      var sx = (Cs[0][0]+Cs[2][0])/2, sy = (Cs[0][1]+Cs[2][1])/2;
      var zs = terrain(sx, sy), mg = zs - NAPPE;
      met("Marge sur la nappe", dec(mg) + " m",
          "sous le " + sous[0].n.toLowerCase() + ", terrain à " + dec(zs) + " m. "
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
      Math.round(emp / PERAIRE * 100) + " % des " + fmt(PERAIRE) + " m² du périmètre");
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
  var abri = VOLS.filter(function(v){ return v.key === "abri"; })[0];
  if(abri && abri.nz < 0){
    var am = vmid(abri), zt = terrain(am[0], am[1]), marge = zt - NAPPE;
    met("Marge sur la nappe", dec(marge) + " m",
        "sous l'abri PC, terrain à " + dec(zt) + " m. " + (marge >= SOUSSOL
          ? "Excavation possible : " + dec(SOUSSOL) + " m suffisent pour "
            + dec(RULES.haut.libre.abri) + " m libres."
          : "Excavation exclue — il faut " + dec(SOUSSOL) + " m. Pousse l'abri vers l'est."),
        marge >= SOUSSOL ? "ok" : "ko");
  }
}


/* ================= VUE 3D =================
   L'axonométrie militaire projetait un plan vrai tourné de 32°, sans point de
   vue, sans occlusion et sans possibilité d'en changer : on ne pouvait pas
   tourner autour du projet. Elle est remplacée par une vraie caméra en
   perspective (`vol/scene3d.js`), qu'on oriente à la souris. Le mode « Plan »
   reste ce qu'il était : c'est lui qui sert à implanter. */
export var volMode = "plan";
export function setVolMode(m){ volMode = m; }

export function draw3d(){
  if(!scene3dMount(volHost)) return;
  scene3dDraw(VOLS, { sel: volSel });
  volMetrics(volLink ? null : volCapacity());
}

export function wireVol(){
  var drag = null;
  function pt(e){
    var r = volHost.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  volHost.addEventListener("pointerdown", function(e){
    if(volMode === "3d"){
      if(e.button !== 0) return;
      var P0 = pt(e);
      drag = { mode: e.shiftKey ? "pan3" : "turn", p0: P0, moved: 0 };
      volHost.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if(e.button !== 0) return;
    var hd = e.target.closest ? e.target.closest(".vh") : null;
    var g = e.target.closest ? e.target.closest("g.vol") : null;
    var P = pt(e), Wm = vinv(P[0], P[1]);
    if(hd && g){
      var k = +g.dataset.k;
      drag = { mode: "size", k: k, dir: hd.dataset.dir, m0: Wm,
               v0: { x:VOLS[k].x, y:VOLS[k].y, w:VOLS[k].w, h:VOLS[k].h } };
      volSel = k; if(volLvPaint) volLvPaint();
    } else if(g){
      var k2 = +g.dataset.k;
      drag = { mode: "move", k: k2, m0: Wm, v0: { x:VOLS[k2].x, y:VOLS[k2].y } };
      volSel = k2; if(volLvPaint) volLvPaint();
    } else {
      drag = { mode: "pan", p0: P, tx: VTX, ty: VTY };
      volSel = -1; if(volLvPaint) volLvPaint();
    }
    volHost.setPointerCapture(e.pointerId);
    drawVol();
    e.preventDefault();
  });
  volHost.addEventListener("pointermove", function(e){
    if(!drag) return;
    var P = pt(e);
    if(drag.mode === "turn" || drag.mode === "pan3"){
      var ddx = P[0] - drag.p0[0], ddy = P[1] - drag.p0[1];
      drag.moved += Math.abs(ddx) + Math.abs(ddy);
      if(drag.mode === "turn") scene3dTurn(-ddx * 0.008, ddy * 0.006);
      else scene3dPan(ddx * 1.6, -ddy * 1.6);
      drag.p0 = P;
      drawVol();
      return;
    }
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
    if(VOLS[drag.k].fix || VOLS[drag.k].link) return;   /* surface imposée ou calculée */
    var d = drag.dir, nw = V0.w, nh = V0.h, ou = 0, ov = 0;
    if(d.indexOf("e") >= 0) nw = V0.w + du;
    if(d.indexOf("w") >= 0){ nw = V0.w - du; ou = du; }
    if(d.indexOf("n") >= 0) nh = V0.h + dv;
    if(d.indexOf("s") >= 0){ nh = V0.h - dv; ov = dv; }
    nw = Math.max(12, Math.min(90, Math.round(nw * 2) / 2));
    nh = Math.max(10, Math.min(40, Math.round(nh * 2) / 2));
    /* Un volume qui porte une surface de programme garde sa surface : on change
       ses proportions, jamais ses m². C'est la règle du concours, et elle vaut
       pour tous les volumes issus du générateur, pas pour le seul abri. */
    if(VOLS[drag.k].prog > 0 && !VOLS[drag.k].sol){
      var dd = nearestDims(VOLS[drag.k].prog / Math.max(1, VOLS[drag.k].lv), nw);
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
    /* Un clic net en 3D désigne un volume ; un glissé a tourné la caméra. */
    if((drag.mode === "turn" || drag.mode === "pan3") && drag.moved < 6){
      var P = pt(e), k = scene3dPick(P[0], P[1], VOLS);
      volSel = k; setSceneSel(k);
      if(volLvPaint) volLvPaint();
      drawVol();
    }
    drag = null;
    try { volHost.releasePointerCapture(e.pointerId); } catch(_){}
  }
  volHost.addEventListener("pointerup", stop);
  volHost.addEventListener("pointercancel", stop);
  volHost.addEventListener("wheel", function(e){
    e.preventDefault();
    if(volMode === "3d"){
      scene3dZoom(e.deltaY < 0 ? 1 / 1.12 : 1.12);
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
    if(view.tab !== "site") return;
    var t = e.target;
    if(t && (t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if(e.key === "Escape"){ volSel = -1; setSceneSel(-1); if(volLvPaint) volLvPaint(); drawVol(); return; }
    if(volMode === "3d"){
      var q = e.key === "ArrowLeft" ? [0.14, 0] : e.key === "ArrowRight" ? [-0.14, 0]
            : e.key === "ArrowUp" ? [0, 0.1] : e.key === "ArrowDown" ? [0, -0.1] : null;
      if(q){ e.preventDefault(); scene3dTurn(q[0], q[1]); drawVol(); }
      else if(e.key === "+" || e.key === "=" ){ scene3dZoom(1 / 1.15); drawVol(); }
      else if(e.key === "-"){ scene3dZoom(1.15); drawVol(); }
      return;
    }
    if(volSel < 0) return;
    var v = VOLS[volSel], st = e.shiftKey ? 5 : 0.5, nx = v.x, ny = v.y;
    if(e.key === "ArrowLeft") nx -= st;
    else if(e.key === "ArrowRight") nx += st;
    else if(e.key === "ArrowUp") ny += st;
    else if(e.key === "ArrowDown") ny -= st;
    else if(e.key.toLowerCase() === "r" && !VOLS[volSel].sol && !VOLS[volSel].link){
      var w = v.w; v.w = v.h; v.h = w;
      if(!volOK(volSel, v.x, v.y)){ v.h = v.w; v.w = w; }
      e.preventDefault(); drawVol(); return;
    } else return;
    e.preventDefault();
    nx = Math.round(nx * 2) / 2; ny = Math.round(ny * 2) / 2;
    if(volOK(volSel, nx, ny)){ v.x = nx; v.y = ny; drawVol(); }
  });
}

