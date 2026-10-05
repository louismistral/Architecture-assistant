/* ============================================================================
   PARAMÈTRES & CONTRAINTES — TOUT CE QUI INFLUE SUR UNE VARIANTE, CLASSÉ

   Une ligne par décision, et un seul schéma pour toutes (`data/lignes.js`) :
   son sujet, son RÔLE, l'onglet où elle agit, sa source, qui la règle, sa
   valeur, sa force, et ce qu'elle dit de la composition à l'écran. On y lit
   d'un coup d'œil ce qui agit, où, pourquoi, et qui le règle.

   Cinq rubriques, qui se déplient niveau par niveau :

     CONTRAINTES   valide ou non, fixé de l'extérieur — le tag Intangible ;
     LEVIERS       ce que nous décidons pour borner la recherche : le bâtiment,
                   les surfaces à préciser du cahier, le moteur de recherche ;
     PRÉFÉRENCES   ce qui guide le moteur — Imposé, Prioritaire, Souhaité,
                   Indicatif ;
     ÉVALUATION    les mesures, puis le jugement : axe › sous-axe › critère ;
     DONNÉES       le contexte, nos hypothèses de construction.

   Une ligne suit son tag : Intangible ne se change pas ; passée d'Imposé à
   Souhaité, elle change de sous-niveau dans les préférences.

   Aucune copie : chaque contrôle lit et écrit la case même que les moteurs
   lisent — `V` pour les lignes, `mix/opts.js` et `mass/model.js` pour l'état
   des leviers, `core/model.js` pour le couloir et les surfaces à préciser.

   La même vue sert les volets « Contraintes » du mixer et du massing, filtrée
   sur l'onglet et coiffée d'un bouton qui rejoue le tirage : un seul dessin
   des lignes, où qu'on les lise.
   ========================================================================= */
import { dec, el, fmt } from "../core/format.js";
import { COULOIR, GRAND, PROG, VARITEMS, setCirc, setItemArea } from "../core/model.js";
import { curSeed } from "../core/rand.js";
import { RULES } from "../data/rules.js";
import {
  LIGNES, ONGLETS, QUI, ROLES, TAGS, V, actif, defaut, ligne, modifie, regler,
  retablir, roleDe, roleNom, setActif, setTag, sourceTxt, tagDe, tagInfo
} from "../data/lignes.js";
import { LEVIERS, OPTIONS } from "../data/leviers.js";
import { NIV } from "../data/cadre.js";
import { force } from "../data/orientation.js";
import { AXES, CRITERES, noter } from "../data/jugement.js";
import { MESURES } from "../data/donnees.js";
import "../data/recherche.js";
import { FLOORS } from "../mix/floors.js";
import { mixCheck } from "../mix/checks.js";
import { dePile, etatDes, lienId, liens, setDePile, setDes } from "../mix/opts.js";
import { lienLibre, posables } from "../mix/prog.js";
import { saveSoon } from "../mix/store.js";
import { MASS, PARTIS, massLev, massSet } from "../mass/model.js";
import { evaluationCourante } from "../mass/mesures.js";
import { moyennesMain } from "../net/variantes.js";
import { renderBar } from "./legend.js";
import { icone } from "./icons.js";
import { deroulant, item } from "./menu.js";
import { deBtn } from "./mixer.js";

/* Ce que la page retient d'un rendu à l'autre : la recherche, le groupement,
   les filtres — un jeu par vue, pour que le volet du mixer ne laisse pas son
   filtre à la page. */
var ETATS = {}, ETAT = null;
function etatDe(cle, onglet){
  return ETATS[cle] || (ETATS[cle] = { q:"", grouper:"role", onglet:onglet || "", tag:"", qui:"", ouverts:{} });
}
var rendre = null;

/* ---------- ce que la composition à l'écran dit de chaque ligne ------------------
   Calculé une fois par rendu. `null` quand rien n'est posé : on ne dit rien
   plutôt que d'inventer. */
function lectureEcran(){
  var L = { ev:null, mix:{}, jug:null };
  try{
    L.ev = evaluationCourante();
    if(L.ev) L.jug = noter(L.ev.mes, null, moyennesMain());
  }catch(_){ L.ev = null; }
  try{
    var PREF = { "jour:":"jour-ss", bac:"bac", "gab:":"gabarit", "adj:":"adj", "wc:":"wc",
                 "unite:":"unite", "vide:":"vide" };
    mixCheck().forEach(function(x){
      if(x.ok) return;
      var id = null, c = x.code || "";
      if(/^niv:\d+:/.test(c)){ var n = NIV[+c.split(":")[1]]; id = n && n.id; }
      else for(var p in PREF) if(c.indexOf(p) === 0){ id = PREF[p]; break; }
      if(id) (L.mix[id] = L.mix[id] || []).push(x);
    });
  }catch(_){}
  return L;
}
var ECRAN = null;

/* ---------- les petits contrôles ---------------------------------------------- */
/* `b` : `{ min, max, pas }`, chacun facultatif. */
function nombre(val, b, onSet, aria){
  var w = el("label", "pr-nb");
  var i = el("input", "mono");
  i.type = "number"; i.value = String(val);
  if(b && b.min != null) i.min = String(b.min);
  if(b && b.max != null) i.max = String(b.max);
  i.step = String((b && b.pas) || "any");
  i.setAttribute("aria-label", aria);
  i.addEventListener("change", function(){ if(onSet(i.value) === false) i.value = String(val); });
  w.appendChild(i);
  return w;
}
/* Une case de `V`, saisie : elle écrit la case, enregistre, et refait la page. */
function caseV(l, k, unite){
  var w = el("span", "pr-val");
  var deux = k === l.k2, pct = l.pct && !deux;
  var v = pct ? Math.round(V[k] * 100) / 100 : V[k];
  w.appendChild(nombre(v, deux ? { min:l.min2, max:l.max2, pas:l.pas } : { min:l.min, max:l.max, pas:l.pas },
    function(x){
      if(!regler(k, x)) return false;
      saveSoon(); rendre();
    }, l.n + (deux ? " — seconde valeur" : "")));
  if(unite) w.appendChild(el("span", "pr-nb__u", unite));
  if(V[k] !== defaut(k)) w.appendChild(el("span", "pr-def mono", "défaut " + (pct ? dec(defaut(k)) : String(defaut(k)).replace(".", ","))));
  return w;
}
/* Une liste déroulante : le déroulant du menu ◐ sous un bouton qui dit le
   choix pris. */
function choix(liste, val, onSet, aria, cls){
  var pris = liste.filter(function(o){ return o.id === val; })[0] || liste[0];
  var r = el("div", "menu menu--gauche menu--choix");
  var b = el("button", "pr-sel" + (cls ? " " + cls : ""));
  b.type = "button";
  b.setAttribute("aria-label", aria);
  var lab = el("span", "pr-sel__v", pris.n);
  b.appendChild(lab);
  b.appendChild(icone("chevron", 14));
  var li = el("div", "menu__list");
  r.appendChild(b); r.appendChild(li);
  deroulant(r, b, li, function(l){
    liste.forEach(function(o){
      l.appendChild(item(o.n, o.d, o.id === val, function(){
        if(o.id === val) return;
        onSet(o.id);
      }));
    });
  });
  return r;
}
function puce(txt, cls, titre){
  var c = el("i", "chip " + cls, txt);
  if(titre) c.title = titre;
  return c;
}
/* Le tag d'une ligne, en couleur. Intangible se lit ; les autres se changent
   ici, parmi ce que la ligne admet. */
function tagCtl(l){
  var t = tagDe(l.id), info = tagInfo(t);
  if(t === "intangible" || !l.admet || l.admet.length < 2)
    return puce(info.n, "tag tag--" + t, info.d);
  var L = l.admet.map(function(id){ var x = tagInfo(id); return { id:id, n:x.n, d:x.d }; });
  return choix(L, t, function(v){ setTag(l.id, v); saveSoon(); rendre(); },
    "Tag de « " + l.n + " »", "tag tag--" + t);
}
function bascule(l){
  if(l.off === undefined) return null;
  var b = document.createElement("input");
  b.type = "checkbox"; b.checked = actif(l.id);
  b.className = "pr-on";
  b.setAttribute("aria-label", (b.checked ? "Éteindre" : "Allumer") + " « " + l.n + " »");
  b.title = b.checked ? "Allumée — décocher l'éteint : elle ne fait plus rien, et le contrôle se tait"
                      : "Éteinte — cocher la rallume";
  b.addEventListener("change", function(){ setActif(l.id, b.checked); saveSoon(); rendre(); });
  return b;
}

/* ---------- une ligne ------------------------------------------------------------
   Quatre colonnes, toujours les mêmes : la ligne et ses niveaux de classement,
   sa valeur, sa force, ce qu'elle dit de l'écran. Le détail — pourquoi, qui
   l'applique — se déplie. */
function rangee(o){
  var r = el("details", "pr-l pr-l--" + o.role + (o.inactif ? " is-inactif" : "")
    + (o.modifie ? " is-modifie" : ""));
  r.dataset.q = [o.n, o.sujet, roleNom(o.role), ONGLETS[o.onglet] || "", o.src || "", QUI[o.qui] || "",
    o.tag ? tagInfo(o.tag).n : "", o.d || "", typeof o.val === "string" ? o.val : ""].join(" ").toLowerCase();
  r.dataset.onglet = o.onglet || "";
  r.dataset.sujet = o.sujet || "";
  r.dataset.tag = o.tag || "";
  r.dataset.qui = o.qui || "";
  var s = el("summary", "pr-l__s");
  var c = el("div", "pr-l__c");
  if(o.bascule) c.appendChild(o.bascule);
  var t = el("div", "pr-l__t");
  t.appendChild(el("span", "pr-l__n", o.n));
  var m = el("span", "pr-l__m");
  m.appendChild(el("b", "pr-role pr-role--" + o.role, roleNom(o.role).replace(/s$/, "")));
  if(o.onglet) m.appendChild(el("span", null, ONGLETS[o.onglet] || o.onglet));
  if(o.src) m.appendChild(el("span", null, o.src));
  if(o.qui) m.appendChild(el("span", "pr-qui", QUI[o.qui]));
  t.appendChild(m);
  c.appendChild(t);
  s.appendChild(c);
  var v = el("div", "pr-l__v");
  if(o.val == null) v.appendChild(el("span", "pr-vide", "—"));
  else if(typeof o.val === "string") v.appendChild(el("span", /^[\d−-]/.test(o.val) ? "mono" : null, o.val));
  else v.appendChild(o.val);
  s.appendChild(v);
  var f = el("div", "pr-l__f");
  if(o.force) f.appendChild(o.force);
  s.appendChild(f);
  var e = el("div", "pr-l__e");
  if(o.ecran) e.appendChild(o.ecran);
  s.appendChild(e);
  r.appendChild(s);
  var b = el("div", "pr-l__b");
  if(o.d) b.appendChild(el("p", null, o.d));
  if(o.ecranTxt) b.appendChild(el("p", "pr-l__w", "À l'écran : " + o.ecranTxt));
  if(o.lu) b.appendChild(el("p", "pr-l__lu mono", o.lu));
  if(o.plus) b.appendChild(o.plus);
  r.appendChild(b);
  /* un champ dans le résumé ne doit pas replier la ligne. Un bouton et une case
     à cocher ont leur propre activation, qui ne replie rien : on ne l'annule
     surtout pas. */
  s.addEventListener("click", function(ev){
    var t = ev.target;
    if(t.closest("button, input[type=checkbox]")) return;
    if(t.closest("input, label, .menu")) ev.preventDefault();
  });
  return r;
}
/* Ce que toutes les lignes déclarées partagent. */
/* La rubrique d'une ligne du cadre ou de l'orientation se lit sur son tag :
   Intangible, une contrainte ; tout le reste, une préférence. */
function rubrique(l){
  if(l.role !== "cadre" && l.role !== "orientation") return l.role;
  return tagDe(l.id) === "intangible" || (!l.tag && l.role === "cadre") ? "cadre" : "orientation";
}
function base(l){
  return { n:l.n, sujet:l.sujet, role:rubrique(l), onglet:l.onglet, src:sourceTxt(l.src),
           qui:l.qui, tag:l.tag ? tagDe(l.id) : null, d:l.d, lu:l.lu,
           modifie: [l.k, l.k2, "t:" + l.id, "on:" + l.id].some(function(k){ return k && V[k] !== undefined && V[k] !== defaut(k); }),
           inactif: l.off !== undefined && !actif(l.id) };
}
function valeurDe(l){
  if(l.k && l.qui !== "code"){
    if(!l.k2) return caseV(l, l.k, l.unite);
    var w = el("span", "pr-val2");
    w.appendChild(caseV(l, l.k, l.unite));
    w.appendChild(caseV(l, l.k2, l.unite2));
    return w;
  }
  if(l.k) return String(V[l.k]).replace(".", ",") + (l.unite ? " " + l.unite : "");
  return l.val || null;
}

/* ---------- ce que dit l'écran, par rôle ---------------------------------------- */
var ETATS = [["warn", "défavorable"], ["soft", "neutre"], ["ok", "favorable"]];
function ecranCadre(l){
  if(!ECRAN) return null;
  if(l.onglet === "mixer"){
    var E = ECRAN.mix[l.id];
    if(!actif(l.id)) return { c:puce("éteinte", "chip--soft") };
    return E ? { c:puce(E.length > 1 ? E.length + " écarts" : "écart", E[0].sev === "e" ? "chip--danger" : "chip--warn"),
                 t:E[0].msg } : { c:puce("tenue", "chip--ok") };
  }
  if(l.onglet === "massing" && ECRAN.ev){
    var X = ECRAN.ev.ecarts.filter(function(x){ return x.k === l.id; });
    var q = ECRAN.ev.qualites[l.id];
    if(!actif(l.id)) return { c:puce("éteinte", "chip--soft") };
    if(roleDe(l.id) === "orientation" && q) return { c:puce(ETATS[q.niv][1], "chip--" + ETATS[q.niv][0]), t:q.txt };
    return X.length ? { c:puce("enfreinte", X[0].sev === "e" ? "chip--danger" : "chip--warn"), t:X[0].msg }
                    : { c:puce("tenue", "chip--ok"), t: q ? q.txt : "" };
  }
  return null;
}
function ecranOrient(l){
  if(!ECRAN) return null;
  if(l.onglet === "mixer"){
    var f = force(l.id);
    return { c: el("span", "pr-eff mono", f ? "× " + f + " = " + dec(f * V[l.k], 0) + " pts" : "0 pt") };
  }
  var q = ECRAN.ev && ECRAN.ev.qualites[l.id];
  if(!q) return null;
  var X = ECRAN.ev.ecarts.filter(function(x){ return x.k === l.id; })[0];
  if(X) return { c:puce("enfreinte", "chip--warn"), t:X.msg };
  return { c:puce(ETATS[q.niv][1], "chip--" + ETATS[q.niv][0]), t:q.txt };
}

/* ---------- 1 · les données ---------------------------------------------------------- */
function nb(x){ return String(Math.round(x * 100) / 100).replace(".", ","); }
function ctx(n, val, a, sujet, onglet){
  return rangee({ n:n, val:val, role:"donnee", sujet:sujet || "Règlement", onglet:onglet || "programme",
                  src:"règlement " + a, qui:"code" });
}
/* Les surfaces que le cahier laisse au projet, et la largeur du couloir :
   des LEVIERS — nous les décidons, et la génération les lit. */
function surfacesCahier(){
  var R = RULES, L = [];
  L.push(rangee(Object.assign(base(ligne("couloir")), { role:"levier",
    val: (function(){
      var w = el("span", "pr-val");
      w.appendChild(nombre(COULOIR, { min:R.circ.couloir.min, max:R.circ.couloir.max, pas:0.05 },
        function(x){ if(!setCirc(parseFloat(String(x).replace(",", ".")))) return false; renderBar(); saveSoon(); rendre(); },
        "Largeur du couloir"));
      w.appendChild(el("span", "pr-nb__u", "m"));
      return w;
    })() })));
  VARITEMS.forEach(function(it){
    var w = el("span", "pr-val");
    w.appendChild(nombre(it.u, { min:0, pas:1 }, function(x){
      if(!setItemArea(it.key, parseFloat(String(x).replace(",", ".")))) return false;
      renderBar(); saveSoon(); rendre();
    }, it.n));
    w.appendChild(el("span", "pr-nb__u", "m²/pièce"));
    L.push(rangee({ n:it.n + (it.nb > 1 ? " ×" + it.nb : ""), sujet:"Programme", role:"levier", onglet:"programme",
      src:"hypothèse — " + (it.set ? "précisée" : "à préciser"), qui:"groupe", val:w,
      d:"Une des huit surfaces que le règlement laisse « selon projet »." }));
  });
  return L;
}
/* Le prix au m³ : une hypothèse du jury, rangée avec le critère de coût. */
function prixM3(){
  var l = ligne("m3"), o = base(l);
  o.role = "jugement";
  o.val = valeurDe(l);
  if(ECRAN && ECRAN.ev){
    var c = ECRAN.ev.mes.volume * V.m3;
    o.ecran = el("span", "pr-eff mono", dec(c / 1e6, 1) + " M CHF");
    o.ecranTxt = fmt(ECRAN.ev.mes.volume) + " m³ × " + V.m3 + " CHF = " + fmt(Math.round(c)) + " CHF, pour "
      + fmt(RULES.budget) + " CHF au budget";
  }
  return rangee(o);
}
/* Les mesures du bâtiment : la première moitié de l'évaluation. */
function mesures(){
  return MESURES.map(function(x){
    var o = base(x), m = ECRAN && ECRAN.ev ? ECRAN.ev.mes[x.m] : null;
    o.role = "jugement";
    o.val = x.unite ? "en " + x.unite : "un nombre";
    if(m != null) o.ecran = el("span", "pr-eff mono", (typeof m === "number" ? String(m).replace(".", ",") : String(m)) + (x.unite && x.unite.length < 6 ? " " + x.unite : ""));
    return rangee(o);
  });
}
/* Le reste : nos hypothèses de construction, puis le contexte opposable — le
   règlement, un sous-niveau par thème. */
var THEMES = { mobilite:"Mobilité", economie:"Économie", procedure:"Procédure" };
function donnees(cle, niv){
  var D = contexte(), regl = D.filter(function(r){ return r.dataset.regl; });
  return parSujet(cle, niv, D.filter(function(r){ return !r.dataset.regl; }))
    .concat(regl.length ? [groupe(cle + "/reglement", niv, "Règlement", parSujet(cle + "/reglement", niv + 1, regl))] : []);
}
function contexte(){
  var R = RULES, L = [];
  ["pass-larg", "couverture", "enveloppe", "place-parc", "cages"].forEach(function(id){
    var l = ligne(id), o = base(l);
    o.val = valeurDe(l);
    o.sujet = "Hypothèses";
    L.push(rangee(o));
  });
  L.push(ctx("Périmètre", "parcelles " + R.site.parcelles.join(", ") + " · " + fmt(R.site.aire) + " m²", "2.3", "Site"));
  L.push(ctx("Zone", R.site.zone + " — ni gabarit, ni hauteur, ni distance aux limites", "2.3", "Site"));
  L.push(ctx("Nappe phréatique", nb(R.site.nappe[0]) + " – " + nb(R.site.nappe[1]) + " msm · terrain à " + nb(R.site.altMoy), "2.3", "Site"));
  L.push(ctx("Protection des eaux", R.site.eaux, "2.3", "Site"));
  L.push(ctx("Pollution des sols", R.site.pollution, "2.3", "Site"));
  L.push(ctx("Voisinage", "projet résidentiel voisin, parcelles " + R.site.voisins.join(" et "), "2.3", "Site"));
  L.push(ctx("Bus, accès, stationnement", R.ext.bus + " bus · voitures par la " + R.ext.accesAuto + " · "
    + R.ext.voitures + " places, " + R.ext.velos + " vélos, " + R.ext.depose + " déposes-minute", "2.4", "Mobilité"));
  L.push(ctx("École", R.ecole.eleves + " élèves, de la " + R.ecole.degres, "2.7", "Programme"));
  L.push(ctx("Surfaces du programme", fmt(PROG) + " m² chiffrés · " + fmt(GRAND) + " m² au total — fixes", "2.10", "Programme"));
  L.push(ctx("Hauteurs libres", Object.keys(R.haut.libre).map(function(k){ return k + " " + nb(R.haut.libre[k]); }).join(" · ") + " m", "2.10", "Programme"));
  L.push(ctx("Parasismique", "zone " + R.seisme.zone + " · agd " + nb(R.seisme.agd) + " m/s² · sol " + R.seisme.sol, "2.5", "Structure"));
  Object.keys(R.cadre).forEach(function(th){
    R.cadre[th].forEach(function(c){
      var r = ctx(c.n, c.v, c.art + (c.verif ? " — à vérifier" : ""), THEMES[th] || th.charAt(0).toUpperCase() + th.slice(1));
      r.dataset.regl = "1";
      L.push(r);
    });
  });
  return L;
}

/* ---------- 2 · les leviers ------------------------------------------------------------
   Le dé du mixer, partout : allumé, le levier est libre ; éteint, fixe. */
function deLev(etat, quoi, fn, fige){
  var b = deBtn(etat, quoi, fn);
  if(fige){ b.disabled = true; b.title = quoi + " : toujours tiré — la seed le fige"; }
  return b;
}
function leviers(){
  var lvls = FLOORS.map(function(F){ return F.lvl; });
  var postes = posables().filter(function(p){ return lienLibre(p.key); }).map(function(p){ return p.key; });
  var ids = liens().map(lienId);
  function toggle(cat, list){ return function(on){ setDes(cat, list, on); saveSoon(); rendre(); }; }
  function opt(k){ return function(on){ massLev(k, on ? null : (MASS.lev[k] || OPTIONS[k][0].id)); saveSoon(); rendre(); }; }
  var F = {
    "lev-pile":    function(){ return deLev(dePile, "Nombre de niveaux", function(on){ setDePile(on); saveSoon(); rendre(); }); },
    "lev-plateau": function(){ return deLev(etatDes("plateau", lvls), "Plateaux", toggle("plateau", lvls)); },
    "lev-lien":    function(){ return deLev(etatDes("lien", postes), "Lien des postes", toggle("lien", postes)); },
    "lev-adj":     function(){ return deLev(etatDes("adj", ids), "Adjacences", toggle("adj", ids)); },
    "lev-parti":   function(){ return deLev(MASS.parti === "auto", "Parti", function(on){
      massSet("parti", on ? "auto" : (MASS.vol && MASS.vol.parti) || "compact"); saveSoon(); rendre(); }); },
    "lev-figure":  function(){ return deLev(true, "Figure du parti", null, true); },
    "lev-implant": function(){ return deLev(true, "Position sur la parcelle", null, true); },
    "lev-larg":    function(){ return deLev(true, "Largeur des corps", null, true); },
    "lev-prof":    function(){ return deLev(MASS.lev.prof == null, "Profondeur des corps", function(on){
      massLev("prof", on ? null : Math.round((V.profMin + V.profMax) / 2)); saveSoon(); rendre(); }); },
    "lev-cap":     function(){ return deLev(MASS.lev.cap == null, "Orientation de la figure", opt("cap")); },
    "lev-sport":   function(){ return deLev(MASS.lev.sport == null, "Salle de sport", opt("sport")); },
    "lev-ponts":   function(){ return deLev(MASS.lev.ponts == null, "Passerelles", opt("ponts")); },
    "lev-second":  function(){ return deLev(MASS.second === "auto", "Second temps", function(on){
      massSet("second", on ? "auto" : "sep"); saveSoon(); rendre(); }); }
  };
  var SECONDS = [{ id:"un", n:"Réunis" }, { id:"sep", n:"Séparés" }, { id:"non", n:"Non représentés" }];
  return LEVIERS.map(function(l){
    var o = base(l);
    o.force = F[l.id] ? F[l.id]() : null;
    o.val = valeurDe(l);
    var w = null;
    /* la valeur fixée, quand le levier est figé */
    if(l.id === "lev-parti" && MASS.parti !== "auto")
      w = choix(PARTIS.filter(function(p){ return p.id !== "auto"; }), MASS.parti,
        function(v){ massSet("parti", v); saveSoon(); rendre(); }, "Parti fixé");
    if(OPTIONS[l.id.slice(4)] && MASS.lev[l.id.slice(4)] != null){
      var k = l.id.slice(4);
      w = choix(OPTIONS[k], MASS.lev[k], function(v){ massLev(k, v); saveSoon(); rendre(); }, l.n + " fixé");
    }
    if(l.id === "lev-second" && MASS.second !== "auto")
      w = choix(SECONDS, MASS.second, function(v){ massSet("second", v); saveSoon(); rendre(); }, "Second temps fixé");
    if(l.id === "lev-prof" && MASS.lev.prof != null){
      w = el("span", "pr-val");
      w.appendChild(nombre(MASS.lev.prof, { min:1, max:100, pas:0.5 }, function(x){
        var n = parseFloat(String(x).replace(",", "."));
        if(!isFinite(n)) return false;
        massLev("prof", n); saveSoon(); rendre();
      }, "Profondeur fixée"));
      w.appendChild(el("span", "pr-nb__u", "m, fixée"));
    }
    if(w){
      var d = el("span", "pr-val2");
      if(o.val && typeof o.val !== "string") d.appendChild(o.val);
      d.appendChild(w);
      o.val = d;
    }
    o.ecranTxt = l.etat;
    if(l.id === "lev-pile") o.ecran = el("span", "pr-eff mono", FLOORS.length + " niveaux");
    if(l.id === "lev-parti" && MASS.vol && MASS.vol.parti)
      o.ecran = el("span", "pr-eff", PARTIS.filter(function(p){ return p.id === MASS.vol.parti; })[0].n);
    return rangee(o);
  });
}

/* ---------- 3 · les contraintes et 4 · les préférences ---------------------------------
   La rubrique se lit sur le tag VIVANT ; `tag` en plus range les préférences
   par force. */
function lignesDe(rub, tag){
  return LIGNES.filter(function(l){ return (l.role === "cadre" || l.role === "orientation")
      && rubrique(l) === rub && (!tag || tagDe(l.id) === tag); })
    .map(function(l){
      var o = base(l);
      o.val = valeurDe(l);
      o.force = tagCtl(l);
      o.bascule = bascule(l);
      var e = roleDe(l.id) === "orientation" ? ecranOrient(l) : ecranCadre(l);
      if(e){ o.ecran = e.c; o.ecranTxt = e.t; }
      return rangee(o);
    });
}

/* ---------- 5 · le jugement ---------------------------------------------------------- */
function pct(s){ return s == null ? "—" : Math.round(100 * s) + " %"; }
function fonctionTxt(x){
  var f = x.f; if(!f) return "";
  var b = V["jb:" + x.id], n = V["jn:" + x.id];
  if(f.t === "max") return "1 jusqu'à " + nb(b) + ", 0 à " + nb(n);
  if(f.t === "min") return "1 dès " + nb(b) + ", 0 à " + nb(n);
  if(f.t === "bande") return "1 entre " + nb(b) + " et " + nb(V["jh:" + x.id]) + ", 0 à " + nb(n) + " de marge";
  if(f.t === "cout") return "1 au budget, 0 à " + Math.round(n * 100) + " % au-delà";
  if(f.t === "oui") return "la part, telle quelle";
  if(f.t === "options") return Object.keys(f.v).map(function(k){ return k + " → " + f.v[k]; }).join(" · ");
  return "";
}
function critere(x, J){
  var o = base(x);
  o.src = sourceTxt(x.src);
  o.force = (function(){
    var w = el("span", "pr-val");
    w.appendChild(nombre(V["w:" + x.id], { min:0, max:10, pas:1 }, function(v){
      if(!regler("w:" + x.id, v)) return false; saveSoon(); rendre(); }, "Poids de « " + x.n + " »"));
    w.appendChild(el("span", "pr-nb__u", "/10"));
    return w;
  })();
  o.bascule = bascule(x);
  var parts = Object.keys(x.axes);
  o.val = x.mesure ? (MESURES.filter(function(m){ return m.m === x.mesure; })[0] || { n:x.mesure }).n
    + (parts.length > 1 ? " — partagé " + parts.map(function(k){ return k + " " + Math.round(x.axes[k] * 100) + " %"; }).join(", ") : "")
    : "à noter à la main, sur une variante";
  var c = J && J.crit[x.id];
  if(c && c.s != null){
    var src = { mesure:"mesuré", main:"noté", moyenne:"moyenne des notes", neutre:"neutre, non noté" }[c.de] || c.de;
    o.ecran = puce(pct(c.s), c.de === "mesure" ? (c.s >= .75 ? "chip--ok" : c.s >= .4 ? "chip--soft" : "chip--warn") : "chip--soft", src);
    o.ecranTxt = src + (x.mesure && ECRAN && ECRAN.ev ? " — " + x.mesure + " = " + String(ECRAN.ev.mes[x.mesure]).replace(".", ",") : "");
  } else if(c) o.ecran = puce(c.de, "chip--soft");
  if(x.f && x.f.t !== "options" && x.f.t !== "oui"){
    var p = el("div", "pr-fn");
    p.appendChild(el("span", "pr-fn__t", "Fonction : " + fonctionTxt(x)));
    [["jb:", "bon"], ["jh:", "haut"], ["jn:", x.f.t === "cout" ? "dépassement nul" : "nul"]].forEach(function(q){
      if(V[q[0] + x.id] === undefined) return;
      var k = q[0] + x.id, lab = el("label", "pr-fn__c");
      lab.appendChild(el("span", null, q[1]));
      lab.appendChild(nombre(V[k], { pas:"any" }, function(v){ if(!regler(k, v)) return false; saveSoon(); rendre(); },
        q[1] + " — " + x.n));
      p.appendChild(lab);
    });
    o.plus = p;
  }
  return rangee(o);
}
/* Le résumé des axes, puis axe › sous-axe › critères. Dans un volet, le
   résumé seul : les critères notent le bâtiment entier, et se règlent sur la
   page. `cle` : la clé du groupe parent, pour que chaque dépliage se retienne. */
function jugement(cle, niv, resume){
  var J = ECRAN && ECRAN.jug, out = [];
  var t = el("div", "pr-axes");
  var h = el("div", "pr-axes__h");
  h.appendChild(el("b", "pr-axes__n mono", J && J.total != null ? String(J.total) : "—"));
  h.appendChild(el("span", null, J ? "/100 — la composition à l'écran, vue par le jury · " + Math.round(J.couv * 100)
    + " % du poids lu, mesuré ou noté" : "aucune composition posée"));
  t.appendChild(h);
  AXES.forEach(function(a){
    var aj = J ? J.axes.filter(function(x){ return x.id === a.id; })[0] : null;
    var r = el("div", "pr-axe");
    r.appendChild(el("span", "pr-axe__n", a.n));
    var w = el("span", "pr-val");
    w.appendChild(nombre(V["ax:" + a.id], { min:0, max:100, pas:1 }, function(v){
      if(!regler("ax:" + a.id, v)) return false; saveSoon(); rendre(); }, "Poids de l'axe « " + a.n + " »"));
    w.appendChild(el("span", "pr-nb__u", "points"));
    r.appendChild(w);
    var bar = el("span", "pr-axe__b");
    var fill = el("i");
    fill.style.inlineSize = (aj && aj.s != null ? Math.round(aj.s * 100) : 0) + "%";
    bar.appendChild(fill);
    r.appendChild(bar);
    r.appendChild(el("span", "pr-axe__s mono", aj ? pct(aj.s) : "—"));
    t.appendChild(r);
  });
  t.appendChild(el("p", "pr-note", "Note générale : moyenne GÉOMÉTRIQUE des axes, pondérée — un axe faible "
    + "ne se rachète pas par les autres. Dans un axe, les sous-axes et leurs critères se compensent. Un "
    + "critère sans mesure reçoit la note posée à la main sur la variante, sinon la moyenne des notes "
    + "posées sur les autres, sinon 0,5."));
  out.push(t);
  if(resume) return out;
  AXES.forEach(function(a){
    var aj = J ? J.axes.filter(function(x){ return x.id === a.id; })[0] : null;
    var ca = cle + "/" + a.id;
    var sous = a.sous.map(function(sx){
      var sj = aj ? aj.sous.filter(function(x){ return x.id === sx.id; })[0] : null;
      var crits = CRITERES.filter(function(x){ return x.axes[sx.id]; });
      var rows = crits.map(function(x){ return critere(x, J); });
      if(crits.some(function(x){ return x.f && x.f.t === "cout"; })) rows.unshift(prixM3());
      if(a.sous.length < 2) return rows;
      var w = el("span", "pr-val");
      w.appendChild(nombre(V["sx:" + sx.id], { min:0, max:100, pas:1 }, function(v){
        if(!regler("sx:" + sx.id, v)) return false; saveSoon(); rendre(); }, "Poids du sous-axe « " + sx.n + " »"));
      w.appendChild(el("span", "pr-nb__u", "dans l'axe"));
      w.appendChild(el("span", "pr-g__sc mono", sj ? pct(sj.s) + " · lu à " + Math.round(sj.couv * 100) + " %" : ""));
      return [groupe(ca + "/" + sx.id, niv + 1, sx.n, rows, { extra:w })];
    }).reduce(function(x, y){ return x.concat(y); }, []);
    out.push(groupe(ca, niv, a.n, sous, { extra: el("span", "pr-g__sc mono", aj ? pct(aj.s) : "") }));
  });
  return out;
}

/* ---------- 6 · le générateur ---------------------------------------------------------- */
function generateur(){
  return LIGNES.filter(function(l){ return l.role === "recherche"; }).map(function(l){
    var o = base(l);
    o.val = valeurDe(l);
    if(l.id === "seed-mix") o.val = (curSeed >>> 0).toString(36);
    if(l.id === "seed-mass") o.val = ((MASS.graine || 0) >>> 0).toString(36);
    return rangee(o);
  });
}

/* ---------- les groupes, qui se déplient ---------------------------------------------
   Un groupe porte des rangées ou d'autres groupes, à n'importe quelle
   profondeur. Il retient s'il est ouvert, d'un rendu à l'autre : la page se
   refait à chaque réglage. Par défaut, la première profondeur est ouverte —
   les deux dans un volet, plus court. `o` : `{ q, extra }`. */
function groupe(cle, niv, titre, enfants, o){
  o = o || {};
  var d = el("details", "pr-g pr-g--" + Math.min(niv, 4));
  d.open = cle in ETAT.ouverts ? ETAT.ouverts[cle] : niv <= ETAT.ouvrir;
  d.addEventListener("toggle", function(){ ETAT.ouverts[cle] = d.open; });
  var s = el("summary", "pr-g__s");
  s.appendChild(icone("chevron", 14));
  s.appendChild(el(niv === 1 ? "h2" : "h3", "pr-g__t", titre));
  s.appendChild(el("span", "pr-g__nb mono"));
  if(o.extra){ o.extra.classList.add("pr-g__x"); s.appendChild(o.extra); }
  if(o.q) s.appendChild(el("p", "pr-g__q", o.q));
  /* un champ dans le titre ne doit pas replier le groupe */
  s.addEventListener("click", function(ev){
    if(ev.target.closest("input, label, .menu")) ev.preventDefault();
  });
  d.appendChild(s);
  var l = el("div", "pr-g__l");
  enfants.forEach(function(x){ l.appendChild(x); });
  d.appendChild(l);
  return d;
}
/* Un sous-niveau par onglet, quand les rangées en touchent plusieurs. */
var ORDRE_ONGLETS = ["programme", "mixer", "massing", "typologie", "rendu", "tous"];
function parOnglet(cle, niv, rangees){
  var G = {};
  rangees.forEach(function(r){ var k = r.dataset.onglet || "tous"; (G[k] = G[k] || []).push(r); });
  var ks = ORDRE_ONGLETS.filter(function(k){ return G[k]; });
  /* un volet est déjà filtré sur son onglet */
  if(ks.length < 2 || ETAT.onglet) return rangees;
  return ks.map(function(k){ return groupe(cle + "/" + k, niv, ONGLETS[k], G[k]); });
}
/* Un sous-niveau par sujet, dans l'ordre où ils viennent. */
function parSujet(cle, niv, rangees){
  var G = {}, ordre = [];
  rangees.forEach(function(r){
    var k = r.dataset.sujet || "—";
    if(!G[k]){ G[k] = []; ordre.push(k); }
    G[k].push(r);
  });
  return ordre.map(function(k){ return groupe(cle + "/" + k, niv, k, G[k]); });
}
function roleDef(id){ return ROLES.filter(function(r){ return r.id === id; })[0]; }
var TAGS_PREF = ["impose", "prioritaire", "souhaite", "indicatif"];
/* L'arbre entier. */
function rubriques(resume){
  function rub(id, enfants){ var d = roleDef(id); return groupe(id, 1, d.n, enfants, { q:d.q }); }
  var gen = roleDef("recherche");
  return [
    rub("cadre", parOnglet("cadre", 2, lignesDe("cadre"))),
    rub("levier", [
      groupe("levier/batiment", 2, "Le bâtiment", parOnglet("levier/batiment", 3, leviers()),
        { q:"Que fait-on varier ? Fixe, la valeur est la nôtre ; libre, le moteur la tire dans le domaine." }),
      groupe("levier/cahier", 2, "Les surfaces du cahier des charges", surfacesCahier(),
        { q:"Ce que le règlement laisse « selon projet », et la largeur du couloir : nous les fixons, la génération les lit." }),
      groupe("levier/moteur", 2, gen.n, parOnglet("levier/moteur", 3, generateur()), { q:gen.q })
    ]),
    rub("orientation", TAGS_PREF.map(function(t){
      var x = tagInfo(t), c = "orientation/" + t;
      return groupe(c, 2, x.n, parOnglet(c, 3, lignesDe("orientation", t)), { q:x.d });
    })),
    rub("jugement", [
      groupe("jugement/mesures", 2, "Les mesures", parOnglet("jugement/mesures", 3, mesures()),
        { q:"Ce qu'on lit sur un bâtiment — le nôtre comme celui d'un concurrent. Le jugement ne lit qu'elles." }),
      groupe("jugement/jury", 2, "Le jugement", jugement("jugement/jury", 3, resume),
        { q:"Six axes, leurs sous-axes, et dans chacun des critères : une mesure, une fonction de score, un poids." })
    ]),
    rub("donnee", donnees("donnee", 2))
  ];
}

function appliquerFiltre(host){
  var q = ETAT.q.trim().toLowerCase();
  host.querySelectorAll(".pr-g .pr-l").forEach(function(l){
    l.hidden = !((!q || l.dataset.q.indexOf(q) >= 0)
      && (!ETAT.onglet || l.dataset.onglet === ETAT.onglet || l.dataset.onglet === "tous")
      && (!ETAT.tag || l.dataset.tag === ETAT.tag)
      && (!ETAT.qui || l.dataset.qui === ETAT.qui));
  });
  host.querySelectorAll(".pr-g").forEach(function(g){
    var vus = g.querySelectorAll(".pr-l:not([hidden])").length;
    g.querySelector(".pr-g__nb").textContent = vus ? String(vus) : "";
    /* le résumé des axes reste, même quand les critères sont filtrés */
    g.hidden = !vus && !g.querySelector(".pr-axes");
    if(q && vus) g.open = true;
  });
}

function legende(){
  var g = el("div", "pr-tags");
  TAGS.forEach(function(t){
    var i = el("span", "pr-tags__i");
    i.appendChild(puce(t.n, "tag tag--" + t.id));
    i.appendChild(el("span", null, t.d));
    g.appendChild(i);
  });
  return g;
}
function outils(host){
  var bar = el("div", "pr-outils");
  var q = el("input", "pr__q");
  q.type = "search"; q.placeholder = "Filtrer — « cour », « AEAI », « groupe »…";
  q.value = ETAT.q;
  q.setAttribute("aria-label", "Filtrer les lignes");
  q.addEventListener("input", function(){ ETAT.q = q.value; appliquerFiltre(host); });
  bar.appendChild(q);
  function seg(titre, liste, k, refaire){
    var g = el("div", "btn-group");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", titre);
    g.appendChild(el("span", "btn-group__label", titre));
    liste.forEach(function(o){
      var b = el("button", "btn", o[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(ETAT[k] === o[0]));
      b.addEventListener("click", function(){
        ETAT[k] = o[0];
        if(refaire) rendre();
        else { g.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed", String(x === b)); }); appliquerFiltre(host); }
      });
      g.appendChild(b);
    });
    return g;
  }
  bar.appendChild(seg("Grouper", [["role", "Rubrique"], ["sujet", "Sujet"], ["onglet", "Onglet"]], "grouper", true));
  bar.appendChild(seg("Onglet", [["", "Tous"], ["programme", "Cahier"], ["mixer", "Mixer"], ["massing", "Massing"],
    ["typologie", "Suivants"]], "onglet"));
  bar.appendChild(seg("Tag", [["", "Tous"]].concat(TAGS.map(function(t){ return [t.id, t.n]; })), "tag"));
  bar.appendChild(seg("Qui", [["", "Tous"], ["code", "Code"], ["groupe", "Groupe"], ["chacun", "Chacun"]], "qui"));
  var re = el("button", "btn btn--quiet", "Rétablir les valeurs du code");
  re.type = "button";
  re.disabled = !modifie();
  re.title = "Remet toutes les lignes — recherche et jury — à leur défaut. L'état des leviers reste à chacun.";
  re.addEventListener("click", function(){ if(retablir(false)){ saveSoon(); rendre(); } });
  bar.appendChild(re);
  return bar;
}

/* `opts` : `{ onglet, rejouer, titre, extra }` pour un volet Contraintes —
   la page filtrée sur l'onglet, un bouton qui rejoue le tirage. */
export function parametresVue(render, opts){
  opts = opts || {};
  rendre = function(){
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  };
  ECRAN = lectureEcran();
  ETAT = etatDe(opts.onglet || "page", opts.onglet);
  var s = el("section", "pr" + (opts.onglet ? " pr--volet" : ""));
  var h = el("header", "pr__h");
  h.appendChild(el("h1", null, opts.titre || "Paramètres & contraintes"));
  h.appendChild(el("p", "pr__lead", opts.onglet
    ? "Les lignes qui agissent sur cet onglet, et ce que chacune dit de la composition à l'écran. "
      + "Tout le classement est dans Paramètres & contraintes."
    : "Tout ce qui influe sur une variante, une ligne par décision. Les CONTRAINTES disent si elle est "
      + "valide, les LEVIERS bornent la recherche, les PRÉFÉRENCES la guident ; l'ÉVALUATION mesure le "
      + "bâtiment produit puis le note, sans rien savoir de la façon dont il l'a été."));
  if(opts.rejouer){
    var rb = el("div", "pr-rejouer");
    var b = el("button", "btn btn--primary", opts.onglet === "mixer" ? "Rejouer la répartition" : "Rejouer la volumétrie");
    b.type = "button";
    b.addEventListener("click", opts.rejouer);
    rb.appendChild(b);
    var lien = el("a", "btn btn--quiet", "Tout le classement");
    lien.href = "#parametres";
    rb.appendChild(lien);
    h.appendChild(rb);
  }
  h.appendChild(legende());
  s.appendChild(h);
  s.appendChild(outils(s));
  if(opts.extra) s.appendChild(opts.extra);

  var tete = el("div", "pr-l pr-l--tete");
  tete.setAttribute("aria-hidden", "true");
  ["Ligne", "Valeur", "Force", "À l'écran"].forEach(function(t){ tete.appendChild(el("span", null, t)); });
  s.appendChild(tete);

  ETAT.ouvrir = opts.onglet ? 2 : 1;
  var arbre = rubriques(!!opts.onglet);
  if(ETAT.grouper === "role") arbre.forEach(function(g){ s.appendChild(g); });
  else {
    /* par sujet ou par onglet : les rangées de toutes les rubriques, regroupées */
    var tous = [], tmp = el("div");
    arbre.forEach(function(g){ tmp.appendChild(g); });
    tmp.querySelectorAll(".pr-l").forEach(function(n){ tous.push(n); });
    var G = {}, ordre = [];
    tous.forEach(function(n){
      var cle = (ETAT.grouper === "onglet" ? ONGLETS[n.dataset.onglet] : n.dataset.sujet) || "—";
      if(!G[cle]){ G[cle] = []; ordre.push(cle); }
      G[cle].push(n);
    });
    ordre.forEach(function(k){ s.appendChild(groupe(ETAT.grouper + "/" + k, 1, k, G[k])); });
  }
  s.appendChild(el("p", "pr-note", "Hors modèle : le thème, le mode, le tri et les filtres des variantes — des "
    + "préférences du compte (menu ◐, `net/prefs.js`). Elles ne changent aucune variante."));
  appliquerFiltre(s);
  return s;
}
