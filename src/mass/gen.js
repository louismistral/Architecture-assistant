/* ============================================================================
   LE GÉNÉRATEUR DE VOLUMÉTRIE

   « Shuffle massing » ne touche PAS au programme. Mêmes postes, mêmes
   surfaces, mêmes niveaux, même répartition par niveau : ce que le mixer a
   décidé est une donnée d'entrée, pas une variable. Ce qui change est la
   SOLUTION ARCHITECTURALE — combien de corps, où, dans quelle direction, à
   quelle profondeur, jusqu'à quel étage, accolés, séparés ou reliés.

   Et ce n'est pas un tirage, ni une note. Le générateur :

     1. GÉNÈRE des compositions — un parti, une figure, une profondeur, une
        orientation, la salle de sport à part ou accolée, des passerelles ou
        non ;
     2. VALIDE les contraintes dures (`juge.js — dures()`) et jette toute
        variante qui en enfreint une ;
     3. COMPARE les variantes valides, qualitativement : on écarte celles
        qu'une autre bat sur les priorités fortes, puis, entre égales, sur les
        préférences ;
     4. tire un PARTI parmi ce qui reste, puis une variante : la diversité est
        voulue, une priorité oriente la recherche sans imposer une forme.

   Aucun critère n'est converti en points, ni affiché ni caché.
   ========================================================================= */
import { ITEMBYKEY } from "../core/model.js";
import { PER, SITE } from "../data/site.js";
import { DOC } from "../data/doctrine.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { areaOf, lvlOf, onFloor } from "../mix/floors.js";
import {
  alignement, assise, attracteurs, axePer, bbox, bordDist, dedans, airePosable,
  ecart, ecartAngle, ecartPoly, margeAu, tientA, visAVis
} from "./geom.js";
import { MASS, auModule, horsSol, pontRect, profBornes, profFacade, secondTemps,
  sousSol, volEtage, volRect } from "./model.js";
import { angleSoleilVue, choisir, courUtile, dures, ensembles, oublier, qualites }
  from "./juge.js";

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

/* ---------- ce qui ne se règle plus -----------------------------------------
   Quatre curseurs commandaient ici la force d'alignement, la compacité, la
   régularité et l'intensité des terrasses. Ils réglaient la MÊME chose que le
   parti — un peigne est fragmenté, un bloc compact l'est par définition —, et
   l'on n'a jamais su quoi répondre à « compacité 0,35 ». Ce sont donc des
   constantes de composition, écrites là où elles agissent :

     JEU    le jeu d'orientation autour de l'axe du périmètre — sans lui, les
            trente compositions d'un même parti seraient la même ;
     GRAD   le retrait d'un gradin sur celui du dessous, pour le seul parti
            « terrasses », qui est le seul à en vouloir.

   La compacité, elle, a simplement disparu : sa valeur neutre ne changeait
   rien, et le parti dit déjà si l'on cherche un bloc ou un éclat. */
var JEU = .11, GRAD = .4;
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
/* Les emprises existantes ne changent jamais : on les filtre une fois, et l'on
   garde pour chacune son CERCLE ENGLOBANT. Le test d'admissibilité les
   parcourait toutes à chaque position essayée — vingt-neuf polygones, quatre
   coins et autant d'intersections de segments — alors qu'une comparaison de
   deux rayons écarte les vingt-huit qui sont à cent mètres. */
var OBS = null;
function obstacles(){
  if(OBS) return OBS;
  OBS = (SITE.bat || []).filter(function(P){
    return P.some(function(p){ return margePoint(p) > -35; });
  }).map(function(P){
    var c = centre(P), r = 0;
    P.forEach(function(p){ r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1])); });
    return { P:P, cx:c[0], cy:c[1], r:r };
  });
  return OBS;
}
/* Ce qui peut toucher ce rectangle, et rien d'autre. */
export function obstaclesPres(rc, marge){
  var OB = obstacles(), out = [], i;
  var port = Math.hypot(rc.w, rc.d) / 2 + marge;
  for(i = 0; i < OB.length; i++){
    var d = Math.hypot(OB[i].cx - rc.x, OB[i].cy - rc.y);
    if(d <= OB[i].r + port) out.push(OB[i].P);
  }
  return out;
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
           grad: GRAD });
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
   un niveau est son poids parmi ceux qui montent jusque-là ; sa surface UTILE
   est cette part de la surface bâtie du niveau ; sa largeur est cette surface
   divisée par sa profondeur. Les deux cotes sont au MODULE, et la profondeur
   reste entre les bornes de la doctrine (`profBornes()`) — `hi` la plafonne en
   plus pour un corps d'école, dont toutes les classes doivent avoir leur façade.
   Les murs s'ajoutent autour (`volRect`) : ils ne prennent rien au programme. */
function cotes(a, prof, hi){
  var B = profBornes(), top = Math.max(B.lo, Math.min(hi || B.hi, B.hi));
  var d = Math.max(B.lo, Math.min(prof, top, Math.sqrt(a)));
  if(a / d > 120) d = Math.min(top, a / 120);
  d = auModule(d);
  return { w: auModule(a / d), d: d };
}
function monter(corps, N, imp, hi){
  /* La surface imposée sort du partage avant qu'il commence. Rien ne se pose
     sur la salle de sport : c'est une contrainte dure. */
  var A = N.map(function(n, k){
    return n.A - (imp && k === 0 ? imp.aire : 0);
  });
  var k, i, B = profBornes();
  corps.forEach(function(c){ c.lv = []; c.aire = []; });

  /* QUI monte. Le parti propose une silhouette, mais le programme a le dernier
     mot : on promeut, du plus gros au plus petit, jusqu'à ce que les porteurs
     d'un niveau pèsent au moins ce que ce niveau demande — sans quoi ils
     seraient plus larges en haut qu'en bas. */
  for(k = 1; k < N.length; k++){
    if(A[k] <= 0 || A[k - 1] <= 0) continue;
    var tot = 0, sur = 0;
    corps.forEach(function(c){
      tot += c.poids;
      if(c.haut > k) sur += c.poids;
    });
    var manque = (A[k] / A[k - 1]) * tot - sur;
    if(manque <= .01) continue;
    corps.filter(function(c){ return c.haut <= k; })
         .sort(function(a2, b2){ return b2.poids - a2.poids; })
         .forEach(function(c){
           if(manque <= .01) return;
           c.haut = k + 1;
           manque -= c.poids;
         });
  }

  /* Le partage, DU BAS VERS LE HAUT : en montant, un corps ne dépasse pas
     l'aire qu'il a au niveau du dessous, et ce qui ne tient pas repasse aux
     corps qui ont encore de la marge. Le surplus qui reste est un vrai
     porte-à-faux : permis, et il se voit. */
  for(k = 0; k < N.length; k++){
    var port = corps.filter(function(c){ return c.haut > k; });
    if(!port.length) port = [corps[0]];
    var som = 0;
    port.forEach(function(c){ som += c.poids; });
    port.forEach(function(c){ c.aire[k] = Math.max(0, A[k]) * c.poids / som; });
    if(k === 0) continue;
    var pass;
    for(pass = 0; pass < 4; pass++){
      var surplus = 0, marge = 0;
      port.forEach(function(c){
        var pla = c.aire[k - 1];
        if(pla == null) return;
        if(c.aire[k] > pla){ surplus += c.aire[k] - pla; c.aire[k] = pla; }
        else marge += pla - c.aire[k];
      });
      if(surplus < .5) break;
      if(marge < .5){
        port.forEach(function(c){ c.aire[k] += surplus / port.length; });
        break;
      }
      port.forEach(function(c){
        var pla = c.aire[k - 1];
        if(pla == null) return;
        var m = pla - c.aire[k];
        if(m > 0) c.aire[k] += surplus * (m / marge);
      });
    }
  }

  /* Les cotes, du bas vers le haut : le rez fixe la PROFONDEUR du corps, la
     largeur suit la surface. Un étage trop court pour la largeur minimale
     s'amincit plutôt que de devenir une lame. */
  for(k = 0; k < N.length; k++){
    for(i = 0; i < corps.length; i++){
      var c = corps[i];
      if(c.aire[k] == null) continue;
      var a = c.aire[k], q, d;
      if(!c.lv.length){
        q = cotes(a, c.prof, hi);
        c.d0 = q.d;
      } else if(c.grad){
        /* Une terrasse se retire dans les DEUX sens. */
        var bas = c.lv[c.lv.length - 1];
        var g = Math.sqrt(Math.max(.15, a / Math.max(1, bas.w * bas.d)));
        d = auModule(Math.max(B.lo, bas.d * g));
        q = { w: auModule(a / d), d: d };
      } else {
        d = c.d0;
        if(a / d < DOC.largeurMin) d = auModule(Math.max(B.lo, a / DOC.largeurMin));
        q = { w: auModule(a / d), d: d };
      }
      c.lv.push({ i:N[k].i, w:q.w, d:q.d, dx:0, dy:0, a:a });
    }
  }
  corps.forEach(function(c){
    if(!c.grad || c.lv.length < 2) return;
    var d0 = c.lv[0].d;
    c.lv.forEach(function(e, kk){ if(kk) e.dy = d1(-(d0 - e.d) / 2); });
  });
  return corps;
}

/* ---------- poser la figure sur le site -------------------------------------
   Les corps ont leurs cotes : on les pose dans le cadre selon la figure, puis
   on RÉPARE. Dans les partis libres, CHAQUE corps choisit son orientation — se
   ranger sur le site, se tourner vers le soleil et la vue, ou garder l'angle
   du parti : aucune orientation commune n'est imposée. */
function poser(corps, C, imp, r, atts){
  var vols = [];
  if(imp) vols.push(ancrer(imp, C, r));
  corps.forEach(function(c, k){
    var e0 = c.lv[0] || { w:12, d:12 };
    var span = c.ang ? e0.d : e0.w;
    var ecar = c.ang ? e0.w : e0.d;
    var u = C.cu + c.u * (C.L / 2 - span / 2) * entre(r, .5, .92);
    var v = C.cv + c.v * (ecar + DOC.distMin) * (c.libre ? entre(r, .7, 1.3) : 1);
    if(c.libre){
      u = C.cu + c.u * (C.L / 2) * entre(r, .35, .85);
      v = C.cv + c.v * (C.P / 2) * entre(r, .35, .85);
    }
    var p = versSite(C, u, v), ang = C.cap + c.ang;
    if(c.libre){
      var m = r();
      if(m < .35){
        var al = alignement(ang, atts);
        ang -= ecartAngle(ang, al.att.a);
      } else if(m < .7) ang = angleSoleilVue(p.x, p.y) + entre(r, -.1, .1);
    }
    vols.push({ id:"v" + (k + 1), x:d1(p.x), y:d1(p.y), a:ang, lv:c.lv,
                fix:0, prof:c.prof, grad:c.grad });
  });
  reparer(vols);
  return vols;
}

/* ---------- la salle de sport ------------------------------------------------
   Ses cotes ne bougent pas d'un centimètre et rien ne se pose dessus. On la
   pose d'abord sur le BAS du terrain — sept mètres libres se logent d'autant
   mieux qu'on part bas —, puis, dans une partie des variantes, on l'ACCOLE au
   corps principal : elle fait alors partie du bâtiment. Ni première, ni à part
   par principe. */
function ancrer(imp, C, r){
  var lvi = [{ i:imp.i, w:imp.w, d:imp.d, dx:0, dy:0, a:imp.aire, keys:[imp.key] }];
  var best = null, bz = Infinity, t;
  for(t = 0; t < 8; t++){
    var u = C.cu + entre(r, -.42, .42) * C.L, v = C.cv + entre(r, -.42, .42) * C.P;
    var pp = versSite(C, u, v);
    var P = { x:d1(pp.x), y:d1(pp.y), a:C.cap + (r() < .5 ? 0 : Math.PI / 2) };
    var rc = volRect(P, lvi[0]);
    var z = assise(rc).z + (margeAu(PER, rc) >= RULES.dist.retrait ? 0 : 100);
    if(z < bz){ bz = z; best = P; }
  }
  return { id:"vsport", x:best.x, y:best.y, a:best.a, lv:lvi,
           fix:1, ancre:1, key:imp.key, prof:imp.d, grad:0 };
}
function accoler(vols, r){
  var sp = null, E = [];
  vols.forEach(function(v){ if(v.fix) sp = v; else if(!v.ph) E.push(v); });
  if(!sp) return false;
  /* Au corps principal d'abord, puis aux autres, du plus grand au plus petit. */
  E.sort(function(a, b){ return rectSol(b).w * rectSol(b).d - rectSol(a).w * rectSol(a).d; });
  for(var n = 0; n < E.length; n++) if(accolerA(sp, E[n], vols, r)) return true;
  return false;
}
/* UN SEUL BÂTIMENT. Dans une partie des variantes, les ailes d'un parti à
   plusieurs corps s'accolent au corps principal au lieu de s'en tenir à six
   mètres : un L, un T, un U d'un seul tenant. Même mécanique que la salle de
   sport intégrée. */
var JOIGNABLES = ["barres", "L", "U", "cour", "peigne", "terrasses"];
function joindre(vols, r){
  var E = vols.filter(function(v){ return !v.fix && !v.ph; });
  E.sort(function(a, b){ return rectSol(b).w * rectSol(b).d - rectSol(a).w * rectSol(a).d; });
  for(var k = 1; k < E.length; k++) accolerA(E[k], E[0], vols, r);
}
function accolerA(sp, M, vols, r){
  if(!sp || !M) return false;
  var rm = rectSol(M), rs = rectSol(sp), cand = [], s, t, q;
  [0, Math.PI / 2].forEach(function(rot){
    var sx = rot ? rs.d : rs.w, sy = rot ? rs.w : rs.d;
    for(s = -1; s <= 1; s += 2){
      for(t = -1; t <= 1; t++){
        cand.push({ rot:rot, u:t * (rm.w - sx) / 2, v:s * (rm.d + sy) / 2 });
        cand.push({ rot:rot, u:s * (rm.w + sx) / 2, v:t * (rm.d - sy) / 2 });
      }
    }
  });
  cand.forEach(function(c){ c.o = r(); });
  cand.sort(function(a, b){ return a.o - b.o; });
  var av = { x:sp.x, y:sp.y, a:sp.a };
  sp.joint = M.id;
  var c = Math.cos(M.a), sn = Math.sin(M.a);
  for(q = 0; q < cand.length; q++){
    var k = cand[q];
    sp.x = d1(rm.x + k.u * c - k.v * sn); sp.y = d1(rm.y + k.u * sn + k.v * c);
    sp.a = M.a + k.rot;
    if(admissible(sp, vols) && admissible(M, vols)) return true;
  }
  sp.x = av.x; sp.y = av.y; sp.a = av.a;
  delete sp.joint;
  return false;
}

/* ---------- les passerelles --------------------------------------------------
   Elles relient deux corps d'école sans les fusionner. Jamais systématiques :
   seulement dans une partie des variantes, et seulement entre ensembles qui ne
   sont pas déjà reliés — la plus courte d'abord, jusqu'à ce que l'école tienne
   d'un seul tenant ou que rien d'autre ne tienne. Une passerelle reste dans le
   périmètre et ne traverse aucun autre corps. */
export function relier(vols){
  var E = vols.filter(function(v){ return !v.ph && !v.fix; });
  var cand = [], ponts = [];
  E.forEach(function(A, i){
    E.forEach(function(B, j){
      if(j <= i || lies(A, B)) return;
      var i1 = -1;
      A.lv.forEach(function(e){
        if(lvlOf(e.i) >= 1 && volEtage(B, e.i) && (i1 < 0 || e.i < i1)) i1 = e.i;
      });
      if(i1 < 0) return;
      var p = { a:A.id, b:B.id, i:i1 }, rc = pontRect(p, vols);
      if(!rc || rc.long > DOC.passMax || rc.long < DOC.distMin - .01) return;
      if(margeAu(PER, rc) < RULES.dist.retrait - .01) return;
      var bute = vols.some(function(o){
        return o !== A && o !== B && ecart(rc, rectSol(o)) < .5; });
      if(!bute) cand.push({ p:p, l:rc.long });
    });
  });
  cand.sort(function(a, b){ return a.l - b.l; });
  cand.forEach(function(c){
    if(ensembles(E, ponts) <= 1) return;
    var n0 = ensembles(E, ponts);
    ponts.push(c.p);
    if(ensembles(E, ponts) === n0) ponts.pop();
  });
  return ponts;
}

/* ---------- les ouvrages du second temps -------------------------------------
   La piscine (500 m²) et le local CAD (400 m²) sont indépendants de l'école et
   bâtis plus tard (art. 2.2), mais ils occupent le terrain : on les pose APRÈS
   l'école, dans les marges du site, aux mêmes distances que tout le reste, et
   sans entamer la cour minimale. Réunis ou séparés : « auto » laisse le
   générateur essayer les deux ; le rail peut l'imposer. Quand rien ne tient,
   l'ouvrage n'est pas posé et le contrôle le dit. */
function poserSecond(vols, r){
  if(MASS.second === "non") return;
  var S = secondTemps();
  if(!S.length) return;
  var modes = MASS.second === "auto" ? (r() < .5 ? ["un", "sep"] : ["sep", "un"])
                                     : [MASS.second];
  var i;
  for(i = 0; i < modes.length; i++){
    retirerSecond(vols);
    var lots = modes[i] === "un" ? [S] : S.map(function(x){ return [x]; });
    var tous = true;
    lots.forEach(function(lot, k){
      var a = 0, h = 0, keys = [], noms = [];
      lot.forEach(function(x){
        a += x.a; h = Math.max(h, x.h); keys.push(x.key); noms.push(x.n);
      });
      var q = cotes(a, 24);
      var v = { id:"ph" + (k + 1), x:0, y:0, a:axePer(),
                lv:[{ i:lot[0].i, w:q.w, d:q.d, dx:0, dy:0, a:a, h:h, keys:keys }],
                fix:0, ph:2, nom: noms.join(" et "), prof:q.d, grad:0 };
      vols.push(v);
      if(!auBord(v, vols)){ vols.pop(); tous = false; }
    });
    if(tous) return;
  }
}
function retirerSecond(vols){
  for(var i = vols.length - 1; i >= 0; i--) if(vols[i].ph) vols.splice(i, 1);
}
/* La position admissible la plus proche du BORD, qui laisse sa cour à l'école. */
function auBord(v, vols){
  var B = bbox(PER), demi = Math.min(v.lv[0].w, v.lv[0].d) / 2;
  var cand = [], cx, cy, k, essais = 0;
  for(cx = B.x0; cx <= B.x1; cx += 2){
    for(cy = B.y0; cy <= B.y1; cy += 2){
      var d = bordDist(PER, cx, cy);
      if(d < RULES.dist.retrait + demi * .3) continue;
      cand.push([cx, cy, d]);
    }
  }
  cand.sort(function(p, q2){ return p[2] - q2[2]; });
  var angles = [v.a, v.a + Math.PI / 2, v.a + Math.PI / 4, v.a - Math.PI / 4];
  for(k = 0; k < angles.length; k++){
    for(var i = 0; i < cand.length; i++){
      if(!admissible(v, vols, cand[i][0], cand[i][1], angles[k])) continue;
      v.x = d1(cand[i][0]); v.y = d1(cand[i][1]); v.a = angles[k];
      if(courUtile(vols).a >= DOC.courMin) return true;
      if(++essais > 30) return false;
    }
  }
  return false;
}

/* ---------- la règle d'implantation, en UN seul endroit ----------------------
   Ni le générateur ni le glisser à la souris ne posent un corps qui ne tient
   pas : tous les étages dans le périmètre, recul du PACom compris ; la distance
   minimale entre bâtiments à TOUS les étages hors sol — ce qui interdit aussi
   de surmonter la salle de sport ; rien sur l'existant ni trop près de lui.
   Deux corps ACCOLÉS (`joint`) font un seul bâtiment : ils se touchent sans se
   recouvrir. */
export function lies(a, b){ return a.joint === b.id || b.joint === a.id; }
export function rectsHors(v, P){
  var Q = P || v, out = [];
  v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) out.push(volRect(Q, e)); });
  if(!out.length && v.lv[0]) out.push(volRect(Q, v.lv[0]));
  return out;
}
/* La plus petite distance entre deux volumes, étage par étage. Au-delà de
   `seuil`, on ne mesure pas : deux cercles englobants suffisent à le savoir. */
export function ecartVols(v, o, P, seuil){
  var A = rectsHors(v, P), Bo = rectsHors(o), m = Infinity, s = seuil == null ? Infinity : seuil;
  A.forEach(function(a){
    Bo.forEach(function(b){
      var bas = Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(a.w, a.d) / 2
              - Math.hypot(b.w, b.d) / 2;
      if(bas >= s) return;
      var e = ecart(a, b);
      if(e < m) m = e;
    });
  });
  return m;
}
export function admissible(v, vols, x, y, a){
  var P = { x: x == null ? v.x : x, y: y == null ? v.y : y, a: a == null ? v.a : a };
  var i, j;
  for(i = 0; i < v.lv.length; i++)
    if(!tientA(PER, volRect(P, v.lv[i]), RULES.dist.retrait - .01)) return false;
  for(i = 0; i < vols.length; i++){
    var o = vols[i];
    if(o === v) continue;
    var m = lies(v, o) ? 0 : DOC.distMin;
    if(ecartVols(v, o, P, m) < m - .01) return false;
  }
  var H = rectsHors(v, P);
  for(i = 0; i < H.length; i++){
    var OB = obstaclesPres(H[i], DOC.distMin);
    for(j = 0; j < OB.length; j++)
      if(ecartPoly(H[i], OB[j]) < DOC.distMin - .01) return false;
  }
  return true;
}
export function toutDedans(vols){
  for(var i = 0; i < vols.length; i++) if(!admissible(vols[i], vols)) return false;
  return true;
}

/* Ramener ce qui dépasse. La distance minimale se tient pleine poussée ; le
   JOUR — `DOC.ombreK` fois la hauteur du plus haut — d'une poussée douce :
   c'est une priorité, pas une contrainte, et elle ne doit pas faire sortir un
   corps de la parcelle pour gagner deux mètres. */
function reparer(vols){
  var pas, i, j, B = bbox(PER);
  var cible = DOC.distMin + .35;
  var N = horsSol(), HN = {};
  N.forEach(function(n){ HN[n.i] = n.h; });
  var HV = vols.map(function(v){
    var h = 0;
    v.lv.forEach(function(e){ if(HN[e.i] !== undefined) h += HN[e.i]; });
    return h;
  });
  var DOUX = .45, MARGE_JOUR = .4;
  for(pas = 0; pas < 60; pas++){
    var bouge = 0;
    for(i = 0; i < vols.length; i++){
      var v = vols[i], rc = rectSol(v), dx = 0, dy = 0;
      var pire = Infinity;
      v.lv.forEach(function(e){ pire = Math.min(pire, margeAu(PER, volRect(v, e))); });
      var m = pire - RULES.dist.retrait - .3;
      if(m < 0){
        var k = Math.min(3, -m) * .55;
        var lx = B.cx - v.x, ly = B.cy - v.y, l = Math.hypot(lx, ly) || 1;
        dx += lx / l * k; dy += ly / l * k;
      }
      for(j = 0; j < vols.length; j++){
        if(j === i || lies(v, vols[j])) continue;
        var o = rectSol(vols[j]);
        var e = ecart(rc, o);
        var jour = visAVis(rc, o) > 8 ? Math.max(HV[i], HV[j]) * DOC.ombreK : 0;
        var vise = Math.max(cible, Math.min(jour + MARGE_JOUR, cible + 14));
        if(e < vise){
          var ox = v.x - vols[j].x, oy = v.y - vols[j].y, ol = Math.hypot(ox, oy) || 1;
          var dur = Math.max(0, Math.min(cible, vise) - e);
          var mou = Math.max(0, vise - Math.max(e, cible));
          var push = Math.min(3, dur * .5 + mou * DOUX * .5);
          dx += ox / ol * push; dy += oy / ol * push;
        }
      }
      var OB = obstaclesPres(rc, cible);
      for(j = 0; j < OB.length; j++){
        var eb = ecartPoly(rc, OB[j]);
        if(eb < cible){
          var c2 = centre(OB[j]);
          var bx = v.x - c2[0], by = v.y - c2[1], bl = Math.hypot(bx, by) || 1;
          var pb = Math.min(3, (cible - eb)) * .6;
          dx += bx / bl * pb; dy += by / bl * pb;
        }
      }
      if(v.ancre){ dx *= .35; dy *= .35; }
      if(Math.abs(dx) + Math.abs(dy) > .02){
        v.x = d1(v.x + dx); v.y = d1(v.y + dy); bouge++;
      }
    }
    if(!bouge) break;
  }
}
/* Le repêchage : la position admissible la plus proche, quart de tour compris. */
function repecher(vols){
  for(var i = 0; i < vols.length; i++) recaler(vols[i], vols);
}
export function recaler(v, vols){
  if(!v || admissible(v, vols)) return false;
  var k, q;
  /* Condition NÉCESSAIRE avant tout calcul : le centre doit être à au moins le
     recul plus la demi-petite-cote du bord — le cercle inscrit. Elle écarte la
     plupart des positions sans rien mesurer. */
  var demi = Infinity;
  rectsHors(v).forEach(function(r){ demi = Math.min(demi, Math.min(r.w, r.d) / 2); });
  var seuil = RULES.dist.retrait + demi - .01;
  var angles = [v.a, v.a + Math.PI / 2, axePer(), axePer() + Math.PI / 2];
  var cand = grilleSite().filter(function(p){ return p[2] >= seuil; }).map(function(p){
    return [p[0], p[1], (p[0] - v.x) * (p[0] - v.x) + (p[1] - v.y) * (p[1] - v.y)];
  });
  cand.sort(function(a, b){ return a[2] - b[2]; });
  for(k = 0; k < angles.length; k++){
    for(q = 0; q < cand.length; q++){
      if(!admissible(v, vols, cand[q][0], cand[q][1], angles[k])) continue;
      v.x = d1(cand[q][0]); v.y = d1(cand[q][1]); v.a = angles[k];
      return true;
    }
  }
  return false;
}
/* Les positions candidates du site, au pas de 3 m, avec leur distance au bord :
   le périmètre ne change jamais, on ne les calcule qu'une fois. */
var GRILLE = null;
function grilleSite(){
  if(GRILLE) return GRILLE;
  var B = bbox(PER), cx, cy;
  GRILLE = [];
  for(cx = B.x0; cx <= B.x1; cx += 3){
    for(cy = B.y0; cy <= B.y1; cy += 3){
      if(dedans(PER, cx, cy)) GRILLE.push([cx, cy, bordDist(PER, cx, cy)]);
    }
  }
  return GRILLE;
}
function centre(P){
  var x = 0, y = 0;
  P.forEach(function(p){ x += p[0]; y += p[1]; });
  return [x / P.length, y / P.length];
}
/* L'EMPRISE AU SOL, murs compris : le plus bas étage hors sol. */
function etageSol(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i < e.i) e = x;
  });
  return e || v.lv[0];
}
function rectSol(v){ return volRect(v, etageSol(v)); }

/* ---------- le tirage massing ------------------------------------------------
   Générer, valider, comparer, choisir — dans cet ordre. En « Auto », chaque
   parti est reconnu ; ceux qui rendent au moins une variante valide reçoivent
   la suite des essais. Quand aucune variante ne tient, la composition la moins
   fautive est rendue marquée `impossible`, et le contrôle dit ce qu'elle
   enfreint et où aller le corriger. */
export function genMass(graine){
  var g = graine == null ? MASS.graine : graine;
  var r = alea(g);
  var N = horsSol();
  if(!N.length) return [];
  oublier();
  var atts = attracteurs();
  var imp = corpsImpose(N[0].i);
  if(imp) imp.i = N[0].i;
  var partis = MASS.parti === "auto" ? PARTIS_LIBRES : [MASS.parti];
  var B = profBornes(), hiE = Math.max(B.lo, Math.min(B.hi, profFacade()));
  var centreSite = bbox(PER);
  var valides = [], rates = [];

  function essai(pid){
    var prof = auModule(entre(r, B.lo, hiE));
    var m = r(), cap;
    if(MASS.par.cap != null) cap = MASS.par.cap;
    else if(m < .4) cap = axePer();
    else if(m < .75) cap = angleSoleilVue(centreSite.cx, centreSite.cy);
    else cap = axePer() + entre(r, -.7, .7);
    var C = cadre(cap + entre(r, -1, 1) * JEU);
    var corps = figure(pid, r, C, N, { prof:prof, nb:MASS.par.nb });
    monter(corps, N, imp, hiE);
    var vols = poser(corps, C, imp, r, atts);
    if(JOIGNABLES.indexOf(pid) >= 0 && r() < .4) joindre(vols, r);
    if(imp && r() < .4) accoler(vols, r);
    enterrer(vols);
    vols.ponts = r() < .5 ? relier(vols) : [];
    vols.parti = pid; vols.prof = prof;
    var d = dures(vols, true).filter(function(x){ return !x.pile; });
    /* Une figure qui ne tient pas dans la parcelle est REPRISE : chaque corps
       fautif va à la position admissible la plus proche, quart de tour
       compris, et le sous-sol suit le terrain de la position finale. */
    if(d.length && /perim|dist|existant/.test(d[0].k)){
      repecher(vols);
      desenterrer(vols); enterrer(vols);
      if(vols.ponts.length) vols.ponts = relier(vols);
      d = dures(vols, true).filter(function(x){ return !x.pile; });
    }
    if(!d.length){ valides.push({ vols:vols, pid:pid, q:qualites(vols) }); return true; }
    rates.push({ vols:vols, pid:pid, k:d[0].k });
    return false;
  }

  var lot = partis, t;
  if(partis.length > 1){
    var ok = {};
    partis.forEach(function(pid){
      for(var k = 0; k < Math.max(1, Math.round(DOC.essaisParti)); k++)
        if(essai(pid)) ok[pid] = 1;
    });
    var l2 = partis.filter(function(p){ return ok[p]; });
    if(l2.length) lot = l2;
  }
  for(t = 0; t < Math.max(1, Math.round(DOC.essais)); t++) essai(lot[t % lot.length]);

  /* Le repêchage coûte un balayage de la parcelle par corps : on ne le paie que
     si aucune variante n'a tenu, et sur quelques-unes seulement. */
  if(!valides.length){
    rates.filter(function(x){ return /perim|dist|existant/.test(x.k); }).slice(0, 5)
      .forEach(function(x){
        repecher(x.vols);
        desenterrer(x.vols); enterrer(x.vols);
        x.vols.ponts = relier(x.vols);
        if(!dures(x.vols, true).filter(function(y){ return !y.pile; }).length)
          valides.push({ vols:x.vols, pid:x.pid, q:qualites(x.vols) });
      });
  }
  if(valides.length){
    var ch = choisir(valides, r);
    ch.vols.valides = valides.length;
    poserSecond(ch.vols, r);
    return ch.vols;
  }
  var repli = null, rn = Infinity;
  rates.slice(0, 12).forEach(function(x){
    var n = dures(x.vols, false).filter(function(y){ return !y.pile; }).length;
    if(n < rn){ rn = n; repli = x.vols; }
  });
  if(repli){
    repli.impossible = 1;
    repli.posable = airePosable(RULES.dist.retrait);
    poserSecond(repli, r);
  }
  return repli || [];
}
var PARTIS_LIBRES = ["compact","barre","barres","L","U","cour","pavillons",
                     "hameau","terrasses","peigne","libre"];

/* Les sous-sols vont sous le corps le PLUS HAUT du site : trois mètres de
   terrain au-dessus de la nappe ne se trouvent qu'au tiers est. Jamais sous la
   salle de sport, ni sous un ouvrage du second temps. */
function desenterrer(vols){
  vols.forEach(function(v){
    v.lv = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; });
  });
}
function enterrer(vols){
  var S = sousSol();
  if(!S.length || !vols.length) return;
  var cand = vols.filter(function(v){ return !v.fix && !v.ph; });
  if(!cand.length) cand = vols;
  var big = cand[0], bz = assise(rectSol(cand[0])).z, i;
  for(i = 1; i < cand.length; i++){
    var z = assise(rectSol(cand[i])).z;
    if(z > bz + .15 || (Math.abs(z - bz) <= .15
        && rectSol(cand[i]).w * rectSol(cand[i]).d > rectSol(big).w * rectSol(big).d)){
      bz = Math.max(bz, z); big = cand[i];
    }
  }
  var e0 = etageSol(big);
  S.forEach(function(n){
    var q = cotes(n.A, e0.d);
    big.lv.unshift({ i:n.i, w:q.w, d:q.d, dx:0, dy:0, a:n.A });
  });
  big.lv.sort(function(a, b){ return a.i - b.i; });
}

/* ---------- ce que les remèdes rejouent --------------------------------------
   Le contrôle propose des gestes (`mass/fix.js`) ; la mécanique reste ici. */
export function ecarter(vols){
  reparer(vols);
  vols.forEach(function(v){ recaler(v, vols); });
  return true;
}
export function replacerSousSol(vols){
  if(!sousSol().length) return false;
  desenterrer(vols);
  enterrer(vols);
  return true;
}
export function poserSecondTemps(vols){
  poserSecond(vols, alea(MASS.graine));
  return true;
}
export function relierCourant(){
  MASS.pont = relier(MASS.vol);
  return MASS.pont.length > 0;
}

export { cadre, rectSol };
