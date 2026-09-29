/* ============================================================================
   LE MENU DÉROULANT — une liste de choix qui s'ouvre sous un bouton.

   Le principe du Glide Select de React Bits, redit avec nos tokens :
   — la liste s'OUVRE en pop, depuis le coin du bouton, et se retourne au-dessus
     quand la place manque en bas ;
   — une PASTILLE glisse sous la ligne visée, à la souris comme au clavier, au
     lieu que chaque ligne s'allume pour son compte ; à l'ouverture, elle est
     déjà sous la ligne prise ;
   — la COCHE dit ce qui est pris ;
   — choisir referme SANS animation : le choix est fait, rien à regarder.

   Deux porteurs : le menu ◐ de la barre (main.js) et les listes déroulantes de
   Paramètres (parametres.js, `choix`). Les lignes se peignent à chaque
   ouverture : elles disent toujours l'état du moment.
   ========================================================================= */
import { el } from "../core/format.js";

export function item(txt, sous, on, fn){
  var b = el("button", "menu__item");
  b.type = "button";
  b.setAttribute("role", "menuitemradio");
  b.setAttribute("aria-checked", String(on));
  b.appendChild(el("span", null, txt));
  if(sous) b.title = sous;
  b.addEventListener("click", fn);
  return b;
}
export function titre(txt){
  var h = el("div", "menu__cap", txt);
  h.setAttribute("role", "presentation");
  return h;
}
export function separateur(){
  var s = el("div", "menu__sep");
  s.setAttribute("role", "separator");
  return s;
}

/* `racine` porte le bouton et la liste ; `peindre(liste)` y pose les lignes. */
export function deroulant(racine, bouton, liste, peindre){
  var pastille = null, minuteur = null;
  bouton.setAttribute("aria-haspopup", "menu");
  bouton.setAttribute("aria-expanded", "false");
  liste.setAttribute("role", "menu");
  liste.hidden = true;

  function ouvert(){ return bouton.getAttribute("aria-expanded") === "true"; }
  function lignes(){ return Array.prototype.slice.call(liste.querySelectorAll(".menu__item")); }
  /* `saut` : la pastille se pose sans glisser — à l'ouverture. */
  function viser(it, saut){
    if(!it) return;
    if(saut) pastille.style.transition = "none";
    pastille.style.transform = "translateY(" + it.offsetTop + "px)";
    pastille.style.height = it.offsetHeight + "px";
    pastille.style.opacity = "1";
    if(saut){ void pastille.offsetHeight; pastille.style.transition = ""; }
  }
  function dehors(e){ if(!racine.contains(e.target)) fermer(false, true); }

  function ouvrir(){
    clearTimeout(minuteur);
    while(liste.firstChild) liste.removeChild(liste.firstChild);
    pastille = el("span", "menu__pastille");
    pastille.setAttribute("aria-hidden", "true");
    liste.appendChild(pastille);
    peindre(liste);
    liste.hidden = false;
    bouton.setAttribute("aria-expanded", "true");
    var r = racine.getBoundingClientRect(), h = liste.offsetHeight + 8;
    liste.dataset.cote = r.bottom + h > window.innerHeight && r.top > h ? "haut" : "bas";
    /* Posée fermée, puis ouverte : c'est ce saut que la transition anime. */
    liste.dataset.etat = "ferme";
    void liste.offsetHeight;
    liste.dataset.etat = "ouvert";
    var on = liste.querySelector('[aria-checked="true"]') || lignes()[0];
    viser(on, true);
    if(on) on.focus({ preventScroll:true });
    document.addEventListener("pointerdown", dehors, true);
  }
  /* `pop` : la liste s'efface en se resserrant ; sinon elle disparaît. */
  function fermer(focus, pop){
    if(!ouvert()) return;
    document.removeEventListener("pointerdown", dehors, true);
    bouton.setAttribute("aria-expanded", "false");
    liste.dataset.etat = "ferme";
    var d = pop ? parseFloat(getComputedStyle(liste).transitionDuration) * 1000 : 0;
    clearTimeout(minuteur);
    if(d) minuteur = setTimeout(function(){ liste.hidden = true; }, d);
    else liste.hidden = true;
    if(focus) bouton.focus({ preventScroll:true });
  }

  bouton.addEventListener("click", function(){ if(ouvert()) fermer(false, true); else ouvrir(); });
  bouton.addEventListener("keydown", function(e){
    if((e.key === "ArrowDown" || e.key === "ArrowUp") && !ouvert()){ e.preventDefault(); ouvrir(); }
  });
  /* La souris donne le focus à la ligne survolée : la pastille n'a qu'un
     maître, et les flèches repartent de là où l'on pointe. */
  liste.addEventListener("pointermove", function(e){
    var it = e.target.closest && e.target.closest(".menu__item");
    if(it && it !== document.activeElement) it.focus({ preventScroll:true });
  });
  liste.addEventListener("focusin", function(e){
    var it = e.target.closest && e.target.closest(".menu__item");
    if(it) viser(it, false);
  });
  /* Le choix a déjà agi (son propre écouteur) : on referme, sans pop. */
  liste.addEventListener("click", function(e){
    if(e.target.closest && e.target.closest(".menu__item")) fermer(true, false);
  });
  liste.addEventListener("keydown", function(e){
    var L = lignes(), i = L.indexOf(document.activeElement), n = L.length;
    if(e.key === "ArrowDown" || e.key === "ArrowUp"){
      e.preventDefault();
      L[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n].focus();
    } else if(e.key === "Home" || e.key === "End"){
      e.preventDefault();
      L[e.key === "Home" ? 0 : n - 1].focus();
    } else if(e.key === "Escape"){ e.stopPropagation(); fermer(true, false); }
    else if(e.key === "Tab") fermer(false, false);
  });
  return { ouvrir:ouvrir, fermer:fermer };
}
