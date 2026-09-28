/* ============================================================================
   LA RECHERCHE — « ALGO SEARCH »

   Tirer beaucoup, garder peu. On choisit ce qu'on rebat (le programme, le
   massing, ou les deux), combien de fois, ce qu'on accepte de garder et
   combien ; la recherche rejoue les tirages que l'on ferait à la main et
   retient les meilleures NOTES du juge (`mass/juge.js — noter()`).

   Elle ne connaît pas d'autre tirage que les deux boutons : `repartir()` pour
   le programme, `genMass()` pour le massing. Une variante trouvée est donc une
   variante qu'on aurait pu tirer soi-même — et elle se rejoue par ses graines.

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
import { resumeCourant } from "./variantes.js";

export var TAG_RECHERCHE = "algo search";

/* Les réglages d'une recherche, et leurs bornes. Ce ne sont pas des décisions
   de projet — ils disent comment on cherche, pas ce qu'on bâtit : ils vivent
   donc ici, et non dans `doctrine.js`. */
export var RECH = {
  programme: true,      /* rebattre la répartition du mixer, pile comprise */
  massing: true,        /* rebattre la volumétrie */
  partis: [],           /* [] = le parti à l'écran ; sinon, on tourne sur la liste */
  essais: 30,
  garder: 3,
  sansErreur: true,     /* écarter ce qui porte une erreur rouge, mixer ou massing */
  distincts: true       /* un seul résultat par parti */
};
export var BORNES = { essais: [1, 500], garder: [1, 20] };

function borne(x, b){ return Math.max(b[0], Math.min(b[1], Math.round(+x) || b[0])); }
function pause(){ return new Promise(function(ok){ setTimeout(ok, 0); }); }
function erreurs(r){
  var v = r.verdict || {};
  return ((v.mass && v.mass.e) || 0) + ((v.mix && v.mix.e) || 0);
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

/* `progres(i, n, top)` est appelé après chaque essai ; `arret()` rend vrai
   pour interrompre — ce qui a été trouvé jusque-là est rendu quand même. */
export async function rechercher(opts, progres, arret){
  var o = Object.assign({}, RECH, opts);
  o.essais = borne(o.essais, BORNES.essais);
  o.garder = borne(o.garder, BORNES.garder);
  if(!o.programme && !o.massing) throw new Error("Rien à rebattre : coche le programme, le massing, ou les deux.");

  var etat = snapshot(), graine0 = curSeed, top = [], vus = 0, i;
  try{
    for(i = 0; i < o.essais; i++){
      if(arret && arret()) break;
      if(o.programme){
        seed(null);
        repartir({ alea:true, etages: dePile });
      }
      if(o.partis.length) massSet("parti", o.partis[i % o.partis.length]);
      if(o.massing) massSet("graine", ((rng() * 0x100000000) >>> 0) || 1);
      /* Sans massing rebattu, la même graine : la volumétrie suit la pile. */
      massVols(genMass(MASS.graine));
      MASS.pile = empreintePile();
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
    /* Tout remettre : l'état, la graine du programme, et des volumes vides
       quand il n'y en avait pas — `setMass` ne vide pas ce qu'on lui tait. */
    if(!(etat.mass && etat.mass.vol && etat.mass.vol.length)) massVols([]);
    restore(etat);
    seed(graine0);
  }
  return { trouves: top, essais: vus };
}
