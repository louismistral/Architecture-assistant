/* ============================================================================
   LA VUE 3D DU MASSING

   Le même modèle que le plan, vu autrement. Rien n'y est saisi : on tourne, on
   zoome, on recule — et l'on voit ce que le programme pèse sur ce terrain.

   Le TERRAIN est celui du relevé, pas une dalle : la grille d'altitudes de
   `SITE.grid` fait un maillage, et cette grille PASSE PAR LES COURBES DE
   NIVEAU — trois centimètres d'écart en moyenne sur le périmètre du concours.
   Les courbes s'y drapent donc sans flotter ni s'enfoncer, et les volumes s'y
   posent à la moyenne du terrain sous leur emprise : un bâtiment ne flotte ni
   ne s'enterre.

   Le maillage du site ne change jamais : il part une fois dans SON PROPRE
   tampon graphique. Il était auparavant dessiné une maille sur deux et renvoyé
   à la carte à chaque image — quatre mégaoctets par tour de caméra pour un
   modèle identique, et un relief lissé à huit mètres qui ne suivait plus rien.
   Seuls les volumes se refont à chaque image : c'est le seul endroit où le
   modèle bouge.

   Toutes les couleurs viennent des tokens CSS par `cssRGB()` : WebGL ne sait
   pas lire `var(--f-cla)`, et il n'y a pas deux palettes dans ce projet.
   ========================================================================= */
import { el } from "../core/format.js";
import { STRIDE, cssRGB, glDraw, glDrawStatic, glInit, glLibere, glStatic, m4project,
  orbitEye, orbitMVP } from "../core/gl.js";
import { PER, SITE } from "../data/site.js";
import { lvlOf } from "../mix/floors.js";
import { assise, coins, grille, terrain } from "../mass/geom.js";
import { MASS, cellules, debord, famTok, filtreDe, hauteurEtage, niveaux,
  volRect } from "../mass/model.js";

var ZBAS = 460;                 /* origine des hauteurs : le pied du site */
var G = null, cv = null, host = null, DPR = 1;
export var CAM = { az:-0.7, el:0.46, dist:330, tx:88, ty:61, tz:6, fov:0.62 };
var CAM0 = { az:-0.7, el:0.46, dist:330, tx:88, ty:61, tz:6, fov:0.62 };
var STATIQUE = null, STAKEY = "", TAMPON = null;
var drag3 = null, wired3 = false, onChange3 = null;

export function vue3dOnChange(fn){ onChange3 = fn; }
export function vue3dOK(){ return !!G; }
export function camReset(){ var k; for(k in CAM0) CAM[k] = CAM0[k]; }
export function camLabel(){
  var d = ((CAM.az * 180 / Math.PI) % 360 + 360) % 360;
  var q = d < 45 || d >= 315 ? "du sud" : d < 135 ? "de l’ouest"
        : d < 225 ? "du nord" : "de l’est";
  return "vue " + q + " · " + Math.round(CAM.el * 180 / Math.PI) + "° au-dessus de "
       + "l’horizon · " + Math.round(CAM.dist) + " m de recul";
}

/* La couleur d'un aplat en 3D. Les diagrammes posent les familles à
   `--fill-op` sur le papier ; en WebGL il n'y a pas d'opacité de remplissage
   qui tienne — le mélange se fait donc ici, à la main, pour que le volume ait
   exactement la couleur du plan et du programme. */
function teinte(token, op){
  var c = cssRGB(token), p = cssRGB("--panel"), k = op == null ? .62 : op;
  return [c[0] * k + p[0] * (1 - k), c[1] * k + p[1] * (1 - k), c[2] * k + p[2] * (1 - k)];
}

/* ---------- accumulation ---------------------------------------------------- */
function Mesh(){ return { t:[], l:[] }; }
function push(a, p, n, c, al){
  a.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], al == null ? 1 : al);
}
function norm(A, B, C){
  var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
  var vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  var l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
function tri(M, A, B, C, c, a){
  var n = norm(A, B, C);
  push(M.t, A, n, c, a); push(M.t, B, n, c, a); push(M.t, C, n, c, a);
}
function quad(M, A, B, C, D, c, a){ tri(M, A, B, C, c, a); tri(M, A, C, D, c, a); }
/* Une ligne porte une normale NULLE : le nuanceur lit la longueur de la normale
   pour savoir s'il éclaire — c'est toute l'API d'éclairage de `gl.js`. */
function ligne(M, P, zf, c, close){
  var n = [0, 0, 0], i;
  for(i = 0; i < P.length - 1; i++){
    push(M.l, [P[i][0], P[i][1], zf(P[i])], n, c, 1);
    push(M.l, [P[i + 1][0], P[i + 1][1], zf(P[i + 1])], n, c, 1);
  }
  if(close && P.length > 2){
    push(M.l, [P[P.length - 1][0], P[P.length - 1][1], zf(P[P.length - 1])], n, c, 1);
    push(M.l, [P[0][0], P[0][1], zf(P[0])], n, c, 1);
  }
}
/* Une boîte : quatre murs, un toit, et ses arêtes. Le massing est une affaire
   d'arêtes autant que de faces — sans elles, deux volumes accolés n'en font
   qu'un à l'œil. */
function boite(M, q, z0, z1, c, a, edge){
  var i, A, B;
  for(i = 0; i < 4; i++){
    A = q[i]; B = q[(i + 1) % 4];
    quad(M, [A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1], c, a);
  }
  quad(M, [q[0][0], q[0][1], z1], [q[1][0], q[1][1], z1],
          [q[2][0], q[2][1], z1], [q[3][0], q[3][1], z1], c, a);
  if(edge){
    var n = [0, 0, 0];
    for(i = 0; i < 4; i++){
      A = q[i]; B = q[(i + 1) % 4];
      push(M.l, [A[0], A[1], z1], n, edge, 1); push(M.l, [B[0], B[1], z1], n, edge, 1);
      push(M.l, [A[0], A[1], z0], n, edge, 1); push(M.l, [B[0], B[1], z0], n, edge, 1);
      push(M.l, [A[0], A[1], z0], n, edge, 1); push(M.l, [A[0], A[1], z1], n, edge, 1);
    }
  }
}
/* Les seules ARÊTES d'une boîte, sans ses faces. Dessiner la boîte
   d'enveloppe en alpha nul par-dessus les cellules du programme laissait ses
   triangles ÉCRIRE LA PROFONDEUR : ils se disputaient le pixel avec les
   cellules qu'ils recouvrent exactement, et les façades se criblaient de noir. */
function aretes(M, q, z0, z1, c){
  var n = [0, 0, 0], i, A, B;
  for(i = 0; i < 4; i++){
    A = q[i]; B = q[(i + 1) % 4];
    push(M.l, [A[0], A[1], z1], n, c, 1); push(M.l, [B[0], B[1], z1], n, c, 1);
    push(M.l, [A[0], A[1], z0], n, c, 1); push(M.l, [B[0], B[1], z0], n, c, 1);
    push(M.l, [A[0], A[1], z0], n, c, 1); push(M.l, [A[0], A[1], z1], n, c, 1);
  }
}
function zT(p){ return terrain(p[0], p[1]) - ZBAS; }
/* L'altitude d'un nœud de la grille, sans repasser par l'interpolation : le
   maillage EST la grille, il ne l'échantillonne pas. */
function zg(g, i, j){ return g.zsol + grille(g, i, j) / 100 - ZBAS; }

/* ---------- le site, calculé une fois --------------------------------------
   Le terrain, les courbes, les routes et l'existant ne bougent jamais. Les
   recalculer à chaque image d'un glisser de caméra coûtait quatre mille
   triangles pour rien. */
function siteMesh(){
  var key = (document.documentElement.getAttribute("data-theme") || "auto")
          + "|" + (window.matchMedia
            && window.matchMedia("(prefers-color-scheme: dark)").matches ? "d" : "l");
  if(STATIQUE && STAKEY === key) return STATIQUE;
  var M = Mesh();
  var cSol = cssRGB("--rule-soft"), cCtr = cssRGB("--ink-4");
  var cCtrF = teinte("--ink-4", .45);     /* la demi-courbe, en trait faible */
  var cPer = cssRGB("--site-perimetre"), cRou = cssRGB("--ink-4");
  /* L'existant est un CONTEXTE : il doit se lire sans jamais se disputer le
     regard avec le projet. Au token brut il virait au noir sous l'éclairage. */
  var cBat = teinte("--ink-4", .34), cEnq = cssRGB("--warn");
  /* Le maillage prend TOUTES les mailles du relevé. Une sur deux lissait le
     terrain à huit mètres : les courbes de niveau, relevées tous les
     cinquante centimètres, passaient au travers. */
  var g = SITE.grid, i, j;
  for(i = 0; i + 1 < g.nx; i++){
    for(j = 0; j + 1 < g.ny; j++){
      var x0 = g.x0 + i * g.pas, x1 = g.x0 + (i + 1) * g.pas;
      var y0 = g.y0 + j * g.pas, y1 = g.y0 + (j + 1) * g.pas;
      quad(M, [x0, y0, zg(g, i, j)], [x1, y0, zg(g, i + 1, j)],
              [x1, y1, zg(g, i + 1, j + 1)], [x0, y1, zg(g, i, j + 1)],
              cSol, 1);
    }
  }
  /* Les courbes de niveau, drapées à leur altitude exacte : c'est elles qui
     donnent le relief à lire, bien plus que l'ombrage. Le relevé les donne
     tous les 50 cm ; celles des mètres pleins portent le trait fort, comme sur
     un plan topographique. */
  (SITE.ctr || []).forEach(function(c){
    var pleine = Math.abs(c[0] % 1) < .01;
    ligne(M, c[1], function(){ return c[0] - ZBAS + .04; },
          pleine ? cCtr : cCtrF, false);
  });
  (SITE.rou || []).forEach(function(P){
    ligne(M, P, function(p){ return zT(p) + .12; }, cRou, false);
  });
  (SITE.par || []).forEach(function(P){
    ligne(M, P, function(p){ return zT(p) + .08; }, cCtr, true);
  });
  ligne(M, PER, function(p){ return zT(p) + .2; }, cPer, true);
  /* L'existant, avec sa vraie hauteur : le relevé donne le pied et le faîte de
     chaque solide, et c'est ce qui dit à quoi le projet se mesure. */
  (SITE.bat || []).forEach(function(P, k){
    var h = SITE.bath && SITE.bath[k];
    var as = 0, n = 0;
    P.forEach(function(p){ as += terrain(p[0], p[1]); n++; });
    as = n ? as / n : 465;
    var z0 = as - ZBAS - .4;
    var z1 = h ? Math.max(z0 + 3, h[1] - ZBAS) : z0 + 7;
    var q = P.slice(0, 4);
    if(P.length >= 4) boiteLibre(M, P, z0, z1, cBat, 1, cCtr);
  });
  (SITE.enq || []).forEach(function(P){
    ligne(M, P, function(p){ return zT(p) + .3; }, cEnq, true);
  });
  STATIQUE = M; STAKEY = key;
  if(TAMPON){ glLibere(G, TAMPON.t); glLibere(G, TAMPON.l); }
  TAMPON = { t: glStatic(G, new Float32Array(M.t)),
             l: glStatic(G, new Float32Array(M.l)) };
  return M;
}
/* Un bâtiment existant n'est pas un rectangle : on extrude son emprise telle
   qu'elle est relevée, par éventail depuis son centre. */
function boiteLibre(M, P, z0, z1, c, a, edge){
  var cx = 0, cy = 0, i;
  P.forEach(function(p){ cx += p[0]; cy += p[1]; });
  cx /= P.length; cy /= P.length;
  for(i = 0; i < P.length; i++){
    var A = P[i], B = P[(i + 1) % P.length];
    quad(M, [A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1], c, a);
    tri(M, [cx, cy, z1], [A[0], A[1], z1], [B[0], B[1], z1], c, a);
  }
  if(edge) ligne(M, P, function(){ return z1; }, edge, true);
}

/* ---------- les volumes, refaits à chaque image ----------------------------- */
function volMesh(){
  var M = Mesh(), N = niveaux();
  var cEdge = cssRGB("--ink"), cSel = cssRGB("--focus"), cPF = cssRGB("--warn");
  /* Le monochrome est BLANC, et blanc pur : c'est la maquette de concours, où
     la masse se lit à l'ombre et à l'arête, jamais à la teinte. Un vert délavé
     restait une couleur, et l'on cherchait ce qu'il voulait dire. L'existant
     reste gris : c'est le contexte, il ne doit pas se disputer le regard avec
     le projet. */
  var cMono = cssRGB("--site-mono"), cEnt = teinte("--ink-4", .5);
  MASS.vol.forEach(function(v, k){
    var as = assise(rectBas(v)).z - ZBAS;
    var sel = MASS.sel === v.id;
    var lv = v.lv.slice().sort(function(a, b){ return a.i - b.i; });
    var z = as, bas = null;
    /* Les sous-sols descendent sous l'assise, les étages montent depuis elle. */
    var sous = 0;
    lv.forEach(function(e){ if(lvlOf(e.i) < 0 && N[e.i]) sous += N[e.i].h; });
    z = as - sous;
    lv.forEach(function(e){
      var n = N[e.i];
      if(!n) return;
      /* Un ouvrage du second temps porte SA hauteur : une piscine indépendante
         ne prend pas les 7,45 m que la salle de sport impose au rez de l'école. */
      var h = hauteurEtage(e, n);
      var vis = MASS.etage < 0 || MASS.etage === e.i;
      var z0 = z; z += h;
      /* Le PORTE-À-FAUX est autorisé, et la 3D le dessine tel quel — mais elle
         le dit : l'étage qui déborde de celui du dessous prend l'arête
         d'avertissement. Un dépassement qu'on ne voit que dans une liste n'est
         pas un dépassement qu'on corrige. */
      var pf = n.lvl >= 0 && bas ? debord(bas, e) : 0;
      if(n.lvl >= 0) bas = e;
      if(!vis) return;
      var rc = volRect(v, e), q = coins(rc);
      var edge = sel ? cSel : (pf > .3 ? cPF : cEdge);
      /* Un ouvrage du SECOND TEMPS se lit PÂLE : il occupe le terrain, mais il
         ne sera pas bâti avec l'école. Le plan le dit en pointillé, comme le
         veut le plan de situation ; la 3D n'a pas de pointillé, elle a la
         teinte. On ne le rend pas translucide : une face transparente écrit
         quand même sa profondeur, et l'on retrouverait le moucheté noir que la
         boîte-enveloppe donnait déjà. */
      var op = v.ph ? .40 : undefined;
      if(MASS.mono || n.lvl < 0){
        boite(M, q, z0, z0 + h - .12,
          n.lvl < 0 ? cEnt : (v.ph ? teinte("--site-mono", .40) : cMono), 1, edge);
      } else {
        cellules(e.i, rc.w, rc.d, filtreDe(v, e)).forEach(function(c){
          var cx = c.x + c.w / 2, cy = c.y + c.d / 2;
          var sub = { x: rc.x + cx * Math.cos(rc.a) - cy * Math.sin(rc.a),
                      y: rc.y + cx * Math.sin(rc.a) + cy * Math.cos(rc.a),
                      w: c.w, d: c.d, a: rc.a };
          boite(M, coins(sub), z0, z0 + h - .12, teinte(famTok(c.f), op), 1, null);
        });
        aretes(M, q, z0, z0 + h - .12, edge);
      }
    });
  });
  return M;
}
function rectBas(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i < e.i) e = x;
  });
  if(!e) e = v.lv[0];
  return volRect(v, e);
}

/* ---------- montage et dessin ------------------------------------------------ */
export function vue3dMount(hostEl){
  host = hostEl;
  while(host.firstChild) host.removeChild(host.firstChild);
  cv = document.createElement("canvas");
  cv.className = "vue3d__c";
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", "Vue 3D du massing sur le terrain relevé. "
    + "Le plan à gauche donne le même modèle, et s'y modifie.");
  host.appendChild(cv);
  G = glInit(cv);
  if(!G){
    host.removeChild(cv);
    cv = null;
    host.appendChild(el("p", "vue3d__fail",
      "Cette machine ne donne pas de contexte WebGL : le plan reste utilisable, "
      + "et il porte le même modèle."));
    return false;
  }
  var gl = G.gl;
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if(!wired3) wire3d();
  wired3 = true;
  vue3dDraw();
  return true;
}
export function vue3dInvalide(){ STATIQUE = null; }
export function vue3dSommets(){
  return TAMPON ? { t:TAMPON.t.n, l:TAMPON.l.n } : { t:0, l:0 };
}

export function vue3dDraw(){
  if(!G || !cv || !host) return;
  var r = host.getBoundingClientRect();
  var w = Math.max(200, Math.round(r.width));
  var h = Math.max(160, Math.round(r.height || w * .62));
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = w + "px"; cv.style.height = h + "px";
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  var gl = G.gl;
  gl.viewport(0, 0, cv.width, cv.height);
  var bg = cssRGB("--panel");
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(G.prog);
  gl.uniformMatrix4fv(G.u.mvp, false, orbitMVP(CAM, w, h));
  gl.uniform3f(G.u.light, .42, -.55, .72);
  gl.uniform1f(G.u.amb, .54);

  siteMesh();
  var V = volMesh();
  glDrawStatic(G, TAMPON.t, gl.TRIANGLES);
  dessine(V.t, gl.TRIANGLES);
  glDrawStatic(G, TAMPON.l, gl.LINES);
  dessine(V.l, gl.LINES);
}
function dessine(arr, mode){
  if(!arr.length) return;
  glDraw(G, new Float32Array(arr), mode, arr.length / STRIDE);
}

/* ---------- la caméra --------------------------------------------------------
   Orbite : tirer tourne, la molette recule, le bouton du milieu ou Maj
   déplacent le point visé. Trois gestes, et rien à apprendre. */
export function camTourne(dAz, dEl){
  CAM.az += dAz;
  CAM.el = Math.max(.05, Math.min(1.5, CAM.el + dEl));
}
export function camZoom(k){ CAM.dist = Math.max(45, Math.min(900, CAM.dist * k)); }
export function camPan(dx, dy){
  var c = Math.cos(CAM.az), s = Math.sin(CAM.az), k = CAM.dist / 800;
  CAM.tx -= (dx * c + dy * s) * k;
  CAM.ty -= (dx * s - dy * c) * k;
}
export function camVers(v){
  if(!v) return;
  CAM.tx = v.x; CAM.ty = v.y;
}
/* Recadrer sur le projet : sans cela, une nouvelle proposition apparaissait
   quelque part hors champ et il fallait la chercher à la molette. */
export function camFit(){
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = 0;
  MASS.vol.forEach(function(v){
    coins(rectBas(v)).forEach(function(p){
      if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0];
      if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1];
      n++;
    });
  });
  if(!n){ camReset(); return; }
  CAM.tx = (x0 + x1) / 2; CAM.ty = (y0 + y1) / 2;
  CAM.tz = terrain(CAM.tx, CAM.ty) - ZBAS + 6;
  CAM.dist = Math.max(90, Math.min(600, Math.hypot(x1 - x0, y1 - y0) * 1.9));
}

function wire3d(){
  document.addEventListener("pointerdown", function(e){
    if(!cv || e.target !== cv) return;
    drag3 = { x:e.clientX, y:e.clientY, pan: e.shiftKey || e.button === 1 };
    e.preventDefault();
  });
  document.addEventListener("pointermove", function(e){
    if(!drag3) return;
    var dx = e.clientX - drag3.x, dy = e.clientY - drag3.y;
    drag3.x = e.clientX; drag3.y = e.clientY;
    if(drag3.pan) camPan(dx, dy);
    else camTourne(dx * .006, dy * .004);
    vue3dDraw();
    if(onChange3) onChange3("cam");
  });
  document.addEventListener("pointerup", function(){ drag3 = null; });
  document.addEventListener("wheel", function(e){
    if(!cv || e.target !== cv) return;
    e.preventDefault();
    camZoom(Math.exp(e.deltaY * .0012));
    vue3dDraw();
    if(onChange3) onChange3("cam");
  }, { passive:false });
}

/* Quel volume est sous le curseur : on projette le toit de chaque étage visible
   et l'on garde le plus proche de l'œil. Le picking exact demanderait un lancer
   de rayon ; à cette échelle, le toit suffit. */
export function vue3dPick(px, py){
  if(!G || !cv) return null;
  var r = cv.getBoundingClientRect();
  var mvp = orbitMVP(CAM, r.width, r.height), eye = orbitEye(CAM);
  var N = niveaux(), best = null, bd = Infinity;
  MASS.vol.forEach(function(v){
    var as = assise(rectBas(v)).z - ZBAS, z = as, sous = 0;
    var lv = v.lv.slice().sort(function(a, b){ return a.i - b.i; });
    lv.forEach(function(e){ if(lvlOf(e.i) < 0 && N[e.i]) sous += N[e.i].h; });
    z = as - sous;
    lv.forEach(function(e){
      var n = N[e.i];
      if(!n) return;
      var z0 = z; z += n.h;
      if(MASS.etage >= 0 && MASS.etage !== e.i) return;
      var q = coins(volRect(v, e)).map(function(p){
        return m4project(mvp, [p[0], p[1], z0 + n.h], r.width, r.height);
      });
      if(q.some(function(p){ return !p; })) return;
      if(!dansPoly(q, px, py)) return;
      var d = Math.hypot(eye[0] - v.x, eye[1] - v.y, eye[2] - z0);
      if(d < bd){ bd = d; best = v; }
    });
  });
  return best;
}
function dansPoly(P, x, y){
  var ok = false, i, j;
  for(i = 0, j = P.length - 1; i < P.length; j = i++){
    if(((P[i][1] > y) !== (P[j][1] > y))
       && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) ok = !ok;
  }
  return ok;
}
