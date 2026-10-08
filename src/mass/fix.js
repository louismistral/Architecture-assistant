/* ============================================================================
   LES REMÈDES DU MASSING

   Une alerte qui se contente de dire ce qui ne va pas laisse tout le travail à
   faire. Le mixer l'avait compris avant : chaque écart y nomme le geste qui le
   résoudrait, à côté de « laisser comme ça ». Le massing avertissait sans rien
   proposer — on lisait « volume 2 sort du périmètre de 7,49 m » et l'on allait
   le tirer à la souris, au pixel près, jusqu'à ce que le message disparaisse.

   Deux règles, les mêmes qu'au mixer :

     — un remède ne s'applique JAMAIS tout seul. Il est offert, à côté de
       « laisser comme ça ». Le massing ne refuse rien et ne décide rien ;
     — un remède qui en créerait un autre n'est pas proposé. Les gestes qui
       déplacent passent tous par `admissible()` : un volume recalé ne sort pas
       de la parcelle, et un volume aminci ne traverse pas son voisin. Quand le
       geste échoue, il rend `false` et la vue ne bouge pas.

   La MÉCANIQUE reste dans `gen.js` — écarter, recaler, replacer un sous-sol,
   poser les ouvrages du second temps sont ce que le générateur sait déjà
   faire. Ce fichier ne fait que les nommer et dire ce qu'ils coûtent : le
   contrôle et le générateur doivent réparer de la même façon, sans quoi ils se
   contrediraient à chaque clic.
   ========================================================================= */
import { dec } from "../core/format.js";
import { acte } from "../mix/fix.js";
import { repartir } from "../mix/shuffle.js";
import {
  admissible, ecarter, genMass, poser, poserSecondTemps, recaler, replacerSousSol, relierCourant } from "./gen.js";
import { MASS, aireEtage, auModule, demande, recouvrement, fusionne, massSet, massVols, niveaux, profBornes, profFacade, volEtage,
  volFusionne } from "./model.js";

function vol(i){ return (i >= 0 && MASS.vol[i]) ? MASS.vol[i] : null; }
/* UN VOLUME DE RHINO (des corps libres, `model.js — estLibre`) est tel que Rhino
   l'a dessiné : aucun remède ne le déplace, ne le recompose ni ne le retaille —
   ni recaler, ni écarter, ni creuser, ni reposer le second temps. Le contrôle dit
   l'écart ; on le corrige dans Rhino. */
function deRhino(){ return MASS.vol.some(function(v){ return v.libre; }); }
/* Ce qu'on rejoue quand la géométrie d'un volume a changé : rien ne garantit
   qu'il tienne encore, et un remède ne doit pas laisser une composition pire
   qu'il ne l'a trouvée. */
function tenir(v, avant){
  if(admissible(v, MASS.vol)) return true;
  if(recaler(v, MASS.vol)) return true;
  avant();
  return false;
}

/* ---------- l'implantation --------------------------------------------------
   Sortir du périmètre, percuter l'existant, se coller à un voisin : le même
   geste les répare tous, parce que c'est la même règle — `admissible()` — qui
   les énonce. */
export function fixRecaler(i){
  var v = vol(i);
  if(!v || deRhino()) return null;
  return acte("Ramener " + nomDe(v, i) + " dans la parcelle",
    "à la position admissible la plus proche — recul de 5 m, six mètres des voisins",
    function(){ return recaler(v, MASS.vol); });
}
export function fixEcarter(){
  if(deRhino()) return null;
  return acte("Écarter les volumes",
    "toute la composition se desserre jusqu'aux distances exigées, puis se recale",
    function(){ ecarter(MASS.vol); return true; });
}

/* ---------- les proportions -------------------------------------------------
   À SURFACE EXACTE, toujours : c'est la règle première du projet. On change la
   forme d'un volume, jamais ses mètres carrés — sans quoi le remède d'une
   alerte en créerait une autre, au bilan cette fois. */
function reformer(v, fd){
  var av = v.lv.map(function(e){ return { w:e.w, d:e.d }; });
  v.lv.forEach(function(e){
    var a = e.w * e.d, d = fd(e);
    if(!(d > 0)) return;
    e.d = auModule(d);
    e.w = auModule(a / e.d);
  });
  return tenir(v, function(){
    v.lv.forEach(function(e, k){ e.w = av[k].w; e.d = av[k].d; });
  });
}
/* La profondeur la plus grande qu'un corps d'école puisse prendre. */
function profCible(){ return Math.min(profBornes().hi, profFacade()); }
export function fixProfondeur(i){
  var v = vol(i), p = profCible();
  /* un volume fusionné ne se reforme pas d'un bloc : ses ailes se tiennent */
  if(!v || v.fix || volFusionne(v)) return null;
  return acte("Ramener " + nomDe(v, i) + " à " + dec(p) + " m de profondeur",
    "à surface exacte : il s'allonge d'autant qu'il s'amincit",
    function(){ return reformer(v, function(){ return p; }); });
}
export function fixCarrer(i){
  var v = vol(i), p = profCible();
  if(!v || v.fix || volFusionne(v)) return null;
  return acte("Ramener " + nomDe(v, i) + " à des proportions tenables",
    "au plus carré que la profondeur retenue permet, à surface exacte",
    function(){
      return reformer(v, function(e){ return Math.min(p, Math.sqrt(e.w * e.d)); });
    });
}

/* ---------- les passerelles ------------------------------------------------ */
export function fixRelier(){
  if(deRhino()) return null;
  return acte("Recomposer les passerelles",
    "entre les corps d'école qui se font face, la plus courte d'abord",
    function(){ return relierCourant(); });
}

/* ---------- le sous-sol ----------------------------------------------------- */
export function fixSousSol(){
  if(deRhino()) return null;
  return acte("Creuser sous le volume le mieux placé",
    "le sous-sol passe sous le corps dont le terrain est le plus haut : c'est là "
    + "que la couverture sur la nappe suffit",
    function(){ return replacerSousSol(MASS.vol); });
}

/* ---------- les surfaces ----------------------------------------------------
   Un niveau se repartage entre les corps qui le portent : la SOMME doit rester
   ce que les plans y pavent (`demande`). Les cotes changent, les mètres carrés
   non. Ce geste vivait dans la vue, où il n'était appelé qu'après un ajout
   d'étage — il est la réponse à l'écart de bilan, et c'est ici sa place. */
export function requilibre(){
  var bouge = false;
  niveaux().forEach(function(n){
    var m = passe(n);
    /* deux corps du même bâtiment qui se recouvrent : les agrandir agrandit aussi
       leur part commune — un passage tombe court, on en refait quelques-uns.
       Sans recouvrement, un seul passage, comme toujours. */
    for(var t = 0; m && t < 4 && recouvrement(MASS.vol, n.i, false).aire > 0; t++) m = passe(n);
    if(m) bouge = true;
  });
  return bouge;
}
function passe(n){
  /* un corps libre est tel que Rhino l'a dessiné : on ne le retaille pas */
  var port = MASS.vol.filter(function(v){ return !v.ph && !v.libre && !!volEtage(v, n.i); });
  if(!port.length) return false;
  var som = 0;
  port.forEach(function(v){
    var e = volEtage(v, n.i);
    if(e) som += aireEtage(e);
  });
  /* leur union, pas leur somme */
  som -= recouvrement(MASS.vol, n.i, false).aire;
  if(som <= 0) return false;
  var k = Math.sqrt(demande(n.i, MASS.vol) / som);
  if(Math.abs(k - 1) < .001) return false;
  port.forEach(function(v){
    var e = volEtage(v, n.i);
    if(!e) return;
    /* un niveau fusionné se met à l'échelle d'un bloc, autour de sa part 0 :
       les jonctions se tiennent, au prix du module */
    // ponytail: pas d'arrondi au module sur un niveau fusionné ; recaler les parts sur le module si le contrôle s'en plaint
    if(fusionne(e)){
      e.w *= k; e.d *= k;
      e.ext.forEach(function(p){ p.w *= k; p.d *= k; p.dx = (p.dx || 0) * k; p.dy = (p.dy || 0) * k; });
      return;
    }
    e.w = auModule(e.w * k);
    e.d = auModule(e.d * k);
  });
  return true;
}
export function fixAire(){
  if(deRhino()) return null;
  return acte("Rééquilibrer les volumes sur le programme",
    "chaque niveau se repartage entre les corps qui le portent, à surface totale exacte",
    function(){ return requilibre(); });
}

/* ---------- les ouvrages du second temps ------------------------------------ */
export function fixSecond(mode, lb, hint){
  if(MASS.second === mode || deRhino()) return null;
  return acte(lb, hint, function(){
    massSet("second", mode);
    poserSecondTemps(MASS.vol);
    return true;
  });
}
export function fixReposerSecond(){
  if(deRhino()) return null;
  return acte("Chercher une autre place",
    "on rebalaie la parcelle du bord vers le cœur",
    function(){ return poserSecondTemps(MASS.vol); });
}

/* ---------- reprendre la composition ----------------------------------------
   Quand rien de local ne répond, il reste à rejouer. Ce n'est pas un aveu : la
   composition est une proposition parmi des centaines, et en changer est le
   geste normal de l'outil. */
export function fixRelancer(){
  return acte("Proposer une autre implantation",
    "même programme, mêmes surfaces, mêmes niveaux — une autre solution",
    function(){
      massSet("graine", (MASS.graine * 1103515245 + 12345) >>> 8 || 1);
      poser(genMass());
      return true;
    });
}
/* Un parti qui ne tient pas ce programme : laisser le générateur choisir. */
export function fixAuto(){
  if(MASS.parti === "auto") return null;
  return acte("Laisser le générateur choisir le parti",
    "« Auto » essaie les douze partis et ne garde que ce qui tient dans le cadre",
    function(){ massSet("parti", "auto"); poser(genMass()); return true; });
}
/* Le seul remède qui ne soit PAS ici : quand aucune implantation ne tient, la
   réponse est au mixer, en ajoutant un étage. On l'appelle donc de là-bas. */
export function fixPile(){
  return acte("Proposer une pile qui tienne sur le site",
    "le mixer rebat la répartition et déduit le nombre d'étages de l'aire posable",
    function(){
      repartir({ alea:true, etages:true });
      poser(genMass());
      return true;
    });
}

function nomDe(v, i){
  return v.nom ? v.nom.toLowerCase()
       : v.fix ? "la salle de sport" : "le volume " + (i + 1);
}