/* ============================================================================
   LES ICÔNES — un seul jeu, dessiné au trait (le vocabulaire de Lucide, qui
   est celui de shadcn/ui). Elles héritent de `currentColor` : aucune couleur
   ici, le bouton qui les porte décide.

   Une icône n'est jamais seule à dire ce que fait un bouton : le bouton porte
   un `aria-label` ou un libellé visible.
   ========================================================================= */
var NS = "http://www.w3.org/2000/svg";

/* Des tracés, pas des images : chacun est une liste d'éléments SVG. */
var P = {
  reglages: [["path", { d:"M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" }]],
  plus:     [["path", { d:"M12 5v14M5 12h14" }]],
  croix:    [["path", { d:"M18 6 6 18M6 6l12 12" }]],
  poubelle: [["path", { d:"M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" }],
             ["path", { d:"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }],
             ["path", { d:"M10 11v6M14 11v6" }]],
  /* annuler : la flèche qui revient — la face d'une suppression qui brûle */
  annuler:  [["path", { d:"M9 14 4 9l5-5" }], ["path", { d:"M4 9h10.5a5.5 5.5 0 0 1 0 11H11" }]],
  /* trier : deux flèches opposées */
  trier:    [["path", { d:"m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16" }]],
  /* filtrer : trois barres qui raccourcissent */
  filtrer:  [["path", { d:"M3 6h18M7 12h10M10 18h4" }]],
  loupe:    [["circle", { cx:"11", cy:"11", r:"7" }], ["path", { d:"m20 20-3.5-3.5" }]],
  recharger:[["path", { d:"M21 12a9 9 0 1 1-2.64-6.36L21 8" }], ["path", { d:"M21 3v5h-5" }]],
  info:     [["circle", { cx:"12", cy:"12", r:"9" }], ["path", { d:"M12 16v-5M12 8h.01" }]],
  image:    [["rect", { x:"3", y:"3", width:"18", height:"18", rx:"2" }],
             ["circle", { cx:"9", cy:"9", r:"2" }], ["path", { d:"m21 15-5-5L5 21" }]],
  note:     [["path", { d:"M4 4h16v11l-5 5H4z" }], ["path", { d:"M15 20v-5h5" }]],
  lien:     [["path", { d:"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" }],
             ["path", { d:"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" }]],
  fleche:   [["path", { d:"M5 19 19 5M10 5h9v9" }]],
  chevron:  [["path", { d:"m6 9 6 6 6-6" }]],
  cadrer:   [["path", { d:"M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" }]],
  main:     [["path", { d:"M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" }],
             ["path", { d:"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" }]],
  curseur:  [["path", { d:"m4 4 7 17 2.5-7.5L21 11z" }]],
  moins:    [["path", { d:"M5 12h14" }]],
  soleil:   [["circle", { cx:"12", cy:"12", r:"4" }],
             ["path", { d:"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" }]],
  lune:     [["path", { d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" }]],
  /* automatique : le disque à demi plein — clair et sombre, selon le système */
  auto:     [["circle", { cx:"12", cy:"12", r:"9" }], ["path", { d:"M12 3v18a9 9 0 0 0 0-18z", fill:"currentColor" }]],
  ext:      [["path", { d:"M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]],
  gauche:   [["path", { d:"m15 18-6-6 6-6" }]],
  droite:   [["path", { d:"m9 18 6-6-6-6" }]],
  /* shuffle : deux trajets qui se croisent — rebattre la forme */
  shuffle:  [["path", { d:"M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4" }],
             ["path", { d:"M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4" }]],
  /* le dé du mixer, à la taille du jeu : rebattre le programme */
  de:       [["rect", { x:"3", y:"3", width:"18", height:"18", rx:"3" }],
             ["path", { d:"M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01", "stroke-width":"3" }]],
  telecharger: [["path", { d:"M12 3v12M7 10l5 5 5-5M5 21h14" }]],
  cible:    [["circle", { cx:"12", cy:"12", r:"7" }], ["path", { d:"M12 2v4M12 18v4M2 12h4M18 12h4" }]],
  /* LES PARTIS du massing, en plein : la figure se lit à sa masse, pas à son
     contour. Une tuile par parti, dans `views/massing.js`. */
  "p-auto":      [["path", { d:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", fill:"currentColor", stroke:"none" }]],
  "p-compact":   [["path", { d:"M6 6h5.5v12H6zM12.5 6H18v12h-5.5z", fill:"currentColor", stroke:"none" }]],
  "p-barre":     [["path", { d:"M2 9.5h20v5H2z", fill:"currentColor", stroke:"none" }]],
  "p-barres":    [["path", { d:"M3 4h18v3.5H3zM3 10.25h18v3.5H3zM3 16.5h18V20H3z", fill:"currentColor", stroke:"none" }]],
  "p-L":         [["path", { d:"M5 4h4.5v10H20v4.5H5z", fill:"currentColor", stroke:"none" }]],
  "p-U":         [["path", { d:"M4 4h4.5v10h7V4H20v14.5H4z", fill:"currentColor", stroke:"none" }]],
  "p-cour":      [["path", { d:"M4 3h16v3.5H4zM4 6.5h3.5v7H4zM16.5 6.5H20v7h-3.5zM4 16.5h16V20H4z", fill:"currentColor", stroke:"none" }]],
  "p-pavillons": [["path", { d:"M3 4h5v5H3zM10 3h5v5h-5zM17 5h5v5h-5zM5 14h5v5H5zM14 15h5v5h-5z", fill:"currentColor", stroke:"none" }]],
  "p-hameau":    [["path", { d:"M3.3 6.3 9.4 4.1l1.2 3.4-6.1 2.2zM14 3.8l6.3 2.1-1.1 3.4-6.3-2.1zM7.6 15.5l8.9-1 .4 3.6-8.9 1z", fill:"currentColor", stroke:"none" }]],
  "p-terrasses": [["path", { d:"M3 3h18v3.5H3zM3 10h14v3.5H3zM3 17h10v3.5H3z", fill:"currentColor", stroke:"none" }]],
  "p-peigne":    [["path", { d:"M3 3h18v3.5H3zM4 6.5h3v14H4zM10.5 6.5h3v14h-3zM17 6.5h3v14h-3z", fill:"currentColor", stroke:"none" }]],
  "p-libre":     [["path", { d:"M3 5h8v4.5H3zM15.6 3.2l4.3.9-1.7 8.3-4.3-.9zM7 15h11v4.5H7z", fill:"currentColor", stroke:"none" }]]
};

export function icone(nom, taille){
  var s = document.createElementNS(NS, "svg");
  var t = String(taille || 16);
  s.setAttribute("width", t); s.setAttribute("height", t);
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.9");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", "ic ic--" + nom);
  (P[nom] || []).forEach(function(e){
    var n = document.createElementNS(NS, e[0]), k;
    for(k in e[1]) n.setAttribute(k, e[1][k]);
    s.appendChild(n);
  });
  return s;
}
