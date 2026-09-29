/* ============================================================================
   LES PRÉFÉRENCES DU COMPTE

   Ce qui suit la PERSONNE d'un appareil à l'autre, et ne change rien à ce
   qu'un autre membre voit : le thème et le mode, la barre « Atelier et
   outils » ouverte ou non, le tri, le filtre et la recherche des variantes.

   Ce ne sont pas des décisions de projet — celles-là sont dans
   `net/reglages.js`, partagées au groupe. Ici, deux personnes du même groupe
   peuvent avoir deux thèmes sans que l'outil mente.

   DEUX COPIES, et une seule vérité à la fois :
   — sur l'appareil (`saxon.prefs`), lue au démarrage, avant tout rendu : le
     thème ne doit pas clignoter en attendant la base ;
   — sur le compte (`profile.prefs`), lue à la connexion. Le compte GAGNE à ce
     moment-là : c'est ce que l'on a choisi ailleurs, et l'on s'attend à le
     retrouver. Ensuite chaque changement part aux deux.

   Sans compte, ou si la colonne manque (migration non jouée), tout marche sur
   l'appareil seul, sans rien dire : une préférence ne mérite pas un message
   d'erreur.
   ========================================================================= */
import { CPT, onCompte } from "./compte.js";
import { patchApi, selectApi } from "./supa.js";

var LKEY = "saxon.prefs";

export var PREFS = {
  theme: "saxon",       /* src/data/themes.js */
  mode: "auto",         /* auto · light · dark */
  nav: true,            /* la barre « Atelier et outils » ouverte */
  vTri: null,           /* { k, dir } — voir views/variantes.js */
  vFiltre: null,        /* { score, auteurs, etat, date, partis, tags } */
  vCherche: ""
};

var abonnes = [];
export function onPrefs(fn){
  abonnes.push(fn);
  return function(){ abonnes = abonnes.filter(function(f){ return f !== fn; }); };
}
function signale(){ abonnes.forEach(function(f){ try{ f(PREFS); }catch(_){} }); }

function fondre(o){
  if(!o || typeof o !== "object") return;
  for(var k in PREFS) if(k in o) PREFS[k] = o[k];
}

function ecrireLocal(){
  try{ localStorage.setItem(LKEY, JSON.stringify(PREFS)); }catch(_){}
}

/* ---------- lire ----------
   `saxon.theme` a porté seul le choix « auto · clair · sombre » : il devient le
   MODE du thème Saxon. On le lit une fois, puis la nouvelle clé le remplace. */
export function initPrefs(){
  try{
    var s = localStorage.getItem(LKEY);
    if(s) fondre(JSON.parse(s));
    else {
      var vieux = localStorage.getItem("saxon.theme");
      if(vieux === "light" || vieux === "dark") PREFS.mode = vieux;
    }
  }catch(_){ /* mode privé : on reste sur les valeurs par défaut */ }

  var vu = null;
  onCompte(function(){
    if(CPT.statut !== "dedans" || !CPT.profil || CPT.profil.id === vu) return;
    vu = CPT.profil.id;
    tirer();
  });
}

async function tirer(){
  try{
    var l = await selectApi("profile", "id=eq." + CPT.profil.id + "&select=prefs");
    var p = l && l[0] && l[0].prefs;
    if(p && Object.keys(p).length){
      fondre(p);
      ecrireLocal();
      signale();
    } else pousser();       /* un compte neuf reprend les choix de l'appareil */
  }catch(_){ /* colonne absente, réseau : l'appareil suffit */ }
}

/* ---------- écrire ---------- */
var minuteur = null;
function pousser(){
  if(!CPT.profil || CPT.statut !== "dedans") return;
  clearTimeout(minuteur);
  minuteur = setTimeout(function(){
    patchApi("profile", "id=eq." + CPT.profil.id, { prefs: PREFS }).catch(function(){});
  }, 800);
}

export function setPref(k, v){
  if(!(k in PREFS)) return;
  if(JSON.stringify(PREFS[k]) === JSON.stringify(v)) return;
  PREFS[k] = v;
  ecrireLocal();
  pousser();
  signale();
}
