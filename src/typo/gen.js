/* ============================================================================
   LE GÉNÉRATEUR DE PLANS — ce que dessine l'onglet Typologies

   Sorti de `plans.html` pour qu'on puisse le MESURER ailleurs que dans la
   page : la recherche, le jugement (`evaluer()`), les variantes et node
   tirent le même plan que l'écran. La page le reçoit de son hôte
   (`views/render.js — typoHote()`), comme ses données.

   `creerPG(D)` : un générateur pour ces données (`typo/donnees.js —
   donneesTypo()`), avec ses propres caches — noyaux, ancres. `planifier(D)` :
   tous les niveaux d'un coup. Pur : la même donnée rend le même plan.
   ========================================================================= */
/* ===== Générateur de plans : lit la pile du mixer et les volumes du massing =====
   Règles tenues :
   - une surface de programme ne change pas : largeur = surface ÷ profondeur de bande ;
   - chaque corps garde les cotes que le Massing lui a données : le plan se
     dessine DEDANS, et ce qui n'y tient pas est dit non posé — jamais le
     volume ne s'allonge ;
   - la seed (`D.graine`) ne change que l'ordonnance : l'ordre des
     familles, celui des postes dans une famille, la place d'un noyau quand
     deux se valent ;
   - le couloir se place là où les deux bandes finissent ensemble ;
   - des noyaux escalier + ascenseur qui desservent chaque niveau hors du rez et
     tiennent la voie d'évacuation, chacun au même point à tous les niveaux de
     son corps ;
   - un couloir finit toujours sur quelque chose : un noyau, un hall, un passage
     vers le corps voisin, ou la porte de la pièce qui le ferme ;
   - les pièces d'une famille se suivent ; une largeur de pièce se règle au
     module de 0,50 m, sa profondeur suit. */
export function creerPG(D){
  /* les règles du projet, données par l'onglet (`typo/donnees.js`) */
  var R0 = (D && D.regles) || {};
  var COULOIR = R0.couloir || 2.40, MUR = R0.mur || 0.50, CLOISON = R0.cloison || 0.10,
      CAGE_A = R0.cage || 24, NOY = R0.noyau || { prof:5, volee:1.2, asc:[2.1, 2.4] },
      FEU = R0.feu || { cageSeuil:900, fuiteSimple:35, fuiteDouble:50 },
      LIEN = R0.lien || 15, MODULE = R0.module || 0.5, VIDE = R0.vide, PLAN = R0.plan || {},
      FRONT_MAX = 12.5, PETIT = (PLAN.piece || {}).petit || 30, BMIN = 5.6, PALIER = 1.2, CLASSE = R0.classe,
      DEUX = PLAN.deuxRangs || 14;
  /* l'ordre des familles : les pièces d'une famille se posent ensemble */
  var FAMS_O = ["cla", "eau", "uap", "adm", "spo", "tec", "pis", "ext"];
  var WC = 2 * NOY.volee + 0.10 + NOY.asc[0] + CLOISON;     /* largeur du noyau */
  var FL = [];                                               /* les niveaux */
  /* LA SEED : un tirage PUR de la seed et d'un nom — le même à chaque appel, si
     bien que le contrôle, l'écran et le Rendu voient le même plan. */
  var GR = 1;
  function alea(nom){
    var h = (GR ^ 0x9E3779B9) >>> 0;
    for(var i = 0; i < nom.length; i++) h = Math.imul(h ^ nom.charCodeAt(i), 16777619) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D) >>> 0;
    return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
  }
  var FAMS0 = FAMS_O.slice();

  function chapOf(key){ return key.split("|")[0]; }
  function local(cx, cy, a, x, y){
    var c = Math.cos(a), s = Math.sin(a);
    return [cx + x * c - y * s, cy + x * s + y * c];
  }
  function unites(rooms){
    var out = [];
    rooms.forEach(function(r){
      if(r.hors) return;
      var base = { key:r.key, n:r.n, f:r.f, chap:chapOf(r.key), pub:r.pub };
      /* chaque pièce pour elle-même, même un WC de 2 m² : un lien « auprès de
         chaque classe » ne se tient qu'avec des WC répartis */
      for(var k = 0; k < r.q; k++)
        out.push(Object.assign({}, base, { a:r.u, lab:r.n + (r.q > 1 ? " " + (k + 1) : "") }));
    });
    return out;
  }
  function famO(u){ var k = FAMS_O.indexOf(u.f); return k < 0 ? 99 : k; }

  /* UNE PIÈCE, PAS UN COULOIR (`RULES.plan.piece`). Avant, chaque pièce prenait
     toute la profondeur de sa bande : un WC PMR de 3 m² devenait une lame de
     0,48 × 6,20 m. La surface reste fixe ; seule la forme se règle. */
  var PC = PLAN.piece || { ratio:2, ratioGrand:3, grand:100, larg:1.6, cabine:0.9 }, PMR = PLAN.pmr || [1.65, 1.8];
  function ratioDe(a){ return a >= PC.grand ? PC.ratioGrand : PC.ratio; }
  function cabine(u){ return /WC|Toilette/i.test(u.n || "") && !/PMR|individuelle/i.test(u.n || ""); }
  /* les largeurs admises le long de la bande, [min, max] : la profondeur est
     la surface divisée par la largeur */
  function larges(u){
    var a = u.a, R = ratioDe(a), l = cabine(u) ? PC.cabine : PC.larg;
    if(/PMR/.test(u.n || "")) return [PMR[0], Math.max(PMR[0], a / PMR[1])];
    var lo = Math.max(l, Math.sqrt(a / R));
    return [lo, Math.max(lo, Math.min(a / l, Math.sqrt(a * R)))];
  }
  /* la profondeur d'une pièce dans une bande de profondeur H : toute la bande
     si ses proportions le permettent, sinon contre la façade, et le reste
     devant elle — un dégagement sur le couloir. Une classe garde la
     profondeur de la ligne `classe-dim`. */
  function profDe(u, H){
    var p = u.a / larges(u)[0];
    if(CLASSE && /classe/i.test(u.n || "")) p = Math.min(p, CLASSE[1]);
    return Math.min(H, p);
  }
  /* UN BLOC DE PETITES PIÈCES, dans une bande de profondeur H, contre la
     façade. Trois dispositions, on garde la plus étroite :
     - chacune seule, un dégagement devant elle ;
     - en colonnes : plusieurs pièces empilées s'ouvrent sur un sas qui va du
       couloir à la façade, deux colonnes de part et d'autre ;
     - la plus grande au fond, les autres devant elle, côte à côte, et un sas
       entre elles pour aller à celle du fond.
     Le sas a la largeur de l'aire de rotation s'il dessert un WC PMR (un
     fauteuil y tourne pour entrer), `piece.sas` sinon. Chaque pièce a sa
     porte : sur le couloir, sur le dégagement devant elle, ou sur le sas. */
  function sasDe(L){ return L.some(function(c){ return /PMR/.test(c.n || ""); }) ? (PLAN.rotation || 1.5) : (PC.sas || 1.2); }
  function peigne(cel, H){
    function large(c, d){ return Math.max(larges(c)[0], c.a / d); }
    function poser(suite){
      var out = [], devant = [], u = 0;
      suite.forEach(function(k, j){
        if(k.sas){ u += k.sas; return; }
        var v = H, sas = suite[j + 1] && suite[j + 1].sas ? 1 : suite[j - 1] && suite[j - 1].sas ? -1 : 0;
        /* la plus grande contre la façade, les autres devant elle */
        k.cel.forEach(function(c){ var h = c.a / k.w; v -= h; out.push(Object.assign({}, c, { u0:u, v0:v, W:k.w, H:h, sas:sas })); });
        if(v > 0.05) devant.push({ u0:u, W:k.w, H:v });
        u += k.w;
      });
      return { W:u, cel:out, devant:devant };
    }
    var tri = cel.slice().sort(function(p, q){ return q.a - p.a; });
    var opts = [poser(cel.map(function(c){ return { cel:[c], w:large(c, H) }; }))];
    /* en colonnes : une colonne grandit tant qu'une largeur convient à toutes */
    var cols = [];
    tri.forEach(function(c){
      var k = cols[cols.length - 1], w = larges(c);
      if(k){
        var lo = Math.max(k.lo, w[0], (k.a + c.a) / H), hi = Math.min(k.hi, w[1]);
        if(lo <= hi){ k.cel.push(c); k.a += c.a; k.lo = Math.max(k.lo, w[0]); k.hi = hi; k.w = lo; return; }
      }
      cols.push({ cel:[c], a:c.a, lo:w[0], hi:w[1], w:large(c, H) });
    });
    var pile = cols.filter(function(k){ return k.cel.length > 1; });
    if(pile.length){
      var suite = [];
      for(var j = 0; j < pile.length; j += 2){
        var deux = pile.slice(j, j + 2);
        suite.push(deux[0], { sas:sasDe(deux[0].cel.concat(deux[1] ? deux[1].cel : [])) });
        if(deux[1]) suite.push(deux[1]);
      }
      opts.push(poser(suite.concat(cols.filter(function(k){ return k.cel.length < 2; }))));
    }
    /* la plus grande au fond, sur toute la largeur du bloc */
    if(tri.length > 1){
      var B = tri[0], F = tri.slice(1), wb = larges(B), sas = sasDe(F), Wc = wb[0], wf, av;
      for(var t = 0; t < 8; t++){
        av = H - B.a / Wc;
        wf = F.map(function(c){ return av > 0 ? large(c, av) : Infinity; });
        var need = sas; wf.forEach(function(w){ need += w; });
        if(need <= Wc + 1e-6) break;
        Wc = need;
      }
      var ok = Wc <= wb[1] + 1e-6 && wf.every(function(w, k){ return w <= larges(F[k])[1] + 1e-6; });
      if(ok){
        var dB = B.a / Wc, out = [Object.assign({}, B, { u0:0, v0:H - dB, W:Wc, H:dB, sas:0 })], devant = [], u = 0;
        F.forEach(function(c, k){
          var h = c.a / wf[k];
          out.push(Object.assign({}, c, { u0:u, v0:H - dB - h, W:wf[k], H:h, sas:0 }));
          if(H - dB - h > 0.05) devant.push({ u0:u, W:wf[k], H:H - dB - h });
          u += wf[k];
        });
        out[0].porteU = (u + Wc) / 2;
        opts.push({ W:Wc, cel:out, devant:devant });
      }
    }
    return opts.sort(function(p, q){ return p.W - q.W; })[0];
  }
  /* la bande A (y local < 0) regarde (sin a, −cos a) ; le sud est (0, −1) */
  function bandeSud(a){ return Math.cos(a) > 0 ? "A" : "B"; }
  function lvlDe(i){ return FL[i] ? FL[i].lvl : 0; }

  /* LA VOIE D'ÉVACUATION d'un point : en équerre jusqu'au noyau le plus proche
     de `C`, et sa limite — un seul escalier ou deux (AEAI 16-15). La même
     mesure pose les noyaux (`hotes`) et les contrôle (`mesures.js — lirePlans`). */
  function fuite(p, C){
    var d = Infinity;
    C.forEach(function(c){ d = Math.min(d, Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1])); });
    return { d:d, lim:C.length > 1 ? FEU.fuiteDouble : FEU.fuiteSimple };
  }

  /* LES NOYAUX D'UN BÂTIMENT. Un noyau est une cage d'escalier et d'ascenseur :
     il traverse TOUS les niveaux de son corps au même point — dans ce que ses
     niveaux ont en commun, contre la façade du côté du noyau. Les corps d'un
     même bâtiment (`bat`) s'accolent et leurs couloirs se prolongent : un noyau
     dessert tout le bâtiment au niveau où il est. On ajoute, un à un, celui qui
     répare le plus — un niveau sans noyau hors du rez (SIA 500), un étage de
     plus de 900 m² à un seul, la voie d'évacuation en trop — jusqu'à ce que
     tout tienne. À égalité, la seed choisit. */
  var HOTES = null;
  function hotes(vols){
    if(HOTES) return HOTES;
    HOTES = {};
    var LV = D ? D.floors : [], cH = NOY.prof;
    function rez(i){ return LV[i] && LV[i].lvl === 0; }
    /* les points les plus loin que lise la mesure : le centre d'une pièce est
       à une demi-bande au moins de la façade, et presque toujours du pignon —
       les pièces ne sont pas encore posées */
    function lus4(v, e){ var w = Math.max(0, e.w - PC.cabine) / 2, d = Math.max(0, e.d - BMIN) / 2, dx = e.dx || 0, dy = e.dy || 0;
      return [[-w, -d], [w, -d], [w, d], [-w, d]].map(function(q){ return local(v.x, v.y, v.a, q[0] + dx, q[1] + dy); }); }
    var G = {};
    vols.forEach(function(v){ if(!v.lv.some(function(e){ return e.keys; })) (G[v.bat || v.id] = G[v.bat || v.id] || []).push(v); });
    Object.keys(G).forEach(function(k){
      var g = G[k], places = [], niv = {};
      g.forEach(function(v){ v.lv.forEach(function(e){ (niv[e.i] = niv[e.i] || []).push({ v:v, e:e }); }); });
      /* les places d'un noyau : l'emprise commune à tous les niveaux du corps,
         tous les dix mètres environ, si la cage y tient dans le rang du noyau */
      g.forEach(function(v){
        var N = coteNoyau(v), x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity;
        v.lv.forEach(function(e){
          var dx = e.dx || 0, dy = e.dy || 0;
          x0 = Math.max(x0, dx - e.w / 2); x1 = Math.min(x1, dx + e.w / 2);
          y0 = Math.max(y0, dy - e.d / 2); y1 = Math.min(y1, dy + e.d / 2);
        });
        var y = N === "A" ? y0 + cH / 2 : y1 - cH / 2;
        if(x1 - x0 < WC || !v.lv.every(function(e){
          var T = e.d - COULOIR;
          return cH + ecartFacade(N, e, y) <= (e.d >= DEUX ? T - BMIN : T) + 0.01;
        })) return;
        var n = Math.ceil((x1 - x0 - WC) / 10);
        for(var j = 0; j <= n; j++){
          var x = x0 + WC / 2 + (n ? j * (x1 - x0 - WC) / n : 0);
          places.push({ v:v, x:x, y:y, p:local(v.x, v.y, v.a, x, y), lv:v.lv.map(function(e){ return e.i; }), r:alea("noyau " + v.id + " " + j) });
        }
      });
      /* ce qui ne tient pas avec les noyaux `P` */
      function manque(P){
        var sans = 0, feu = 0, trop = 0;
        Object.keys(niv).forEach(function(i){
          i = +i;
          var C = P.filter(function(q){ return q.lv.indexOf(i) >= 0; }).map(function(q){ return q.p; }), aire = 0;
          niv[i].forEach(function(c){
            aire += c.e.w * c.e.d;
            if(rez(i)) return;
            if(!C.length){ sans++; return; }
            lus4(c.v, c.e).forEach(function(q){ var f = fuite(q, C); trop += Math.max(0, f.d - f.lim); });
          });
          if(aire > FEU.cageSeuil) feu += Math.max(0, 2 - C.length);
        });
        return sans * 1e6 + feu * 1e4 + trop;
      }
      /* on ajoute le noyau qui répare le plus ; quand aucun n'aide seul, on en
         déplace un, puis on en remplace un par deux. À égalité, le premier dans
         l'ordre de la seed. Deux noyaux d'un corps restent à deux cages l'un de
         l'autre. */
      places.sort(function(p, q){ return p.r - q.r; });
      var pris = [], m = manque(pris), best, bm;
      function loin(P, q){ return P.every(function(o){ return o.v !== q.v || Math.abs(o.x - q.x) >= 2 * WC; }); }
      function essai(P){ var x = manque(P); if(x < bm - 1e-6){ bm = x; best = P; } }
      for(var t = 0; m > 0 && t < 12; t++){
        best = null; bm = m;
        places.forEach(function(q){ if(loin(pris, q)) essai(pris.concat([q])); });
        [1, 2].forEach(function(n){
          if(best) return;
          pris.forEach(function(o, i){
            var P = pris.slice(0, i).concat(pris.slice(i + 1));
            places.forEach(function(q){
              if(!loin(P, q)) return;
              if(n === 1) essai(P.concat([q]));
              else places.forEach(function(q2){ if(q2 !== q && loin(P.concat([q]), q2)) essai(P.concat([q, q2])); });
            });
          });
        });
        if(!best) break;
        pris = best; m = bm;
      }
      pris.forEach(function(q){
        var h = HOTES[q.v.id] = HOTES[q.v.id] || { xs:[], y:q.y, n:0 };
        h.xs.push(q.x); h.n++;
      });
    });
    return HOTES;
  }
  /* l'écart entre la façade du côté du noyau à ce niveau et la cage, dont le
     centre est à `y` : la cage est au même point à tous les niveaux, la façade
     peut reculer */
  function ecartFacade(N, e, y){
    var dy = e.dy || 0;
    return N === "A" ? (y - NOY.prof / 2) - (dy - e.d / 2) : (dy + e.d / 2) - (y + NOY.prof / 2);
  }

  /* L'ANCRE d'un corps : le bout qui ne bouge pas quand il s'allonge, le même
     à tous ses niveaux — celui du noyau, sinon celui qui touche un voisin. */
  var ANC = {};
  function refLv(v){
    var L = v.lv.filter(function(e){ return lvlDe(e.i) >= 0; });
    L = (L.length ? L : v.lv).slice().sort(function(p, q){ return p.i - q.i; });
    return L[0];
  }
  function dansCorps(u, p){
    return u.lv.some(function(e){
      var q = local(u.x, u.y, u.a, e.dx || 0, e.dy || 0), c = Math.cos(-u.a), s = Math.sin(-u.a);
      var dx = p[0] - q[0], dy = p[1] - q[1];
      return Math.abs(dx * c - dy * s) <= e.w / 2 + 0.6 && Math.abs(dx * s + dy * c) <= e.d / 2 + 0.6;
    });
  }
  /* la façade du côté du noyau (la bande nord), dans le repère du volume */
  function facadeN(v, e, N){
    /* un seul rang : il est du côté du noyau quand on le connaît, le couloir de l'autre */
    N = N || (e.d >= DEUX ? (bandeSud(v.a) === "A" ? "B" : "A") : "B");
    return { N:N, y:(e.dy || 0) + (N === "A" ? -e.d / 2 : e.d / 2) };
  }
  /* le côté du noyau : le nord, sauf si sa façade bouge d'un niveau à l'autre
     (un gradin, un porte-à-faux) et que celle du sud ne bouge pas */
  function coteNoyau(v){
    var e0 = refLv(v), nord = bandeSud(v.a) === "A" ? "B" : "A";
    function fixe(N){ var y = facadeN(v, e0, N).y; return v.lv.every(function(e){ return Math.abs(facadeN(v, e, N).y - y) < 0.01; }); }
    return fixe(nord) || !fixe(nord === "A" ? "B" : "A") ? nord : (nord === "A" ? "B" : "A");
  }
  function ancre(v, vols){
    if(ANC[v.id]) return ANC[v.id];
    var h = hotes(vols)[v.id], e = refLv(v);
    var lo = (e.dx || 0) - e.w / 2, hi = (e.dx || 0) + e.w / 2, gauche = true;
    if(h){
      /* le bout le plus près de ses noyaux */
      var xm = 0; h.xs.forEach(function(x){ xm += x / h.xs.length; });
      gauche = xm - lo <= hi - xm;
    } else {
      var voisin = function(x, d){
        var p = local(v.x, v.y, v.a, x + d * 1.0, e.dy || 0);
        return vols.some(function(u){ return u !== v && u.bat && u.bat === v.bat && dansCorps(u, p); });
      };
      gauche = voisin(lo, -1) || !voisin(hi, 1);
    }
    var cN = coteNoyau(v);
    return (ANC[v.id] = { x:gauche ? lo : hi, s:gauche ? 1 : -1, h:h, N:cN, d:e.d, dy:e.dy || 0 });
  }

  /* ---------- un corps à un niveau : le cadre ---------- */
  function cadre(v, e){
    var p = local(v.x, v.y, v.a, e.dx || 0, e.dy || 0);
    return { v:v, e:e, cx:p[0], cy:p[1], a:v.a, L:e.w, D:e.d, deux:e.d >= DEUX,
             rooms:[], cages:[], libre:[], paliers:[], bb:{}, U:[] };
  }

  /* ---------- un corps à un niveau : la composition ----------
     Tout se calcule dans le repère de l'ANCRE (x de 0, l'ancre, vers le bout
     libre), puis se retourne dans celui de l'étage. Les pièces des bandes vont
     de l'ancre vers le bout libre ; halls traversants et grands locaux au bout. */
  function composer(f, o){
    var c = COULOIR, D = f.D, T = D - c, deux = f.deux;
    var N = o.N || (deux ? (bandeSud(f.a) === "A" ? "B" : "A") : "B"), S = deux ? (N === "A" ? "B" : "A") : N;
    f.sud = S; f.nord = N;
    /* LE VESTIAIRE EN SAS (lien `sas` du schéma) : chaque classe prend UN des
       vestiaires qui la suivent pour antichambre — couloir, vestiaire, classe.
       Elle le porte (`ante`) : un seul élément de bande, que ni la coupe entre
       les rangs, ni un noyau, ni un palier ne séparent. D'abord sa classe mère ;
       un vestiaire dont la mère est sortie du corps (au bac) va à une classe
       restée sans. Un vestiaire de trop reste un satellite, en bloc. */
    function sas(g, x){ g.ante = x; x.enSas = 1; }
    f.U.forEach(function(u){ u.ante = null; u.enSas = 0; });
    f.U.forEach(function(x){ if(x.anti && x.prin && x.prin.key === x.anti && !x.prin.ante && f.U.indexOf(x.prin) >= 0) sas(x.prin, x); });
    f.U.forEach(function(x){
      if(!x.anti || x.enSas) return;
      var g = f.U.filter(function(u){ return u.key === x.anti && !u.ante; })[0];
      if(g) sas(g, x);
    });
    var trav = [], full = [], gr = [], pe = [];
    f.U.forEach(function(u){
      /* un hall traverse le corps s'il en a la largeur (4 m au moins) ; plus
         petit, c'est une pièce de la bande, avec sa porte sur la façade */
      if(/^Hall|foyer/i.test(u.n) && u.a / D >= 4) trav.push(u);
      else if(u.a / (deux ? T / 2 : T) > FRONT_MAX && !u.salle && o.noyaux.length < 2) full.push(u);
      else if(u.a >= PETIT) gr.push(u);
      else pe.push(u);
    });
    /* L'ORDRE DE LA BANDE, tenu par les liens : chaque pièce est suivie de ce
       qui lui est lié (sa grappe) — les petites pièces en bloc toutes les deux
       pièces au plus, pour rester auprès de chacune ; ce qui va à la salle de
       sport se pose au bout qui la regarde ; le reste famille par famille. */
    function blocsDe(L){
      var out = [];
      L.forEach(function(u){
        var b = out[out.length - 1];
        if(b && b.f === u.f && b.cel.length < 8 && b.a + u.a <= 48){ b.cel.push(u); b.a += u.a; }
        else out.push({ kind:"bloc", f:u.f, a:u.a, cel:[u], lab:u.lab });
      });
      return out;
    }
    function piece(u){ return Object.assign({ kind:"band", src:u }, u); }
    var chef = gr.concat(pe).filter(function(u){ return !u.prin && !u.salle; })
      .sort(function(p, q){ return (famO(p) - famO(q)) || (alea(p.key) - alea(q.key)) || (q.a - p.a); });
    var items = [], attente = [], n2 = 0;
    function vider(){ blocsDe(attente.sort(function(p, q){ return famO(p) - famO(q); })).forEach(function(b){ items.push(b); }); attente = []; n2 = 0; }
    var seuls = [];
    function suite(u){
      f.U.forEach(function(x){
        if(x.prin !== u || x.salle || x.enSas) return;
        if(x.a >= PETIT) items.push(piece(x)); else attente.push(x);
        suite(x);
      });
    }
    chef.forEach(function(u){
      if(u.a < PETIT){ seuls.push(u); return; }
      items.push(piece(u));
      suite(u);
      if(++n2 >= 1 && attente.length) vider();
    });
    vider();
    blocsDe(seuls.sort(function(p, q){ return (famO(p) - famO(q)) || (q.a - p.a); })).forEach(function(b){ items.push(b); });
    /* les satellites dont la pièce mère est ailleurs (trav, grand local) */
    /* ce qui suit un hall ou un grand local — au bout libre, avec eux — dans
       l'ordre de ses liens : chaque pièce et, aussitôt, ce qui lui est lié */
    var principal = items; items = [];
    trav.concat(full).forEach(function(T){ suite(T); vider(); });
    var orphI = items; items = principal;
    var dedans = function(x){ return items.concat(orphI).some(function(it){ return it.src === x || it.ante === x || (it.cel && it.cel.indexOf(x) >= 0); }); };
    var reste2 = f.U.filter(function(x){ return x.prin && !x.salle && !dedans(x) && trav.indexOf(x) < 0 && full.indexOf(x) < 0; });
    reste2.filter(function(x){ return x.a >= PETIT; }).forEach(function(x){ orphI.push(piece(x)); });
    blocsDe(reste2.filter(function(x){ return x.a < PETIT; })).forEach(function(b){ orphI.push(b); });
    var sal = f.U.filter(function(u){ return u.salle && trav.indexOf(u) < 0 && full.indexOf(u) < 0; });
    var salI = sal.filter(function(u){ return u.a >= PETIT; }).map(piece).concat(blocsDe(sal.filter(function(u){ return u.a < PETIT; })));
    /* la bande fait une BOUCLE : le rang sud de l'ancre au bout, le rang nord
       du bout à l'ancre. Le milieu de la suite tombe donc au bout libre — là
       où sont les halls et les grands locaux : ce qui leur est lié s'y pose,
       comme ce qui va à la salle de sport quand elle est de ce côté. */
    var moitie = 0, cum = 0, at = items.length;
    items.forEach(function(it){ moitie += it.a / 2; });
    for(var q2 = 0; q2 < items.length; q2++){ cum += items[q2].a; if(cum >= moitie){ at = q2 + 1; break; } }
    var bout = orphI.concat(o.salleDebut ? [] : salI);
    var deb0 = o.salleDebut ? salI.length : 0;
    items = (o.salleDebut ? salI : []).concat(items.slice(0, at), bout, items.slice(at));
    /* la coupe entre les deux rangs tombe sur ce groupe : il est au bout libre */
    /* … partagé entre les deux rangs, pour que tout reste près du bout */
    var mi = deb0 + at + Math.floor(bout.length / 2);
    var kMin = bout.length ? Math.max(0, mi - 1) : 0, kMax = bout.length ? Math.min(items.length, mi + 1) : items.length;
    var fix = 0; trav.concat(full).forEach(function(u){ fix += u.a / D; });
    /* les noyaux : leur place dans le rang du noyau, depuis l'ancre, et l'écart
       de la cage à la façade de ce niveau */
    var K = o.noyaux || [], nc = K.length, cH = NOY.prof, off = o.off || 0, Lw = o.L0 || 0;
    /* un bout de couloir se ferme d'une pièce s'il ne passe pas chez le voisin
       et qu'aucun noyau ne s'y tient */
    var extG = !o.passG && !K.some(function(x){ return x < 0.5; }),
        extD = !o.passD && !full.length && !trav.length && !K.some(function(x){ return x + WC > Lw - 0.5; });
    /* la largeur d'un élément de bande à la profondeur H */
    function larg(it, H){ return it.kind === "bloc" ? peigne(it.cel, H).W : it.a / profDe(it, H) + anteW(it, H); }
    /* le front du vestiaire en sas d'une classe, contre la façade comme elle */
    function anteW(it, H){ return it.ante ? it.ante.a / profDe(it.ante, H) : 0; }
    /* au bout, une pièce ferme le couloir si elle en prend toute la profondeur
       sans perdre ses proportions ; sinon le couloir finit sur la façade */
    function ferme(it, k, L, b, eg, ed){
      return ((k === 0 && eg) || (k === L.length - 1 && ed)) && it.kind !== "bloc" && !it.ante && profDe(it, b + c) >= b + c - 0.01;
    }
    /* longueur d'une bande de profondeur b, ses bouts éventuellement à travers le couloir */
    function long(L, b, eg, ed){
      var s = 0;
      L.forEach(function(it, k){ s += larg(it, b + (ferme(it, k, L, b, eg, ed) ? c : 0)); });
      return s;
    }
    /* … et celle du rang qui porte les noyaux `Q` : ce qui ne tient pas avant
       un noyau passe après lui */
    function longK(L, b, eg, ed, Q){ return Q.length ? bande(L, null, b, 0, eg, ed, 0, L.length, Q, true) : long(L, b, eg, ed); }
    function regle(L){
      for(var k = 0; k < L.length; k++){ var w = o.regles[L[k].lab]; if(w) return { it:L[k], k:k, w:w }; }
      return null;
    }
    function minProf(L){ var m = 0; L.forEach(function(it){ if(it.kind !== "bloc") m = Math.max(m, it.a / larges(it)[1]); }); return m; }
    var best = null;
    if(deux){
      var bmax = T - Math.max(BMIN, nc ? cH + off + PALIER : 0);
      for(var k = kMin; k <= kMax; k++){
        var IS = items.slice(0, k), IN = items.slice(k), INr = IN.slice().reverse();
        var eg = extG && IS.length > 0, ed = extD && IS.length > 0;
        var LS = function(b){ return long(IS, b, eg, ed); }, LN = function(b){ return longK(INr, T - b, false, false, K); };
        var b, rs = regle(IS), rn = regle(IN);
        if(rs) b = rs.it.a / rs.w - ((rs.k === 0 && eg) || (rs.k === IS.length - 1 && ed) ? c : 0);
        else if(rn) b = T - rn.it.a / rn.w;
        /* une bande ne descend pas sous la profondeur que ses pièces demandent
           pour rester dans leurs proportions — une classe de 72 m², 6 m */
        var b0 = Math.max(BMIN, minProf(IS)), b1 = Math.min(bmax, T - minProf(IN));
        if(b0 > b1){ b0 = BMIN; b1 = bmax; }
        if(!rs && !rn){
          var lo = b0, hi = b1;
          if(LS(lo) - LN(lo) <= 0) b = lo; else if(LS(hi) - LN(hi) >= 0) b = hi;
          else { for(var t = 0; t < 50; t++){ b = (lo + hi) / 2; if(LS(b) - LN(b) > 0) lo = b; else hi = b; } }
        }
        b = Math.max(b0, Math.min(b1, b));
        var lb = Math.max(LS(b), LN(b)), pen = 0;
        IS.concat(IN).forEach(function(it, j){
          if(it.a < 50) return;
          var p = profDe(it, j < IS.length ? b : T - b), w = it.a / p;
          if(w / p > 1.6 || p / w > 1.6) pen += 30;
        });
        var cost = lb + Math.abs(LS(b) - LN(b)) * 3 + Math.abs(b - T / 2) * 0.4 + pen;
        if(!best || cost < best.cost) best = { cost:cost, k:k, b:b, lb:lb, IS:IS, IN:IN, eg:eg, ed:ed };
      }
    } else {
      var eg1 = extG && items.length > 0, ed1 = extD && items.length > 0;
      best = { k:items.length, b:T, IS:items, IN:[], eg:eg1, ed:ed1 };
      best.lb = longK(items, T, eg1, ed1, K);
    }
    var bS = best.b, bN = T - bS;
    f.bb = {}; f.bb[S] = deux ? bS : T; if(deux) f.bb[N] = bN;
    if(deux){ f.yc0 = -D / 2 + f.bb.A; f.yc1 = f.yc0 + c; }
    else if(S === "A"){ f.yc1 = D / 2; f.yc0 = f.yc1 - c; }
    else { f.yc0 = -D / 2; f.yc1 = f.yc0 + c; }
    /* un corps sans pièce à ce niveau garde sa cote : le contrôle le dit */
    if(!f.U.length) o.L0 = Math.max(o.L0 || 0, f.e.w);
    /* un corps ne se réduit pas à une lame : six mètres au moins, son noyau compris */
    o.L0 = Math.max(o.L0 || 0, 6, nc * WC + 3);
    var lb = Math.max(best.lb, o.L0 ? o.L0 - fix : 0), L = lb + fix;
    f.L = L;
    /* les pièces, dans le repère de l'ancre */
    var R = [];
    /* `gap` : ce qui reste quand les deux bandes ne finissent pas ensemble — un
       palier, posé avant la pièce `at` (au bout du rang s'il porte des noyaux,
       au milieu sinon). `Q` : les noyaux du rang, chacun à sa place — une pièce
       qui ne tient pas avant lui laisse passer la suivante qui y tient, sinon
       elle passe après, et le sol laissé devant lui est un dégagement. `sec` :
       la longueur seule, rien n'est posé. */
    var paliers = [], cages = [];
    function bande(list, frame, b, x, eg, ed, gap, at, Q, sec){
      var q = 0, M = [];
      /* un élément à sa place k dans la liste : s'il ferme le couloir, sa
         profondeur, sa largeur */
      function mesure(k){
        if(M[k]) return M[k];
        var it = list[k], e = ferme(it, k, list, b, eg, ed), H = b + (e ? c : 0), m = { e:e, H:H };
        if(it.kind === "bloc"){ m.P = peigne(it.cel, H); m.W = m.P.W; } else { m.p = profDe(it, H); m.W = it.a / m.p + anteW(it, H); }
        return (M[k] = m);
      }
      function noyau(W){
        while(q < Q.length && x + W > Q[q] + 0.01){
          if(!sec){
            if(Q[q] - x > 0.05) paliers.push({ frame:frame, x0:x, W:Q[q] - x, H:b });
            cages.push({ bande:frame, x0:Q[q], v0:b - cH - off, W:WC, H:cH });
          }
          x = Math.max(x, Q[q]) + WC; q++;
        }
      }
      /* le sol qui reste dans le rang : un dégagement ouvert sur le couloir */
      function libre(){ if(gap > 0.05 && !sec) paliers.push({ frame:frame, x0:x, W:gap, H:b }); x += gap; }
      var reste = list.map(function(_, k){ return k; });
      for(var n = 0; reste.length; n++){
        if(n === at) libre();
        var k = reste[0], m = mesure(k);
        if(q < Q.length && x + m.W > Q[q] + 0.01 && !m.e){
          for(var j = 1; j < reste.length; j++){
            var mj = mesure(reste[j]);
            if(!mj.e && x + mj.W <= Q[q] + 0.01){ k = reste[j]; m = mj; break; }
          }
        }
        reste.splice(reste.indexOf(k), 1);
        noyau(m.W);
        if(sec){ x += m.W; continue; }
        var it = list[k], e = m.e, H = m.H, P = m.P, p = m.p, r;
        if(P){
          r = Object.assign({}, it, { frame:frame, x0:x, W:P.W, H:H, v0:0, ext:0, cel:P.cel });
          P.devant.forEach(function(d){ paliers.push({ frame:frame, x0:x + d.u0, W:d.W, H:d.H }); });
        } else {
          /* la pièce contre la façade, ce qui reste devant elle ouvert sur le couloir */
          var W = it.a / p;
          r = Object.assign({}, it, { frame:frame, x0:x, W:W, H:p, v0:(e ? -c : 0) + H - p, ext:e ? (k === 0 ? -1 : 1) : 0 });
          if(H - p > 0.05) paliers.push({ frame:frame, x0:x, W:W, H:H - p });
          /* la classe, puis son vestiaire : il a sa porte sur le couloir (ou
             le dégagement devant lui), elle la sienne dans leur mur commun */
          if(it.ante){
            var pa = profDe(it.ante, H), va = Object.assign({}, it.ante, { kind:"band", src:it.ante, antichambre:1,
              frame:frame, x0:x + W, W:it.ante.a / pa, H:pa, v0:H - pa, ext:0 });
            if(H - pa > 0.05) paliers.push({ frame:frame, x0:va.x0, W:va.W, H:H - pa });
            r.vest = va; R.push(r); x += W; r = va;
          }
        }
        R.push(r); x += r.W;
      }
      noyau(Infinity);
      if(at >= list.length) libre();
      return x;
    }
    function milieu(list){ return Math.max(list.length ? 1 : 0, Math.floor(list.length / 2)); }
    /* les noyaux sont dans le rang nord ; un seul rang les porte tous */
    var KS = deux ? [] : K;
    var rS = lb - longK(best.IS, deux ? bS : T, best.eg, best.ed, KS);
    bande(best.IS, S, deux ? bS : T, 0, best.eg, best.ed, rS, KS.length ? best.IS.length : !best.eg ? 0 : milieu(best.IS), KS);
    if(deux){
      var INr = best.IN.slice().reverse(), rN = lb - longK(INr, bN, false, false, K);
      bande(INr, N, bN, 0, false, false, rN, nc ? INr.length : milieu(best.IN), K);
    }
    var x = lb;
    trav.forEach(function(u){ var W = u.a / D; R.push(Object.assign({}, u, { kind:"trav", frame:"full", x0:x, W:W, H:D })); x += W; });
    full.forEach(function(u){ var W = u.a / D; R.push(Object.assign({}, u, { kind:"full", frame:"full", x0:x, W:W, H:D })); x += W; });
    /* le couloir : d'un bout à l'autre, moins les pièces qui le ferment */
    var zg = 0, zd = L;
    R.forEach(function(r){ if(r.ext < 0) zg = r.x0 + r.W; if(r.ext > 0) zd = r.x0; });
    /* retourner dans le repère de l'étage */
    var s = o.s;
    function plie(x0, W){ return s > 0 ? x0 - L / 2 : L / 2 - x0 - W; }
    R.forEach(function(r){ r.x0 = plie(r.x0, r.W); if(s < 0 && r.ext) r.ext = -r.ext; });
    cages.forEach(function(k){ k.x0 = plie(k.x0, k.W); });
    /* le sol que les rangs laissent libre : le contrôle le mesure */
    f.vide = 0;
    paliers.forEach(function(k){ k.x0 = plie(k.x0, k.W); f.vide += k.W * k.H; });
    f.rooms = R; f.cages = cages; f.paliers = paliers;
    f.zl = s > 0 ? zg - L / 2 : L / 2 - zd; f.zr = s > 0 ? zd - L / 2 : L / 2 - zg;
    return f;
  }

  /* ---------- un niveau ---------- */
  function genNiveau(D0, parti, i){
    FL = D0.floors;
    /* l'ordre des familles, tiré de la seed : il décide quelle famille va à
       quel corps, et dans quel ordre elles se suivent le long du couloir */
    GR = D0.graine || 1;
    FAMS_O = FAMS0.slice().sort(function(p, q){ return alea("fam " + p) - alea("fam " + q); });
    var fl = D0.floors[i], vols = D0.partis[parti].vols;
    var F = [], fixes = [], non = [];
    vols.forEach(function(v){
      v.lv.forEach(function(e){
        if(e.i !== i) return;
        var f = cadre(v, e);
        if(e.keys){ f.fixe = true; fixes.push(f); } else F.push(f);
      });
    });
    fixes.forEach(function(f){
      var rs = fl.rooms.filter(function(r){ return f.e.keys.indexOf(r.key) >= 0; }), a = 0;
      rs.forEach(function(r){ a += r.q * r.u; });
      var r0 = rs[0] || { n:f.v.nom || "Volume", f:"tec", key:"" };
      f.rooms.push({ key:r0.key, n:r0.n, f:r0.f, lab:r0.n, a:a, kind:"fixe", x0:-f.L / 2, W:f.L, H:f.D, frame:"full" });
      f.yc0 = f.yc1 = 0;
    });
    var U = unites(fl.rooms.filter(function(r){
      return !fixes.some(function(f){ return f.e.keys.indexOf(r.key) >= 0; });
    }));
    if(!F.length){ U.forEach(function(u){ non.push(u); }); return { F:fixes, non:non, fl:fl }; }

    /* LA RÉPARTITION entre les corps du niveau : le sport près de la salle,
       l'UAPE loin d'elle, le reste famille par famille, au prorata de ce que
       le Massing a prévu pour chaque corps (son emprise à ce niveau). */
    var hall = null;
    vols.forEach(function(v){ if(v.lv.some(function(e){ return e.keys && e.keys.join().indexOf("sport|") >= 0; })) hall = v; });
    /* au centre du VOLUME, pas de l'étage : l'ordre ne bouge pas quand un corps s'allonge */
    function d(f){ return hall ? Math.hypot(f.v.x - hall.x, f.v.y - hall.y) : 0; }
    /* les corps du plus près au plus loin de la salle de sport ; les pièces :
       celles du sport d'abord, celles de l'UAPE en dernier, le reste famille
       par famille entre les deux */
    F.sort(function(p, q){ return (d(p) - d(q)) || String(p.v.id).localeCompare(String(q.v.id)); });
    var cap = F.map(function(f){ return f.e.w * f.e.d; }), capT = 0, tot = 0;
    cap.forEach(function(x){ capT += x; });
    U.forEach(function(u){ tot += u.a; });
    /* un très grand local (l'abri PC, 3 × 200 places) se compartimente en
       parts de 300 m² au plus : d'un seul bloc, il allait tout entier à un
       corps, et quand il n'y tenait pas il en sortait tout entier — laissant
       vide la place que le Massing lui avait faite */
    U = U.reduce(function(m, u){
      var K = Math.ceil(u.a / 300);
      if(K > 1 && !/^Hall|foyer/i.test(u.n)){
        for(var j = 0; j < K; j++) m.push(Object.assign({}, u, { a:u.a / K, part:1, lab:u.lab + " (" + (j + 1) + "/" + K + ")" }));
      } else m.push(u);
      return m;
    }, []);
    function rang(u){ return !hall ? 1 : u.chap === "sport" ? 0 : u.chap === "uape" ? 2 : 1; }
    /* LES LIENS : une petite pièce en lien avec une grande la suit dans son
       corps — les vestiaires et les WC avec les classes, le local de
       reproduction avec la salle des maîtres. Elles se partagent à tour de
       rôle entre les grandes pièces de leur poste lié. */
    var lie = {}, sasDe = {};
    (D0.liens || []).forEach(function(l){ if(l.sas) sasDe[l.b] = l.a; });
    /* `anti` : la clé de la pièce dont ce poste est l'antichambre */
    U.forEach(function(u){ if(sasDe[u.key]) u.anti = sasDe[u.key]; });
    (D0.liens || []).forEach(function(l){ (lie[l.a] = lie[l.a] || []).push(l.b); (lie[l.b] = lie[l.b] || []).push(l.a); });
    var grands = U.filter(function(u){ return u.a >= PETIT; });
    function plusGrand(u, g){ return g !== u && g.a > u.a && lie[u.key].indexOf(g.key) >= 0; }
    /* « auprès de chaque » : une petite pièce en plusieurs exemplaires (WC,
       vestiaires) se répartit le long de ses mères ; une pièce unique liée
       entre dans le groupe de ses partenaires */
    var nb = {}; U.forEach(function(u){ nb[u.key] = (nb[u.key] || 0) + 1; });
    var petitsLies = U.filter(function(u){
      return u.a < PETIT && nb[u.key] > 1 && lie[u.key] && U.filter(function(g){ return plusGrand(u, g); }).length > 1;
    });
    petitsLies.forEach(function(u){ u.sat1 = 1; u.tard = 1; });
    /* les grandes pièces liées entre elles voyagent ensemble : composantes du
       graphe des liens, la plus grande pièce en tête (au plus 600 m²) */
    var vu = {}, lies2 = U.filter(function(u){ return !u.tard && lie[u.key]; });
    lies2.slice().sort(function(p, q){ return q.a - p.a; }).forEach(function(g){
      if(vu[g.lab + g.key] || !lie[g.key]) return;
      var groupe = [g], aire = g.a; vu[g.lab + g.key] = 1;
      for(var t = 0; t < groupe.length; t++){
        lies2.forEach(function(h){
          if(vu[h.lab + h.key] || !lie[groupe[t].key] || lie[groupe[t].key].indexOf(h.key) < 0 || aire + h.a > 600) return;
          vu[h.lab + h.key] = 1; groupe.push(h); aire += h.a;
        });
      }
      groupe.slice(1).forEach(function(h){ (g.sat = g.sat || []).push(h); h.sat1 = 1; });
    });
    var reste = U.filter(function(u){ return !u.sat1; }).map(function(u){
      var a = u.a; (u.sat || []).forEach(function(x){ a += x.a; });
      return { u:u, a:a, chap:u.chap, f:u.f };
    }).sort(function(p, q){ return (rang(p) - rang(q)) || (famO(p) - famO(q)) || (q.a - p.a); });
    /* un découpage CONTIGU de la liste (les familles restent ensemble) en
       autant de tranches que de corps, au plus près de la part de chacun —
       programmation dynamique sur les points de coupe */
    var pre = F.map(function(){ return 0; });
    var cum = [0]; reste.forEach(function(u, j){ cum.push(cum[j] + u.a); });
    var n = reste.length, K = F.length, INF = 1e18, cout = [], dd = [];
    for(var q = 0; q <= K; q++){ cout.push(new Array(n + 1).fill(INF)); dd.push(new Array(n + 1).fill(0)); }
    cout[0][0] = 0;
    for(q = 1; q <= K; q++){
      var cible = cap[q - 1] / capT * tot - pre[q - 1];
      for(var j = 0; j <= n; j++){
        for(var t = 0; t <= j; t++){
          if(cout[q - 1][t] >= INF) continue;
          var ec = (cum[j] - cum[t]) - cible, c2 = cout[q - 1][t] + ec * ec;
          if(c2 < cout[q][j]){ cout[q][j] = c2; dd[q][j] = t; }
        }
      }
    }
    var fin2 = n;
    for(q = K; q >= 1; q--){
      var t0 = dd[q][fin2];
      for(var j2 = t0; j2 < fin2; j2++){
        var pu = reste[j2].u;
        F[q - 1].U.push(pu);
        (pu.sat || []).forEach(function(x){ x.prin = pu; F[q - 1].U.push(x); });
      }
      fin2 = t0;
    }

    /* LES PETITES PIÈCES LIÉES, poste par poste : réparties entre les corps au
       prorata de leurs pièces mères, une au moins par corps qui en a, puis
       espacées régulièrement le long d'elles — quatre WC pour douze classes,
       un toutes les trois classes, dans chaque corps */
    var parCle = {};
    petitsLies.forEach(function(u){ (parCle[u.key] = parCle[u.key] || []).push(u); });
    /* les plus grandes d'abord : une petite qui sert de mère à une plus petite
       est déjà dans son corps quand celle-ci cherche le sien */
    Object.keys(parCle).sort(function(p, q){ return parCle[q][0].a - parCle[p][0].a; }).forEach(function(k){
      var L = parCle[k], meres = F.map(function(f){ return f.U.filter(function(g){ return plusGrand(L[0], g); }); });
      var tot2 = 0; meres.forEach(function(m){ tot2 += m.length; });
      if(!tot2){ F[0].U = F[0].U.concat(L); return; }
      var part = meres.map(function(m){ return m.length ? 1 : 0; }), libre = L.length;
      part.forEach(function(x){ libre -= x; });
      if(libre < 0){ part = meres.map(function(){ return 0; }); libre = L.length;
        meres.map(function(m, j){ return j; }).sort(function(p, q){ return meres[q].length - meres[p].length; }).slice(0, L.length).forEach(function(j){ part[j] = 1; libre--; }); }
      /* au plus fort reste : chaque corps à proportion de ses pièces mères */
      var frac = [];
      meres.forEach(function(m, j){ var x = libre * m.length / tot2; part[j] += Math.floor(x); frac.push({ j:j, r:x - Math.floor(x) }); });
      var dist = 0; part.forEach(function(x){ dist += x; });
      frac.sort(function(p, q){ return q.r - p.r; });
      for(var j3 = 0; dist < L.length; j3 = (j3 + 1) % frac.length){ if(meres[frac[j3].j].length){ part[frac[j3].j]++; dist++; } }
      var c0 = 0;
      F.forEach(function(f, j){
        var m = meres[j], mine = L.slice(c0, c0 + part[j]); c0 += part[j];
        mine.forEach(function(u, n){
          if(m.length){ var g = m[Math.min(m.length - 1, Math.floor((n + 0.5) * m.length / mine.length))]; u.prin = g; }
          f.U.push(u);
        });
      });
    });
    /* ce qui est lié à une salle aux cotes imposées (la salle de sport) va au
       bout du corps le plus proche d'elle */
    /* ce qui est lié à une salle aux cotes imposées (la salle de sport) va au
       bout du corps le plus proche d'elle */
    var cles = {};
    fixes.forEach(function(g){ (g.e.keys || []).forEach(function(k){ cles[k] = g; }); });
    U.forEach(function(u){ (lie[u.key] || []).forEach(function(k){ if(cles[k]) u.salle = cles[k]; }); });
    /* chaque corps : son ancre, ses noyaux, ses passages, sa composition */
    F.forEach(function(f){
      var an = ancre(f.v, vols), v = f.v, e = f.e;
      /* le corps garde ses cotes : la profondeur du niveau, et sa longueur,
         mesurée depuis le bout de l'ancre À CE NIVEAU — un retrait ou un
         porte-à-faux reste celui du Massing. Ses noyaux s'empilent : ils
         sont au même point à tous ses niveaux (`hotes`). */
      f.dyNew = e.dy || 0;
      var deb = (e.dx || 0) - an.s * e.w / 2, fin = deb + an.s * e.w;
      /* ses noyaux, au même point à tous ses niveaux : leur place depuis le
         bout de l'ancre de CE niveau, et leur écart à sa façade */
      var K = an.h ? an.h.xs.map(function(x){ return an.s * (x - deb) - WC / 2; }).sort(function(p, q){ return p - q; }) : [];
      var off = an.h ? ecartFacade(an.N, e, an.h.y) : 0;
      function passe(x, dir){
        var p = local(v.x, v.y, v.a, x + dir * 1.0, (e.dy || 0));
        return F.some(function(g){ return g !== f && g.v.bat && g.v.bat === v.bat && dansCorps({ x:g.v.x, y:g.v.y, a:g.v.a, lv:[g.e] }, p); });
      }
      /* les cotes des pièces, réglées au mixer ou ici : une par poste */
      var reg = {}, cote = {};
      (D0.floors[i] ? D0.floors[i].rooms : []).forEach(function(r){ if(r.w) cote[r.key] = r.w; });
      f.U.forEach(function(u){ if(cote[u.key]) reg[u.lab] = cote[u.key]; });
      var sal = f.U.filter(function(u){ return u.salle; })[0], debut = false;
      if(sal){
        var pr = (sal.salle.cx - f.cx) * Math.cos(f.a) + (sal.salle.cy - f.cy) * Math.sin(f.a);
        debut = pr * an.s < 0;
      }
      function comp(){
        composer(f, { s:an.s, N:an.N, noyaux:K, off:off, salleDebut:debut, passG:passe(deb, -an.s), passD:passe(fin, an.s), L0:e.w, regles:reg });
      }
      comp();
      /* CE QUI NE TIENT PAS dans le volume reste au bac du niveau : la pièce
         qui couvre le débord au plus juste, sinon la plus grande, jusqu'à ce
         que le plan tienne. C'est au Massing ou au mixer d'y répondre. */
      while(f.L > e.w + 0.05 && f.U.length){
        /* un hall reste : c'est par lui qu'on entre */
        var ex = (f.L - e.w) * f.D, par = f.U.filter(function(u){ return !/^Hall|foyer/i.test(u.n) && !u.enSas; });
        par = (par.length ? par : f.U).slice().sort(function(p, q){ return p.a - q.a; });
        var pris = par.filter(function(u){ return u.a >= ex; })[0] || par[par.length - 1];
        f.U.splice(f.U.indexOf(pris), 1);
        non.push(pris);
        comp();
      }
      f.comp = comp;
    });
    /* CE QUI EST SORTI D'UN CORPS va là où il reste de la place, le sien
       compris : sortir une pièce pour un débord de quelques mètres laisse un
       vide, que les plus petites d'entre elles comblent */
    function tient(f, u){ f.U.push(u); f.comp(); if(f.L <= f.e.w + 0.05) return true; f.U.pop(); f.comp(); return false; }
    non.slice().sort(function(p, q){ return q.a - p.a; }).forEach(function(u){
      F.some(function(f){
        if(tient(f, u)){ non.splice(non.indexOf(u), 1); return true; }
        /* un compartiment de l'abri se recoupe : la part qui tient se pose,
           le reste attend au bac — la surface totale ne change pas */
        if(!u.part) return false;
        var lo = 0, hi = u.a;
        for(var t = 0; t < 12; t++){ var x = (lo + hi) / 2; if(tient(f, Object.assign({}, u, { a:x }))){ lo = x; f.U.pop(); } else hi = x; }
        if(lo < PETIT) return false;
        tient(f, Object.assign({}, u, { a:lo })); u.a -= lo;
        return false;
      });
    });
    F.forEach(function(f){
      var an = ancre(f.v, vols), dx = (f.e.dx || 0) - an.s * f.e.w / 2 + an.s * f.L / 2;
      f.dxNew = dx;
      var p = local(f.v.x, f.v.y, f.v.a, dx, f.dyNew); f.cx = p[0]; f.cy = p[1];
    });
    return { F:F.concat(fixes), non:non, fl:fl };
  }

  function oublier(){ HOTES = null; ANC = {}; }

  /* repère d'un local → repère de l'étage : u le long de la bande, v depuis le couloir */
  function versEtage(f, frame, x0, u, v){
    if(frame === "A") return [x0 + u, f.yc0 - v];
    if(frame === "B") return [x0 + u, f.yc1 + v];
    return [x0 + u, -f.D / 2 + v];
  }
  function versMonde(f, x, y){ return local(f.cx, f.cy, f.a, x, y); }
  /* Le couloir d'un corps passe-t-il, par son bout `sg` (−1 ou +1), dans le
     couloir d'un corps voisin du même niveau (`F`) ? Le dessin y ouvre les
     deux pignons ; la mesure ne compte pas ce bout comme un bout de couloir. */
  function passage(F, f, sg){
    if(f.fixe || (sg < 0 ? f.zl > -f.L / 2 + 0.01 : f.zr < f.L / 2 - 0.01)) return false;
    var wpt = versMonde(f, sg * (f.L / 2 + 1.0), (f.yc0 + f.yc1) / 2);
    return F.some(function(g){
      if(g === f || g.fixe) return false;
      var c = Math.cos(-g.a), s2 = Math.sin(-g.a), dx = wpt[0] - g.cx, dy = wpt[1] - g.cy;
      var lx = dx * c - dy * s2, ly = dx * s2 + dy * c;
      return Math.abs(lx) <= g.L / 2 + 0.05 && ly > g.yc0 + 0.3 && ly < g.yc1 - 0.3;
    });
  }

  return { ancre:ancre, genNiveau:genNiveau, oublier:oublier, hotes:hotes, fuite:fuite,
           local:local, versEtage:versEtage, versMonde:versMonde, passage:passage,
           COULOIR:COULOIR, MUR:MUR, CLOISON:CLOISON, NOY:NOY, FEU:FEU, LIEN:LIEN, MODULE:MODULE,
           PETIT:PETIT, VIDE:VIDE, PLAN:PLAN, ratioDe:ratioDe, cabine:cabine };
}


/* Tous les niveaux : ce que mesurent le contrôle et le jugement. */
export function planifier(D){
  var PG = creerPG(D);
  return { PG:PG, tous:D.floors.map(function(_, i){ return PG.genNiveau(D, "courant", i); }) };
}
