/* ============================================================================
   LE CONCEPT — d'une volumétrie valide à un projet d'architecture.

   Une composition qui tient le cadre n'est encore qu'un jeu de boîtes. Ici,
   on lui donne UNE idée, tirée de ce qu'elle est — son parti, sa pente, ses
   profondeurs —, et l'on ne retient que les opérations qui la servent :
   toiture, entrées, coursives, rampe, verrière, porte-à-faux, gradins,
   sous-passage. Chaque opération dit POURQUOI elle est là.

   Rien n'est tiré au hasard sinon le choix entre deux idées que le parti
   admet. Le cadre tient toujours : un débord qui l'enfreint est rendu
   (`tient()`), un élément extérieur qui sortirait du recul est retiré.
   ========================================================================= */
import { PER } from "../data/site.js";
import { recul } from "../data/cadre.js";
import { RULES } from "../data/rules.js";
import { terrain, tientA } from "./geom.js";
import { etagesDe, volNom } from "./model.js";
import { archiDe, jeuNiveaux } from "./archi.js";

var R = RULES.archi, SUD = -Math.PI / 2;

/* Les idées, et ce qu'elles veulent dire. */
export var CONCEPTS = {
  cour:      { n:"La cour comme cœur",
               idee:"Les corps se tournent tous vers la cour : elle est le hall à ciel ouvert de "
                 + "l'école, le lieu d'arrivée, de récréation et de surveillance." },
  paysage:   { n:"Le bâtiment-paysage",
               idee:"Le bâtiment prolonge le coteau : on y entre par le haut, il descend en "
                 + "gradins avec la pente, ses toits sont du terrain." },
  pavillons: { n:"Le village de pavillons",
               idee:"Une école à l'échelle de l'enfant : des maisons distinctes autour d'une "
                 + "place, chacune avec son toit et son seuil." },
  lumiere:   { n:"La lumière au cœur",
               idee:"Un plan compact et profond, ouvert par le haut : la lumière zénithale fait "
                 + "le centre de l'école, là où la façade n'arrive pas." },
  suspendue: { n:"La barre suspendue",
               idee:"Une longue barre décollée du sol : elle laisse passer la cour dessous, son "
                 + "porte-à-faux marque l'entrée de loin." }
};
/* Ce que chaque parti admet — deux idées, pour que deux tirages du même parti
   ne racontent pas la même chose. */
var PAR_PARTI = {
  cour:["cour", "paysage"], U:["cour", "suspendue"], L:["cour", "suspendue"],
  pavillons:["pavillons", "paysage"], hameau:["pavillons", "paysage"],
  barre:["suspendue", "lumiere"], barres:["suspendue", "cour"], peigne:["suspendue", "lumiere"],
  terrasses:["paysage", "cour"], compact:["lumiere", "suspendue"]
};

/* ---------- ce qu'on lit sur un corps -------------------------------------- */
function etages(v){ return etagesDe(v).filter(function(s){ return s.n.lvl >= 0; }); }
function rez(v){ return etages(v)[0]; }
function prof(v){ var r = rez(v).rc; return Math.min(r.w, r.d); }
function long(v){ var r = rez(v).rc; return Math.max(r.w, r.d); }
function surf(v){ return etages(v).reduce(function(s, e){ return s + e.e.w * e.e.d; }, 0); }
/* le milieu de la façade s, et sa normale */
function face(v, s){
  var rc = rez(v).rc, a = rc.a + s * Math.PI / 2, h = (s % 2 ? rc.d : rc.w) / 2;
  return { x:rc.x + Math.cos(a) * h, y:rc.y + Math.sin(a) * h, a:a };
}
function meilleure(v, note){
  var b = 0, m = -Infinity;
  for(var s = 0; s < 4; s++){ var n = note(face(v, s)); if(n > m){ m = n; b = s; } }
  return b;
}
function vers(v, p){ return meilleure(v, function(f){ return Math.cos(f.a) * (p.x - f.x) + Math.sin(f.a) * (p.y - f.y); }); }
function cap(v, a){ return meilleure(v, function(f){ return Math.cos(f.a - a); }); }
function haute(v){ return meilleure(v, function(f){ return terrain(f.x, f.y); }); }
function basse(v){ return meilleure(v, function(f){ return -terrain(f.x, f.y); }); }
function denivele(v){
  var z = [0, 1, 2, 3].map(function(s){ var f = face(v, s); return terrain(f.x, f.y); });
  return Math.max.apply(null, z) - Math.min.apply(null, z);
}
function m(x){ return (Math.round(x * 10) / 10).toString().replace(".", ","); }

/* Concevoir : pose `v.ar` (et les débords) sur chaque corps, rend le concept
   et ses raisons. `r` est le tirage, `tient()` le cadre entier. */
export function concevoir(vols, r, tient){
  var ecole = vols.filter(function(v){ return !v.fix && !v.ph && etages(v).length; });
  if(!ecole.length) return null;
  var nom = function(v){ return volNom(v, vols.indexOf(v)); };
  var C = { x:0, y:0 };
  ecole.forEach(function(v){ C.x += v.x / ecole.length; C.y += v.y / ecole.length; });
  var principal = ecole.slice().sort(function(a, b){ return surf(b) - surf(a); })[0];
  var pente = Math.max.apply(null, ecole.map(denivele));
  var choix = (PAR_PARTI[vols.parti] || Object.keys(CONCEPTS)).slice();
  if(pente > 1.5 && choix.indexOf("paysage") < 0) choix.push("paysage");
  var id = choix[Math.floor(r() * choix.length)];
  var ops = [];
  function dit(n, txt){ ops.push({ n:n, txt:txt }); }
  vols.forEach(function(v){ v.ar = {}; });
  function ar(v, o){ Object.assign(v.ar, o); }
  /* un débord, rendu s'il fait enfreindre le cadre */
  function deborde(v, f){
    var av = v.lv.map(function(e){ return [e.dx || 0, e.dy || 0]; });
    f();
    if(tient()) return true;
    v.lv.forEach(function(e, k){ e.dx = av[k][0]; e.dy = av[k][1]; });
    return false;
  }

  if(id === "cour"){
    ecole.forEach(function(v){ ar(v, { entree:vers(v, C), toit:"plat" }); });
    dit("Entrées sur la cour", "Toutes les entrées donnent sur la cour, sous un auvent : un seul lieu "
      + "d'arrivée, que l'on surveille d'un regard, et la cour devient le hall de l'école.");
    var hauts = ecole.filter(function(v){ return etages(v).length > 1; });
    hauts.forEach(function(v){ ar(v, { galerie:vers(v, C) }); });
    if(hauts.length) dit("Coursives", "Les étages de " + hauts.map(nom).join(", ") + " se desservent "
      + "par des coursives sur la cour : la circulation est dehors, à l'abri, la cour se lit habitée à "
      + "tous les niveaux, et le débord ombre les classes du dessous en été.");
    var bas = ecole.slice().sort(function(a, b){ return etages(a).length - etages(b).length; })[0];
    ar(bas, { toit:"terrasse" });
    dit("Toit-terrasse", nom(bas) + ", le corps le plus bas, a un toit accessible : une seconde cour, "
      + "en hauteur et protégée, pour les plus petits ou une classe dehors.");
  }
  else if(id === "paysage"){
    ecole.forEach(function(v){ ar(v, { toit:"vert", entree:haute(v) }); });
    dit("Toits végétalisés", "Vus du coteau, les toits sont du terrain : les volumes se fondent dans la "
      + "pente, retiennent la pluie et protègent du chaud le dernier étage.");
    dit("Entrées par le haut", "Chaque corps s'entre par sa façade la plus haute, de plain-pied : la "
      + "pente fait le seuil (" + m(pente) + " m de dénivelé sous l'emprise la plus pentue).");
    ar(principal, { rampe:basse(principal) });
    dit("Rampe", "Une rampe à " + Math.round(R.rampe.pente * 100) + " % longe la façade aval de "
      + nom(principal) + " : le bas du terrain rejoint l'école sans marche (SIA 500).");
    var gr = ecole.filter(function(v){
      return etages(v).length > 1 && deborde(v, function(){ jeuNiveaux(v, 2); });
    });
    if(gr.length) dit("Gradins", "Les étages de " + gr.map(nom).join(", ") + " glissent en quinconce "
      + "avec la pente : chaque niveau gagne une terrasse sur le toit du dessous et sa propre vue.");
  }
  else if(id === "pavillons"){
    ecole.forEach(function(v){ ar(v, { toit:"deux", entree:vers(v, C) }); });
    dit("Toits à deux pans", "Chaque pavillon porte son toit à deux pans : une échelle de maison, "
      + "lisible par l'enfant, celle des granges de la plaine du Rhône.");
    dit("Un seuil par pavillon", "Chaque pavillon a son entrée couverte tournée vers le centre : les "
      + "auvents se répondent et l'espace entre eux devient la place du village.");
    var pr = ecole.filter(function(v){ return prof(v) >= 14; });
    pr.forEach(function(v){ ar(v, { puits:Math.max(1, Math.round(long(v) / 12)) }); });
    if(pr.length) dit("Lanterneaux au faîte", pr.map(nom).join(", ") + " : trop profonds pour la "
      + "seule façade, ils prennent la lumière par le faîte.");
  }
  else if(id === "lumiere"){
    var pf = ecole.slice().sort(function(a, b){ return prof(b) - prof(a); })[0];
    ar(pf, { atrium:1, toit:"plat" });
    dit("Verrière", "Au cœur de " + nom(pf) + " (" + m(prof(pf)) + " m de profondeur), une verrière "
      + "ouvre un vide sur toute la hauteur : le centre du plan, à " + m(prof(pf) / 2) + " m de la "
      + "façade, reçoit la lumière du ciel, et le hall devient l'espace commun de l'école.");
    var au = ecole.filter(function(v){ return v !== pf && prof(v) >= 14; });
    au.forEach(function(v){ ar(v, { toit:"plat", puits:Math.max(1, Math.round(long(v) / 12)) }); });
    if(au.length) dit("Lanterneaux", "Sur " + au.map(nom).join(", ") + " : la lumière tombe dans le "
      + "couloir central, qui n'a pas de façade.");
    ar(principal, { entree:cap(principal, SUD) });
    dit("Entrée au sud", "L'entrée principale de " + nom(principal) + " est au sud, sous un auvent de "
      + m(R.auvent.prof) + " m : on arrive au soleil, le seuil est à l'abri de la pluie.");
  }
  else {
    var b = ecole.slice().sort(function(a, b2){ return long(b2) - long(a); })[0];
    var s = vers(b, C), p = R.porteFaux[0] + Math.floor(r() * 4) * (R.porteFaux[1] - R.porteFaux[0]) / 3;
    var top = etages(b)[etages(b).length - 1].e;
    /* le débord visé, puis de plus en plus court tant que le cadre ne tient pas */
    var ok = false, p0 = p;
    [s, (s + 2) % 4].forEach(function(f){
      for(var q = p0; etages(b).length > 1 && !ok && q >= 1.5; q -= .5){
        ok = deborde(b, function(){
          if(f % 2) top.dy = (f === 1 ? 1 : -1) * q; else top.dx = (f === 0 ? 1 : -1) * q;
        });
        if(ok){ p = q; s = f; }
      }
    });
    ar(b, ok ? { entree:-1 } : { entree:s });
    dit(ok ? "Porte-à-faux sur l'entrée" : "Entrée couverte", ok
      ? "Le dernier étage de " + nom(b) + " déborde de " + m(p) + " m sur son entrée : le porte-à-faux "
        + "fait l'auvent de l'entrée sans rien ajouter, et la signale de loin."
      : "Le porte-à-faux ne tenait pas le cadre : l'entrée de " + nom(b) + " est couverte d'un auvent.");
    if(long(b) >= 24){
      ar(b, { sous:1 });
      dit("Sous-passage", "Le rez de " + nom(b) + " est traversé de part en part : le sol reste continu "
        + "de la rue à la cour, la barre de " + m(long(b)) + " m ne fait pas mur.");
    }
    ecole.forEach(function(v){
      ar(v, { toit:"plat", puits:prof(v) >= 14 ? Math.max(1, Math.round(long(v) / 12)) : 0 });
      if(v !== b) ar(v, { entree:vers(v, C) });
    });
    dit("Toit plat et lanterneaux", "La barre reste une ligne nette ; la lumière descend par le toit "
      + "dans le couloir des corps profonds.");
  }

  /* ce qui vaut pour toute idée */
  vols.forEach(function(v){
    if(v.fix) ar(v, { toit:"shed", entree:vers(v, C) });
    else if(v.ph) ar(v, { toit:"vert" });
  });
  if(vols.some(function(v){ return v.fix; }))
    dit("Sheds au nord", "La salle de sport est couverte de sheds dont les vitrages regardent le nord : "
      + "une lumière égale sur toute la portée, sans éblouissement pour le jeu ni surchauffe.");
  if((vols.ponts || []).length)
    dit("Passerelles", (vols.ponts.length > 1 ? vols.ponts.length + " passerelles relient" : "Une "
      + "passerelle relie") + " les corps à l'étage : l'école reste d'un seul tenant sans sortir.");

  /* un élément dehors qui sortirait du recul n'est pas posé, et on le dit */
  var NOMS = { entree:"l'auvent", rampe:"la rampe", galerie:"les coursives" }, retires = [];
  vols.forEach(function(v){
    archiDe(v).forEach(function(c){
      if(!NOMS[c.k] || v.ar[c.k] < 0 || tientA(PER, rectDe(c), recul() - .01)) return;
      v.ar[c.k] = -1; retires.push(NOMS[c.k] + " de " + nom(v));
    });
  });
  if(retires.length) dit("Au recul", "Non posé" + (retires.length > 1 ? "s" : "") + ", car hors du recul : "
    + retires.join(", ") + ".");
  return { id:id, n:CONCEPTS[id].n, idee:CONCEPTS[id].idee, ops:ops };
}
function rectDe(c){
  var u = (c.b[0] + c.b[1]) / 2, w = (c.b[2] + c.b[3]) / 2, k = Math.cos(c.F.a), s = Math.sin(c.F.a);
  return { x:c.F.x + u * k - w * s, y:c.F.y + u * s + w * k, w:c.b[1] - c.b[0], d:c.b[3] - c.b[2], a:c.F.a };
}
