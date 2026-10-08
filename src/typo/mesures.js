/* ============================================================================
   CE QU'ON LIT SUR LE PLAN DES TYPOLOGIES

   Le plan que dessine l'onglet (`gen.js`), lu une fois : ce que le contrôle de
   la page dit en phrases, et ce que le JURY note en mesures. Pour un même
   volume, il y a une bonne et une mauvaise typologie — les classes au sud ou
   au nord, les liens tenus ou rompus, le noyau au bon bout : ces mesures le
   disent, et elles entrent dans la note par `mass/mesures.js — evaluer()`,
   comme celles du mixer et du massing.

     lirePlans(D)            le plan et ce qu'on y relève — la page en écrit
                             ses phrases (`plans.html — controle()`)
     evaluerTypo(vols, ponts) les mesures (`donnees.js — MESURES`, `de:"typo"`)
                             et les écarts au cadre des Typologies, d'un seul plan
     typoVerdict(ecarts)     les écarts typo comptés, rouges et ambre

   Un écart ne jette aucun volume — le générateur du massing ne voit pas les
   plans — : il rend la variante invalide (Intangible) ou le notifie (Imposé).
   ========================================================================= */
import { planifier, soleil } from "./gen.js";
import { donneesTypo } from "./donnees.js";
import { V, enVigueur, severite } from "../data/cadre.js";
import { BRUYANT, CLSRE, UNITE } from "../mix/niv.js";
import { dec } from "../core/format.js";
import { RULES } from "../data/rules.js";
import { SITE } from "../data/site.js";
import { courUtile } from "../mass/mesures.js";

function chap(key){ return String(key || "").split("|")[0]; }
function nomPoste(k){ return String(k).split("|")[1] || k; }
function nomVol(v){ return v.nom || String(v.id).toUpperCase(); }
/* l'écart entre deux boîtes du site, de bord à bord, en équerre */
function ecart(x, y){
  return Math.max(0, Math.abs(x.p[0] - y.p[0]) - x.ex - y.ex) + Math.max(0, Math.abs(x.p[1] - y.p[1]) - x.ey - y.ey);
}
function r3(x){ return Math.round(x * 1000) / 1000; }

/* Les corps d'un niveau (`F`, sans les fixes) que leurs couloirs relient : d'un
   corps à l'autre par un passage, bout à bout ou par le raccord d'une jonction
   (`gen.js — passage`), ou flanc contre flanc, deux raccords face à face. Rend
   `racine(j)` : deux corps reliés ont la même. */
function relies(PG, r, F){
  var pere = F.map(function(_, j){ return j; });
  function racine(j){ while(pere[j] !== j) j = pere[j] = pere[pere[j]]; return j; }
  F.forEach(function(f, j){ [-1, 1].forEach(function(sg){
    var g = PG.passage(r.F, f, sg), k = F.indexOf(g);
    if(k >= 0) pere[racine(k)] = racine(j);
  }); });
  (r.J || []).forEach(function(x){
    var j = F.indexOf(x.b), k = F.indexOf(x.r);
    if(x.k !== "flanc" || j < 0 || k < 0) return;
    var ok = [x.b, x.r].every(function(f){ return (f.paliers || []).some(function(p){ return p.raccord; }); });
    if(ok) pere[racine(k)] = racine(j);
  });
  return racine;
}

/* ---------- le plan, et ce qu'on y relève --------------------------------------
   Toute la pile, pas seulement le niveau montré. Les nombres seulement : la
   page écrit ses phrases, `ecartsDe()` les siennes. */
export function lirePlans(D){
  var P = planifier(D), PG = P.PG, tous = P.tous, F0 = PG.FEU, vols = D.partis.courant.vols;
  function monde(f, frame, x0, u, v){ var q = PG.versEtage(f, frame, x0, u, v); return PG.versMonde(f, q[0], q[1]); }
  function grp(v){ return v.bat || v.id; }
  /* le programme qui ne tient pas, niveau par niveau */
  var nm = 0, am = 0, non = [];
  tous.forEach(function(r, i){
    var a = 0; r.non.forEach(function(u){ nm++; am += u.a; a += u.a; });
    if(a) non.push({ i:i, a:a });
  });
  /* les noyaux : présents, empilés, aux mêmes cotes ; l'évacuation */
  var sig = {}, acces = [], empile = [], feu = [], fuite = 0, fuiteMax = F0.fuiteSimple;
  tous.forEach(function(r, i){
    var N = {}, aire = {};
    r.F.forEach(function(f){
      if(f.fixe) return;
      aire[grp(f.v)] = (aire[grp(f.v)] || 0) + f.L * f.D;
      f.cages.forEach(function(c){ (N[grp(f.v)] = N[grp(f.v)] || []).push(monde(f, c.bande, c.x0, c.W / 2, (c.v0 || 0) + c.H / 2)); });
      var s2 = f.cages.map(function(c){ var p = monde(f, c.bande, c.x0, 0, c.v0 || 0); return [p[0], p[1], c.W, c.H]; });
      /* un corps qui porte un noyau le porte à TOUS ses niveaux, au même endroit
         — à 5 cm près : le même point, calculé dans le repère de deux niveaux,
         ne s'arrondit pas toujours au même décimètre */
      if(PG.hotes(vols)[f.v.id]){
        var s0 = (sig[f.v.id] = sig[f.v.id] || { v:f.v, s:s2 });
        if(s0.s.length !== s2.length || s2.some(function(q, j){ return q.some(function(x, k){ return Math.abs(x - s0.s[j][k]) > 0.05; }); })) s0.decale = 1;
      }
    });
    Object.keys(aire).forEach(function(g){
      if(aire[g] > F0.cageSeuil && (N[g] || []).length < 2) feu.push({ g:g, i:i });
    });
    r.F.forEach(function(f){
      if(f.fixe) return;
      var C = N[grp(f.v)] || [], rez = D.floors[i].lvl === 0;
      if(!C.length){ if(!rez) acces.push({ nom:nomVol(f.v), i:i }); return; }
      if(rez) return;     /* au rez, on sort par la façade : halls et portes */
      /* la mesure même qui pose les noyaux (`gen.js — fuite`) */
      f.rooms.forEach(function(rm){
        var q = PG.fuite(monde(f, rm.frame === "full" ? "full" : rm.frame, rm.x0, rm.W / 2, (rm.H || 0) / 2), C);
        if(q.d - q.lim > fuite - fuiteMax){ fuite = q.d; fuiteMax = q.lim; }
      });
    });
  });
  Object.keys(sig).forEach(function(k){ if(sig[k].decale) empile.push(nomVol(sig[k].v)); });
  /* LE SQUELETTE TIENT : hors du rez, chaque corps rejoint un noyau par ses
     couloirs — d'un corps à l'autre par un passage, bout à bout ou par le
     raccord d'une jonction (`gen.js — passage`). Le contrôle des noyaux compte
     par bâtiment : il SUPPOSE que les corps accolés se desservent ; ceci le
     vérifie. Un bâtiment sans noyau du tout, `acces` le dit déjà. */
  var isoles = [];
  tous.forEach(function(r, i){
    if(D.floors[i].lvl === 0) return;
    var F = r.F.filter(function(f){ return !f.fixe; }), racine = relies(PG, r, F);
    var sert = {};
    F.forEach(function(f, j){ if(f.cages.length) sert[racine(j)] = 1; });
    F.forEach(function(f, j){
      if(f.rooms.length && !sert[racine(j)] && F.some(function(g){ return g.cages.length && grp(g.v) === grp(f.v); }))
        isoles.push({ nom:nomVol(f.v), i:i });
    });
  });
  /* le sol libre d'un corps au-delà du seuil (`regles.vide`, null la ligne éteinte) : un plateau vide */
  var vides = [];
  if(PG.VIDE != null) tous.forEach(function(r, i){ r.F.forEach(function(f){
    if(!f.fixe && f.vide > PG.VIDE) vides.push({ nom:nomVol(f.v), i:i, a:f.vide });
  }); });
  /* chaque pièce et sa boîte englobante dans le repère du site */
  var pos = {};
  tous.forEach(function(r, i){
    r.F.forEach(function(f){
      f.rooms.forEach(function(rm){
        function met(key, p, W, H){
          if(!key) return;
          var c = Math.abs(Math.cos(f.a)), s2 = Math.abs(Math.sin(f.a));
          (pos[key] = pos[key] || []).push({ i:i, p:p, ex:(W * c + H * s2) / 2, ey:(W * s2 + H * c) / 2 });
        }
        if(rm.kind === "bloc") rm.cel.forEach(function(c){ met(c.key, monde(f, rm.frame, rm.x0, c.u0 + c.W / 2, (rm.v0 || 0) + c.v0 + c.H / 2), c.W, c.H); });
        else met(rm.key, monde(f, rm.frame, rm.x0, rm.W / 2, (rm.v0 || 0) + (rm.H || 0) / 2), rm.W, rm.H || 0);
      });
    });
  });
  /* les liens du schéma : au même niveau, à moins de la distance d'un lien */
  var rompus = [], n = 0, ok = 0;
  (D.liens || []).forEach(function(l){
    var A = pos[l.a], B = pos[l.b];
    if(!A || !B) return;
    var pire = 0, separes = false;
    A.forEach(function(x){
      var d = Infinity;
      B.forEach(function(y){ if(y.i === x.i) d = Math.min(d, ecart(x, y)); });
      if(d === Infinity) separes = true; else pire = Math.max(pire, d);
    });
    n++;
    if(separes || pire > PG.LIEN) rompus.push({ a:nomPoste(l.a), b:nomPoste(l.b), separes:separes, d:pire });
    else ok++;
  });
  /* la scène, collée à la salle de sport : Infinity si jamais au même niveau,
     null s'il n'y a pas les deux */
  var kSc = Object.keys(pos).filter(function(k){ return /Scène/.test(k); })[0];
  var kSp = Object.keys(pos).filter(function(k){ return /Salle de sport double/.test(k); })[0];
  var scene = null;
  if(kSc && kSp){
    scene = Infinity;
    pos[kSc].forEach(function(x){ pos[kSp].forEach(function(y){ if(y.i === x.i) scene = Math.min(scene, ecart(x, y)); }); });
  }
  /* PUBLIC ET ÉCOLE : les pièces ouvertes au public (`pub`, les chapitres
     publics de `program.js`) forment, dans chaque bande où elles sont, UNE
     suite qui tient un bout de la bande — on y entre par le hall ou le pignon
     sans longer de classe. Une pièce d'école entre deux pièces publiques, ou une
     suite publique enfermée au milieu de la bande, est un mélange. */
  var pubBandes = 0, meles = [];
  tous.forEach(function(r, i){ r.F.forEach(function(f){
    if(f.fixe) return;
    var B = {};
    f.rooms.forEach(function(rm){
      var cs = rm.kind === "bloc" ? rm.cel : [rm], p = cs.filter(function(c){ return c.pub; }).length;
      (B[rm.frame] = B[rm.frame] || []).push({ x:rm.x0, k:!p ? 0 : p === cs.length ? 1 : .5 });
    });
    Object.keys(B).forEach(function(fr){
      var S = B[fr].sort(function(a, b){ return a.x - b.x; }), J = [];
      S.forEach(function(x, j){ if(x.k) J.push(j); });
      if(!J.length) return;
      pubBandes++;
      var e = 0;
      for(var j = J[0]; j <= J[J.length - 1]; j++) if(S[j].k < 1) e++;
      if(e || (J[0] > 0 && J[J.length - 1] < S.length - 1)) meles.push({ nom:nomVol(f.v), i:i, n:e });
    });
  }); });
  /* LE VESTIAIRE EN SAS : les pièces qu'un lien `sas` dit s'entrer par leur
     antichambre (les classes standard), et celles qui s'y entrent vraiment —
     l'antichambre contre elle, un mur commun assez long pour la porte. En
     plan cluster, le vestiaire est dans l'espace de la grappe : la classe le
     tient si un bloc ouvert (`ouvert`) borde sa suite de classes, même bande */
  var meres = {}, sas = { n:0, ok:0, sans:[] };
  (D.liens || []).forEach(function(l){ if(l.sas) meres[l.a] = 1; });
  function ouvert(rm){ return rm && rm.kind === "bloc" && rm.cel.some(function(c){ return c.ouvert; }); }
  function grappeOuverte(f, rm){
    var B = f.rooms.filter(function(x){ return x.frame === rm.frame; }).sort(function(p, q){ return p.x0 - q.x0; }), k = B.indexOf(rm);
    return [-1, 1].some(function(d){
      for(var j = k + d; B[j] && B[j].kind === "band" && meres[B[j].key]; j += d);
      return ouvert(B[j]);
    });
  }
  tous.forEach(function(r, i){ r.F.forEach(function(f){ f.rooms.forEach(function(rm){
    if(rm.kind !== "band" || !meres[rm.key]) return;
    sas.n++;
    if(r.cluster){ if(grappeOuverte(f, rm)) sas.ok++; else sas.sans.push({ lab:rm.lab || rm.n, i:i }); return; }
    var v = rm.vest, colle = v && v.frame === rm.frame && (Math.abs(v.x0 - rm.x0 - rm.W) < 0.05 || Math.abs(rm.x0 - v.x0 - v.W) < 0.05);
    var m = colle ? Math.min(rm.v0 + rm.H, v.v0 + v.H) - Math.max(rm.v0, v.v0) : 0;
    if(m >= PG.PLAN.porte + 0.2) sas.ok++; else sas.sans.push({ lab:rm.lab || rm.n, i:i });
  }); }); });
  return { PG:PG, tous:tous, pos:pos, nm:nm, am:am, sas:sas, non:non, acces:acces, isoles:isoles, empile:empile, feu:feu,
           fuite:fuite, fuiteMax:fuiteMax, rompus:rompus, liens:{ n:n, ok:ok }, scene:scene, vides:vides,
           pub:{ n:pubBandes, meles:meles } };
}

/* ---------- les mesures ----------------------------------------------------------- */

/* la bande A regarde (sin a, −cos a), la B l'opposée ; une pièce traversante
   prend la meilleure de ses deux façades */
function soleilPiece(f, rm){
  var sA = soleil(Math.sin(f.a), -Math.cos(f.a)), sB = soleil(-Math.sin(f.a), Math.cos(f.a));
  return rm.frame === "A" ? sA : rm.frame === "B" ? sB : Math.max(sA, sB);
}
/* les pièces d'un corps — celles d'un bloc une à une — en rectangles du repère
   de l'étage */
function pieces(PG, f){
  var out = [];
  function rect(o, fr, x0, u, v, W, H){
    var p = PG.versEtage(f, fr, x0, u, v), q = PG.versEtage(f, fr, x0, u + W, v + H);
    out.push(Object.assign(o, { x0:Math.min(p[0], q[0]), x1:Math.max(p[0], q[0]), y0:Math.min(p[1], q[1]), y1:Math.max(p[1], q[1]) }));
  }
  f.rooms.forEach(function(rm){
    if(rm.kind === "bloc") rm.cel.forEach(function(c){ rect({ n:c.n, key:c.key, fam:c.f, rm:rm }, rm.frame, rm.x0, c.u0, (rm.v0 || 0) + c.v0, c.W, c.H); });
    else rect({ n:rm.n, key:rm.key, fam:rm.f, rm:rm }, rm.frame, rm.x0, 0, rm.v0 || 0, rm.W, rm.H || 0);
  });
  return out;
}
/* la longueur de mur que deux rectangles partagent (5 cm près) */
function mur(a, b){
  var e = 0.05;
  if(Math.abs(a.x1 - b.x0) < e || Math.abs(b.x1 - a.x0) < e) return Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  if(Math.abs(a.y1 - b.y0) < e || Math.abs(b.y1 - a.y0) < e) return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  return 0;
}
function bruyant(p){ return BRUYANT.test(p.n) || chap(p.key) === "uape" || chap(p.key) === "tech"; }
/* une suite de 3 ou 4 classes compte 1 ; de 2, ou de 5 à 6, ½ */
function grappe(r){ return r >= 3 && r <= 4 ? 1 : r === 2 || (r >= 5 && r <= 6) ? 0.5 : 0; }

/* ---------- ce que le jury lit encore sur le plan --------------------------------
   Les seuils sont des hypothèses de projet (`RULES.plan.juge`) ; les bornes du
   score, des cases du jury (`jugement.js`). */
var J = RULES.plan.juge;
/* une pièce de séjour : classe, bureau, salle — pas un hall, un local, un WC */
function sejour(p){ return (/^(cla|adm|uap)$/.test(p.fam) || /Réfectoire/.test(p.n)) && !/^Hall|^Local/.test(p.n) && !p.rm.antichambre; }
function dansF(g, w){
  var c = Math.cos(-g.a), s = Math.sin(-g.a), dx = w[0] - g.cx, dy = w[1] - g.cy;
  return Math.abs(dx * c - dy * s) <= g.L / 2 + 0.05 && Math.abs(dx * s + dy * c) <= g.D / 2 + 0.05;
}
function tourne(f, n){ var c = Math.cos(f.a), s = Math.sin(f.a); return [n[0] * c - n[1] * s, n[0] * s + n[1] * c]; }
/* la distance d'un point à une polyligne */
function aLigne(w, P){
  var d = Infinity;
  for(var k = 0; k + 1 < P.length; k++){
    var a = P[k], b = P[k + 1], ux = b[0] - a[0], uy = b[1] - a[1], l2 = ux * ux + uy * uy;
    var t = l2 ? Math.max(0, Math.min(1, ((w[0] - a[0]) * ux + (w[1] - a[1]) * uy) / l2)) : 0;
    d = Math.min(d, Math.hypot(w[0] - a[0] - t * ux, w[1] - a[1] - t * uy));
  }
  return d;
}
/* Chaque pièce de toute la pile, avec son niveau, son corps, son centre et ses
   FAÇADES : les côtés sur le bord du corps qu'aucun corps voisin du niveau ne
   couvre — `{ n, l }`, la normale dans le repère du site et la longueur libre. */
function salles(L){
  var PG = L.PG, out = [];
  L.tous.forEach(function(r, i){ r.F.forEach(function(f){
    pieces(PG, f).forEach(function(p){
      p.i = i; p.f = f; p.a = (p.x1 - p.x0) * (p.y1 - p.y0);
      p.p = p.c = PG.versMonde(f, (p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2);
      var co = Math.abs(Math.cos(f.a)), si = Math.abs(Math.sin(f.a)), w0 = p.x1 - p.x0, h0 = p.y1 - p.y0;
      p.ex = (w0 * co + h0 * si) / 2; p.ey = (w0 * si + h0 * co) / 2;
      p.fac = [];
      [[p.x0 <= -f.L / 2 + 0.05, [-1, 0]], [p.x1 >= f.L / 2 - 0.05, [1, 0]],
       [p.y0 <= -f.D / 2 + 0.05, [0, -1]], [p.y1 >= f.D / 2 - 0.05, [0, 1]]].forEach(function(c){
        if(!c[0]) return;
        var n = c[1], lg = n[0] ? p.y1 - p.y0 : p.x1 - p.x0, k = Math.max(1, Math.round(lg)), l = 0;
        for(var j = 0; j < k; j++){
          var t = (j + 0.5) / k, e = PG.MUR + 0.5;
          var x = n[0] ? (n[0] > 0 ? p.x1 : p.x0) + n[0] * e : p.x0 + t * (p.x1 - p.x0);
          var y = n[1] ? (n[1] > 0 ? p.y1 : p.y0) + n[1] * e : p.y0 + t * (p.y1 - p.y0);
          var w = PG.versMonde(f, x, y);
          if(!r.F.some(function(g){ return g !== f && dansF(g, w); })) l += lg / k;
        }
        if(l > 0.05) p.fac.push({ n:tourne(f, n), l:l });
      });
      out.push(p);
    });
  }); });
  return out;
}
/* les murs d'un niveau, en segments du site */
function murs(PG, Sa, i){
  var out = [];
  Sa.forEach(function(p){
    if(p.i !== i) return;
    var q = [[p.x0, p.y0], [p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1]].map(function(c){ return PG.versMonde(p.f, c[0], c[1]); });
    for(var k = 0; k < 4; k++) out.push([q[k], q[(k + 1) % 4]]);
  });
  return out;
}
/* la part des murs d'étage portés par un mur du niveau du dessous, à `J.empile` près */
function murEmpile(L, D, Sa){
  // ponytail: O(murs × murs du dessous) par niveau, une grille si la recherche en souffre
  var lu = 0, porte = 0;
  D.floors.forEach(function(fl, i){
    if(fl.lvl <= 0) return;
    var j = D.floors.findIndex(function(g){ return g.lvl === fl.lvl - 1; });
    if(j < 0) return;
    var B = murs(L.PG, Sa, j);
    murs(L.PG, Sa, i).forEach(function(m){
      var a = m[0], b = m[1], lg = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(lg));
      var ux = (b[0] - a[0]) / lg, uy = (b[1] - a[1]) / lg;
      var C = B.filter(function(s){
        var vx = s[1][0] - s[0][0], vy = s[1][1] - s[0][1];
        return Math.abs(ux * vy - uy * vx) < 0.02 * Math.hypot(vx, vy);
      });
      for(var t = 0; t < k; t++){
        var w = [a[0] + (b[0] - a[0]) * (t + 0.5) / k, a[1] + (b[1] - a[1]) * (t + 0.5) / k];
        lu += lg / k;
        if(C.some(function(s){ return aLigne(w, s) <= J.empile; })) porte += lg / k;
      }
    });
  });
  return lu ? porte / lu : null;
}
/* les couloirs : pour chaque corps, ce qui éclaire le sien (des intervalles en x
   du repère de l'étage), sa longueur, ses élargissements meublables */
function couloirs(L){
  var PG = L.PG, out = [];
  L.tous.forEach(function(r, i){ r.F.forEach(function(f){
    if(f.fixe || !f.rooms.length) return;
    var lg = Math.max(0, f.zr - f.zl), src = [], niches = [];
    (f.paliers || []).forEach(function(k){
      if(k.raccord) return;
      if(Math.min(k.W, k.H) >= J.meuble) niches.push(k);
      /* sur la façade : il prend toute la profondeur de sa bande */
      var b = k.frame === "A" ? f.yc0 + f.D / 2 : f.D / 2 - f.yc1;
      if((k.v0 || 0) + k.H >= b - 0.05) src.push([k.x0, k.x0 + k.W]);
    });
    f.rooms.forEach(function(rm){ if(rm.kind === "trav") src.push([rm.x0, rm.x0 + rm.W]); });
    [-1, 1].forEach(function(sg){
      if(PG.passage(r.F, f, sg)) return;
      var bord = sg * f.L / 2, atteint = sg < 0 ? f.zl <= -f.L / 2 + 0.01 : f.zr >= f.L / 2 - 0.01;
      var ferme = f.rooms.some(function(rm){ return rm.kind === "full" && rm.x0 <= bord + 0.05 && rm.x0 + rm.W >= bord - 0.05; });
      if(atteint && !ferme) src.push([bord, bord]);
    });
    /* un seul rang : le couloir longe la façade, il est éclairé tout du long */
    if(!f.deux) src.push([-f.L / 2, f.L / 2]);
    var sombre = 0;
    for(var x = f.zl + 0.5; x < f.zr; x += 1){
      var d = Infinity;
      src.forEach(function(s){ d = Math.min(d, x < s[0] ? s[0] - x : x > s[1] ? x - s[1] : 0); });
      if(d > J.sombre) sombre++;
    }
    out.push({ i:i, f:f, lg:lg, niches:niches, sombre:sombre });
  }); });
  return out;
}
/* les dégagements (paliers hors raccord) d'un corps, en rectangles de son étage */
function degagements(f){
  return (f.paliers || []).filter(function(k){ return !k.raccord; }).map(function(k){
    var v = k.v0 || 0, y0 = k.frame === "A" ? f.yc0 - v - k.H : k.frame === "B" ? f.yc1 + v : -f.D / 2;
    return { f:f, x0:k.x0, x1:k.x0 + k.W, y0:y0, y1:y0 + k.H, a:k.W * k.H };
  });
}
function dansRectF(r, w){
  var f = r.f, c = Math.cos(-f.a), s = Math.sin(-f.a), dx = w[0] - f.cx, dy = w[1] - f.cy;
  var x = dx * c - dy * s, y = dx * s + dy * c;
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}
function moy(T){ return T.length ? r3(T.reduce(function(s, x){ return s + x; }, 0) / T.length) : null; }
function part(T, ok){ return T.length ? r3(T.filter(ok).length / T.length) : null; }

function mesuresPlan(L, D, vols, suites){
  var PG = L.PG, Sa = salles(L), Co = couloirs(L);
  function niv(i){ return D.floors[i].lvl; }
  function grp(f){ return f.v.bat || f.v.id; }
  var cls = Sa.filter(function(p){ return p.rm.kind === "band" && UNITE.test(p.n) && !p.rm.antichambre; });
  /* --- les classes --- */
  var double = part(cls, function(p){
    return p.fac.some(function(a){ return p.fac.some(function(b){ return a.n[0] * b.n[0] + a.n[1] * b.n[1] < 0.5; }); });
  });
  var prop = part(cls, function(p){ var w = p.x1 - p.x0, h = p.y1 - p.y0; return Math.max(w, h) / Math.min(w, h) <= J.classeRatio + 0.01; });
  var vitrage = moy(cls.map(function(p){
    var l = 0; p.fac.forEach(function(x){ l += x.l; });
    return l ? Math.min(1, p.a * J.vitrage / (l * D.floors[p.i].h)) : 1;
  }));
  var sej = Sa.filter(sejour), aS = 0, aN = 0;
  sej.forEach(function(p){ aS += p.a; if(!p.fac.length) aN += p.a; });
  /* --- les grappes : des suites de 3 ou 4 --- */
  var G = suites.filter(function(g){ return g.n >= 3; });
  var espace = part(G, function(g){
    return (g.f.paliers || []).some(function(k){
      return !k.raccord && k.W * k.H >= J.espace && k.x0 < g.x1 - 0.05 && k.x0 + k.W > g.x0 + 0.05;
    });
  });
  /* aux étages, de l'escalier le plus proche à la grappe, sans en longer une autre */
  var Ge = G.filter(function(g){ return niv(g.i) > 0 && g.f.cages.length; });
  var acces = part(Ge, function(g){
    var xc = g.f.cages.map(function(c){ return c.x0 + c.W / 2; }).sort(function(a, b){
      return Math.abs(a - (g.x0 + g.x1) / 2) - Math.abs(b - (g.x0 + g.x1) / 2); })[0];
    var e = xc < g.x0 ? g.x0 : xc > g.x1 ? g.x1 : xc, a = Math.min(xc, e), b = Math.max(xc, e);
    return !G.some(function(h){ return h !== g && h.f === g.f && h.x0 < b - 0.5 && h.x1 > a + 0.5; });
  });
  /* une salle d'appui entre deux salles, dont une classe */
  var appui = part(Sa.filter(function(p){ return /^Salles d'appui/.test(p.n); }), function(p){
    var V = Sa.filter(function(q){ return q !== p && q.f === p.f && q.i === p.i && CLSRE.test(q.n) && mur(p, q) >= PG.PLAN.porte; });
    return V.length >= 2 && V.some(function(q){ return UNITE.test(q.n); });
  });
  /* --- les couloirs --- */
  var lgT = 0, nN = 0, aN2 = 0, sombre = 0, aCl = 0, nCl = 0, lgCl = 0, flCl = {};
  cls.forEach(function(p){ flCl[p.i] = (flCl[p.i] || 0) + 1; });
  Co.forEach(function(c){
    lgT += c.lg; nN += c.niches.length; sombre += c.sombre;
    c.niches.forEach(function(k){ aN2 += k.W * k.H; });
    if(flCl[c.i]){ lgCl += c.lg; c.niches.forEach(function(k){ aCl += k.W * k.H; }); }
  });
  Object.keys(flCl).forEach(function(i){ nCl += flCl[i]; });
  aCl += Math.max(0, PG.COULOIR - RULES.circ.couloir.def) * lgCl;
  /* --- l'entrée et le hall, au rez --- */
  var rez = Sa.filter(function(p){ return niv(p.i) === 0 && p.f && !p.f.fixe; });
  var hall = rez.filter(function(p){ return /^ecole\|Hall/.test(p.key); })[0], entree = null, centre = null;
  if(hall){
    var R = SITE.rou || [], dR = function(p){ return Math.min.apply(null, R.map(function(P){ return aLigne(p.c, P); }).concat(Infinity)); };
    var dh = dR(hall), autres = rez.filter(function(p){ return p !== hall; });
    entree = autres.length ? part(autres, function(p){ return dR(p) >= dh; }) : 1;
    var r0 = L.tous[hall.i], F = r0.F.filter(function(f){ return !f.fixe && f.rooms.length; }), rac = relies(PG, r0, F);
    var ailes = part(F, function(f){ return rac(F.indexOf(f)) === rac(F.indexOf(hall.f)); });
    var cx = 0, cy = 0, Rm = 0;
    cls.forEach(function(p){ cx += p.c[0] / cls.length; cy += p.c[1] / cls.length; });
    cls.forEach(function(p){ Rm = Math.max(Rm, Math.hypot(p.c[0] - cx, p.c[1] - cy)); });
    var mil = cls.length ? Math.max(0, 1 - Math.hypot(hall.c[0] - cx, hall.c[1] - cy) / Math.max(Rm, 1)) : null;
    centre = mil == null ? ailes : r3((ailes + mil) / 2);
  }
  /* --- l'UAPE : sa propre entrée au rez, le réfectoire contre la cuisine, le bâtiment de l'école --- */
  var U = Sa.filter(function(p){ return /^uape\|/.test(p.key); }), uape = null;
  if(U.length){
    var hU = U.filter(function(p){ return /Hall/.test(p.n) && niv(p.i) === 0 && p.fac.length; }).length ? 1 : 0;
    var ref = Sa.filter(function(p){ return /Réfectoire/.test(p.n); }), cui = Sa.filter(function(p){ return /^Cuisine/.test(p.n); });
    var rc = ref.some(function(a){ return cui.some(function(b){ return a.i === b.i && ecart(a, b) <= 2 * PG.MUR + 0.05; }); }) ? 1 : 0;
    var bat = cls.length && U.every(function(p){ return cls.some(function(q){ return grp(q.f) === grp(p.f); }); }) ? 1 : 0;
    uape = r3((hU + rc + bat) / 3);
  }
  /* --- la salle des maîtres voit la cour --- */
  var sm = Sa.filter(function(p){ return /^Salle des maîtres/.test(p.n); }), vue = null;
  if(sm.length){
    var cour = (courUtile(vols).pts || []);
    vue = sm.some(function(p){
      if(niv(p.i) > 1) return false;
      return p.fac.some(function(fc){
        return cour.some(function(q){
          var dx = q[0] - p.c[0], dy = q[1] - p.c[1], d = Math.hypot(dx, dy);
          if(d > J.vueCour || dx * fc.n[0] + dy * fc.n[1] < 0.5 * d) return false;
          for(var t = 0.15; t < 1; t += 2 / Math.max(d, 2)){
            var w = [p.c[0] + dx * t, p.c[1] + dy * t];
            if(L.tous[p.i].F.some(function(g){ return g !== p.f && dansF(g, w); })) return false;
          }
          return true;
        });
      });
    }) ? 1 : 0;
  }
  /* --- les espaces communs, par élève --- */
  var commun = aN2;
  Sa.forEach(function(p){ if(/^Hall|foyer/.test(p.n)) commun += p.a; });
  /* --- la structure : les murs empilés, des classes à la même profondeur --- */
  /* --- d29 : une seule circulation par niveau hors sol --- */
  var hs = L.tous.map(function(r, i){ return { r:r, i:i }; }).filter(function(x){ return niv(x.i) >= 0; });
  var unique = part(hs, function(x){
    var F = x.r.F.filter(function(f){ return !f.fixe && f.rooms.length; }), rac = relies(PG, x.r, F), R = {};
    F.forEach(function(_, j){ R[rac(j)] = 1; });
    return Object.keys(R).length <= 1;
  });
  /* --- d35 : les locaux d'un chapitre côte à côte, couloir franchi ; par niveau,
     la part de sa surface dans son plus grand groupe --- */
  var gC = 0, aC = 0, pres = 2 * PG.MUR + PG.COULOIR + 0.05;
  D.floors.forEach(function(_, i){
    var C = {};
    Sa.forEach(function(p){ if(p.i === i && p.key) (C[chap(p.key)] = C[chap(p.key)] || []).push(p); });
    Object.keys(C).forEach(function(k){
      var T = C[k], pere = T.map(function(_, j){ return j; }), som = {};
      function rac(j){ while(pere[j] !== j) j = pere[j] = pere[pere[j]]; return j; }
      T.forEach(function(x, j){ T.forEach(function(y, m){ if(m > j && ecart(x, y) <= pres) pere[rac(m)] = rac(j); }); });
      var tot = 0, max = 0;
      T.forEach(function(x, j){ som[rac(j)] = (som[rac(j)] || 0) + x.a; tot += x.a; });
      Object.keys(som).forEach(function(r){ max = Math.max(max, som[r]); });
      gC += max; aC += tot;
    });
  });
  /* --- e45 : les murs entre pièces en façade, sur la trame, depuis un bout du corps --- */
  var T0 = V.trameStruct, nT = 0, okT = 0;
  L.tous.forEach(function(r){ r.F.forEach(function(f){
    if(f.fixe) return;
    ["A", "B"].forEach(function(fr){
      var X = Sa.filter(function(p){ return p.f === f && p.rm.frame === fr && (p.y0 <= -f.D / 2 + 0.05 || p.y1 >= f.D / 2 - 0.05); })
        .map(function(p){ return p.x0; }).sort(function(a, b){ return a - b; }).slice(1);
      if(!X.length) return;
      /* la trame part de l'un ou l'autre bout : le meilleur */
      okT += Math.max.apply(null, [-f.L / 2, f.L / 2].map(function(b){
        return X.filter(function(x){ var d = ((Math.abs(x - b) % T0) + T0) % T0; return Math.min(d, T0 - d) <= J.trameTol; }).length;
      }));
      nT += X.length;
    });
  }); });
  /* --- e-vides : là où la dalle pourrait s'ouvrir sur un dégagement ou le hall du dessous --- */
  var zones = L.tous.map(function(r, i){
    var Z = [];
    r.F.forEach(function(f){ if(!f.fixe) degagements(f).forEach(function(k){ Z.push(k); }); });
    Sa.forEach(function(p){ if(p.i === i && /^Hall|foyer/.test(p.n)) Z.push(p); });
    return Z;
  });
  var etg = L.tous.map(function(_, i){ return i; }).filter(function(i){ return niv(i) > 0; });
  var vides = part(etg, function(i){
    var j = D.floors.findIndex(function(g){ return g.lvl === niv(i) - 1; });
    if(j < 0) return false;
    return zones[i].some(function(k){
      if(k.a < J.espace) return false;
      var a = 0;
      for(var x = k.x0 + 0.5; x < k.x1; x++) for(var y = k.y0 + 0.5; y < k.y1; y++){
        var w = PG.versMonde(k.f, x, y);
        if(zones[j].some(function(z){ return dansRectF(z, w); })) a++;
      }
      return a >= J.vide;
    });
  });
  var empile = murEmpile(L, D, Sa), prof = {}, pm = 0;
  cls.forEach(function(p){ var k = Math.round(10 * (p.y1 - p.y0)); prof[k] = (prof[k] || 0) + 1; pm = Math.max(pm, prof[k]); });
  return {
    classesDouble: double, classesProp: prop, vitrageFacade: vitrage,
    aveugles: aS ? r3(aN / aS) : null,
    espaceGrappe: espace, accesGrappe: acces, appuiEntre: appui,
    couloirApprendre: nCl ? Math.round(10 * aCl / nCl) / 10 : null,
    niches: lgT ? r3(nN / (lgT / J.niche)) : null,
    couloirSombre: Co.length ? sombre : null,
    entreeRoute: entree, hallCentre: centre, uapeAutonome: uape, maitresCour: vue,
    communEleve: Math.round(100 * commun / RULES.ecole.eleves) / 100,
    mursEmpiles: empile == null ? null : r3(empile),
    adaptable: cls.length && empile != null ? r3((pm / cls.length + empile) / 2) : null,
    circUnique: unique, chapitresGroupes: aC ? r3(gC / aC) : null,
    murTrame: nT ? r3(okT / nT) : null, videsPossibles: vides,
    allegeEnfant: RULES.plan.fenetre.allege
  };
}

function mesuresDe(L, D, vols){
  var PG = L.PG, MUR = PG.MUR;
  var nCl = 0, sol = 0, circ = 0, bati = 0, bruit = 0, nG = 0, sG = 0, bouts = 0, jour = 0, suites = [], lin = 0, lin2 = 0;
  L.tous.forEach(function(r, i){
    r.F.forEach(function(f){
      /* un corps sans pièce à ce niveau n'est ni du bâti servi ni un couloir */
      if(!f.fixe && !f.rooms.length) return;
      bati += f.L * f.D;
      if(f.fixe) return;
      var occ = 0;
      f.rooms.forEach(function(rm){ occ += rm.a; });
      /* le couloir dessert-il ses deux rives ? */
      if(f.rooms.length){ lin += f.L; if(f.rooms.some(function(rm){ return rm.frame === "B"; })) lin2 += f.L; }
      circ += f.L * f.D - occ;
      /* les classes et leur façade de jour */
      f.rooms.forEach(function(rm){ if(rm.kind !== "bloc" && UNITE.test(rm.n)){ nCl++; sol += soleilPiece(f, rm); } });
      /* le mur entre une classe et une pièce bruyante */
      var P = pieces(PG, f);
      P.forEach(function(a){ if(CLSRE.test(a.n)) P.forEach(function(b){ if(a !== b && bruyant(b)) bruit += mur(a, b); }); });
      /* les grappes, bande par bande : un noyau, un bloc, une autre pièce coupent la suite */
      ["A", "B"].forEach(function(fr){
        var B = f.rooms.filter(function(rm){ return rm.frame === fr; }).sort(function(p, q){ return p.x0 - q.x0; });
        /* le bloc ouvert d'un cluster ferme sa grappe : la suite se lit vers lui
           et s'étend à lui — l'espace de la grappe est devant (`espaceGrappe`) */
        function ouv(rm){ return rm.kind === "bloc" && rm.cel.some(function(c){ return c.ouvert; }); }
        var kb = B.findIndex(ouv), kc = B.findIndex(function(rm){ return rm.kind === "band" && UNITE.test(rm.n); });
        if(kb >= 0 && kb < kc) B.reverse();
        var K = f.cages.filter(function(c){ return c.bande === fr; }), run = 0, prev = null, x0 = 0, x1 = 0;
        function tient(rm){ x0 = Math.min(x0, rm.x0); x1 = Math.max(x1, rm.x0 + rm.W); }
        function clore(){ if(run){ sG += grappe(run) * run; nG += run; suites.push({ i:i, f:f, x0:x0, x1:x1, n:run }); } run = 0; }
        B.forEach(function(rm){
          /* le vestiaire en sas fait partie de sa classe : il ne coupe pas la suite */
          if(rm.antichambre) return;
          if(ouv(rm)){ if(run) tient(rm); clore(); prev = rm; return; }
          var cl = rm.kind === "band" && UNITE.test(rm.n);
          /* un noyau entre la pièce d'avant et celle-ci */
          var g0 = prev && Math.min(prev.x0 + prev.W, rm.x0 + rm.W), g1 = prev && Math.max(prev.x0, rm.x0);
          var coupe = prev && K.some(function(c){ return c.x0 + c.W > g0 - 0.05 && c.x0 < g1 + 0.05; });
          if(!cl || coupe) clore();
          if(cl){ if(!run++){ x0 = rm.x0; x1 = rm.x0 + rm.W; } else tient(rm); }
          prev = rm;
        });
        clore();
      });
      /* les bouts du couloir : atteints, et qu'aucun grand local ne ferme ;
         un bout qui passe dans le corps voisin n'en est pas un */
      if(f.rooms.length) [-1, 1].forEach(function(sg){
        if(PG.passage(r.F, f, sg)) return;
        bouts++;
        var bord = sg * f.L / 2, atteint = sg < 0 ? f.zl <= -f.L / 2 + 0.01 : f.zr >= f.L / 2 - 0.01;
        var ferme = f.rooms.some(function(rm){ return rm.kind === "full" && rm.x0 <= bord + 0.05 && rm.x0 + rm.W >= bord - 0.05; });
        if(atteint && !ferme) jour++;
      });
    });
  });
  /* les locaux techniques qui se touchent, au même niveau */
  var T = [];
  Object.keys(L.pos).forEach(function(k){ if(chap(k) === "tech") L.pos[k].forEach(function(x){ T.push(x); }); });
  var pere = T.map(function(_, j){ return j; });
  function racine(j){ while(pere[j] !== j) j = pere[j] = pere[pere[j]]; return j; }
  T.forEach(function(x, j){ T.forEach(function(y, k){ if(k > j && x.i === y.i && ecart(x, y) <= 2 * MUR + 0.05) pere[racine(k)] = racine(j); }); });
  var groupes = {};
  T.forEach(function(_, j){ groupes[racine(j)] = 1; });
  /* le programme demandé, niveau par niveau — ce qui est hors volume n'y entre pas */
  var demande = 0;
  D.floors.forEach(function(fl){ fl.rooms.forEach(function(r){ if(!r.hors) demande += r.q * r.u; }); });
  /* les WC d'étage posés sur un WC du niveau du dessous */
  var wc = 0, wcOk = 0;
  Object.keys(L.pos).forEach(function(k){ if(/\|WC/.test(k)) L.pos[k].forEach(function(x){
    var j = D.floors.findIndex(function(g){ return g.lvl === D.floors[x.i].lvl - 1; });
    if(D.floors[x.i].lvl <= 0 || j < 0) return;
    wc++;
    if(Object.keys(L.pos).some(function(q){ return /\|WC/.test(q) && L.pos[q].some(function(y){ return y.i === j && ecart(x, y) <= J.empile; }); })) wcOk++;
  }); });
  var noyaux = 0, H = PG.hotes(D.partis.courant.vols);
  Object.keys(H).forEach(function(k){ noyaux += H[k].n; });
  return Object.assign(mesuresPlan(L, D, vols, suites), {
    classesSoleil: nCl ? r3(sol / nCl) : null,
    liensPlan: L.liens.n ? r3(L.liens.ok / L.liens.n) : null,
    circPlan: bati ? r3(circ / bati) : null,
    murBruyant: nCl ? Math.round(bruit * 10) / 10 : null,
    noyaux: noyaux,
    grappes: nG ? r3(sG / nG) : null,
    techGroupes: T.length ? Object.keys(groupes).length : null,
    posePlan: demande ? r3(1 - L.am / demande) : null,
    couloirsJour: bouts ? r3(jour / bouts) : null,
    pubGroupe: L.pub.n ? r3(1 - L.pub.meles.length / L.pub.n) : null,
    vestSas: L.sas.n ? r3(L.sas.ok / L.sas.n) : null,
    doubleRive: lin ? r3(lin2 / lin) : null,
    sanitairesEmpiles: wc ? r3(wcOk / wc) : null
  });
}

/* ---------- les écarts au cadre ---------------------------------------------------- */
function ecartsDe(L, D, m){
  var out = [];
  function pc(x){ return Math.round(100 * x) + " %"; }
  function niv(i){ return D.floors[i].name.toLowerCase(); }
  function dit(k, msg){ if(enVigueur(k)) out.push({ k:k, v:-1, v2:-1, msg:msg, pile:0, sev:severite(k), c:"typo" }); }
  if(L.nm) dit("typo-pose", L.nm + " pièce" + (L.nm > 1 ? "s" : "") + " ne tien" + (L.nm > 1 ? "nent" : "t")
    + " pas dans les plans — " + Math.round(L.am) + " m² ("
    + L.non.map(function(x){ return niv(x.i) + " " + Math.round(x.a) + " m²"; }).join(", ") + ")");
  if(L.acces.length) dit("sia500", "Niveau sans noyau escalier + ascenseur : "
    + L.acces.map(function(x){ return x.nom + " au " + niv(x.i); }).join(", "));
  if(L.fuite > L.fuiteMax + 0.01) dit("fuites", "Évacuation : " + dec(L.fuite, 1) + " m jusqu'à un escalier, pour "
    + Math.round(L.fuiteMax) + " m au plus");
  if(L.feu.length) dit("fuites", "Étage de plus de " + Math.round(L.PG.FEU.cageSeuil) + " m² à un seul noyau : "
    + L.feu.map(function(x){ return "bâtiment " + x.g + " au " + niv(x.i); }).join(", "));
  if(L.vides.length) dit("sol-vide", "Sol inutilisé : " + L.vides.map(function(x){
    return x.nom + " au " + niv(x.i) + " (" + Math.round(x.a) + " m²)"; }).join(", "));
  if(L.empile.length) dit("noyaux-empiles", "Noyaux décalés d'un niveau à l'autre : " + L.empile.join(", "));
  if(L.scene != null && L.scene > 2 * L.PG.MUR + 0.05) dit("scene-sport", "Au plan, la scène n'est pas collée à la salle de sport"
    + (isFinite(L.scene) ? " (" + dec(L.scene, 1) + " m)" : " (pas au même niveau)"));
  /* les règles de plan qu'une mesure lit (cadre.js — `plan-*`) */
  [["plan-couloir-bout", m.couloirsJour, V.couloirBout, 1, "Bouts de couloir sur une façade"],
   ["plan-double-rive", m.doubleRive, V.doubleRive, 1, "Corps dont le couloir dessert ses deux rives"],
   ["plan-classes-orient", m.classesSoleil, V.classesOrient, 1, "Classes bien orientées"],
   ["plan-aveugle", m.aveugles, V.aveugleMax, -1, "Surface de séjour sans façade"],
   ["plan-murs-porteurs", m.mursEmpiles, V.mursPorteurs, 1, "Murs d'étage sur un mur du dessous"],
   ["plan-trame", m.murTrame, V.trameMin, 1, "Murs en façade sur la trame"],
   ["plan-sanitaires", m.sanitairesEmpiles, V.sanitEmpiles, 1, "WC d'étage sur un WC du dessous"],
   ["plan-adjacences", m.liensPlan, V.adjPlan, 1, "Liens du schéma tenus au plan"],
   ["plan-circ-utile", m.circPlan == null || m.circPlan >= 1 ? null : m.circPlan / (1 - m.circPlan), V.circUtileMax, -1,
    "Circulation ÷ surface utile"]
  ].forEach(function(e){
    if(e[1] != null && (e[1] - e[2]) * e[3] < -1e-9) dit(e[0], e[4] + " : " + pc(e[1]) + ", pour " + pc(e[2]) + (e[3] > 0 ? " au moins" : " au plus"));
  });
  if(m.techGroupes > V.gainesMax) dit("plan-gaines", m.techGroupes + " groupes de locaux techniques, pour " + V.gainesMax + " au plus");
  return out;
}

/* Les écarts typo d'une évaluation, comptés comme ceux du mixer et du massing
   (`verdict.typo` d'une variante) : rouges (`e`), ambre (`w`). */
export function typoVerdict(E){
  var o = { e:0, w:0 };
  (E || []).forEach(function(x){ if(x.c === "typo") o[x.sev === "e" ? "e" : "w"]++; });
  return o;
}

/* Les mesures et les écarts d'un bâtiment, d'un seul plan — à la seed
   typologie `graine`, celle à l'écran par défaut. */
export function evaluerTypo(vols, ponts, graine){
  var D = donneesTypo(vols, ponts, graine), L = lirePlans(D);
  var mes = mesuresDe(L, D, vols);
  return { mes:mes, ecarts:ecartsDe(L, D, mes) };
}
