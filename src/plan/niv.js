import { fmt } from "../core/format.js";
import { CHAP } from "../data/program.js";
import { FLOORS, PLATE, TRAY, flBuilt, flCount, flNet, lvlOf, trayArea, trayRooms } from "./levels.js";
import { ROOMS } from "./rooms.js";

export var NIV = [
  { re:/Salle de sport double/, grade:1, sev:"e", msg:"7 m de hauteur libre sous structure — la salle double ne peut être qu'au rez", ref:"2.10" },
  { re:/Abri PC/, lvl:{ min:-9, max:0 }, sev:"e", msg:"Abri PC au rez ou en sous-sol, accès et dalle de protection", ref:"2.10" },
  { re:/Local chauffage CAD/, grade:1, sev:"e", msg:"Accessible de plain-pied par camion, hauteur libre 5,20 m", ref:"2.10" },
  { re:/Piscine/, grade:1, sev:"e", msg:"Bassin, vestiaires et locaux techniques au niveau du terrain", ref:"2.10" },
  { re:/Cour d'école/, grade:1, sev:"e", msg:"La cour et son préau sont des aménagements de plain-pied", ref:"2.10" },
  { re:/^Hall/, grade:1, sev:"e", msg:"Tous les halls sont au rez-de-chaussée, au niveau du terrain", ref:"2.10" },
  { re:/Scène/, same:/Salle de sport double/, sev:"e", msg:"Attenante à la salle de sport", ref:"2.10" },
  { g:/^sport-local-de-rangement$/, same:/Salle de sport double/, sev:"w", msg:"Rangement des tables et chaises de la salle polyvalente", ref:"2.10" },
  { re:/Vestiaires (élèves|professeurs)/, same:/Salle de sport double/, sev:"w", msg:"À proximité de la salle de sport", ref:"2.10" },
  { g:/^sport-local-de-nettoyage$/, same:/Salle de sport double/, sev:"w", msg:"Local de nettoyage de la salle polyvalente", ref:"2.10" },
  { re:/Réfectoire|^Cuisine/, grade:1, sev:"w", msg:"Livraisons et lien avec le foyer : de préférence au rez", ref:"2.10" },
  { chap:"uape", grade:1, sev:"e", msg:"L'UAPE tient sur un seul niveau, au rez-de-chaussée : accès direct à l'extérieur et aux parents, sans traverser l'école", ref:"2.10" },
  { fam:"adm", grade:1, sev:"e", msg:"Bureaux, direction et administration au rez-de-chaussée : ils reçoivent le public et les parents de plain-pied", ref:"2.10" },
  { re:/Salles de classe|Salle de dédoublement|Salle ACM|Salles d'appui/, max:2, sev:"w", msg:"Classes situées au-delà du 2ᵉ étage — évacuation et âge des élèves (9 à 12 ans)", ref:"2.10" },
  { re:/Conciergerie/, grade:1, sev:"w", msg:"Local de nettoyage et vestiaires du personnel : accès de service", ref:"2.10" }
];
export function nivHit(rl, r){
  if(rl.g) return rl.g.test(r.g);
  if(rl.fam) return r.f === rl.fam;
  if(rl.chap) return !!CHAP[r.ci] && CHAP[r.ci].id === rl.chap;
  return rl.re.test(r.n);
}
/* Des sanitaires à chaque niveau : règle de projet, pas d'article du règlement, mais un étage
   sans WC ne se dessine pas. Les WC garçons et filles et les vestiaires de classe suivent les
   classes, au prorata du nombre de salles portées par chaque niveau. */
export var WCRE  = /^(WC |Toilette)/;
export var WCG   = /^WC garçons/;
export var WCF   = /^WC filles/;
export var CLSRE = /^(Salles? de classe|Salle de dédoublement|Salle ACM|Salles d'appui)/;
export var VESTC = /^Vestiaires de classe/;
export function flWC(i){
  var o = { n:0, wc:0, g:0, f:0, cl:0, use:0 };
  ROOMS.forEach(function(r){
    if(r.fl !== i) return;
    o.n++;
    if(r.f !== "tec") o.use++;      /* un niveau purement technique n'appelle pas de sanitaires */
    if(WCRE.test(r.n)) o.wc++;
    if(WCG.test(r.n)) o.g++;
    if(WCF.test(r.n)) o.f++;
    if(CLSRE.test(r.n)) o.cl++;
  });
  return o;
}
export function flOfName(re){
  for(var i = 0; i < ROOMS.length; i++) if(re.test(ROOMS[i].n)) return ROOMS[i].fl;
  return 0;
}
export function idOfName(re){
  for(var i = 0; i < ROOMS.length; i++) if(re.test(ROOMS[i].n)) return ROOMS[i].id;
  return null;
}
export function checkNiv(){
  var out = [], seen = {};
  ROOMS.forEach(function(r){
    if(r.fl === TRAY) return;
    NIV.forEach(function(rl){
      if(!nivHit(rl, r)) return;
      var bad = false, why = "", lv = lvlOf(r.fl);
      if(rl.lvl && (lv < rl.lvl.min || lv > rl.lvl.max)){ bad = true; why = "posé au " + FLOORS[r.fl].n.toLowerCase(); }
      else if(rl.grade && lv !== 0){ bad = true; why = "posé au " + FLOORS[r.fl].n.toLowerCase(); }
      else if(rl.max !== undefined && (lv > rl.max || lv < 0)){ bad = true; why = "posé au " + FLOORS[r.fl].n.toLowerCase(); }
      else if(rl.same){
        var ref = flOfName(rl.same);
        if(r.fl !== ref){ bad = true; why = "séparé de sa référence d'un niveau"; }
      }
      if(!bad) return;
      var k = rl.msg;
      if(seen[k]){ seen[k].n++; return; }
      seen[k] = { msg: rl.msg, sev: rl.sev, ref: rl.ref, ex: r.n, n: 1 };
      out.push(seen[k]);
    });
  });
  /* sous-sol : lumière naturelle et nappe phréatique */
  var sub = 0;
  FLOORS.forEach(function(f, i){ if(f.lvl < 0 && flCount(i)) sub++; });
  if(sub){
    var noDay = 0, exDay = "";
    ROOMS.forEach(function(r){
      if(r.fl === TRAY || lvlOf(r.fl) >= 0 || r.f === "tec") return;
      noDay++; if(!exDay) exDay = r.n;
    });
    if(noDay) out.push({ msg: "En sous-sol, seuls les locaux techniques, de stockage et de "
      + "nettoyage se passent de lumière naturelle", sev: "e", ref: "2.10", ex: exDay, n: noDay });
    out.push({ msg: "Nappe phréatique relevée à 462,25 m : la marge sous le terrain naturel va "
      + "de 1,0 m à l'ouest à 4,5 m à l'est — un sous-sol excavé n'est tenable qu'au tiers est "
      + "du périmètre, et demande une cuve étanche ailleurs",
      sev: "w", ref: "2.4", ex: "", n: 0 });
  }
  /* le bac : tant qu'il reste des pièces, le projet n'est pas posé */
  var tn = trayRooms().length;
  if(tn) out.push({ msg: tn + " pièce" + (tn > 1 ? "s" : "") + " encore au bac, soit "
    + fmt(Math.round(trayArea())) + " m² sans niveau", sev: "w", ref: "à placer", ex: "", n: 0 });
  /* des sanitaires à chaque niveau occupé, et de chaque genre là où il y a des classes */
  FLOORS.forEach(function(f, i){
    var o = flWC(i);
    if(!o.n || !o.use) return;
    if(!o.wc) out.push({ msg: "Aucun WC au " + f.n.toLowerCase()
      + " : tout niveau occupé doit avoir ses sanitaires", sev: "e", ref: "2.10", ex: "", n: 0 });
    else if(o.cl && (!o.g || !o.f)) out.push({ msg: "Le " + f.n.toLowerCase() + " porte "
      + o.cl + " salles de classe mais aucun WC " + (!o.g ? "garçons" : "filles"),
      sev: "w", ref: "2.10", ex: "", n: 0 });
  });
  /* emprise au sol : un niveau ne peut pas déborder le plateau retenu à l'implantation */
  FLOORS.forEach(function(f, i){
    var b = flBuilt(i);
    if(PLATE > 0 && b > PLATE + 1) out.push({ msg: "Le " + f.n.toLowerCase() + " demande "
      + fmt(Math.round(b)) + " m² d'emprise, circulation comprise, pour un plateau de "
      + fmt(PLATE) + " m² — il manque " + fmt(Math.round(b - PLATE)) + " m²",
      sev: "e", ref: "2.4", ex: "", n: 0 });
  });
  /* art. 2.6 : deux cages d'escalier dès 900 m² de surface d'étage */
  FLOORS.forEach(function(f, i){
    var a = flNet(i);
    if(a > 900) out.push({ msg: "Surface d'étage de " + fmt(Math.round(a)) + " m² au " + f.n.toLowerCase()
      + " : deux cages d'escalier compartimentées exigées", sev: "w", ref: "2.6", ex: "", n: 0 });
  });
  return out;
}
