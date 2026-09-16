import { slug } from "../core/format.js";
import { squarest } from "../core/geometry.js";
import { FAM } from "../data/families.js";
import { CHAP } from "../data/program.js";
import { PART } from "./links.js";

export var ROOMS = [];
CHAP.forEach(function(ch){
  ch.items.forEach(function(it){
    if(it.w && it.h){
      /* dimensions imposées par le règlement : une seule pièce, non redimensionnable */
      ROOMS.push({ id: ch.id + "-" + slug(it.n), base: it.n, k: 0,
        g: ch.id + "-" + slug(it.n), gn: 1, key: it.key, ci: CHAP.indexOf(ch), fl: 0, n: it.n,
        a: it.u * it.nb, f: it.f, ch: ch.short, note: it.note || "",
        w: it.w, h: it.h, fix: 1, split: it.split || 0 });
      return;
    }
    if(it.planSkip) return;
    for(var k = 0; k < it.nb; k++){
      var d = squarest(it.u);
      ROOMS.push({ id: ch.id + "-" + slug(it.n) + "-" + k, base: it.n, k: k,
        g: ch.id + "-" + slug(it.n), gn: it.nb, key: it.key, ci: CHAP.indexOf(ch), fl: 0,
        n: it.n + (it.nb > 1 ? " " + (k + 1) : ""), a: it.u, f: it.f,
        ch: ch.short, note: it.note || "", w: d.w, h: d.h, est: it.est || 0,
        inset: it.planInset || ((it.inset && it.inset.w && it.inset.h) ? it.inset : null) });
    }
  });
});
export var RMAP = {}; ROOMS.forEach(function(r){ RMAP[r.id] = r; });

export function defaultLayout(){
  var L = {}, y = 2, W = 126, GR = PART, GF = 2;
  FAM.forEach(function(fm){
    var rs = ROOMS.filter(function(r){ return r.f === fm.id; })
                  .sort(function(a,b){ return b.a - a.a; });
    if(!rs.length) return;
    var x = 2, rowH = 0;
    rs.forEach(function(r){
      if(x > 2 && x + r.w > W){ x = 2; y += rowH + GR; rowH = 0; }
      L[r.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: r.w, h: r.h };
      x += r.w + GR; rowH = Math.max(rowH, r.h);
    });
    y += rowH + GF;
  });
  return L;
}


/* Adjacences du règlement, ramenées aux pièces réellement chiffrées du plan. */
export function rid(base, k){
  for(var i = 0; i < ROOMS.length; i++)
    if(ROOMS[i].base === base && ROOMS[i].k === (k || 0)) return ROOMS[i].id;
  return null;
}
export var PLINK = [];
export function lk(b1, k1, b2, k2, q, opt){
  var a = rid(b1, k1), b = rid(b2, k2);
  if(a && b) PLINK.push({ a: a, b: b, q: q, opt: opt ? 1 : 0 });
}
lk("Salle ACM",0,"Dépôt matériel ACM",0,"lien avec dépôt matériel");
lk("Salle ACM",1,"Dépôt matériel ACM",1,"lien avec dépôt matériel");
lk("Bureau direction et admin.",0,"Salle de réunion",0,"proche de la salle de réunion");
lk("Bureau direction et admin.",1,"Salle de réunion",0,"proche de la salle de réunion");
lk("Bureau direction et admin.",0,"Local reproduction",0,"proche des bureaux");
lk("Salle des maîtres",0,"Local reproduction",0,"… et de la salle des maîtres");
lk("Salle de sport double",0,"Abri PC",0,"locaux engins en lien avec la salle de sport");
lk("Salle de sport double",0,"Scène",0,"attenante à la salle de sport");
lk("Salle de sport double",0,"Local de rangement",0,"rangement des tables et chaises");
lk("Vestiaires professeurs",0,"Vestiaires élèves",0,"à proximité des vestiaires élèves");
lk("Vestiaires professeurs",1,"Vestiaires élèves",2,"à proximité des vestiaires élèves");
lk("Cuisine",0,"Économat",0,"en lien avec la cuisine");
lk("Cuisine",0,"Réfectoire",0,"doit servir de cuisine pour l'UAPE");
lk("Salles d'activité",0,"Réfectoire",0,"en relation directe avec les salles d'activité");
lk("Salles d'activité",1,"Réfectoire",0,"en relation directe avec les salles d'activité");
lk("Salle de pause",0,"Salle des maîtres",0,"peut être mutualisée avec la salle des maîtres",1);
/* un vestiaire devant l'entrée de chaque salle de classe : dix-huit adjacences de plus */
(function(){
  for(var vk = 0; vk < 18; vk++){
    lk("Salles de classe standard", vk, "Vestiaires de classe", vk, "vestiaire devant l'entrée de la classe");
  }
})();

