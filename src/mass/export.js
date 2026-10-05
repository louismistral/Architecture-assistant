/* ============================================================================
   L'EXPORT DU MASSING VERS RHINO — UN FICHIER .3DM

   Le massing se compose ici ; il se poursuit dans Rhino, sur le relevé du
   géomètre. Ce module dit CE QUE contient le fichier (`piecesMassing()`, une
   fonction pure, vérifiable sous node) et l'écrit en .3dm (`dm3Massing()`)
   avec rhino3dm, que la vue charge au clic : le téléchargement est son affaire
   (`views/massing.js`).

   Un .3dm et non plus un .obj : l'OBJ ne porte pas d'unité, et Rhino l'ouvrait
   en millimètres — dix fois trop petit. Le .3dm se déclare en CENTIMÈTRES et
   arrive avec ses calques, sans case à cocher.

   LE REPÈRE est celui de `DOC/site_plan.3dm` en plan, et c'est tout ce qui
   compte : le fichier s'y pose EN PLACE, sans rien déplacer. `RHINO`, écrit
   dans site.js par le script qui fait le chemin inverse, en donne l'origine et
   l'unité. Z monte, son zéro à `RHINO.z0` = 465 m : 300 = 468,00 m. Ce repère a
   l'allure du LV95 sans en être (docs/releve.md) ; on n'en a pas besoin
   d'autre pour se superposer au relevé. L'import (`mass/import.js`) relit le
   même repère.

   CE QU'IL CONTIENT, un calque Rhino par groupe :

     Niveau_<nom>  chaque étage de chaque volume, en maillage FERMÉ — huit
                   sommets, six faces, normales vers l'extérieur —, à son
                   altitude : `etagesDe()`, que lit aussi la 3D. Les passerelles
                   vont avec le niveau qu'elles desservent ;
     Second_temps  la piscine et le local CAD, s'ils sont posés : ils ne portent
                   aucun niveau de la pile ;
     Architecture  toits, lanterneaux, auvents, rampes, sous-passages ;
     Perimetre     le périmètre du concours, polyligne fermée ;
     Recul_5m      la ligne de recul du PACom, `ligneRecul()` — les points que
                   le contrôle mesure à 5 m du bord, et pas un décalage refait.

   Les deux lignes sont DRAPÉES sur le terrain, un sommet au moins tous les deux
   mètres, le pas de la grille. Le fichier Rhino n'a pas de surface de terrain,
   rien que des courbes : y draper une ligne à la main est long, la remettre à
   plat est une commande (ProjectToCPlane).

   Les étages sont pris de plancher à plancher, dalle comprise, comme au mixer —
   sans le jour de 12 cm que la 3D laisse entre deux étages pour qu'on les
   compte, et sans l'acrotère, que la 3D ne dessine pas non plus. Les noms de
   calque et d'objet sont en ASCII : un nom accentué arrive mutilé selon la
   version de Rhino.
   ========================================================================= */
import { dec } from "../core/format.js";
import { reculVise } from "../data/cadre.js";
import { RULES } from "../data/rules.js";
import { PER, RHINO, SITE } from "../data/site.js";
import { coins, ligneRecul, terrain } from "./geom.js";
import { MASS, etagesDe, niveaux, partiOf, pontEtage, volNom } from "./model.js";
import { archiDe, faces } from "./archi.js";

/* Un nom sans accent ni espace : Rhino en fait un nom de calque ou d'objet.
   « 1ᵉʳ étage » devient « 1er_etage » — la décomposition de compatibilité
   ramène les lettres en exposant à leur lettre. */
export function nomObj(s){
  return String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "sans_nom";
}
/* Le rez s'appelle « Rez », comme dans le rail : « Rez-de-chaussée » est long
   pour un calque qu'on lit dans une colonne étroite. */
function nomNiveau(n){ return nomObj(n.lvl === 0 ? "Rez" : n.nom); }

/* Du dessin, en mètres, vers le fichier Rhino. Au millimètre : les positions
   du massing sont au décimètre, le reste serait du bruit. */
function mm(x){ return Math.round(x * 10) / 10; }
function X(x){ return mm(RHINO.x0 + RHINO.u * x); }
function Y(y){ return mm(RHINO.y0 + RHINO.u * y); }
function Z(z){ return mm(RHINO.u * (z - RHINO.z0)); }

function jour(d){
  function p2(n){ return (n < 10 ? "0" : "") + n; }
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
}

/* Ce que contient le fichier : `calques` dans l'ordre, `objets` — un maillage
   `{ nom, calque, v, f }` ou une polyligne `{ nom, calque, l }`, en
   coordonnées Rhino —, et `notes`, l'en-tête. `o.date` fixe la date — sans
   quoi deux exports du même massing ne se compareraient pas. */
export function piecesMassing(o){
  var date = (o && o.date) || new Date();
  var N = niveaux(), out = [], obj = null, nEt = 0, nPont = 0, calques = [];
  var recul = reculVise();
  var gRecul = "Recul_" + String(recul).replace(".", "_") + "m";

  function objet(nom, calque, o){
    if(calques.indexOf(calque) < 0) calques.push(calque);
    obj = Object.assign({ nom:nom, calque:calque }, o);
    out.push(obj);
  }
  function sommet(x, y, z){ obj.v.push([X(x), Y(y), Z(z)]); }
  /* Une boîte fermée : le dessous tourne à l'envers pour regarder le sol, le
     dessus et les quatre faces tournent dans le sens direct vus du dehors —
     c'est ce que Rhino lit comme des normales vers l'extérieur. */
  function boite(nom, groupe, rc, z0, z1){
    var q = coins(rc), s = 0, i;
    for(i = 0; i < 4; i++) s += q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1];
    if(s < 0) q = q.slice().reverse();
    objet(nom, groupe, { v:[], f:[[3, 2, 1, 0], [4, 5, 6, 7]] });
    q.forEach(function(p){ sommet(p[0], p[1], z0); });
    q.forEach(function(p){ sommet(p[0], p[1], z1); });
    for(i = 0; i < 4; i++){
      var j = (i + 1) % 4;
      obj.f.push([i, j, 4 + j, 4 + i]);
    }
  }
  /* Une polyligne FERMÉE, drapée : chaque côté recoupé au pas de la grille,
     chaque sommet à l'altitude du terrain. */
  function ligne(nom, groupe, P){
    var pas = SITE.grid ? SITE.grid.pas : 2, pts = [], i, k;
    var fermee = P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1];
    var Q = fermee ? P : P.concat([P[0]]);
    for(i = 0; i + 1 < Q.length; i++){
      var a = Q[i], c = Q[i + 1];
      var n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / pas));
      for(k = 0; k < n; k++)
        pts.push([a[0] + (c[0] - a[0]) * k / n, a[1] + (c[1] - a[1]) * k / n]);
    }
    objet(nom, groupe, { l:[] });
    pts.forEach(function(p){ obj.l.push([X(p[0]), Y(p[1]), Z(terrain(p[0], p[1]))]); });
    obj.l.push(obj.l[0]);
  }

  /* --- les volumes, niveau par niveau, du plus bas au plus haut --- */
  var corps = [];
  N.forEach(function(n){
    var g = "Niveau_" + nomNiveau(n);
    MASS.vol.forEach(function(v, k){
      if(v.ph) return;
      etagesDe(v).forEach(function(s){
        if(s.e.i !== n.i) return;
        corps.push(function(){
          boite(nomObj(volNom(v, k)) + "_" + nomNiveau(n), g, s.rc, s.z0, s.z1);
        });
        nEt++;
      });
    });
    (MASS.pont || []).forEach(function(p){
      if(p.i !== n.i) return;
      var s = pontEtage(p);
      if(!s) return;
      var ka = -1, kb = -1;
      MASS.vol.forEach(function(v, k){ if(v.id === p.a) ka = k; if(v.id === p.b) kb = k; });
      corps.push(function(){
        boite("Passerelle_" + nomObj(volNom(MASS.vol[ka], ka)) + "_"
          + nomObj(volNom(MASS.vol[kb], kb)) + "_" + nomNiveau(n), g, s.rc, s.z0, s.z1);
      });
      nPont++;
    });
  });
  /* --- le second temps : il ne porte aucun niveau de la pile --- */
  MASS.vol.forEach(function(v, k){
    if(!v.ph) return;
    etagesDe(v).forEach(function(s){
      corps.push(function(){ boite(nomObj(volNom(v, k)), "Second_temps", s.rc, s.z0, s.z1); });
      nEt++;
    });
  });

  /* --- l'architecture : toits, lanterneaux, auvents, rampes, sous-passages --- */
  MASS.vol.forEach(function(v, k){
    archiDe(v).forEach(function(c, j){
      corps.push(function(){
        objet(nomObj(volNom(v, k)) + "_" + c.k + "_" + (j + 1), "Architecture", { v:[], f:[] });
        faces(c).forEach(function(f){
          var b = obj.v.length;
          f.forEach(function(p){ sommet(p[0], p[1], p[2]); });
          obj.f.push([b, b + 1, b + 2, b + 3]);
        });
      });
    });
  });

  /* --- l'en-tête : ce que le fichier est, et comment l'ouvrir ---
     Le parti que l'Auto a retenu n'est connu qu'après un tirage : une
     volumétrie relue d'un enregistrement ne le porte plus, on dit alors Auto. */
  var pid = MASS.vol.parti || MASS.parti;
  var parti = nomObj(partiOf(pid).n).replace(/_/g, " ")
    + (MASS.parti === "auto" && pid !== "auto" ? " (Auto)" : "");
  var notes = [
    "Centre scolaire de Saxon - massing",
    "Exporte le " + jour(date) + " depuis l'onglet Massing",
    "Parti : " + parti + "  -  Seed : " + (MASS.graine >>> 0).toString(36),
    "Unites : centimetres. Z vers le haut, zero a " + RHINO.z0 + " m (300 = " + (RHINO.z0 + 3) + ",00 m).",
    "Repere : celui du releve DOC/site_plan.3dm, ou le fichier se pose en place :",
    "  X = " + RHINO.x0.toFixed(2) + " + " + RHINO.u + " * x,  Y = " + RHINO.y0.toFixed(2)
      + " + " + RHINO.u + " * y,  Z = " + RHINO.u + " * (z - " + RHINO.z0 + ")",
    "  (x, y en metres, origine au coin sud-ouest du perimetre ; z altitude en metres)",
    "Contenu :",
    "  Niveau_*      un maillage ferme par etage de chaque volume - 8 sommets, 6 faces,",
    "                normales vers l'exterieur -, de plancher a plancher, murs compris ;",
    "                passerelles comprises, au niveau qu'elles desservent",
    "  Second_temps  piscine et local CAD, s'ils sont poses",
    "  Perimetre     perimetre du concours, polyligne fermee drapee sur le terrain",
    "  " + (gRecul + "            ").slice(0, 14) + "recul PACom de " + String(recul).replace(".", ",")
      + " m, polyligne(s) fermee(s) drapee(s) sur le terrain",
    "Non modelises : l'acrotere (" + dec(RULES.haut.acrotere)
      + " m), le programme a l'interieur des volumes.",
    MASS.vol.length + " volumes, " + nEt + " etages, " + nPont + " passerelles."
  ];
  corps.forEach(function(f){ f(); });

  /* --- le périmètre et le recul --- */
  ligne("Perimetre", "Perimetre", PER);
  ligneRecul(recul).forEach(function(b, k, T){
    ligne(gRecul + (T.length > 1 ? "_" + (k + 1) : ""), gRecul, b);
  });
  return { calques:calques, objets:out, notes:notes };
}

/* Le fichier .3dm, en octets. `rh` est rhino3dm, chargé par l'appelant. */
export function dm3Massing(rh, o){
  var P = piecesMassing(o), doc = new rh.File3dm(), idx = {};
  doc.settings().modelUnitSystem = rh.UnitSystem.Centimeters;
  doc.strings().set("Saxon massing", P.notes.join("\n"));
  P.calques.forEach(function(nom){
    var L = new rh.Layer();
    L.name = nom;
    idx[nom] = doc.layers().add(L);
  });
  P.objets.forEach(function(x){
    var att = new rh.ObjectAttributes(), g;
    att.name = x.nom;
    att.layerIndex = idx[x.calque];
    if(x.l) g = new rh.PolylineCurve(x.l);
    else {
      g = new rh.Mesh();
      x.v.forEach(function(p){ g.vertices().add(p[0], p[1], p[2]); });
      x.f.forEach(function(f){ g.faces().addQuadFace(f[0], f[1], f[2], f[3]); });
      g.normals().computeNormals();
      g.compact();
    }
    doc.objects().add(g, att);
  });
  var octets = doc.toByteArray();
  doc.delete();
  return octets;
}
