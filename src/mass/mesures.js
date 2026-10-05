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
import { NAPPE, PER } from "../data/site.js";
import { V, courProgramme, enVigueur, lu, recul, reculVise, severite } from "../data/cadre.js";
import { feuExige, imposees } from "../data/orientation.js";
import { noter } from "../data/jugement.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { FLOORS, lvlOf, onFloor } from "../mix/floors.js";
import { mesuresMix } from "../mix/mesures.js";
import { airePosable, alignement, assise, attracteurs, cibleVue, dansRect, dedans, ecart,
  ecartAngle, ecartPoly, margeAu, visAVis } from "./geom.js";
import { CONTACT, MASS, bilan, etagesDe, horsModule, horsSol, niveaux, pontRect, postesDe,
  profFacade, secondTemps, volNiv, volRect, volTitre as nomV } from "./model.js";
import { ecartVols, lies, obstaclesPres, rectSol, rectsHors } from "./gen.js";

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
  vols.forEach(function(v){ var rc = rectSol(v); emp += rc.w * rc.d; });
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
  E.forEach(function(v){
    var rc = rectSol(v);
    OB = obstaclesPres(rc, COUR_FOND);
    var c = Math.cos(rc.a), s = Math.sin(rc.a);
    [[[-s, c], [c, s], rc.w / 2, rc.d / 2], [[s, -c], [c, s], rc.w / 2, rc.d / 2],
     [[c, s], [-s, c], rc.d / 2, rc.w / 2], [[-c, -s], [-s, c], rc.d / 2, rc.w / 2]]
      .forEach(function(f){
        var n = f[0], t = f[1], a = 0, u, z;
        for(u = -f[2] + pas / 2; u < f[2]; u += pas){
          for(z = pas / 2; z < COUR_FOND; z += pas){
            var x = rc.x + n[0] * (f[3] + z) + t[0] * u;
            var y = rc.y + n[1] * (f[3] + z) + t[1] * u;
            if(!libre(x, y)) break;
            a += pas * pas;
          }
        }
        if(a > best.a) best = { a:a, v:vols.indexOf(v) };
      });
  });
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
    vols[i].lv.forEach(function(e){ mm = Math.min(mm, margeAu(PER, volRect(vols[i], e))); });
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
      if(e < FEU - .01 && !(L && e >= -CONTACT))
        dit("dist", i, nomV(vols[i], i) + " et " + nomV(vols[j], j).toLowerCase()
          + (e < 0 ? " s'interpénètrent." : " sont à " + dec(e) + " m : la distance "
            + "incendie est de " + dec(FEU) + " m."), 0, j);
    }
  }

  /* les cotes : le module, les classes en façade — deux choix à nous */
  var PF = profFacade(), MOD = enVigueur("module"), FAC = enVigueur("facade");
  for(i = 0; i < vols.length && !stop(); i++){
    var v = vols[i], cla = FAC && portClasses(v), vu = {};
    v.lv.forEach(function(e){
      var sol = lvlOf(e.i) >= 0, pt = Math.min(e.w, e.d);
      function une(k, msg){ if(!vu[k]){ vu[k] = 1; dit(k, i, msg); } }
      if(MOD && (horsModule(e.w) || horsModule(e.d)))
        une("module", nomV(v, i) + " — " + dec(e.w) + " × " + dec(e.d) + " m : hors du module de "
          + dec(V.module) + " m.");
      if(!sol || v.fix) return;
      if(cla && pt > PF + .01)
        une("facade", nomV(v, i) + " porte des classes sur " + dec(pt) + " m de profondeur : "
          + "au-delà de " + dec(PF) + " m — deux salles —, une salle n'a plus de façade.");
    });
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
        return !v.fix && assise(rectSol(v)).d >= 1; });
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
    vols.forEach(function(v){ if(v.ph) return; v.lv.forEach(function(e){ if(e.i === n.i) po += e.w * e.d; }); });
    return { i:n.i, nom:n.nom, demande:n.A, pose:po, ecart:po - n.A };
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
function normale(v){
  var r = rectSol(v);
  return r.w >= r.d ? v.a + Math.PI / 2 : v.a;
}
/* L'optimum soleil-vue en un point : la façade longue qui partage l'écart entre
   le sud et la direction du terrain de football. Rend l'angle du grand axe. */
export function angleSoleilVue(x, y){
  var T = cibleVue(), pv = Math.atan2(T.y - y, T.x - x);
  return ecartAngle(pv, Math.PI / 2) / 2;
}

function lire(vols){
  var E = ecole(vols), N = horsSol(), HN = {};
  N.forEach(function(n){ HN[n.i] = n.h; });
  function haut(v){
    var h = 0;
    v.lv.forEach(function(e){ if(HN[e.i] !== undefined) h += e.h || HN[e.i]; });
    return h + RULES.haut.acrotere;
  }
  var CL = E.filter(portClasses);
  if(!CL.length) CL = E.filter(function(v){ return !v.fix; });
  var T = cibleVue();

  /* les façades longues des corps de classes, pondérées par leur longueur × les
     étages : leur écart au sud et à la vue */
  function angles(f){
    return CL.map(function(v){
      var r = rectSol(v);
      return { w: Math.max(r.w, r.d) * Math.max(1, rectsHors(v).length), a: Math.abs(f(v, r)) / DEG };
    });
  }
  var sud = angles(function(v){ return ecartAngle(normale(v), Math.PI / 2); });
  var vue = angles(function(v, r){ return ecartAngle(normale(v), Math.atan2(T.y - r.y, T.x - r.x)); });

  /* le jour entre façades qui se font face : l'écart ÷ la hauteur du plus haut */
  var ratio = Infinity;
  E.forEach(function(v, i){
    E.forEach(function(o, j){
      if(j <= i || lies(v, o)) return;
      var a = rectSol(v), b = rectSol(o);
      if(visAVis(a, b) <= 8) return;
      ratio = Math.min(ratio, ecart(a, b) / Math.max(haut(v), haut(o)));
    });
  });

  /* compacité, emprise, volume, part enterrée */
  var fac = 0, bat = 0, emp = 0, vol = 0, tot = 0, sous = 0;
  E.forEach(function(v){
    var rs = rectSol(v);
    emp += rs.w * rs.d;
    v.lv.forEach(function(e){
      tot += e.w * e.d;
      if(lvlOf(e.i) < 0) sous += e.w * e.d;
      if(HN[e.i] === undefined) return;
      var r = volRect(v, e);
      fac += 2 * (r.w + r.d) * (e.h || HN[e.i]);
      bat += e.w * e.d;
    });
    etagesDe(v).forEach(function(x){ vol += x.rc.w * x.rc.d * x.h; });
    vol += rs.w * rs.d * RULES.haut.acrotere;
  });

  /* les cotes des corps d'école : dans les domaines des leviers, et au plus */
  var dn = 0, dok = 0, pmax = 0, el = 0, pt = 0, rang = 0, niv = 0, dirs = [];
  var atts = attracteurs();
  E.forEach(function(v){
    niv = Math.max(niv, volNiv(v));
    var ok = alignement(v.a, atts).ecart < .035 || E.some(function(o){
      return o !== v && Math.abs(ecartAngle(2 * v.a, 2 * o.a)) < .07; });
    if(ok) rang++;
    if(v.fix) return;
    var r = rectSol(v), Lg = Math.max(r.w, r.d), P = Math.min(r.w, r.d);
    dn++;
    if(Lg >= V.largeurMin - .01 && P >= V.profMin - .01) dok++;
    pmax = Math.max(pmax, P);
    pt = Math.max(pt, assise(r).d);
    v.lv.forEach(function(e){
      if(lvlOf(e.i) >= 0) el = Math.max(el, Math.max(e.w, e.d) / Math.max(1, Math.min(e.w, e.d)));
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
    v.lv.forEach(function(e){ marge = Math.min(marge, margeAu(PER, volRect(v, e))); });
    if(!portClasses(v)) return;
    v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) fmax = Math.max(fmax, Math.min(e.w, e.d)); });
  });

  /* le second temps posé, en part de sa surface au programme */
  var S2 = secondTemps(), s2d = 0, s2p = 0;
  S2.forEach(function(x){ s2d += x.a; });
  vols.forEach(function(v){ if(v.ph) s2p += v.lv[0].w * v.lv[0].d; });
  var sp = E.filter(function(v){ return v.fix; });

  return {
    E:E, CL:CL, sud:sud, vue:vue, ratio:ratio, compa: bat ? fac / bat : 0,
    cour: courUtile(vols), emprise:emp, volume:vol, sousPart: tot ? sous / tot : 0,
    dn:dn, dok:dok, pmax:pmax, el:el, pente:pt, rang:rang, niv:niv, dirs:dirs.length,
    pn:pn, pok:pok, pfeu:pfeu, dmin:dmin, dex:dex, marge:marge, PF:PF, fmax:fmax,
    terrain: terrainLibre(vols), terrain0: terrainLibre(vols, 0), nappe: couverture(vols),
    ensembles: ensembles(E.filter(function(v){ return !v.fix; }), vols.ponts || []),
    second: s2d ? Math.min(1, s2p / s2d) : null,
    sport: sp.length ? (sp.some(function(v){ return !!v.joint; }) ? 1 : 0) : null
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
  q("jour", "Lumière entre bâtiments", jour, paires ? lin(Math.max(0, pire), 0, .25) : 1,
    !paires ? "aucune façade en vis-à-vis"
      : pire <= 0 ? "tous les vis-à-vis tiennent " + dec(V.ombreK) + " × la hauteur"
      : "le pire vis-à-vis manque " + Math.round(pire * 100) + " % de l'écart utile");
  q("compa", "Un volume compact", palier(L.compa, V.compaBon, V.compaMax), lin(L.compa, V.compaBon, V.compaMax),
    dec(Math.round(L.compa * 100) / 100) + " m² de façade par m² de plancher");
  q("align", "Des corps alignés", E.length && L.rang / E.length >= .5 ? 2 : 1,
    E.length ? L.rang / E.length : 0, L.rang + " corps sur " + E.length + " rangés sur le site ou un voisin");
  q("pente", "Peu de terrassement", palier(L.pente, V.penteMax / 2, V.penteMax),
    lin(L.pente, V.penteMax / 2, V.penteMax), "jusqu'à " + dec(L.pente) + " m de dénivelé sous une emprise");
  q("elan", "Des corps pas trop élancés", L.el <= V.elanceMax ? 2 : 0,
    L.el <= V.elanceMax ? 1 : -borne((L.el - V.elanceMax) / V.elanceMax),
    "jusqu'à " + dec(Math.round(L.el * 10) / 10) + " fois plus long que large");
  /* un niveau ne porte pas plus que lui : sa surface rapportée à celle du
     niveau du dessus, corps par corps, hors sous-sol */
  var socle = Infinity, socleV = null;
  E.forEach(function(v){
    var hs = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; }).sort(function(p, q2){ return p.i - q2.i; });
    for(var k = 0; k + 1 < hs.length; k++){
      var r = (hs[k].w * hs[k].d) / Math.max(1e-6, hs[k + 1].w * hs[k + 1].d);
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
    var c = assise(rectSol(v)).z - NAPPE;
    if(c < pire){ pire = c; qui = k; }
  });
  var R = RULES.dist.couverture;
  if(qui < 0) return { niv:2, q:1, txt:"aucun sous-sol", v:-1, c:null };
  return { niv: pire >= R - .005 ? 2 : 0, q: lin(Math.max(0, R - pire), 0, R / 2), v:qui, c:pire,
           txt: dec(pire) + " m de terrain au-dessus de la nappe sous "
             + nomV(vols[qui], qui).toLowerCase() + ", pour " + dec(R) + " m souhaités" };
}

/* Combien d'ensembles l'école fait-elle : corps accolés et passerelles relient. */
export function ensembles(E, ponts){
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
  var n = 0;
  E.forEach(function(v){ if(f(v.id) === v.id) n++; });
  return n;
}

/* ---------- 3. LES MESURES BRUTES -----------------------------------------------
   Les nombres que le jugement lit — sans seuil, sans tag, sans rien de la
   recherche. `null` : la mesure ne concerne pas ce bâtiment. */
export function mesuresMass(vols, L){
  L = L || lire(vols);
  function fini(x){ return isFinite(x) ? Math.round(x * 100) / 100 : null; }
  return {
    soleil: fini(moyenne(L.sud)), vue: fini(moyenne(L.vue)),
    jourRatio: fini(L.ratio), compa: fini(L.compa), cour: Math.round(L.cour.a),
    terrainMarge: Math.round(L.terrain0.libre - L.terrain0.besoin),
    emprise: Math.round(L.emprise), volume: Math.round(L.volume),
    ensembles: L.ensembles, orientations: L.dirs, niveauxMax: L.niv,
    profMax: fini(L.pmax), elan: fini(L.el), pente: fini(L.pente),
    distMin: fini(L.dmin), distExistant: fini(L.dex), alignPart: L.E.length ? fini(L.rang / L.E.length) : null,
    couverture: L.nappe.c == null ? null : fini(L.nappe.c), sousSolPart: fini(L.sousPart),
    sportIntegre: L.sport, secondPose: L.second == null ? null : fini(L.second)
  };
}

/* ---------- le bâtiment entier ---------------------------------------------------
   Le programme réparti ET la volumétrie : ce que le jury voit. `main` : les
   notes posées à la main sur une variante enregistrée. */
export function evaluer(vols, main){
  if(!vols || !vols.length) return null;
  oublier();
  var L = lire(vols), Q = qualites(vols, L), E = ecarts(vols, false, Q);
  var mes = Object.assign({}, mesuresMix(), mesuresMass(vols, L));
  return { mes:mes, qualites:Q, ecarts:E,
           invalide: E.some(function(x){ return x.sev === "e" && !x.pile; }),
           notifie: E.some(function(x){ return x.sev !== "e"; }),
           jugement: noter(mes, main) };
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
