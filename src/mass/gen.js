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
  alignement, assise, attracteurs, axePer, bbox, bordDist, dedans,
  airePosable, ecart, ecartPoly, margeAu
} from "./geom.js";
import { MASS, horsSol, porteAFaux, profMax, profUsuel, sousSol }
  from "./model.js";

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

     ALIGN  l'alignement reste une PRÉFÉRENCE, toujours cherchée, jamais due ;
     JEU    le jeu d'orientation autour de l'axe du périmètre — sans lui, les
            trente compositions d'un même parti seraient la même ;
     GRAD   le retrait d'un gradin sur celui du dessous, pour le seul parti
            « terrasses », qui est le seul à en vouloir.

   La compacité, elle, a simplement disparu : sa valeur neutre ne changeait
   rien, et le parti dit déjà si l'on cherche un bloc ou un éclat. */
var ALIGN = .7, JEU = .11, GRAD = .4;
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
   un niveau est son poids parmi ceux qui montent jusque-là ; sa surface est
   cette part de la surface BÂTIE du niveau ; sa largeur est cette surface
   divisée par sa profondeur. La forme peut tout changer — la surface, non. */
function cotes(a, prof, gradk){
  var d = Math.min(prof, Math.max(9, Math.sqrt(a) * (gradk || 1)));
  if(a / d > 120) d = Math.min(prof * 1.6, a / 120);
  return { w: d1(Math.max(6, a / d)), d: d1(d) };
}
function monter(corps, N, imp, par, r, sur){
  /* La surface imposée sort du partage avant qu'il commence. */
  var A = N.map(function(n, k){
    return n.A - (imp && k === 0 ? imp.aire : 0);
  });
  var k, i;
  corps.forEach(function(c){ c.lv = []; c.aire = []; });

  /* UN ÉTAGE AU-DESSUS DE LA SALLE DE SPORT — c'est ce qui décide s'il y aura
     un porte-à-faux, et c'est une décision d'architecture, pas un effet de
     bord. La salle prend 896 m² du rez sans monter : les autres corps ont donc
     moins d'emprise au sol qu'à l'étage, et à profondeur constante ils y sont
     plus larges. Le débord était STRUCTUREL, on le lisait sur tous les partis
     et sur tous les tirages à la fois.

     Il n'y a qu'une façon honnête de le supprimer : poser l'étage manquant sur
     la salle elle-même. Le programme y gagne l'emprise qui lui manquait, la
     salle garde ses cotes du règlement, et l'étage ne déborde de rien puisqu'il
     tient dans les 28 × 32 m du dessous. Le générateur essaie les deux — avec
     et sans — et `noter()` préfère l'aplomb : le porte-à-faux reste possible,
     il n'est plus la règle. */
  if(imp) imp.sur = [];
  if(imp && sur){
    var pied = imp.w * imp.d;
    for(k = 1; k < N.length; k++){
      var pris = Math.min(pied, Math.max(0, A[k] - A[k - 1]));
      /* Un étage de trente mètres carrés sur une salle de sport n'est pas un
         étage : c'est une superstructure. On s'arrête là. */
      if(pris < 40) break;
      imp.sur.push({ i:N[k].i, a:pris });
      A[k] -= pris;
      pied = pris;
    }
  }

  /* Avant de partager : QUI monte. Le parti propose une silhouette — les
     pavillons bas, l'aile principale haute —, mais le programme a le dernier
     mot. Quand le premier étage demande autant de surface que le rez, il ne
     peut pas tenir sur trois corps quand le rez en compte cinq : les porteurs
     seraient deux fois plus larges en haut qu'en bas, et l'on obtenait un
     porte-à-faux de quinze mètres qui n'était qu'un défaut de répartition. On
     promeut donc, du plus gros au plus petit, jusqu'à ce que les porteurs du
     niveau pèsent au moins ce que ce niveau demande. */
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

  /* Le partage se fait DU BAS VERS LE HAUT, et le rez est la référence : c'est
     lui qui touche le terrain, lui qui ne peut pas déborder. Chaque corps y
     prend sa part de poids ; en montant, il ne peut pas dépasser l'aire qu'il a
     au niveau du dessous — son PLAFOND —, et ce qui ne tient pas repasse aux
     corps qui ont encore de la marge.

     Partager chaque niveau indépendamment donnait vingt, quarante, soixante-dix
     mètres de porte-à-faux qu'aucun parti n'avait demandés : un corps qui porte
     un sixième du rez et un tiers du premier devenait simplement plus large en
     montant.

     Il reste un cas où le débord est RÉEL et non un artefact : quand le mixer
     pose plus de programme à un étage qu'à celui du dessous, et que tous les
     porteurs sont déjà à leur plafond. Le surplus se répartit alors au prorata,
     et le contrôle le chiffre. C'est un porte-à-faux, il est permis, et il se
     voit. */
  for(k = 0; k < N.length; k++){
    var port = corps.filter(function(c){ return c.haut > k; });
    if(!port.length) port = [corps[0]];
    var som = 0;
    port.forEach(function(c){ som += c.poids; });
    port.forEach(function(c, i2){ c.aire[k] = Math.max(0, A[k]) * c.poids / som; });
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

  /* Les cotes, du bas vers le haut : le rez fixe la PROFONDEUR du corps, une
     fois pour toutes, et la largeur suit la surface. À profondeur constante,
     une aire plus petite donne une largeur plus petite — l'étage ne déborde pas
     et ne perd pas un mètre carré. */
  for(k = 0; k < N.length; k++){
    for(i = 0; i < corps.length; i++){
      var c = corps[i];
      /* `aire[k]` fait foi, et non `haut` : quand aucun corps ne monte jusqu'à
         un niveau, le partage le donne au premier — et le sauter ici perdait
         cent soixante mètres carrés de programme sans rien dire. */
      if(c.aire[k] == null) continue;
      var a = c.aire[k], q;
      if(!c.lv.length){
        q = cotes(a, c.prof, 1);
        c.d0 = q.d;
      } else if(c.grad){
        /* Une terrasse se retire dans les DEUX sens : l'étage garde la forme de
           celui du dessous, en plus petit, et se décale vers l'arrière. */
        var bas = c.lv[c.lv.length - 1];
        var g = Math.sqrt(Math.max(.15, a / Math.max(1, bas.w * bas.d)));
        q = { w: d1(bas.w * g), d: d1(bas.d * g) };
      } else {
        q = { w: d1(a / c.d0), d: c.d0 };
      }
      c.lv.push({ i:N[k].i, w:q.w, d:q.d, dx:0, dy:0, a:a });
    }
  }

  /* Le décalage des terrasses : l'étage se retire vers l'arrière, jamais au
     hasard — un gradin qui saute d'un côté puis de l'autre n'est pas un gradin. */
  corps.forEach(function(c){
    if(!c.grad || c.lv.length < 2) return;
    var d0 = c.lv[0].d;
    c.lv.forEach(function(e, kk){
      if(kk === 0) return;
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
    ang = ang - al.ecart * ALIGN * entre(r, .6, 1);
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
    var lvi = [{ i:imp.i, w:imp.w, d:imp.d, dx:0, dy:0, a:imp.aire, key:imp.key }];
    /* Ce qui monte sur la salle tient DANS son emprise : la largeur suit la
       surface, la profondeur ne bouge pas, et l'étage reste centré. */
    (imp.sur || []).forEach(function(x){
      lvi.push({ i:x.i, w:d1(Math.min(imp.w, x.a / imp.d)), d:imp.d,
                 dx:0, dy:0, a:x.a });
    });
    vols.push({ id:"vsport", x:d1(p2.x), y:d1(p2.y),
                a: C.cap + (r() < .5 ? 0 : Math.PI / 2),
                lv:lvi, fix:1, key:imp.key, prof:imp.d, grad:0 });
  }
  reparer(vols, par);
  return vols;
}

/* ---------- la règle d'implantation, en UN seul endroit ----------------------
   Un bâtiment ne sort pas du périmètre du concours. Ce n'est pas un
   avertissement mais une condition : ni le générateur ni le glisser à la souris
   ne posent un corps dehors. Trois conditions, et elles tiennent ensemble :

     — TOUS les étages dedans, recul de 5 m compris. Tous, et pas seulement
       l'emprise au sol : un porte-à-faux qui franchit la limite est du bâti
       hors parcelle ;
     — 6 m entre bâtiments, l'AEAI ;
     — rien sur un bâtiment existant, ni à moins de 6 m de lui.

   Le reste — profondeur, proportions, écart au programme, porte-à-faux — reste
   du domaine de l'avertissement : ce sont des choix de projet, et l'on doit
   pouvoir les prendre. */
export function admissible(v, vols, x, y, a){
  var X = x == null ? v.x : x, Y = y == null ? v.y : y, A = a == null ? v.a : a;
  var ok = true, i, j;
  v.lv.forEach(function(e){
    if(!ok) return;
    var rc = { x:X + (e.dx || 0), y:Y + (e.dy || 0), w:e.w, d:e.d, a:A };
    if(margeAu(PER, rc) < RULES.dist.retrait - .01) ok = false;
  });
  if(!ok) return false;
  var sol = { x:X, y:Y, w:rectSol(v).w, d:rectSol(v).d, a:A };
  for(i = 0; i < vols.length; i++){
    if(vols[i] === v) continue;
    if(ecart(sol, rectSol(vols[i])) < MASS.par.dmin - .01) return false;
  }
  var OB = obstaclesPres(sol, MASS.par.dmin);
  for(j = 0; j < OB.length; j++)
    if(ecartPoly(sol, OB[j]) < MASS.par.dmin - .01) return false;
  return true;
}
/* La composition entière tient-elle ? C'est ce que le générateur doit obtenir
   avant de rendre quoi que ce soit. */
export function toutDedans(vols){
  var i;
  for(i = 0; i < vols.length; i++) if(!admissible(vols[i], vols)) return false;
  return true;
}

/* Ramener ce qui dépasse. Soixante passes : au-delà, c'est que la figure ne
   tient pas sur ce site, et le générateur doit la reprendre autrement plutôt
   que la tordre. */
function reparer(vols, par){
  var pas, i, j;
  var B = bbox(PER);
  /* On vise un peu PLUS que la distance exigée. Viser juste laissait un reste
     de dix centimètres à chaque passe, et le contrôle annonçait « 5,91 m où
     l'AEAI en demande 6 » sur toutes les compositions à la fois. */
  var cible = par.dmin + .35;
  for(pas = 0; pas < 60; pas++){
    var bouge = 0;
    for(i = 0; i < vols.length; i++){
      var v = vols[i], rc = rectSol(v), dx = 0, dy = 0;
      /* Le pire de TOUS les étages : un porte-à-faux qui franchit la limite est
         du bâti hors parcelle, et c'est lui qu'il faut rentrer. */
      var pire = Infinity;
      v.lv.forEach(function(e){
        var q = { x:v.x + (e.dx || 0), y:v.y + (e.dy || 0), w:e.w, d:e.d, a:v.a };
        var mm = margeAu(PER, q);
        if(mm < pire) pire = mm;
      });
      var m = pire - RULES.dist.retrait - .3;
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
      if(Math.abs(dx) + Math.abs(dy) > .02){
        v.x = d1(v.x + dx); v.y = d1(v.y + dy); bouge++;
      }
    }
    if(!bouge) break;
  }
}
/* Le repêchage. Repousser un corps vers le cœur du site ne suffit pas toujours :
   une aile posée dans un angle peut n'avoir AUCUNE issue par petits pas, alors
   qu'une place l'attend vingt mètres plus loin. On balaie donc la parcelle et
   l'on prend la position admissible la PLUS PROCHE de celle qu'il occupait — le
   parti garde sa figure, le corps trouve sa place. Le quart de tour est essayé
   aussi : une aile qui ne tient pas en travers tient parfois dans la longueur.

   Le balayage est filtré par le centre avant tout calcul sérieux : sans ce
   filtre, deux mille cinq cents positions par corps coûtaient une seconde. */
function repecher(vols, par){
  var B = bbox(PER), i, k;
  for(i = 0; i < vols.length; i++){
    var v = vols[i];
    if(admissible(v, vols)) continue;
    var rc = rectSol(v), demi = Math.min(rc.w, rc.d) / 2;
    var angles = [v.a, v.a + Math.PI / 2, axePer(), axePer() + Math.PI / 2];
    /* Les positions sont TRIÉES par distance avant d'être essayées : la plus
       proche qui tient est la bonne, et l'on s'arrête là. Les essayer toutes
       pour garder la meilleure coûtait deux mille cinq cents tests par corps,
       soit une seconde par tirage. */
    var cand = [], cx, cy;
    for(cx = B.x0; cx <= B.x1; cx += 3){
      for(cy = B.y0; cy <= B.y1; cy += 3){
        if(bordDist(PER, cx, cy) < RULES.dist.retrait + demi * .3) continue;
        cand.push([cx, cy, (cx - v.x) * (cx - v.x) + (cy - v.y) * (cy - v.y)]);
      }
    }
    cand.sort(function(a, b){ return a[2] - b[2]; });
    var pose = 0;
    for(k = 0; k < angles.length && !pose; k++){
      for(var q = 0; q < cand.length; q++){
        if(!admissible(v, vols, cand[q][0], cand[q][1], angles[k])) continue;
        v.x = d1(cand[q][0]); v.y = d1(cand[q][1]); v.a = angles[k];
        pose = 1;
        break;
      }
    }
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
  var p = 0, i, j;
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
    var OB = obstaclesPres(rc, par.dmin + 2);
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
    /* D'APLOMB, de préférence. Le porte-à-faux est permis et il se paie en
       structure : entre deux compositions qui logent le même programme, celle
       qui tient d'aplomb vaut mieux. C'est une préférence chiffrée, pas une
       règle — une figure qui n'a pas d'autre issue le fera quand même. */
    p += porteAFaux(v) * 9;
    /* Le terrain : un corps posé en travers de la pente demande un terrassement
       qu'on ne veut pas ignorer. */
    var as = assise(rc);
    p += Math.max(0, as.d - 1.6) * 16;
    /* Alignement : préférence, donc bonus — jamais une condition. */
    var al = alignement(v.a, atts);
    p -= (1 - Math.min(1, al.ecart / .35)) * al.att.w * 26 * ALIGN;
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
  return p;
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
  var partis = MASS.parti === "auto" ? PARTIS_LIBRES : [MASS.parti];

  /* Une figure qui ne tient pas dans le périmètre n'est pas une figure à
     avertir : c'est une figure à REPRENDRE. Un corps de six mille mètres carrés
     à dix-huit de profondeur fait trois cent trente mètres de long, et la
     parcelle en fait cent soixante-seize — on ne peut pas raccourcir la
     surface, elle est au règlement ; on épaissit donc le corps. Le générateur
     rejoue sa recherche avec des corps de plus en plus profonds, et rend la
     première composition qui tient tout entière dans la parcelle. */
  /* La profondeur de départ est celle d'un corps de classes, et le plafond
     celui du local le plus profond du programme : ni l'une ni l'autre ne se
     saisit plus (voir `profUsuel` / `profMax`). Le dernier cran passe outre —
     quand rien ne tient sous le plafond, le choix n'est pas entre une bonne et
     une mauvaise profondeur, il est entre un corps trop épais, que le contrôle
     avertit, et pas de composition du tout. */
  var pu = profUsuel(), pm = profMax();
  var profs = [pu, pu * 1.35, Math.max(pu * 1.8, pm), pm * 1.4, 46];
  var repli = null, rp = Infinity, e, t;
  for(e = 0; e < profs.length; e++){
    var P2 = copiePar(par, Math.min(46, Math.round(profs[e] * 10) / 10));
    var best = null, bp = Infinity;
    for(t = 0; t < 30; t++){
      var pid = partis[t % partis.length];
      var C = cadre(cap + entre(r, -1, 1) * JEU);
      var corps = figure(pid, r, C, N, P2);
      /* Avec et sans étage au-dessus de la salle de sport : une composition sur
         deux essaie l'aplomb, et la note tranche. */
      monter(corps, N, imp, P2, r, t % 2);
      var vols = poser(corps, C, imp, P2, r, atts);
      enterrer(vols, P2);
      var p = noter(vols, P2, atts);
      if(p < bp){ bp = p; best = vols; best.parti = pid; best.prof = P2.prof; }
    }
    /* Le repêchage ne tourne que sur la MEILLEURE des trente : le balayage
       coûte trop cher pour être payé trente fois, et une composition déjà
       mauvaise ne mérite pas qu'on la sauve. */
    if(best){
      repecher(best, P2);
      bp = noter(best, P2, atts);
      if(toutDedans(best)) return best;
    }
    if(best && bp < rp){ rp = bp; repli = best; }
  }
  /* Rien ne tient — ni en un corps, ni en sept, ni à quarante-six mètres de
     profondeur. Ce n'est plus une implantation à corriger : c'est que le
     programme demandé à ce niveau ne TIENT PAS sur ce terrain, et la réponse
     n'est pas ici. On rend la meilleure tentative, marquée comme telle, et le
     contrôle dit pourquoi et où aller la corriger — au mixer, en ajoutant un
     étage. Mieux vaut un dessin qu'on comprend qu'un écran vide. */
  if(repli){
    repli.impossible = 1;
    repli.posable = airePosable(RULES.dist.retrait);
  }
  return repli || [];
}
function copiePar(par, prof){
  var o = {}, k;
  for(k in par) o[k] = par[k];
  o.prof = prof;
  return o;
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

export { cadre, rectSol };
