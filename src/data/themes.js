/* ============================================================================
   LES THÈMES INSTALLÉS — source unique de la liste déroulante du thème.

   Un thème est un fichier de `styles/themes/`, au format de shadcn/ui : il ne
   redéfinit que les noms shadcn (`--background`, `--primary`, `--radius`…),
   pour le mode clair et le mode sombre. « Saxon » est le thème d'origine,
   posé sur `:root` dans `tokens.css` : il n'a pas de fichier.

   Le THÈME et le MODE sont deux choix distincts : chaque thème a sa version
   claire et sa version sombre, et « automatique » suit le système.

   Installer un thème : un fichier dans `styles/themes/`, une ligne ici.
   ========================================================================= */
export var THEMES = [
  { id:"saxon",   n:"Saxon",   d:"le thème d'origine du projet" },
  { id:"neutral", n:"Neutral", d:"shadcn/ui, la palette par défaut", css:"styles/themes/neutral.css" },
  { id:"liquid-glass", n:"Liquid Glass", d:"tweakcn — Apple Liquid Glass", css:"styles/themes/liquid-glass.css" },
  { id:"zen",     n:"Zen",     d:"tweakcn — Zen Inspired Theme", css:"styles/themes/zen.css" },
  { id:"claude-plus", n:"Claude +", d:"tweakcn — Claude +", css:"styles/themes/claude-plus.css" }
];

export var MODES = [
  { id:"auto",  n:"Automatique", d:"suit le système" },
  { id:"light", n:"Clair" },
  { id:"dark",  n:"Sombre" }
];

export function themeOf(id){
  for(var i = 0; i < THEMES.length; i++) if(THEMES[i].id === id) return THEMES[i];
  return THEMES[0];
}
export function modeOf(id){
  for(var i = 0; i < MODES.length; i++) if(MODES[i].id === id) return MODES[i];
  return MODES[0];
}
