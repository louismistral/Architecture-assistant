/* ============================================================================
   WEBGL MINIMAL — matrices, programme, tampons, caméra orbitale
   Le projet n'a aucune dépendance et n'en prendra pas pour de la 3D : il faut
   une caméra en perspective, un tampon de profondeur et un éclairage plat,
   soit une page de code. Tout ce qui est propre au site vit dans
   `src/views/vue3d.js` ; ici, rien qui parle d'architecture.
   ========================================================================= */

/* ---- matrices 4×4, en colonnes (convention WebGL) ----------------------- */
export function m4mul(a, b){
  var o = new Float32Array(16), i, j, k, s;
  for(i = 0; i < 4; i++) for(j = 0; j < 4; j++){
    s = 0;
    for(k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
    o[i * 4 + j] = s;
  }
  return o;
}
export function m4persp(fovy, asp, zn, zf){
  var f = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
  o[0] = f / asp; o[5] = f; o[10] = (zf + zn) / (zn - zf); o[11] = -1;
  o[14] = 2 * zf * zn / (zn - zf);
  return o;
}
function sub3(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b){
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm3(v){
  var l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
export function m4look(eye, at, up){
  var z = norm3(sub3(eye, at)), x = norm3(cross3(up, z)), y = cross3(z, x);
  var o = new Float32Array(16);
  o[0] = x[0]; o[1] = y[0]; o[2] = z[0];
  o[4] = x[1]; o[5] = y[1]; o[6] = z[1];
  o[8] = x[2]; o[9] = y[2]; o[10] = z[2];
  o[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  o[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  o[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  o[15] = 1;
  return o;
}
/* Un point du monde vers le pixel : les libellés sont du HTML posé par-dessus,
   pas des textures. */
export function m4project(m, p, W, H){
  var x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  var y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  var w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if(w <= 0.001) return null;
  return [(x / w * 0.5 + 0.5) * W, (0.5 - y / w * 0.5) * H];
}

/* ---- contexte et programme ---------------------------------------------- */
var VS = "attribute vec3 aPos;attribute vec3 aNrm;attribute vec4 aCol;"
       + "uniform mat4 uMVP;varying vec4 vCol;varying vec3 vN;"
       + "void main(){gl_Position=uMVP*vec4(aPos,1.0);vCol=aCol;vN=aNrm;}";
/* Une normale nulle signale un trait : il garde sa couleur pleine. */
var FS = "precision mediump float;varying vec4 vCol;varying vec3 vN;"
       + "uniform vec3 uLight;uniform float uAmb;"
       + "void main(){float L=length(vN);float k=1.0;"
       + "if(L>0.5){k=uAmb+(1.0-uAmb)*max(dot(vN/L,uLight),0.0);}"
       + "gl_FragColor=vec4(vCol.rgb*k,vCol.a);}";

export function glInit(canvas){
  var gl = canvas.getContext("webgl", { antialias:true, alpha:true, premultipliedAlpha:false })
        || canvas.getContext("experimental-webgl");
  if(!gl) return null;
  function sh(t, src){
    var s = gl.createShader(t);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if(!vs || !fs) return null;
  var p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  gl.useProgram(p);
  return { gl:gl, prog:p, buf:gl.createBuffer(),
    a:{ pos:gl.getAttribLocation(p, "aPos"), nrm:gl.getAttribLocation(p, "aNrm"),
        col:gl.getAttribLocation(p, "aCol") },
    u:{ mvp:gl.getUniformLocation(p, "uMVP"), light:gl.getUniformLocation(p, "uLight"),
        amb:gl.getUniformLocation(p, "uAmb") } };
}
/* Un sommet = 10 flottants : position, normale, couleur. */
export var STRIDE = 10;
export function glDraw(G, data, mode, count){
  var gl = G.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, G.buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  var st = STRIDE * 4;
  gl.enableVertexAttribArray(G.a.pos); gl.vertexAttribPointer(G.a.pos, 3, gl.FLOAT, false, st, 0);
  gl.enableVertexAttribArray(G.a.nrm); gl.vertexAttribPointer(G.a.nrm, 3, gl.FLOAT, false, st, 12);
  gl.enableVertexAttribArray(G.a.col); gl.vertexAttribPointer(G.a.col, 4, gl.FLOAT, false, st, 24);
  gl.drawArrays(mode, 0, count);
}

/* ---- couleurs du thème --------------------------------------------------- */
/* Règle du projet : aucune valeur de dessin hors de `tokens.css`. WebGL ne sait
   pas lire `var(--f-cla)` : on demande au navigateur de résoudre le token sur
   une sonde, et on garde le résultat tant que le thème ne change pas. */
var CCACHE = {}, CKEY = "";
function themeKey(){
  return (document.documentElement.getAttribute("data-theme") || "auto") + "|"
       + (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "d" : "l");
}
export function cssRGB(token){
  var k = themeKey();
  if(k !== CKEY){ CCACHE = {}; CKEY = k; }
  if(CCACHE[token]) return CCACHE[token];
  var probe = document.createElement("span");
  probe.style.cssText = "position:absolute;width:0;height:0;color:var(" + token + ")";
  document.body.appendChild(probe);
  var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(probe).color);
  document.body.removeChild(probe);
  var v = m ? m[1].split(",").map(parseFloat) : [128, 128, 128];
  var c = [v[0] / 255, v[1] / 255, v[2] / 255];
  CCACHE[token] = c;
  return c;
}

/* ---- caméra orbitale ----------------------------------------------------- */
/* az : rotation autour de l'axe vertical, 0 = regard vers le nord.
   el : hauteur du regard, de 2° (rasant) à 88° (à la verticale). */
export function orbitEye(o){
  var ce = Math.cos(o.el), se = Math.sin(o.el);
  return [o.tx + o.dist * ce * Math.sin(o.az),
          o.ty - o.dist * ce * Math.cos(o.az),
          o.tz + o.dist * se];
}
export function orbitMVP(o, W, H){
  var eye = orbitEye(o);
  var proj = m4persp(o.fov || 0.62, W / Math.max(1, H), Math.max(1, o.dist / 200), o.dist * 6);
  return m4mul(proj, m4look(eye, [o.tx, o.ty, o.tz], [0, 0, 1]));
}
