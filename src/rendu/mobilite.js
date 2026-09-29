/* ============================================================================
   LA MOBILITÉ DESSINÉE — bus, dépose-minute, stationnement, vélos, piétons

   Le massing compte le terrain du stationnement (`juge.js — terrainLibre`),
   il ne le dessine pas. Le plan de situation, lui, doit le montrer : ce module
   pose, autour des volumes générés, ce que le règlement demande (art. 2.4,
   2.10) avec les cotes de `RULES.ext`, et le long des côtés de `ACCES`.

     baie des bus et dépose-minute   le long de la rue du Casino (voitures)
     parking                         le plus près possible de cette rue, relié par une voie
     abri à vélos                    près de l'école, côté chemin du Petit Mont
     cheminement piéton              du chemin du Petit Mont à l'école

   Tout est en mètres du site. Rien n'est tiré au hasard : la même volumétrie
   donne le même stationnement. Ce qui ne tient pas est dit (`manque`).
   ========================================================================= */
import { PER } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { ACCES } from "../data/planches.js";
import { axePer, coins, ecart, segDist, tientA } from "../mass/geom.js";
import { etagesDe, pontRect } from "../mass/model.js";

var X = RULES.ext;

function seg(i){ return [PER[i], PER[(i + 1) % PER.length]]; }
function angle(s){ return Math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0]); }
/* le point à `t` le long du côté, rentré de `dans` mètres vers l'intérieur */
function surCote(s, t, dans){
  var a = angle(s), x = s[0][0] + (s[1][0] - s[0][0]) * t, y = s[0][1] + (s[1][1] - s[0][1]) * t;
  var n = [-Math.sin(a), Math.cos(a)];
  /* l'intérieur est du côté où le point rentré reste dans le périmètre */
  var sg = tientA(PER, { x:x + n[0] * 3, y:y + n[1] * 3, w:.1, d:.1, a:0 }, 0) ? 1 : -1;
  return [x + sg * n[0] * dans, y + sg * n[1] * dans];
}
function longueur(s){ return Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]); }

/* Les emprises à éviter : chaque étage de chaque volume, et les passerelles. */
export function obstacles(vols){
  var o = [];
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ o.push(e.rc); }); });
  (vols.ponts || []).forEach(function(p){ var r = pontRect(p, vols); if(r) o.push(r); });
  return o;
}
function libre(rc, obs, marge){
  if(!tientA(PER, rc, 0.5)) return false;
  for(var i = 0; i < obs.length; i++) if(ecart(rc, obs[i]) < marge) return false;
  return true;
}

/* Une bande le long d'un côté d'accès : glissée sur le côté jusqu'à la
   première position libre. */
function lelong(w, d, obs){
  for(var c = 0; c < ACCES.auto.length; c++){
    var s = seg(ACCES.auto[c]), L = longueur(s);
    if(L < w) continue;
    for(var t = w / 2 / L; t <= 1 - w / 2 / L; t += 1 / L){
      var p = surCote(s, t, d / 2 + .6);
      var rc = { x:p[0], y:p[1], w:w, d:d, a:angle(s) };
      if(libre(rc, obs, 1.5)) return rc;
    }
  }
  return null;
}

/* Le parking : `n` places en `m` modules (deux rangées et leur allée),
   cherché sur une grille, orienté comme un côté d'accès ou l'axe du site,
   le plus près de la rue du Casino. */
function parking(n, obs){
  var pl = X.place, mod = 2 * pl[1] + X.allee;
  var angles = ACCES.auto.map(function(i){ return angle(seg(i)); }).concat([axePer()]);
  var rue = ACCES.auto.map(seg);
  function versRue(x, y){
    var b = Infinity;
    rue.forEach(function(s){ b = Math.min(b, segDist(x, y, s[0][0], s[0][1], s[1][0], s[1][1])); });
    return b;
  }
  var best = null;
  [1, 2, 3].forEach(function(m){
    var w = Math.ceil(n / (2 * m)) * pl[0], d = m * mod;
    angles.forEach(function(a0){
      [a0, a0 + Math.PI / 2].forEach(function(a){
        for(var x = 0; x <= 180; x += 3) for(var y = 0; y <= 125; y += 3){
          var rc = { x:x, y:y, w:w, d:d, a:a };
          var sc = versRue(x, y);
          if(best && sc >= best.sc) continue;
          if(libre(rc, obs, 2)) best = { rc:rc, m:m, n:n, sc:sc };
        }
      });
    });
  });
  return best;
}

/* La voie d'un lot : du bout de son allée au point le plus proche de la rue. */
function voie(rc){
  var q = coins(rc), best = null;
  [[(q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2], [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2]].forEach(function(b){
    ACCES.auto.forEach(function(i){
      var s = seg(i);
      for(var t = 0; t <= 1; t += .05){
        var p = [s[0][0] + (s[1][0] - s[0][0]) * t, s[0][1] + (s[1][1] - s[0][1]) * t];
        var l = Math.hypot(p[0] - b[0], p[1] - b[1]);
        if(!best || l < best.l) best = { l:l, a:b, b:p };
      }
    });
  });
  return best ? [best.a, best.b] : null;
}

/* Les places d'un parking : les traits entre places, rangée par rangée. */
function places(P){
  var rc = P.rc, pl = X.place, mod = 2 * pl[1] + X.allee, out = [];
  var c = Math.cos(rc.a), s = Math.sin(rc.a);
  function pt(u, v){ return [rc.x + u * c - v * s, rc.y + u * s + v * c]; }
  var n = Math.round(rc.w / pl[0]);
  for(var m = 0; m < P.m; m++){
    var v0 = -rc.d / 2 + m * mod;
    [[v0, v0 + pl[1]], [v0 + mod - pl[1], v0 + mod]].forEach(function(r){
      for(var k = 0; k <= n; k++){
        var u = -rc.w / 2 + k * pl[0];
        out.push([pt(u, r[0]), pt(u, r[1])]);
      }
    });
  }
  return out;
}

export function mobilite(vols){
  var obs = obstacles(vols), manque = [], M = { manque:manque };
  M.bus = lelong(X.baieBus[0], X.baieBus[1], obs);
  if(M.bus) obs = obs.concat([M.bus]); else manque.push("baie des bus");
  M.depose = lelong(X.depose * X.placeDepose[0] + 4, X.placeDepose[1], obs);
  if(M.depose) obs = obs.concat([M.depose]); else manque.push("dépose-minute");

  /* le parking en un, deux ou trois lots : chacun le plus grand qui tient */
  M.lots = []; M.traits = []; M.voies = [];
  var reste = X.voitures;
  while(reste > 0 && M.lots.length < 3){
    /* le plus grand lot qui tient, par dichotomie sur le nombre de places */
    var P = parking(reste, obs), lo = 0, hi = reste;
    while(!P && hi - lo > 2 || P && P.n < reste && hi - lo > 2){
      var mid = 2 * Math.round((lo + hi) / 4), Q = parking(mid, obs);
      if(Q){ P = Q; lo = mid; } else hi = mid;
    }
    if(!P) break;
    M.lots.push(P); reste -= P.n;
    M.traits = M.traits.concat(places(P));
    obs = obs.concat([P.rc]);
    var v = voie(P.rc);
    if(v) M.voies.push(v);
  }
  if(reste > 0) manque.push(reste + " places de parc");

  /* l'abri à vélos : autour du volume le plus proche du chemin du Petit Mont */
  var doux = ACCES.doux.map(seg), porte = null, bd = Infinity;
  vols.forEach(function(v){
    doux.forEach(function(s){
      var d = segDist(v.x, v.y, s[0][0], s[0][1], s[1][0], s[1][1]);
      if(d < bd){ bd = d; porte = v; }
    });
  });
  if(porte){
    var lv = Math.ceil(X.velos / 2) * X.pasVelo;
    for(var r = 0; r <= 60 && !M.velos; r += 3){
      for(var k = 0; k < 24 && !M.velos; k++){
        var an = k / 24 * 2 * Math.PI;
        var cand = { x:porte.x + Math.cos(an) * (r + 10), y:porte.y + Math.sin(an) * (r + 10),
                     w:lv, d:X.abriVelo, a:porte.a };
        if(libre(cand, obs, 2)) M.velos = cand;
      }
    }
    if(!M.velos) manque.push("abri à vélos");
    /* le cheminement : du milieu du côté sud au volume */
    var s0 = doux[0], m0 = surCote(s0, .5, 0);
    M.pieton = [m0, [porte.x, porte.y]];
  }
  return M;
}
