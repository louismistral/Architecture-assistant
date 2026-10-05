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
import { planifier } from "./gen.js";
import { donneesTypo } from "./donnees.js";
import { enVigueur, severite } from "../data/cadre.js";
import { BRUYANT, CLSRE, UNITE } from "../mix/niv.js";
import { dec } from "../core/format.js";

function chap(key){ return String(key || "").split("|")[0]; }
function nomPoste(k){ return String(k).split("|")[1] || k; }
function nomVol(v){ return v.nom || String(v.id).toUpperCase(); }
/* l'écart entre deux boîtes du site, de bord à bord, en équerre */
function ecart(x, y){
  return Math.max(0, Math.abs(x.p[0] - y.p[0]) - x.ex - y.ex) + Math.max(0, Math.abs(x.p[1] - y.p[1]) - x.ey - y.ey);
}
function r3(x){ return Math.round(x * 1000) / 1000; }

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
      var s2 = f.cages.map(function(c){
        var p = monde(f, c.bande, c.x0, 0, c.v0 || 0);
        return p[0].toFixed(1) + "," + p[1].toFixed(1) + "," + c.W.toFixed(1) + "×" + c.H.toFixed(1);
      }).join(" ");
      /* un corps qui porte un noyau le porte à TOUS ses niveaux, au même endroit */
      if(PG.hotes(vols)[f.v.id]) (sig[f.v.id] = sig[f.v.id] || { v:f.v, s:{} }).s[s2] = 1;
    });
    Object.keys(aire).forEach(function(g){
      if(aire[g] > F0.cageSeuil && (N[g] || []).length < 2) feu.push({ g:g, i:i });
    });
    r.F.forEach(function(f){
      if(f.fixe) return;
      var C = N[grp(f.v)] || [], rez = D.floors[i].lvl === 0;
      if(!C.length){ if(!rez) acces.push({ nom:nomVol(f.v), i:i }); return; }
      if(rez) return;     /* au rez, on sort par la façade : halls et portes */
      var lim = C.length > 1 ? F0.fuiteDouble : F0.fuiteSimple;
      f.rooms.forEach(function(rm){
        var p = monde(f, rm.frame === "full" ? "full" : rm.frame, rm.x0, rm.W / 2, (rm.H || 0) / 2), d = Infinity;
        C.forEach(function(c){ d = Math.min(d, Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1])); });
        if(d - lim > fuite - fuiteMax){ fuite = d; fuiteMax = lim; }
      });
    });
  });
  Object.keys(sig).forEach(function(k){ if(Object.keys(sig[k].s).length > 1) empile.push(nomVol(sig[k].v)); });
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
  return { PG:PG, tous:tous, pos:pos, nm:nm, am:am, non:non, acces:acces, empile:empile, feu:feu,
           fuite:fuite, fuiteMax:fuiteMax, rompus:rompus, liens:{ n:n, ok:ok }, scene:scene, vides:vides };
}

/* ---------- les mesures ----------------------------------------------------------- */

/* L'azimut d'une façade (y du site vers le nord) : 1 de l'est au sud-sud-ouest,
   ½ du sud-ouest à l'ouest, 0 au nord. */
function soleil(nx, ny){
  var az = (Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360;
  return az >= 67.5 && az <= 202.5 ? 1 : az > 202.5 && az <= 292.5 ? 0.5 : 0;
}
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
    if(rm.kind === "bloc") rm.cel.forEach(function(c){ rect({ n:c.n, key:c.key }, rm.frame, rm.x0, c.u0, (rm.v0 || 0) + c.v0, c.W, c.H); });
    else rect({ n:rm.n, key:rm.key }, rm.frame, rm.x0, 0, rm.v0 || 0, rm.W, rm.H || 0);
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

function mesuresDe(L, D){
  var PG = L.PG, MUR = PG.MUR;
  var nCl = 0, sol = 0, circ = 0, bati = 0, bruit = 0, nG = 0, sG = 0, bouts = 0, jour = 0;
  L.tous.forEach(function(r){
    r.F.forEach(function(f){
      bati += f.L * f.D;
      if(f.fixe) return;
      var occ = 0;
      f.rooms.forEach(function(rm){ occ += rm.a; });
      circ += f.L * f.D - occ;
      /* les classes et leur façade de jour */
      f.rooms.forEach(function(rm){ if(rm.kind !== "bloc" && UNITE.test(rm.n)){ nCl++; sol += soleilPiece(f, rm); } });
      /* le mur entre une classe et une pièce bruyante */
      var P = pieces(PG, f);
      P.forEach(function(a){ if(CLSRE.test(a.n)) P.forEach(function(b){ if(a !== b && bruyant(b)) bruit += mur(a, b); }); });
      /* les grappes, bande par bande : un noyau, un bloc, une autre pièce coupent la suite */
      ["A", "B"].forEach(function(fr){
        var B = f.rooms.filter(function(rm){ return rm.frame === fr; }).sort(function(p, q){ return p.x0 - q.x0; });
        var K = f.cages.filter(function(c){ return c.bande === fr; }), run = 0, fin = null;
        function clore(){ if(run){ sG += grappe(run) * run; nG += run; } run = 0; }
        B.forEach(function(rm){
          var cl = rm.kind === "band" && UNITE.test(rm.n);
          var coupe = fin != null && K.some(function(c){ return c.x0 + c.W > fin - 0.05 && c.x0 < rm.x0 + 0.05; });
          if(!cl || coupe) clore();
          if(cl) run++;
          fin = rm.x0 + rm.W;
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
  var noyaux = 0, H = PG.hotes(D.partis.courant.vols);
  Object.keys(H).forEach(function(k){ noyaux += H[k].n; });
  return {
    classesSoleil: nCl ? r3(sol / nCl) : null,
    liensPlan: L.liens.n ? r3(L.liens.ok / L.liens.n) : null,
    circPlan: bati ? r3(circ / bati) : null,
    murBruyant: nCl ? Math.round(bruit * 10) / 10 : null,
    noyaux: noyaux,
    grappes: nG ? r3(sG / nG) : null,
    techGroupes: T.length ? Object.keys(groupes).length : null,
    posePlan: demande ? r3(1 - L.am / demande) : null,
    couloirsJour: bouts ? r3(jour / bouts) : null
  };
}

/* ---------- les écarts au cadre ---------------------------------------------------- */
function ecartsDe(L, D){
  var out = [];
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
  return out;
}

/* Les écarts typo d'une évaluation, comptés comme ceux du mixer et du massing
   (`verdict.typo` d'une variante) : rouges (`e`), ambre (`w`). */
export function typoVerdict(E){
  var o = { e:0, w:0 };
  (E || []).forEach(function(x){ if(x.c === "typo") o[x.sev === "e" ? "e" : "w"]++; });
  return o;
}

/* Les mesures et les écarts d'un bâtiment, d'un seul plan. */
export function evaluerTypo(vols, ponts){
  var D = donneesTypo(vols, ponts), L = lirePlans(D);
  return { mes:mesuresDe(L, D), ecarts:ecartsDe(L, D) };
}
