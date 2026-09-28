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

