/* ============================================================================
   L'ARCHITECTURE D'UN VOLUME — toiture, puits de lumière, entrée, rampe,
   sous-passage. Ce que le cube a de plus qu'une boîte.

   `v.ar` porte les choix ; `archiDe(v)` en tire la géométrie, en coins
   absolus, une fois pour le plan, la 3D et l'export. Tout est un COIN — un
   prisme dont le dessus monte de `zA` à `zB` le long de son axe u : une boîte
   a `zA = zB`, un pan de toit monte, une dent de shed aussi.

   Aucun élément ne touche une surface du programme : le toit est au-dessus du
   dernier étage, l'auvent et la rampe dehors. Le sous-passage traverse le rez
   — les locaux qu'il coupe restent comptés, à reloger.
   ========================================================================= */
import { RULES } from "../data/rules.js";
import { etagesDe } from "./model.js";

var R = RULES.archi;

/* Les choix, une fois : la vue en fait ses listes. Un côté est celui des
   poignées d'étirement : 0 = +w, 1 = +d, 2 = −w, 3 = −d. */
export var TOITS = [
  { id:"plat", n:"Plat" }, { id:"vert", n:"Végétalisé" }, { id:"pan", n:"Un pan" },
  { id:"deux", n:"Deux pans" }, { id:"shed", n:"Sheds" }
];
export function arDe(v){
  return Object.assign({ toit:"plat", puits:0, entree:-1, rampe:-1, sous:0 }, v.ar || {});
}
/* La façade d'un côté, à la boussole : x à l'est, y au nord. */
var CAPS = ["est", "nord-est", "nord", "nord-ouest", "ouest", "sud-ouest", "sud", "sud-est"];
export function capCote(v, s){
  var a = v.a + s * Math.PI / 2, k = Math.round(a / (Math.PI / 4));
  return CAPS[((k % 8) + 8) % 8];
}

/* Un repère : centre, angle, demi-côtés. `cote(rc, s)` tourne le repère pour
   que le côté s soit son +v ; `long(rc)` pour que u soit le grand côté. */
function rep(rc, a, hw, hd){ return { x:rc.x, y:rc.y, a:a, hw:hw, hd:hd }; }
function cote(rc, s){
  return rep(rc, rc.a + (s - 1) * Math.PI / 2, (s % 2 ? rc.w : rc.d) / 2, (s % 2 ? rc.d : rc.w) / 2);
}
function long(rc){
  return rc.w >= rc.d ? rep(rc, rc.a, rc.w / 2, rc.d / 2) : rep(rc, rc.a + Math.PI / 2, rc.d / 2, rc.w / 2);
}
function court(rc){
  return rc.w >= rc.d ? rep(rc, rc.a + Math.PI / 2, rc.d / 2, rc.w / 2) : rep(rc, rc.a, rc.w / 2, rc.d / 2);
}
function P(F, u, v, z){
  var c = Math.cos(F.a), s = Math.sin(F.a);
  return [F.x + u * c - v * s, F.y + u * s + v * c, z];
}
function coin(k, t, F, u0, u1, v0, v1, zb, zA, zB, i){
  return { k:k, t:t, F:F, b:[u0, u1, v0, v1], z:[zb, zA, zB], i:i };
}

/* Les faces d'un coin, chacune tournée vers le dehors (sens direct vu de
   l'extérieur) : la 3D éclaire par la normale, Rhino lit la même. */
export function faces(c){
  var F = c.F, u0 = c.b[0], u1 = c.b[1], v0 = c.b[2], v1 = c.b[3];
  var zb = c.z[0], zA = c.z[1], zB = c.z[2];
  function p(u, v, z){ return P(F, u, v, z); }
  return [
    [p(u0, v0, zA), p(u1, v0, zB), p(u1, v1, zB), p(u0, v1, zA)],
    [p(u0, v0, zb), p(u1, v0, zb), p(u1, v0, zB), p(u0, v0, zA)],
    [p(u1, v1, zb), p(u0, v1, zb), p(u0, v1, zA), p(u1, v1, zB)],
    [p(u1, v0, zb), p(u1, v1, zb), p(u1, v1, zB), p(u1, v0, zB)],
    [p(u0, v1, zb), p(u0, v0, zb), p(u0, v0, zA), p(u0, v1, zA)],
    [p(u0, v0, zb), p(u0, v1, zb), p(u1, v1, zb), p(u1, v0, zb)]
  ];
}
/* Son emprise au sol, pour le plan. */
export function emprise(c){
  var b = c.b;
  return [P(c.F, b[0], b[2], 0), P(c.F, b[1], b[2], 0), P(c.F, b[1], b[3], 0), P(c.F, b[0], b[3], 0)];
}

/* La géométrie de l'architecture d'un volume. `t` est le token de la teinte,
   null pour la masse du volume ; `k` dit ce qu'est l'élément, `i` le niveau
   qui le porte (la 3D masque un niveau caché, et ce qu'il porte avec lui). */
export function archiDe(v){
  var ar = arDe(v), out = [];
  var E = etagesDe(v).filter(function(s){ return s.n.lvl >= 0; });
  if(!E.length) return out;
  var haut = E[E.length - 1], rez = E[0], rc = haut.rc, z = haut.z1, F, n, k, r;

  if(ar.toit === "vert"){
    F = long(rc);
    out.push(coin("toit", "--f-ext", F, -F.hw, F.hw, -F.hd, F.hd, z, z + R.vert, z + R.vert, haut.e.i));
  } else if(ar.toit === "pan"){
    F = court(rc); r = R.pente * 2 * F.hw;
    out.push(coin("toit", null, F, -F.hw, F.hw, -F.hd, F.hd, z, z, z + r, haut.e.i));
  } else if(ar.toit === "deux"){
    F = court(rc); r = R.pente * F.hw;
    out.push(coin("toit", null, F, -F.hw, 0, -F.hd, F.hd, z, z, z + r, haut.e.i));
    out.push(coin("toit", null, F, 0, F.hw, -F.hd, F.hd, z, z + r, z, haut.e.i));
  } else if(ar.toit === "shed"){
    F = long(rc); n = Math.max(1, Math.round(2 * F.hw / R.shed.pas));
    for(k = 0; k < n; k++){
      var a0 = -F.hw + k * 2 * F.hw / n;
      out.push(coin("toit", null, F, a0, a0 + 2 * F.hw / n, -F.hd, F.hd, z, z, z + R.shed.h, haut.e.i));
    }
  }
  /* Les lanterneaux s'alignent sur le grand axe, au faîte du toit. */
  if(ar.puits > 0){
    F = long(rc);
    var zp = z + (ar.toit === "pan" ? R.pente * 2 * court(rc).hw : ar.toit === "deux" ? R.pente * court(rc).hw
            : ar.toit === "shed" ? R.shed.h : ar.toit === "vert" ? R.vert : 0);
    var c2 = Math.min(R.puits.cote, F.hd) / 2;
    for(k = 0; k < ar.puits; k++){
      var u = -F.hw + (k + .5) * 2 * F.hw / ar.puits;
      out.push(coin("puits", "--f-eau", F, u - c2, u + c2, -c2, c2, z, zp + R.puits.h, zp + R.puits.h, haut.e.i));
    }
  }
  if(ar.entree >= 0){
    F = cote(rez.rc, ar.entree);
    var L = Math.min(R.auvent.larg, F.hw * 1.2) / 2, za = rez.z0 + R.auvent.h;
    out.push(coin("entree", null, F, -L, L, F.hd, F.hd + R.auvent.prof, za, za + R.auvent.ep, za + R.auvent.ep, rez.e.i));
  }
  if(ar.rampe >= 0){
    F = cote(rez.rc, ar.rampe);
    var hr = Math.min(rez.h, 2 * F.hw * R.rampe.pente);
    out.push(coin("rampe", null, F, -F.hw, F.hw, F.hd, F.hd + R.rampe.larg, rez.z0, rez.z0, rez.z0 + hr, rez.e.i));
  }
  if(ar.sous){
    F = court(rez.rc);
    var ls = Math.min(R.sous.larg, F.hd) / 2;
    out.push(coin("sous", "--foreground", F, -F.hw - .05, F.hw + .05, -ls, ls,
      rez.z0, rez.z0 + Math.min(rez.h - .2, R.sous.h), rez.z0 + Math.min(rez.h - .2, R.sous.h), rez.e.i));
  }
  return out;
}

/* Le jeu de niveaux : les étages au-dessus du rez glissent tour à tour de ±j
   le long de la largeur. Le rez reste où il est — c'est lui qui pose. */
export function jeuNiveaux(v, j){
  var E = etagesDe(v).filter(function(s){ return s.n.lvl >= 0; });
  E.forEach(function(s, k){ if(k > 0) s.e.dx = k % 2 ? j : -j; });
}
export function jeuDe(v){
  var E = etagesDe(v).filter(function(s){ return s.n.lvl >= 0; });
  return E.length > 1 ? (E[1].e.dx || 0) : 0;
}

/* LES LEVIERS D'ARCHITECTURE. Après un tirage, chaque corps d'école reçoit ce
   que les leviers disent (`MASS.lev` : toit, pf, jeu, puits, entree, rampe,
   sous) ; un levier libre est tiré UNE fois pour toute la composition, à la
   graine du massing. Un débord (porte-à-faux, jeu de niveaux) n'est pris que
   s'il reste dans la parcelle et ne recouvre personne. */
var OPT_TOIT = ["plat", "vert", "pan", "deux", "shed"];
export function architecturer(vols, lev, graine, tient){
  var s = ((graine || 1) * 2654435761) >>> 0;
  function r(){ s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }
  function oui(k){ return lev[k] != null ? lev[k] === "oui" : r() < .5; }
  var toit = lev.toit != null ? lev.toit : OPT_TOIT[Math.floor(r() * OPT_TOIT.length)];
  var pf = oui("pf"), jeu = oui("jeu"), puits = oui("puits"), entree = oui("entree"), rampe = oui("rampe"), sous = oui("sous");
  var ecole = vols.filter(function(v){ return !v.fix && !v.ph; });
  if(!ecole.length) return;
  var cx = 0, cy = 0;
  ecole.forEach(function(v){ cx += v.x / ecole.length; cy += v.y / ecole.length; });
  var grand = ecole.slice().sort(function(p, q){ return q.lv.length * q.lv[0].w * q.lv[0].d - p.lv.length * p.lv[0].w * p.lv[0].d; })[0];
  function face(v){
    var best = 0, m = -Infinity;
    for(var k = 0; k < 4; k++){ var a = v.a + k * Math.PI / 2, d = Math.cos(a) * (cx - v.x) + Math.sin(a) * (cy - v.y); if(d > m){ m = d; best = k; } }
    return best;
  }
  vols.forEach(function(v){
    if(v.fix){ v.ar = { toit:"plat" }; return; }   /* la salle de sport : toit plat */
    if(v.ph){ v.ar = { toit:"plat" }; return; }
    var E = etagesDe(v).filter(function(e){ return e.n.lvl >= 0; });
    if(!E.length) return;
    var rc = E[0].rc, lg = Math.max(rc.w, rc.d), pr = Math.min(rc.w, rc.d), f = face(v);
    v.ar = { toit:toit, puits:puits && pr >= 14 ? Math.max(1, Math.round(lg / 12)) : 0,
             entree:entree ? f : -1, rampe:rampe && v === grand ? (f + 1) % 4 : -1, sous:sous && lg >= 24 ? 1 : 0 };
    if(E.length < 2) return;
    function essai(fn){
      var av = v.lv.map(function(e){ return [e.dx || 0, e.dy || 0]; });
      fn();
      if(!tient(v)) v.lv.forEach(function(e, k){ e.dx = av[k][0]; e.dy = av[k][1]; });
    }
    if(pf) essai(function(){ var t = E[E.length - 1].e; t.dy = (t.dy || 0) + (f === 1 ? 3 : f === 3 ? -3 : 0); if(f % 2 === 0) t.dx = (t.dx || 0) + (f === 0 ? 3 : -3); });
    if(jeu && E.length > 2) essai(function(){ jeuNiveaux(v, 1.5); });
  });
}
