/* ============================================================================
   CONTRÔLE D'UNE RÉPARTITION

   Le mixer ne refuse rien : il dit. Deux sévérités, la convention du projet —
     "e"  rouge : une règle écrite au règlement ou à l'AEAI ;
     "w"  ambre : une règle de projet, ou une marge qui se discute.
   Le plateau, la part de circulation et le nombre de niveaux sont des choix de
   projet : leur dépassement est ambre, pas rouge. Une classe en sous-sol, une
   salle de sport à l'étage, une adjacence coupée : rouge.

   Toute valeur chiffrée vient de `src/data/rules.js`. Rien n'est réécrit ici.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { CIRC } from "../core/model.js";
import { RULES } from "../data/rules.js";
import {
  BLOCKS, FLOORS, TRAY, flCount, flName, flNet, lvlOf, trayArea, trayBlocks, usable
} from "./floors.js";
import { NIV, WCRE, nivHit } from "./niv.js";
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
  function add(sev, msg, ref, ex, fl){
    var k = sev + "|" + msg;
    if(seen[k]){ seen[k].n++; return seen[k]; }
    seen[k] = { sev:sev, msg:msg, ref:ref, ex:ex || "", fl:(fl === undefined ? null : fl), n:1 };
    out.push(seen[k]);
    return seen[k];
  }

  /* --- ce qui n'est pas encore posé ------------------------------------- */
  var tb = trayBlocks(), tn = 0;
  tb.forEach(function(b){ tn += b.q; });
  if(tn) add("w", tn + " pièce" + (tn > 1 ? "s" : "") + " encore au bac, soit "
    + fmt(Math.round(trayArea())) + " m² sans niveau", "à placer",
    tb.length ? PMAP[tb[0].key].n : "");

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
      if(bad) add(rl.sev, rl.msg, rl.ref, p.n + " au " + flName(b.fl).toLowerCase(), b.fl);
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
      + "se passent de lumière naturelle", "2.10", p.n, b.fl);
  });
  if(sub) add("w", "Nappe phréatique relevée à " + RULES.site.nappe[1].toFixed(2).replace(".", ",")
    + " m : la marge sous le terrain naturel va de 1,0 m à l'ouest à 4,5 m à l'est — un sous-sol "
    + "excavé demande " + RULES.dist.couverture.toFixed(2).replace(".", ",")
    + " m de couverture, il n'est tenable qu'au tiers est du périmètre", "2.3", "");

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
      "adjacences", PMAP[l.a].n);
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
          + " m² laissés libres à côté d'elle", "2.10", flName(k), k);
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
      "plateau", "", k);
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
      + " : tout niveau occupé doit avoir ses sanitaires", "2.10", "", k);
  });

  /* --- art. 2.6 : deux cages d'escalier dès 900 m² de surface d'étage ------ */
  FLOORS.forEach(function(F, k){
    var a = flNet(k) / (1 - circPart());
    if(a > RULES.feu.cageSeuil) add("w", "Surface d'étage de " + fmt(Math.round(a))
      + " m² au " + flName(k).toLowerCase()
      + " : deux cages d'escalier compartimentées exigées", "2.6", "", k);
  });

  /* --- un niveau vide sous un niveau chargé ------------------------------- */
  for(i = 0; i < FLOORS.length - 1; i++){
    if(flCount(i) === 0 && flCount(i + 1) > 0){
      add("w", "Le " + flName(i).toLowerCase() + " est vide alors que le "
        + flName(i + 1).toLowerCase() + " porte " + flCount(i + 1)
        + " pièces — cela ne se construit pas", "pile", "", i);
    }
  }

  out.sort(function(a, b){ return (a.sev === "e" ? 0 : 1) - (b.sev === "e" ? 0 : 1); });
  return out;
}

/* La part de circulation est relue à chaque appel : elle se règle dans l'onglet
   Programme et le contrôle doit suivre sans être rechargé. */
function circPart(){ return CIRC; }

export function mixVerdict(list){
  var e = 0, w = 0;
  list.forEach(function(x){ if(x.sev === "e") e++; else w++; });
  return { e:e, w:w, n:list.length };
}
