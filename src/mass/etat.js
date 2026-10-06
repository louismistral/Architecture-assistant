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
import { MASS, empreintePile } from "./model.js";

export function massOf(){
  return {
    parti: MASS.parti,
    graine: MASS.graine,
    /* l'état des leviers : `null`, libre ; une valeur, fixe */
    lev: { sport: MASS.lev.sport, ponts: MASS.lev.ponts, prof: MASS.lev.prof },
    second: MASS.second,
    mono: MASS.mono ? 1 : 0,
    /* La pile pour laquelle ces volumes ont été composés : une solution relue
       alors que le mixer a changé de nombre de niveaux ne veut plus rien dire. */
    pile: MASS.pile || empreintePile(),
    etages: MASS.etages,
    pont: (MASS.pont || []).map(function(p){ return { a:p.a, b:p.b, i:p.i }; }),
    vol: volsOf(MASS.vol)
  };
}
/* Les volumes tels qu'ils s'enregistrent — et tels que les Typologies les
   lisent : la page des plans, le jugement et la recherche tirent le même plan
   des volumes à l'écran comme de ceux d'une candidate du générateur. */
export function volsOf(vols){
  return vols.map(function(v){
    var o = { id:v.id, x:v.x, y:v.y, a:v.a, fix:v.fix ? 1 : 0, key:v.key || null,
             ph:v.ph || 0, nom:v.nom || null, joint:v.joint || null, bat:v.bat || null,
             ar:v.ar || null,
             /* `key` sur l'ÉTAGE et non sur le seul volume : la salle de
                sport peut en porter un au-dessus d'elle, et celui-là loge du
                programme ordinaire. C'est lui qui dit ce qu'on y pave. */
             lv: v.lv.map(function(e){
               return { i:e.i, w:e.w, d:e.d, dx:e.dx || 0, dy:e.dy || 0, w0:e.w0 == null ? null : e.w0, d0:e.d0 == null ? null : e.d0,
                        dx0:e.dx0 == null ? null : e.dx0, dy0:e.dy0 == null ? null : e.dy0,
                        h:e.h || 0, keys:e.keys || null,
                        /* les autres parts d'un volume fusionné */
                        ext:e.ext && e.ext.length ? e.ext.map(function(p){
                          return { w:p.w, d:p.d, dx:p.dx || 0, dy:p.dy || 0 }; }) : null };
             }) };
    /* revenu de Rhino retouché à la main (`mass/import.js`) ; la clé n'existe
       pas sinon, pour que l'instantané d'un tirage ne change pas */
    if(v.main) o.main = 1;
    return o;
  });
}
export function setMass(o){
  if(!o) return;
  if(o.parti) MASS.parti = o.parti;
  if(o.graine) MASS.graine = o.graine;
  /* Un état d'avant les leviers (`par`, jamais réglé à l'écran) : tout libre.
     Sans cela, une variante ancienne se rechargeait avec les leviers de la
     dernière qu'on a vue. */
  var k, L = o.lev || {};
  for(k in MASS.lev) MASS.lev[k] = L[k] === undefined ? null : L[k];
  MASS.mono = !!o.mono;
  /* « non représentés » n'existe plus : la piscine se dessine toujours */
  if(o.second) MASS.second = o.second === "non" ? "auto" : o.second;
  /* `etage`, un seul niveau ou -1, est l'écriture d'avant la plage. */
  if(o.etages !== undefined) MASS.etages = o.etages;
  else if(o.etage !== undefined) MASS.etages = o.etage >= 0 ? [o.etage, o.etage] : null;
  MASS.pile = o.pile || null;
  MASS.pont = o.pont || [];
  if(o.vol && o.vol.length){
    MASS.vol = o.vol.filter(function(v){ return v && v.lv && v.lv.length; });
    MASS.vol.forEach(function(v){ if(!v.joint) delete v.joint; if(!v.bat) delete v.bat; });
    /* Une solution enregistrée avant que la clé descende sur l'étage — ou du
       temps où l'étage n'en portait qu'une. On la remet au plus bas de ses
       étages, qui est celui que le règlement dimensionne. */
    MASS.vol.forEach(function(v){
      v.lv.forEach(function(e){ if(e.key && !e.keys) e.keys = [e.key]; if(!e.ext) delete e.ext; });
      if(!v.key || v.lv.some(function(e){ return e.keys; })) return;
      var bas = v.lv[0];
      v.lv.forEach(function(e){ if(e.i < bas.i) bas = e; });
      bas.keys = [v.key];
    });
    MASS.sel = null;
  }
}
