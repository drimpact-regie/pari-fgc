# Format d'import Invitational / Prestataire

Fichier `.xlsx` (recommandé) ou `.csv`, utilisé pour créer la structure d'un
event Invitational/Prestataire (showmatch, weekly, exhibition) depuis
`/admin/invitational`. L'import ne pose que la structure (liste des matchs,
leur ordre/regroupement, les compétiteurs prévus) — pas les scores ni les
résultats, saisis ensuite depuis l'admin au fil de l'event.

Le parseur est dans `lib/invitationalImport.ts` (testé dans
`lib/invitationalImport.test.ts`).

## Fichier `.xlsx`

Deux onglets sont lus, un troisième optionnel est ignoré :

### Onglet `Info` (obligatoire)

Une seule ligne utile, deux colonnes :

| A | B |
|---|---|
| Format | `BRACKET_SINGLE` |

`B1` doit être une des valeurs suivantes (insensible à la casse, espaces/
tirets tolérés) :

- `BRACKET_SINGLE` — bracket à élimination simple
- `BRACKET_DOUBLE` — bracket à élimination double
- `ROUND_ROBIN` — round robin (tout le monde affronte tout le monde)
- `SWISS` — système suisse
- `POOLS` — poules
- `LIST` — simple liste de matchs, sans notion de bracket/progression

Cette valeur ne change pas la façon dont l'onglet `Matchs` est structuré
(voir plus bas, uniforme pour tous les formats) — elle sert à documenter/
valider l'event et pourra piloter un affichage adapté (bracket, poules...)
côté site.

### Onglet `Matchs` (obligatoire)

Une ligne d'en-tête, puis une ligne par match. Colonnes attendues (l'ordre
n'a pas d'importance, la casse et les accents ne comptent pas) :

| Groupe | Ordre | Joueur A | Tag A | Pays A | Joueur B | Tag B | Pays B |
|--------|-------|----------|-------|--------|----------|-------|--------|
| Winners Semi-Final | 1 | SonicFox | Fly | US | Leffen | TSM | SE |
| Winners Semi-Final | 2 | Kayos | | US | Punk | | US |

- **Groupe** : libellé de regroupement/affichage. Son sens dépend du
  format déclaré dans `Info` — round de bracket ("Winners Semi-Final",
  "Losers Round 1"...), round de swiss ("Round 1", "Round 2"...), poule
  ("Poule A", "Poule B"...). Laisser vide pour le format `LIST` (simple
  liste de matchs sans regroupement).
- **Ordre** : entier contrôlant l'ordre d'affichage au sein du groupe (et
  globalement). Optionnel — si absent, l'ordre des lignes du fichier est
  utilisé tel quel.
- **Joueur A / Joueur B** : nom du compétiteur (obligatoire pour qu'une
  ligne soit prise en compte — une ligne sans aucun des deux noms est
  ignorée silencieusement).
- **Tag A / Tag B** : nom d'équipe/sponsor affiché à côté du joueur (ex.
  "RZA" pour afficher "RZA | Sonicfox"). Optionnel.
- **Pays A / Pays B** : code pays ISO 3166-1 alpha-2 (`US`, `FR`, `SE`...)
  pour afficher un drapeau. Optionnel.

Chaque compétiteur est toujours un joueur individuel — pas de véritable
équipe à plusieurs joueurs sur une même ligne.

Un même joueur peut apparaître sur plusieurs lignes (plusieurs matchs) :
il est automatiquement dédupliqué par nom (insensible à la casse/aux
espaces) à l'import, pour que sa série de victoires se cumule correctement
au fil de l'event.

### Onglet `Rundown` (optionnel, jamais lu)

Peut être présent pour l'organisation technique de l'event côté
showrunner/régie (timing, notes de prod...). Cet onglet n'est **jamais lu
ni exploité par l'import** — sers-t'en librement, son contenu n'a aucun
impact sur ce qui est importé.

## Fichier `.csv`

Un CSV ne peut contenir qu'un seul tableau — la déclaration du format et le
tableau des matchs sont donc concaténés dans le même fichier, séparés par
une ligne vide :

```
Format,BRACKET_SINGLE

Groupe,Ordre,Joueur A,Tag A,Pays A,Joueur B,Tag B,Pays B
Winners Semi-Final,1,SonicFox,Fly,US,Leffen,TSM,SE
Winners Semi-Final,2,Kayos,,US,Punk,,US
```

Mêmes règles que l'onglet `Matchs` ci-dessus pour le tableau. Pas
d'équivalent CSV pour l'onglet `Rundown` (il n'a de sens que pour organiser
un fichier `.xlsx` multi-onglets).

## Erreurs d'import

Le parseur rejette l'import (aucune écriture en base) avec un message
explicite si :

- l'onglet `Info` ou `Matchs` est introuvable (`.xlsx`),
- la valeur de format est inconnue,
- les colonnes `Joueur A`/`Joueur B` sont introuvables dans l'onglet
  `Matchs`,
- aucune ligne de match valide n'est trouvée.
