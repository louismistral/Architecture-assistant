/* ============================================================================
   LE CONTRÔLE DE LA VOLUMÉTRIE

   Le contrôle ne juge pas : `juge.js` le fait, et le générateur avec lui. Une
   CONTRAINTE DURE enfreinte est une ERREUR, lue dans `dures()` — le contrôle
   et le générateur disent donc la même chose, avec les mêmes mots. Le reste
   s'avertit.

   Trois niveaux, et la frontière entre eux n'est pas une nuance de ton :

     ERREUR   une règle ÉCRITE — le règlement, l'AEAI — ou une géométrie
              impossible : un corps hors de la parcelle, deux corps qui
              s'interpénètrent, un sous-sol dans la nappe ;
     AVERTIR  une règle de PROJET ou une marge qui se discute : le retrait de
              cinq mètres, la profondeur, la surface qui s'écarte du programme,
              un porte-à-faux ;
     INFO     ce qu'il faut savoir sans avoir à corriger : deux cages
              d'escalier à prévoir, un gradin, un terrassement.

   Chaque écart porte un CODE stable, construit sur l'identité du volume et non
   sur son rang : déplacer un corps ne doit pas renuméroter les écarts des
   autres.
   ========================================================================= */
import { fmt, dec } from "../core/format.js";
import { NAPPE, PER } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { lvlOf } from "../mix/floors.js";
import { DOC } from "../data/doctrine.js";
import { assise, ecart, visAVis } from "./geom.js";
import { lies, rectSol } from "./gen.js";
import { courProgramme, courUtile, dures, terrainLibre } from "./juge.js";
import { isAccepted } from "../mix/accept.js";
import {
  fixAire, fixAplomb, fixCarrer, fixEcarter, fixElargir, fixPile, fixProfondeur,
  fixRecaler, fixRelancer, fixRelier, fixReposerSecond, fixSecond, fixSousSol
} from "./fix.js";
import { MASS, bilan, niveaux, pontRect, porteAFaux, profBornes, secondTemps,
  volHaut } from "./model.js";

function nom(v, k){
  return v.nom || (v.fix ? "Salle de sport double" : "Volume " + (k + 1));
}

var COUR = courProgramme();

/* Pour chaque contrainte dure : l'article, et les gestes qui la réparent. */
var DUR = {
  perim:    { ref:"2.3",      fix:function(i){ return [fixRecaler(i), fixEcarter()]; } },
  existant: { ref:"2.3",      fix:function(i){ return [fixRecaler(i), fixEcarter()]; } },
  dist:     { ref:"AEAI 2.4", fix:function(){ return [fixEcarter()]; } },
  largeur:  { ref:"",         fix:function(i){ return [fixElargir(i, DOC.largeurMin), fixRelancer()]; } },
  prof:     { ref:"",         fix:function(i){ return [fixElargir(i, profBornes().lo), fixRelancer()]; } },
  profmax:  { ref:"2.10",     fix:function(i){ return [fixProfondeur(i), fixRelancer()]; } },
  facade:   { ref:"",         fix:function(i){ return [fixProfondeur(i), fixRelancer()]; } },
  module:   { ref:"",         fix:function(){ return [fixAire()]; } },
  cour:     { ref:"2.10",     fix:function(){ return [fixRelancer(),
    fixSecond("non", "Ne pas représenter le second temps", "il libère le terrain qu’il occupe")]; } },
  nappe:    { ref:"2.3",      fix:function(){ return [fixSousSol(), fixRelancer()]; } },
  abri:     { ref:"",         fix:function(){ return [fixPile()]; } },
  sport:    { ref:"2.10",     fix:function(){ return [fixRelancer()]; } }
};

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
  if(!V.length){
    dit("i", "vide", "Aucun volume posé. « Shuffle massing » en propose un jeu à partir "
      + "de la répartition du mixer.", "", "", -1);
    return out;
  }

  /* --- aucune variante valide --------------------------------------------- */
  if(MASS.vol.impossible){
    dit("e", "tient", "Aucune variante ne respecte toutes les contraintes dures : le "
      + "générateur a essayé les douze partis, de un à sept corps, de "
      + dec(profBornes().lo) + " à " + dec(profBornes().hi) + " m de profondeur, et montre la "
      + "moins fautive. L’aire posable est de " + fmt(Math.round(MASS.vol.posable || 0))
      + " m², recul du PACom déduit. Ajouter un étage au mixer, ou desserrer une contrainte "
      + "dans le volet Contraintes.", "2.3", "", -1, { fix:[fixPile(), fixRelancer()] });
  }

  /* --- LES CONTRAINTES DURES, telles que le juge les lit ------------------ */
  V.ponts = MASS.pont;
  dures(V, false).forEach(function(x){
    var D = DUR[x.k] || { ref:"", fix:function(){ return []; } };
    var v = V[x.v], id = v ? v.id : "", nm = v ? nom(v, x.v) : "";
    if(x.v2 >= 0 && V[x.v2]){ id += "|" + V[x.v2].id; nm += " · " + nom(V[x.v2], x.v2); }
    dit("e", x.k + ":" + id, x.msg, D.ref, nm, x.v, { fix: D.fix(x.v) });
  });

  /* --- les passerelles rompues -------------------------------------------- */
  (MASS.pont || []).forEach(function(p, k){
    if(!pontRect(p, V))
      dit("w", "pont:" + p.a + "|" + p.b, "Une passerelle ne relie plus deux façades qui se "
        + "font face : elle n’est plus dessinée.", "", "", -1, { fix: fixRelier() });
  });

  for(i = 0; i < V.length; i++){
    var v = V[i], rc = rectSol(v), nm = nom(v, i);

    /* --- LE JOUR ENTRE LES CORPS — une priorité, donc un avertissement ----- */
    for(j = i + 1; j < V.length; j++){
      var o = rectSol(V[j]), e = ecart(rc, o), n2 = nom(V[j], j);
      if(e < 0 || v.ph || V[j].ph || lies(v, V[j]) || DOC.ombreK <= 0) continue;
      if(visAVis(rc, o) <= 8) continue;
      var req = Math.max(volHaut(v), volHaut(V[j])) * DOC.ombreK;
      if(req > DOC.distMin && e < req - .05){
        var manque = (req - e) / req;
        dit(manque > .25 ? "w" : "i", "jour:" + v.id + "|" + V[j].id,
          nm + " et " + n2.toLowerCase() + " sont à " + dec(e) + " m pour "
          + dec(req) + " m d'écart utile — " + dec(DOC.ombreK) + " fois la hauteur "
          + "du plus haut. Seuls les " + dec(DOC.distMin) + " m sont dus ; en deçà de "
          + "l’écart utile, les façades qui se font face perdent du jour.", "2.9",
          nm + " · " + n2, i, { fix:[fixEcarter(), fixRelancer()] });
      }
    }

    /* --- l'élancement : un garde-fou secondaire ---------------------------- */
    if(!v.fix && !v.ph){
      var pt = Math.min(rc.w, rc.d), lg = Math.max(rc.w, rc.d);
      if(lg / Math.max(1, pt) > DOC.elanceMax){
        dit("i", "elan:" + v.id, nm + " est " + Math.round(lg / pt) + " fois plus long "
          + "que large — " + dec(lg) + " × " + dec(pt) + " m.", "", nm, i,
          { fix:[fixCarrer(i), fixRelancer()] });
      }
    }

    /* --- porte-à-faux : permis ; averti quand il devient important --------- */
    var pf = porteAFaux(v);
    if(pf > .3){
      dit(pf > DOC.pafMax ? "w" : "i", "pf:" + v.id, "Porte-à-faux sur " + nm.toLowerCase()
        + " — dépassement maximum " + dec(pf) + " m." + (pf > DOC.pafMax ? " Au-delà de "
          + dec(DOC.pafMax) + " m, c’est un porte-à-faux important." : " Il est permis."),
        "", nm, i,
        { fix: fixAplomb(i),
          note:"Le débord qui vient des surfaces ne se défait pas d'un clic : il "
            + "faudrait changer les mètres carrés, et ils sont au règlement." });
    }

    /* --- le terrain -------------------------------------------------------- */
    var as = assise(rc);
    if(as.d > DOC.penteMax){
      dit("w", "pente:" + v.id, nm + " est posé sur " + dec(as.d) + " m de dénivelé : "
        + "terrassement important, ou niveau décroché.", "2.3", nm, i,
        { fix: fixRelancer() });
    } else if(as.d > DOC.penteMax / 2){
      dit("i", "pente:" + v.id, nm + " couvre " + dec(as.d) + " m de dénivelé — "
        + dec(as.lo) + " à " + dec(as.hi) + " m sur mer.", "2.3", nm, i);
    }

    /* --- le sous-sol, quand il tient --------------------------------------- */
    if(v.lv.some(function(x){ return lvlOf(x.i) < 0; })){
      var couv = as.z - NAPPE;
      if(couv >= RULES.dist.couverture - .005)
        dit("i", "nappe:" + v.id, "Sous " + nm.toLowerCase() + ", "
          + dec(couv) + " m de terrain au-dessus de la nappe : le sous-sol tient.",
          "2.3", nm, i);
    }

    /* --- surface d'étage et cages ------------------------------------------ */
    v.lv.forEach(function(x){
      if(x.w * x.d > RULES.feu.cageSeuil){
        dit("i", "cage:" + v.id + ":" + x.i, nm + " fait " + fmt(Math.round(x.w * x.d))
          + " m² au " + (N[x.i] ? N[x.i].nom.toLowerCase() : "niveau " + x.i)
          + " : deux cages d'escalier compartimentées, qui se dessineront à la "
          + "typologie.", "AEAI 3.4", nm, i);
      }
    });
  }

  /* --- LES OUVRAGES DU SECOND TEMPS ------------------------------------- */
  var S2 = secondTemps();
  if(S2.length && MASS.second !== "non"){
    var pose2 = {}, aire2 = {};
    V.forEach(function(v){
      if(!v.ph) return;
      var e2 = v.lv[0];
      (e2.keys || []).forEach(function(k){ pose2[k] = 1; });
      aire2[v.id] = { v:v, pose:e2.w * e2.d, dem:e2.a };
    });
    var manque2 = S2.filter(function(x){ return !pose2[x.key]; });
    if(manque2.length){
      dit("w", "second", manque2.map(function(x){ return x.n; }).join(" et ")
        + " ne trouve" + (manque2.length > 1 ? "nt" : "") + " pas de place : "
        + fmt(Math.round(manque2.reduce(function(a, x){ return a + x.a; }, 0)))
        + " m² à poser à distance de tout, sans entamer la cour. Le second temps reste au "
        + "programme et au bilan ; il n’est simplement pas dessiné.",
        "2.2", manque2[0].n, -1,
        { fix:[fixReposerSecond(),
               fixSecond("un", "Grouper les ouvrages du second temps",
                 "la piscine et le local CAD en un seul volume : une emprise au lieu de deux"),
               fixSecond("sep", "Séparer les deux ouvrages",
                 "deux volumes plus petits trouvent parfois deux places là où un seul n’en trouve aucune"),
               fixRelancer(),
               fixSecond("non", "Ne pas les représenter",
                 "l’implantation ne montre plus que l’école")] });
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

  /* --- la surface, niveau par niveau ------------------------------------- */
  bilan().forEach(function(b){
    var tol = Math.max(5, b.demande * .02);
    if(Math.abs(b.ecart) > tol){
      dit("w", "aire:" + b.i, b.nom + " — surface demandée " + fmt(Math.round(b.demande))
        + " m², surface posée " + fmt(Math.round(b.pose)) + " m², différence "
        + (b.ecart > 0 ? "+" : "−") + fmt(Math.round(Math.abs(b.ecart))) + " m².",
        "2.7", b.nom, -1, { fix: fixAire() });
    }
  });

  /* --- ce qui reste de terrain ------------------------------------------- */
  var tl = terrainLibre(V), posable = tl.posable, libre = tl.libre, besoin = tl.besoin;
  if(libre < besoin){
    dit("w", "terrain", "Il reste " + fmt(Math.round(libre)) + " m² de terrain libre sur les "
      + fmt(Math.round(posable)) + " m² posables : la cour de " + fmt(COUR) + " m² et les "
      + RULES.ext.voitures + " places de parc en demandent environ "
      + fmt(besoin) + ".", "2.4", "", -1,
      { fix:[fixSecond("un", "Grouper les ouvrages du second temps",
               "la piscine et le local CAD en un seul volume : une emprise au lieu de deux"),
             fixSecond("non", "Ne pas représenter le second temps",
               "ils restent au programme et au bilan, mais ne sont plus posés"),
             fixRelancer()] });
  }

  /* --- la cour, quand elle tient ----------------------------------------- */
  var cu = courUtile(V);
  if(cu.a >= DOC.courMin)
    dit("i", "cour", "La cour offre " + fmt(Math.round(cu.a)) + " m² utiles devant "
      + (cu.v >= 0 ? nom(V[cu.v], cu.v).toLowerCase() : "une façade") + " — "
      + fmt(DOC.courMin) + " m² au moins.", "2.10", "", -1);
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
