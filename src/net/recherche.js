/* ============================================================================
   LA RECHERCHE — « ALGO SEARCH »

   Tirer beaucoup, garder peu. On choisit ce qu'on rebat (le programme, le
   massing, les typologies), combien de fois, ce qu'on accepte de garder et
   combien ; la recherche rejoue les tirages que l'on ferait à la main et
   retient les meilleures NOTES du jugement (`data/jugement.js — noter()`) :
   les générateurs cherchent par l'orientation, le jugement classe ce qu'ils
   ont trouvé.

   Elle ne connaît pas d'autre tirage que les trois boutons : `repartir()`
   pour le programme, `genMass()` pour le massing, la seed des Typologies. Une
   variante trouvée est donc une variante qu'on aurait pu tirer soi-même — et
   elle se rejoue par ses graines. Elle OBÉIT AUX DÉS : ce qui est fixé au
   mixer ou au massing reste fixé, ce qui est libre se rebat — c'est le tirage
   de chaque bouton, et la recherche n'a plus de réglage qui le double.

   Pour un même volume, il y a une bonne et une mauvaise typologie : cochées
   avec le massing, les typologies sont essayées PAR VOLUME, et chaque volume
   garde la meilleure avant d'être comparé aux autres.

   Elle travaille sur l'état VIVANT (les générateurs n'en connaissent pas
   d'autre), et le remet exactement comme il était en sortant : chercher n'est
   pas composer, et l'écran ne doit pas changer sous les yeux.

   Aucun réseau ici : `rechercher()` rend des résultats, `net/variantes.js —
   poserTrouvees()` les enregistre.
   ========================================================================= */
import { curSeed, rng, seed } from "../core/rand.js";
import { repartir } from "../mix/shuffle.js";
import { dePile } from "../mix/opts.js";
import { restore, snapshot } from "../mix/store.js";
import { genMass } from "../mass/gen.js";
import { MASS, empreintePile, massSet, massVols } from "../mass/model.js";
import { evaluationCourante, renoterTypo } from "../mass/mesures.js";
import { TYPO } from "../typo/etat.js";
import { typoVerdict } from "../typo/mesures.js";
import { moyennesMain, resumeCourant } from "./variantes.js";

export var TAG_RECHERCHE = "algo search";

/* Les réglages d'une recherche, et leurs bornes. Ce ne sont pas des lignes :
   ils ne changent aucune variante — ils disent combien on en tire et
   lesquelles on garde. Ils vivent donc ici, le temps d'une session, et non
   dans `data/recherche.js`. */
export var RECH = {
  programme: true,      /* rebattre la répartition du mixer — la pile si son dé est allumé */
  massing: true,        /* rebattre la volumétrie, selon ses leviers */
  typologies: true,     /* rebattre l'ordonnance des pièces dans les volumes */
  parVolume: 5,         /* typologies essayées sur chaque volume tiré */
  essais: 30,
  garder: 3,
  sansErreur: true,     /* écarter ce qui porte une erreur rouge : mixer, massing, typologies */
  distincts: true       /* un seul résultat par parti */
};
export var BORNES = { essais: [1, 500], garder: [1, 20], parVolume: [1, 100] };

function borne(x, b){ return Math.max(b[0], Math.min(b[1], Math.round(+x) || b[0])); }
function pause(){ return new Promise(function(ok){ setTimeout(ok, 0); }); }
function auHasard(){ return ((rng() * 0x100000000) >>> 0) || 1; }
function erreurs(r){
  var v = r.verdict || {};
  return ((v.mass && v.mass.e) || 0) + ((v.mix && v.mix.e) || 0) + ((v.typo && v.typo.e) || 0);
}
/* Meilleure note d'abord ; à note égale, moins d'erreurs. */
function avant(a, b){ return (b.row.score - a.row.score) || (erreurs(a.row) - erreurs(b.row)); }

/* Garder les K meilleurs — et, en « distincts », le meilleur de chaque parti. */
function retenir(top, c, o){
  if(o.distincts){
    var j = top.findIndex(function(t){ return t.pid === c.pid; });
    if(j >= 0){
      if(avant(c, top[j]) >= 0) return;
      top.splice(j, 1);
    }
  }
  top.push(c);
  top.sort(avant);
  if(top.length > o.garder) top.length = o.garder;
}

/* LA MEILLEURE TYPOLOGIE DE CES VOLUMES : `n` seeds, chacune notée sans
   remesurer le massing (`renoterTypo`). Moins d'erreurs rouges d'abord — un
   plan qui ne colle pas la scène à la salle de sport ne passe qu'à défaut —,
   puis la note. La seed retenue reste posée. */
function meilleureTypo(n){
  var ev0 = evaluationCourante();
  if(!ev0) return;
  var moy = moyennesMain(), best = null;
  for(var t = 0; t < n; t++){
    TYPO.graine = auHasard();
    var ev = renoterTypo(ev0, MASS.vol, moy), e = typoVerdict(ev.ecarts).e, s = ev.jugement.typo.total;
    if(!best || e < best.e || (e === best.e && s > best.s)) best = { g:TYPO.graine, e:e, s:s };
  }
  TYPO.graine = best.g;
}

/* `progres(i, n, top)` est appelé après chaque essai ; `arret()` rend vrai
   pour interrompre — ce qui a été trouvé jusque-là est rendu quand même. */
export async function rechercher(opts, progres, arret){
  var o = Object.assign({}, RECH, opts);
  o.essais = borne(o.essais, BORNES.essais);
  o.garder = borne(o.garder, BORNES.garder);
  o.parVolume = borne(o.parVolume, BORNES.parVolume);
  var volume = o.programme || o.massing;
  if(!volume && !o.typologies) throw new Error("Rien à rebattre : coche le programme, le massing ou les typologies.");
  /* Les typologies seules s'essaient dans les volumes à l'écran : il en faut. */
  if(!volume && !MASS.vol.length) throw new Error("Aucune volumétrie à l'écran : coche aussi le massing, ou pose les volumes au Massing.");
  /* Seules, elles ne changent pas de parti : « un seul par parti » n'en garderait qu'une. */
  if(!volume) o.distincts = false;

  var etat = snapshot(), graine0 = curSeed, top = [], vus = 0, i;
  try{
    for(i = 0; i < o.essais; i++){
      if(arret && arret()) break;
      if(volume){
        if(o.programme){
          seed(null);
          repartir({ alea:true, etages: dePile });
        }
        if(o.massing) massSet("graine", auHasard());
        /* Sans massing rebattu, la même graine : la volumétrie suit la pile. */
        massVols(genMass(MASS.graine));
        MASS.pile = empreintePile();
        if(o.typologies) meilleureTypo(o.parVolume);
      } else TYPO.graine = auHasard();
      vus++;

      var row = resumeCourant();
      if(row.score != null && !(o.sansErreur && erreurs(row))){
        /* En « Auto », `MASS.parti` ne dit pas quel parti a été tiré : la
           composition le porte. C'est lui qui distingue et qui nomme. */
        retenir(top, { row: row, state: snapshot(), pid: (MASS.vol && MASS.vol.parti) || MASS.parti }, o);
      }
      if(progres) progres(i + 1, o.essais, top);
      await pause();                    /* laisser respirer l'écran */
    }
  } finally {
    /* Tout remettre : l'état — seed des typologies comprise —, la graine du
       programme, et des volumes vides quand il n'y en avait pas — `setMass`
       ne vide pas ce qu'on lui tait. */
    if(!(etat.mass && etat.mass.vol && etat.mass.vol.length)) massVols([]);
    restore(etat);
    seed(graine0);
  }
  return { trouves: top, essais: vus };
}
