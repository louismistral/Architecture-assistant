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

   CE QU'IL CONTIENT, rangé selon la CONVENTION DE CALQUES (`data/calques.js`,
   docs/echange.md) :

     3D::Projet::Volume::<chapitre>::Niveau_<nom>
                   chaque étage de chaque volume, en maillage FERMÉ — huit
                   sommets, six faces, normales vers l'extérieur —, à son
                   altitude : `etagesDe()`, que lit aussi la 3D. Le chapitre est
                   celui de ses postes (la salle de sport), sinon celui qui
                   porte le plus de surface au niveau. Les passerelles vont avec
                   le niveau qu'elles desservent ; la piscine et le local CAD,
                   qui ne portent aucun niveau de la pile, dans `Second_temps` ;
     3D::Projet::Architecture
                   toits, lanterneaux, auvents, rampes, sous-passages ;
     AIDE::Perimetre, AIDE::Recul_5m
                   le périmètre du concours, polyligne fermée, et la ligne de
                   recul du PACom, `ligneRecul()` — les points que le contrôle
                   mesure à 5 m du bord, et pas un décalage refait.

   LA COULEUR DIT QUI (`ACTEURS`, `data/calques.js`), forcée sur l'objet : un
   corps de l'algorithme en ORANGE — une nuance par niveau, pour les lire —,
   un corps qu'une IA a composé (`v.par = "ia"`) en BLEU, un corps qu'un
   humain a touché (`v.par = "humain"`) en couleur du calque, qui est grise.
   Le périmètre et le recul viennent du relevé et du règlement : humains. Le
   fichier dit aussi de quelle variante il part (`Saxon variante`) : l'import
   la reprend pour mère.

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
import { coins, ligneRecul, terrain, unionRects } from "./geom.js";
import { MASS, dessinDe, etagesDe, fusionne, niveaux, partiOf, partsDe, pontEtage, postesDe, volNom } from "./model.js";
import { PMAP } from "../mix/prog.js";
import { CALQUE, SEP, chemin, couleur } from "../data/calques.js";
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
/* Le chapitre d'un étage : celui de ses postes s'il en nomme (la salle de
   sport, le second temps), sinon celui qui porte le plus de surface au niveau
   — un corps d'école porte sa part de chaque poste du niveau (`postesDe`),
   hors ceux qui ont leur propre corps (`solid`, la salle de sport). */
function chapDe(keys, i){
  var A = {}, best = null;
  if(keys && keys.length) keys.forEach(function(k){ if(PMAP[k]) A[PMAP[k].chap] = (A[PMAP[k].chap] || 0) + 1; });
  else postesDe(i).forEach(function(p){ var q = PMAP[p.key]; if(q && !q.solid) A[q.chap] = (A[q.chap] || 0) + p.a; });
  for(var c in A) if(best == null || A[c] > A[best]) best = c;
  return nomObj(best || "Projet");
}

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
  var N = niveaux(), out = [], obj = null, nEt = 0, nPont = 0, calques = [], par = "algo", nuance = 0;
  var recul = reculVise();
  var gRecul = "Recul_" + String(recul).replace(".", "_") + "m";

  function objet(nom, calque, o){
    if(calques.indexOf(calque) < 0) calques.push(calque);
    obj = Object.assign({ nom:nom, calque:calque, par:par, k:nuance }, o);
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
  /* Un niveau FUSIONNÉ : un seul maillage fermé sur le contour de l'union —
     le mur commun n'y est pas. Dessus et dessous pavés des cellules de la
     grille de l'union, côtés sur ses bords : tous les sommets sont des nœuds
     de la grille, le maillage reste étanche, sans sommet en T. */
  function prisme(nom, groupe, v, e, z0, z1){
    var m = RULES.haut.mur, c = Math.cos(v.a), sn = Math.sin(v.a), id = {};
    var U = unionRects(partsDe(e).map(function(p){
      return { x0:p.dx - p.w / 2 - m, x1:p.dx + p.w / 2 + m, y0:p.dy - p.d / 2 - m, y1:p.dy + p.d / 2 + m }; }));
    objet(nom, groupe, { v:[], f:[] });
    function k(x, y, z){
      var cle = x + "," + y + "," + z;
      if(id[cle] == null){ id[cle] = obj.v.length; sommet(v.x + x * c - y * sn, v.y + x * sn + y * c, z); }
      return id[cle];
    }
    var G = U.grille, i, j;
    for(i = 0; i < G.xs.length - 1; i++) for(j = 0; j < G.ys.length - 1; j++){
      if(!G.en(i, j)) continue;
      var x0 = G.xs[i], x1 = G.xs[i + 1], y0 = G.ys[j], y1 = G.ys[j + 1];
      obj.f.push([k(x0, y1, z0), k(x1, y1, z0), k(x1, y0, z0), k(x0, y0, z0)]);
      obj.f.push([k(x0, y0, z1), k(x1, y0, z1), k(x1, y1, z1), k(x0, y1, z1)]);
    }
    /* un bord a l'intérieur à sa gauche : sa face regarde à droite, dehors */
    U.bords.forEach(function(b){
      obj.f.push([k(b[0][0], b[0][1], z0), k(b[1][0], b[1][1], z0), k(b[1][0], b[1][1], z1), k(b[0][0], b[0][1], z1)]);
    });
  }
  /* UN CORPS POSÉ SUR UN CORPS DU MÊME BÂTIMENT, qui lui cède la part commune : son
     emprise privée de celle de l'autre (`dessinDe`), des morceaux convexes, en UN
     maillage fermé qui touche l'autre sans le recouper. Chaque morceau se recoupe aux
     sommets des autres posés sur ses côtés — pas de sommet en T, le maillage reste
     étanche ; dessus et dessous en éventail depuis son centre ; côtés le long des
     seuls côtés qu'aucun autre morceau ne longe en sens contraire. */
  function massif(nom, groupe, L, z0, z1){
    var id = {}, pts = [];
    function cle(p){ return Math.round(p[0] * 1e4) + "," + Math.round(p[1] * 1e4); }
    L.forEach(function(P){ P.forEach(function(p){ var k = cle(p); if(id[k] == null){ id[k] = pts.length; pts.push(p); } }); });
    var N = pts.length, A = [], dir = {};
    objet(nom, groupe, { v:[], f:[] });
    pts.forEach(function(p){ sommet(p[0], p[1], z0); });
    pts.forEach(function(p){ sommet(p[0], p[1], z1); });
    L.forEach(function(P){
      var R = [], cx = 0, cy = 0, i;
      P.forEach(function(a, k){
        var b = P[(k + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), sur = [];
        R.push(id[cle(a)]);
        pts.forEach(function(p, j){
          var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (l * l);
          if(t > 1e-6 && t < 1 - 1e-6 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l < 1e-4) sur.push([t, j]);
        });
        sur.sort(function(x, y){ return x[0] - y[0]; }).forEach(function(x){ R.push(x[1]); });
      });
      R = R.filter(function(k, j){ return k !== R[(j + 1) % R.length]; });
      R.forEach(function(k){ cx += pts[k][0] / R.length; cy += pts[k][1] / R.length; });
      var c0 = obj.v.length;
      sommet(cx, cy, z0); sommet(cx, cy, z1);
      for(i = 0; i < R.length; i++){
        var a = R[i], b = R[(i + 1) % R.length];
        obj.f.push([c0 + 1, N + a, N + b, N + b], [c0, b, a, a]);
        dir[a + ">" + b] = 1; A.push([a, b]);
      }
    });
    A.forEach(function(x){ if(!dir[x[1] + ">" + x[0]]) obj.f.push([x[0], x[1], N + x[1], N + x[0]]); });
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
  /* l'acteur d'un corps : l'algorithme, sauf si une IA ou un humain l'a touché */
  function de(v, kk, f){ return function(){ par = v.par || "algo"; nuance = kk; f(); par = "algo"; nuance = 0; }; }
  N.forEach(function(n){
    function g(keys){ return chemin(CALQUE.volume, chapDe(keys, n.i), "Niveau_" + nomNiveau(n)); }
    MASS.vol.forEach(function(v, k){
      if(v.ph) return;
      etagesDe(v).forEach(function(s){
        if(s.e.i !== n.i) return;
        corps.push(de(v, N.length > 1 ? N.indexOf(n) / (N.length - 1) : 0, function(){
          var nom = nomObj(volNom(v, k)) + "_" + nomNiveau(n), D = dessinDe(v, s.e, MASS.vol);
          if(D && D.garde.length) massif(nom, g(s.e.keys), D.emprise, s.z0, s.z1);
          else if(fusionne(s.e)) prisme(nom, g(s.e.keys), v, s.e, s.z0, s.z1);
          else boite(nom, g(s.e.keys), s.rc, s.z0, s.z1);
          /* ce que la géométrie ne dit pas, et que l'import relit : le corps, son
             bâtiment, et la boîte d'origine de celui qu'on a découpé */
          obj.us = { "Saxon corps":v.id };
          if(v.bat) obj.us["Saxon bat"] = v.bat;
          if(D && D.garde.length) obj.us["Saxon boites"] = JSON.stringify(s.rcs.map(function(r){
            return { x:r.x, y:r.y, w:r.w, d:r.d, a:r.a, z0:s.z0, z1:s.z1 }; }));
        }));
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
          + nomObj(volNom(MASS.vol[kb], kb)) + "_" + nomNiveau(n), g(null), s.rc, s.z0, s.z1);
      });
      nPont++;
    });
  });
  /* --- le second temps : il ne porte aucun niveau de la pile --- */
  MASS.vol.forEach(function(v, k){
    if(!v.ph) return;
    etagesDe(v).forEach(function(s){
      corps.push(de(v, .5, function(){
        boite(nomObj(volNom(v, k)), chemin(CALQUE.volume, chapDe(s.e.keys, s.e.i), "Second_temps"), s.rc, s.z0, s.z1);
      }));
      nEt++;
    });
  });

  /* --- l'architecture : toits, lanterneaux, auvents, rampes, sous-passages --- */
  MASS.vol.forEach(function(v, k){
    archiDe(v).forEach(function(c, j){
      corps.push(de(v, 1, function(){
        objet(nomObj(volNom(v, k)) + "_" + c.k + "_" + (j + 1), CALQUE.architecture, { v:[], f:[] });
        faces(c).forEach(function(f){
          var b = obj.v.length;
          f.forEach(function(p){ sommet(p[0], p[1], p[2]); });
          obj.f.push([b, b + 1, b + 2, b + 3]);
        });
      }));
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
    "Calques : la convention du projet (docs/echange.md) - AIDE, BLOCKS, 2D, 3D, AUTRE.",
    "  3D::Projet::Volume::<chapitre>::Niveau_*",
    "                un maillage ferme par etage de chaque volume - 8 sommets, 6 faces,",
    "                normales vers l'exterieur -, de plancher a plancher, murs compris ;",
    "                un volume fusionne (L, U, cour) : un maillage ferme sur son contour ;",
    "                passerelles comprises, au niveau qu'elles desservent ;",
    "                ::Second_temps : piscine et local CAD, s'ils sont poses.",
    "                SEUL CE CALQUE EST RELU par l'import du massing.",
    "  3D::Projet::Architecture  toits, auvents, rampes - exportes, pas relus",
    "  AIDE::Perimetre           perimetre du concours, polyligne fermee drapee sur le terrain",
    "  AIDE::" + (gRecul + "            ").slice(0, 19) + "recul PACom de " + String(recul).replace(".", ",")
      + " m, polyligne(s) fermee(s) drapee(s)",
    "Couleur = l'acteur : ORANGES = l'algorithme, BLEUS = une IA, GRIS (couleur du calque) =",
    "  un humain. Ce que vous retouchez, passez-le en couleur Par calque ; une IA dessine en bleu.",
    o && o.variante ? "Variante source : " + o.variante : "Variante source : aucune (etat non enregistre)",
    "Non modelises : l'acrotere (" + dec(RULES.haut.acrotere)
      + " m), le programme a l'interieur des volumes.",
    MASS.vol.length + " volumes, " + nEt + " etages, " + nPont + " passerelles."
  ];
  corps.forEach(function(f){ f(); });

  /* --- le périmètre et le recul --- */
  par = "humain";
  ligne("Perimetre", chemin(CALQUE.aide, "Perimetre"), PER);
  ligneRecul(recul).forEach(function(b, k, T){
    ligne(gRecul + (T.length > 1 ? "_" + (k + 1) : ""), chemin(CALQUE.aide, gRecul), b);
  });
  return { calques:calques, objets:out, notes:notes, variante:(o && o.variante) || null };
}

/* Le fichier .3dm, en octets. `rh` est rhino3dm, chargé par l'appelant. */
export function dm3Massing(rh, o){
  var P = piecesMassing(o), doc = new rh.File3dm(), idx = {};
  doc.settings().modelUnitSystem = rh.UnitSystem.Centimeters;
  doc.strings().set("Saxon massing", P.notes.join("\n"));
  if(P.variante) doc.strings().set("Saxon variante", P.variante);
  /* un calque et chacun de ses parents, dans l'ordre de l'arbre */
  function calque(ch){
    if(idx[ch] != null) return idx[ch];
    var k = ch.lastIndexOf(SEP), L = new rh.Layer();
    L.name = k < 0 ? ch : ch.slice(k + SEP.length);
    /* un calque est gris : ce qu'on y dessine « Par calque » est humain */
    var g = couleur("humain", .15);
    L.color = { r:g[0], g:g[1], b:g[2], a:255 };
    if(k >= 0) L.parentLayerId = doc.layers().get(calque(ch.slice(0, k))).id;
    return (idx[ch] = doc.layers().add(L));
  }
  P.calques.forEach(calque);
  P.objets.forEach(function(x){
    var att = new rh.ObjectAttributes(), g;
    att.name = x.nom;
    att.layerIndex = idx[x.calque];
    for(var u in x.us || {}) att.setUserString(u, x.us[u]);
    if(x.par !== "humain"){
      var c = couleur(x.par, x.k);
      att.colorSource = rh.ObjectColorSource.ColorFromObject;
      att.objectColor = { r:c[0], g:c[1], b:c[2], a:255 };
    }
    if(x.l) g = new rh.PolylineCurve(x.l);
    else {
      g = new rh.Mesh();
      x.v.forEach(function(p){ g.vertices().add(p[0], p[1], p[2]); });
      x.f.forEach(function(f){ if(f[2] === f[3]) g.faces().addTriFace(f[0], f[1], f[2]); else g.faces().addQuadFace(f[0], f[1], f[2], f[3]); });
      g.normals().computeNormals();
      g.compact();
    }
    doc.objects().add(g, att);
  });
  var octets = doc.toByteArray();
  doc.delete();
  return octets;
}
