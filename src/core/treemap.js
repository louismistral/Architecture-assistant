/* ---------- pavage squarifié ----------
   Un niveau se lit d'un coup d'œil si chaque poste occupe, dans le dessin,
   exactement la part de surface qu'il occupe dans le programme. Une liste ne
   le dit pas ; une barre non plus, parce qu'une barre n'a qu'une dimension.

   L'algorithme de Bruls, Huizing et van Wijk : on remplit le rectangle par
   bandes, en allongeant chaque bande tant que cela rapproche ses tuiles du
   carré. Le rectangle est rempli EXACTEMENT — pas de trou, pas de reste. */
function worst(row, L){
  var s = 0, mx = -Infinity, mn = Infinity, i, a;
  for(i = 0; i < row.length; i++){
    a = row[i].a; s += a;
    if(a > mx) mx = a;
    if(a < mn) mn = a;
  }
  if(s <= 0 || L <= 0 || mn <= 0) return Infinity;
  var t = s / L;
  return Math.max((t * t) / mn, mx / (t * t));
}

/* values : [{ key, v }] · rect : { x, y, w, h } → [{ key, x, y, w, h }] */
export function squarify(values, rect){
  var out = [], sum = 0, i;
  for(i = 0; i < values.length; i++) sum += values[i].v;
  if(sum <= 0 || rect.w <= 0 || rect.h <= 0) return out;

  var scale = (rect.w * rect.h) / sum;
  var items = values.map(function(o){ return { key:o.key, a:o.v * scale }; });
  var r = { x:rect.x, y:rect.y, w:rect.w, h:rect.h };
  i = 0;
  while(i < items.length){
    var L = Math.min(r.w, r.h);
    var row = [items[i]], k = i + 1;
    while(k < items.length && worst(row.concat(items[k]), L) <= worst(row, L)){
      row.push(items[k]); k++;
    }
    var rowA = 0, j;
    for(j = 0; j < row.length; j++) rowA += row[j].a;
    var thick = rowA / L, off = 0;
    if(r.w >= r.h){
      for(j = 0; j < row.length; j++){
        var hh = row[j].a / thick;
        out.push({ key:row[j].key, x:r.x, y:r.y + off, w:thick, h:hh });
        off += hh;
      }
      r = { x:r.x + thick, y:r.y, w:r.w - thick, h:r.h };
    } else {
      for(j = 0; j < row.length; j++){
        var ww = row[j].a / thick;
        out.push({ key:row[j].key, x:r.x + off, y:r.y, w:ww, h:thick });
        off += ww;
      }
      r = { x:r.x, y:r.y + thick, w:r.w, h:r.h - thick };
    }
    i = k;
  }
  return out;
}
