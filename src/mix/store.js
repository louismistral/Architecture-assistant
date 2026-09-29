/* ============================================================================
   PERSISTANCE

   Cinq choses méritent de survivre à un rechargement : les surfaces
   que l'utilisateur a précisées (elles appartiennent au cahier des charges et
   changent tous les totaux) et la répartition qu'il a composée. Elles sont
   lues AVANT le premier rendu, parce qu'une surface peut être modifiée depuis
   le cahier des charges, donc avant que le mixer ait jamais été ouvert. S'y ajoutent
   les écarts qu'on a assumés — les reprendre un par un à chaque ouverture
   reviendrait à ne jamais pouvoir en assumer un —, et le MASSING : volumes
   posés, positions, rotations, parti et leviers. Aller au mixer et revenir ne
   doit pas défaire une implantation qu'on vient de composer. S'y ajoutent
   enfin les LIGNES de la recherche — cadre choisi, orientation, domaines des
   leviers, paramètres du générateur (`data/lignes.js — V`) —, et d'elles on
   n'enregistre que les ÉCARTS au défaut : tout enregistrer figerait dans ce
   navigateur les valeurs du jour. Le JURY n'en fait pas partie : une variante
   rechargée remet la recherche dans l'état où elle l'a produite, jamais les
   poids qui la notent.

   Chaque section est restaurée indépendamment : perdre la pile vaut mieux que
   perdre aussi les surfaces.
   ========================================================================= */
import { el } from "../core/format.js";
import { CIRCSET, COULOIR, ITEMBYKEY, loadCirc, recompute, userAreas } from "../core/model.js";
import { acceptList, setAccepts } from "./accept.js";
import { optsOf, setOpts } from "./opts.js";
import { ecarts, ecartsJury, poser, poserJury, retablir } from "../data/lignes.js";
import "../data/leviers.js";
import "../data/cadre.js";
import "../data/orientation.js";
import "../data/jugement.js";
import "../data/donnees.js";
import "../data/recherche.js";
import { massOf, setMass } from "../mass/etat.js";
import { BLOCKS, FLOORS, TRAY, nextUid, resetBlocks, setStack } from "./floors.js";
import { PMAP, qOf } from "./prog.js";

export var LSKEY = "saxon-mix-v1";
export var storeReady = false;
var saveT = null, chipEl = null, badParts = null;

/* La vue enregistre son témoin ; tant qu'elle n'est pas montée, on se tait. */
export function setChip(node){ chipEl = node; paint(lastMsg, lastOk); }
var lastMsg = "", lastOk = false;
function paint(txt, ok){
  lastMsg = txt; lastOk = ok;
  if(!chipEl) return;
  while(chipEl.firstChild) chipEl.removeChild(chipEl.firstChild);
  chipEl.classList.remove("is-bad");
  if(!txt) return;
  if(ok) chipEl.appendChild(el("b", null, "● "));
  chipEl.appendChild(document.createTextNode(txt));
}
/* Le seul message d'échec doit dire sa cause ET son remède. */
function failChip(){
  lastMsg = "Enregistrement impossible — ce navigateur refuse le stockage local";
  lastOk = false;
  if(!chipEl) return;
  while(chipEl.firstChild) chipEl.removeChild(chipEl.firstChild);
  chipEl.appendChild(document.createTextNode(lastMsg));
  chipEl.classList.add("is-bad");
}

/* ---------- L'INSTANTANÉ ----------------------------------------------------
   Un seul objet dit ce qu'est « l'état du projet », et deux choses le lisent :
   l'enregistrement sur l'appareil, et une VARIANTE partagée au groupe. Les
   séparer aurait fait deux vérités — on aurait rechargé une variante et
   retrouvé une pile sans ses écarts assumés, ou l'inverse. */
export function snapshot(){
  return {
    areas: userAreas,
    /* La LARGEUR du couloir, et non plus une part : la clé a changé avec le
       sens, pour qu'un état enregistré avant ne soit pas relu de travers. */
    couloir: circValue(),
    lvls: FLOORS.map(function(F){ return F.lvl; }),
    plates: FLOORS.map(function(F){ return F.plate; }),
    blocks: BLOCKS.filter(function(b){ return b.fl !== TRAY; })
                  .map(function(b){ return { k:b.key, q:b.q, f:b.fl }; }),
    /* Les écarts assumés survivent eux aussi : les reprendre un par un à
       chaque ouverture reviendrait à ne jamais pouvoir en assumer un. */
    accepts: acceptList(),
    /* Les deux interrupteurs du mixer : les retrouver éteints à chaque
       ouverture revenait à ne jamais pouvoir s'en servir. */
    opts: optsOf(),
    /* Le MASSING : les volumes posés, leurs positions, leurs rotations, le
       parti et les réglages. Aller au mixer et revenir ne doit pas défaire
       une implantation qu'on a passé un quart d'heure à régler. */
    mass: massOf(),
    /* LES LIGNES DE LA RECHERCHE, et seulement ce qui s'écarte du défaut.
       Enregistrer l'objet entier figerait dans ce navigateur les valeurs du
       jour, et une valeur corrigée dans le code ne parviendrait jamais à qui a
       déjà ouvert l'application. Le jury n'y est pas. */
    doc: ecarts(true),
    updatedAt: Date.now()
  };
}

/* Remet l'instantané en place, section par section : perdre la pile vaut mieux
   que perdre aussi les surfaces. Rend la liste de ce qui n'a pas pu revenir. */
export function restore(o){
  var lost = [];
  if(!o) return lost;
  try{ applyAreas(o.areas); }catch(_){ lost.push("surfaces"); }
  try{ if(o.couloir != null) loadCirc(o.couloir); }catch(_){ lost.push("circulation"); }
  try{ applyStack(o.lvls, o.plates); }catch(_){ lost.push("niveaux"); }
  try{ applyBlocks(o.blocks); }catch(_){ lost.push("répartition"); }
  try{ setAccepts(o.accepts); }catch(_){ lost.push("écarts assumés"); }
  try{ setOpts(o.opts); }catch(_){ lost.push("options"); }
  try{ setMass(o.mass); }catch(_){ lost.push("massing"); }
  /* Les lignes d'un instantané sont ce qui s'écarte du DÉFAUT : on repart du
     défaut avant de les poser. Sans cela, une valeur réglée avant le
     chargement survivait à une variante qui ne la touchait pas, et la variante
     ne se reproduisait plus. Le jury n'est ni remis au défaut ni relu : il
     reste celui du groupe. Un instantané d'avant (`doc` absent) ne touche à
     rien ; ses anciennes clés — rangs, bacs, poids — sont ignorées. */
  try{ if(o.doc){ retablir(true); poser(o.doc, true); } }catch(_){ lost.push("contraintes"); }
  return lost;
}

/* Ce qui veut savoir qu'un enregistrement vient d'avoir lieu s'abonne ici —
   les réglages partagés, par exemple. `store.js` n'a pas à connaître le
   réseau : il dit qu'il a écrit, et rien de plus. */
var apres = [];
export function onSave(fn){
  apres.push(fn);
  return function(){ apres = apres.filter(function(f){ return f !== fn; }); };
}

export function saveSoon(){
  if(!storeReady) return;
  clearTimeout(saveT);
  paint("Enregistrement…", false);
  saveT = setTimeout(function(){
    var snap = snapshot();
    try {
      /* L'appareil garde aussi le JURY, à côté de l'instantané et non dedans :
         une variante n'emporte pas les poids qui la notent. */
      localStorage.setItem(LSKEY, JSON.stringify(Object.assign({ jury: ecartsJury() }, snap)));
      paint("Enregistré sur cet appareil", true);
    } catch(_){ failChip(); }
    apres.forEach(function(f){ try{ f(snap); }catch(_){} });
  }, 700);
}

/* La largeur du couloir vit dans `core/model.js` ; on ne la duplique pas, on
   la relit au moment d'écrire. Tant qu'elle n'a pas été tranchée, on
   n'enregistre rien : l'hypothèse de projet doit pouvoir évoluer. */
function circValue(){ return CIRCSET ? COULOIR : null; }

export function applyAreas(areas){
  if(!areas) return;
  var touched = 0;
  for(var k in areas){
    var it = ITEMBYKEY[k], v = areas[k];
    if(!it || !it.est || !(v > 0) || v > 2000) continue;
    it.u = v; it.set = 1; userAreas[k] = v; touched++;
  }
  if(touched) recompute();
}

/* Restaure la pile PUIS la répartition. Une part dont le poste n'existe plus,
   ou dont le niveau a disparu, retombe au bac : elle n'est pas perdue, elle
   est à reposer. */
export function applyStack(lvls, plates){
  if(!lvls || !lvls.length || lvls.length > 12) return;
  var lo = lvls[0], hi = lvls[lvls.length - 1];
  if(!(lo <= 0 && hi >= 0)) return;            /* une pile sans rez n'existe pas */
  setStack(-lo, hi, plates);
}
export function applyBlocks(list){
  /* Une liste VIDE est un état : tout au bac. Seule l'absence de liste — un
     fichier d'avant — laisse la répartition telle quelle. */
  if(!list) return;
  resetBlocks();
  var reste = {};
  BLOCKS.forEach(function(b){ reste[b.key] = b.q; });
  var next = [];
  list.forEach(function(o){
    if(!PMAP[o.k] || !(o.q > 0)) return;
    var f = o.f;
    if(!(f >= 0 && f < FLOORS.length)) return;
    var dispo = reste[o.k] || 0;
    var q = Math.min(dispo, Math.round(o.q));
    if(q <= 0) return;
    reste[o.k] = dispo - q;
    next.push({ u: nextUid(), key: o.k, q: q, fl: f });
  });
  /* ce que le fichier n'a pas placé reste au bac, dans la quantité exacte que
     le programme demande aujourd'hui */
  for(var k in reste){
    if(reste[k] > 0) next.push({ u: nextUid(), key: k, q: reste[k], fl: TRAY });
  }
  BLOCKS.length = 0;
  next.forEach(function(b){ BLOCKS.push(b); });
}

export function initStore(){
  if(storeReady) return;
  /* On LIT avant d'affirmer quoi que ce soit : la pastille annonçait autrefois
     « Enregistré » avant toute lecture, donc en navigation privée on était
     assuré que le travail était sauvé jusqu'au premier échec d'écriture. */
  try {
    var raw = localStorage.getItem(LSKEY);
    if(raw){
      var lu = JSON.parse(raw);
      var lost = restore(lu);
      try{ poserJury(lu.jury); }catch(_){ lost.push("jugement"); }
      if(lost.length) badParts = lost;
    }
    localStorage.setItem(LSKEY + ".probe", "1");
    localStorage.removeItem(LSKEY + ".probe");
    if(badParts) paint("Restauration incomplète — " + badParts.join(", "), false);
    else paint(raw ? "Répartition retrouvée sur cet appareil" : "", !!raw);
  } catch(_){
    failChip();
  }
  /* Rien ne doit être écrit avant cette lecture : une surface modifiée depuis
     le cahier des charges déclencherait un enregistrement alors que la mémoire ne
     contient encore que la pile par défaut, et écraserait la composition. */
  storeReady = true;
}

/* Le programme a changé de quantité (il ne le fait pas aujourd'hui, mais un
   poste ajouté demain le ferait) : on remet à plat plutôt que de laisser une
   répartition mentir. */
export function verifieQuantites(){
  var vu = {};
  BLOCKS.forEach(function(b){ vu[b.key] = (vu[b.key] || 0) + b.q; });
  var faux = false;
  for(var k in PMAP){
    if(PMAP[k].dedans) continue;
    if((vu[k] || 0) !== qOf(k)) faux = true;
  }
  if(faux) resetBlocks();
  return faux;
}
