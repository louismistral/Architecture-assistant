/* ============================================================================
   VUE 3D DU SITE
   Une vraie caméra en perspective, un tampon de profondeur, l'éclairage d'une
   maquette : on tourne autour du projet au lieu de le regarder de trois quarts
   depuis un point fixe. C'est ce que l'axonométrie militaire ne pouvait pas
   donner — elle projetait un plan vrai, sans point de vue ni occlusion.

   Le terrain du relevé est un plan (l'altitude est affine en x et y) : il se
   dessine d'un quadrilatère. Les couches du géomètre montent dessus, le bâti
   existant est extrudé forfaitairement à 7 m, les volumes du projet sont des
   boîtes, un niveau à la fois.
   ========================================================================= */
import { STRIDE, cssRGB, glDraw, glInit, m4project, orbitEye, orbitMVP } from "../core/gl.js";
import { dim, el, fmt } from "../core/format.js";
import { FMAP } from "../core/model.js";
import { PER, SITE } from "../data/site.js";
import { ZBAS, terrain, vcorners, vmid } from "./place.js";

/* ---- caméra -------------------------------------------------------------- */
/* az : 0 regarde vers le nord. Le regard par défaut vient du sud-ouest, à 24°
   au-dessus de l'horizon : c'est la vue de maquette, et elle montre le
   dénivelé de 1,94 % vers l'est que le plan ne montre pas. */
export var CAM = { az:-0.62, el:0.42, dist:340, tx:88, ty:61, tz:6, fov:0.62 };
export var CAM0 = { az:-0.62, el:0.42, dist:340, tx:88, ty:61, tz:6, fov:0.62 };
export function camReset(){ for(var k in CAM0) CAM[k] = CAM0[k]; }

var G = null, canvas = null, labels = null, host3 = null, DPR = 1;
export var sceneSel = -1, sceneFail = "";

/* ---- construction de la géométrie ---------------------------------------- */
function Mesh(){ return { t:[], l:[] }; }
function push(arr, p, n, c, a){
  arr.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], a == null ? 1 : a);
}
function quad(M, A, B, C, D, c, a){
  var u = [B[0]-A[0], B[1]-A[1], B[2]-A[2]], v = [D[0]-A[0], D[1]-A[1], D[2]-A[2]];
  var n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  var L = Math.hypot(n[0], n[1], n[2]) || 1;
  n = [n[0]/L, n[1]/L, n[2]/L];
  [A,B,C, A,C,D].forEach(function(p){ push(M.t, p, n, c, a); });
}
/* Un polygone se triangule en éventail depuis son centre : les emprises du
   relevé sont des rectangles ou des L, l'éventail les rend sans artefact. */
function fan(M, P, zf, c, a){
  var cx = 0, cy = 0, n = P.length;
  P.forEach(function(p){ cx += p[0]; cy += p[1]; });
  cx /= n; cy /= n;
  var ctr = [cx, cy, zf(cx, cy)], up = [0, 0, 1], i;
  for(i = 0; i < n; i++){
    var a1 = P[i], b1 = P[(i + 1) % n];
    push(M.t, ctr, up, c, a);
    push(M.t, [a1[0], a1[1], zf(a1[0], a1[1])], up, c, a);
    push(M.t, [b1[0], b1[1], zf(b1[0], b1[1])], up, c, a);
  }
}
function line(M, P, z, c, close, a){
  var n = P.length, N = [0, 0, 0], i, m = close ? n : n - 1;
  for(i = 0; i < m; i++){
    var A = P[i], B = P[(i + 1) % n];
    push(M.l, [A[0], A[1], z(A[0], A[1])], N, c, a);
    push(M.l, [B[0], B[1], z(B[0], B[1])], N, c, a);
  }
}
/* Une boîte : quatre faces et un toit. Le dessous ne se voit jamais. */
function boite(M, C, z0, z1, c, a, edge){
  var n = C.length, i, top = [];
  for(i = 0; i < n; i++){
    var A = C[i], B = C[(i + 1) % n];
    quad(M, [A[0],A[1],z0], [B[0],B[1],z0], [B[0],B[1],z1], [A[0],A[1],z1], c, a);
    top.push([A[0], A[1], z1]);
  }
  fan(M, C, function(){ return z1; }, c, a);
  if(edge){
    for(i = 0; i < n; i++){
      var P = top[i], Q = top[(i + 1) % n];
      push(M.l, P, [0,0,0], edge, 1); push(M.l, Q, [0,0,0], edge, 1);
      push(M.l, [P[0],P[1],z0], [0,0,0], edge, 1); push(M.l, P, [0,0,0], edge, 1);
    }
  }
  return top;
}
function zt(x, y){ return terrain(x, y) - ZBAS; }

/* Hauteur de sol d'un volume : le terrain naturel sous son centre. */
export function volZ(v){
  var m = vmid(v);
  return zt(m[0], m[1]);
}
/* Hauteur totale hors sol, acrotère compris — ce que la silhouette montre. */
export function volHaut(v){
  if(v.sol) return 0;
  var hors = Math.max(0, (v.nz || 0) + (v.lv || 1)) - Math.max(0, v.nz || 0);
  return hors * (v.hl || 3.25);
}

function build(VOLS, opt){
  var M = Mesh();
  var cSol = cssRGB("--rule-soft"), cPer = cssRGB("--site-perimetre");
  var cBat = cssRGB("--ink-4"), cRul = cssRGB("--rule"), cRou = cssRGB("--ink-3");
  var cEnq = cssRGB("--f-adm"), cFoo = cssRGB("--site-emprise"), cInk = cssRGB("--ink-3");

  /* le terrain : un plan, donc un quadrilatère, débordant largement le site */
  var B = { x0:-120, x1:320, y0:-90, y1:230 };
  quad(M, [B.x0,B.y0,zt(B.x0,B.y0)], [B.x1,B.y0,zt(B.x1,B.y0)],
          [B.x1,B.y1,zt(B.x1,B.y1)], [B.x0,B.y1,zt(B.x0,B.y1)], cSol, 1);
  /* le périmètre du concours, posé dessus */
  fan(M, PER, function(x, y){ return zt(x, y) + 0.06; }, cPer, 0.14);

  function lz(d){ return function(x, y){ return zt(x, y) + d; }; }
  (SITE.par || []).forEach(function(P){ line(M, P, lz(0.10), cRul, 0); });
  (SITE.foo || []).forEach(function(P){ line(M, P, lz(0.12), cFoo, 0); });
  (SITE.mur || []).forEach(function(P){ line(M, P, lz(0.12), cInk, 0); });
  (SITE.rou || []).forEach(function(P){ line(M, P, lz(0.14), cRou, 0); });
  (SITE.enq || []).forEach(function(P){ line(M, P, lz(0.16), cEnq, 1); });
  line(M, PER, lz(0.20), cPer, 1);

  /* bâti existant, extrudé forfaitairement à 7 m */
  (SITE.bat || []).forEach(function(P){
    if(P.length < 3) return;
    var Q = P.slice(0, (P[0][0] === P[P.length-1][0] && P[0][1] === P[P.length-1][1]) ? -1 : P.length);
    if(Q.length < 3) return;
    var z0 = zt(Q[0][0], Q[0][1]);
    boite(M, Q, z0, z0 + 7, cBat, 1, null);
  });

  /* volumes du projet, un niveau à la fois — les dalles se lisent entre les
     étages, comme dans l'ancienne axonométrie */
  var T = Mesh();                       /* second temps : translucide, passe à part */
  VOLS.forEach(function(v, k){
    var C = vcorners(v), z0 = volZ(v), col = cssRGB(FMAP[v.f] ? FMAP[v.f].c : "--ink-3");
    var sel = (k === sceneSel);
    if(v.sol){                          /* la cour : une surface, pas un volume */
      fan(M, C, function(x, y){ return zt(x, y) + 0.22; }, col, sel ? 0.55 : 0.34);
      line(M, C, lz(0.24), col, 1);
      return;
    }
    var hl = v.hl || 3.25, nz = v.nz || 0, i;
    var dst = (v.ph === 2) ? T : M;
    for(i = 0; i < (v.lv || 1); i++)
      boite(dst, C, z0 + (nz + i) * hl, z0 + (nz + i + 1) * hl, col,
            v.ph === 2 ? 0.45 : 1, sel ? cssRGB("--focus") : cssRGB("--ink"));
  });
  return { M:M, T:T };
}

/* ---- rendu ---------------------------------------------------------------- */
function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(320, host3.clientWidth), h = Math.max(320, Math.round(w * 0.56));
  h = Math.min(h, Math.round(window.innerHeight * 0.55));
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
  labels.style.width = w + "px"; labels.style.height = h + "px";
  return [w, h];
}
export function scene3dOK(){ return !!G; }

export function scene3dMount(hostEl){
  if(host3 === hostEl && G) return true;
  host3 = hostEl;
  while(host3.firstChild) host3.removeChild(host3.firstChild);
  canvas = document.createElement("canvas");
  canvas.className = "vol3d";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label",
    "Vue 3D du centre scolaire sur le terrain du concours : on tourne autour du projet à la souris.");
  labels = el("div", "vol3d__labels");
  host3.appendChild(canvas);
  host3.appendChild(labels);
  G = glInit(canvas);
  if(!G){
    sceneFail = "Le navigateur n’expose pas WebGL : la vue 3D est indisponible, le plan reste complet.";
    host3.removeChild(canvas);
    var p = el("p", "vol3d__fail", sceneFail);
    host3.appendChild(p);
    return false;
  }
  var gl = G.gl;
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

export function scene3dDraw(VOLS, opt){
  if(!G) return;
  var gl = G.gl, wh = resize(), W = wh[0], H = wh[1];
  var S = build(VOLS, opt || {});
  var mvp = orbitMVP(CAM, W, H);
  var paper = cssRGB("--panel");
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(paper[0], paper[1], paper[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(G.u.mvp, false, mvp);
  /* soleil du sud-ouest, haut : l'orientation que le règlement demande de
     travailler se lit sur les façades */
  gl.uniform3f(G.u.light, 0.34, -0.48, 0.81);
  gl.uniform1f(G.u.amb, 0.52);

  function run(M){
    if(M.t.length){
      gl.depthMask(true);
      glDraw(G, new Float32Array(M.t), gl.TRIANGLES, M.t.length / STRIDE);
    }
    if(M.l.length){
      glDraw(G, new Float32Array(M.l), gl.LINES, M.l.length / STRIDE);
    }
  }
  run(S.M);
  gl.depthMask(false);                 /* le second temps est translucide */
  run(S.T);
  gl.depthMask(true);

  paintLabels(VOLS, mvp, W, H);
}

/* Les libellés sont du HTML posé sur la toile : ils gardent la typographie et
   les tokens du projet, et restent lisibles dans les deux thèmes. */
function paintLabels(VOLS, mvp, W, H){
  while(labels.firstChild) labels.removeChild(labels.firstChild);
  var eye = orbitEye(CAM), out = [];
  VOLS.forEach(function(v, k){
    if(v.ph === 2 && v.sol) return;
    var m = vmid(v), z = volZ(v) + Math.max(0, (v.nz || 0)) * (v.hl || 0) + volHaut(v);
    var q = m4project(mvp, [m[0], m[1], z + 1.5], W, H);
    if(!q) return;
    if(q[0] < -60 || q[0] > W + 60 || q[1] < -30 || q[1] > H + 30) return;
    out.push({ k:k, v:v, q:q, d:Math.hypot(eye[0] - m[0], eye[1] - m[1]) });
  });
  /* Neuf libellés posés au centre de leurs toitures se recouvraient au point
     d'être illisibles. Du plus proche au plus lointain, un libellé n'est gardé
     que s'il ne mord pas sur un libellé déjà gardé ; le volume désigné passe
     toujours en premier et n'est donc jamais écarté. */
  out.sort(function(a, b){
    return (a.k === sceneSel ? -1 : b.k === sceneSel ? 1 : 0) || (a.d - b.d);
  });
  var kept = [];
  out.forEach(function(o){
    var txt = o.v.n.split(" — ")[0], sub = dim(o.v.w) + " × " + dim(o.v.h) + " m · " + o.v.sub;
    var w = Math.max(txt.length * 6.6, sub.length * 5.6) + 16, h = 30;
    var b = { x0:o.q[0] - w / 2, x1:o.q[0] + w / 2, y0:o.q[1] - h, y1:o.q[1] };
    for(var i = 0; i < kept.length; i++){
      var q = kept[i];
      if(b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) return;
    }
    kept.push(b);
    var d = el("div", "vol3d__lab" + (o.k === sceneSel ? " is-sel" : ""));
    d.style.left = o.q[0].toFixed(0) + "px";
    d.style.top = o.q[1].toFixed(0) + "px";
    d.appendChild(el("b", null, txt));
    d.appendChild(el("span", null, sub));
    labels.appendChild(d);
  });
  /* De face, les volumes du fond perdent leur libellé : le dire une fois vaut
     mieux que le laisser deviner. */
  if(kept.length < out.length){
    var n = out.length - kept.length;
    var r = el("div", "vol3d__hidden", n + " libellé" + (n > 1 ? "s" : "") + " masqué"
      + (n > 1 ? "s" : "") + " — tourne la vue ou clique un volume");
    labels.appendChild(r);
  }
}

/* ---- désignation --------------------------------------------------------- */
/* Un clic désigne le volume dont la toiture contient le point, le plus proche
   de l'œil s'il y en a plusieurs. Projeter quatre coins coûte moins qu'un
   lancer de rayon, et se trompe rarement sur des boîtes. */
export function scene3dPick(px, py, VOLS){
  if(!G) return -1;
  var W = parseFloat(canvas.style.width), H = parseFloat(canvas.style.height);
  var mvp = orbitMVP(CAM, W, H), eye = orbitEye(CAM), best = -1, bd = 1e9;
  VOLS.forEach(function(v, k){
    var C = vcorners(v), z = volZ(v) + ((v.nz || 0) + (v.lv || 1)) * (v.hl || 0);
    if(v.sol) z = volZ(v);
    var P = [], ok = true;
    C.forEach(function(c){
      var q = m4project(mvp, [c[0], c[1], z], W, H);
      if(!q) ok = false; else P.push(q);
    });
    if(!ok || P.length < 3) return;
    var inside = false, i, j;
    for(i = 0, j = P.length - 1; i < P.length; j = i++)
      if((P[i][1] > py) !== (P[j][1] > py)
        && px < (P[j][0] - P[i][0]) * (py - P[i][1]) / (P[j][1] - P[i][1] + 1e-9) + P[i][0])
        inside = !inside;
    if(!inside) return;
    var m = vmid(v), d = Math.hypot(eye[0] - m[0], eye[1] - m[1], eye[2] - z);
    if(d < bd){ bd = d; best = k; }
  });
  return best;
}
export function setSceneSel(k){ sceneSel = k; }

/* ---- cadrage ------------------------------------------------------------- */
/* La caméra vise le milieu des volumes posés et recule de quoi les tenir tous
   dans le champ : sans ça, un parti étalé sortait du cadre. */
export function scene3dFit(VOLS){
  camReset();
  var pts = [];
  VOLS.forEach(function(v){ vcorners(v).forEach(function(c){ pts.push(c); }); });
  if(!pts.length) PER.forEach(function(p){ pts.push(p); });
  var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  CAM.tx = (x0 + x1) / 2; CAM.ty = (y0 + y1) / 2;
  CAM.tz = zt(CAM.tx, CAM.ty) + 8;
  CAM.dist = Math.max(140, Math.hypot(x1 - x0, y1 - y0) * 1.55);
}
export function scene3dTurn(dAz, dEl){
  CAM.az += dAz;
  CAM.el = Math.max(0.035, Math.min(1.53, CAM.el + dEl));
}
export function scene3dZoom(k){ CAM.dist = Math.max(40, Math.min(900, CAM.dist * k)); }
/* Le déplacement latéral suit le regard, pas les axes du terrain : tirer vers
   la droite déplace la vue vers la droite quel que soit l'azimut. */
export function scene3dPan(dx, dy){
  var s = CAM.dist / 900, ca = Math.cos(CAM.az), sa = Math.sin(CAM.az);
  CAM.tx -= (dx * ca + dy * sa) * s;
  CAM.ty -= (-dx * sa + dy * ca) * s;
}
export function camLabel(){
  var deg = Math.round((-CAM.az * 180 / Math.PI) % 360);
  if(deg < 0) deg += 360;
  var card = ["nord","nord-est","est","sud-est","sud","sud-ouest","ouest","nord-ouest"];
  return "vue depuis le " + card[Math.round(deg / 45) % 8] + " · "
       + Math.round(CAM.el * 180 / Math.PI) + "° au-dessus de l’horizon · "
       + fmt(Math.round(CAM.dist)) + " m de recul";
}
