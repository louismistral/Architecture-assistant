/* ============================================================================
   LES PARTIS — UNE GÉOMÉTRIE PAR PARTI, PAS UN NOM

   Le parti n'est pas une étiquette posée sur une composition quelconque : il
   la CONSTRUIT. Pour chaque parti, `composer()` dessine une figure exacte dans
   son propre repère, faite de volumes d'au plus la cote maximale :

     — des BRAS : des volumes accolés bout à bout, qui forment un bâtiment
       (même `bat`) — une barre, l'aile d'un L, la base d'un U ;
     — des BÂTIMENTS séparés, tenus à la distance voulue — des barres
       parallèles, des pavillons, les groupes d'un hameau.

   Ensuite, et dans cet ordre :

     1. le PROGRAMME — `programme()` donne à chaque volume son nombre d'étages
        et son emprise, de sorte que chaque niveau reçoive exactement sa
        surface bâtie : un volume est une extrusion, les étages ne débordent
        jamais ;
     2. la COHÉRENCE — `signature()` vérifie sur la figure que le parti est
        lisible : un U a une base et deux ailes du même côté qui tiennent un
        vide, une cour a au moins trois côtés autour d'un vide assez grand,
        des pavillons sont séparés… Une figure qui ne ressemble pas à son parti
        est jetée — c'est ce que veut dire l'option du LEVIER « parti », pas
        une contrainte sur le bâtiment ;
     3. le CADRE — c'est `gen.js`, une fois la figure posée d'un bloc sur le
        site : rien ne la déforme après coup.

   La diversité vient de l'intérieur du parti : longueur des ailes, asymétrie,
   nombre de volumes, hauteurs, écarts, orientation, position sur la parcelle.
   ========================================================================= */
import { V, courExigee } from "../data/cadre.js";
import { distVisee } from "../data/orientation.js";
import "../data/leviers.js";
import { RULES } from "../data/rules.js";
import { auModule } from "./model.js";
import { coins, ecart } from "./geom.js";

var M2 = function(){ return 2 * RULES.haut.mur; };
/* Deux distances, qui ne se confondent pas : l'écart que la figure VISE entre
   deux bâtiments — l'orientation « distance souhaitée », jamais sous la
   distance incendie —, et la distance INCENDIE, le cadre, seule à juger
   qu'une figure tient. */
function FEU(){ return RULES.dist.entre; }
function ECART(){ return Math.max(FEU(), distVisee()); }
function entre(r, a, b){ return a + r() * (b - a); }
function ent(r, a, b){ return Math.floor(entre(r, a, b + .999)); }

/* ---------- 1. LE PROGRAMME -------------------------------------------------
   `slots` : les volumes de la figure, chacun avec son nombre d'étages `haut`
   et un poids `p`. `A[k]` est la surface bâtie d'école du niveau hors sol k.
   Les volumes qui s'arrêtent au niveau k se partagent A[k] − A[k+1] : ainsi
   chaque niveau est exactement porté par ceux qui y montent. Quand aucune
   classe de hauteur ne correspond, la différence monte à la classe suivante,
   et ses étages supérieurs se réduisent — un retrait, jamais un débord. */
function programme(slots, A, d){
  var H = A.length, k, report = 0;
  /* Les emprises se calent sur l'ENVELOPPE des surfaces, du haut vers le bas :
     quand un étage demande plus que celui du dessous, l'emprise le loge quand
     même, et l'étage du dessous se retire. Chaque niveau garde sa surface. */
  var E = A.slice();
  for(k = H - 2; k >= 0; k--) E[k] = Math.max(E[k], E[k + 1]);
  slots.forEach(function(s){ s.f = 0; });
  for(k = 0; k < H; k++){
    var D = E[k] - (k + 1 < H ? E[k + 1] : 0) + report;
    var S = slots.filter(function(s){ return s.haut === k + 1; });
    if(!S.length){ report = D; continue; }
    report = 0;
    var W = 0;
    S.forEach(function(s){ W += s.p; });
    S.forEach(function(s){ s.f += D * s.p / W; });
  }
  if(report > 1) return false;
  var ok = true;
  for(k = 0; k < H; k++){
    var P = 0;
    slots.forEach(function(s){ if(s.haut > k) P += s.f; });
    slots.forEach(function(s){
      if(s.haut <= k) return;
      var a = P > 0 ? s.f * A[k] / P : 0;
      if(!s.lv) s.lv = [];
      s.lv.push({ k:k, a:a });
    });
  }
  slots.forEach(function(s){
    /* Les fourchettes de l'utilisateur ne bloquent rien : elles comptent dans
       la note. Seule une cote nulle n'est pas un volume. */
    var w0 = auModule(s.f / d);
    if(!(w0 > 0)) ok = false;
    s.w = w0; s.d = d;
    s.lv = s.lv.map(function(e){
      var dd = d, ww = auModule(e.a / d);
      if(s.gradin && e.k > 0){                 /* une terrasse se retire en profondeur */
        ww = w0; dd = auModule(e.a / w0);
      }
      if(!(Math.min(ww, dd) > 0)) ok = false;
      return { k:e.k, w:ww, d:dd, a:e.a };
    });
  });
  return ok;
}

/* Combien de volumes il faut dans chaque classe de hauteur pour que chacun
   reste dans la LARGEUR souhaitée : `hauts` pour ceux qui montent au dernier
   étage, `bas` pour ceux qui restent au rez. */
function besoins(A, d, r){
  var cap = Math.max(1, V.largeurMax - M2()) * d * .96;
  var H = A.length;
  var hauts = H > 1 ? Math.ceil(A[1] / cap) : 0;
  var bas = Math.ceil((A[0] - (H > 1 ? A[1] : 0)) / cap);
  /* un volume de plus par classe de hauteur, à pile ou face : le levier
     « figure » tire à parts égales */
  if(r() < .5) hauts++;
  if(r() < .5) bas++;
  return { hauts:Math.max(H > 1 ? 1 : 0, hauts), bas:Math.max(H > 1 ? 0 : 1, bas), H:H };
}
function slotsDe(b, r){
  var S = [], i;
  for(i = 0; i < b.hauts; i++){
    /* Pas de classe intermédiaire : la différence entre deux étages supérieurs
       est trop petite pour faire un volume — le dernier étage se retire. */
    S.push({ haut:b.H, p:entre(r, .8, 1.2) });
  }
  for(i = 0; i < b.bas; i++) S.push({ haut:1, p:entre(r, .8, 1.2) });
  return S;
}

/* ---------- 2. LA FIGURE ------------------------------------------------------
   Un BRAS est une file de volumes accolés, le long de u (dir 0) ou de v
   (dir 1), à partir d'une origine, dans un sens. Les cotes sont HORS TOUT, murs
   compris : c'est ce qui se touche. */
function Lout(s){ return s.w + M2(); }
function Dout(d){ return d + M2(); }
function longueur(S){ var l = 0; S.forEach(function(s){ l += Lout(s); }); return l; }
function bras(S, dir, ox, oy, sens, bat, role){
  var c = 0;
  S.forEach(function(s){
    var m = c + Lout(s) / 2;
    s.x = dir ? ox : ox + sens * m;
    s.y = dir ? oy + sens * m : oy;
    s.a = dir ? Math.PI / 2 : 0;
    s.bat = bat; s.role = role;
    c += Lout(s);
  });
  return c;
}
/* Répartir des volumes en `n` groupes, sans groupe vide, un peu inégalement. */
function repartir(S, n, r){
  var G = [], i;
  for(i = 0; i < n; i++) G.push([]);
  S.forEach(function(s, k){ G[k < n ? k : Math.floor(r() * n)].push(s); });
  return G;
}
function melanger(S, r){
  var T = S.slice(), i;
  for(i = T.length - 1; i > 0; i--){ var j = Math.floor(r() * (i + 1)), x = T[i]; T[i] = T[j]; T[j] = x; }
  return T;
}

var FIG = {
  /* BLOC COMPACT : deux rangs accolés par leurs longs côtés — chaque volume
     garde une façade longue —, centrés : un seul bâtiment ramassé. */
  compact: function(S, d, r){
    S = melanger(S, r);
    var G = [S.slice(0, Math.ceil(S.length / 2)), S.slice(Math.ceil(S.length / 2))];
    var D = Dout(d);
    G.forEach(function(g, k){ bras(g, 0, -longueur(g) / 2, k * D, 1, "b1", "rang" + k); });
    return true;
  },
  /* BARRE : une seule file, une direction dominante. */
  barre: function(S, d, r){
    bras(melanger(S, r), 0, 0, 0, 1, "b1", "barre");
    return true;
  },
  /* BARRES PARALLÈLES : deux à quatre barres de longueurs différentes, décalées,
     séparées d'un vide qui fait cour. */
  barres: function(S, d, r){
    var n = Math.max(2, Math.min(4, Math.min(S.length, ent(r, 2, 3))));
    var G = repartir(melanger(S, r), n, r), y = 0, D = Dout(d);
    G.forEach(function(g, k){
      var L = longueur(g), x0 = -L / 2 + entre(r, -12, 12);
      bras(g, 0, x0, y, 1, "b" + (k + 1), "barre");
      y += D + ECART() + entre(r, 4, 16);
    });
    return true;
  },
  /* L : une aile le long de u, l'autre perpendiculaire à l'une de ses
     extrémités — l'angle cadre un dehors. */
  L: function(S, d, r){
    S = melanger(S, r);
    var cut = Math.max(1, Math.min(S.length - 1, Math.round(S.length * entre(r, .35, .65))));
    var A = S.slice(0, cut), B = S.slice(cut), D = Dout(d);
    var LA = bras(A, 0, 0, 0, 1, "b1", "aile1");
    var gauche = r() < .5;
    bras(B, 1, gauche ? D / 2 : LA - D / 2, D / 2, 1, "b1", "aile2");
    return true;
  },
  /* U : une base et deux ailes du MÊME côté, de longueurs libres. */
  U: function(S, d, r){
    S = melanger(S, r);
    var nb = Math.max(Math.min(2, S.length - 2), Math.round(S.length * entre(r, .3, .45)));
    var base = S.slice(0, nb), ailes = repartir(S.slice(nb), 2, r), D = Dout(d);
    var LB = bras(base, 0, 0, 0, 1, "b1", "base");
    bras(ailes[0], 1, D / 2, D / 2, 1, "b1", "aile1");
    bras(ailes[1], 1, LB - D / 2, D / 2, 1, "b1", "aile2");
    return true;
  },
  /* COUR : trois côtés accolés — une base et deux ailes —, et un quatrième
     côté, bâtiment à part, qui ferme la cour à distance : on y passe. Le vide
     central se mesure dans la cohérence. */
  cour: function(S, d, r){
    S = melanger(S, r);
    if(S.length < 4) return false;
    var nH = Math.max(1, Math.round(S.length * entre(r, .2, .3)));
    var haut = S.slice(0, nH), rest = S.slice(nH);
    var nb = Math.max(Math.min(2, rest.length - 2), Math.round(rest.length * entre(r, .3, .45)));
    var base = rest.slice(0, nb), ailes = repartir(rest.slice(nb), 2, r), D = Dout(d);
    var LB = bras(base, 0, 0, 0, 1, "b1", "base");
    var h1 = bras(ailes[0], 1, D / 2, D / 2, 1, "b1", "cote1");
    var h2 = bras(ailes[1], 1, LB - D / 2, D / 2, 1, "b1", "cote2");
    var LT = longueur(haut), y = D / 2 + Math.max(h1, h2) + ECART() + entre(r, 1, 8) + D / 2;
    bras(haut, 0, (LB - LT) / 2 + entre(r, -6, 6), y, 1, "b2", "haut");
    return true;
  },
  /* PAVILLONS : des volumes autonomes, en trame, séparés par des dehors. */
  pavillons: function(S, d, r){
    S = melanger(S, r);
    /* deux ou trois rangs, décalés d'un demi-pas une fois sur deux : une trame,
       pas une grille rigide */
    var rangs = S.length <= 4 ? 2 : r() < .5 ? 2 : 3, cols = Math.ceil(S.length / rangs);
    var gx = ECART() + entre(r, 1, 6), gy = ECART() + entre(r, 1, 6);
    var jeu = Math.min(gx, gy) - ECART();          /* le jitter ne mange pas l'écart */
    var larg = 0, dec = r() < .5;
    S.forEach(function(s){ larg = Math.max(larg, Lout(s)); });
    S.forEach(function(s, k){
      var c = k % cols, l = Math.floor(k / cols);
      s.x = c * (larg + gx) + (dec && l % 2 ? (larg + gx) / 2 : 0) + entre(r, -jeu, jeu) / 2;
      s.y = l * (Dout(d) + gy) + entre(r, -jeu, jeu) / 2;
      s.a = 0; s.bat = "p" + (k + 1); s.role = "pavillon";
    });
    return true;
  },
  /* HAMEAU : des groupes d'un à trois volumes, chacun son orientation, posés
     autour d'une place. On rejette jusqu'à ce que les écarts tiennent. */
  hameau: function(S, d, r){
    S = melanger(S, r);
    var nG = Math.max(3, Math.min(S.length, ent(r, 3, 4)));
    var G = repartir(S, nG, r), D = Dout(d);
    var R = 12;
    for(var essai = 0; essai < 40; essai++, R += 2.5){
      var ok = true;
      G.forEach(function(g, k){
        var th = (k / nG) * 2 * Math.PI + entre(r, -.35, .35);
        var rot = entre(r, -.6, .6);
        var cx = Math.cos(th) * R, cy = Math.sin(th) * R;
        /* un groupe : une petite file, ou un coude */
        var coude = g.length >= 2 && r() < .5;
        bras(coude ? g.slice(0, 1) : g, 0, 0, 0, 1, "h" + (k + 1), "groupe");
        if(coude) bras(g.slice(1), 1, D / 2, D / 2, 1, "h" + (k + 1), "groupe");
        var mx = 0, my = 0;
        g.forEach(function(s){ mx += s.x / g.length; my += s.y / g.length; });
        g.forEach(function(s){
          var x = s.x - mx, y = s.y - my, c = Math.cos(rot), sn = Math.sin(rot);
          s.x = cx + x * c - y * sn; s.y = cy + x * sn + y * c; s.a += rot;
        });
      });
      if(ecartsTiennent(S)) return true;
      ok = false;
    }
    return false;
  },
  /* COMPOSITION LIBRE : ni trame ni figure, mais pas le hasard. Deux à quatre
     groupes — une file, un coude, ou des volumes seuls —, chacun avec son
     orientation, rapprochés autant que les écarts le permettent. */
  libre: function(S, d, r){
    S = melanger(S, r);
    var nG = Math.max(2, Math.min(S.length, ent(r, 2, 4)));
    var G = repartir(S, nG, r), D = Dout(d), R = 10, n = 0;
    for(var essai = 0; essai < 50; essai++, R += 2.5){
      var off = entre(r, 0, 2 * Math.PI);
      G.forEach(function(g, k){
        var t = r(), bat = "l" + (k + 1);
        if(t < .4 || g.length === 1) bras(g, 0, 0, 0, 1, bat, "file");
        else if(t < .75){ bras(g.slice(0, 1), 0, 0, 0, 1, bat, "coude");
                          bras(g.slice(1), 1, D / 2, D / 2, 1, bat, "coude"); }
        else g.forEach(function(s2, j){ bras([s2], 0, j * (Lout(s2) + ECART() + 2), 0, 1,
                                              bat + "-" + j, "seul"); });
        var th = off + (k / nG) * 2 * Math.PI + entre(r, -.5, .5), rot = entre(r, -1.2, 1.2);
        var cx = Math.cos(th) * R, cy = Math.sin(th) * R, mx = 0, my = 0;
        g.forEach(function(s2){ mx += s2.x / g.length; my += s2.y / g.length; });
        g.forEach(function(s2){
          var x = s2.x - mx, y = s2.y - my, c = Math.cos(rot), sn = Math.sin(rot);
          s2.x = cx + x * c - y * sn; s2.y = cy + x * sn + y * c; s2.a += rot;
        });
      });
      if(ecartsTiennent(S)) return true;
    }
    return false;
  },
  /* TERRASSES : des rangs parallèles qui descendent en gradins — le plus haut
     en amont, chaque étage se retire vers l'amont. `gen.js` tourne la figure
     pour que les rangs suivent les courbes de niveau. */
  terrasses: function(S, d, r){
    var hauts = S.filter(function(s){ return s.haut > 1; });
    var bas = S.filter(function(s){ return s.haut === 1; });
    var rangs = [hauts, bas].filter(function(g){ return g.length; });
    if(rangs.length === 1 && rangs[0].length >= 2) rangs = repartir(rangs[0], 2, r);
    var y = 0, D = Dout(d);
    rangs.forEach(function(g, k){
      g.forEach(function(s){ s.gradin = s.haut > 1; });
      bras(g, 0, -longueur(g) / 2 + entre(r, -8, 8), y, 1, "t" + (k + 1), "rang" + k);
      y += D + ECART() + entre(r, 2, 10);
    });
    return true;
  },
  /* PEIGNE : un corps principal, et des branches perpendiculaires d'un même
     côté, espacées d'au moins la distance entre bâtiments. */
  peigne: function(S, d, r){
    S = melanger(S, r);
    if(S.length < 3) return false;
    var nDos = Math.max(2, Math.min(S.length - 2, Math.round(S.length * entre(r, .4, .55))));
    var dos = S.slice(0, nDos), reste = S.slice(nDos);
    var nB = Math.max(2, Math.min(4, Math.round(reste.length * entre(r, .5, 1))));
    var B = repartir(reste, Math.min(nB, reste.length), r);
    var D = Dout(d), L = bras(dos, 0, 0, 0, 1, "b1", "dos");
    var pas = D + ECART() + entre(r, 0, 6), place = L - D;
    /* autant de branches que le dos en peut porter, deux au moins */
    var n = Math.min(B.length, Math.floor(place / pas) + 1);
    if(n < 2) return false;
    if(n < B.length){ var surplus = B.splice(n); surplus.forEach(function(g, k){ B[k % n] = B[k % n].concat(g); }); }
    var dep = entre(r, 0, place - (n - 1) * pas);
    B.forEach(function(g, k){ bras(g, 1, D / 2 + dep + k * pas, D / 2, 1, "b1", "branche"); });
    return true;
  }
};

/* Deux volumes de bâtiments différents sont à la distance minimale ; deux
   volumes d'un même bâtiment ne se recouvrent pas. Vérifié sur la figure, avant
   même qu'elle soit posée. */
function rectDe(s){ return { x:s.x, y:s.y, w:Lout(s), d:Dout(s.d), a:s.a }; }
function ecartsTiennent(S){
  for(var i = 0; i < S.length; i++){
    for(var j = i + 1; j < S.length; j++){
      var e = ecart(rectDe(S[i]), rectDe(S[j]));
      var meme = S[i].bat === S[j].bat;
      if(e < -.15) return false;
      if(e < FEU() - .01 && !meme) return false;
    }
  }
  return true;
}

/* ---------- 3. LA COHÉRENCE DU PARTI -------------------------------------------
   La figure ressemble-t-elle à son parti ? On le mesure sur elle, pas sur son
   nom. */
function batsDe(S){ var B = {}; S.forEach(function(s){ B[s.bat] = 1; }); return Object.keys(B); }
function role(S, x){ return S.filter(function(s){ return s.role === x; }); }
function paralleles(S){
  return S.every(function(s){ return Math.abs(Math.sin(s.a - S[0].a)) < .02; });
}
function boite(S){
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, a = 0;
  S.forEach(function(s){
    coins(rectDe(s)).forEach(function(p){
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    });
    a += Lout(s) * Dout(s.d);
  });
  var W = x1 - x0, H = y1 - y0;
  return { W:W, H:H, aspect: Math.max(W, H) / Math.max(1, Math.min(W, H)), rempli: a / Math.max(1, W * H) };
}
function longueurBras(S){ var l = 0; S.forEach(function(s){ l += Lout(s); }); return l; }
export function signature(pid, S, d){
  var D = Dout(d), B = batsDe(S), bx = boite(S);
  if(!ecartsTiennent(S)) return false;
  switch(pid){
    case "compact": return B.length === 1 && bx.aspect <= 3.2 && bx.rempli >= .7;
    case "barre":   return B.length === 1 && paralleles(S) && bx.aspect >= 3
                      && S.every(function(s){ return Math.abs(s.y - S[0].y) < .01; });
    case "barres":  return B.length >= 2 && paralleles(S);
    case "L":       return role(S, "aile1").length && role(S, "aile2").length
                      && longueurBras(role(S, "aile1")) >= 2 * D && longueurBras(role(S, "aile2")) >= 1.5 * D;
    case "U":
      var a1 = role(S, "aile1"), a2 = role(S, "aile2"), base = role(S, "base");
      if(!a1.length || !a2.length || !base.length) return false;
      /* les deux ailes tiennent un vide entre elles, d'au moins la distance */
      return longueurBras(base) - 2 * D >= FEU() && longueurBras(a1) >= D && longueurBras(a2) >= D;
    case "cour":
      var c1 = role(S, "cote1"), c2 = role(S, "cote2"), b0 = role(S, "base"), h0 = role(S, "haut");
      if(!c1.length || !c2.length || !b0.length || !h0.length) return false;
      /* le vide que les quatre côtés tiennent : entre les ailes, de la base au
         bâtiment qui ferme la cour */
      var vide = (longueurBras(b0) - 2 * D) * (h0[0].y - D);
      return vide >= courExigee() && longueurBras(b0) - 2 * D >= FEU();
    case "pavillons": return B.length >= 3 && B.length === S.length;
    case "hameau":
      var ang = [];
      S.forEach(function(s){
        var t = ((s.a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
        if(!ang.some(function(x){ return Math.abs(x - t) < .1; })) ang.push(t);
      });
      return B.length >= 3 && ang.length >= 2;
    case "libre": return S.length >= 2;
    case "terrasses":
      return S.some(function(s){ return s.gradin; }) && B.length >= 1;
    case "peigne":
      return role(S, "dos").length >= 1 && batsDe(role(S, "branche")).length >= 1
        && (function(){ var X = {}; role(S, "branche").forEach(function(s){ X[s.x.toFixed(1)] = 1; });
                        return Object.keys(X).length >= 2; })();
  }
  return true;
}

/* ---------- la composition d'un parti ------------------------------------------
   Rend la figure dans son repère, ou `null` si le parti ne se construit pas
   avec ce programme et cette profondeur — le générateur essaie alors autre
   chose. */
export var PARTIS_FIGURES = Object.keys(FIG);
export function composer(pid, A, d, r){
  var f = FIG[pid];
  if(!f) return null;
  var b = besoins(A, d, r);
  var S = slotsDe(b, r);
  /* Le hameau et les pavillons veulent des volumes plus petits et plus nombreux. */
  if((pid === "pavillons" || pid === "hameau") && r() < .5)
    S.push({ haut: S.length && r() < .5 ? b.H : 1, p:entre(r, .7, 1) });
  if(pid === "terrasses") S.forEach(function(s){ if(s.haut > 1) s.gradin = true; });
  if(!programme(S, A, d)) return null;
  if(!f(S, d, r)) return null;
  if(!signature(pid, S, d)) return null;
  return S;
}
