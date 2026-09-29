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
import { DOC, efface, estDure, mesuresDures, poidsJ, reglesDe } from "../data/doctrine.js";
import { JUGES } from "../data/jugements.js";
import { RULES } from "../data/rules.js";
import { PMAP } from "../mix/prog.js";
import { FLOORS, lvlOf, onFloor } from "../mix/floors.js";
import { airePosable, alignement, assise, attracteurs, cibleVue, dansRect, dedans, ecart,
  ecartAngle, ecartPoly, margeAu, visAVis } from "./geom.js";
import { CONTACT, MASS, horsModule, horsSol, pontRect, niveaux, postesDe,
  profFacade, volRect, volTitre as nomV } from "./model.js";
import { ecartVols, intact, lies, obstaclesPres, rectSol, rectsHors } from "./gen.js";

var DEG = Math.PI / 180;
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
/* Les ids que mesure `dures()` ; toute autre mesure est une qualité. */
var DURES_K = ["perim", "dist", "existant", "module", "facade", "sport", "abri", "cour"];
export function dures(vols, vite){
  /* Seules les mesures qu'une RÈGLE DURE réclame (`mesuresDures()`) bloquent ;
     celles qu'on a passées aux jugements vont dans `out.hors`, que la note lit. */
  var out = [], H = mesuresDures();
  out.hors = [];
  function dit(k, v, msg, pile, v2){
    (H[k] ? out : out.hors).push({ k:k, v:v, v2: v2 == null ? -1 : v2, msg:msg, pile:pile ? 1 : 0 });
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

  /* la distance INCENDIE — seule distance bloquante : entre bâtiments, à tous
     les étages ; et à l'existant. La distance souhaitée, elle, se note. */
  var FEU = RULES.dist.entre;
  for(i = 0; i < vols.length && !stop(); i++){
    for(j = i + 1; j < vols.length && !stop(); j++){
      var e = ecartVols(vols[i], vols[j]), L = lies(vols[i], vols[j]);
      if(e < FEU - .01 && !(L && e >= -CONTACT))
        dit("dist", i, nomV(vols[i], i) + " et " + nomV(vols[j], j).toLowerCase()
          + (e < 0 ? " s'interpénètrent." : " sont à " + dec(e) + " m : la distance "
            + "incendie est de " + dec(FEU) + " m."), 0, j);
    }
    rectsHors(vols[i]).forEach(function(rc){
      if(stop()) return;
      var OB = obstaclesPres(rc, FEU);
      for(var k = 0; k < OB.length; k++){
        var eb = ecartPoly(rc, OB[k]);
        if(eb < FEU - .01){
          dit("existant", i, nomV(vols[i], i) + (eb < 0 ? " recouvre un bâtiment existant."
            : " est à " + dec(eb) + " m d'un bâtiment existant : la distance incendie est de "
              + dec(FEU) + " m."));
          return;
        }
      }
    });
  }

  /* les cotes : classes en façade, module. Les dimensions souhaitées ne
     bloquent rien — elles se notent (`qualites()`). */
  var PF = profFacade();
  for(i = 0; i < vols.length && !stop(); i++){
    var v = vols[i], cla = portClasses(v), vu = {};
    v.lv.forEach(function(e){
      var sol = lvlOf(e.i) >= 0, pt = Math.min(e.w, e.d);
      function une(k, msg){ if(!vu[k]){ vu[k] = 1; dit(k, i, msg); } }
      if(horsModule(e.w) || horsModule(e.d))
        une("module", nomV(v, i) + " — " + dec(e.w) + " × " + dec(e.d) + " m : hors du module de "
          + dec(DOC.module) + " m.");
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
    else if(it && it.w && hs[0] && (Math.min(hs[0].w, hs[0].d) !== Math.min(it.w, it.h)
            || Math.max(hs[0].w, hs[0].d) !== Math.max(it.w, it.h)))
      dit("sport", k, "La salle de sport ne fait plus " + it.w + " × " + it.h + " m.");
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

  /* un jugement passé en règle dure : il bloque quand il se lit défavorable */
  if(!stop() && Object.keys(H).some(function(k){ return DURES_K.indexOf(k) < 0; })){
    out.q = qualites(vols);
    out.q.fortes.concat(out.q.prefs).forEach(function(c){
      if(H[c.id] && c.niv === 0 && !stop()) dit(c.id, -1, c.n + " — " + c.txt);
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

  /* vos DIMENSIONS souhaitées : la largeur (grand côté) et la profondeur (petit
     côté) de chaque volume d'école, murs compris, au rez */
  var m2 = 2 * RULES.haut.mur, dn = 0, dok = 0;
  E.forEach(function(v){
    if(v.fix) return;
    var r = rectSol(v), L = Math.max(r.w, r.d), P = Math.min(r.w, r.d);
    dn++;
    if(L >= DOC.largeurMin - .01 && L <= DOC.largeurMax + .01
       && P >= DOC.profMin - .01 && P <= DOC.profMax + .01) dok++;
  });
  var dsh = dn ? dok / dn : 1;
  /* votre DISTANCE souhaitée entre bâtiments distincts */
  var pn = 0, pok = 0;
  E.forEach(function(v, i){
    E.forEach(function(o, j){
      if(j <= i || lies(v, o)) return;
      pn++;
      if(ecartVols(v, o) >= DOC.distVoulue - .01) pok++;
    });
  });
  var psh = pn ? pok / pn : 1;
  /* le PARTI : la figure posée est-elle restée celle qui a été construite */
  var part = intact(vols);
  /* le PROGRAMME : l'écart de surface, niveau par niveau */
  var dem = 0, ec = 0;
  niveaux().forEach(function(n){
    var po = 0;
    vols.forEach(function(v){ if(v.ph) return; v.lv.forEach(function(e){ if(e.i === n.i) po += e.w * e.d; }); });
    dem += n.A; ec += Math.abs(po - n.A);
  });
  var dev = dem ? ec / dem : 0;

  var fortes = [
    { id:"dims", n:"Dimensions souhaitées", niv: dsh >= 1 ? 2 : dsh >= .5 ? 1 : 0, q: 2 * dsh - 1,
      txt: dok + " volume" + (dok > 1 ? "s" : "") + " sur " + dn + " dans vos fourchettes" },
    { id:"distv", n:"Distance souhaitée entre bâtiments", niv: psh >= 1 ? 2 : psh >= .5 ? 1 : 0,
      q: 2 * psh - 1,
      txt: !pn ? "un seul bâtiment" : pok + " écart" + (pok > 1 ? "s" : "") + " sur " + pn
        + " à " + dec(DOC.distVoulue) + " m au moins" },
    { id:"parti", n:"Respect du parti", niv: part ? 2 : 0, q: part ? 1 : -1,
      txt: part ? "la figure garde la structure de son parti" : "la figure a été déformée" },
    { id:"prog", n:"Organisation du programme", niv: palier(dev, .01, .03), q: lin(dev, .01, .03),
      txt: "écart de surface " + dec(Math.round(dev * 1000) / 10) + " %" },
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
  var pt = 0, el = 0;
  E.forEach(function(v){
    if(!v.fix) pt = Math.max(pt, assise(rectSol(v)).d);
    if(v.fix) return;
    v.lv.forEach(function(e){
      if(lvlOf(e.i) >= 0) el = Math.max(el, Math.max(e.w, e.d) / Math.max(1, Math.min(e.w, e.d)));
    });
  });
  var tl = terrainLibre(vols), nap = couverture(vols);
  var grp = ensembles(E.filter(function(v){ return !v.fix; }), vols.ponts || []);
  var prefs = [
    { id:"align", n:"Alignement", niv: E.length && rang / E.length >= .5 ? 2 : 1,
      q: E.length ? rang / E.length : 0,
      txt: rang + " corps sur " + E.length + " rangés sur le site ou un voisin" },
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
    { id:"nappe", n:"Nappe et sous-sol", niv: nap.niv, q: nap.q, txt: nap.txt },
    { id:"terrain", n:"Accès et stationnement", niv: tl.libre >= tl.besoin ? 2 : 0,
      q: borne((tl.libre - tl.besoin) / tl.besoin),
      txt: fmt(Math.round(tl.libre)) + " m² libres pour " + fmt(tl.besoin) + " m² de cour et de "
        + RULES.ext.voitures + " places" }
  ];
  return { fortes:fortes, prefs:prefs };
}
/* La couverture sur la nappe — lecture inchangée : terrain moyen sous le corps
   qui porte un sous-sol, moins 462,25 m, au moins 3,00 m. Une PRÉFÉRENCE : +1
   quand elle tient, 0 à mi-manque, −1 quand le sous-sol touche la nappe. */
export function couverture(vols){
  var pire = Infinity, qui = -1;
  vols.forEach(function(v, k){
    if(!v.lv.some(function(e){ return lvlOf(e.i) < 0; })) return;
    var c = assise(rectSol(v)).z - NAPPE;
    if(c < pire){ pire = c; qui = k; }
  });
  var R = RULES.dist.couverture;
  if(qui < 0) return { niv:2, q:1, txt:"aucun sous-sol", v:-1, c:Infinity };
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

/* ---------- le choix -----------------------------------------------------------
/* LE CLASSEMENT. `cands` : `[{ vols, pid, q }]`, toutes valides. Chacune reçoit
   son score sur 100 ; on garde la MEILLEURE de chaque parti — la diversité —,
   et l'on range tout par score décroissant. Le générateur montre la première,
   « Shuffle massing » passe à la suivante. Avec un seul parti, on garde ses
   meilleures variantes, dans l'ordre. */
export function classer(cands, parParti){
  cands.forEach(function(c){ c.score = noter(c.d || [], c.q).total; });
  cands.sort(function(a, b){ return b.score - a.score; });
  if(!parParti) return cands.slice(0, 8);
  var vu = {}, out = [];
  cands.forEach(function(c){ if(!vu[c.pid]){ vu[c.pid] = 1; out.push(c); } });
  return out;
}

/* ---------- la composition à l'écran ---------------------------------------- */
export function jugement(vols){
  if(!vols || !vols.length) return null;
  oublier();
  var q = qualites(vols), d = dures(vols, false);
  var n = noter(d, q);
  return { dures:d, fortes:q.fortes, prefs:q.prefs, total:n.total, crit:n.crit, juges:n.juges };
}

function majuscule(t){ return t.charAt(0).toUpperCase() + t.slice(1); }
export function noter(d, q){
  /* LE SCORE SUR 100. Une variante qui enfreint une règle dure n'a pas de
     score : elle n'existe pas. Chaque MESURE rend un score de 0 à 1 — une
     qualité q ∈ [−1, 1] ramenée à [0, 1], une règle dure passée aux jugements
     1 tenue, 0 enfreinte (`d.hors`). Chaque JUGEMENT mesuré (`data/jugements.js`)
     vaut la moyenne de ses mesures ; la note est leur moyenne pondérée par le
     curseur, fois 100 : tout au mieux vaut 100. */
  var sc = {}, hors = {}, crit = [], juges = [], som = 0, pois = 0, lus = {};
  (d.hors || []).forEach(function(x){ hors[x.k] = 1; });
  DURES_K.forEach(function(k){ sc[k] = hors[k] ? 0 : 1; });
  q.fortes.concat(q.prefs).forEach(function(c){ sc[c.id] = Math.max(0, Math.min(1, (c.q + 1) / 2)); });
  JUGES.forEach(function(x){
    if(estDure(x) || efface(x) || !x.m.length) return;
    var w = poidsJ(x), s = 0;
    x.m.forEach(function(k){ s += sc[k]; if(w) lus[k] = 1; });
    s /= x.m.length;
    som += w * s; pois += w;
    juges.push({ id:x.id, w:w, sc:s });
  });
  [["forte", q.fortes], ["pref", q.prefs]].forEach(function(g){
    g[1].forEach(function(c){
      crit.push({ id:c.id, n:c.n, rang:g[0], niv:c.niv, txt:c.txt, actif:!!lus[c.id],
                  pts: Math.round(sc[c.id] * 100) });
    });
  });
  return { total: d.length ? null : (pois ? Math.round(100 * som / pois) : 100), crit:crit, juges:juges };
}
export function jugementCourant(){
  if(!MASS.vol.length) return null;
  var v = MASS.vol;
  v.ponts = MASS.pont;
  return jugement(v);
}
