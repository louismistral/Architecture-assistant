/* ============================================================================
   LE CONTRÔLE DE LA VOLUMÉTRIE

   Comme le mixer, le massing ne refuse rien. On doit pouvoir poser un corps à
   cheval sur la limite pour VOIR ce que ça donne, et décider ensuite. Le
   contrôle ne bloque donc jamais : il dit, et il chiffre.

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
import { assise, ecart, ecartPoly, margeAu } from "./geom.js";
import { obstacles, rectSol } from "./gen.js";
import { MASS, bilan, niveaux } from "./model.js";

function nom(v, k){ return v.fix ? "Salle de sport double" : "Volume " + (k + 1); }

export function massCheck(){
  var out = [], V = MASS.vol, N = niveaux(), OB = obstacles(), i, j;
  function dit(sev, code, msg, ref, ex, vol){
    out.push({ sev:sev, code:code, msg:msg, ref:ref || "", ex:ex || "", vol:vol == null ? -1 : vol });
  }
  if(!V.length){
    dit("i", "vide", "Aucun volume posé. « Shuffle massing » en propose un jeu à partir "
      + "de la répartition du mixer.", "", "", -1);
    return out;
  }

  for(i = 0; i < V.length; i++){
    var v = V[i], rc = rectSol(v), nm = nom(v, i);

    /* --- la parcelle ---------------------------------------------------- */
    var m = margeAu(PER, rc);
    if(m < 0){
      dit("e", "hors:" + v.id, nm + " sort du périmètre du concours de "
        + dec(-m) + " m.", "2.3", nm, i);
    } else if(m < RULES.dist.retrait - .05){
      dit("w", "recul:" + v.id, nm + " est à " + dec(m) + " m de la limite : le recul "
        + "de travail est de " + RULES.dist.retrait + " m. La zone A ne fixe aucune "
        + "distance aux limites — c'est une règle de projet, faute d'alignement "
        + "routier numérisé.", "2.3", nm, i);
    }

    /* --- l'existant ------------------------------------------------------ */
    for(j = 0; j < OB.length; j++){
      var eb = ecartPoly(rc, OB[j]);
      if(eb < 0){
        dit("e", "choc:" + v.id, nm + " recouvre un bâtiment existant.", "2.3", nm, i);
        break;
      }
      if(eb < RULES.dist.entre){
        dit("e", "aeai:" + v.id + ":ex", nm + " est à " + dec(eb) + " m d'un bâtiment "
          + "existant : l'AEAI en demande " + RULES.dist.entre + ".", "AEAI 2.4", nm, i);
        break;
      }
    }

    /* --- les uns par rapport aux autres ---------------------------------- */
    for(j = i + 1; j < V.length; j++){
      var e = ecart(rc, rectSol(V[j])), n2 = nom(V[j], j);
      if(e < 0){
        dit("e", "sur:" + v.id + "|" + V[j].id, nm + " et " + n2.toLowerCase()
          + " s'interpénètrent sur " + dec(-e) + " m.", "", nm + " · " + n2, i);
      } else if(e < RULES.dist.entre - .05){
        dit("e", "aeai:" + v.id + "|" + V[j].id, nm + " et " + n2.toLowerCase()
          + " sont à " + dec(e) + " m : l'AEAI demande " + RULES.dist.entre
          + " m entre bâtiments.", "AEAI 2.4", nm + " · " + n2, i);
      } else if(e < RULES.dist.entre + 1.5){
        dit("i", "serre:" + v.id + "|" + V[j].id, nm + " et " + n2.toLowerCase()
          + " sont à " + dec(e) + " m : la distance incendie est tenue de justesse.",
          "AEAI 2.4", nm + " · " + n2, i);
      }
    }

    /* --- proportions ------------------------------------------------------ */
    if(!v.fix){
      var pt = Math.min(rc.w, rc.d), lg = Math.max(rc.w, rc.d);
      if(rc.d > MASS.par.prof + .5){
        dit("w", "prof:" + v.id, nm + " a " + dec(rc.d) + " m de profondeur, au-delà des "
          + dec(MASS.par.prof) + " m retenus : les locaux du milieu perdent le jour.",
          "2.9", nm, i);
      }
      if(pt < 9){
        dit("w", "etroit:" + v.id, nm + " ne fait que " + dec(pt) + " m de large : "
          + "une salle de classe en demande neuf avec son couloir.", "", nm, i);
      }
      if(lg / Math.max(1, pt) > 9){
        dit("w", "elan:" + v.id, nm + " est " + Math.round(lg / pt) + " fois plus long "
          + "que large — " + dec(lg) + " × " + dec(pt) + " m.", "2.9", nm, i);
      }
    }

    /* --- porte-à-faux ------------------------------------------------------
       Autorisé, et c'est voulu : un étage peut dépasser. Mais il se paie en
       structure, et il doit se voir. */
    var pf = porteAFaux(v);
    if(pf > .3){
      dit(pf > 3 ? "w" : "i", "pf:" + v.id, "Porte-à-faux sur " + nm.toLowerCase()
        + " — dépassement maximum " + dec(pf) + " m.", "", nm, i);
    }

    /* --- le terrain -------------------------------------------------------- */
    var as = assise(rc);
    if(as.d > 2){
      dit("w", "pente:" + v.id, nm + " est posé sur " + dec(as.d) + " m de dénivelé : "
        + "il faudra terrasser, ou décrocher le niveau.", "2.3", nm, i);
    } else if(as.d > 1){
      dit("i", "pente:" + v.id, nm + " couvre " + dec(as.d) + " m de dénivelé — "
        + dec(as.lo) + " à " + dec(as.hi) + " m sur mer.", "2.3", nm, i);
    }

    /* --- le sous-sol et la nappe -------------------------------------------
       La COUVERTURE est la terre qui sépare le terrain de la nappe, et non le
       radier de la nappe : c'est la lecture du règlement, et celle de tout le
       reste du projet. Le terrain monte de 463,3 m à l'ouest à 466,7 m à l'est,
       la nappe est à 462,25 — un sous-sol n'est donc tenable qu'au tiers est. */
    var bas = 0;
    v.lv.forEach(function(x){ if(lvlOf(x.i) < 0) bas++; });
    if(bas){
      var couv = as.z - NAPPE;
      if(couv < RULES.dist.couverture){
        dit("e", "nappe:" + v.id, "Sous " + nm.toLowerCase() + ", le terrain est à "
          + dec(as.z) + " m et la nappe à " + dec(NAPPE) + " : "
          + dec(couv) + " m de couverture, où le règlement en demande "
          + dec(RULES.dist.couverture) + ". Un sous-sol excavé n'est tenable "
          + "qu'au tiers est du site.", "2.3", nm, i);
      } else {
        dit("i", "nappe:" + v.id, "Sous " + nm.toLowerCase() + ", "
          + dec(couv) + " m de couverture sur la nappe : le sous-sol tient.",
          "2.3", nm, i);
      }
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

  /* --- la surface, niveau par niveau -------------------------------------
     La question que le massing doit savoir répondre à tout moment. Une
     différence n'est pas une faute : c'est un chiffre, et on le donne. */
  bilan().forEach(function(b){
    var tol = Math.max(5, b.demande * .02);
    if(Math.abs(b.ecart) > tol){
      dit("w", "aire:" + b.i, b.nom + " — surface demandée " + fmt(Math.round(b.demande))
        + " m², surface posée " + fmt(Math.round(b.pose)) + " m², différence "
        + (b.ecart > 0 ? "+" : "−") + fmt(Math.round(Math.abs(b.ecart))) + " m².",
        "2.7", b.nom, -1);
    }
  });

  /* --- ce qui reste de terrain ------------------------------------------- */
  var emp = 0;
  MASS.vol.forEach(function(v){ var r = rectSol(v); emp += r.w * r.d; });
  var libre = 12783 - emp;
  var besoin = 500 + 70 * 25;     /* cour au règlement + 70 places de parc */
  if(libre < besoin){
    dit("w", "terrain", "Il reste " + fmt(Math.round(libre)) + " m² de terrain libre : la "
      + "cour de 500 m² et les 70 places de parc en demandent environ "
      + fmt(besoin) + ".", "2.4", "", -1);
  }
  return out;
}

/* Le dépassement d'un étage sur celui du dessous, mesuré dans le repère du
   volume : c'est la seule mesure qui a un sens pour une structure. */
export function porteAFaux(v){
  var max = 0, i;
  /* Hors sol SEULEMENT. Un rez plus large que son sous-sol n'est pas un
     porte-à-faux : le terrain le porte. Compter la marche entre le sous-sol et
     le rez annonçait trente mètres de dépassement sur des volumes qui n'en
     avaient aucun. */
  var lv = v.lv.filter(function(x){ return lvlOf(x.i) >= 0; })
               .sort(function(a, b){ return a.i - b.i; });
  for(i = 1; i < lv.length; i++){
    var bas = lv[i - 1], h = lv[i];
    var dx = (h.dx || 0) - (bas.dx || 0), dy = (h.dy || 0) - (bas.dy || 0);
    var ox = Math.abs(dx) + (h.w - bas.w) / 2;
    var oy = Math.abs(dy) + (h.d - bas.d) / 2;
    max = Math.max(max, ox, oy);
  }
  return max;
}

export function massVerdict(list){
  var e = 0, w = 0, n = 0;
  (list || []).forEach(function(x){
    if(x.sev === "e") e++;
    else if(x.sev === "w") w++;
    else n++;
  });
  return { e:e, w:w, i:n, sev: e ? "e" : w ? "w" : "ok" };
}
