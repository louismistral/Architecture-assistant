import { arrange, fit, pushUndo, shuffled } from "./editor.js";
import { CIRC, FLOORS, HORS, PLATE, TRAY, flRange, idxOfLvl, refloor, setCurFloor } from "./levels.js";
import { CLSRE, NIV, VESTC, WCF, WCG, WCRE, idOfName, nivHit } from "./niv.js";
import { PLINK, RMAP, ROOMS } from "./rooms.js";
import { saveSoon } from "./store.js";

export function floorUnits(){
  var adj = {}, seen = {}, units = [];
  ROOMS.forEach(function(r){ adj[r.id] = []; });
  PLINK.forEach(function(l){ if(adj[l.a] && adj[l.b]){ adj[l.a].push(l.b); adj[l.b].push(l.a); } });
  NIV.forEach(function(rl){
    if(!rl.same) return;
    var ref = idOfName(rl.same);
    if(!ref) return;
    ROOMS.forEach(function(r){
      if(r.id === ref || !nivHit(rl, r)) return;
      adj[r.id].push(ref); adj[ref].push(r.id);
    });
  });
  ROOMS.forEach(function(r){
    if(seen[r.id]) return;
    var comp = [], q = [r.id];
    seen[r.id] = 1;
    while(q.length){
      var id = q.shift(); comp.push(id);
      adj[id].forEach(function(n){ if(!seen[n]){ seen[n] = 1; q.push(n); } });
    }
    var lo = 0, hi = FLOORS.length - 1, a = 0, tot = 0, ci = 99;
    comp.forEach(function(id){
      var rr = RMAP[id], g = flRange(rr);
      lo = Math.max(lo, g.lo); hi = Math.min(hi, g.hi);
      tot += rr.a;
      if(!HORS[rr.ci]) a += rr.a;
      ci = Math.min(ci, rr.ci);
    });
    if(lo > hi){ lo = hi = Math.max(0, idxOfLvl(0)); }
    units.push({ ids: comp, lo: lo, hi: hi, a: a, tot: tot, ci: ci });
  });
  return units;
}
/* Surface utile qu'un niveau peut porter sans déborder son plateau. */
export function flCapacity(){ return PLATE > 0 ? PLATE * (1 - CIRC) : Infinity; }
/* Part visée niveau par niveau : le reste du programme se répartit au prorata de la place qui
   subsiste sous chaque plateau, une fois posé ce que le règlement cloue au rez. Tous les niveaux
   déclarés servent donc à quelque chose, et aucun ne reste vide sous un niveau chargé. */
export function flAllowance(load, rem){
  var cap = flCapacity(), out = [], free = [], tf = 0, i, t;
  if(isFinite(cap)){
    for(i = 0; i < FLOORS.length; i++){ free[i] = Math.max(0, cap - load[i]); tf += free[i]; }
    for(i = 0; i < FLOORS.length; i++){
      out[i] = load[i] + (tf > 0 ? rem * free[i] / tf : rem / FLOORS.length);
    }
  } else {
    t = rem;
    for(i = 0; i < FLOORS.length; i++) t += load[i];
    for(i = 0; i < FLOORS.length; i++) out[i] = t / FLOORS.length;
  }
  return out;
}

/* Après toute répartition : les WC garçons et filles et les vestiaires de classe sont
   redistribués au prorata des classes portées par chaque niveau, avec au moins un WC de chaque
   genre par niveau occupé ; et si un niveau reste malgré tout sans le moindre WC, on lui en
   déplace un pris là où il y en a plusieurs. */
export function balanceWC(units, load){
  var occ = [], cls = [], i;
  for(i = 0; i < FLOORS.length; i++){ occ[i] = 0; cls[i] = 0; }
  units.forEach(function(u){
    if(u.f === undefined) return;
    u.ids.forEach(function(id){
      occ[u.f]++;
      if(CLSRE.test(RMAP[id].n)) cls[u.f]++;
    });
  });
  function pool(re){
    var p = [];
    units.forEach(function(u){ if(u.ids.length === 1 && re.test(RMAP[u.ids[0]].n)) p.push(u); });
    return p;
  }
  function move(u, f){
    if(u.f === f) return;
    if(u.f !== undefined) load[u.f] -= u.a;
    u.f = f; load[f] += u.a;
  }
  function deal(p, minPer){
    var n = p.length, tc = 0, want = [], rest = n, frac = [], j, k;
    if(!n) return;
    for(i = 0; i < FLOORS.length; i++) tc += cls[i];
    for(i = 0; i < FLOORS.length; i++){
      want[i] = (occ[i] && minPer) ? Math.min(minPer, Math.max(0, rest)) : 0;
      rest -= want[i];
    }
    for(i = 0; i < FLOORS.length; i++){
      var q = tc > 0 ? rest * cls[i] / tc : (occ[i] ? rest / FLOORS.length : 0);
      frac.push({ i: i, r: q - Math.floor(q), o: occ[i] ? 1 : 0 });
      want[i] += Math.floor(q);
    }
    var used = 0;
    for(i = 0; i < FLOORS.length; i++) used += want[i];
    frac.sort(function(a, b){ return (b.o - a.o) || (b.r - a.r); });
    k = 0;
    while(used < n){ want[frac[k % frac.length].i]++; used++; k++; }
    var idx = 0;
    for(i = 0; i < FLOORS.length; i++){
      for(j = 0; j < want[i] && idx < n; j++){
        var uu = p[idx++];
        move(uu, Math.max(uu.lo, Math.min(uu.hi, i)));
      }
    }
    while(idx < n){ var u2 = p[idx++]; move(u2, Math.max(u2.lo, Math.min(u2.hi, FLOORS.length - 1))); }
  }
  deal(pool(WCG), 1);
  deal(pool(WCF), 1);
  deal(pool(VESTC), 0);

  var has = [];
  for(i = 0; i < FLOORS.length; i++) has[i] = 0;
  units.forEach(function(u){
    if(u.f === undefined) return;
    u.ids.forEach(function(id){ if(WCRE.test(RMAP[id].n)) has[u.f]++; });
  });
  var spare = [];
  units.forEach(function(u){
    if(u.ids.length !== 1 || u.f === undefined) return;
    if(WCRE.test(RMAP[u.ids[0]].n)) spare.push(u);
  });
  for(i = 0; i < FLOORS.length; i++){
    if(!occ[i] || has[i]) continue;
    for(var t = 0; t < spare.length; t++){
      var u3 = spare[t];
      if(u3.lo > i || u3.hi < i || has[u3.f] <= 1) continue;
      has[u3.f]--; move(u3, i); has[i]++;
      spare.splice(t, 1);
      break;
    }
  }
}

/* Répartition ordonnée : ce que le règlement cloue au terrain reste au rez, le reste remplit
   les niveaux dans l'ordre des chapitres jusqu'à équilibrer les surfaces. */
export function spreadFloors(){
  pushUndo(null);
  ROOMS.forEach(function(r){ if(r.fl === TRAY) r.fl = 0; });
  var units = floorUnits();
  var load = FLOORS.map(function(){ return 0; }), total = 0;
  units.forEach(function(u){ total += u.a; });
  units.filter(function(u){ return u.lo === u.hi; }).forEach(function(u){ u.f = u.lo; load[u.f] += u.a; });
  var rem0 = total;
  load.forEach(function(v){ rem0 -= v; });
  var allow = flAllowance(load, rem0);
  var p = 0;
  units.filter(function(u){ return u.lo !== u.hi; })
    .sort(function(a, b){ return (a.ci - b.ci) || (b.a - a.a); })
    .forEach(function(u){
      while(p < FLOORS.length - 1 && load[p] >= allow[p]) p++;
      var f = Math.max(u.lo, Math.min(u.hi, p));
      if(f !== p){ f = u.lo; for(var i = u.lo; i <= u.hi; i++) if(load[i] < load[f]) f = i; }
      u.f = f; load[f] += u.a;
    });
  balanceWC(units, load);
  units.forEach(function(u){ u.ids.forEach(function(id){ RMAP[id].fl = u.f; }); });
  arrange("ch", 1);
  setCurFloor(0);
  refloor(); fit(); saveSoon();
}

/* Répartition tirée au sort, pour le Shuffle. Les règles de niveau et le plateau tiennent
   toujours : seul varie ce que le règlement laisse libre. Les chapitres sont déplacés en bloc
   tant qu'ils tiennent sur un niveau, de sorte qu'un lancement change la stratégie du projet
   — l'UAPE au rez ou à l'étage, les classes d'un seul tenant ou réparties — et pas seulement
   l'ordre des pièces. */
export function shuffleFloors(){
  ROOMS.forEach(function(r){ if(r.fl === TRAY) r.fl = 0; });
  var units = floorUnits(), cap = flCapacity();
  var load = FLOORS.map(function(){ return 0; });
  units.filter(function(u){ return u.lo === u.hi; }).forEach(function(u){ u.f = u.lo; load[u.f] += u.a; });

  var byCh = {}, keys = [], tot = 0, rem = 0, i0;
  units.forEach(function(u){ tot += u.a; });
  rem = tot; load.forEach(function(v){ rem -= v; });
  /* Part visée niveau par niveau : le reste du programme se répartit au prorata de la place
     qui subsiste sous chaque plateau, une fois posé ce que le règlement cloue au rez. Sans
     cela un étage resterait vide sous un étage chargé, ce qui ne se construit pas. Une marge
     d'un cinquième laisse malgré tout le tirage respirer. */
  var slack = flAllowance(load, rem);
  for(i0 = 0; i0 < FLOORS.length; i0++) slack[i0] *= 1.2;
  units.filter(function(u){ return u.lo !== u.hi; }).forEach(function(u){
    if(!byCh[u.ci]){ byCh[u.ci] = []; keys.push(u.ci); }
    byCh[u.ci].push(u);
  });
  /* niveaux ouverts à une unité : d'abord ceux sous leur part visée et sous le plateau,
     sinon ceux sous le plateau, sinon tous ceux que le règlement permet */
  function openFor(u, lo, hi){
    var a = [], b = [], c = [], i;
    for(i = lo; i <= hi; i++){
      c.push(i);
      if(load[i] + u.a <= cap){
        b.push(i);
        if(load[i] < slack[i]) a.push(i);
      }
    }
    return a.length ? a : (b.length ? b : (c.length ? c : [lo]));
  }
  shuffled(keys).forEach(function(k){
    var list = shuffled(byCh[k]), lo = 0, hi = FLOORS.length - 1;
    list.forEach(function(u){ lo = Math.max(lo, u.lo); hi = Math.min(hi, u.hi); });
    if(lo > hi){ lo = list[0].lo; hi = list[0].hi; }
    /* niveau de départ du chapitre : tiré au sort une fois sur deux parmi les niveaux ouverts,
       le moins chargé l'autre fois — le chapitre suit tant qu'il tient */
    var cands = openFor(list[0], lo, hi);
    var pick = Math.random() < 0.5
      ? cands[Math.floor(Math.random() * cands.length)]
      : cands.reduce(function(a, b){ return load[b] < load[a] ? b : a; }, cands[0]);
    list.forEach(function(u){
      var f = Math.max(u.lo, Math.min(u.hi, pick));
      if(load[f] + u.a > cap || load[f] >= slack[f]){   /* le chapitre déborde : la suite passe ailleurs */
        var o = openFor(u, u.lo, u.hi);
        f = o.reduce(function(a, b){ return load[b] < load[a] ? b : a; }, o[0]);
      }
      u.f = f; load[f] += u.a;
    });
  });
  balanceWC(units, load);
  units.forEach(function(u){ u.ids.forEach(function(id){ RMAP[id].fl = u.f; }); });
}

