import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";

export var FMAP = {}; FAM.forEach(function(f){ FMAP[f.id] = f; f.total = 0; f.items = []; });
CHAP.forEach(function(ch){
  ch.items.forEach(function(it){
    it.key = ch.id + "|" + it.n;
    it.u0 = it.u;
    it.tot = it.nb * it.u;
    it.chap = ch.short;
    var f = FMAP[it.f];
    f.total += it.tot;
    f.items.push(it);
  });
  ch.total = ch.items.reduce(function(s,i){ return s + i.tot; }, 0);
  ch.items.sort(function(a,b){ return b.tot - a.tot; });
  ch.mix = FAM.filter(function(f){
    return ch.items.some(function(i){ return i.f === f.id; });
  }).map(function(f){
    return { f:f, v: ch.items.reduce(function(s,i){ return s + (i.f === f.id ? i.tot : 0); }, 0) };
  }).sort(function(a,b){ return b.v - a.v; });
});

FAM.forEach(function(f){ f.items.sort(function(a,b){ return b.tot - a.tot; }); });

export var PROG = 6489, ESTT = 0, GRAND = 6489, BUILT = 5089, GAP = 1.2;
export var ITEMS = [], VARITEMS = [];
CHAP.forEach(function(ch){ ch.items.forEach(function(it){ ITEMS.push(it); if(it.est) VARITEMS.push(it); }); });

export function recompute(){
  ESTT = 0;
  ITEMS.forEach(function(it){ it.tot = it.nb * it.u; if(it.est) ESTT += it.tot; });
  CHAP.forEach(function(ch){
    ch.total = ch.items.reduce(function(t,i){ return t + i.tot; }, 0);
    ch.mix = FAM.filter(function(f){ return ch.items.some(function(i){ return i.f === f.id; }); })
      .map(function(f){ return { f:f, v: ch.items.reduce(function(t,i){ return t + (i.f === f.id ? i.tot : 0); }, 0) }; })
      .sort(function(a,b){ return b.v - a.v; });
    ch.items.sort(function(a,b){ return b.tot - a.tot; });
  });
  FAM.forEach(function(f){
    f.total = f.items.reduce(function(t,i){ return t + i.tot; }, 0);
    f.items.sort(function(a,b){ return b.tot - a.tot; });
  });
  GRAND = PROG + ESTT;
  BUILT = CHAP.slice(0,4).reduce(function(t,c){ return t + c.total; }, 0);
}
recompute();
export var ALL_OFF = [];
CHAP.forEach(function(ch){ ch.off.forEach(function(o){ ALL_OFF.push(ch.short + " — " + o); }); });

