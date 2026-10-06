/* ============================================================================
   CONTRÔLE D'UNE RÉPARTITION

   Le mixer ne refuse rien : il dit. C'est le canal par lequel une répartition
   faite à la main — ou chargée d'une variante que le cadre a depuis rendue
   invalide — apprend ses écarts. Deux sévérités, lues sur le TAG de la ligne
   qu'elles notifient (`data/cadre.js`, `data/lignes.js — severite()`) :
     "e"  rouge : le cadre OPPOSABLE, Intangible — la variante est invalide ;
     "w"  ambre : le cadre choisi, une orientation, une marge qui se discute.
   Une ligne éteinte ne dit plus rien ; une ligne Indicative, si.

   Toute valeur chiffrée vient de `src/data/rules.js` ou de l'état. Rien n'est
   réécrit ici.

   Chaque écart porte deux choses de plus qu'un message : un CODE stable, qui
   permet de l'assumer sans qu'il resurgisse au premier réglage (`accept.js`),
   et le ou les REMÈDES qui le résoudraient (`fix.js`). Dire ce qui ne va pas
   sans dire ce qui le réparerait laisse tout le travail à faire.
   ========================================================================= */
import { dec, fmt } from "../core/format.js";
import { V, lu, severite } from "../data/cadre.js";
import { RULES } from "../data/rules.js";
import {
  BLOCKS, FLOORS, TRAY, flBrut, flCount, flName, lvlOf, trayArea, trayBlocks
} from "./floors.js";
import { isAccepted } from "./accept.js";
import {
  fixCombler, fixDeplacer, fixPlateau, fixEtage, fixReste, fixVider, fixWC, nivCible
} from "./fix.js";
import { adjActive } from "./opts.js";
import { CLSRE, NIV, WCRE, nivHit } from "./niv.js";
import { PMAP, PROX, aOf } from "./prog.js";

/* Niveaux occupés par un poste. */
/* Les adjacences exigées qui ne tiennent pas : leurs deux postes posés à des
   niveaux différents. Le contrôle les dit ; le massing, devant une seule, ne
   propose aucun volume (`mass/gen.js — genMass()`). */
export function adjRompues(){
  var out = [];
  PROX.forEach(function(l){
    if(!adjActive(l.id) || !lu("adj")) return;
    var A = nivDe(l.a), B = nivDe(l.b);
    if(!A.length || !B.length) return;       /* pas encore posé : rien à dire */
    var d = Infinity;
    A.forEach(function(fa){ B.forEach(function(fb){ d = Math.min(d, Math.abs(fa - fb)); }); });
    if(d > 0) out.push({ l:l, A:A, B:B, d:d });
  });
  return out;
}
function nivDe(key){
  var out = [];
  BLOCKS.forEach(function(b){
    if(b.key !== key || b.fl === TRAY) return;
    if(out.indexOf(b.fl) < 0) out.push(b.fl);
  });
  return out;
}

export function mixCheck(){
  var out = [], i, seen = {};
  /* `more` porte le code stable et les remèdes : `{ code, fix }`, `fix` étant
     un remède ou une liste. Les remèdes nuls — un déplacement vers un niveau
     que la pile n'offre pas — sont écartés ici, pour que la vue n'ait jamais à
     proposer un geste impossible. */
  function add(sev, msg, ref, ex, fl, more){
    var o = more || {}, k = o.code || (sev + "|" + msg);
    if(seen[k]){ seen[k].n++; return seen[k]; }
    var fx = (o.fix == null) ? [] : (o.fix.length === undefined ? [o.fix] : o.fix);
    seen[k] = { sev:sev, msg:msg, ref:ref, ex:ex || "", fl:(fl === undefined ? null : fl), n:1,
                code:k, note:o.note || "", keys: o.keys || [],
                fixes: fx.filter(function(f){ return !!f; }),
                ok: isAccepted(o.code || null) };
    out.push(seen[k]);
    return seen[k];
  }

  /* --- ce qui n'est pas encore posé ------------------------------------- */
  var tb = trayBlocks(), tn = 0;
  tb.forEach(function(b){ tn += b.q; });
  if(tn) add(severite("bac"), tn + " pièce" + (tn > 1 ? "s" : "") + " encore au bac, soit "
    + fmt(Math.round(trayArea())) + " m² sans niveau", "à placer",
    tb.length ? PMAP[tb[0].key].n : "", null,
    { code:"bac", fix: fixReste(), keys: tb.map(function(b){ return b.key; }) });

  /* --- règles de niveau --------------------------------------------------- */
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    var p = PMAP[b.key], lv = lvlOf(b.fl);
    NIV.forEach(function(rl){
      if(!nivHit(rl, p) || !lu(rl.id)) return;
      var bad = false;
      if(rl.lvl){ if(lv < rl.lvl.min || lv > rl.lvl.max) bad = true; }
      else if(rl.grade){ if(lv !== 0) bad = true; }
      else if(rl.etageMax !== undefined){ if(lv > rl.etageMax || lv < 0) bad = true; }
      else if(rl.same){
        var ref = nivDe(rl.same);
        if(ref.length && ref.indexOf(b.fl) < 0) bad = true;
      }
      if(!bad) return;
      /* Le remède d'une règle de niveau est toujours le même geste : ramener le
         poste là où la règle l'admet. Pour une règle « au même niveau que », la
         cible est le niveau de son ancre. */
      var cible = rl.same ? (nivDe(rl.same)[0] === undefined ? -1 : nivDe(rl.same)[0])
                          : nivCible(p, b.fl);
      add(severite(rl.id), rl.msg, rl.src.a, p.n + " au " + flName(b.fl).toLowerCase(), b.fl,
        { code: "niv:" + NIV.indexOf(rl) + ":" + p.key, keys: [p.key], fix: fixDeplacer(p.key, cible),
          note: "Le mixer n\u2019offre aucun niveau que cette règle admette."  });
    });
  });

  /* --- lumière naturelle en sous-sol -------------------------------------- */
  var sub = 0;
  FLOORS.forEach(function(F, k){ if(F.lvl < 0 && flCount(k)) sub++; });
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    if(lvlOf(b.fl) >= 0) return;
    var p = PMAP[b.key];
    if(p.f === "tec" || !lu("jour-ss")) return;
    add(severite("jour-ss"), "En sous-sol, seuls les locaux techniques, de stockage et de nettoyage "
      + "se passent de lumière naturelle", "2.10", p.n, b.fl,
      { code:"jour:" + p.key, keys: [p.key], fix: fixDeplacer(p.key, nivCible(p, b.fl)) });
  });
  if(sub) add("w", "Nappe phréatique relevée à " + dec(RULES.site.nappe[1])
    + " m : la marge sous le terrain naturel va de 1,0 m à l'ouest à 4,5 m à l'est — un sous-sol "
    + "excavé demande " + dec(RULES.dist.couverture)
    + " m de couverture, il n'est tenable qu'au tiers est du périmètre", "2.3", "", null,
    { code:"nappe", fix: fixCombler() });

  /* --- adjacences actives -------------------------------------------------
     Une adjacence exigée demande ses deux postes au même niveau : c'est la
     ligne `adj` du cadre opposable — rouge. Une mutualisation ne dit rien. */
  adjRompues().forEach(function(x){
    var l = x.l, A = x.A, B = x.B, d = x.d;
    add(severite("adj"),
      PMAP[l.a].n + " et " + PMAP[l.b].n + " sont séparés de "
        + d + " niveau" + (d > 1 ? "x" : "") + " — « " + l.q + " »",
      "adjacences", PMAP[l.a].n, A[0],
      { code:"adj:" + l.a + "|" + l.b, keys: [l.a, l.b],
        fix: [fixDeplacer(l.a, B[0]), fixDeplacer(l.b, A[0])],
        note: "L’adjacence est exigée : sans elle, le massing ne propose aucun volume." });
  });

  /* --- gabarit : rien ne se bâtit au-dessus d'une grande hauteur libre ----- */
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    var p = PMAP[b.key];
    if(!p.hlibre || p.hlibre <= RULES.haut.libre.def) return;
    /* La piscine et le chauffage à distance sont des ouvrages INDÉPENDANTS des
       bâtiments scolaires (art. 2.2) : rien n'est bâti au-dessus d'eux parce
       qu'ils ne portent rien. La règle ne vise que l'enveloppe scolaire. */
    if(p.hors) return;
    var reste = FLOORS[b.fl].plate - aOf(b.key, b.q);
    for(var k = b.fl + 1; k < FLOORS.length; k++){
      if(FLOORS[k].plate > reste + 0.5 && flCount(k)){
        add(severite("gabarit"), p.n + " demande " + dec(p.hlibre)
          + " m de hauteur libre : rien ne se pose dessus. Le " + flName(k).toLowerCase()
          + " ne dispose que des " + fmt(Math.round(Math.max(0, reste)))
          + " m² laissés libres à côté d'elle", "2.10", flName(k), k,
          { code:"gab:" + b.key + ":" + lvlOf(k), keys: [b.key],
            fix: [fixVider(k), fixDeplacer(b.key, FLOORS.length - 1)] });
      }
    }
  });

  /* --- plateau ------------------------------------------------------------ */
  FLOORS.forEach(function(F, k){
    var bati = flBrut(k);
    if(!(F.plate > 0) || bati <= F.plate + 1) return;
    /* La comparaison se fait en surface BÂTIE : dire « 2'168 m² utiles pour un
       plateau de 2'400 m² » donnait deux nombres qui semblaient tenir l'un dans
       l'autre alors qu'il manquait 244 m². La circulation est celle que les
       pièces posées à ce niveau demandent, pas une part forfaitaire. */
    add("w", "Le " + flName(k).toLowerCase() + " demande "
      + fmt(Math.round(bati)) + " m² bâtis, circulation comprise, "
      + "pour un plateau de " + fmt(F.plate) + " m² — il manque "
      + fmt(Math.round(bati - F.plate)) + " m²",
      "plateau", "", k,
      { code:"plate:" + F.lvl,
        fix: [fixPlateau(k, bati), fixEtage()] });
  });

  /* --- sanitaires --------------------------------------------------------- */
  FLOORS.forEach(function(F, k){
    var use = 0, wc = 0;
    BLOCKS.forEach(function(b){
      if(b.fl !== k) return;
      var p = PMAP[b.key];
      /* un niveau purement technique n'appelle pas de sanitaires */
      if(p.f !== "tec") use += b.q;
      if(WCRE.test(p.n)) wc += b.q;
    });
    if(!use || !lu("wc")) return;
    if(!wc) add(severite("wc"), "Aucun WC au " + flName(k).toLowerCase()
      + " : tout niveau occupé doit avoir ses sanitaires", "2.10", "", k,
      { code:"wc:" + F.lvl, fix: fixWC(k) });
  });

  /* --- art. 2.6 : deux cages d'escalier dès 900 m² de surface d'étage ------ */
  FLOORS.forEach(function(F, k){
    var a = flBrut(k);
    /* Deux cages ne se posent pas ici : elles se dessinent à la typologie. Le
       seul geste qui change quelque chose au mixer est d'alléger le niveau. */
    if(a > RULES.feu.cageSeuil) add("w", "Surface d'étage de " + fmt(Math.round(a))
      + " m² au " + flName(k).toLowerCase()
      + " : deux cages d'escalier compartimentées exigées", "2.6", "", k,
      { code:"cage:" + F.lvl,
        note: "Leurs mètres carrés sont déjà comptés dans la circulation du niveau ; "
          + "elles se dessinent à la typologie. Ici, seul alléger le niveau change quelque "
          + "chose — un plateau plus petit, ou une partie du programme montée d\u2019un étage." });
  });

  out.sort(function(a, b){ return (a.sev === "e" ? 0 : 1) - (b.sev === "e" ? 0 : 1); });
  return out;
}

/* Les écarts assumés ne comptent plus au verdict : c'est tout leur sens. Ils
   restent dans la liste, à part, et se reprennent d'un clic. */
export function mixVerdict(list){
  var e = 0, w = 0, ok = 0;
  list.forEach(function(x){
    if(x.ok) ok++;
    else if(x.sev === "e") e++;
    else w++;
  });
  return { e:e, w:w, ok:ok, n:e + w };
}
