import { GAP } from "./model.js";
import { view } from "./viewstate.js";

/* ---------- geometry ---------- */
export function blocks(items){
  var out = [];
  items.forEach(function(it){
    if(view.mode === "agg"){
      var w, h;
      if(it.w && it.h){ w = it.w; h = it.h; }
      else { w = h = Math.sqrt(it.tot); }
      out.push({ ref:it, w:w, h:h, area:it.tot, label:it.n, split:it.split, inset:it.inset, cnt:it.nb });
    } else {
      var s0 = Math.sqrt(it.u), uw = s0, uh = s0;
      if(it.w && it.h){ uw = it.w; uh = it.h / 2; }
      for(var i = 0; i < it.nb; i++){
        out.push({ ref:it, w:uw, h:uh, area:it.u, label:it.n, inset:(it.nb === 1 ? it.inset : null), cnt:1 });
      }
    }
  });
  out.sort(function(a,b){ return (b.w*b.h) - (a.w*a.h); });
  return out;
}
export function pack(list, W){
  var rows = [], row = [], x = 0, rh = 0;
  for(var i = 0; i < list.length; i++){
    var b = list[i], need = (row.length ? GAP : 0) + b.w;
    if(row.length && x + need > W){ rows.push({items:row, h:rh}); row = []; x = 0; rh = 0; }
    b._x = x + (row.length ? GAP : 0);
    x = b._x + b.w;
    row.push(b); rh = Math.max(rh, b.h);
  }
  if(row.length) rows.push({items:row, h:rh});
  var y = 0;
  rows.forEach(function(r){
    r.items.forEach(function(b){ b.x = b._x; b.y = y + (r.h - b.h); });
    y += r.h + GAP;
  });
  return Math.max(0, y - GAP);
}

export var S = 8, MINSIDE = 1, MAXSIDE = 64;
export var DIMCACHE = {};
/* Paires largeur × hauteur donnant exactement A, les deux sur une grille de pas 1/inv. */
/* Proportions admissibles : largeur ET hauteur multiples de 0.5 m, surface exacte. */
export function gridPairs(A, inv){
  var out = [], N = Math.round(A * inv * inv), k, w, h;
  for(k = Math.ceil(MINSIDE * inv); k <= MAXSIDE * inv; k++){
    if(N % k) continue;
    w = k / inv; h = A / w;
    if(h < MINSIDE - 1e-9 || h > MAXSIDE + 1e-9) continue;
    if(Math.abs(h * inv - Math.round(h * inv)) > 1e-9) continue;
    out.push({ w: w, h: Math.round(h * inv) / inv });
  }
  return out;
}
/* Règle : demi-mètre en priorité ; si la surface n'admet aucune paire (2,2 m² par
   exemple), on descend au décimètre — le pas de la grille de position et des cloisons. */
export function validDims(A){
  if(DIMCACHE[A]) return DIMCACHE[A];
  var out = gridPairs(A, 2);
  if(!out.length) out = gridPairs(A, 10);
  if(!out.length) out = [{ w: Math.sqrt(A), h: Math.sqrt(A) }];
  DIMCACHE[A] = out;
  return out;
}
export function nearestDims(A, tw){
  var v = validDims(A), best = v[0], bd = Infinity;
  v.forEach(function(d){ var q = Math.abs(d.w - tw); if(q < bd){ bd = q; best = d; } });
  return best;
}
export function squarest(A){
  var v = validDims(A), best = v[0], bd = Infinity;
  v.forEach(function(d){
    var q = Math.abs(d.w - d.h) - (d.w >= d.h ? 0.001 : 0);
    if(q < bd){ bd = q; best = d; }
  });
  return best;
}

