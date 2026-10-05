/* ============================================================================
   LE CONTRÔLE DE LA VOLUMÉTRIE

   Le contrôle ne note pas : le jugement le fait (`data/jugement.js`). Il dit
   les ÉCARTS AU CADRE, lus dans `mesures.js — ecarts()` — le contrôle et le
   générateur disent donc la même chose, avec les mêmes mots. C'est le canal
   par lequel une composition retouchée à la main, ou chargée d'une variante
   que le cadre a depuis rendue invalide, apprend ce qui cloche. Le reste
   s'avertit.

   Trois niveaux, et la frontière entre eux n'est pas une nuance de ton :

     ERREUR   le cadre OPPOSABLE (Intangible) — le règlement, l'AEAI, le
              programme : un corps hors de la parcelle, deux corps trop près ;
              la variante est invalide ;
     AVERTIR  le cadre CHOISI (Imposé) et les orientations qui se lisent mal :
              le recul, la profondeur de façade, le jour entre corps ;
     INFO     ce qu'il faut savoir sans avoir à corriger : deux cages
              d'escalier à prévoir, un terrassement. Une ligne éteinte ne dit
              plus rien ; une ligne Indicative, si.

   Chaque écart porte un CODE stable, construit sur l'identité du volume et non
   sur son rang : déplacer un corps ne doit pas renuméroter les écarts des
   autres.
   ========================================================================= */
import { fmt, dec } from "../core/format.js";
import { NAPPE, PER } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { lvlOf } from "../mix/floors.js";
/* `V` est ici la liste des volumes, comme partout dans ce fichier : les
   valeurs vivantes s'appellent donc `VAL`. */
import { V as VAL, courExigee, lu } from "../data/cadre.js";
import "../data/orientation.js";
import { ecartSols, lies } from "./gen.js";
import { courProgramme, courUtile, ecarts, terrainLibre } from "./mesures.js";
import { isAccepted } from "../mix/accept.js";
import { adjRompues } from "../mix/checks.js";
import {
  fixAire, fixAuto, fixCarrer, fixEcarter, fixPile, fixProfondeur,
  fixRecaler, fixRelancer, fixRelier, fixReposerSecond, fixSecond, fixSousSol
} from "./fix.js";
import { MASS, aireEtage, assiseEff, niveaux, pontRect, profBornes, secondTemps, solRects,
  volHaut, volTitre as nom } from "./model.js";

var COUR = courProgramme();

/* Pour chaque ligne du cadre : l'article, et les gestes qui la réparent. Une
   ligne d'orientation passée en Imposé n'a pas de geste à elle : on relance. */
function courFix(){ return [fixRelancer(),
  fixSecond("un", "Grouper les ouvrages du second temps", "une emprise au lieu de deux")]; }
var DUR = {
  perimetre:{ ref:"2.3",      fix:function(i){ return [fixRecaler(i), fixEcarter()]; } },
  recul:    { ref:"projet",   fix:function(i){ return [fixRecaler(i), fixEcarter()]; } },
  existant: { ref:"2.3",      fix:function(i){ return [fixRecaler(i), fixEcarter()]; } },
  dist:     { ref:"AEAI 15-15", fix:function(){ return [fixEcarter()]; } },
  facade:   { ref:"",         fix:function(i){ return [fixProfondeur(i), fixRelancer()]; } },
  module:   { ref:"",         fix:function(){ return [fixAire()]; } },
  surfaces: { ref:"2.7",      fix:function(){ return [fixAire()]; } },
  "cour-prog": { ref:"2.10",  fix:courFix },
  cour:     { ref:"projet",   fix:courFix },
  abri:     { ref:"",         fix:function(){ return [fixPile()]; } },
  sport:    { ref:"2.10",     fix:function(){ return [fixRelancer()]; } }
};

/* CE QUI A FAIT ÉCHOUER LES ESSAIS, en mots, les trois premières causes. */
var CAUSES = {
  parti:"la figure du parti ne s’est pas composée", perimetre:"un corps sortait du périmètre",
  recul:"un corps empiétait sur le recul", existant:"un corps touchait l’existant",
  dist:"deux corps trop proches (distance incendie)", facade:"des classes trop loin de la façade (corps trop profonds)",
  module:"les surfaces ne tombaient pas au module", surfaces:"le programme ne tenait pas dans les corps",
  cour:"la cour n’avait pas sa surface", "cour-prog":"la cour n’avait pas sa surface",
  abri:"l’abri PC n’était pas au sous-sol", sport:"la salle de sport ne trouvait pas de place"
};
function pourquoi(E){
  var k = Object.keys(E || {}), n = 0;
  k.forEach(function(x){ n += E[x]; });
  if(!n) return "";
  k.sort(function(a, b){ return E[b] - E[a]; });
  return " Sur " + n + " essais, l’échec venait de : " + k.slice(0, 3).map(function(x){
    return (CAUSES[x] || x) + " (" + Math.round(100 * E[x] / n) + " %)";
  }).join(", ") + ".";
}

export function massCheck(){
  var out = [], V = MASS.vol, N = niveaux(), i, j;
  /* Le CODE est préfixé « m: » : les écarts assumés du mixer et ceux du massing
     vivent dans la même liste, mais un code de niveau et un code de volume ne
     doivent jamais se rencontrer. `more` porte les REMÈDES. */
  function dit(sev, code, msg, ref, ex, vol, more){
    var o = more || {}, c = "m:" + code;
    var fx = (o.fix == null) ? [] : (o.fix.length === undefined ? [o.fix] : o.fix);
    out.push({ sev:sev, code:c, msg:msg, ref:ref || "", ex:ex || "",
               vol: vol == null ? -1 : vol, note: o.note || "",
               fixes: fx.filter(function(f){ return !!f; }),
               ok: isAccepted(c) });
  }
  /* --- aucune variante valide : rien n'est proposé ------------------------ */
  if(!V.length && V.impossible){
    dit("e", "tient", "Aucune composition ne tient dans le cadre avec le "
      + "parti « " + (V.parti || MASS.parti) + " » — aucune n’est donc proposée. Le générateur "
      + "a tout essayé, de " + dec(profBornes().lo) + " à " + dec(profBornes().hi) + " m de "
      + "profondeur ; l’aire posable est de " + fmt(Math.round(V.posable || 0)) + " m², recul "
      + "du PACom déduit. Essayer un autre parti, rejouer, ajouter un étage au mixer, ou "
      + "assouplir une ligne du cadre choisi dans Paramètres & contraintes."
      + (V.raison ? " En cause, et cela se règle au mixer : " + V.raison : "")
      + pourquoi(V.echecs), "2.3", "", -1,
      { fix:[fixAuto(), fixRelancer(), fixPile()] });
    return out;
  }
  if(V.piecesIgnorees)
    dit("w", "pieces", "Les cotes des pièces fixées au mixer demandaient des corps de "
      + dec(V.piecesIgnorees) + " m de profondeur intérieure, plus que le cadre n’en admet "
      + "(classes en façade, profondeur des corps) ou qu’aucune composition ne tient : la volumétrie "
      + "a pris " + dec(V.prof || 0) + " m, et les Typologies ajusteront les pièces. "
      + "Pour la tenir : des pièces moins profondes au mixer, ou assouplir le cadre.", "", "", -1);
  if(!V.length){
    var AR = adjRompues();
    if(AR.length){
      dit("e", "adj", AR.length + " adjacence" + (AR.length > 1 ? "s exigées rompues" : " exigée rompue")
        + " au mixer — « " + AR[0].l.q + " » : aucun volume ne se propose sur une répartition "
        + "qui n’est pas valide. Rétablir l’adjacence au mixer.", "2.10", "", -1);
      return out;
    }
    dit("i", "vide", "Aucun volume posé. « Shuffle massing » en propose un jeu à partir "
      + "de la répartition du mixer.", "", "", -1);
    return out;
  }

  /* --- LE CADRE, tel que le générateur le lit ----------------------------- */
  V.ponts = MASS.pont;
  ecarts(V, false).forEach(function(x){
    var D = DUR[x.k] || { ref:"", fix:function(){ return [fixRelancer()]; } };
    var v = V[x.v], id = v ? v.id : "", nm = v ? nom(v, x.v) : "";
    if(x.v2 >= 0 && V[x.v2]){ id += "|" + V[x.v2].id; nm += " · " + nom(V[x.v2], x.v2); }
    dit(x.sev, x.k + ":" + (x.c != null ? x.c : id), x.msg, D.ref, nm, x.v, { fix: D.fix(x.v) });
  });

  /* --- les passerelles rompues -------------------------------------------- */
  (MASS.pont || []).forEach(function(p, k){
    if(!pontRect(p, V))
      dit("w", "pont:" + p.a + "|" + p.b, "Une passerelle ne relie plus deux façades qui se "
        + "font face : elle n’est plus dessinée.", "", "", -1, { fix: fixRelier() });
  });

  for(i = 0; i < V.length; i++){
    var v = V[i], nm = nom(v, i);

    /* --- LE JOUR ENTRE LES CORPS — une orientation, donc un avertissement -- */
    for(j = i + 1; j < V.length && lu("jour"); j++){
      var es = ecartSols(v, V[j]), e = es.e, n2 = nom(V[j], j);
      if(e < 0 || v.ph || V[j].ph || lies(v, V[j]) || VAL.ombreK <= 0) continue;
      if(es.vis <= 8) continue;
      var req = Math.max(volHaut(v), volHaut(V[j])) * VAL.ombreK;
      if(req > RULES.dist.entre && e < req - .05){
        var manque = (req - e) / req;
        dit(manque > .25 ? "w" : "i", "jour:" + v.id + "|" + V[j].id,
          nm + " et " + n2.toLowerCase() + " sont à " + dec(e) + " m pour "
          + dec(req) + " m d'écart utile — " + dec(VAL.ombreK) + " fois la hauteur "
          + "du plus haut. Seuls les " + dec(RULES.dist.entre) + " m de la distance incendie sont dus ; en deçà de "
          + "l’écart utile, les façades qui se font face perdent du jour.", "2.9",
          nm + " · " + n2, i, { fix:[fixEcarter(), fixRelancer()] });
      }
    }

    /* --- l'élancement : un garde-fou secondaire ---------------------------- */
    if(!v.fix && !v.ph && lu("elan")){
      /* l'aile la plus élancée d'un volume fusionné */
      var pt = 1, lg = 0;
      solRects(v).forEach(function(r){
        if(Math.max(r.w, r.d) / Math.max(1, Math.min(r.w, r.d)) > lg / Math.max(1, pt)){
          pt = Math.min(r.w, r.d); lg = Math.max(r.w, r.d); }
      });
      if(lg / Math.max(1, pt) > VAL.elanceMax){
        dit("i", "elan:" + v.id, nm + " est " + Math.round(lg / pt) + " fois plus long "
          + "que large — " + dec(lg) + " × " + dec(pt) + " m.", "", nm, i,
          { fix:[fixCarrer(i), fixRelancer()] });
      }
    }

    /* --- le terrain -------------------------------------------------------- */
    var as = assiseEff(v);
    if(!lu("pente")){ /* éteinte : rien à dire du terrassement */ }
    else if(as.d > VAL.penteMax){
      dit("w", "pente:" + v.id, nm + " est posé sur " + dec(as.d) + " m de dénivelé : "
        + "terrassement important, ou niveau décroché.", "2.3", nm, i,
        { fix: fixRelancer() });
    } else if(as.d > VAL.penteMax / 2){
      dit("i", "pente:" + v.id, nm + " couvre " + dec(as.d) + " m de dénivelé — "
        + dec(as.lo) + " à " + dec(as.hi) + " m sur mer.", "2.3", nm, i);
    }

    /* --- le sous-sol, quand il tient --------------------------------------- */
    if(lu("nappe") && v.lv.some(function(x){ return lvlOf(x.i) < 0; })){
      var couv = as.terrain - NAPPE;
      if(couv >= RULES.dist.couverture - .005)
        dit("i", "nappe:" + v.id, "Sous " + nm.toLowerCase() + ", "
          + dec(couv) + " m de terrain au-dessus de la nappe : le sous-sol tient.",
          "2.3", nm, i);
      else
        dit("w", "nappe:" + v.id, "Sous " + nm.toLowerCase() + ", " + dec(couv)
          + " m de terrain au-dessus de la nappe (" + dec(NAPPE) + " m), pour "
          + dec(RULES.dist.couverture) + " m souhaités. Un sous-sol excavé n’est tenable "
          + "qu’au tiers est du site.", "2.3", nm, i, { fix:[fixSousSol(), fixRelancer()] });
    }

    /* --- surface d'étage et cages ------------------------------------------ */
    v.lv.forEach(function(x){
      if(aireEtage(x) > RULES.feu.cageSeuil){
        dit("i", "cage:" + v.id + ":" + x.i, nm + " fait " + fmt(Math.round(aireEtage(x)))
          + " m² au " + (N[x.i] ? N[x.i].nom.toLowerCase() : "niveau " + x.i)
          + " : deux cages d'escalier compartimentées, qui se dessineront à la "
          + "typologie.", "AEAI 3.4", nm, i);
      }
    });
  }

  /* --- LES OUVRAGES DU SECOND TEMPS ------------------------------------- */
  var S2 = secondTemps();
  if(S2.length){
    var pose2 = {}, aire2 = {};
    V.forEach(function(v){
      if(!v.ph) return;
      var e2 = v.lv[0];
      (e2.keys || []).forEach(function(k){ pose2[k] = 1; });
      aire2[v.id] = { v:v, pose:e2.w * e2.d, dem:e2.a };
    });
    var manque2 = S2.filter(function(x){ return !pose2[x.key]; });
    if(manque2.length){
      dit("e", "second", manque2.map(function(x){ return x.n; }).join(" et ")
        + " ne trouve" + (manque2.length > 1 ? "nt" : "") + " pas de place : "
        + fmt(Math.round(manque2.reduce(function(a, x){ return a + x.a; }, 0)))
        + " m² à poser à distance de tout, sans entamer la cour. La piscine et le local CAD "
        + "doivent figurer dans toute variante.",
        "2.2", manque2[0].n, -1,
        { fix:[fixReposerSecond(),
               fixSecond("un", "Grouper les ouvrages du second temps",
                 "la piscine et le local CAD en un seul volume : une emprise au lieu de deux"),
               fixSecond("sep", "Séparer les deux ouvrages",
                 "deux volumes plus petits trouvent parfois deux places là où un seul n’en trouve aucune"),
               fixRelancer()] });
    }
    var id2;
    for(id2 in aire2){
      var q2 = aire2[id2];
      if(Math.abs(q2.pose - q2.dem) > Math.max(10, q2.dem * .03)){
        dit("w", "aire2:" + id2, (q2.v.nom || "L’ouvrage du second temps")
          + " fait " + fmt(Math.round(q2.pose)) + " m² pour "
          + fmt(Math.round(q2.dem)) + " m² au programme.", "2.2", q2.v.nom || "", -1,
          { fix: fixReposerSecond() });
      }
    }
  }

  /* La surface, niveau par niveau, est au cadre (`surfaces`) : elle est lue
     plus haut, avec les autres écarts. */

  /* --- ce qui reste de terrain ------------------------------------------- */
  var tl = terrainLibre(V), posable = tl.posable, libre = tl.libre, besoin = tl.besoin;
  if(lu("terrain") && libre < besoin){
    dit("w", "terrain", "Il reste " + fmt(Math.round(libre)) + " m² de terrain libre sur les "
      + fmt(Math.round(posable)) + " m² posables : la cour de " + fmt(COUR) + " m² et les "
      + RULES.ext.voitures + " places de parc en demandent environ "
      + fmt(besoin) + ".", "2.4", "", -1,
      { fix:[fixSecond("un", "Grouper les ouvrages du second temps",
               "la piscine et le local CAD en un seul volume : une emprise au lieu de deux"),
             fixRelancer()] });
  }

  /* --- la cour, quand elle tient ----------------------------------------- */
  var cu = courUtile(V), cm = courExigee();
  if(cu.a >= cm)
    dit("i", "cour", "La cour offre " + fmt(Math.round(cu.a)) + " m² utiles devant "
      + (cu.v >= 0 ? nom(V[cu.v], cu.v).toLowerCase() : "une façade") + " — "
      + fmt(cm) + " m² au moins.", "2.10", "", -1);
  return out;
}

export function massVerdict(list){
  var e = 0, w = 0, n = 0, ok = 0;
  (list || []).forEach(function(x){
    if(x.ok) ok++;
    else if(x.sev === "e") e++;
    else if(x.sev === "w") w++;
    else n++;
  });
  return { e:e, w:w, i:n, ok:ok, sev: e ? "e" : w ? "w" : "ok" };
}
