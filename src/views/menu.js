import { el } from "../core/format.js";

/* Menu déroulant — le composant qui manquait pour ranger la barre d'outils.

   L'onglet Plan exposait vingt-deux commandes simultanément, à plat et au même
   poids visuel, dont la plus proéminente (fond encre plein) déclenchait un tirage
   au sort destructif. Sans un moyen de replier, la seule façon de hiérarchiser
   était de supprimer des fonctions — ce qui est exclu.

   Une entrée porte, au choix :
     { label, hint, on }              une action
     { label, hint, pressed, on }     un interrupteur, libellé FIXE
     { sep:true }                     un séparateur
   `hint` dit la conséquence, y compris destructive : c'est ce qui remplace les
   libellés qui mentaient sur ce qu'ils faisaient. */

var openMenu = null;

function closeOpen(){
  if(!openMenu) return;
  openMenu.btn.setAttribute("aria-expanded","false");
  openMenu.pop.hidden = true;
  openMenu = null;
}

document.addEventListener("pointerdown", function(e){
  if(openMenu && !openMenu.root.contains(e.target)) closeOpen();
});
/* En CAPTURE et avec `stopImmediatePropagation`. L'éditeur de plan et l'onglet
   Site posent eux aussi un gestionnaire d'Échap sur `document` : entre écouteurs
   d'un même nœud, `stopPropagation` ne suffit pas — ils se déclenchent tous.
   Fermer un menu désélectionnait donc la pièce en cours. */
document.addEventListener("keydown", function(e){
  if(e.key === "Escape" && openMenu){
    e.stopImmediatePropagation();
    e.preventDefault();
    var b = openMenu.btn;
    closeOpen();
    b.focus();
  }
}, true);

export function menu(label, items, opts){
  opts = opts || {};
  var root = el("div","menu");
  var btn = el("button","btn menu__btn");
  btn.type = "button";
  btn.appendChild(document.createTextNode(label));
  btn.appendChild(el("span","menu__caret"));
  btn.setAttribute("aria-expanded","false");
  btn.setAttribute("aria-haspopup","true");
  if(opts.title) btn.title = opts.title;

  var pop = el("div","menu__pop");
  pop.hidden = true;
  if(opts.align === "right") pop.classList.add("is-right");

  var built = [];
  function build(){
    while(pop.firstChild) pop.removeChild(pop.firstChild);
    built = [];
    (typeof items === "function" ? items() : items).forEach(function(it){
      if(it.sep){ pop.appendChild(el("hr","menu__sep")); return; }
      if(it.head){ pop.appendChild(el("h4","label menu__head", it.head)); return; }
      var b = el("button","menu__item");
      b.type = "button";
      if(it.pressed !== undefined){
        b.setAttribute("role","menuitemcheckbox");
        b.setAttribute("aria-checked", String(!!it.pressed));
      } else {
        b.setAttribute("role","menuitem");
      }
      if(it.disabled) b.disabled = true;
      var t = el("span","menu__label", it.label);
      b.appendChild(t);
      /* La raison d'une commande indisponible était dans un `title`, donc
         invisible au clavier, au doigt et sur mobile. */
      if(it.hint) b.appendChild(el("span","menu__hint", it.hint));
      if(it.danger) b.classList.add("is-danger");
      b.addEventListener("click", function(e){
        if(b.disabled) return;
        closeOpen();
        it.on(e);
      });
      pop.appendChild(b);
      built.push(b);
    });
  }

  btn.addEventListener("click", function(){
    var wasOpen = openMenu && openMenu.root === root;
    closeOpen();
    if(wasOpen) return;
    build();
    pop.hidden = false;
    btn.setAttribute("aria-expanded","true");
    openMenu = { root:root, btn:btn, pop:pop };
    if(built[0]) built[0].focus();
  });

  pop.addEventListener("keydown", function(e){
    var i = built.indexOf(document.activeElement);
    var d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if(!d) return;
    e.preventDefault();
    var n = (i + d + built.length) % built.length;
    built[n].focus();
  });

  pop.setAttribute("role","menu");
  root.appendChild(btn);
  root.appendChild(pop);
  return root;
}
