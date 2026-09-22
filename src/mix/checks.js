/* ============================================================================
   CONTRÔLE D'UNE RÉPARTITION

   Le mixer ne refuse rien : il dit. Deux sévérités, la convention du projet —
     "e"  rouge : une règle écrite au règlement ou à l'AEAI ;
     "w"  ambre : une règle de projet, ou une marge qui se discute.
   Le plateau, la part de circulation et le nombre de niveaux sont des choix de
   projet : leur dépassement est ambre, pas rouge. Une classe en sous-sol, une
   salle de sport à l'étage, une adjacence coupée : rouge.

   Toute valeur chiffrée vient de `src/data/rules.js`. Rien n'est réécrit ici.

   Chaque écart porte deux choses de plus qu'un message : un CODE stable, qui
   permet de l'assumer sans qu'il resurgisse au premier réglage (`accept.js`),
   et le ou les REMÈDES qui le résoudraient (`fix.js`). Dire ce qui ne va pas
   sans dire ce qui le réparerait laisse tout le travail à faire.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { CIRC } from "../core/model.js";
import { DOC } from "../data/doctrine.js";
import { RULES } from "../data/rules.js";
import {
  BLOCKS, FLOORS, TRAY, flCount, flName, flNet, lvlOf, trayArea, trayBlocks, usable
} from "./floors.js";
import { isAccepted } from "./accept.js";
import {
  fixCombler, fixDeplacer, fixPlateau, fixEtage, fixReste, fixVider, fixWC, nivCible
} from "./fix.js";
import { CLSRE, NIV, UNITE, WCRE, nivHit } from "./niv.js";
import { PMAP, PROX, aOf } from "./prog.js";

/* Niveaux occupés par un poste. */
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
  if(tn) add("w", tn + " pièce" + (tn > 1 ? "s" : "") + " encore au bac, soit "
    + fmt(Math.round(trayArea())) + " m² sans niveau", "à placer",
    tb.length ? PMAP[tb[0].key].n : "", null,
    { code:"bac", fix: fixReste(), keys: tb.map(function(b){ return b.key; }) });

  /* --- règles de niveau --------------------------------------------------- */
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY || b.fl >= FLOORS.length) return;
    var p = PMAP[b.key], lv = lvlOf(b.fl);
    NIV.forEach(function(rl){
      if(!nivHit(rl, p)) return;
      var bad = false;
      if(rl.lvl){ if(lv < rl.lvl.min || lv > rl.lvl.max) bad = true; }
      else if(rl.grade){ if(lv !== 0) bad = true; }
      else if(rl.max !== undefined){ if(lv > rl.max || lv < 0) bad = true; }
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
      add(rl.sev, rl.msg, rl.ref, p.n + " au " + flName(b.fl).toLowerCase(), b.fl,
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
    if(p.f === "tec") return;
    add("e", "En sous-sol, seuls les locaux techniques, de stockage et de nettoyage "
      + "se passent de lumière naturelle", "2.10", p.n, b.fl,
      { code:"jour:" + p.key, keys: [p.key], fix: fixDeplacer(p.key, nivCible(p, b.fl)) });
  });
  if(sub) add("w", "Nappe phréatique relevée à " + RULES.site.nappe[1].toFixed(2).replace(".", ",")
    + " m : la marge sous le terrain naturel va de 1,0 m à l'ouest à 4,5 m à l'est — un sous-sol "
    + "excavé demande " + RULES.dist.couverture.toFixed(2).replace(".", ",")
    + " m de couverture, il n'est tenable qu'au tiers est du périmètre", "2.3", "", null,
    { code:"nappe", fix: fixCombler() });

  /* --- adjacences du règlement -------------------------------------------- */
  PROX.forEach(function(l){
    if(l.opt) return;                        /* une mutualisation possible reste possible */
    var A = nivDe(l.a), B = nivDe(l.b);
    if(!A.length || !B.length) return;       /* pas encore posé : rien à dire */
    var d = Infinity;
    A.forEach(function(fa){ B.forEach(function(fb){ d = Math.min(d, Math.abs(fa - fb)); }); });
    if(d === 0) return;
    add(d >= 2 ? "e" : "w",
      PMAP[l.a].n + " et " + PMAP[l.b].n + " sont séparés de "
        + d + " niveau" + (d > 1 ? "x" : "") + " — « " + l.q + " »",
      "adjacences", PMAP[l.a].n, A[0],
      { code:"adj:" + l.a + "|" + l.b, keys: [l.a, l.b],
        fix: [fixDeplacer(l.a, B[0]), fixDeplacer(l.b, A[0])] });
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
        add("e", p.n + " demande " + p.hlibre.toFixed(2).replace(".", ",")
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
    var cap = usable(k), net = flNet(k);
    if(!isFinite(cap) || net <= cap + 1) return;
    /* La comparaison se fait en surface BÂTIE des deux côtés : dire « 2'168 m²
       utiles pour un plateau de 2'400 m² » donnait deux nombres qui semblaient
       tenir l'un dans l'autre alors qu'il manquait 244 m². */
    add("w", "Le " + flName(k).toLowerCase() + " demande "
      + fmt(Math.round(net / (1 - circPart()))) + " m² bâtis, circulation comprise, "
      + "pour un plateau de " + fmt(F.plate) + " m² — il manque "
      + fmt(Math.round((net - cap) / (1 - circPart()))) + " m²",
      "plateau", "", k,
      { code:"plate:" + F.lvl,
        fix: [fixPlateau(k, net / (1 - circPart())), fixEtage()] });
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
    if(!use) return;
    if(!wc) add("w", "Aucun WC au " + flName(k).toLowerCase()
      + " : tout niveau occupé doit avoir ses sanitaires", "2.10", "", k,
      { code:"wc:" + F.lvl, fix: fixWC(k) });
  });

  /* --- l'unité pédagogique -------------------------------------------------
     Un degré tient sur un niveau, avec ses dégagements : au-delà, on fait un
     couloir d'hôpital. Le tirage le respecte, mais il ne refuse rien — quand
     un niveau est plein, le reste des classes se pose quand même au mieux
     noté, et il fallait le DIRE. Le seuil est une règle de projet, il se
     règle dans le volet « Contraintes » du mixer. */
  FLOORS.forEach(function(F, k){
    var n = 0, keys = [];
    BLOCKS.forEach(function(b){
      if(b.fl !== k) return;
      if(!UNITE.test(PMAP[b.key].n)) return;
      n += b.q;
      if(keys.indexOf(b.key) < 0) keys.push(b.key);
    });
    var max = Math.max(1, Math.round(DOC.clsParNiveau));
    if(n <= max) return;
    add("w", n + " salles de classe au " + flName(k).toLowerCase()
      + ", où l'unité pédagogique retenue en compte " + max
      + " au plus : au-delà, le dégagement devient un couloir d'hôpital",
      "projet", "", k,
      { code:"unite:" + F.lvl, keys: keys, fix: fixEtage(),
        note: "Aucun article ne l’écrit : c’est une règle de projet, et elle se "
          + "règle dans le volet « Contraintes »." });
  });

  /* --- art. 2.6 : deux cages d'escalier dès 900 m² de surface d'étage ------ */
  FLOORS.forEach(function(F, k){
    var a = flNet(k) / (1 - circPart());
    /* Deux cages ne se posent pas ici : elles se dessinent à la typologie. Le
       seul geste qui change quelque chose au mixer est d'alléger le niveau. */
    if(a > RULES.feu.cageSeuil) add("w", "Surface d'étage de " + fmt(Math.round(a))
      + " m² au " + flName(k).toLowerCase()
      + " : deux cages d'escalier compartimentées exigées", "2.6", "", k,
      { code:"cage:" + F.lvl,
        note: "Deux cages ne se posent pas dans le mixer : elles se dessinent à la "
          + "typologie. Ici, seul alléger le niveau change quelque chose — un plateau "
          + "plus petit, ou une partie du programme montée d\u2019un étage." });
  });

  /* --- un niveau vide sous un niveau chargé ------------------------------- */
  for(i = 0; i < FLOORS.length - 1; i++){
    if(flCount(i) === 0 && flCount(i + 1) > 0){
      add("w", "Le " + flName(i).toLowerCase() + " est vide alors que le "
        + flName(i + 1).toLowerCase() + " porte " + flCount(i + 1)
        + " pièces — cela ne se construit pas", "pile", "", i,
        { code:"vide:" + lvlOf(i), fix: (i === 0 && lvlOf(0) < 0) ? fixCombler() : fixReste() });
    }
  }

  out.sort(function(a, b){ return (a.sev === "e" ? 0 : 1) - (b.sev === "e" ? 0 : 1); });
  return out;
}

/* La part de circulation est relue à chaque appel : elle se règle dans l'onglet
   Programme et le contrôle doit suivre sans être rechargé. */
function circPart(){ return CIRC; }

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
