/* ============================================================================
   CONTRÔLE D'UNE VOLUMÉTRIE
   Une proposition n'est jamais refusée : elle est dite. Chaque règle de
   `data/rules.js` qui se vérifie sur des volumes est vérifiée ici, et rend un
   avertissement — `e` quand la règle est écrite au règlement ou à l'AEAI, `w`
   quand c'est une règle de projet ou une marge qui se discute.

   Même vocabulaire que `plan/niv.js` : { sev, msg, ref, ex }.
   ========================================================================= */
import { dec, fmt } from "../core/format.js";
import { RULES } from "../data/rules.js";
import { NAPPE, PERAIRE } from "../data/site.js";
import { terrain, vmid, volFits, volGap, volOver } from "./place.js";

/* Nombre de cages d'escalier qu'appelle une surface d'étage. */
export function cages(plate){
  return plate > RULES.feu.cageSeuil ? 2 : RULES.feu.cageMin;
}
/* Plus long parcours d'évacuation dans un plateau w × h desservi par `nc`
   cages réparties sur sa longueur : couloir central, cheminement orthogonal.
   C'est une estimation de volumétrie, pas un tracé de voies de fuite. */
export function fuite(w, h, nc){
  return w / (2 * nc) + h / 2;
}

/* Les volumes repris du plan interactif n'ont pas les champs du générateur :
   on les complète avant de contrôler, plutôt que de tester partout. */
function normal(V){
  return V.map(function(v){
    return { n:v.n, key:v.key || "", bat:v.bat || v.key || v.n, f:v.f,
             w:v.w, h:v.h, x:v.x, y:v.y, lv:v.lv || 1, hl:v.hl || 3.25,
             nz:v.nz != null ? v.nz : (v.lvl || 0), ph:v.ph || 1,
             sol:v.sol || 0, fix:v.fix || 0, prog:v.prog || 0 };
  });
}
export function massCheck(G){
  var out = [], V = normal(G.vols), P = G.prog, i, j;
  function say(sev, msg, ref, ex){ out.push({ sev:sev, msg:msg, ref:ref, ex:ex || "" }); }

  var bati = V.filter(function(v){ return !v.sol; });
  var hs = bati.filter(function(v){ return v.nz >= 0; });     /* hors sol */

  /* --- périmètre et recul ------------------------------------------------ */
  V.forEach(function(v){
    if(!volFits(v, v.x, v.y))
      say("e", "« " + v.n + " » sort du périmètre du concours ou s’en approche à moins de "
        + RULES.dist.retrait + " m", "2.3", v.n);
  });

  /* --- distance entre bâtiments (AEAI) ----------------------------------- */
  for(i = 0; i < hs.length; i++) for(j = i + 1; j < hs.length; j++){
    var a = hs[i], b = hs[j];
    if(a.bat === b.bat) continue;              /* deux corps d'un même bâtiment */
    var g = volGap(a, a.x, a.y, b);
    if(g < RULES.dist.entre - 1e-6)
      say("e", "« " + a.n + " » et « " + b.n + " » sont à " + dec(g, 1) + " m : les directives "
        + "AEAI en demandent " + RULES.dist.entre, "2.3", a.n);
  }

  /* --- protection incendie : cages et voies de fuite --------------------- */
  hs.forEach(function(v){
    if(v.ph === 2) return;                       /* le 2ᵉ temps n'est pas dessiné */
    var plate = v.w * v.h, nc = cages(plate);
    if(plate > RULES.feu.cageSeuil)
      say("w", "« " + v.n + " » fait " + fmt(Math.round(plate)) + " m² de surface d’étage : "
        + "deux cages d’escalier compartimentées sont exigées au-delà de "
        + RULES.feu.cageSeuil + " m²", "2.6", v.n);
    var d = fuite(v.w, v.h, nc);
    if(d > RULES.feu.fuiteDouble)
      say("e", "« " + v.n + " » : " + dec(d, 1) + " m de cheminement jusqu’à une cage, pour "
        + RULES.feu.fuiteDouble + " m au maximum même avec deux issues éloignées", "2.6", v.n);
    else if(d > RULES.feu.fuiteSimple)
      say("w", "« " + v.n + " » : " + dec(d, 1) + " m de cheminement jusqu’à une cage — au-delà "
        + "de " + RULES.feu.fuiteSimple + " m il faut deux issues éloignées l’une de l’autre",
        "2.6", v.n);
  });

  /* --- niveaux ----------------------------------------------------------- */
  hs.forEach(function(v){
    if(v.f === "cla" && v.lv > RULES.niv.classeMax + 1)
      say("w", "« " + v.n + " » monte à R+" + (v.lv - 1) + " : les classes ne devraient pas dépasser "
        + "le " + RULES.niv.classeMax + "ᵉ étage — évacuation et âge des élèves (9 à 12 ans)", "2.10", v.n);
  });

  /* --- hauteurs libres exigées ------------------------------------------- */
  V.forEach(function(v){
    if(v.key === "sport"){
      if(v.lv !== 1 || v.nz !== 0)
        say("e", "La salle de sport double demande 7 m libres sous structure : elle ne peut être "
          + "qu’au rez, sur un seul niveau", "2.10", v.n);
      if(Math.abs(v.w * v.h - P.hall) > P.hall * 0.02)
        say("e", "La salle de sport double est imposée à 28 × 32 m, soit " + fmt(P.hall)
          + " m² — le volume en fait " + fmt(Math.round(v.w * v.h)), "2.10", v.n);
    }
    if(v.key === "cad" && v.nz !== 0)
      say("e", "Le local de chauffage à distance est accessible de plain-pied par camion : "
        + "il reste au niveau du terrain", "2.10", v.n);
  });

  /* --- nappe phréatique --------------------------------------------------- */
  V.forEach(function(v){
    if(v.nz >= 0) return;
    var m = vmid(v), zt = terrain(m[0], m[1]), marge = zt - NAPPE;
    if(marge < RULES.dist.couverture)
      say("e", "Sous « " + v.n + " », le terrain est à " + dec(zt) + " m et la nappe à "
        + dec(NAPPE) + " m : " + dec(marge) + " m de couverture pour les "
        + dec(RULES.dist.couverture) + " m qu’exige une excavation. Pousse le volume vers l’est.",
        "2.3", v.n);
  });

  /* --- surfaces : elles sont fixes --------------------------------------- */
  V.forEach(function(v){
    if(!v.fix) return;
    var a = v.w * v.h * Math.max(1, v.lv);
    if(Math.abs(a - v.prog) > Math.max(4, v.prog * 0.02))
      say("e", "« " + v.n + " » : le programme fixe " + fmt(v.prog) + " m², le volume en offre "
        + fmt(Math.round(a)) + ". Les proportions se changent, pas la surface.", "2.10", v.n);
  });

  /* --- le programme entre-t-il ? ----------------------------------------- */
  var planch = 0, emp = 0;
  bati.forEach(function(v){
    if(v.ph === 2) return;
    planch += v.w * v.h * Math.max(1, v.lv);
    if(v.nz >= 0) emp = emp + v.w * v.h;
  });
  var besoin = P.besoin;
  if(planch < besoin - 1)
    say("e", "Il manque " + fmt(Math.round(besoin - planch)) + " m² de plancher : le programme bâti "
      + "bâti fait " + fmt(Math.round(P.net)) + " m² nets, soit " + fmt(Math.round(besoin))
      + " m² une fois les " + Math.round(P.circ * 100) + " % de circulation ajoutés aux locaux "
      + "qui en demandent", "2.10");
  else if(planch > besoin * 1.2)
    say("w", fmt(Math.round(planch - besoin)) + " m² de plancher au-delà du programme, soit "
      + Math.round((planch / besoin - 1) * 100) + " % : le règlement demande un principe "
      + "d’économicité et le respect des surfaces données", "2.7");

  /* --- ce que le terrain doit encore porter ------------------------------ */
  var ph2 = bati.filter(function(v){ return v.ph === 2; })
                .reduce(function(t, v){ return t + v.w * v.h; }, 0);
  var parc = RULES.ext.voitures * RULES.ext.mPlace;
  var reste = PERAIRE - emp - ph2;
  var du = P.cour + parc;
  if(reste < du)
    say("w", "Il reste " + fmt(Math.round(reste)) + " m² de terrain libre pour "
      + fmt(Math.round(du)) + " m² à poser : la cour de " + fmt(P.cour) + " m² et les "
      + RULES.ext.voitures + " places de parc. Les " + RULES.ext.velos + " vélos, les "
      + RULES.ext.bus + " dépose-bus et les " + RULES.ext.depose + " dépose-minute viennent en plus.",
      "2.4");

  /* --- le plein air ne se superpose pas au bâti --------------------------- */
  V.forEach(function(v){
    if(!v.sol) return;
    hs.forEach(function(b){
      if(b.ph === 2) return;
      if(volOver(v, v.x, v.y, b) > 0.5)
        say("e", "« " + v.n + " » recouvre « " + b.n + " » : le site n\u2019offre plus la surface "
          + "de plein air que le programme demande", "2.10", v.n);
    });
  });

  /* --- la cour ------------------------------------------------------------ */
  var cour = V.filter(function(v){ return v.key === "cour"; })[0];
  if(cour && cour.w * cour.h < P.cour - 1)
    say("w", "La cour dessinée fait " + fmt(Math.round(cour.w * cour.h)) + " m² pour les "
      + fmt(P.cour) + " m² du programme, préau couvert de 120 m² compris", "2.10");

  /* --- second temps ------------------------------------------------------- */
  if(!V.some(function(v){ return v.ph === 2; }))
    say("w", "La piscine et le local CAD ne sont pas représentés : le règlement demande de "
      + "réserver leurs surfaces en pointillé sur le plan de situation 1:500", "2.2");

  return out;
}
/* Verdict d'ensemble, pour le chrome : "ok" | "w" | "e". */
export function massVerdict(list){
  var e = 0, w = 0;
  list.forEach(function(k){ if(k.sev === "e") e++; else w++; });
  return { e:e, w:w, sev: e ? "e" : w ? "w" : "ok" };
}
