/* ============================================================================
   LE GÉNÉRATEUR DE VOLUMÉTRIE

   « Shuffle massing » ne touche PAS au programme. Mêmes postes, mêmes
   surfaces, mêmes niveaux, même répartition par niveau : ce que le mixer a
   décidé est une donnée d'entrée, pas une variable. Ce qui change est la
   SOLUTION ARCHITECTURALE — combien de corps, où, dans quelle direction, à
   quelle profondeur, jusqu'à quel étage, avec quels retraits.

   Et ce n'est pas un tirage. Un tirage pur pose des boîtes au hasard et laisse
   l'architecte trier ; celui-ci compose, mesure, et jette :

     1. lire le programme niveau par niveau (le mixer) ;
     2. lire le site, ses limites, son terrain, ce qui y est déjà (le relevé) ;
     3. composer une figure — le parti dit laquelle ;
     4. la RÉPARER : tant qu'un corps sort du périmètre, touche un voisin ou
        percute l'existant, on le ramène ;
     5. la NOTER : les écarts coûtent, les relations architecturales rapportent ;
     6. recommencer une trentaine de fois, garder la meilleure.

   Les alignements sont des PRÉFÉRENCES et jamais des règles : un corps peut
   prendre n'importe quel angle, il gagne seulement à se ranger sur l'axe du
   périmètre, sur une limite, sur une route ou sur le nord-sud. C'est ce qui
   laisse le système libre tout en le rendant architectural.
   ========================================================================= */
import { ITEMBYKEY } from "../core/model.js";
import { NAPPE, PER, SITE } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { areaOf, lvlOf, onFloor } from "../mix/floors.js";
import {
  alignement, assise, attracteurs, axePer, bbox, dedans,
  ecart, ecartPoly, margeAu
} from "./geom.js";
import { MASS, horsSol, sousSol } from "./model.js";

/* ---------- le hasard du massing, et lui seul -------------------------------
   Une graine propre : celle du mixer rejoue une RÉPARTITION, celle-ci rejoue
   une IMPLANTATION. Les confondre ferait qu'on ne peut plus changer l'une sans
   perdre l'autre — et c'est justement ce que les deux boutons évitent. */
function alea(g){
  var s = (g >>> 0) || 1;
  return function(){
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function entre(r, a, b){ return a + r() * (b - a); }
function pioche(r, list){ return list[Math.floor(r() * list.length) % list.length]; }
function d1(v){ return Math.round(v * 10) / 10; }

/* ---------- le cadre constructible ------------------------------------------
   Le périmètre du concours est un polygone de vingt-sept côtés : personne n'y
   compose directement. On travaille dans SON axe, sur la boîte qu'il inscrit,
   retrait compris — et l'on vérifie ensuite chaque corps contre le polygone
   vrai, qui reste le juge. */
function cadre(cap){
  var c = Math.cos(-cap), s = Math.sin(-cap);
  var u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  PER.forEach(function(p){
    var u = p[0] * c - p[1] * s, v = p[0] * s + p[1] * c;
    if(u < u0) u0 = u; if(u > u1) u1 = u;
    if(v < v0) v0 = v; if(v > v1) v1 = v;
  });
  var m = RULES.dist.retrait;
  return { u0:u0 + m, u1:u1 - m, v0:v0 + m, v1:v1 - m,
           cu:(u0 + u1) / 2, cv:(v0 + v1) / 2,
           L:(u1 - u0) - 2 * m, P:(v1 - v0) - 2 * m, cap:cap };
}
function versSite(C, u, v){
  var c = Math.cos(C.cap), s = Math.sin(C.cap);
  return { x: u * c - v * s, y: u * s + v * c };
}

/* ---------- les emprises déjà là --------------------------------------------
   Les bâtiments existants qui touchent le périmètre : ce sont eux que l'on ne
   peut pas percuter, et dont l'AEAI veut qu'on s'écarte. Ceux du coteau, à
   cent mètres, ne gênent personne. */
function obstacles(){
  return (SITE.bat || []).filter(function(P){
    return P.some(function(p){ return margePoint(p) > -35; });
  });
}
function margePoint(p){
  var best = Infinity, i;
  for(i = 0; i < PER.length - 1; i++){
    var a = PER[i], b = PER[i + 1];
    var vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
    var t = l2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2 : 0;
    if(t < 0) t = 0; if(t > 1) t = 1;
    var d = Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
    if(d < best) best = d;
  }
  return dedans(PER, p[0], p[1]) ? best : -best;
}

/* ---------- ce que le programme impose --------------------------------------
   La salle de sport double ne se coupe pas : le règlement lui donne ses deux
   cotes, 28 × 32 m, et sept mètres libres sous structure. Elle fait donc un
   CORPS À ELLE, au rez, et sa surface sort du partage avant qu'il commence.
   La répartir au prorata comme le reste l'aurait coupée en deux. */
function corpsImpose(iRez){
  if(iRez < 0) return null;
  var out = null;
  onFloor(iRez).forEach(function(b){
    var p = PMAP[b.key], it = ITEMBYKEY[b.key];
    if(!p || !p.solid || !it || !it.w || !it.h) return;
    /* Les cotes viennent du programme et de nulle part ailleurs. */
    out = { key:b.key, n:p.n, f:p.f, w:Math.max(it.w, it.h), d:Math.min(it.w, it.h),
            fix:1, aire:areaOf(b) };
  });
  return out;
}

/* ---------- la composition ---------------------------------------------------
   Chaque parti rend une liste de CORPS : un poids, une profondeur, un angle
   relatif au cadre, une position dans le cadre, et jusqu'à quel niveau il
   monte. Les cotes viennent après, du programme. */
function figure(parti, r, C, N, par){
  var nMax = N.length;
  var prof = par.prof;
  var nb = par.nb > 0 ? par.nb : 0;
  var corps = [];
  function C1(o){
    corps.push({ poids: o.poids == null ? 1 : o.poids,
                 prof: o.prof || prof, ang: o.ang || 0,
                 u: o.u || 0, v: o.v || 0, haut: o.haut == null ? nMax : o.haut,
                 grad: o.grad || 0, libre: o.libre || 0 });
  }
  var i, n;
  if(parti === "compact"){
    C1({ prof: Math.min(prof * 2.4, 46), haut: nMax });
  } else if(parti === "barre"){
    C1({ prof: prof, haut: nMax });
  } else if(parti === "barres"){
    n = nb || Math.round(entre(r, 2, 4));
    for(i = 0; i < n; i++)
      C1({ poids: i === 0 ? 1.35 : 1, prof: prof, v: i,
           haut: Math.max(1, nMax - (i > 0 ? Math.round(entre(r, 0, 1.6)) : 0)) });
  } else if(parti === "L"){
    C1({ poids:1.25, prof: prof, u:0, v:0, ang:0, haut:nMax });
    C1({ poids:.85, prof: prof, u:1, v:1, ang:Math.PI / 2,
         haut: Math.max(1, nMax - 1) });
  } else if(parti === "U"){
    C1({ poids:1.2, prof: prof, u:0, v:0, ang:0, haut:nMax });
    C1({ poids:.8, prof: prof, u:-1, v:1, ang:Math.PI / 2, haut:Math.max(1, nMax - 1) });
    C1({ poids:.8, prof: prof, u:1, v:1, ang:Math.PI / 2, haut:Math.max(1, nMax - 1) });
  } else if(parti === "cour"){
    C1({ poids:1, prof: prof * .85, u:0, v:-1, ang:0, haut:nMax });
    C1({ poids:1, prof: prof * .85, u:0, v:1, ang:0, haut:Math.max(1, nMax - 1) });
    C1({ poids:.75, prof: prof * .85, u:-1, v:0, ang:Math.PI / 2, haut:Math.max(1, nMax - 1) });
    C1({ poids:.75, prof: prof * .85, u:1, v:0, ang:Math.PI / 2, haut:Math.max(1, nMax - 1) });
  } else if(parti === "pavillons"){
    n = nb || Math.round(entre(r, 3, 6));
    for(i = 0; i < n; i++)
      C1({ poids: entre(r, .7, 1.3), prof: Math.min(prof, entre(r, 13, 20)),
           u: (i % 2) * 2 - 1, v: Math.floor(i / 2) - (n > 4 ? 1 : .5),
           haut: Math.max(1, Math.min(nMax, Math.round(entre(r, 1, 2.6)))), libre:1 });
  } else if(parti === "hameau"){
    n = nb || Math.round(entre(r, 3, 5));
    for(i = 0; i < n; i++)
      C1({ poids: entre(r, .6, 1.6), prof: Math.min(prof, entre(r, 12, 22)),
           ang: entre(r, -.5, .5),
           u: entre(r, -1, 1), v: entre(r, -1, 1),
           haut: Math.max(1, Math.min(nMax, Math.round(entre(r, 1, nMax + .4)))), libre:1 });
  } else if(parti === "terrasses"){
    n = nb || (r() < .45 ? 2 : 1);
    for(i = 0; i < n; i++)
      C1({ poids:1, prof: Math.min(prof * 1.5, 30), v: i, haut: nMax,
           grad: Math.max(.15, par.grad) });
  } else if(parti === "peigne"){
    n = nb || Math.round(entre(r, 3, 5));
    C1({ poids:1.1, prof: Math.min(prof, 15), u:0, v:-1, ang:0, haut:nMax });
    for(i = 0; i < n; i++)
      C1({ poids:.7, prof: Math.min(prof, 15), ang:Math.PI / 2,
           u: i - (n - 1) / 2, v: .6, haut: Math.max(1, nMax - 1) });
  } else { /* libre */
    n = nb || Math.round(entre(r, 2, 5));
    for(i = 0; i < n; i++)
      C1({ poids: entre(r, .5, 1.8), prof: Math.min(prof, entre(r, 12, 24)),
           ang: entre(r, -1.2, 1.2), u: entre(r, -1, 1), v: entre(r, -1, 1),
           haut: Math.max(1, Math.min(nMax, Math.round(entre(r, 1, nMax + .4)))), libre:1 });
  }
  return corps;
}

/* ---------- des corps aux volumes -------------------------------------------
   Ici, et seulement ici, le programme donne les cotes. La part d'un corps dans
   un niveau est son poids parmi ceux qui montent jusque-là ; sa surface est
   cette part de la surface BÂTIE du niveau ; sa largeur est cette surface
   divisée par sa profondeur. La forme peut tout changer — la surface, non. */
function cotes(a, prof, gradk){
  var d = Math.min(prof, Math.max(9, Math.sqrt(a) * (gradk || 1)));
  if(a / d > 120) d = Math.min(prof * 1.6, a / 120);
  return { w: d1(Math.max(6, a / d)), d: d1(d) };
}
function monter(corps, N, imp, par, r){
  /* La surface imposée sort du partage avant qu'il commence. */
  var A = N.map(function(n, k){
    return n.A - (imp && k === 0 ? imp.aire : 0);
  });
  corps.forEach(function(c){ c.lv = []; });
  N.forEach(function(n, k){
    var port = corps.filter(function(c){ return c.haut > k; });
    if(!port.length) port = [corps[0]];
    var som = 0;
    port.forEach(function(c){ som += c.poids; });
    port.forEach(function(c){
      var a = Math.max(0, A[k]) * c.poids / som;
      /* Les terrasses retirent l'étage sur celui du dessous : le programme ne
         change pas, la forme descend en gradins. */
      var g = c.grad ? 1 - c.grad * k * .22 : 1;
      var q = cotes(a, c.prof, c.grad ? Math.max(.6, g) : 1);
      c.lv.push({ i:n.i, w:q.w, d:q.d, dx:0, dy:0, a:a });
    });
  });
  /* Le décalage des terrasses : l'étage se retire vers l'arrière, jamais au
     hasard — un gradin qui saute d'un côté puis de l'autre n'est pas un gradin. */
  corps.forEach(function(c){
    if(!c.grad || c.lv.length < 2) return;
    var d0 = c.lv[0].d;
    c.lv.forEach(function(e, k){
      if(k === 0) return;
      e.dy = d1(-(d0 - e.d) / 2);
    });
  });
  return corps;
}

/* ---------- poser la figure sur le site -------------------------------------
   Les corps ont leurs cotes : on les pose dans le cadre selon la figure, puis
   on RÉPARE. Réparer est ce qui distingue un générateur d'un tirage : tant
   qu'un corps sort, touche ou percute, on le ramène vers le cœur du site. */
function poser(corps, C, imp, par, r, atts){
  var vols = [];
  corps.forEach(function(c, k){
    var e0 = c.lv[0] || { w:12, d:12 };
    var ang = C.cap + c.ang;
    /* L'alignement est une préférence : on s'approche de l'attracteur le plus
       proche d'autant que le réglage le demande, sans jamais s'y clouer. */
    var al = alignement(ang, atts);
    ang = ang - al.ecart * par.align * entre(r, .6, 1);
    var span = c.ang ? e0.d : e0.w;
    var ecar = c.ang ? e0.w : e0.d;
    var u = C.cu + c.u * (C.L / 2 - span / 2) * entre(r, .5, .92);
    var v = C.cv + c.v * (ecar + par.dmin) * (c.libre ? entre(r, .7, 1.3) : 1);
    if(c.libre){
      u = C.cu + c.u * (C.L / 2) * entre(r, .35, .85);
      v = C.cv + c.v * (C.P / 2) * entre(r, .35, .85);
    }
    var p = versSite(C, u, v);
    vols.push({ id:"v" + (k + 1), x:d1(p.x), y:d1(p.y), a:ang, lv:c.lv,
                fix:0, prof:c.prof, grad:c.grad });
  });
  if(imp){
    /* Le corps imposé cherche sa place comme les autres, mais ses cotes ne
       bougent pas d'un centimètre. */
    var p2 = versSite(C, C.cu + entre(r, -.35, .35) * C.L, C.cv + entre(r, -.35, .35) * C.P);
    vols.push({ id:"vsport", x:d1(p2.x), y:d1(p2.y),
                a: C.cap + (r() < .5 ? 0 : Math.PI / 2),
                lv:[{ i:imp.i, w:imp.w, d:imp.d, dx:0, dy:0, a:imp.aire }],
                fix:1, key:imp.key, prof:imp.d, grad:0 });
  }
  reparer(vols, par);
  return vols;
}

/* Ramener ce qui dépasse. Vingt-cinq passes suffisent : au-delà, c'est que la
   figure ne tient pas sur ce site, et le générateur doit la jeter plutôt que
   la tordre. */
function reparer(vols, par){
  var OB = obstacles(), pas, i, j;
  var B = bbox(PER);
  /* On vise un peu PLUS que la distance exigée. Viser juste laissait un reste
     de dix centimètres à chaque passe, et le contrôle annonçait « 5,91 m où
     l'AEAI en demande 6 » sur toutes les compositions à la fois. */
  var cible = par.dmin + .35;
  for(pas = 0; pas < 60; pas++){
    var bouge = 0;
    for(i = 0; i < vols.length; i++){
      var v = vols[i], rc = rectSol(v), dx = 0, dy = 0;
      var m = margeAu(PER, rc) - RULES.dist.retrait;
      if(m < 0){
        var k = Math.min(3, -m) * .55;
        var lx = B.cx - v.x, ly = B.cy - v.y, l = Math.hypot(lx, ly) || 1;
        dx += lx / l * k; dy += ly / l * k;
      }
      for(j = 0; j < vols.length; j++){
        if(j === i) continue;
        var o = rectSol(vols[j]);
        var e = ecart(rc, o);
        if(e < cible){
          var ox = v.x - vols[j].x, oy = v.y - vols[j].y, ol = Math.hypot(ox, oy) || 1;
          var push = Math.min(3, (cible - e)) * .5;
          dx += ox / ol * push; dy += oy / ol * push;
        }
      }
      for(j = 0; j < OB.length; j++){
        var eb = ecartPoly(rc, OB[j]);
        if(eb < cible){
          var c2 = centre(OB[j]);
          var bx = v.x - c2[0], by = v.y - c2[1], bl = Math.hypot(bx, by) || 1;
          var pb = Math.min(3, (cible - eb)) * .6;
          dx += bx / bl * pb; dy += by / bl * pb;
        }
      }
      if(Math.abs(dx) + Math.abs(dy) > .02){
        v.x = d1(v.x + dx); v.y = d1(v.y + dy); bouge++;
      }
    }
    if(!bouge) break;
  }
}
function centre(P){
  var x = 0, y = 0;
  P.forEach(function(p){ x += p[0]; y += p[1]; });
  return [x / P.length, y / P.length];
}
/* L'EMPRISE AU SOL : le plus bas étage hors sol. Prendre `lv[0]` aurait pris le
   sous-sol dès qu'on en creuse un, et tout le contrôle aurait porté sur une
   emprise que personne ne voit. */
function rectSol(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i < e.i) e = x;
  });
  if(!e) e = v.lv[0];
  return { x:v.x + (e.dx || 0), y:v.y + (e.dy || 0), w:e.w, d:e.d, a:v.a };
}

/* ---------- noter -----------------------------------------------------------
   Les écarts coûtent, les relations rapportent. Une note n'est pas un verdict :
   le contrôle, lui, dira ce qui ne va pas, et l'utilisateur gardera ce qu'il
   veut. Elle sert seulement à choisir, parmi trente compositions, celle qui
   demande le moins de rattrapage. */
function noter(vols, par, atts){
  var OB = obstacles(), p = 0, i, j;
  for(i = 0; i < vols.length; i++){
    var v = vols[i], rc = rectSol(v);
    var m = margeAu(PER, rc);
    if(m < 0) p += 400 + (-m) * 40;                       /* hors parcelle */
    else if(m < RULES.dist.retrait) p += (RULES.dist.retrait - m) * 22;
    for(j = i + 1; j < vols.length; j++){
      var e = ecart(rc, rectSol(vols[j]));
      if(e < 0) p += 500 + (-e) * 30;                     /* deux corps se percutent */
      else if(e < par.dmin) p += (par.dmin - e) * 30;
      else if(e > 55) p += (e - 55) * .6;                 /* éparpillé sans raison */
    }
    for(j = 0; j < OB.length; j++){
      var eb = ecartPoly(rc, OB[j]);
      if(eb < 0) p += 600;
      else if(eb < par.dmin) p += (par.dmin - eb) * 28;
    }
    /* Proportions : une lame de six mètres de profondeur n'est pas une école,
       un bloc de quarante non plus. */
    var el = Math.max(rc.w, rc.d) / Math.max(1, Math.min(rc.w, rc.d));
    if(el > 9) p += (el - 9) * 14;
    if(rc.d > par.prof && !v.fix) p += (rc.d - par.prof) * 6;
    if(Math.min(rc.w, rc.d) < 9 && !v.fix) p += (9 - Math.min(rc.w, rc.d)) * 18;
    /* Le terrain : un corps posé en travers de la pente demande un terrassement
       qu'on ne veut pas ignorer. */
    var as = assise(rc);
    p += Math.max(0, as.d - 1.6) * 16;
    /* Alignement : préférence, donc bonus — jamais une condition. */
    var al = alignement(v.a, atts);
    p -= (1 - Math.min(1, al.ecart / .35)) * al.att.w * 26 * par.align;
    /* Orientation : une longue façade au sud vaut mieux qu'au nord. */
    var sud = Math.abs(Math.cos(v.a));
    p -= sud * 10;
    /* Un sous-sol ne se creuse pas n'importe où : la nappe est à 462,25 m et le
       règlement veut trois mètres de couverture. Le générateur cherche donc le
       haut du site pour ce qu'il enterre, au lieu de laisser le contrôle
       répéter le même conflit à chaque tirage. */
    var creuse = 0;
    v.lv.forEach(function(e){ if(lvlOf(e.i) < 0) creuse = 1; });
    if(creuse){
      var manque = (NAPPE + RULES.dist.couverture) - as.z;
      if(manque > 0) p += manque * 90;
    }
  }
  /* Compacité : le réglage dit si l'on cherche un bloc ou un éclat. */
  var cvx = emprise(vols);
  p += (par.compact * 2 - 1) * (cvx / 400);
  return p;
}
function emprise(vols){
  var a = 0;
  vols.forEach(function(v){ var r = rectSol(v); a += r.w * r.d; });
  return a;
}

/* ---------- le tirage massing ------------------------------------------------
   Trente compositions, la meilleure gagne. En « Auto », chaque parti a sa
   chance : c'est le site et le programme du jour qui décident, pas nous. */
export function genMass(graine){
  var g = graine == null ? MASS.graine : graine;
  var r = alea(g);
  var par = MASS.par;
  var N = horsSol();
  if(!N.length) return [];
  var cap = par.cap == null ? axePer() : par.cap;
  var atts = attracteurs();
  var imp = corpsImpose(N[0].i);
  if(imp) imp.i = N[0].i;
  var partis = MASS.parti === "auto"
    ? PARTIS_LIBRES : [MASS.parti];
  var best = null, bp = Infinity, t;
  for(t = 0; t < 30; t++){
    var pid = partis[t % partis.length];
    var C = cadre(cap + entre(r, -1, 1) * (1 - par.regul) * .28);
    var corps = figure(pid, r, C, N, par);
    monter(corps, N, imp, par, r);
    var vols = poser(corps, C, imp, par, r, atts);
    enterrer(vols, par);
    var p = noter(vols, par, atts);
    if(p < bp){ bp = p; best = vols; best.parti = pid; }
  }
  return best || [];
}
var PARTIS_LIBRES = ["compact","barre","barres","L","U","cour","pavillons",
                     "hameau","terrasses","peigne","libre"];

/* Les sous-sols vont sous le plus grand corps : un sous-sol n'a ni façade ni
   silhouette, il n'a qu'une emprise — et le règlement ne l'admet qu'au tiers
   est du site, là où la couverture sur la nappe suffit. Le contrôle le dira. */
function enterrer(vols, par){
  var S = sousSol();
  if(!S.length || !vols.length) return;
  /* Sous le corps le PLUS HAUT du site, pas le plus grand : le terrain monte
     de 463 m à l'ouest à 467 m à l'est, et trois mètres de couverture sur la
     nappe ne se trouvent qu'au tiers est. Creuser sous le plus grand, où qu'il
     soit, faisait que tous les tirages annonçaient le même conflit. */
  var big = vols[0], bz = assise(rectSol(vols[0])).z, i;
  for(i = 1; i < vols.length; i++){
    var z = assise(rectSol(vols[i])).z;
    if(z > bz + .15 || (Math.abs(z - bz) <= .15
        && rectSol(vols[i]).w * rectSol(vols[i]).d > rectSol(big).w * rectSol(big).d)){
      bz = Math.max(bz, z); big = vols[i];
    }
  }
  S.forEach(function(n){
    var q = cotes(n.A, Math.max(par.prof, rectSol(big).d));
    big.lv.unshift({ i:n.i, w:q.w, d:q.d, dx:0, dy:0, a:n.A });
  });
  big.lv.sort(function(a, b){ return a.i - b.i; });
}

export { cadre, rectSol, obstacles };
