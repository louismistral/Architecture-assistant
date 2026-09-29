/* ============================================================================
   MASSING › CONTRAINTES — RÈGLES DURES ET JUGEMENTS, EN DEUX BACS

   À gauche les RÈGLES DURES : une variante qui en enfreint une n'est jamais
   montrée. À droite les JUGEMENTS : chacun a un curseur de 0 à 10, et ils se
   partagent les 100 points de la note. Une entrée passe d'un bac à l'autre.

   Tout vient de `data/jugements.js` (les entrées) et de `DOC` (le bac et le
   poids vivants, `b_<id>` / `w_<id>`) ; la note, de `mass/juge.js — noter()`.
   La barre de couleur est la famille de surfaces (`families.js`) ; pointillée,
   l'entrée regarde tout le projet. Les seuils des mesures restent en bas, dans
   la section de doctrine d'origine.
   ========================================================================= */
import { el } from "../core/format.js";
import { CATS, JUGES } from "../data/jugements.js";
import { FAM } from "../data/families.js";
import { DOC, REGLES, docDefaut, estDure, poidsJ } from "../data/doctrine.js";
import { MASS, massSet } from "../mass/model.js";
import { jugementCourant } from "../mass/juge.js";
import { saveSoon } from "../mix/store.js";

var ferme = {};            /* bac + catégorie repliés, le temps de la session */

function titre(x){
  if(!x.r) return x.n;
  for(var i = 0; i < REGLES.length; i++) if(REGLES[i].id === x.r) return REGLES[i].titre;
  return x.r;
}
/* Les points d'un jugement : sa part des 100, parmi les jugements MESURÉS —
   ceux que le massing sait lire ; les autres attendent un onglet suivant. */
function parts(){
  var tot = 0;
  JUGES.forEach(function(x){ if(!estDure(x) && x.m.length) tot += poidsJ(x); });
  return function(x){ return !estDure(x) && x.m.length && tot ? 100 * poidsJ(x) / tot : 0; };
}
function pts(v){ return el("b", "jg-pts mono", v.toFixed(1).replace(".", ",")); }

/* L'état de l'entrée sur la composition à l'écran. */
function etat(x, j){
  if(!x.m.length) return ["soft", "non mesurée"];
  if(!j) return null;
  if(estDure(x)){
    var ko = x.m.some(function(k){ return j.dures.some(function(d){ return d.k === k; }); });
    return ko ? ["danger", "enfreinte"] : ["ok", "tenue"];
  }
  var s = j.juges.filter(function(o){ return o.id === x.id; })[0];
  return s ? [s.sc >= .75 ? "ok" : s.sc >= .4 ? "soft" : "warn", Math.round(s.sc * 100) + " %"] : null;
}

function ligne(x, j, part, refaire){
  var d = estDure(x), f = x.fam && FAM.filter(function(o){ return o.id === x.fam; })[0];
  var r = el("div", "jg-l");
  var bar = el("span", "jg-bar" + (f ? "" : " is-tout"));
  if(f) bar.style.setProperty("--jg-c", "var(" + f.c + ")");
  bar.title = f ? f.name : "Tout le projet";
  r.appendChild(bar);
  var c = el("div", "jg-l__c");
  var t = el("div", "jg-l__t");
  t.appendChild(el("span", "jg-l__n", titre(x)));
  var e = etat(x, j);
  if(e) t.appendChild(el("i", "chip chip--" + e[0], e[1]));
  c.appendChild(t);
  c.appendChild(el("span", "jg-l__o mono", x.id + (x.ex ? " · " + x.ex : "")));
  if(!d){
    var cur = el("div", "jg-cur");
    var i = el("input");
    i.type = "range"; i.min = "0"; i.max = "10"; i.step = "1"; i.value = String(poidsJ(x));
    i.setAttribute("aria-label", "Importance de « " + titre(x) + " »");
    var lu = el("span", "mono jg-cur__v", poidsJ(x) + "/10");
    i.addEventListener("input", function(){ lu.textContent = i.value + "/10"; });
    i.addEventListener("change", function(){ DOC["w_" + x.id] = +i.value; saveSoon(); refaire(); });
    cur.appendChild(i); cur.appendChild(lu);
    c.appendChild(cur);
  }
  r.appendChild(c);
  var a = el("div", "jg-l__a");
  if(!d) a.appendChild(x.m.length ? pts(part(x)) : el("span", "jg-pts is-nm", "—"));
  var mv = el("button", "jg-mv", d ? "jugement →" : "← dure");
  mv.type = "button";
  mv.title = d ? "Passer aux jugements : ne bloque plus, compte dans la note" : "Passer en règle dure : élimine la variante qui l'enfreint";
  mv.addEventListener("click", function(){ DOC["b_" + x.id] = d ? 0 : 1; saveSoon(); refaire(); });
  a.appendChild(mv);
  r.appendChild(a);
  return r;
}

function bac(dur, j, part, refaire){
  var L = JUGES.filter(function(x){ return estDure(x) === dur; });
  var s = el("section", "jg-bac jg-bac--" + (dur ? "dur" : "jug"));
  var h = el("header", "jg-bac__h");
  h.appendChild(el("h2", null, dur ? "Règles dures" : "Jugements"));
  h.appendChild(el("span", "jg-bac__s", L.length + (dur ? " · éliminatoires" : " · 100 pts")));
  s.appendChild(h);
  Object.keys(CATS).forEach(function(c){
    var M = L.filter(function(x){ return x.c === c; });
    if(!M.length) return;
    var key = (dur ? "d" : "j") + c;
    var g = el("details", "jg-cat");
    g.open = !ferme[key];
    g.addEventListener("toggle", function(){ ferme[key] = !g.open; });
    var sm = el("summary", "jg-cat__h");
    sm.appendChild(el("span", "jg-cat__n", (c === "R" ? "" : c + " · ") + CATS[c]));
    sm.appendChild(el("span", "jg-cat__k mono", String(M.length)));
    if(!dur){
      var som = 0;
      M.forEach(function(x){ som += part(x); });
      sm.appendChild(el("span", "jg-cat__p mono", som.toFixed(1).replace(".", ",") + " pts"));
    }
    var tout = el("button", "jg-mv", dur ? "tout en jugements →" : "← tout en dures");
    tout.type = "button";
    tout.addEventListener("click", function(ev){
      ev.preventDefault();
      M.forEach(function(x){ DOC["b_" + x.id] = dur ? 0 : 1; });
      saveSoon(); refaire();
    });
    sm.appendChild(tout);
    g.appendChild(sm);
    M.forEach(function(x){ g.appendChild(ligne(x, j, part, refaire)); });
    s.appendChild(g);
  });
  return s;
}

function bouton(txt, f, cls){
  var b = el("button", "btn" + (cls ? " " + cls : ""), txt);
  b.type = "button";
  b.addEventListener("click", f);
  return b;
}

/* `rejouer()` regénère la volumétrie avec les bacs et les poids de l'instant. */
export function jugesVue(rejouer){
  var host = el("div", "jg");
  function refaire(){
    var y = window.scrollY, n = jugesVue(rejouer);
    host.replaceWith(n);
    window.scrollTo(0, y);
  }
  var j = jugementCourant(), part = parts();
  var nd = JUGES.filter(estDure).length;

  var h = el("header", "jg__h");
  h.appendChild(el("p", "jg__eye", "Massing · Contraintes"));
  h.appendChild(el("h1", null, "Règles dures et jugements"));
  h.appendChild(el("p", "jg__lead", "Une règle dure élimine la variante qui ne la respecte pas : elle n'est "
    + "jamais montrée. Les jugements se partagent 100 points selon leur importance : le volume qui "
    + "les remplit tous obtient 100. Seuls les jugements que le massing sait mesurer comptent ; "
    + "les autres attendent la typologie, la tectonique, le rendu."));
  var st = el("div", "jg-stats");
  [[JUGES.length, "entrées"], [nd, "règles dures"], [JUGES.length - nd, "jugements"],
   [j && j.total != null ? j.total + " / 100" : "—", "note de la variante"]].forEach(function(o){
    var d = el("div");
    d.appendChild(el("b", "mono", String(o[0])));
    d.appendChild(el("span", null, o[1]));
    st.appendChild(d);
  });
  h.appendChild(st);
  host.appendChild(h);

  var bar = el("div", "jg-bar-outils");
  bar.appendChild(bouton("Rejouer la volumétrie", rejouer, "btn--primary"));
  bar.appendChild(bouton("Tout déplier", function(){ ferme = {}; refaire(); }));
  bar.appendChild(bouton("Tout replier", function(){
    Object.keys(CATS).forEach(function(c){ ferme["d" + c] = ferme["j" + c] = true; }); refaire();
  }));
  var pis = el("div", "btn-group");
  pis.setAttribute("role", "group");
  pis.setAttribute("aria-label", "Piscine");
  pis.appendChild(el("span", "btn-group__label", "Piscine"));
  [["Avec", "auto"], ["Sans", "non"]].forEach(function(o){
    var b = bouton(o[0], function(){
      if((MASS.second === "non") === (o[1] === "non")) return;
      massSet("second", o[1]); saveSoon(); rejouer();
    });
    b.setAttribute("aria-pressed", String((MASS.second === "non") === (o[1] === "non")));
    pis.appendChild(b);
  });
  bar.appendChild(pis);
  bar.appendChild(bouton("Jugements à égalité", function(){
    JUGES.forEach(function(x){ DOC["w_" + x.id] = 5; }); saveSoon(); refaire();
  }));
  bar.appendChild(bouton("Revenir au tri de départ", function(){
    JUGES.forEach(function(x){ DOC["b_" + x.id] = docDefaut("b_" + x.id); DOC["w_" + x.id] = docDefaut("w_" + x.id); });
    saveSoon(); refaire();
  }));
  bar.appendChild(bouton("Copier en JSON", function(){
    var o = JUGES.map(function(x){
      return { id:x.id, cat:x.c, titre:titre(x), dure:estDure(x), poids:poidsJ(x), mesures:x.m };
    });
    if(navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(o, null, 2));
  }));
  host.appendChild(bar);

  var lg = el("div", "jg-leg");
  lg.appendChild(el("span", "jg-leg__t", "Familles de surfaces"));
  FAM.concat([{ id:null, name:"Tout le projet" }]).forEach(function(f){
    var n = JUGES.filter(function(x){ return x.fam === f.id; }).length;
    if(!n) return;
    var i = el("span", "jg-leg__i");
    var sw = el("i", "jg-sw" + (f.c ? "" : " is-tout"));
    if(f.c) sw.style.setProperty("--jg-c", "var(" + f.c + ")");
    i.appendChild(sw);
    i.appendChild(document.createTextNode(f.name));
    i.appendChild(el("span", "mono", String(n)));
    lg.appendChild(i);
  });
  host.appendChild(lg);

  var cols = el("div", "jg-cols");
  cols.appendChild(bac(true, j, part, refaire));
  cols.appendChild(bac(false, j, part, refaire));
  host.appendChild(cols);
  return host;
}
