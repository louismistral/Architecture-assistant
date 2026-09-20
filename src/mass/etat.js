/* ============================================================================
   CE QUE LE MASSING ENREGISTRE

   Un module à part, et non dans `model.js` : la persistance est tenue par
   `mix/store.js`, qui écrit une seule clé pour tout le projet. S'il devait
   importer `model.js`, il tirerait derrière lui la moitié du massing — et
   `model.js` importe déjà `mix/floors.js`. Un petit module de sérialisation
   coupe le cycle et dit exactement ce qui survit à un rechargement.

   On enregistre la SOLUTION, pas le programme : les volumes tiennent leurs
   surfaces des niveaux du mixer, qui sont enregistrés de leur côté. Un fichier
   relu ne rejoue donc jamais deux fois la même surface.
   ========================================================================= */
import { MASS } from "./model.js";

export function massOf(){
  return {
    parti: MASS.parti,
    graine: MASS.graine,
    par: {
      nb: MASS.par.nb, dmin: MASS.par.dmin, prof: MASS.par.prof, cap: MASS.par.cap,
      align: MASS.par.align, compact: MASS.par.compact,
      regul: MASS.par.regul, grad: MASS.par.grad
    },
    mono: MASS.mono ? 1 : 0,
    etage: MASS.etage,
    vol: MASS.vol.map(function(v){
      return { id:v.id, x:v.x, y:v.y, a:v.a, fix:v.fix ? 1 : 0, key:v.key || null,
               lv: v.lv.map(function(e){
                 return { i:e.i, w:e.w, d:e.d, dx:e.dx || 0, dy:e.dy || 0 };
               }) };
    })
  };
}
export function setMass(o){
  if(!o) return;
  if(o.parti) MASS.parti = o.parti;
  if(o.graine) MASS.graine = o.graine;
  if(o.par){
    var k;
    for(k in o.par) if(MASS.par[k] !== undefined && o.par[k] !== undefined)
      MASS.par[k] = o.par[k];
  }
  MASS.mono = !!o.mono;
  if(o.etage !== undefined) MASS.etage = o.etage;
  if(o.vol && o.vol.length){
    MASS.vol = o.vol.filter(function(v){ return v && v.lv && v.lv.length; });
    MASS.sel = null;
  }
}
