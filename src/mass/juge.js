/* ============================================================================
   LE JUGEMENT D'UNE VARIANTE — SANS UN SEUL POINT

   Le générateur ne somme plus rien. Une variante se juge en trois temps, et
   aucun ne se convertit en nombre :

     1. les CONTRAINTES DURES — `dures()` rend la liste de ce qu'elle enfreint.
        Une seule suffit : la variante est invalide, elle n'est pas proposée ;
     2. les PRIORITÉS FORTES — `qualites().fortes`, chacune favorable (2),
        neutre (1) ou défavorable (0). On écarte toute variante qu'une autre
        BAT : au moins aussi bonne partout, meilleure quelque part ;
     3. les PRÉFÉRENCES — `qualites().prefs`, même échelle. Elles ne départagent
        que des variantes ÉGALES sur les priorités fortes.

   Ce qui reste est un ensemble de variantes qu'aucune autre ne bat. `choisir()`
   y tire un parti, puis une variante : c'est ce qui garde la diversité — une
   priorité oriente la recherche, elle n'impose pas une forme.

   Les seuils vivent dans `src/data/doctrine.js`, et l'`id` de chaque critère
   est celui de sa ligne dans `REGLES` : le volet « Contraintes » affiche la
   règle et ce qu'elle dit de la composition à l'écran au même endroit.
   ========================================================================= */
import { dec, fmt } from "../core/format.js";
import { ITEMBYKEY, ITEMS } from "../core/model.js";
import { NAPPE, PER } from "../data/site.js";
import { DOC, RANGS_MASS, reglesDe } from "../data/doctrine.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { FLOORS, lvlOf, onFloor } from "../mix/floors.js";
import { airePosable, alignement, assise, attracteurs, cibleVue, dansRect, dedans, ecart,
  ecartAngle, ecartPoly, margeAu, visAVis } from "./geom.js";
import { MASS, horsModule, horsSol, pontRect, porteAFaux, postesDe, profBornes,
  profFacade, volRect } from "./model.js";
import { ecartVols, lies, obstaclesPres, rectSol, rectsHors } from "./gen.js";

var DEG = Math.PI / 180;
function nomV(v, k){ return v.nom || (v.fix ? "Salle de sport" : "Volume " + (k + 1)); }
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

/* La cour et son préau au PROGRAMME (chapitre Extérieurs), et le terrain que
   demandent la cour et le stationnement (art. 2.4) : une source, lue par le
   jugement et par le contrôle. */
export function courProgramme(){
  var a = 0;
  ITEMS.forEach(function(it){ if(it.f === "ext") a += it.nb * it.u; });
  return Math.round(a) || 500;
}
export function terrainLibre(vols){
  var emp = 0;
  vols.forEach(function(v){ var r = rectSol(v); emp += r.w * r.d; });
  var posable = airePosable(RULES.dist.retrait);
  return { libre: posable - emp, posable: posable,
           besoin: courProgramme() + RULES.ext.voitures * RULES.ext.mPlace };
}

/* ---------- la cour utile ----------------------------------------------------
   Le terrain libre D'UN SEUL TENANT devant une façade d'école : de chaque point
   de la façade, on avance droit devant jusqu'au premier obstacle — la limite du
   périmètre, un bâtiment, l'existant — ou jusqu'à `DOC.courFond`. La meilleure
   façade donne la cour. Un seul corps a donc une cour : devant lui ; une figure
   en U la tient entre ses ailes. Aucune forme n'est imposée. */
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
    OB = obstaclesPres(rc, DOC.courFond);
    var c = Math.cos(rc.a), s = Math.sin(rc.a);
    /* les quatre façades : [normale, tangente, demi-longueur, demi-épaisseur] */
    [[[-s, c], [c, s], rc.w / 2, rc.d / 2], [[s, -c], [c, s], rc.w / 2, rc.d / 2],
     [[c, s], [-s, c], rc.d / 2, rc.w / 2], [[-c, -s], [-s, c], rc.d / 2, rc.w / 2]]
      .forEach(function(f){
        var n = f[0], t = f[1], a = 0, u, z;
        for(u = -f[2] + pas / 2; u < f[2]; u += pas){
          for(z = pas / 2; z < DOC.courFond; z += pas){
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

/* ---------- 1. LES CONTRAINTES DURES -----------------------------------------
   Une entrée par écart : `{ k, v, msg }`, `k` étant l'id de la règle. `vite`
   rend au premier écart — c'est ce que veut le générateur. `pile` marque un
   écart qu'aucune composition ne peut résoudre (il se règle au mixer) : le
   générateur ne jette pas une variante pour lui. */
export function dures(vols, vite){
  var out = [];
  function dit(k, v, msg, pile, v2){
    out.push({ k:k, v:v, v2: v2 == null ? -1 : v2, msg:msg, pile:pile ? 1 : 0 });
  }
  var i, j, stop = function(){ return vite && out.length; };

  /* le périmètre et le recul du PACom, à tous les étages */
  for(i = 0; i < vols.length && !stop(); i++){
    var mm = Infinity;
    vols[i].lv.forEach(function(e){ mm = Math.min(mm, margeAu(PER, volRect(vols[i], e))); });
    if(mm < RULES.dist.retrait - .01)
      dit("perim", i, nomV(vols[i], i) + (mm < 0 ? " sort du périmètre de " + dec(-mm) + " m."
        : " est à " + dec(mm) + " m de la limite ; le recul du PACom est de "
          + dec(RULES.dist.retrait) + " m."));
  }
  (vols.ponts || []).forEach(function(p){
    var r = pontRect(p, vols);
    if(r && margeAu(PER, r) < RULES.dist.retrait - .01 && !stop())
      dit("perim", -1, "Une passerelle franchit le recul du PACom.");
  });

  /* les distances : entre bâtiments, à tous les étages ; à l'existant */
  for(i = 0; i < vols.length && !stop(); i++){
    for(j = i + 1; j < vols.length && !stop(); j++){
      var e = ecartVols(vols[i], vols[j]), m = lies(vols[i], vols[j]) ? 0 : DOC.distMin;
      if(e < m - .01)
        dit("dist", i, nomV(vols[i], i) + " et " + nomV(vols[j], j).toLowerCase()
          + (e < 0 ? " s'interpénètrent." : " sont à " + dec(e) + " m, pour "
            + dec(DOC.distMin) + " m au moins."), 0, j);
    }
    rectsHors(vols[i]).forEach(function(rc){
      if(stop()) return;
      var OB = obstaclesPres(rc, DOC.distMin);
      for(var k = 0; k < OB.length; k++){
        var eb = ecartPoly(rc, OB[k]);
        if(eb < DOC.distMin - .01){
          dit("existant", i, nomV(vols[i], i) + (eb < 0 ? " recouvre un bâtiment existant."
            : " est à " + dec(eb) + " m d'un bâtiment existant, pour "
              + dec(DOC.distMin) + " m au moins."));
          return;
        }
      }
    });
  }

  /* les cotes : largeur, profondeur, classes en façade, module */
  var B = profBornes(), PF = profFacade();
  for(i = 0; i < vols.length && !stop(); i++){
    var v = vols[i], cla = portClasses(v), vu = {};
    v.lv.forEach(function(e){
      var sol = lvlOf(e.i) >= 0, pt = Math.min(e.w, e.d);
      function une(k, msg){ if(!vu[k]){ vu[k] = 1; dit(k, i, msg); } }
      if(horsModule(e.w) || horsModule(e.d))
        une("module", nomV(v, i) + " — " + dec(e.w) + " × " + dec(e.d) + " m : hors du module de "
          + dec(DOC.module) + " m.");
      if(!sol || v.fix) return;
      if(pt < DOC.largeurMin - .01)
        une("largeur", nomV(v, i) + " ne fait que " + dec(pt) + " m de large, pour "
          + dec(DOC.largeurMin) + " m au moins.");
      else if(pt < B.lo - .01)
        une("prof", nomV(v, i) + " a " + dec(pt) + " m de profondeur, pour " + dec(B.lo)
          + " m au moins.");
      if(pt > B.hi + .01)
        une("profmax", nomV(v, i) + " a " + dec(pt) + " m de profondeur, au-delà des "
          + dec(B.hi) + " m.");
      else if(cla && pt > PF + .01)
        une("facade", nomV(v, i) + " porte des classes sur " + dec(pt) + " m de profondeur : "
          + "au-delà de " + dec(PF) + " m — deux salles —, une salle n'a plus de façade.");
    });
  }

  /* la salle de sport : ses cotes, et rien au-dessus */
  vols.forEach(function(v, k){
    if(!v.fix || stop()) return;
    var it = ITEMBYKEY[v.key], hs = v.lv.filter(function(e){ return lvlOf(e.i) >= 0; });
    if(hs.length > 1) dit("sport", k, "Un étage est posé sur la salle de sport.");
    else if(it && it.w && hs[0] && (Math.min(hs[0].w, hs[0].d) !== Math.min(it.w, it.h)
            || Math.max(hs[0].w, hs[0].d) !== Math.max(it.w, it.h)))
      dit("sport", k, "La salle de sport ne fait plus " + it.w + " × " + it.h + " m.");
  });

  /* la nappe, sous tout sous-sol — lecture inchangée : terrain − nappe ≥ 3,00 m */
  vols.forEach(function(v, k){
    if(stop() || !v.lv.some(function(e){ return lvlOf(e.i) < 0; })) return;
    var z = assise(rectSol(v)).z, couv = z - NAPPE;
    if(couv < RULES.dist.couverture - .005)
      dit("nappe", k, "Sous " + nomV(v, k).toLowerCase() + ", le terrain est à " + dec(z)
        + " m : " + dec(couv) + " m au-dessus de la nappe (" + dec(NAPPE) + " m), pour "
        + dec(RULES.dist.couverture) + " m au moins.");
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

  /* la cour — la plus chère, en dernier */
  if(!stop()){
    var cu = courUtile(vols);
    if(cu.a < DOC.courMin)
      dit("cour", -1, "La meilleure cour ne fait que " + fmt(Math.round(cu.a)) + " m² utiles "
        + "devant une façade d'école, pour " + fmt(DOC.courMin) + " m² au moins.");
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
/* Ce qui peut invalider une variante — les écarts `pile` se règlent au mixer. */
export function valide(vols){
  return !dures(vols, false).some(function(x){ return !x.pile; });
}

/* ---------- 2 et 3. LES PRIORITÉS ET LES PRÉFÉRENCES -------------------------
   Chaque critère rend `{ id, n, niv, txt }` — niv 2 favorable, 1 neutre,
   0 défavorable. Jamais un nombre à additionner. */
function palier(x, bon, max){ return x <= bon ? 2 : x <= max ? 1 : 0; }
/* La qualité q ∈ [−1, 1] d'une mesure « plus petit vaut mieux », calée sur les
   mêmes seuils que le palier : +1 jusqu'au seuil favorable, 0 au seuil
   défavorable, −1 aussi loin au-delà. C'est elle que la note affiche. */
function lin(x, bon, max){
  var q = 1 - (x - bon) / Math.max(1e-6, max - bon);
  return Math.max(-1, Math.min(1, q));
}
function borne(q){ return Math.max(-1, Math.min(1, q)); }
/* L'angle d'une ligne de façade longue : la normale au grand côté. */
function normale(v){
  var r = rectSol(v);
  return r.w >= r.d ? v.a + Math.PI / 2 : v.a;
}
/* L'optimum soleil-vue en un point : la façade longue qui partage l'écart entre
   le sud et la direction du terrain de football. Le générateur y tourne une
   partie de ses figures ; il ne l'impose à aucune. Rend l'angle du grand axe. */
export function angleSoleilVue(x, y){
  var T = cibleVue(), pv = Math.atan2(T.y - y, T.x - x);
  return ecartAngle(pv, Math.PI / 2) / 2;
}

export function qualites(vols){
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

  /* orientation et vue, pondérées par la façade longue × les étages */
  function oriente(f){
    var tot = 0, bon = 0, mal = 0, moy = 0;
    CL.forEach(function(v){
      var r = rectSol(v), w = Math.max(r.w, r.d) * Math.max(1, rectsHors(v).length);
      var th = Math.abs(f(v, r)) / DEG;
      tot += w; moy += th * w;
      if(th <= DOC.orientBon) bon += w;
      if(th > DOC.orientMax) mal += w;
    });
    if(!tot) return { niv:1, moy:0, q:0 };
    return { niv: bon / tot >= 2 / 3 ? 2 : mal / tot > 1 / 3 ? 0 : 1, moy: moy / tot,
             q: (bon - mal) / tot };
  }
  var so = oriente(function(v){ return ecartAngle(normale(v), Math.PI / 2); });
  var vu = oriente(function(v, r){
    return ecartAngle(normale(v), Math.atan2(T.y - r.y, T.x - r.x)); });

  /* le jour entre façades qui se font face */
  var pire = -Infinity, paires = 0;
  E.forEach(function(v, i){
    E.forEach(function(o, j){
      if(j <= i || lies(v, o)) return;
      var a = rectSol(v), b = rectSol(o);
      if(visAVis(a, b) <= 8) return;
      var req = Math.max(haut(v), haut(o)) * DOC.ombreK, e = ecart(a, b);
      paires++;
      pire = Math.max(pire, (req - e) / req);
    });
  });
  var jour = !paires || pire <= 0 ? 2 : pire <= .25 ? 1 : 0;

  /* compacité : façade développée par m² de plancher */
  var fac = 0, bat = 0;
  E.forEach(function(v){
    v.lv.forEach(function(e){
      if(HN[e.i] === undefined) return;
      var r = volRect(v, e);
      fac += 2 * (r.w + r.d) * (e.h || HN[e.i]);
      bat += e.w * e.d;
    });
  });
  var cp = bat ? fac / bat : 0;
  var cu = courUtile(vols);

  var fortes = [
    { id:"soleil", n:"Orientation solaire", niv:so.niv, q:so.q,
      txt:"façades longues à " + Math.round(so.moy) + "° du sud en moyenne" },
    { id:"vue", n:"Vue vers le nord-ouest", niv:vu.niv, q:vu.q,
      txt:"façades longues à " + Math.round(vu.moy) + "° du terrain de football" },
    { id:"jour", n:"Lumière entre bâtiments", niv:jour,
      q: paires ? lin(Math.max(0, pire), 0, .25) : 1,
      txt: !paires ? "aucune façade en vis-à-vis"
        : pire <= 0 ? "tous les vis-à-vis tiennent " + dec(DOC.ombreK) + " × la hauteur"
        : "le pire vis-à-vis manque " + Math.round(pire * 100) + " % de l'écart utile" },
    { id:"compa", n:"Compacité", niv:palier(cp, DOC.compaBon, DOC.compaMax),
      q:lin(cp, DOC.compaBon, DOC.compaMax),
      txt: dec(Math.round(cp * 100) / 100) + " m² de façade par m² de plancher" },
    { id:"courq", n:"Cour généreuse", niv: cu.a >= DOC.courBon ? 2 : 1,
      q: borne((cu.a - DOC.courMin) / Math.max(1, DOC.courBon - DOC.courMin)),
      txt: fmt(Math.round(cu.a)) + " m² utiles" + (cu.v >= 0 ? " devant "
        + nomV(vols[cu.v], cu.v).toLowerCase() : "") }
  ];

  /* préférences */
  var atts = attracteurs(), rang = 0;
  E.forEach(function(v){
    var ok = alignement(v.a, atts).ecart < .035 || E.some(function(o){
      return o !== v && Math.abs(ecartAngle(2 * v.a, 2 * o.a)) < .07; });
    if(ok) rang++;
  });
  var pf = 0, pt = 0, el = 0;
  vols.forEach(function(v){ pf = Math.max(pf, porteAFaux(v)); });
  E.forEach(function(v){
    if(!v.fix) pt = Math.max(pt, assise(rectSol(v)).d);
    if(v.fix) return;
    v.lv.forEach(function(e){
      if(lvlOf(e.i) >= 0) el = Math.max(el, Math.max(e.w, e.d) / Math.max(1, Math.min(e.w, e.d)));
    });
  });
  var tl = terrainLibre(vols);
  var grp = ensembles(E.filter(function(v){ return !v.fix; }), vols.ponts || []);
  var prefs = [
    { id:"align", n:"Alignement", niv: E.length && rang / E.length >= .5 ? 2 : 1,
      q: E.length ? rang / E.length : 0,
      txt: rang + " corps sur " + E.length + " rangés sur le site ou un voisin" },
    { id:"aplomb", n:"Porte-à-faux", niv:palier(pf, .3, DOC.pafMax), q:lin(pf, .3, DOC.pafMax),
      txt: pf > .3 ? "débord maximum " + dec(pf) + " m" : "tout d'aplomb" },
    { id:"pente", n:"Terrassement", niv:palier(pt, DOC.penteMax / 2, DOC.penteMax),
      q:lin(pt, DOC.penteMax / 2, DOC.penteMax),
      txt:"jusqu'à " + dec(pt) + " m de dénivelé sous une emprise" },
    { id:"elan", n:"Élancement", niv: el <= DOC.elanceMax ? 2 : 0,
      q: el <= DOC.elanceMax ? 1 : -borne((el - DOC.elanceMax) / DOC.elanceMax),
      txt:"jusqu'à " + dec(Math.round(el * 10) / 10) + " fois plus long que large" },
    { id:"connex", n:"Connexions", niv: grp <= 1 ? 2 : 1, q: grp <= 1 ? 1 : 0,
      txt: grp <= 1 ? "l'école tient d'un seul tenant"
        : grp + " ensembles séparés" + ((vols.ponts || []).length
          ? ", " + vols.ponts.length + " passerelle" + (vols.ponts.length > 1 ? "s" : "") : "") },
    { id:"terrain", n:"Accès et stationnement", niv: tl.libre >= tl.besoin ? 2 : 0,
      q: borne((tl.libre - tl.besoin) / tl.besoin),
      txt: fmt(Math.round(tl.libre)) + " m² libres pour " + fmt(tl.besoin) + " m² de cour et de "
        + RULES.ext.voitures + " places" }
  ];
  return { fortes:fortes, prefs:prefs };
}
/* Combien d'ensembles l'école fait-elle : corps accolés et passerelles relient. */
export function ensembles(E, ponts){
  var P = {};
  function f(x){ while(P[x] !== x) x = P[x] = P[P[x]]; return x; }
  function u(a, b){ if(P[a] !== undefined && P[b] !== undefined) P[f(a)] = f(b); }
  E.forEach(function(v){ P[v.id] = v.id; });
  E.forEach(function(v){ if(v.joint) u(v.id, v.joint); });
  ponts.forEach(function(p){ u(p.a, p.b); });
  var n = 0;
  E.forEach(function(v){ if(f(v.id) === v.id) n++; });
  return n;
}

/* ---------- le choix -----------------------------------------------------------
   `a` bat `b` s'il est au moins aussi bon partout et meilleur quelque part. */
function bat(a, b){
  var mieux = false;
  for(var i = 0; i < a.length; i++){
    if(a[i] < b[i]) return false;
    if(a[i] > b[i]) mieux = true;
  }
  return mieux;
}
function niv(L){ return L.map(function(x){ return x.niv; }); }
/* `cands` : `[{ vols, pid, q }]`. LA DIVERSITÉ D'ABORD : le parti est tiré parmi
   tous ceux qui ont rendu une variante valide — sans quoi le même parti, le
   mieux orienté, gagnerait chaque tirage. PUIS les priorités, au sein de ce
   parti : on écarte les variantes qu'une autre bat sur les priorités fortes,
   puis, entre égales, sur les préférences, et l'on tire parmi ce qui reste. */
export function choisir(cands, r){
  var ps = [];
  cands.forEach(function(x){ if(ps.indexOf(x.pid) < 0) ps.push(x.pid); });
  var pid = ps[Math.floor(r() * ps.length)];
  var L = cands.filter(function(x){ return x.pid === pid; });
  L.forEach(function(c){ c.f = niv(c.q.fortes); c.p = niv(c.q.prefs); });
  var F = L.filter(function(x){
    return !L.some(function(y){ return y !== x && bat(y.f, x.f); }); });
  var G = {}, out = [], k;
  F.forEach(function(x){ (G[x.f.join()] = G[x.f.join()] || []).push(x); });
  for(k in G){
    var g = G[k];
    g.forEach(function(x){
      if(!g.some(function(y){ return y !== x && bat(y.p, x.p); })) out.push(x);
    });
  }
  var c = out[Math.floor(r() * out.length)];
  c.vols.front = out.length;
  c.vols.partis = ps.length;
  return c;
}

/* ---------- la composition à l'écran ---------------------------------------- */
export function jugement(vols){
  if(!vols || !vols.length) return null;
  oublier();
  var q = qualites(vols), d = dures(vols, false);
  var n = noter(d, q);
  return { dures:d, fortes:q.fortes, prefs:q.prefs, total:n.total, crit:n.crit };
}

/* ---------- la NOTE : une lecture, pas un choix -----------------------------
   Chaque critère porte un score : sa qualité q (−1 à +1) fois le poids de son
   rang (`RANGS_MASS`). Une contrainte dure respectée vaut 0 ; chaque écart en
   coûte le poids. La somme se lit — elle dit d'un coup d'œil ce que la
   composition gagne et ce qu'elle paie —, mais le générateur ne la lit pas :
   il choisit par la hiérarchie, et c'est voulu. */
function poidsDe(id){
  for(var i = 0; i < RANGS_MASS.length; i++) if(RANGS_MASS[i].id === id) return RANGS_MASS[i].poids || 0;
  return 0;
}
function majuscule(t){ return t.charAt(0).toUpperCase() + t.slice(1); }
export function noter(d, q){
  var crit = [];
  reglesDe("mass").forEach(function(r){
    if(r.rang !== "dure") return;
    var n = d.filter(function(x){ return x.k === r.id && !x.pile; }).length;
    crit.push({ id:r.id, n:majuscule(r.titre.replace(/^— /, "")), rang:"dure", niv: n ? 0 : 2,
                txt: n ? d.filter(function(x){ return x.k === r.id; })[0].msg : "respectée",
                pts: n ? -n * poidsDe("dure") : 0 });
  });
  [["forte", q.fortes], ["pref", q.prefs]].forEach(function(g){
    g[1].forEach(function(c){
      crit.push({ id:c.id, n:c.n, rang:g[0], niv:c.niv, txt:c.txt,
                  pts: Math.round(c.q * poidsDe(g[0])) });
    });
  });
  var tot = 0;
  crit.forEach(function(c){ tot += c.pts; });
  return { total:tot, crit:crit };
}
export function jugementCourant(){
  if(!MASS.vol.length) return null;
  var v = MASS.vol;
  v.ponts = MASS.pont;
  return jugement(v);
}
