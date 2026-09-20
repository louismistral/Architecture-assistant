/* ============================================================================
   LA PILE DE NIVEAUX, ET CE QU'ELLE PORTE

   `FLOORS` est une pile contiguë, du plus bas au plus haut : `FLOORS[0]` est le
   sous-sol le plus profond s'il y en a un, sinon le rez. `lvl` porte la cote —
   0 au rez, négative en sous-sol. On n'ajoute et on ne retire qu'aux deux
   extrémités : un 3ᵉ étage ne se retire pas en laissant le 4ᵉ en l'air.

   `BLOCKS` est la répartition : une PART de poste posée à un niveau.
   `{ u, key, q, fl }` — `q` unités du poste `key` au niveau d'indice `fl`, ou
   dans le bac (`TRAY`) tant qu'elles ne sont pas posées.
   ========================================================================= */
import { CIRC } from "../core/model.js";
import { RULES } from "../data/rules.js";
import { PMAP, aOf, grappeDe, posables, qOf } from "./prog.js";

export var TRAY = -1;

/* Emprise par défaut d'un plateau. 4'022 m² était l'emprise retenue à l'étude
   d'implantation — 31 % du périmètre de 12'783 m², le reste en cour, accès et
   dégagements. Un plateau de projet en prend un peu plus de la moitié : c'est
   un point de départ, il se règle niveau par niveau. */
export var PLATE_DEF = 2400, PLATE_MIN = 100, PLATE_MAX = 9000;
export var PLATE_REF = 4022;

export function lvName(l){
  if(l === 0) return "Rez-de-chaussée";
  if(l < 0) return l === -1 ? "Sous-sol" : (-l) + "ᵉ sous-sol";
  return l === 1 ? "1ᵉʳ étage" : l + "ᵉ étage";
}
export function lvShort(l){
  if(l === 0) return "Rez";
  if(l < 0) return l === -1 ? "S-s" : "S" + (-l);
  return l === 1 ? "1ᵉʳ" : l + "ᵉ";
}

/* Par défaut : un seul niveau, le rez. C'est le vrai point de départ d'un
   projet — la pile se creuse et se monte ensuite, à la main ou par le tirage. */
export var FLOORS = [{ lvl:0, plate: PLATE_DEF }];
export function flName(i){ return lvName(lvlOf(i)); }
export function flShort(i){ return i === TRAY ? "bac" : lvShort(lvlOf(i)); }
export function lvlOf(i){ return FLOORS[i] ? FLOORS[i].lvl : 0; }
export function idxOfLvl(l){
  for(var i = 0; i < FLOORS.length; i++) if(FLOORS[i].lvl === l) return i;
  return -2;
}
export function grade(){ return Math.max(0, idxOfLvl(0)); }

/* ---------- les parts ---------------------------------------------------- */
var uid = 1;
export function nextUid(){ return uid++; }
export var BLOCKS = [];
export function resetBlocks(){
  BLOCKS = [];
  posables().forEach(function(p){
    var q = qOf(p.key);
    if(q > 0) BLOCKS.push({ u: uid++, key: p.key, q: q, fl: TRAY });
  });
}
resetBlocks();

export function blockOf(u){
  for(var i = 0; i < BLOCKS.length; i++) if(BLOCKS[i].u === u) return BLOCKS[i];
  return null;
}
export function areaOf(b){ return aOf(b.key, b.q); }
export function onFloor(i){ return BLOCKS.filter(function(b){ return b.fl === i; }); }
export function flArea(i){
  var a = 0;
  BLOCKS.forEach(function(b){ if(b.fl === i) a += areaOf(b); });
  return a;
}
/* Surface utile qui pèse sur le plateau : la cour, la piscine et le chauffage
   à distance sont hors enveloppe scolaire, ils n'en consomment pas. */
export function flNet(i){
  var a = 0;
  BLOCKS.forEach(function(b){ if(b.fl === i && !PMAP[b.key].hors) a += areaOf(b); });
  return a;
}
export function flBuilt(i){ return flNet(i) / (1 - CIRC); }
export function flCount(i){
  var n = 0;
  BLOCKS.forEach(function(b){ if(b.fl === i) n += b.q; });
  return n;
}
/* Ce qu'un niveau peut porter en surface utile sans déborder son plateau. */
export function usable(i){
  var F = FLOORS[i];
  return F && F.plate > 0 ? F.plate * (1 - CIRC) : Infinity;
}
export function trayBlocks(){ return onFloor(TRAY); }
export function trayArea(){ return flArea(TRAY); }

/* Hauteur de niveau, déduite de ce qu'il porte : la plus grande hauteur libre
   exigée par un de ses postes, plus l'épaisseur de dalle. Elle n'est pas un
   réglage — elle est une conséquence du programme, et c'est elle qui donnera
   sa silhouette au volume. */
export function flHeight(i){
  var hl = RULES.haut.libre.def;
  BLOCKS.forEach(function(b){
    if(b.fl !== i) return;
    var p = PMAP[b.key];
    if(p.hlibre > hl) hl = p.hlibre;
  });
  return Math.round((hl + RULES.haut.dalle) * 100) / 100;
}
export function flLibre(i){
  var hl = RULES.haut.libre.def;
  BLOCKS.forEach(function(b){
    if(b.fl !== i) return;
    var p = PMAP[b.key];
    if(p.hlibre > hl) hl = p.hlibre;
  });
  return hl;
}

/* ---------- déplacer, scinder -------------------------------------------- */
export function move(u, fl){
  var b = blockOf(u);
  if(!b || fl === b.fl) return false;
  if(fl !== TRAY && (fl < 0 || fl >= FLOORS.length)) return false;
  b.fl = fl;
  fuse(b.key);
  return true;
}
/* Deux parts d'un même poste au même niveau n'ont aucune raison de rester
   deux : elles se refondent, sinon la pile se remplit de miettes au fil des
   déplacements. */
export function fuse(key){
  var seen = {};
  BLOCKS = BLOCKS.filter(function(b){
    if(b.key !== key) return true;
    var k = String(b.fl);
    if(seen[k]){ seen[k].q += b.q; return false; }
    seen[k] = b;
    return true;
  });
}
export function split(u, n){
  var b = blockOf(u);
  if(!b || PMAP[b.key].solid) return null;
  if(!(n >= 1) || n >= b.q) return null;
  b.q -= n;
  var nb = { u: uid++, key: b.key, q: n, fl: b.fl };
  BLOCKS.push(nb);
  return nb;
}
/* Pose `list` niveaux pour tout le contingent d'un poste, en parts aussi
   égales que possible. C'est l'outil de base de la répartition automatique. */
export function spread(key, list){
  BLOCKS = BLOCKS.filter(function(b){ return b.key !== key; });
  var q = qOf(key), n = list.length;
  if(q <= 0 || !n) return;
  if(PMAP[key].solid){ BLOCKS.push({ u: uid++, key: key, q: q, fl: list[0] }); return; }
  var base = Math.floor(q / n), extra = q % n;
  list.forEach(function(f){
    var add = base + (extra > 0 ? 1 : 0);
    if(extra > 0) extra--;
    if(add > 0) BLOCKS.push({ u: uid++, key: key, q: add, fl: f });
  });
  fuse(key);
}
/* Pose un poste avec une quantité EXACTE par niveau : `want` est un objet
   { indice de niveau : nombre d'unités }. Tout ce que `want` ne nomme pas
   repart au bac. C'est la forme dont la répartition automatique a besoin. */
export function place(key, want){
  BLOCKS = BLOCKS.filter(function(b){ return b.key !== key; });
  for(var k in want){
    if(want[k] > 0) BLOCKS.push({ u: uid++, key: key, q: want[k], fl: parseInt(k, 10) });
  }
}
export function toTray(){ BLOCKS.forEach(function(b){ b.fl = TRAY; }); }

/* Déplacer une part AVEC tout ce que le règlement lui attache : la grappe de
   proximité, telle que `prog.js` la déduit du schéma fonctionnel. C'est l'autre
   moitié de l'option « grouper les liés » — sans elle, on pouvait poser la
   salle de sport au rez et sa scène au 2ᵉ étage sans s'en apercevoir. */
export function moveGroupe(u, fl){
  var b = blockOf(u);
  if(!b) return false;
  var keys = {}, n = 0;
  grappeDe(b.key).forEach(function(k){ keys[k] = 1; });
  BLOCKS.slice().forEach(function(x){
    if(!keys[x.key]) return;
    if(x.fl === fl) return;
    x.fl = fl; n++;
  });
  Object.keys(keys).forEach(fuse);
  return n > 0;
}
/* Les parts qu'un déplacement groupé emmènerait, la part elle-même comprise. */
export function grappeBlocs(u){
  var b = blockOf(u);
  if(!b) return [];
  var keys = {};
  grappeDe(b.key).forEach(function(k){ keys[k] = 1; });
  return BLOCKS.filter(function(x){ return keys[x.key]; });
}

/* ---------- éditer la pile ------------------------------------------------
   On ajoute aux deux extrémités — un étage au-dessus, un sous-sol en dessous —
   et on retire N'IMPORTE QUEL niveau. Retirer au milieu n'est pas un caprice :
   c'est le geste qu'on fait quand un étage s'avère de trop, et rien n'oblige à
   ce que ce soit le dernier. Les cotes se renumérotent derrière, la pile reste
   contiguë, et le rez reste le rez. */
export function addFloorTop(){
  FLOORS.push({ lvl: lvlOf(FLOORS.length - 1) + 1,
                plate: FLOORS[FLOORS.length - 1].plate });
  return FLOORS.length - 1;
}
/* Un sous-sol s'insère SOUS la pile : tous les indices montent d'un cran, les
   cotes ne bougent pas. Rien n'y descend tout seul. */
export function addFloorBottom(){
  FLOORS.unshift({ lvl: lvlOf(0) - 1, plate: FLOORS[0].plate });
  BLOCKS.forEach(function(b){ if(b.fl !== TRAY) b.fl += 1; });
  return 0;
}
/* Retire le niveau `i`. Ce qu'il portait repart au bac — rien n'est perdu, tout
   est à reposer — et les niveaux au-dessus descendent d'un cran. */
export function delFloorAt(i){
  if(FLOORS.length < 2 || !FLOORS[i]) return false;
  var g = grade();
  BLOCKS.forEach(function(b){
    if(b.fl === i) b.fl = TRAY;
    else if(b.fl > i) b.fl -= 1;
  });
  FLOORS.splice(i, 1);
  /* La cote du rez est celle du niveau qui prend sa place : retirer un sous-sol
     ne doit pas faire remonter tout le bâtiment d'un étage. */
  var ng = (i <= g) ? Math.min(g, FLOORS.length - 1) : g;
  FLOORS.forEach(function(F, k){ F.lvl = k - ng; });
  return true;
}
/* Ce que coûte le retrait d'un niveau : le nombre de pièces qui repartent au
   bac. La commande doit pouvoir le dire avant d'être cliquée. */
export function floorCost(i){ return flCount(i); }

export function setPlate(i, v){
  if(!FLOORS[i]) return false;
  var n = Math.round(v);
  if(!isFinite(n) || n < PLATE_MIN || n > PLATE_MAX) return false;
  if(n === FLOORS[i].plate) return false;
  FLOORS[i].plate = n;
  return true;
}
export var SUB_MAX = 3, UP_MAX = 8;

/* Redéfinit la pile d'un coup — restauration, tirage qui propose aussi un
   nombre de niveaux, ou choix direct du nombre d'étages. `nsub` sous-sols,
   `nup` étages au-dessus du rez.

   Sans `plates`, chaque cote GARDE le plateau qu'elle avait : changer le nombre
   d'étages remettait sinon tous les plateaux à leur valeur par défaut, et le
   réglage niveau par niveau était perdu sans que rien ne le dise. */
export function setStack(nsub, nup, plates){
  var lo = -Math.max(0, Math.min(SUB_MAX, nsub)), hi = Math.max(0, Math.min(UP_MAX, nup));
  var garde = {};
  FLOORS.forEach(function(F){ garde[F.lvl] = F.plate; });
  var ref = garde[0] || FLOORS[0].plate || PLATE_DEF;
  var next = [], l;
  for(l = lo; l <= hi; l++){
    next.push({ lvl: l, plate: (plates && plates[l - lo] > 0) ? plates[l - lo]
                             : (garde[l] > 0 ? garde[l] : ref) });
  }
  var shift = idxOfLvl(0) - (0 - lo);
  FLOORS = next;
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY) return;
    var f = b.fl - shift;
    b.fl = (f >= 0 && f < FLOORS.length) ? f : TRAY;
  });
  return FLOORS.length;
}
export function nSub(){ return Math.max(0, -lvlOf(0)); }
export function nUp(){ return Math.max(0, lvlOf(FLOORS.length - 1)); }
/* Ce que coûterait une pile de `nsub` sous-sols et `nup` étages : le nombre de
   pièces posées aux cotes qui disparaîtraient, et qui repartiraient au bac. La
   commande qui les renvoie doit pouvoir le dire avant d'être cliquée. */
export function stackCost(nsub, nup){
  var lo = -Math.max(0, Math.min(SUB_MAX, nsub)), hi = Math.max(0, Math.min(UP_MAX, nup)), n = 0;
  BLOCKS.forEach(function(b){
    if(b.fl === TRAY) return;
    var l = lvlOf(b.fl);
    if(l < lo || l > hi) n += b.q;
  });
  return n;
}

/* Surface hors enveloppe scolaire posée à un niveau — la cour, la piscine et
   le chauffage à distance. Elle se compte, mais pas sur le plateau. */
export function horsAt(i){
  var a = 0;
  BLOCKS.forEach(function(b){ if(b.fl === i && PMAP[b.key].hors) a += areaOf(b); });
  return a;
}
