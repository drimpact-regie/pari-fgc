# Format d'import Invitational / Prestataire

Fichier `.xlsx` (recommandé) ou `.csv`, utilisé pour créer la structure d'un
event Invitational/Prestataire (showmatch, weekly, exhibition) depuis
`/admin/invitational` (import initial par un admin) ou depuis
`/partner/invitational/[eventId]` (import/ré-import self-service par le
prestataire, une fois sa demande confirmée — voir
`lib/invitationalRequests.ts`). L'import ne pose que la structure (liste des
matchs, leur ordre/regroupement, les compétiteurs prévus) — pas les scores ni
les résultats, saisis ensuite depuis l'admin ou la page partenaire au fil de
l'event.

Le parseur est dans `lib/invitationalImport.ts` (testé dans
`lib/invitationalImport.test.ts`). Un modèle prêt à remplir par format est
disponible dans `public/templates/invitational/` (voir
`lib/invitationalTemplates.ts` pour la correspondance format → fichier),
téléchargeable depuis la page partenaire.

Le format déclaré dans l'onglet `Info` doit correspondre à celui choisi à la
demande d'event (voir `/invitational/request`) : un ré-import self-service
d'un fichier d'un autre format est rejeté (`importMatchesIntoInvitationalEvent`
dans `lib/invitationalEvents.ts`) — changer de format nécessite un admin.

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

Une ligne d'en-tête, puis une ligne par match. La ligne d'en-tête n'est pas
forcément la toute première ligne de l'onglet : le parseur cherche la
première ligne contenant à la fois "Joueur A" et "Joueur B" (correspondance
exacte après normalisation, jamais une sous-chaîne dans un texte libre) —
les modèles d'exemple fournis pour chaque format placent une légende
au-dessus de cette ligne, sans que ça gêne l'import.

Colonnes attendues (l'ordre n'a pas d'importance, la casse et les accents
ne comptent pas) :

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

#### Compétiteurs pas encore déterminés (`TBD_...`)

Il n'existe pas de fonction "ajouter un match" une fois l'event importé —
les formats à progression (bracket, suisse...) doivent donc déjà lister
**tous** les tours dans le fichier d'import, y compris ceux dont les
participants ne sont pas encore connus.

Une cellule `Joueur A`/`Joueur B` commençant par le préfixe `TBD_`
(insensible à la casse) est reconnue comme un slot **en attente**, pas
comme un vrai joueur : elle porte une description libre affichée telle
quelle côté admin (ex. `TBD_Vainqueur QF1` → "En attente : Vainqueur QF1").
`Tag`/`Pays` sont ignorés pour cette cellule. Une ligne où les deux
compétiteurs sont des placeholders `TBD_...` reste un match réel à créer
— elle n'est pas traitée comme une ligne vide.

Une fois le tour précédent joué, l'admin renseigne le vrai compétiteur
depuis `/admin/invitational/[event]` (édition du match) : si le nom saisi
correspond (insensible à la casse/aux espaces) à un compétiteur déjà
présent dans l'event, il est réutilisé (sa série de victoires continue de
s'accumuler) plutôt que dupliqué.

#### Colonnes optionnelles ignorées par l'import

Les modèles d'exemple ajoutent des colonnes `Format (FT)`, `Rounds par
manche` et `Verif manette`, ainsi que des colonnes techniques (`Statut`,
`Rang attente`, `Rang pret`) — elles alimentent l'onglet `Rundown`
(estimation d'horaires) et les formules de l'onglet `Vue d'ensemble` de ces
modèles, mais ne sont **jamais lues par l'import** : seules les colonnes
listées plus haut comptent.

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
