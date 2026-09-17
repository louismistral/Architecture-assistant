/* ============================================================================
   RÉPARTIR LE PROGRAMME SUR LES NIVEAUX

   Deux gestes, un seul moteur :
     · « Répartir »  — déterministe, l'ordre des chapitres du règlement.
     · « Shuffle »   — le même moteur, mais les choix libres sont tirés au sort
                       à partir d'une graine, donc une proposition se retrouve.

   Les contraintes de CONNEXION ne sont jamais dures. Le tirage les prend comme
   des PRÉFÉRENCES — un poste va d'abord au niveau où se trouve déjà ce que le
   règlement lui demande de toucher — et `src/mix/checks.js` dit après coup ce
   qui n'a pas pu tenir. C'est la règle du projet : rien n'est empêché, rien
   n'est silencieux.

   Le tirage peut aussi proposer le NOMBRE de niveaux : il part de la surface
   bâtie qu'il faut loger, du plateau du rez, et de ce que le règlement admet
   en sous-sol.
   ========================================================================= */
import { CIRC } from "../core/model.js";
import { chance, pick, rng, shuffled } from "../core/rand.js";
import {
  BLOCKS, FLOORS, PLATE_DEF, TRAY, flNet, grade,
  nextUid, place, setStack, toTray, usable
} from "./floors.js";
import { CLSRE, VESTC, WCF, WCG, WCRE, ancreDe, lvRange } from "./niv.js";
import { PMAP, PROX, aOf, posables, qOf, uOf } from "./prog.js";

/* Indices de niveaux qu'un poste peut occuper, dans la pile courante. */
export function rangeOf(p){
  var lr = lvRange(p), lo = 1e9, hi = -1e9;
  FLOORS.forEach(function(F, i){
    if(F.lvl >= lr.min && F.lvl <= lr.max){ lo = Math.min(lo, i); hi = Math.max(hi, i); }
  });
  if(lo > hi){ var z = grade(); lo = z; hi = z; }
  var out = [];
  for(var i = lo; i <= hi; i++) out.push(i);
  return out;
}
function libre(i){ return usable(i) - flNet(i); }

/* Niveaux déjà occupés par les postes que le règlement demande de tenir près
   de celui-ci. Ce sont les préférences, dans l'ordre. */
function voisins(key, pose){
  var out = [];
  PROX.forEach(function(l){
    var o = l.a === key ? l.b : (l.b === key ? l.a : null);
    if(!o) return;
    (pose[o] || []).forEach(function(f){ if(out.indexOf(f) < 0) out.push(f); });
  });
  return out;
}

/* Choisit un niveau parmi `cand` capable de porter `need` m² utiles.
   Déterministe : le plus libre. Tiré : au sort parmi ceux qui ont la place,
   pondéré par la place restante — le hasard reste constructible. */
function choisir(cand, need, alea){
  var ok = cand.filter(function(f){ return libre(f) >= need - 0.5; });
  if(!ok.length) return null;
  if(!alea){
    return ok.reduce(function(a, b){ return libre(b) > libre(a) ? b : a; }, ok[0]);
  }
  var tot = 0, i, r;
  ok.forEach(function(f){ tot += Math.max(1, libre(f)); });
  r = rng() * tot;
  for(i = 0; i < ok.length; i++){
    r -= Math.max(1, libre(ok[i]));
    if(r <= 0) return ok[i];
  }
  return ok[ok.length - 1];
}
function leMoinsCharge(cand){
  return cand.reduce(function(a, b){ return libre(b) > libre(a) ? b : a; }, cand[0]);
}

/* Pose un poste. Il se groupe tant que le niveau retenu tient, puis déborde
   sur le suivant — un contingent de dix-huit classes se répartit ainsi de
   lui-même, sans qu'on ait à le dire. Un poste aux dimensions imposées par le
   règlement ne se coupe pas : il tient d'un seul tenant, quitte à déborder. */
function poser(p, cand, alea, prefs, pose){
  var key = p.key, q = qOf(key), u = uOf(key);
  if(q <= 0) return;
  var want = {}, rest = q, tour = 0;
  var ordre = prefs.filter(function(f){ return cand.indexOf(f) >= 0; })
                   .concat(cand.filter(function(f){ return prefs.indexOf(f) < 0; }));
  /* premier niveau : celui qui prendrait tout le poste, sinon une unité */
  var f = null;
  if(ordre.length) f = choisir(ordre.slice(0, prefs.length || ordre.length), u * q, alea);
  if(f === null) f = choisir(cand, u * q, alea);
  if(f === null) f = choisir(cand, u, alea);
  if(f === null) f = leMoinsCharge(cand);

  while(rest > 0 && tour < 40){
    tour++;
    var cap = u > 0 ? Math.floor(Math.max(0, libre(f)) / u) : rest;
    var prise = p.solid ? rest : Math.max(1, Math.min(rest, cap));
    want[f] = (want[f] || 0) + prise;
    rest -= prise;
    place(key, want);
    if(rest <= 0) break;
    var reste = cand.filter(function(x){ return x !== f; });
    var nf = reste.length ? choisir(reste, u, alea) : null;
    if(nf === null){
      /* plus une place nulle part : on pose le reste ici et le contrôle le
         dira. Le mixer ne refuse rien. */
      want[f] += rest; rest = 0;
      place(key, want);
      break;
    }
    f = nf;
  }
  pose[key] = Object.keys(want).map(function(k){ return parseInt(k, 10); });
}

/* ---------- sanitaires ---------------------------------------------------
   Les WC garçons et filles et les vestiaires de classe suivent les classes, au
   prorata de celles que porte chaque niveau, avec au moins un WC de chaque
   genre là où il y a des classes. Un étage sans sanitaires ne se dessine pas. */
function equilibrerWC(){
  var cls = [], use = [], i, tc = 0;
  for(i = 0; i < FLOORS.length; i++){ cls[i] = 0; use[i] = 0; }
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    var p = PMAP[b.key];
    if(p.f !== "tec") use[b.fl] += b.q;         /* un niveau technique n'appelle pas de WC */
    if(CLSRE.test(p.n)) cls[b.fl] += b.q;
  });
  for(i = 0; i < FLOORS.length; i++) tc += cls[i];

  function repartir(re, minPar){
    posables().forEach(function(p){
      if(!re.test(p.n)) return;
      var cand = rangeOf(p), q = qOf(p.key), want = {}, rest = q, frac = [];
      if(q <= 0 || !cand.length) return;
      cand.forEach(function(f){
        var n = (use[f] && minPar) ? Math.min(minPar, Math.max(0, rest)) : 0;
        want[f] = n; rest -= n;
      });
      cand.forEach(function(f){
        var part = tc > 0 ? rest * cls[f] / tc : (use[f] ? rest / cand.length : 0);
        want[f] += Math.floor(part);
        frac.push({ f:f, r: part - Math.floor(part), o: use[f] ? 1 : 0 });
      });
      var pose = 0;
      cand.forEach(function(f){ pose += want[f]; });
      frac.sort(function(a, b){ return (b.o - a.o) || (b.r - a.r); });
      var k = 0;
      while(pose < q && frac.length){ want[frac[k % frac.length].f]++; pose++; k++; }
      place(p.key, want);
    });
  }
  repartir(WCG, 1);
  repartir(WCF, 1);
  repartir(VESTC, 0);

  /* Repêchage : un niveau occupé sans le moindre WC en reçoit un, pris là où
     il y en a plusieurs. */
  var has = [];
  for(i = 0; i < FLOORS.length; i++) has[i] = 0;
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    if(WCRE.test(PMAP[b.key].n)) has[b.fl] += b.q;
  });
  for(i = 0; i < FLOORS.length; i++){
    if(!use[i] || has[i]) continue;
    var don = null;
    BLOCKS.forEach(function(b){
      if(don || b.fl === TRAY || b.fl === i) return;
      if(!WCRE.test(PMAP[b.key].n) || b.q < 1 || has[b.fl] <= 1) return;
      if(rangeOf(PMAP[b.key]).indexOf(i) < 0) return;
      don = b;
    });
    if(!don) continue;
    has[don.fl]--; don.q--;
    if(don.q <= 0) BLOCKS.splice(BLOCKS.indexOf(don), 1);
    BLOCKS.push({ u: nextUid(), key: don.key, q: 1, fl: i });
    has[i]++;
  }
}

/* ---------- la pile elle-même --------------------------------------------
   Combien de niveaux ? La question se pose avant la répartition, et sa réponse
   se déduit : surface bâtie à loger ÷ plateau du rez. Le sous-sol n'est ouvert
   qu'à ce que le règlement y admet — technique, stockage, nettoyage, abri PC —
   et la nappe phréatique le rend cher partout sauf au tiers est du site. */
export function proposerPile(alea){
  var plate = FLOORS[grade()] ? FLOORS[grade()].plate : PLATE_DEF;
  var besoinNet = 0, enterrable = 0;
  posables().forEach(function(p){
    var a = aOf(p.key, qOf(p.key));
    if(p.hors) return;
    besoinNet += a;
    if(lvRange(p).min < 0) enterrable += a;
  });
  var besoin = besoinNet / (1 - CIRC);
  var n = Math.max(1, Math.ceil(besoin / Math.max(1, plate)));
  var sous = alea ? (chance(0.55) ? 1 : 0) : (enterrable > plate * 0.35 ? 1 : 0);
  var up = Math.max(0, n - 1 - sous);
  if(alea && up > 0 && chance(0.30)) up += pick([-1, 1]);
  up = Math.max(0, Math.min(6, up));
  var plates = [];
  for(var i = 0; i < sous + 1 + up; i++) plates.push(plate);
  setStack(sous, up, plates);
  return FLOORS.length;
}

/* ---------- la répartition ------------------------------------------------ */
export function repartir(opts){
  var alea = !!(opts && opts.alea);
  if(opts && opts.etages) proposerPile(alea);

  toTray();
  var pose = {};                      /* key → niveaux déjà retenus */
  var libres = [], ancres = [], fixes = [];

  posables().forEach(function(p){
    var cand = rangeOf(p);
    var rec = { p:p, cand:cand, a: aOf(p.key, qOf(p.key)) };
    if(cand.length === 1) fixes.push(rec);
    else if(ancreDe(p)) ancres.push(rec);
    else libres.push(rec);
  });

  /* 1 — ce que le règlement cloue : un seul niveau possible. Les plus grands
         d'abord, parce qu'ils décident du reste. */
  fixes.sort(function(a, b){ return b.a - a.a; })
       .forEach(function(r){ poser(r.p, r.cand, alea, [], pose); });

  /* 2 — ce qui doit suivre un autre poste : la scène suit la salle de sport. */
  ancres.sort(function(a, b){ return b.a - a.a; }).forEach(function(r){
    var anc = ancreDe(r.p), prefs = (pose[anc] || []).filter(function(f){
      return r.cand.indexOf(f) >= 0;
    });
    poser(r.p, r.cand, alea, prefs, pose);
  });

  /* 3 — le reste. Déterministe : l'ordre des chapitres du règlement, les plus
         grands postes d'abord. Tiré : les chapitres passent dans un ordre
         quelconque, et chaque poste préfère le niveau de ses voisins. */
  if(alea){
    var parCh = {}, cles = [];
    libres.forEach(function(r){
      if(!parCh[r.p.ci]){ parCh[r.p.ci] = []; cles.push(r.p.ci); }
      parCh[r.p.ci].push(r);
    });
    shuffled(cles).forEach(function(ci){
      shuffled(parCh[ci]).sort(function(a, b){ return b.a - a.a; }).forEach(function(r){
        poser(r.p, r.cand, true, voisins(r.p.key, pose), pose);
      });
    });
  } else {
    libres.sort(function(a, b){ return (a.p.ci - b.p.ci) || (b.a - a.a); })
          .forEach(function(r){
            poser(r.p, r.cand, false, voisins(r.p.key, pose), pose);
          });
  }

  equilibrerWC();
}
