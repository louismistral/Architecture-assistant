/* ============================================================================
   CE QU'ON LIT SUR UN BÂTIMENT

   Ce module mesure une volumétrie, et il ne fait que cela. Trois lectures,
   trois destinataires, et aucun ne se convertit dans l'autre :

     ecarts()      le CADRE — ce que la variante enfreint, avec les mots du
                   contrôle. Le générateur jette ce qui en a un ; le contrôle
                   le notifie sur ce qu'on a retouché à la main ;
     qualites()    l'ORIENTATION — pour chaque ligne, une qualité q de −1 à +1
                   et un état (favorable, neutre, défavorable), calés sur ses
                   seuils. Le générateur s'en sert pour choisir entre deux
                   candidats ;
     mesuresMass() les MESURES brutes — des nombres, sans seuil. C'est tout ce
                   que le JUGEMENT lit (`data/jugement.js`) : il noterait de la
                   même façon un bâtiment que personne n'a généré.

   `juge.js` faisait les trois à la fois : les rangs `forte` et `pref`
   orientaient le générateur ET faisaient la note, et l'on ne savait plus ce
   que valait un bâtiment.
   ========================================================================= */
import { dec, fmt } from "../core/format.js";
import { ITEMBYKEY } from "../core/model.js";
import { NAPPE, PER, SITE } from "../data/site.js";
import { V, courProgramme, enVigueur, lu, preauProgramme, recul, reculVise, severite } from "../data/cadre.js";
import { feuExige, imposees } from "../data/orientation.js";
import { noter } from "../data/jugement.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { FLOORS, areaOf, lvlOf, onFloor } from "../mix/floors.js";
import { mesuresMix } from "../mix/mesures.js";
import { evaluerTypo } from "../typo/mesures.js";
import { FINAL } from "../data/planches.js";
import { vues } from "../rendu/final.js";
import { airePosable, alignement, assise, attracteurs, bbox, bordDist, cibleVue, coins, dansRect, dedans, distRoute, ecart,
  ecartAngle, ecartPoly, margeAu, terrain, visAVis } from "./geom.js";
import { CONTACT, MASS, aireEtage, contourDe, recouvrement, recouvrementSol, assiseEff, bilan, demande, etagesDe, hauteurEtage, horsModule, horsSol, niveaux, partsDe, pontRect, postesDe,
  profFacade, secondTemps, solRects, volEtage, volNiv, volRects, volTitre as nomV } from "./model.js";
import { assiseVol, ecartSols, ecartVols, empSol, lies, obstaclesPres, rectsHors } from "./gen.js";

export { courProgramme };
var DEG = Math.PI / 180;
/* La profondeur jusqu'où l'on mesure une cour devant une façade : une FORMULE
   de mesure, donc du code — la changer changerait ce que « cour » veut dire. */
var COUR_FOND = 30;
function ecole(vols){ return vols.filter(function(v){ return !v.ph; }); }

/* ---------- la part de classes d'un corps -----------------------------------
   Lue dans `postesDe()`, donc dans le mixer. Un cache par tirage : `oublier()`
   le vide, le générateur l'appelle en tête. */
var PARTCLA = {};
export function oublier(){ PARTCLA = {}; }
function partClaNiv(i){
  if(PARTCLA[i] !== undefined) return PARTCLA[i];
  var tot = 0, cla = 0;
  postesDe(i).forEach(function(q){
    tot += q.a;
    if(q.f === "cla" || q.f === "uap") cla += q.a;
  });
  PARTCLA[i] = tot > 0 ? cla / tot : 0;
  return PARTCLA[i];
}
export function portClasses(v){
  if(v.ph || v.fix) return false;
  return v.lv.some(function(e){ return lvlOf(e.i) >= 0 && partClaNiv(e.i) > 0; });
}

/* Le terrain que demandent la cour et le stationnement (art. 2.4), et ce que
   les bâtiments en laissent sur l'aire posable — le recul VISÉ déduit, ou
   `r` : le jugement mesure sur tout le périmètre, sans rien de nos choix. */
export function terrainLibre(vols, r){
  var emp = 0;
  vols.forEach(function(v){ emp += empSol(v); });
  /* deux corps du même bâtiment qui se recouvrent n'occupent leur part commune qu'une fois */
  emp -= recouvrementSol(vols);
  var posable = airePosable(r == null ? reculVise() : r);
  return { libre: posable - emp, posable: posable,
           besoin: courProgramme() + RULES.ext.voitures * RULES.ext.mPlace };
}

/* ---------- la cour utile ----------------------------------------------------
   Le terrain libre D'UN SEUL TENANT devant une façade d'école : de chaque point
   de la façade, on avance droit devant jusqu'au premier obstacle — la limite du
   périmètre, un bâtiment, l'existant — ou jusqu'à `COUR_FOND`. La meilleure
   façade donne la cour. Aucune forme n'est imposée. */
export function courUtile(vols){
  var E = ecole(vols), best = { a:0, v:-1 }, pas = 2;
  var rects = [], OB = [];
  vols.forEach(function(v){ rectsHors(v).forEach(function(r){ rects.push(r); }); });
  function libre(x, y){
    if(!dedans(PER, x, y)) return false;
    for(var k = 0; k < rects.length; k++) if(dansRect(rects[k], x, y)) return false;
    for(k = 0; k < OB.length; k++) if(dedans(OB[k], x, y)) return false;
    return true;
  }
  /* chaque part d'un volume fusionné a ses façades ; celles d'une jonction
     butent aussitôt sur la part voisine et ne comptent pour rien */
  E.forEach(function(v){ solRects(v).forEach(function(rc){
    OB = obstaclesPres(rc, COUR_FOND);
    var c = Math.cos(rc.a), s = Math.sin(rc.a);
    [[[-s, c], [c, s], rc.w / 2, rc.d / 2], [[s, -c], [c, s], rc.w / 2, rc.d / 2],
     [[c, s], [-s, c], rc.d / 2, rc.w / 2], [[-c, -s], [-s, c], rc.d / 2, rc.w / 2]]
      .forEach(function(f){
        var n = f[0], t = f[1], a = 0, sx = 0, sy = 0, u, z, P = [], lf = 0;
        for(u = -f[2] + pas / 2; u < f[2]; u += pas){
          for(z = pas / 2; z < COUR_FOND; z += pas){
            var x = rc.x + n[0] * (f[3] + z) + t[0] * u;
            var y = rc.y + n[1] * (f[3] + z) + t[1] * u;
            if(!libre(x, y)) break;
            a += pas * pas; sx += x; sy += y; P.push([x, y]);
          }
          if(z > pas) lf += pas;
        }
        /* `n` : où regarde la façade de la cour ; `x, y` : son centre — le
           soleil et la rue se lisent là */
        /* `pts` : ses points, `lf` : la façade qui la borde */
        if(a > best.a) best = { a:a, v:vols.indexOf(v), n:n, x:sx * pas * pas / a, y:sy * pas * pas / a, pts:P, lf:lf };
      });
  }); });
  return best;
}

/* ---------- 1. LE CADRE -------------------------------------------------------
   Une entrée par écart : `{ k, v, v2, msg, pile, sev }`, `k` étant l'id de la
   ligne du cadre (`data/cadre.js`). `vite` rend au premier écart — c'est ce
   que veut le générateur. `pile` marque un écart qu'aucune composition ne
   peut résoudre (il se règle au mixer) : le générateur ne jette pas une
   variante pour lui. `sev` : rouge pour l'opposable, ambre pour notre choix. */
export function ecarts(vols, vite, Q){
  var out = [];
  /* `c` : de quoi distinguer deux écarts à la même ligne qui ne désignent pas
     de volume — deux niveaux qui ne logent pas leur surface. */
  function dit(k, v, msg, pile, v2, c){
    out.push({ k:k, v:v, v2: v2 == null ? -1 : v2, msg:msg, pile:pile ? 1 : 0, sev:severite(k),
               c: c == null ? null : c });
  }
  var i, j, stop = function(){ return vite && out.length; };
  var R = enVigueur("recul") ? recul() : 0;

  /* le périmètre — opposable — et notre recul, à tous les étages */
  for(i = 0; i < vols.length && !stop(); i++){
    var mm = Infinity;
    vols[i].lv.forEach(function(e){
      volRects(vols[i], e).forEach(function(r){ mm = Math.min(mm, margeAu(PER, r)); }); });
    if(mm < -.01) dit("perimetre", i, nomV(vols[i], i) + " sort du périmètre de " + dec(-mm) + " m.");
    else if(mm < R - .01)
      dit("recul", i, nomV(vols[i], i) + " est à " + dec(mm) + " m de la limite ; le recul est de "
        + dec(R) + " m.");
  }
  (vols.ponts || []).forEach(function(p){
    var r = pontRect(p, vols);
    if(!r || stop()) return;
    var m = margeAu(PER, r);
    if(m < -.01) dit("perimetre", -1, "Une passerelle sort du périmètre.");
    else if(m < R - .01) dit("recul", -1, "Une passerelle franchit le recul.");
  });

  /* la distance INCENDIE entre bâtiments, à tous les étages — quand elle est
     du cadre (Imposée) ; en orientation, `qualites()` la lit */
  var FEU = feuExige();
  for(i = 0; FEU && i < vols.length && !stop(); i++){
    for(j = i + 1; j < vols.length && !stop(); j++){
      var e = ecartVols(vols[i], vols[j]), L = lies(vols[i], vols[j]);
      /* un même bâtiment ne se doit aucune distance — et ses corps peuvent se recouvrir */
      if(e < FEU - .01 && !L)
        dit("dist", i, nomV(vols[i], i) + " et " + nomV(vols[j], j).toLowerCase()
          + (e < 0 ? " s'interpénètrent." : " sont à " + dec(e) + " m : la distance "
            + "incendie est de " + dec(FEU) + " m."), 0, j);
    }
  }

  /* les cotes : le module, les classes en façade — deux choix à nous */
  var PF = profFacade(), MOD = enVigueur("module"), FAC = enVigueur("facade");
  for(i = 0; i < vols.length && !stop(); i++){
    var v = vols[i], cla = FAC && portClasses(v), vu = {};
    v.lv.forEach(function(e){ partsDe(e).forEach(function(p){
      var sol = lvlOf(e.i) >= 0, pt = Math.min(p.w, p.d);
      function une(k, msg){ if(!vu[k]){ vu[k] = 1; dit(k, i, msg); } }
      if(MOD && (horsModule(p.w) || horsModule(p.d)))
        une("module", nomV(v, i) + " — " + dec(p.w) + " × " + dec(p.d) + " m : hors du module de "
          + dec(V.module) + " m.");
      if(!sol || v.fix) return;
      if(cla && pt > PF + .01)
        une("facade", nomV(v, i) + " porte des classes sur " + dec(pt) + " m de profondeur : "
          + "au-delà de " + dec(PF) + " m — deux salles —, une salle n'a plus de façade.");
    }); });
  }

  /* la salle de sport : ses cotes, et rien au-dessus */
  vols.forEach(function(v, k){
    if(!v.fix || stop()) return;
    var it = ITEMBYKEY[v.key], hs = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; });
    if(hs.length > 1) dit("sport", k, "Un étage est posé sur la salle de sport.");
    var hw = hs[0] && hs[0].w, hd = hs[0] && hs[0].d;
    if(hs.length > 1){}
    else if(it && it.w && hs[0] && (Math.min(hw, hd) !== Math.min(it.w, it.h)
            || Math.max(hw, hd) !== Math.max(it.w, it.h)))
      dit("sport", k, "La salle de sport ne fait plus " + it.w + " × " + it.h + " m.");
  });

  /* la scène, collée à la salle de sport : la salle doit toucher l'école */
  if(enVigueur("scene-sport")) vols.forEach(function(v, k){
    if(!v.fix || stop()) return;
    if(!vols.some(function(o){ return o !== v && !o.fix && !o.ph && lies(v, o); }))
      dit("scene-sport", k, "La salle de sport ne touche pas l'école : la scène ne peut pas lui être collée.");
  });

  /* l'abri PC, au moins partiellement enterré */
  if(!stop()){
    var ab = abriNiv();
    if(ab >= 0 && lvlOf(ab) > 0)
      dit("abri", -1, "L'abri PC est à l'étage : il doit être au moins partiellement "
        + "enterré. C'est au mixer qu'il se descend.", 1);
    else if(ab >= 0 && lvlOf(ab) === 0){
      var pente = ecole(vols).some(function(v){
        return !v.fix && assiseEff(v, vols).d >= 1; });
      if(!pente) dit("abri", -1, "L'abri PC est au rez, et aucun corps ne s'enterre d'un "
        + "mètre dans la pente : il doit être au moins partiellement enterré.");
    }
  }

  /* chaque niveau loge sa surface — la règle première */
  if(!stop()) bilanDe(vols).forEach(function(b){
    if(stop()) return;
    var tol = Math.max(5, b.demande * .02);
    if(Math.abs(b.ecart) > tol)
      dit("surfaces", -1, b.nom + " — surface demandée " + fmt(Math.round(b.demande))
        + " m², surface posée " + fmt(Math.round(b.pose)) + " m², différence "
        + (b.ecart > 0 ? "+" : "−") + fmt(Math.round(Math.abs(b.ecart))) + " m².", 0, -1, b.i);
  });

  /* la cour — la plus chère, en dernier */
  if(!stop()){
    var cu = courUtile(vols), cp = courProgramme();
    if(cu.a < cp)
      dit("cour-prog", -1, "La meilleure cour ne fait que " + fmt(Math.round(cu.a)) + " m² utiles "
        + "devant une façade d'école : le programme en demande " + fmt(cp) + ".");
    else if(enVigueur("cour") && cu.a < V.courMin)
      dit("cour", -1, "La meilleure cour fait " + fmt(Math.round(cu.a)) + " m² utiles devant "
        + "une façade d'école, pour " + fmt(V.courMin) + " m² voulus.");
  }

  /* une ligne d'orientation passée en Imposé : elle bloque quand elle se lit
     défavorable */
  var IMP = imposees();
  if(!stop() && IMP.length){
    var q = Q || qualites(vols);
    IMP.forEach(function(id){
      var c = q[id];
      if(c && c.niv === 0 && !stop()) dit(id, -1, c.n + " — " + c.txt);
    });
  }
  return out;
}
function abriNiv(){
  for(var i = 0; i < FLOORS.length; i++){
    if(onFloor(i).some(function(b){ return PMAP[b.key] && /abri/i.test(PMAP[b.key].n); }))
      return i;
  }
  return -1;
}
/* Le bilan de CES volumes — pas forcément ceux de l'écran. */
function bilanDe(vols){
  if(vols === MASS.vol) return bilan();
  return niveaux().map(function(n){
    var po = 0;
    vols.forEach(function(v){ if(v.ph) return; v.lv.forEach(function(e){ if(e.i === n.i) po += aireEtage(e); }); });
    po -= recouvrement(vols, n.i, false).aire;
    var dem = demande(n.i, vols);
    return { i:n.i, nom:n.nom, demande:dem, pose:po, ecart:po - dem };
  });
}
/* Ce qui peut invalider une variante — les écarts `pile` se règlent au mixer. */
export function valide(vols){
  return !ecarts(vols, false).some(function(x){ return !x.pile; });
}

/* ---------- ce que les deux lectures suivantes partagent -----------------------
   Les nombres bruts d'une volumétrie, calculés une fois : la cour, surtout,
   coûte cher. */
function borne(q){ return Math.max(-1, Math.min(1, q)); }
function lin(x, bon, max){ return borne(1 - (x - bon) / Math.max(1e-6, max - bon)); }
function palier(x, bon, max){ return x <= bon ? 2 : x <= max ? 1 : 0; }
/* la normale à la façade longue d'une emprise — d'une part, pour un volume
   fusionné : chaque aile a la sienne */
function normale(v, r){
  return r.w >= r.d ? v.a + Math.PI / 2 : v.a;
}
/* L'azimut d'une direction du dessin (x à l'est, y au nord), en degrés de
   0 à 360 depuis le nord, dans le sens horaire. */
function azimut(t){ return ((90 - t / DEG) % 360 + 360) % 360; }
function ecartAz(a, b){ var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
/* La façade du rez la mieux tournée vers la vue, parmi celles que rien ne
   masque sur `COUR_FOND` : l'écart, en degrés, de sa normale à la direction du
   terrain de football. Le hall, le réfectoire et le foyer s'y ouvriront. */
function collectifVue(E, T){
  var rects = [], best = Infinity, pas = 2;
  E.forEach(function(v){ v.lv.forEach(function(e){ volRects(v, e).forEach(function(r){ rects.push(r); }); }); });
  E.forEach(function(v){
    if(v.fix) return;
    v.lv.forEach(function(e){
      if(lvlOf(e.i) !== 0) return;
      volRects(v, e).forEach(function(rc){
        var c = Math.cos(rc.a), s = Math.sin(rc.a);
        [[[-s, c], rc.d / 2], [[s, -c], rc.d / 2], [[c, s], rc.w / 2], [[-c, -s], rc.w / 2]].forEach(function(f){
          var n = f[0], mx = rc.x + n[0] * f[1], my = rc.y + n[1] * f[1], z, k;
          for(z = pas / 2; z < COUR_FOND; z += pas){
            var x = mx + n[0] * z, y = my + n[1] * z;
            for(k = 0; k < rects.length; k++) if(rects[k] !== rc && dansRect(rects[k], x, y)) return;
          }
          best = Math.min(best, ecartAz(azimut(Math.atan2(n[1], n[0])), azimut(Math.atan2(T.y - my, T.x - mx))));
        });
      });
    });
  });
  return best;
}

/* L'optimum soleil-vue en un point : la façade longue qui partage l'écart entre
   le sud et la direction du terrain de football. Rend l'angle du grand axe. */
export function angleSoleilVue(x, y){
  var T = cibleVue(), pv = Math.atan2(T.y - y, T.x - x);
  return ecartAngle(pv, Math.PI / 2) / 2;
}

/* PUBLIC ET ÉCOLE. Un volume est public quand ce qu'il porte l'est (`pub`, les
   chapitres publics de `program.js`) : la salle polyvalente, la piscine, le
   chauffage communal ; les autres corps sont l'école. Deux nombres :
   - `sep`, le recouvrement de leurs emprises projetées sur la direction qui les
     sépare le mieux, rapporté à la plus petite des deux : 0 quand une ligne
     droite passe entre elles. On essaie les axes des volumes, et tous les 5° ;
   - `cote`, l'écart de leurs centres vers le côté public (`V.pubAz`), en m,
     et `demi` la demi-largeur de l'école dans cette direction. */
function publicEcole(vols){
  var P = [], S = [];
  vols.forEach(function(v){
    var pub = v.lv.some(function(e){ return (e.keys || []).some(function(k){ return PMAP[k] && PMAP[k].pub; }); });
    if(!pub && (v.ph || v.fix)) return;
    solRects(v).forEach(function(r){ (pub ? P : S).push(r); });
  });
  if(!P.length || !S.length) return { sep:null, cote:null, demi:0 };
  function pts(L){ var o = []; L.forEach(function(r){ coins(r).forEach(function(c){ o.push(c); }); }); return o; }
  function centre(L){
    var a = 0, x = 0, y = 0;
    L.forEach(function(r){ var w = r.w * r.d; a += w; x += r.x * w; y += r.y * w; });
    return [x / a, y / a];
  }
  function etendue(Q, ux, uy){
    var lo = Infinity, hi = -Infinity;
    Q.forEach(function(c){ var t = c[0] * ux + c[1] * uy; lo = Math.min(lo, t); hi = Math.max(hi, t); });
    return [lo, hi];
  }
  var QP = pts(P), QS = pts(S), sep = Infinity, axes = [];
  for(var t = 0; t < 180; t += 5) axes.push(t * DEG);
  P.concat(S).forEach(function(r){ axes.push(r.a, r.a + Math.PI / 2); });
  axes.forEach(function(t){
    var a = etendue(QP, Math.cos(t), Math.sin(t)), b = etendue(QS, Math.cos(t), Math.sin(t));
    sep = Math.min(sep, Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0])) / Math.max(1e-6, Math.min(a[1] - a[0], b[1] - b[0])));
  });
  var az = V.pubAz * DEG, dx = Math.sin(az), dy = Math.cos(az), cp = centre(P), cs = centre(S), e = etendue(QS, dx, dy);
  return { sep:sep, cote:(cp[0] - cs[0]) * dx + (cp[1] - cs[1]) * dy, demi:(e[1] - e[0]) / 2 };
}

function lire(vols){
  var E = ecole(vols), N = horsSol(), HN = {};
  N.forEach(function(n){ HN[n.i] = n; });
  function haut(v){
    var h = 0;
    v.lv.forEach(function(e){ if(HN[e.i] !== undefined) h += hauteurEtage(e, HN[e.i]); });
    return h + RULES.haut.acrotere;
  }
  var CL = E.filter(portClasses);
  if(!CL.length) CL = E.filter(function(v){ return !v.fix; });
  var T = cibleVue();

  /* les façades longues des corps de classes, pondérées par leur longueur × les
     étages : leur écart au sud et à la vue */
  function angles(f){
    var out = [];
    CL.forEach(function(v){
      var nh = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; }).length;
      solRects(v).forEach(function(r){
        out.push({ w: Math.max(r.w, r.d) * Math.max(1, nh), a: Math.abs(f(v, r)) / DEG });
      });
    });
    return out;
  }
  var sud = angles(function(v, r){ return ecartAngle(normale(v, r), Math.PI / 2); });
  var vue = angles(function(v, r){ return ecartAngle(normale(v, r), Math.atan2(T.y - r.y, T.x - r.x)); });

  /* les DEUX façades longues des corps de classes, chacune son azimut (0 au
     nord, 90 à l'est) : un corps de classes en porte des deux côtés */
  var cotes = [];
  CL.forEach(function(v){
    var nh = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; }).length;
    solRects(v).forEach(function(r){
      var w = Math.max(r.w, r.d) * Math.max(1, nh), t = normale(v, r);
      cotes.push({ w:w, az:azimut(t) }, { w:w, az:azimut(t + Math.PI) });
    });
  });
  /* la salle de sport : l'écart de sa façade longue à l'axe nord-sud */
  var sportNord = null;
  E.forEach(function(v){
    if(v.fix) solRects(v).forEach(function(r){ sportNord = Math.abs(ecartAngle(normale(v, r), Math.PI / 2)) / DEG; });
  });

  /* le jour entre façades qui se font face : l'écart ÷ la hauteur du plus haut */
  var ratio = Infinity;
  E.forEach(function(v, i){
    E.forEach(function(o, j){
      if(j <= i || lies(v, o)) return;
      var es = ecartSols(v, o);
      if(es.vis <= 8) return;
      ratio = Math.min(ratio, es.e / Math.max(haut(v), haut(o)));
    });
  });

  /* compacité, emprise, volume, part enterrée */
  var fac = 0, bat = 0, emp = 0, vol = 0, tot = 0, sous = 0;
  /* la façade se lit sur le CONTOUR : le mur commun d'un volume fusionné
     n'est pas une façade */
  E.forEach(function(v){
    var es = empSol(v);
    emp += es;
    etagesDe(v, vols).forEach(function(x){
      var e = x.e, a = aireEtage(e);
      vol += x.contour.aire * x.h;
      tot += a;
      if(lvlOf(e.i) < 0) sous += a;
      if(HN[e.i] === undefined) return;
      fac += x.contour.perim * x.h;
      bat += a;
    });
    vol += es * RULES.haut.acrotere;
  });
  /* LE RECOUVREMENT : ce que deux corps du même bâtiment partagent, compté une
     fois — emprise et volume hors tout, façade prise dans l'autre corps,
     plancher intérieur (`model.js — recouvrement`). */
  /* la hauteur d'un étage de corps, celle que la façade et le volume ont lue */
  function hautDe(v, e){
    var x = etagesDe(v, vols).filter(function(y){ return y.e === e; })[0];
    return x ? x.h : 0;
  }
  niveaux().forEach(function(n){
    var r = recouvrement(vols, n.i, true, hautDe), ri = recouvrement(vols, n.i, false).aire;
    if(!r.aire && !ri) return;
    vol -= r.volume;
    tot -= ri;
    if(lvlOf(n.i) < 0){ sous -= ri; return; }
    if(HN[n.i] === undefined) return;
    fac -= r.facade;
    bat -= ri;
  });
  var r0 = recouvrementSol(vols);
  emp -= r0;
  vol -= r0 * RULES.haut.acrotere;

  /* les cotes des corps d'école : dans les domaines des leviers, et au plus */
  var dn = 0, dok = 0, pmax = 0, el = 0, pt = 0, rang = 0, niv = 0, dirs = [], zlo = Infinity, zhi = -Infinity;
  var atts = attracteurs();
  E.forEach(function(v){
    niv = Math.max(niv, volNiv(v));
    var ok = alignement(v.a, atts).ecart < .035 || E.some(function(o){
      return o !== v && Math.abs(ecartAngle(2 * v.a, 2 * o.a)) < .07; });
    if(ok) rang++;
    if(v.fix) return;
    /* un volume fusionné est dans ses domaines quand chacune de ses ailes l'est */
    var dedansD = true;
    solRects(v).forEach(function(r){
      var Lg = Math.max(r.w, r.d), P = Math.min(r.w, r.d);
      if(!(Lg >= V.largeurMin - .01 && P >= V.profMin - .01)) dedansD = false;
      pmax = Math.max(pmax, P);
    });
    dn++;
    if(dedansD) dok++;
    var asv = assiseEff(v, vols);
    pt = Math.max(pt, asv.d);
    zlo = Math.min(zlo, asv.z); zhi = Math.max(zhi, asv.z);
    v.lv.forEach(function(e){
      if(lvlOf(e.i) >= 0) partsDe(e).forEach(function(p){
        el = Math.max(el, Math.max(p.w, p.d) / Math.max(1, Math.min(p.w, p.d))); });
    });
    var t = ((v.a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    if(!dirs.some(function(x){ var d = Math.abs(x - t); return Math.min(d, Math.PI / 2 - d) < .07; })) dirs.push(t);
  });

  /* les distances entre bâtiments distincts, et à l'existant */
  var pn = 0, pok = 0, pfeu = 0, dmin = Infinity, dex = Infinity;
  E.forEach(function(v, i){
    E.forEach(function(o, j){
      if(j <= i || lies(v, o)) return;
      var e = ecartVols(v, o);
      pn++; dmin = Math.min(dmin, e);
      if(e >= V.distVoulue - .01) pok++;
      if(e >= RULES.dist.entre - .01) pfeu++;
    });
    rectsHors(v).forEach(function(rc){
      obstaclesPres(rc, 40).forEach(function(P){ dex = Math.min(dex, ecartPoly(rc, P)); });
    });
  });

  /* la marge au périmètre, les classes en façade */
  var marge = Infinity, PF = profFacade(), fmax = 0;
  vols.forEach(function(v){
    v.lv.forEach(function(e){ volRects(v, e).forEach(function(r){ marge = Math.min(marge, margeAu(PER, r)); }); });
    if(!portClasses(v)) return;
    v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) partsDe(e).forEach(function(p){ fmax = Math.max(fmax, Math.min(p.w, p.d)); }); });
  });

  /* le second temps posé, en part de sa surface au programme */
  var S2 = secondTemps(), s2d = 0, s2p = 0;
  S2.forEach(function(x){ s2d += x.a; });
  vols.forEach(function(v){ if(v.ph) s2p += v.lv[0].w * v.lv[0].d; });
  var sp = E.filter(function(v){ return v.fix; });

  return {
    E:E, CL:CL, sud:sud, vue:vue, cotes:cotes, sportNord:sportNord, collectif:collectifVue(E, T), ratio:ratio, compa: bat ? fac / bat : 0,
    cour: courUtile(vols), emprise:emp, volume:vol, sousPart: tot ? sous / tot : 0,
    dn:dn, dok:dok, pmax:pmax, el:el, pente:pt, ecartRez:zhi > zlo ? zhi - zlo : 0, rang:rang, niv:niv, dirs:dirs.length,
    pn:pn, pok:pok, pfeu:pfeu, dmin:dmin, dex:dex, marge:marge, PF:PF, fmax:fmax,
    terrain: terrainLibre(vols), terrain0: terrainLibre(vols, 0), nappe: couverture(vols), pub: publicEcole(vols),
    ensembles: ensembles(E.filter(function(v){ return !v.fix; }), vols.ponts || []),
    second: s2d ? Math.min(1, s2p / s2d) : null,
    sport: sp.length ? (sp.some(function(v){ return !!v.joint; }) ? 1 : 0) : null,
    hmax: E.reduce(function(m, v){ return Math.max(m, haut(v)); }, 0)
  };
}
function moyenne(L){
  var tot = 0, m = 0;
  L.forEach(function(x){ tot += x.w; m += x.a * x.w; });
  return tot ? m / tot : 0;
}

/* ---------- 2. LES QUALITÉS DE L'ORIENTATION ----------------------------------
   `{ id: { id, n, niv, q, txt } }` — niv 2 favorable, 1 neutre, 0 défavorable ;
   q de −1 à +1, calée sur les mêmes seuils. Une ligne par ligne d'orientation
   du massing, plus les trois lignes du cadre choisi qui s'assouplissent. */
export function qualites(vols, L){
  L = L || lire(vols);
  function oriente(A){
    var tot = 0, bon = 0, mal = 0;
    A.forEach(function(x){
      tot += x.w;
      if(x.a <= V.orientBon) bon += x.w;
      if(x.a > V.orientMax) mal += x.w;
    });
    if(!tot) return { niv:1, q:0 };
    return { niv: bon / tot >= 2 / 3 ? 2 : mal / tot > 1 / 3 ? 0 : 1, q:(bon - mal) / tot };
  }
  var vu = oriente(L.vue);
  var paires = isFinite(L.ratio), pire = paires ? 1 - L.ratio / Math.max(1e-6, V.ombreK) : 0;
  var jour = !paires || pire <= 0 ? 2 : pire <= .25 ? 1 : 0;
  var dsh = L.dn ? L.dok / L.dn : 1, psh = L.pn ? L.pok / L.pn : 1, fsh = L.pn ? L.pfeu / L.pn : 1;
  var cu = L.cour, tl = L.terrain, nap = L.nappe, E = L.E, R = V.recul;
  var o = {};
  function q(id, n, niv, qq, txt){ o[id] = { id:id, n:n, niv:niv, q:qq, txt:txt }; }

  q("dims", "Des corps dans leurs fourchettes", dsh >= 1 ? 2 : dsh >= .5 ? 1 : 0, 2 * dsh - 1,
    L.dok + " volume" + (L.dok > 1 ? "s" : "") + " sur " + L.dn + " dans les domaines");
  q("distv", "Distance souhaitée entre bâtiments", psh >= 1 ? 2 : psh >= .5 ? 1 : 0, 2 * psh - 1,
    !L.pn ? "un seul bâtiment" : L.pok + " écart" + (L.pok > 1 ? "s" : "") + " sur " + L.pn
      + " à " + dec(V.distVoulue) + " m au moins");
  q("dist", "Distance incendie entre bâtiments", fsh >= 1 ? 2 : 0, 2 * fsh - 1,
    !L.pn ? "un seul bâtiment" : L.pfeu + " écart" + (L.pfeu > 1 ? "s" : "") + " sur " + L.pn
      + " à " + dec(RULES.dist.entre) + " m au moins");
  q("vue", "Vue vers le nord-ouest", vu.niv, vu.q,
    "façades longues à " + Math.round(moyenne(L.vue)) + "° du terrain de football");
  /* les classes : chaque façade longue +1 à l'est, +½ au sud, −1 au couchant,
     0 au nord. Une barre n'a qu'une façade à l'est au mieux — l'autre regarde
     l'ouest ou le nord —, d'où le double : la meilleure barre atteint +1. */
  var cb = 0, cm = 0, cs = 0, ct = 0;
  L.cotes.forEach(function(x){
    ct += x.w;
    if(ecartAz(x.az, 90) <= V.claEst) cb += x.w;
    else if(ecartAz(x.az, 247.5) <= V.claOuest) cm += x.w;
    else if(x.az > 90 && x.az < 270) cs += x.w;
  });
  var cq = ct ? borne(2 * (cb + cs / 2 - cm) / ct) : 0;
  q("cla-soleil", "Les classes à l'est, jamais au couchant",
    /* favorable : mieux qu'une barre nord-sud, que le sud seul ne fait qu'admettre */
    !ct ? 1 : cm / ct > 1 / 3 ? 0 : cq > .5 ? 2 : 1, cq,
    !ct ? "aucun corps de classes" : Math.round(100 * cb / ct) + " % des façades de classes à l'est, "
      + Math.round(100 * cs / ct) + " % au sud, " + Math.round(100 * cm / ct) + " % au couchant");
  var sn = L.sportNord;
  q("sport-nord", "La salle de sport ouverte au nord",
    sn == null ? 1 : palier(sn, V.sportNordBon, V.sportNordMax), sn == null ? 0 : lin(sn, V.sportNordBon, V.sportNordMax),
    sn == null ? "pas de salle de sport posée" : "façade longue à " + Math.round(sn) + "° du nord");
  var cn = cu.n ? ecartAz(azimut(Math.atan2(cu.n[1], cu.n[0])), 180) : null;
  q("cour-sud", "La cour et l'UAPE au soleil",
    cn == null ? 0 : palier(cn, V.courSudBon, V.courSudMax), cn == null ? -1 : lin(cn, V.courSudBon, V.courSudMax),
    cn == null ? "aucune cour" : "la cour s'ouvre à " + Math.round(cn) + "° du sud");
  var cr = cu.n ? distRoute({ x:cu.x, y:cu.y, w:0, d:0, a:0 }) : null, CR = V.courRoute;
  q("cour-route", "La cour à l'abri de la route",
    cr == null ? 0 : cr >= CR ? 2 : cr >= CR / 2 ? 1 : 0, cr == null ? -1 : CR ? borne(2 * cr / CR - 1) : 1,
    cr == null ? "aucune cour" : "centre de la cour à " + Math.round(cr) + " m de la rue");
  var cv = L.collectif;
  q("collectif-vue", "Hall, réfectoire et foyer vers la vue",
    !isFinite(cv) ? 0 : palier(cv, V.orientBon, V.orientMax), !isFinite(cv) ? -1 : lin(cv, V.orientBon, V.orientMax),
    !isFinite(cv) ? "aucune façade libre au rez" : "une façade libre du rez à " + Math.round(cv) + "° du terrain de football");
  q("jour", "Lumière entre bâtiments", jour, paires ? lin(Math.max(0, pire), 0, .25) : 1,
    !paires ? "aucune façade en vis-à-vis"
      : pire <= 0 ? "tous les vis-à-vis tiennent " + dec(V.ombreK) + " × la hauteur"
      : "le pire vis-à-vis manque " + Math.round(pire * 100) + " % de l'écart utile");
  /* le public d'un côté, l'école de l'autre : séparés par une ligne, et le
     public au-delà de la demi-largeur de l'école vers `V.pubAz` */
  var pe = L.pub, pq = pe.sep == null ? 0 : (lin(pe.sep, 0, V.pubMele) + borne(pe.cote / Math.max(1, pe.demi))) / 2;
  q("pub-est", "Le public d'un côté, l'école de l'autre",
    pe.sep == null ? 1 : pe.sep > V.pubMele || pe.cote < 0 ? 0 : pe.sep <= .01 && pe.cote >= pe.demi ? 2 : 1, pq,
    pe.sep == null ? "aucun volume public posé"
      : (pe.sep <= .01 ? "une ligne sépare public et école" : "public et école se recouvrent à " + Math.round(100 * pe.sep) + " %")
        + " ; le public à " + Math.round(pe.cote) + " m vers " + Math.round(V.pubAz) + "° (demi-école : " + Math.round(pe.demi) + " m)");
  /* la piscine et le CAD du côté public : leur place sur la parcelle, de 0 (côté
     opposé) à 1 (bord du côté public) — le moins avancé compte */
  var saz = V.pubAz * DEG, sux = Math.sin(saz), suy = Math.cos(saz), slo = Infinity, shi = -Infinity, ss = Infinity;
  PER.forEach(function(p){ var t = p[0] * sux + p[1] * suy; slo = Math.min(slo, t); shi = Math.max(shi, t); });
  vols.forEach(function(v){ if(v.ph) ss = Math.min(ss, (v.x * sux + v.y * suy - slo) / Math.max(1, shi - slo)); });
  var sok = isFinite(ss);
  q("second-est", "Piscine et chauffage du côté public",
    !sok ? 1 : ss >= V.secondBon ? 2 : ss < V.secondMax ? 0 : 1,
    !sok ? 0 : borne(2 * (ss - V.secondMax) / Math.max(.01, V.secondBon - V.secondMax) - 1),
    !sok ? "aucun ouvrage du second temps posé"
      : "piscine et CAD à " + Math.round(100 * ss) + " % de la parcelle vers " + Math.round(V.pubAz) + "°");
  q("compa", "Un volume compact", palier(L.compa, V.compaBon, V.compaMax), lin(L.compa, V.compaBon, V.compaMax),
    dec(Math.round(L.compa * 100) / 100) + " m² de façade par m² de plancher");
  q("align", "Des corps alignés", E.length && L.rang / E.length >= .5 ? 2 : 1,
    E.length ? L.rang / E.length : 0, L.rang + " corps sur " + E.length + " rangés sur le site ou un voisin");
  q("nivalign", "Des niveaux alignés", L.ecartRez <= .05 ? 2 : L.ecartRez <= 1 ? 1 : 0, lin(L.ecartRez, 0, 1),
    L.ecartRez <= .05 ? "tous les rez de l'école à la même altitude"
      : "jusqu'à " + dec(L.ecartRez) + " m d'écart entre les rez de l'école");
  q("pente", "Peu de terrassement", palier(L.pente, V.penteMax / 2, V.penteMax),
    lin(L.pente, V.penteMax / 2, V.penteMax), "jusqu'à " + dec(L.pente) + " m entre le rez et le terrain sous une emprise");
  q("elan", "Des corps pas trop élancés", L.el <= V.elanceMax ? 2 : 0,
    L.el <= V.elanceMax ? 1 : -borne((L.el - V.elanceMax) / V.elanceMax),
    "jusqu'à " + dec(Math.round(L.el * 10) / 10) + " fois plus long que large");
  /* un niveau ne porte pas plus que lui : sa surface rapportée à celle du
     niveau du dessus, corps par corps, hors sous-sol */
  var socle = Infinity, socleV = null;
  E.forEach(function(v){
    var hs = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; }).sort(function(p, q2){ return p.i - q2.i; });
    for(var k = 0; k + 1 < hs.length; k++){
      var r = aireEtage(hs[k]) / Math.max(1e-6, aireEtage(hs[k + 1]));
      if(r < socle){ socle = r; socleV = v; }
    }
  });
  var smin = V.socleMin / 100;
  q("socle", "Un étage n'est pas plus petit que le suivant",
    !isFinite(socle) || socle >= smin ? 2 : socle >= smin * .9 ? 1 : 0,
    !isFinite(socle) || socle >= smin ? 1 : borne((socle - smin) / Math.max(.01, smin)),
    !isFinite(socle) ? "aucun corps à étages"
      : "le plus petit niveau porte " + Math.round(socle * 100) + " % de celui du dessus"
        + (socle < smin && socleV ? " (" + nomV(socleV, vols.indexOf(socleV)).toLowerCase() + ")" : ""));
  q("connex", "Une école d'un seul tenant", L.ensembles <= 1 ? 2 : 1, L.ensembles <= 1 ? 1 : 0,
    L.ensembles <= 1 ? "l'école tient d'un seul tenant" : L.ensembles + " ensembles séparés"
      + ((vols.ponts || []).length ? ", " + vols.ponts.length + " passerelle"
        + (vols.ponts.length > 1 ? "s" : "") : ""));
  q("nappe", "Un sous-sol hors de la nappe", nap.niv, nap.q, nap.txt);
  q("terrain", "Place pour la cour et 70 places", tl.libre >= tl.besoin ? 2 : 0,
    borne((tl.libre - tl.besoin) / tl.besoin),
    fmt(Math.round(tl.libre)) + " m² libres pour " + fmt(tl.besoin) + " m² de cour et de "
      + RULES.ext.voitures + " places");
  /* le cadre choisi, lu comme une orientation quand on l'assouplit */
  q("recul", "Recul sur le périmètre", L.marge >= R - .01 ? 2 : L.marge >= R / 2 ? 1 : 0,
    R ? borne(2 * L.marge / R - 1) : 1, "à " + dec(Math.max(0, L.marge)) + " m de la limite au plus près");
  q("cour", "Cour utile minimale", cu.a >= V.courMin ? 2 : 0,
    V.courMin ? borne(2 * cu.a / V.courMin - 1) : 1, fmt(Math.round(cu.a)) + " m² utiles");
  q("facade", "Toutes les salles de classe en façade", L.fmax <= L.PF + .01 ? 2 : 0,
    L.fmax <= L.PF + .01 ? 1 : borne(1 - (L.fmax - L.PF) / 2),
    "corps de classes de " + dec(L.fmax) + " m de profondeur au plus");
  return o;
}
/* La couverture sur la nappe : terrain moyen sous le corps qui porte un
   sous-sol, moins 462,25 m, au moins `RULES.dist.couverture`. */
export function couverture(vols){
  var pire = Infinity, qui = -1;
  vols.forEach(function(v, k){
    if(!v.lv.some(function(e){ return lvlOf(e.i) < 0; })) return;
    var c = assiseVol(v).z - NAPPE;
    if(c < pire){ pire = c; qui = k; }
  });
  var R = RULES.dist.couverture;
  if(qui < 0) return { niv:2, q:1, txt:"aucun sous-sol", v:-1, c:null };
  return { niv: pire >= R - .005 ? 2 : 0, q: lin(Math.max(0, R - pire), 0, R / 2), v:qui, c:pire,
           txt: dec(pire) + " m de terrain au-dessus de la nappe sous "
             + nomV(vols[qui], qui).toLowerCase() + ", pour " + dec(R) + " m souhaités" };
}

/* j78 — la meilleure des deux coupes du Rendu (`vues()`) : la pente qu'elle
   montre sur le bâti et `FINAL.terrain` de chaque côté, rapportée au plus grand
   dénivelé sous une emprise (`pente`) ; l'existant qu'elle traverse, prolongée
   de `coupeExist` m. Moyenne des deux. */
function coupeLisible(vols, L){
  var W = vues(vols);
  if(!W) return null;
  var pts = [];
  ecole(vols).forEach(function(v){ solRects(v).forEach(function(r){ pts = pts.concat(coins(r)); }); });
  var best = null;
  W.liste.filter(function(x){ return x.coupe; }).forEach(function(x){
    var a = x.a, o = x.o, lo = Infinity, hi = -Infinity, zl = Infinity, zh = -Infinity, ex = 0, s;
    pts.forEach(function(p){ var t = (p[0] - o[0]) * a[0] + (p[1] - o[1]) * a[1]; lo = Math.min(lo, t); hi = Math.max(hi, t); });
    for(s = lo - FINAL.terrain; s <= hi + FINAL.terrain; s += 1){
      var z = terrain(o[0] + a[0] * s, o[1] + a[1] * s); zl = Math.min(zl, z); zh = Math.max(zh, z);
    }
    var E = RULES.plan.juge.coupeExist;
    for(s = lo - E; s <= hi + E && !ex; s += 1){
      var q = [o[0] + a[0] * s, o[1] + a[1] * s];
      ex = existants().some(function(e){ return dedans(e.P, q[0], q[1]); }) ? 1 : 0;
    }
    var p = L.pente > 0.05 ? Math.min(1, (zh - zl) / L.pente) : 1, sc = (p + ex) / 2;
    if(!best || sc > best) best = sc;
  });
  return best == null ? null : Math.round(best * 100) / 100;
}

/* Combien d'ensembles l'école fait-elle : corps accolés et passerelles relient. */
export function ensembles(E, ponts){
  var f = groupes(E, ponts), n = 0;
  E.forEach(function(v){ if(f(v.id) === v.id) n++; });
  return n;
}
/* `f(id)` : le volume de tête de l'ensemble d'un volume */
function groupes(E, ponts){
  var P = {};
  function f(x){ while(P[x] !== x) x = P[x] = P[P[x]]; return x; }
  function u(a, b){ if(P[a] !== undefined && P[b] !== undefined) P[f(a)] = f(b); }
  E.forEach(function(v){ P[v.id] = v.id; });
  var chef = {};
  E.forEach(function(v){
    if(v.joint) u(v.id, v.joint);
    if(v.bat){ if(chef[v.bat]) u(v.id, chef[v.bat]); else chef[v.bat] = v.id; }
  });
  ponts.forEach(function(p){ u(p.a, p.b); });
  return f;
}

/* ---------- 3. LES MESURES BRUTES -----------------------------------------------
   Les nombres que le jugement lit — sans seuil, sans tag, sans rien de la
   recherche. `null` : la mesure ne concerne pas ce bâtiment. */
export function mesuresMass(vols, L){
  L = L || lire(vols);
  function fini(x){ return isFinite(x) ? Math.round(x * 100) / 100 : null; }
  return Object.assign({
    soleil: fini(moyenne(L.sud)), vue: fini(moyenne(L.vue)),
    jourRatio: fini(L.ratio), compa: fini(L.compa), cour: Math.round(L.cour.a),
    terrainMarge: Math.round(L.terrain0.libre - L.terrain0.besoin),
    emprise: Math.round(L.emprise), volume: Math.round(L.volume),
    ensembles: L.ensembles, orientations: L.dirs, niveauxMax: L.niv,
    profMax: fini(L.pmax), elan: fini(L.el), pente: fini(L.pente),
    distMin: fini(L.dmin), distExistant: fini(L.dex), alignPart: L.E.length ? fini(L.rang / L.E.length) : null,
    couverture: L.nappe.c == null ? null : fini(L.nappe.c), sousSolPart: fini(L.sousPart),
    sportIntegre: L.sport, secondPose: L.second == null ? null : fini(L.second),
    pubSep: L.pub.sep == null ? null : fini(L.pub.sep), pubCote: L.pub.cote == null ? null : fini(L.pub.cote)
  }, jugesSite(vols, L, fini));
}

/* ---------- les jugements du site, traduits en mesures -----------------------
   Chaque mesure suit sa formule du jury (b9, b11, b12, c18, c19, c22, f51, f54,
   f55, i73, i74, e47, h69, h70). Les portées — la bande de 20 m, les 50 m de
   voisinage, les 40 m des rayons… — sont des FORMULES de mesure, donc du code,
   comme `COUR_FOND`. Le terrain se lit sur une grille au pas de `PAS`. */
var PAS = 2, VOISINS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], ENTRE = -Math.SQRT1_2, BANDE = 20, VOISINS = 50, RAYON = 40, ROUTE_PORTEE = 80, ZONE_MIN = 200;
var EXI = null, GRILLE = null, ROUTE_PTS = null;
/* l'existant : chaque emprise, sa boîte, sa hauteur (faîte − pied), et s'il est dans le périmètre */
function existants(){
  if(!EXI) EXI = (SITE.bat || []).map(function(P, i){
    var h = SITE.bath && SITE.bath[i];
    return { P:P, b:bbox(P), h: h ? h[1] - h[0] : 0,
             dans: P.some(function(p){ return dedans(PER, p[0], p[1]); }) };
  });
  return EXI;
}
function dansExistant(x, y){
  return existants().some(function(e){
    return x >= e.b.x0 && x <= e.b.x1 && y >= e.b.y0 && y <= e.b.y1 && dedans(e.P, x, y); });
}
/* les routes, échantillonnées au double pas — assez pour une ligne de vue */
function routePts(){
  if(ROUTE_PTS) return ROUTE_PTS;
  ROUTE_PTS = [];
  (SITE.rou || []).forEach(function(R){
    for(var k = 0; k + 1 < R.length; k++){
      var a = R[k], b = R[k + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * PAS)));
      for(var t = 0; t <= n; t++) ROUTE_PTS.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]);
    }
  });
  return ROUTE_PTS;
}
/* le terrain du périmètre hors existant, au pas, et la route la plus proche de chaque nœud */
function grille(){
  if(GRILLE) return GRILLE;
  /* chaque nœud a son numéro `n = i × NY + j`, une marge d'un nœud autour :
     les voisins d'un nœud sont `n ± NY` et `n ± 1`, et les tables sont typées */
  var B = bbox(PER), R = routePts(), C = [], NX = Math.ceil(B.w / PAS) + 3, NY = Math.ceil(B.h / PAS) + 3;
  var I = new Int32Array(NX * NY).fill(-1);
  for(var x = B.x0 + PAS / 2; x < B.x1; x += PAS) for(var y = B.y0 + PAS / 2; y < B.y1; y += PAS){
    if(!dedans(PER, x, y) || dansExistant(x, y)) continue;
    var best = null, d = Infinity;
    R.forEach(function(p){ var q = Math.hypot(p[0] - x, p[1] - y); if(q < d){ d = q; best = p; } });
    var c = { x:x, y:y, i:Math.round((x - B.x0) / PAS), j:Math.round((y - B.y0) / PAS), route:best, dr:d };
    c.n = c.i * NY + c.j;
    I[c.n] = C.length; C.push(c);
  }
  return GRILLE = { C:C, I:I, B:B, NX:NX, NY:NY, OFF:[NY, -NY, 1, -1] };
}
/* le point d'un rectangle le plus proche de (x, y), et sa distance — 0 dedans */
function proche(rc, x, y){
  var c = Math.cos(rc.a), s = Math.sin(rc.a), dx = x - rc.x, dy = y - rc.y;
  var u = Math.max(-rc.w / 2, Math.min(rc.w / 2, dx * c + dy * s));
  var v = Math.max(-rc.d / 2, Math.min(rc.d / 2, -dx * s + dy * c));
  var px = rc.x + u * c - v * s, py = rc.y + u * s + v * c;
  return { x:px, y:py, d:Math.hypot(x - px, y - py) };
}
/* les composantes d'un seul tenant des nœuds retenus, en m² */
function tenants(C, I, garde){
  var OFF = grille().OFF;
  var vu = {}, out = [];
  C.forEach(function(c, k){
    if(vu[k] || !garde(c)) return;
    var pile = [k], n = 0, tous = [];
    vu[k] = 1;
    while(pile.length){
      var q = C[pile.pop()]; n++; tous.push(q);
      OFF.forEach(function(o){
        var m = I[q.n + o];
        if(m >= 0 && !vu[m] && garde(C[m])){ vu[m] = 1; pile.push(m); }
      });
    }
    out.push({ a:n * PAS * PAS, C:tous });
  });
  return out;
}
/* la part d'existant (du périmètre) qu'aucun rectangle de `R` ne recouvre */
function existantLibre(R){
  var D = existants().filter(function(e){ return e.dans; });
  if(!D.length) return null;
  var libres = D.filter(function(e){
    return !R.some(function(r){
      return e.P.some(function(p){ return dansRect(r, p[0], p[1]); })
          || coins(r).some(function(q){ return dedans(e.P, q[0], q[1]); });
    });
  }).length;
  return libres / D.length;
}
function jugesSite(vols, L, fini){
  var E = L.E, CO = E.filter(function(v){ return !v.fix; }), R = [], RE = [], RE1 = [];
  /* les emprises au sol suffisent : un étage qui déborde est rare (f54 le juge) */
  vols.forEach(function(v){ solRects(v).forEach(function(r){ R.push(r); if(!v.ph) RE1.push(r); }); });
  E.forEach(function(v){ solRects(v).forEach(function(r){ RE.push(r); }); });
  function occupe(x, y){ return R.some(function(r){ return dansRect(r, x, y); }) || dansExistant(x, y); }

  function facade(x, y){
    var b = null;
    RE.forEach(function(r){ var p = proche(r, x, y); if(!b || p.d < b.d) b = p; });
    return b;
  }
  var G = grille(), F = G.C.filter(function(c){ return !R.some(function(r){ return dansRect(r, c.x, c.y); }); });
  var FI = new Int32Array(G.I.length).fill(-1); F.forEach(function(c, k){ FI[c.n] = k; });
  /* lus sur la grille dans le périmètre, au vrai dehors */
  function cle(x, y){
    var i = Math.floor((x - G.B.x0) / PAS) + 1, j = Math.floor((y - G.B.y0) / PAS) + 1;
    return i < 0 || j < 0 || i >= G.NX || j >= G.NY ? -1 : i * G.NY + j;
  }
  function libre(x, y){ var k = cle(x, y); return k >= 0 && FI[k] >= 0; }
  function pris(x, y){ var k = cle(x, y); return k >= 0 && G.I[k] >= 0 ? FI[k] < 0 : occupe(x, y); }

  /* b9 — l'emprise d'école dans la bande de 20 m du périmètre */
  var band = 0, tot = 0;
  RE.forEach(function(r){
    var c = Math.cos(r.a), s = Math.sin(r.a);
    for(var u = -r.w / 2 + PAS / 2; u < r.w / 2; u += PAS) for(var w = -r.d / 2 + PAS / 2; w < r.d / 2; w += PAS){
      tot++;
      if(bordDist(PER, r.x + u * c - w * s, r.y + u * s + w * c) <= BANDE) band++;
    }
  });

  /* b11 — la hauteur de l'école ÷ celle de l'existant à 50 m */
  var voisins = existants().filter(function(e){
    return e.h > 0 && RE.some(function(r){ return ecartPoly(r, e.P) <= VOISINS; }); });
  var hv = voisins.reduce(function(t, e){ return t + e.h; }, 0) / (voisins.length || 1);

  /* b12 — le parvis : le terrain libre entre une route et une façade d'école */
  var parvis = 0, pv = null;
  if(RE.length) tenants(F, FI, function(c){
    if(!c.route || c.dr > COUR_FOND) return false;
    var f = facade(c.x, c.y);
    if(f.d > COUR_FOND) return false;
    /* ENTRE les deux : la route et la façade de part et d'autre, à 135° au moins */
    var ax = c.route[0] - c.x, ay = c.route[1] - c.y, bx = f.x - c.x, by = f.y - c.y;
    return ax * bx + ay * by < ENTRE * Math.hypot(ax, ay) * Math.hypot(bx, by);
  }).forEach(function(t){ if(t.a > parvis){ parvis = t.a; pv = t; } });

  /* c18, c19 — depuis le centre de la cour utile */
  var cr = L.cour, fermee = null, abritee = null;
  function coupe(x0, y0, x1, y1, lim){
    var l = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(Math.min(l, lim) / PAS);
    for(var k = 1; k <= n; k++){ var t = Math.min(1, k * PAS / l); if(pris(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true; }
    return false;
  }
  if(cr.a > 0){
    var tou = 0;
    for(var k = 0; k < 36; k++){
      var t = k * 10 * DEG;
      if(coupe(cr.x, cr.y, cr.x + Math.cos(t) * RAYON, cr.y + Math.sin(t) * RAYON, RAYON)) tou++;
    }
    fermee = tou / 36;
    var lignes = routePts().filter(function(p){ return Math.hypot(p[0] - cr.x, p[1] - cr.y) <= ROUTE_PORTEE; });
    if(lignes.length) abritee = lignes.filter(function(p){
      return coupe(cr.x, cr.y, p[0], p[1], Infinity); }).length / lignes.length;
  }

  /* c22 — les zones libres de plus de 200 m² qui touchent une façade d'école */
  var zones = RE.length ? tenants(F, FI, function(){ return true; }).filter(function(t){
    return t.a > ZONE_MIN && t.C.some(contreEcole); }).length : null;
  /* un nœud contre une façade : un voisin pris par un corps d'école */
  function contreEcole(c){
    return VOISINS4.some(function(d){
      var x = c.x + d[0] * PAS, y = c.y + d[1] * PAS;
      return RE.some(function(r){ return dansRect(r, x, y); });
    });
  }

  /* f51, f55 — les profondeurs des corps d'école, au demi-mètre */
  var prof = {}, plancher = {}, ptot = 0, plv = {}, angles = 0;
  CO.forEach(function(v){
    angles += contourDe(v, v.lv.filter(function(e){ return lvlOf(e.i) === 0; })[0] || v.lv[0]).loops.reduce(function(n, l){ return n + l.length; }, 0);
    v.lv.forEach(function(e){
      if(lvlOf(e.i) < 0) return;
      partsDe(e).forEach(function(p){
        var d = Math.round(Math.min(p.w, p.d) * 2) / 2, a = p.w * p.d;
        plancher[d] = (plancher[d] || 0) + a; ptot += a; plv[v.id] = (plv[v.id] || 0) + a;
      });
    });
    solRects(v).forEach(function(r){
      var d = Math.round((Math.min(r.w, r.d) - 2 * RULES.haut.mur) * 2) / 2;
      prof[d] = (prof[d] || 0) + 1;
    });
  });
  var freq = Object.keys(prof).sort(function(a, b){ return prof[b] - prof[a]; })[0];

  /* f54 — le plus grand dépassement d'un étage sur celui du dessous ; la boîte
     du dessous fait foi (ponytail: un dessous en L est lu comme sa boîte) */
  var faux = 0;
  vols.forEach(function(v){
    if(v.ph) return;
    var lv = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; }).sort(function(a, b){ return lvlOf(a.i) - lvlOf(b.i); });
    for(var k = 1; k < lv.length; k++){
      var bo = boiteParts(lv[k - 1]);
      partsDe(lv[k]).forEach(function(p){
        faux = Math.max(faux, bo.x0 - (p.dx - p.w / 2), (p.dx + p.w / 2) - bo.x1,
                              bo.y0 - (p.dy - p.d / 2), (p.dy + p.d / 2) - bo.y1);
      });
    }
  });

  /* i74 — le plus grand rectangle libre collé à un corps d'école */
  var ext = 0;
  RE.forEach(function(rc){
    var c = Math.cos(rc.a), s = Math.sin(rc.a);
    [[[-s, c], [c, s], rc.w / 2, rc.d / 2], [[s, -c], [c, s], rc.w / 2, rc.d / 2],
     [[c, s], [-s, c], rc.d / 2, rc.w / 2], [[-c, -s], [-s, c], rc.d / 2, rc.w / 2]].forEach(function(f){
      var H = [];
      for(var u = -f[2] + PAS / 2; u < f[2]; u += PAS){
        var z = PAS / 2;
        while(z < COUR_FOND && libre(rc.x + f[0][0] * (f[3] + z) + f[1][0] * u, rc.y + f[0][1] * (f[3] + z) + f[1][1] * u)) z += PAS;
        H.push(z - PAS / 2);
      }
      ext = Math.max(ext, histoMax(H) * PAS);
    });
  });

  /* e47 — chaque corps de l'étape 2 contre le plus semblable de l'étape 1 */
  var P2 = vols.filter(function(v){ return v.ph; }), unite = null;
  function profV(v){ var r = solRects(v)[0]; return r ? Math.min(r.w, r.d) : 0; }
  if(P2.length && E.length) unite = P2.reduce(function(t, p){
    return t + Math.max.apply(null, E.map(function(v){
      var da = Math.abs(ecartAngle(4 * p.a, 4 * v.a)) / 4;
      return ((Math.abs(profV(p) - profV(v)) <= 1) + (da <= 10 * DEG) + (volNiv(p) === volNiv(v))) / 3;
    }));
  }, 0) / P2.length;

  /* h69 — les toits plats de l'école, posables, contre la surface visée */
  var toit = 0;
  E.forEach(function(v){
    var top = null;
    v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0 && (!top || lvlOf(e.i) > lvlOf(top.i))) top = e; });
    if(top) toit += aireEtage(top);
  });

  /* e44 — le plancher du plus grand ensemble, divisé par les orientations */
  var tete = groupes(CO, vols.ponts || []), ens = {}, geste = 0;
  CO.forEach(function(v){ ens[tete(v.id)] = (ens[tete(v.id)] || 0) + (plv[v.id] || 0); });
  Object.keys(ens).forEach(function(k){ geste = Math.max(geste, ens[k]); });

  return Object.assign({
    anglesPlancher: ptot ? fini(1000 * angles / ptot) : null,
    unGeste: ptot && L.dirs ? fini(geste / ptot / L.dirs) : null,
    /* j77 — la cour, le parvis ; le plan de situation ne les dessine pas encore (0) */
    situationLisible: fini(((L.cour.a >= V.courMin) + (parvis >= V["jb:b12"]) + 0) / 3),
    coupeLisible: coupeLisible(vols, L),
    rapportHauteur: voisins.length && L.hmax ? fini(L.hmax / hv) : null,
    parvis: Math.round(parvis),
    courFermee: fermee == null ? null : fini(fermee), courAbritee: abritee == null ? null : fini(abritee),
    zonesExt: zones,
    profondeursDistinctes: CO.length ? Object.keys(prof).length : null,
    porteAFaux: fini(Math.max(0, faux)),
    repetitionPart: ptot && freq != null ? fini((plancher[freq] || 0) / ptot) : null,
    chantierLibre: existantLibre(RE1), existantGarde: existantLibre(R),
    extensionPossible: RE.length ? fini(Math.min(1, ext / V.extEmprise)) : null,
    uniteEtapes: unite == null ? null : fini(unite),
    toitPV: E.length ? fini(toit * V.pvPart / V.pvVise) : null
  }, jugesPoses(vols, L, fini, { G:G, FI:FI, RE:RE, libre:libre, cle:cle, pv:pv }));
}

/* ---------- ce que le jugement POSE pour se lire ------------------------------
   Le terrain de sport, le parking et l'abri vélos ne sont pas des volumes : on
   les pose ici, le temps d'une mesure, dans le terrain libre — c21, c23, c26,
   c27, c28 — et l'on compare les étages entre eux (d36). Chaque pose prend la
   première place qui tient, dans l'ordre de ce que le critère préfère. */
var COUR_ECART = 30;      /* c26 : l'écart du parking à la cour qui vaut 1 */
var ETAGE_LISTE = 0.2, ETAGE_EMPRISE = 0.1;   /* d36 : ce qui fait deux étages différents */
function jugesPoses(vols, L, fini, T){
  var cr = L.cour, CO = new Uint8Array(T.FI.length);
  (cr.pts || []).forEach(function(p){ var k = T.cle(p[0], p[1]); if(k >= 0) CO[k] = 1; });
  function horsCour(x, y){ var k = T.cle(x, y); return k >= 0 && T.FI[k] >= 0 && !CO[k]; }
  /* un rectangle tient quand chacun de ses points au pas est retenu par `ok` */
  function tient(rc, ok){
    var c = Math.cos(rc.a), s = Math.sin(rc.a);
    for(var u = -rc.w / 2 + PAS / 2; u < rc.w / 2; u += PAS)
      for(var w = -rc.d / 2 + PAS / 2; w < rc.d / 2; w += PAS)
        if(!ok(rc.x + u * c - w * s, rc.y + u * s + w * c)) return false;
    return true;
  }
  function premier(cases, angles, w, d, ok){
    for(var a = 0; a < angles.length; a++) for(var k = 0; k < cases.length; k++){
      var rc = { x:cases[k].x, y:cases[k].y, w:w, d:d, a:angles[a] };
      if(tient(rc, ok)) return rc;
    }
    return null;
  }
  var libres = T.G.C.filter(function(c){ return T.FI[c.n] >= 0; }), OFF = T.G.OFF;
  /* le dégagement de chaque nœud libre, au pas (Manhattan : un majorant du
     vrai) — un centre moins dégagé que la demi-largeur ne peut rien porter */
  var DG = new Int16Array(T.FI.length), file = [];
  libres.forEach(function(c){
    if(OFF.some(function(o){ return T.FI[c.n + o] < 0; })){ DG[c.n] = 1; file.push(c); }
  });
  for(var q = 0; q < file.length; q++){
    var c0 = file[q];
    OFF.forEach(function(o){
      var k = c0.n + o;
      if(T.FI[k] >= 0 && !DG[k]){ DG[k] = DG[c0.n] + 1; file.push(T.G.C[T.G.I[k]]); }
    });
  }
  function centres(L, demi){ return L.filter(function(c){ return DG[c.n] * PAS >= demi; }); }

  /* c21 — le préau posé (aucun encore) et les avant-toits des façades sur la cour */
  var preau = preauProgramme(), couvert = (cr.lf || 0) * V.avantToit;

  /* c23 — le terrain de sport, hors cour, au plus près du nord-sud */
  var A5 = [], sportAxe = 90;
  for(var g = 0; g < 180; g += 5) A5.push(g * DEG);
  function auNS(a){ return Math.abs(ecartAngle(2 * a, Math.PI)) / 2; }
  A5.sort(function(p, q){ return auNS(p) - auNS(q); });
  var sp = premier(centres(libres, V.sportExtW / 2), A5, V.sportExtL, V.sportExtW, horsCour);
  if(sp) sportAxe = auNS(sp.a) / DEG;

  /* c26 — le parking, hors cour, au plus près d'une route ; son écart à la cour */
  var besoin = RULES.ext.voitures * RULES.ext.mPlace, pw = Math.sqrt(besoin * V.parcRatio), pd = besoin / pw;
  var A15 = []; for(g = 0; g < 180; g += 15) A15.push(g * DEG);
  var parc = null, bord = 0;
  centres(libres, pd / 2).sort(function(p, q){ return p.dr - q.dr; }).some(function(c){
    return A15.some(function(a){
      var rc = { x:c.x, y:c.y, w:pw, d:pd, a:a };
      if(!tient(rc, horsCour)) return false;
      parc = rc; return true;
    });
  });
  if(parc && cr.pts && cr.pts.length){
    var dc = Infinity;
    cr.pts.forEach(function(p){ dc = Math.min(dc, proche(parc, p[0], p[1]).d); });
    bord = Math.min(1, dc / COUR_ECART);
  }

  /* c27 — l'entrée piétons : le milieu de la façade d'école la plus proche du parvis */
  var ent = null;
  if(T.pv){
    var px = 0, py = 0;
    T.pv.C.forEach(function(c){ px += c.x; py += c.y; });
    px /= T.pv.C.length; py /= T.pv.C.length;
    T.RE.forEach(function(r){
      var c = Math.cos(r.a), s = Math.sin(r.a);
      [[r.w / 2, 0], [-r.w / 2, 0], [0, r.d / 2], [0, -r.d / 2]].forEach(function(m){
        var x = r.x + m[0] * c - m[1] * s, y = r.y + m[0] * s + m[1] * c, d = Math.hypot(x - px, y - py);
        if(!ent || d < ent.d) ent = { x:x, y:y, d:d };
      });
    });
  }
  /* les accès véhicules : la route au plus près du parking, et des livraisons —
     au plus près de l'école (ponytail: la mesure ne sait pas où sont les locaux
     techniques ; les chercher dans les plans des Typologies) ; la distance le
     long de la route est prise à vol d'oiseau entre les deux points de route */
  function routeDe(x, y){
    var b = null, d = Infinity;
    routePts().forEach(function(p){ var q = Math.hypot(p[0] - x, p[1] - y); if(q < d){ d = q; b = p; } });
    return b;
  }
  var acces = null;
  if(ent){
    var re = routeDe(ent.x, ent.y), V2 = [];
    if(parc) V2.push(routeDe(parc.x, parc.y));
    var liv = null;
    T.RE.forEach(function(r){ var p = routeDe(r.x, r.y); if(p && (!liv || Math.hypot(p[0] - r.x, p[1] - r.y) < liv.d)) liv = { p:p, d:Math.hypot(p[0] - r.x, p[1] - r.y) }; });
    if(liv) V2.push(liv.p);
    V2.forEach(function(p){ if(re && p){ var d = Math.hypot(p[0] - re[0], p[1] - re[1]); acces = acces == null ? d : Math.min(acces, d); } });
  }

  /* c28 — l'abri vélos contre une façade d'école, au plus près de l'entrée */
  var velos = null;
  if(ent){
    var cote = Math.sqrt(RULES.ext.velos * V.mVelo), cand = [];
    T.RE.forEach(function(r){
      var c = Math.cos(r.a), s = Math.sin(r.a);
      [[[-s, c], [c, s], r.w / 2, r.d / 2], [[s, -c], [c, s], r.w / 2, r.d / 2],
       [[c, s], [-s, c], r.d / 2, r.w / 2], [[-c, -s], [-s, c], r.d / 2, r.w / 2]].forEach(function(f){
        for(var u = -f[2] + cote / 2; u <= f[2] - cote / 2; u += PAS){
          var x = r.x + f[0][0] * (f[3] + cote / 2 + .1) + f[1][0] * u, y = r.y + f[0][1] * (f[3] + cote / 2 + .1) + f[1][1] * u;
          cand.push({ x:x, y:y, a:r.a, d:Math.hypot(x - ent.x, y - ent.y) });
        }
      });
    });
    cand.sort(function(p, q){ return p.d - q.d; });
    velos = 999;
    cand.some(function(k){
      if(!tient({ x:k.x, y:k.y, w:cote, d:cote, a:k.a }, T.libre)) return false;
      velos = k.d; return true;
    });
  }

  /* d36 — chaque étage contre celui du dessous : ses locaux, son emprise */
  var N = horsSol().slice().sort(function(p, q){ return p.lvl - q.lvl; }), dif = 0, haut = 0;
  function locaux(i){ var o = {}; onFloor(i).forEach(function(b){ o[b.key] = (o[b.key] || 0) + areaOf(b); }); return o; }
  function emprise(i){ var a = 0; vols.forEach(function(v){ var e = volEtage(v, i); if(e && !v.ph) a += aireEtage(e); }); return a; }
  for(var k = 1; k < N.length; k++){
    var A = locaux(N[k].i), B = locaux(N[k - 1].i), ec = 0, tot = 0, cles = {};
    Object.keys(A).concat(Object.keys(B)).forEach(function(x){ cles[x] = 1; });
    Object.keys(cles).forEach(function(x){ ec += Math.abs((A[x] || 0) - (B[x] || 0)); tot += A[x] || 0; });
    var e1 = emprise(N[k].i), e0 = emprise(N[k - 1].i);
    haut++;
    if((tot && ec / tot > ETAGE_LISTE) || (e0 && Math.abs(e1 - e0) / e0 > ETAGE_EMPRISE)) dif++;
  }

  return {
    couvertPart: preau ? fini(Math.min(1, couvert / preau)) : null,
    sportExtAxe: fini(sportAxe),
    voituresBord: fini(bord),
    accesSepares: acces == null ? null : fini(acces),
    velosDist: velos == null ? null : fini(velos),
    niveauxDifferents: haut ? fini(dif / haut) : null
  };
}
/* la boîte des parts d'un niveau, dans le repère du volume */
function boiteParts(e){
  var b = { x0:Infinity, y0:Infinity, x1:-Infinity, y1:-Infinity };
  partsDe(e).forEach(function(p){
    b.x0 = Math.min(b.x0, p.dx - p.w / 2); b.x1 = Math.max(b.x1, p.dx + p.w / 2);
    b.y0 = Math.min(b.y0, p.dy - p.d / 2); b.y1 = Math.max(b.y1, p.dy + p.d / 2);
  });
  return b;
}
/* le plus grand rectangle sous un histogramme de profondeurs (largeur 1 par colonne) */
function histoMax(H){
  var best = 0;
  for(var i = 0; i < H.length; i++){
    var h = Infinity;
    for(var j = i; j < H.length; j++){ h = Math.min(h, H[j]); if(!h) break; best = Math.max(best, h * (j - i + 1)); }
  }
  return best;
}

/* ---------- le bâtiment entier ---------------------------------------------------
   Le programme réparti, la volumétrie ET le plan des Typologies tiré dedans, à
   la seed typologie du moment — ou à `graineTypo` : ce que le jury voit.
   `main` : les notes posées à la main sur une variante enregistrée. C'est le
   seul endroit où les plans rejoignent la note — le rail du Massing, la page
   Paramètres, les variantes et le classement de `genMass()` (à la seed par
   défaut) les reçoivent d'ici. */
export function evaluer(vols, main, graineTypo){
  if(!vols || !vols.length) return null;
  oublier();
  var L = lire(vols), Q = qualites(vols, L), E = ecarts(vols, false, Q);
  var mes = Object.assign({}, mesuresMix(), mesuresMass(vols, L));
  return joindre({ mes:mes, qualites:Q, ecarts:E }, typoDe(vols, graineTypo), main);
}
/* Un plan qui ne se tire pas — un bâtiment importé aux volumes inattendus —
   ne casse pas la note : ses critères sont sans objet, le reste est noté. */
function typoDe(vols, graine){
  try { return evaluerTypo(vols, vols.ponts || [], graine); }
  catch(e){ console.error(e); return { mes:{}, ecarts:[] }; }
}
function joindre(ev, T, main, moy){
  var mes = Object.assign({}, ev.mes, T.mes), A = RULES.plan.juge.angles;
  /* d29 — peu d'angles d'emprise (massing), une circulation par niveau (plans) */
  var pa = mes.anglesPlancher == null ? null : Math.max(0, Math.min(1, (A[1] - mes.anglesPlancher) / (A[1] - A[0])));
  var lis = [pa, mes.circUnique].filter(function(x){ return x != null; });
  mes.lisibilite = lis.length ? lis.reduce(function(a, b){ return a + b; }, 0) / lis.length : null;
  var E = ev.ecarts.filter(function(x){ return x.c !== "typo"; }).concat(T.ecarts);
  return { mes:mes, qualites:ev.qualites, ecarts:E,
           invalide: E.some(function(x){ return x.sev === "e" && !x.pile; }),
           notifie: E.some(function(x){ return x.sev !== "e"; }),
           jugement: noter(mes, main, moy) };
}
/* Une autre typologie dans les MÊMES volumes : seule la part du plan est
   refaite — la recherche en essaie plusieurs par volume sans remesurer le
   massing. `moy` : la moyenne des notes manuelles, comme `resumeCourant()`. */
export function renoterTypo(ev, vols, moy){ return joindre(ev, typoDe(vols), null, moy); }
/* Les lignes que les PLANS enfreignent en rouge — une fois chacune : ce qui rend
   la note invalide sans que le contrôle du massing en dise rien. */
export function rougesTypo(ev){
  var o = [];
  ((ev && ev.ecarts) || []).forEach(function(x){ if(x.c === "typo" && x.sev === "e" && o.indexOf(x.k) < 0) o.push(x.k); });
  return o;
}
export function evaluationCourante(main){
  if(!MASS.vol.length) return null;
  var v = MASS.vol;
  v.ponts = MASS.pont;
  return evaluer(v, main);
}
/* Pour le générateur : la qualité de chaque ligne et les mesures, d'un seul
   passage — la cour ne se mesure qu'une fois. */
export function lecture(vols){
  var L = lire(vols);
  return { q: qualites(vols, L), mes: mesuresMass(vols, L) };
}
export { lu };
