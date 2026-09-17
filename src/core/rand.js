/* ---------- tirage reproductible ----------
   Le Shuffle propose des alternatives : sans graine, une proposition retenue
   ne peut plus être retrouvée — on tire dix fois, la troisième était la bonne,
   elle n'existe plus. Une graine de 32 bits suffit à la rejouer à l'identique,
   et elle s'affiche à côté du bouton.

   mulberry32 : générateur à état unique, période 2³², sans dépendance. */
export function mulberry32(a){
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* La source courante. `seed()` la fixe et rend la graine employée. */
export var rng = Math.random, curSeed = 0;
export function seed(s){
  curSeed = (typeof s === "number" && isFinite(s))
    ? (s >>> 0)
    : (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0);
  rng = mulberry32(curSeed);
  return curSeed;
}
export function seedLabel(){ return curSeed.toString(36); }
/* Une graine se retape : on accepte la même écriture que celle qu'on affiche. */
export function parseSeed(txt){
  var v = parseInt(String(txt).trim().replace(/^graine\s*/i, ""), 36);
  return isFinite(v) && v >= 0 ? (v >>> 0) : null;
}

export function chance(p){ return rng() < p; }
export function pick(a){ return a[Math.floor(rng() * a.length)]; }
export function randInt(a, b){ return a + Math.floor(rng() * (b - a + 1)); }
export function shuffled(a){
  var out = a.slice(), i, j, t;
  for(i = out.length - 1; i > 0; i--){
    j = Math.floor(rng() * (i + 1));
    t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}
