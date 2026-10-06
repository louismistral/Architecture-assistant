# L'échange — l'app, les logiciels, les humains, les IA

## Le principe : passer de l'un à l'autre ne coûte rien

Le travail ne vit ni dans l'app ni dans Rhino : il vit dans **l'état du projet**, que tout le
monde peut prendre et rendre.

- **Les environnements** — l'app, Rhino, Archicad, InDesign — sont des endroits où l'on
  travaille l'état, pas des endroits où il est enfermé.
- **Les acteurs** — les humains, Claude, l'algorithme — sont interchangeables à tout moment :
  on prend ce que l'algo a généré, on le retouche à la main, Claude itère, l'app note, l'algo
  varie à l'intérieur, et ainsi de suite.
- **La note** est la même partout et pour tous. Le jugement ne lit que des mesures, et les
  mesures que la géométrie : un volume revenu de Rhino est noté comme un volume tiré
  (`mass/import.js`).
- **La boucle** : les humains définissent la recherche et la notation (Paramètres) → l'algo
  génère → Claude édite en raisonnant (skill `atelier`) → humains et Claude retouchent dans
  Rhino (Claude par le MCP Rhino) → retour dans l'app pour la note → on itère jusqu'à ce que la
  phase se fige (le cadenas de l'onglet) → phase suivante.

**Le test :** si passer d'un environnement ou d'un acteur à l'autre coûte plus que ce qu'il
rapporte, c'est un défaut. Une fonction qui empêche quelqu'un d'avancer en est un.

Concrètement, trois choses le tiennent :

| quoi | où | ce qu'elle garantit |
|---|---|---|
| **la convention de calques** | `src/data/calques.js` | un fichier qui la suit se relit sans qu'on sache qui l'a fait, ni où |
| **la couleur de ce qui est généré** | `GENERE`, même fichier | on voit, dans Rhino comme au retour, ce que l'algo ou une IA a fait et ce qu'un humain a retouché |
| **la filiation des variantes** | `parent_id`, `net/variantes.js` | chaque passage est une variante qui dit d'où elle part ; on lit ce qu'il a fait à la note |

## La convention de calques

Tout ce qui sort de l'app et tout ce qui y revient. Cinq calques mères, des sous-calques à
toute profondeur. **L'arbre évolue** : un calque qui manque se crée (dans `calques.js`, puis
ici), et ce qui n'a pas encore sa place va dans `AUTRE`, qu'on classera plus tard.

```
AIDE                      ce qui aide à dessiner et ne revient jamais
  Perimetre               le périmètre du concours (drapé sur le terrain)
  Recul_5m                la ligne de recul du PACom
BLOCKS
2D
  Courbes
    01 XXS                0,06 mm, gris — l'arrière-plan : courbes, existants, trames
    02 XS                 0,06 mm
    03 S                  0,13 mm
    04 M                  0,18 mm
    05 L                  0,25 mm
    06 XL                 0,35 mm
  Hatchs                  les aplats
  Textes
3D
  Projet
    Volume                LE SEUL CALQUE RELU par l'import du massing
      <Chapitre>          Ecole, Sport, UAPE, Technique, Infrastructures
        Niveau_<nom>      un maillage fermé par étage de chaque corps
        Second_temps      la piscine, le local CAD
    Architecture          toits, auvents, rampes — exportés, pas relus
  Contexte                terrain, existants
AUTRE                     ce qui n'a pas encore sa place
```

- **Le séparateur** est celui de Rhino, `::`. AutoCAD refuse `:` dans un nom de calque : le DXF
  écrit le chemin avec `$` (`2D$Courbes$04 M`). Que Rhino en refasse un arbre ou les garde à plat
  reste à vérifier sur un vrai poste.
- **Le chapitre d'un étage** : celui de ses postes s'il en nomme (la salle de sport, le second
  temps), sinon celui qui porte le plus de surface au niveau, hors postes qui ont leur propre
  corps. Un corps du massing porte sa part de chaque poste du niveau ; le chapitre dit donc ce
  qui domine l'étage, pas ce qu'il contient seul.
- **Les épaisseurs** : chaque trait d'une planche va au sous-calque de la taille la plus proche
  de son épaisseur ; un XS clair est un XXS. L'épaisseur est celle du calque, plus celle du
  trait : six tailles au lieu d'un calque par épaisseur rencontrée (une vingtaine sur une
  planche). Les pointillés restent un type de ligne sur l'objet, sur le même calque.
- **Les noms** sont en ASCII : un nom accentué arrive mutilé selon la version de Rhino.

### La couleur dit qui, le calque dit quoi

Ce que l'algorithme ou une IA a produit est **bleu**, `GENERE` = RVB 0, 90, 255, couleur forcée
sur l'objet ; ce qu'un humain dessine garde la couleur de son calque. Mêmes calques pour les
deux. Seulement dans les fichiers exportés : l'app garde ses couleurs.

- **Dans Rhino** : ce que vous retouchez, passez-le en couleur **Par calque**. Ce que vous
  dessinez de neuf l'est déjà. Claude, par le MCP Rhino, pose ce qu'il crée en bleu.
- **Au retour** : un objet bleu a été généré, un autre a été dessiné ou retouché. Le corps qu'il
  fait le garde (`v.main`, dans l'instantané) et l'export suivant ne le repeint pas en bleu. Un
  corps retouché fusionné avec un autre rend le tout retouché.
- **Ce qui ne vient pas de nous** — le périmètre, le recul : couleur du calque.
- **Les planches** (DXF, SVG) gardent leurs couleurs de dessin : elles se mettent en page, elles
  ne reviennent pas.

### Ce qui suit la convention aujourd'hui

| fichier | sens | état |
|---|---|---|
| `.3dm` du Massing (`mass/export.js`, `mass/import.js`) | aller et retour | ✔ calques, bleu, variante source |
| DXF des planches (`core/pdf.js — dxf()`) | aller | ✔ `2D$Courbes$…`, `2D$Hatchs`, `2D$Textes` |
| SVG des planches | aller | ✘ — un calque Illustrator est un groupe, et regrouper par calque changerait l'ordre de dessin (un aplat blanc qui masque un trait passerait dessous). À faire si l'on en a besoin, sur une planche qui n'utilise pas de masque |
| plans des Typologies | aller et retour | proposition plus bas |

## La filiation des variantes

Une variante peut avoir une **mère** (`parent_id`, migration `20261006120000`) : celle dont
l'état est parti. L'app la retient d'elle-même (`source()` dans `net/variantes.js`, gardée sur
l'appareil) :

- **charger** une variante en fait la source ; **enregistrer** pose la nouvelle comme sa fille,
  puis la nouvelle devient la source — on continue à partir d'elle ;
- la **recherche automatique** pose ses trouvailles comme filles de la source ;
- l'**export .3dm** écrit la source dans le fichier (`Saxon variante`) ; l'**import** la relit :
  ce qui revient de Rhino, même d'une autre machine, sait d'où il part ;
- Claude passe `--parent <uuid>` à `variante` (`tools/claude.mjs`) ; `importer` le lui donne.

La carte dit **« ↳ de « mère » · +4 »** : ce que ce passage a fait à la note. Chercher le nom
d'une variante montre ses filles. L'acteur reste dans le nom et les étiquettes (`claude`,
`algo`). Tant que la migration n'est pas passée sur la base, l'app se passe de la colonne.

## Claude dans Rhino

Le MCP Rhino s'utilise comme d'habitude, avec ce contexte en plus :

1. **De l'app vers Rhino** — `node tools/claude.mjs rhino` écrit `.atelier/massing.3dm` depuis
   l'état ; Claude l'importe dans le document Rhino par le MCP (ou un humain par Import). Il
   faut rhino3dm en local : `npm i --no-save rhino3dm@8.35.0` (node_modules est ignoré).
2. **Dans Rhino** — Claude crée ses objets sur les calques de la convention, en bleu ; un humain
   retouche et repasse en Par calque.
3. **De Rhino vers l'app** — enregistrer le .3dm (le document entier convient : seul
   `3D::Projet::Volume` est relu), puis `node tools/claude.mjs importer <f.3dm>` : l'état prend
   la volumétrie, le bilan donne la note, et la variante mère à passer à `variante --parent`.
   Dans l'app, c'est le bouton « Importer (.3dm) » du Massing.
4. **Varier à l'intérieur** — sur un volume revenu de Rhino, la recherche automatique avec les
   seules typologies cochées essaie les plans de CE volume ; `tirer --typo` aussi.

## Ce qui reste à faire

- **Varier un massing autour des corps retouchés** : `genMass()` compose tout depuis rien. Lui
  faire garder les corps `main` et tirer le reste est un changement du générateur (`mass/gen.js`),
  à mener seul, quand on en aura besoin.
- **Le SVG en calques**, plus haut.
- **Archicad** : à brancher par IFC quand il entrera dans la boucle.
- **L'aller-retour des Typologies**, qui suit.

## Proposition : l'aller-retour des Typologies

Le plan d'un niveau se tire aujourd'hui de sa seed et des cotes de pièces (`typo/etat.js`) ;
rien d'autre ne l'enregistre. Pour qu'un plan retouché dans Rhino revienne et soit noté, il faut
que l'app sache le RELIRE — et le jugement ne lit que ce que `lirePlans()` mesure : des pièces,
leurs postes, leurs façades, les couloirs, les noyaux. Ni murs, ni portes. La convention en
découle : **on échange des pièces, pas un dessin**.

```
3D
  Projet
    Plans
      Niveau_<nom>        à l'altitude du plancher : le plan se pose dans son volume
        Pieces
          <Chapitre>      une polyligne FERMÉE par pièce
        Couloirs          une polyligne fermée par tronçon
        Noyaux            une polyligne fermée par cage (escalier + ascenseur)
        Halls             dégagements et halls
    Volume
2D                        le dessin du plan (murs, portes, mobilier) : exporté, jamais relu
```

- **Une pièce dit son poste** par le texte utilisateur de l'objet, `poste=<clé>` — la clé de
  `program.js`, chapitre et nom (`ecole|Salle de classe`) —, et par son nom d'objet, lisible.
  Dans Rhino, on dessine une nouvelle pièce en copiant une voisine : le texte utilisateur suit.
  Une pièce sans poste revient « non reconnue », notée sans, et le contrôle la nomme.
- **La surface se relit, elle ne se décrète pas** : une salle de classe redessinée à 68 m² au
  lieu de 72 est un écart que le contrôle signale (règle première : les surfaces sont fixes).
- **La couleur** : bleu = tiré par la seed ; Par calque = retouché. Une pièce retouchée est
  FIXÉE : le prochain tirage de la seed pose le reste autour d'elle.
- **Côté app**, trois morceaux :
  1. `typo/export.js` — les pièces, couloirs et noyaux du plan à l'écran, niveau par niveau, dans
     le même repère que le massing ;
  2. `typo/import.js` — les polylignes relues en plan, sous la forme que `lirePlans()` mesure ;
  3. l'état : un plan relu entre dans l'instantané (`typo.plans`), et passe AVANT la seed —
     les mesures le lisent, le jugement le note, la variante le garde. Tirer une autre seed le
     remplace, après confirmation, en gardant les pièces fixées.

À trancher avant de l'écrire : `Plans` sous `3D::Projet` (à l'altitude, superposé au volume) ou
sous `2D` (à plat, un niveau à côté de l'autre) ; et si une pièce retouchée doit vraiment se
fixer, ou seulement être notée.
