/* ============================================================================
   GÉNÉRATEUR DE VOLUMÉTRIE
   Le programme est fixe ; ce qui se propose ici, c'est un PARTI : combien de
   corps de bâtiment, à combien de niveaux, de quelle profondeur, et où sur le
   terrain. Les surfaces ne sont jamais réécrites — elles viennent de
   `data/program.js` et lui seul — seules les proportions changent.

   Le générateur ne refuse rien. Une proposition qui sort des règles est
   produite quand même, et `checks.js` la dit. C'est la demande : on veut
   pouvoir essayer, à condition d'être averti.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { CIRC } from "../core/model.js";
import { nearestDims, validDims } from "../core/geometry.js";
import { CHAP } from "../data/program.js";
import { ENTRE, RULES, hNiv } from "../data/rules.js";
import { VANG } from "../data/site.js";
import { perBox, volFits, volGap } from "./place.js";

/* ---- les partis proposés ------------------------------------------------ */
export var PARTIS = [
  { id:"compact", n:"Compact",
    d:"Un seul corps scolaire, la salle de sport accolée. Le moins d’enveloppe par m² de plancher : c’est la compacité que le règlement nomme à l’art. 2.8." },
  { id:"barres", n:"Barres",
    d:"Le programme scolaire en barres de faible profondeur, corridor central, le grand axe du terrain orientant les classes au sud." },
  { id:"cour", n:"Cour",
    d:"Trois ailes autour d’une cour, la salle de sport fermant le quatrième côté. La cour de 500 m² est tenue par le bâti." },
  { id:"pavillons", n:"Pavillons",
    d:"Un pavillon par groupe de classes. Plus d’enveloppe et plus d’emprise, mais des unités à l’échelle des élèves." }
];

/* ---- les réglages ------------------------------------------------------- */
/* État mutable du générateur : lu partout, écrit par `massSet` seul. */
/* `circ` n'est PLUS un réglage du générateur. La part de circulation se décide
   dans le cahier des charges, parmi les surfaces à préciser, et de là seulement :
   elle vivait ici à 15 % en SUPPLÉMENT de la surface utile pendant qu'elle
   valait 18 % de la surface BÂTIE dans l'outil voisin — même mot, deux
   arithmétiques, 200 m² d'écart. */
export var MASS = { parti:"barres", niv:2, nb:2, prof:18, phase2:true, enterre:true };
export function massSet(k, v){ MASS[k] = v; }

/* ---- le programme, tel qu'il est ---------------------------------------- */
function chapTot(id){
  for(var i = 0; i < CHAP.length; i++) if(CHAP[i].id === id) return CHAP[i].total;
  return 0;
}
function itemTot(chapId, re){
  var t = 0;
  CHAP.forEach(function(ch){
    if(ch.id !== chapId) return;
    ch.items.forEach(function(it){ if(re.test(it.n)) t += it.tot; });
  });
  return t;
}
/* Besoins de plancher, en m². La circulation porte sur les programmes de
   locaux ; elle ne porte pas sur un local unique déjà dimensionné (salle de
   sport, abri, piscine, CAD), qui est sa propre surface.

   La part est lue dans `core/model.js` — jamais redéfinie ici — et suit la
   convention unique du projet : PART DE LA SURFACE BÂTIE, donc bâti = utile
   divisé par un moins la part. */
export function massProg(circ){
  var c = (typeof circ === "number" && circ >= 0 && circ < 1) ? circ : CIRC;
  var hall = itemTot("sport", /^Salle de sport double$/);
  var scene = itemTot("sport", /^Scène$/);
  var abri = itemTot("tech", /^Abri PC$/);
  var k = 1 / (1 - c);
  var P = {
    circ: c,
    hall: hall, scene: scene,
    sportAnx: (chapTot("sport") - hall) * k,          /* scène, vestiaires, foyer, engins, cuisine */
    ecole: chapTot("ecole") * k,
    uape: chapTot("uape") * k,
    tech: (chapTot("tech") - abri) * k,               /* CVSE et conciergerie */
    abri: abri,
    pis: itemTot("infra", /^Piscine$/),
    cad: itemTot("infra", /^Local chauffage CAD$/),
    cour: itemTot("ext", /^Cour/),
    net: CHAP.slice(0, 4).reduce(function(t, c){ return t + c.total; }, 0)
  };
  /* Le plancher qu'il faut construire : les locaux uniques déjà dimensionnés
     plus les programmes augmentés de la circulation. C'est la cible du
     générateur et la référence du contrôle. */
  P.besoin = P.hall + P.sportAnx + P.ecole + P.uape + P.tech + P.abri;
  return P;
}

/* ---- fabrique de corps -------------------------------------------------- */
var R5 = function(n){ return Math.round(n * 2) / 2; };
/* Les dimensions s'arrondissent VERS LE HAUT au demi-mètre : arrondir au plus
   proche rognait jusqu'à 250 m² de plancher sur une composition, et le
   contrôle annonçait un manque que le parti n'avait pas. */
var R5U = function(n){ return Math.ceil(n * 2 - 1e-9) / 2; };
/* Les positions s'arrondissent elles aussi au demi-mètre, après rotation : le
   jeu qui en résulte se reprend sur l'écart entre corps, d'où ce demi-mètre
   de marge sur la distance de l'AEAI. */
var JEU = 1;

function corps(o){
  /* u, v : position locale du coin bas-gauche dans le repère du terrain. */
  return { key:o.key, n:o.n, bat:o.bat || o.key, f:o.f, u:o.u, v:o.v, w:R5U(o.w), h:R5U(o.h),
           lv:o.lv == null ? 1 : o.lv, nz:o.nz || 0, hl:o.hl, prog:o.prog || 0,
           sol:o.sol || 0, ph:o.ph || 1, fix:o.fix || 0, libre:o.libre || 0 };
}
/* Une barre : profondeur imposée, longueur déduite de la surface et des niveaux. */
function barre(prog, lv, prof){
  var h = R5U(prof), L = Math.max(h, prog / lv / h);
  return { w: R5U(L), h: h };
}

/* ---- composition, parti par parti --------------------------------------- */
/* Tout se compose en coordonnées locales (u vers l'est du terrain, v vers le
   nord), puis la composition entière est posée dans le périmètre. */
function composer(o, P){
  var L = [], hCla = hNiv("cla"), hSpo = hNiv("spo"), E = ENTRE + JEU;
  var dAnx = Math.max(8, P.sportAnx / 2 / 32);          /* annexes sport sur deux niveaux */

  /* La salle de sport et ses annexes forment UN corps : 28 × 32 m imposés,
     7 m libres sous structure, la bande d'annexes accolée au nord. */
  L.push(corps({ key:"sport", bat:"sport", n:"Salle de sport double / polyvalente", f:"spo",
                 u:0, v:0, w:32, h:28, lv:1, hl:hSpo, prog:P.hall, fix:1 }));
  L.push(corps({ key:"sportanx", bat:"sport", n:"Annexes de la salle de sport", f:"eau",
                 u:0, v:28, w:32, h:dAnx, lv:2, hl:hCla, prog:P.sportAnx }));
  /* Le scolaire se pose À CÔTÉ de la sport, pas au-dessus : le terrain fait
     176 m d'est en ouest pour 123 du sud au nord, et une composition empilée
     vers le nord ne tenait dans le périmètre à aucun parti. */
  var uSco = 32 + E, scol = P.ecole + P.tech, uape = P.uape;

  if(o.parti === "compact"){
    /* un seul corps : école, UAPE et technique ensemble */
    var A = (scol + uape) / o.niv, wC = R5U(Math.sqrt(A * 1.6)), hC = R5U(A / wC);
    L.push(corps({ key:"ecole", bat:"ecole", n:"École, UAPE et locaux techniques", f:"cla",
                   u:uSco, v:0, w:wC, h:hC, lv:o.niv, hl:hCla, prog:scol + uape }));
  } else if(o.parti === "barres"){
    /* barres parallèles au grand axe du terrain : toutes les classes au sud */
    var nb = Math.max(1, o.nb), v = 0, i;
    for(i = 0; i < nb; i++){
      var b = barre(scol / nb, o.niv, o.prof);
      L.push(corps({ key:"ecole" + i, bat:"ecole" + i,
                     n:"Barre " + String.fromCharCode(65 + i) + " — classes", f:"cla",
                     u:uSco, v:v, w:b.w, h:b.h, lv:o.niv, hl:hCla, prog:scol / nb }));
      v += b.h + E;
    }
    var bu = barre(uape, 1, o.prof);
    L.push(corps({ key:"uape", bat:"uape", n:"UAPE", f:"uap", u:uSco, v:v, w:bu.w, h:bu.h,
                   lv:1, hl:hCla, prog:uape }));
  } else if(o.parti === "cour"){
    /* Trois ailes en U autour de la cour, la salle de sport fermant le
       quatrième côté. La largeur de cour est donnée, la longueur des ailes
       suit de la surface à loger, puis la cour se relit sur cette longueur
       pour tenir ses 500 m². */
    var cw = 24, W, lg, bes = (scol + uape) / o.niv, t;
    for(t = 0; t < 2; t++){
      W = 2 * o.prof + cw;
      lg = Math.max(o.prof, (bes - W * o.prof) / (2 * o.prof));
      cw = Math.max(cw, P.cour / lg);
    }
    W = R5U(2 * o.prof + cw); lg = R5U(lg);
    L.push(corps({ key:"ecoleO", bat:"ecole", n:"Aile ouest — classes", f:"cla",
                   u:uSco, v:0, w:o.prof, h:lg, lv:o.niv, hl:hCla, prog:scol * 0.4 }));
    L.push(corps({ key:"ecoleE", bat:"ecole", n:"Aile est — classes", f:"cla",
                   u:uSco + W - R5U(o.prof), v:0, w:o.prof, h:lg, lv:o.niv, hl:hCla, prog:scol * 0.4 }));
    L.push(corps({ key:"ecoleN", bat:"ecole", n:"Aile nord — accueil et UAPE", f:"uap",
                   u:uSco, v:lg, w:W, h:o.prof, lv:o.niv, hl:hCla, prog:scol * 0.2 + uape }));
    L.push(corps({ key:"cour", bat:"cour", n:"Cour d\u2019école", f:"ext",
                   u:uSco + R5U(o.prof), v:0, w:W - 2 * R5U(o.prof), h:lg,
                   lv:0, hl:0, prog:P.cour, sol:1 }));
  } else {
    /* pavillons : des carrés alignés d'est en ouest, l'UAPE en pavillon bas */
    var np = Math.max(2, o.nb + 1), c = R5U(Math.sqrt(scol / np / o.niv)), u = uSco, j;
    for(j = 0; j < np; j++){
      L.push(corps({ key:"ecole" + j, bat:"ecole" + j, n:"Pavillon " + (j + 1), f:"cla",
                     u:u, v:0, w:c, h:c, lv:o.niv, hl:hCla, prog:scol / np }));
      u += c + E;
    }
    var cu = R5U(Math.sqrt(uape));
    L.push(corps({ key:"uape", bat:"uape", n:"UAPE", f:"uap", u:uSco, v:c + E,
                   w:cu, h:cu, lv:1, hl:hCla, prog:uape }));
  }

  /* l'abri PC : 750 m² exacts, sous le terrain si la nappe le permet */
  var da = nearestDims(P.abri, 30);
  L.push(corps({ key:"abri", bat:"abri", n:"Abri PC", f:"tec", u:0, v:0, w:da.w, h:da.h,
                 lv:1, nz:o.enterre ? -1 : 0, hl:hNiv("abri"), prog:P.abri, fix:1, libre:1 }));

  /* la cour, quand le parti ne la tient pas déjà */
  if(o.parti !== "cour"){
    var dc = nearestDims(P.cour, 28);
    L.push(corps({ key:"cour", bat:"cour", n:"Cour d\u2019école", f:"ext", u:0, v:0,
                   w:dc.w, h:dc.h, lv:0, hl:0, prog:P.cour, sol:1, libre:1 }));
  }
  /* second temps : indépendants, en pointillé */
  if(o.phase2){
    var dp = nearestDims(P.pis, 25), dd = nearestDims(P.cad, 20);
    L.push(corps({ key:"pis", bat:"pis", n:"Piscine", f:"pis", u:0, v:0, w:dp.w, h:dp.h,
                   lv:1, hl:hNiv("pis"), prog:P.pis, ph:2, fix:1, libre:1 }));
    L.push(corps({ key:"cad", bat:"cad", n:"Local chauffage CAD", f:"tec", u:0, v:0,
                   w:dd.w, h:dd.h, lv:1, hl:hNiv("cad"), prog:P.cad, ph:2, fix:1, libre:1 }));
  }
  return L;
}

/* ---- pose de la composition dans le périmètre --------------------------- */
/* Les corps composés (u, v ≥ 0) forment un bloc ; on cherche l'origine qui met
   ce bloc le plus au centre du périmètre en y tenant entièrement. Les volumes
   libres — abri, cour, second temps — se posent ensuite, un par un. */
function poser(L){
  var ca = Math.cos(VANG), sa = Math.sin(VANG), B = perBox();
  var comp = L.filter(function(c){ return !c.libre; });
  /* L'abri d'abord, qui n'a qu'un tiers du site où descendre, puis la cour :
     c'est l'usage quotidien de l'école, et elle passe avant deux
     infrastructures dont le règlement ne demande que la surface réservée. */
  var ordre = { abri:0, cour:1, pis:2, cad:3 };
  var free = L.filter(function(c){ return c.libre; })
              .sort(function(a, b){ return (ordre[a.key] || 9) - (ordre[b.key] || 9); });

  var uw = 0, vh = 0;
  comp.forEach(function(c){ uw = Math.max(uw, c.u + c.w); vh = Math.max(vh, c.v + c.h); });

  /* Quatre orientations de la composition. Le périmètre n'est pas un
     rectangle : un parti qui ne tient pas la sport à l'ouest la tient à
     l'est, et c'est le même parti. */
  var ORI = [[0,0],[1,0],[0,1],[1,1]];

  /* candidats, du plus centré au plus excentré */
  var cand = [];
  for(var gy = B.y0; gy <= B.y1; gy += 3) for(var gx = B.x0; gx <= B.x1; gx += 3){
    var mx = gx + (uw / 2 * ca - vh / 2 * sa), my = gy + (uw / 2 * sa + vh / 2 * ca);
    cand.push({ x:gx, y:gy, d:(mx - B.cx) * (mx - B.cx) + (my - B.cy) * (my - B.cy) });
  }
  cand.sort(function(a, b){ return a.d - b.d; });

  function apply(o, mi){
    comp.forEach(function(c){
      var u = mi[0] ? uw - c.u - c.w : c.u, v = mi[1] ? vh - c.v - c.h : c.v;
      c.x = R5(o.x + u * ca - v * sa);
      c.y = R5(o.y + u * sa + v * ca);
    });
  }
  var fit = null;
  for(var i = 0; i < cand.length && !fit; i++) for(var k = 0; k < ORI.length && !fit; k++){
    apply(cand[i], ORI[k]);
    var ok = true;
    for(var j = 0; j < comp.length; j++) if(!volFits(comp[j], comp[j].x, comp[j].y)){ ok = false; break; }
    if(ok) fit = 1;
  }
  /* rien ne tient : on pose au centre quand même, `checks.js` le dira */
  if(!fit) apply({ x:B.cx - uw / 2, y:B.cy - vh / 2 }, ORI[0]);

  var placed = comp.slice();
  free.forEach(function(c){
    var sp = spot(c, placed);
    c.x = sp.x; c.y = sp.y; c.w = sp.w; c.h = sp.h; c.serre = sp.serre;
    placed.push(c);
  });
  return L;
}
/* Proportions admissibles d'un volume libre, à surface EXACTE, la plus carrée
   d'abord. Une cour de 500 m² n'a pas à être un carré de 25 × 20 : quand le
   site est plein, c'est sa forme qui cède, jamais sa surface. */
function variantes(v){
  var A = Math.round(v.w * v.h);
  var out = validDims(A).filter(function(d){
    var r = Math.max(d.w, d.h) / Math.min(d.w, d.h);
    return r <= 4.5 && Math.min(d.w, d.h) >= 8;
  }).sort(function(a, b){ return Math.abs(a.w - a.h) - Math.abs(b.w - b.h); });
  if(!out.length) out = [{ w:v.w, h:v.h }];
  return out.slice(0, 10);
}
/* Place un volume libre : l'abri cherche l'est, où le terrain est le plus haut
   au-dessus de la nappe ; les autres cherchent le centre. On essaie d'abord
   toutes les proportions à pleine distance AEAI ; ce n'est qu'ensuite que la
   distance cède d'un cran. Le volume garde alors `serre` — et le contrôle le
   dit, puisque c'est la règle qui a plié. */
function spot(v, placed){
  var vars = variantes(v), seps = [ENTRE, 4, 2, 1, 0], k, i;
  for(k = 0; k < seps.length; k++) for(i = 0; i < vars.length; i++){
    var t = { key:v.key, w:vars[i].w, h:vars[i].h, sol:v.sol, nz:v.nz, ph:v.ph };
    var r = spotAt(t, placed, seps[k]);
    if(r) return { x:r.x, y:r.y, w:t.w, h:t.h, serre:seps[k] };
  }
  var B = perBox();
  return { x:R5(B.cx - v.w / 2), y:R5(B.cy - v.h / 2), w:v.w, h:v.h, serre:-1 };
}
function spotAt(v, placed, sep){
  var B = perBox(), ca = Math.cos(VANG), sa = Math.sin(VANG);
  var est = v.key === "abri", best = null, bd = 1e9;
  for(var gy = B.y0; gy <= B.y1; gy += 3) for(var gx = B.x0; gx <= B.x1; gx += 3){
    var d = est ? (B.x1 - gx) * 3 + Math.abs(gy - B.cy)
                : Math.hypot(gx - B.cx, gy - B.cy);
    if(d >= bd) continue;
    var ox = R5(gx - (v.w / 2 * ca - v.h / 2 * sa)), oy = R5(gy - (v.w / 2 * sa + v.h / 2 * ca));
    if(!volFits(v, ox, oy)) continue;
    var ok = true;
    for(var i = 0; i < placed.length; i++){
      /* Un sous-sol passe sous le bâti : la distance de l'AEAI sépare des
         façades, pas des dalles. La cour vient contre le bâti : pas de mur à
         écarter, mais pas de recouvrement non plus. */
      /* Un sous-sol passe sous l'école, pas sous une infrastructure du second
         temps : celle-ci est un ouvrage indépendant, réalisé plus tard. */
      var sous = (v.nz < 0 || placed[i].nz < 0) && v.ph !== 2 && placed[i].ph !== 2;
      var s2 = sous ? 0 : (v.sol || placed[i].sol) ? Math.min(1, sep) : sep;
      if(volGap(v, ox, oy, placed[i]) < s2){ ok = false; break; }
    }
    if(!ok) continue;
    bd = d; best = { x:ox, y:oy };
  }
  return best;
}

/* ---- sortie ------------------------------------------------------------- */
/* Les volumes produits ont la forme attendue par la vue Site : `n, sub, f, w,
   h, x, y, lv`, plus ce dont la 3D a besoin — hauteur de niveau, niveau du
   plancher bas, phase, surface portée. */
export function massGen(){
  var o = MASS, P = massProg();
  var L = poser(composer(o, P));
  L.forEach(function(c){
    var pl = c.w * c.h * Math.max(1, c.lv);
    c.gen = 1;
    c.sub = c.sol ? fmt(Math.round(c.w * c.h)) + " m² de plein air"
          : (c.lv > 1 ? "R+" + (c.lv - 1) + " · " : c.nz < 0 ? "sous-sol · " : "")
            + fmt(Math.round(pl)) + " m²"
            + (c.ph === 2 ? " · 2ᵉ temps" : "");
    c.plancher = c.sol ? 0 : pl;
  });
  return { vols:L, prog:P, opt:{ parti:o.parti, niv:o.niv, nb:o.nb, prof:o.prof,
           circ:P.circ, phase2:o.phase2, enterre:o.enterre } };
}
export function partiOf(id){
  for(var i = 0; i < PARTIS.length; i++) if(PARTIS[i].id === id) return PARTIS[i];
  return PARTIS[0];
}
export var RULES_REF = RULES;
