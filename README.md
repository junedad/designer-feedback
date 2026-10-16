# Designer Feedback — extension Chrome

## TLDR

- Sessions de feedback sur n'importe quelle page : on vise un élément du DOM, on trace une zone ou on prend l'écran, on commente juste après.
- Un feedback = un commentaire + 1 à N pièces (éléments, zones, écrans mélangés). La première ligne du commentaire sert de titre.
- Side panel pour suivre la session et copier ; page Review façon base Notion pour éditer, réordonner, fusionner, supprimer.
- Copier = HTML riche avec images intégrées (collage Notion / Jira) + Markdown en texte brut. Exports `.zip` (Markdown + `images/`) et `.json` (images en base64).
- Tout reste en local (storage.local + IndexedDB), aucune requête réseau.

## Installer

1. `npm install && npm run build` → le dossier à charger est `.output/chrome-mv3`.
2. `chrome://extensions` → **Mode développeur** → **Charger l'extension non empaquetée** → choisir `.output/chrome-mv3`.
3. Épingler l'icône.

Sur un PC Windows ou Linux sans Node : `npm run zip` produit `.output/designer-feedback-1.0.0-chrome.zip`. Le dézipper sur la machine cible, puis faire les étapes 2 et 3 sur ce dossier. Chrome, Edge, Brave et les autres navigateurs Chromium récents (114 et plus, pour le side panel) conviennent.

Après une modification : `npm run build`, ↻ sur la carte de l'extension, puis recharger l'onglet. `npm run dev` reconstruit à chaud dans `.output/chrome-mv3-dev` (à charger à la place), sans lancer de navigateur.

## Raccourcis

Mêmes touches sur les trois systèmes, à la touche de modification près : `⌘` / `⌥` sur Mac, `Ctrl` / `Alt` sur Windows et Linux. L'interface affiche les libellés du système en cours, et les raccourcis globaux réellement assignés.

| Où | macOS | Windows / Linux | Effet |
|---|---|---|---|
| Partout | `⌥⇧F` | `Alt+Maj+F` | Activer / couper le mode feedback sur l'onglet (badge **ON**) |
| Partout | `⌥⇧E` | `Alt+Maj+E` | Sélectionner un élément, une fois, sans activer le mode |
| Partout | `⌥⇧S` | `Alt+Maj+S` | Capturer une zone, une fois, sans activer le mode |
| Partout | `⌥⇧P` | `Alt+Maj+P` | Ouvrir le side panel (= clic sur l'icône) |
| Hors mode | `⌥` tenu, `⌥`+clic | — | Viser un élément, le sélectionner |
| En mode | `D` / `Z` / `V` | idem | Élément (défaut) / zone / écran visible |
| En mode | `↑` `↓` `←` `→` | idem | Parent / enfant / voisins de l'élément visé |
| En mode | `↵` ou clic | idem | Sélectionner l'élément visé |
| En mode | `⇧` + capture | `Maj` + capture | Ajouter la pièce au dernier feedback |
| En mode | `Esc` | idem | Annuler l'ajout en cours, sinon quitter le mode |
| Carte | `⌘↵` | `Ctrl+Entrée` | Enregistrer et fermer |
| Carte | `⌘⇧↵` | `Ctrl+Maj+Entrée` | Garder ce feedback ouvert et lui ajouter une pièce |
| Carte | `Esc` | idem | Fermer (une capture neuve sans commentaire est abandonnée) |
| Review | `⌘A`, `Esc`, `⌫` | `Ctrl+A`, `Esc`, `Suppr` | Tout sélectionner, désélectionner, supprimer la sélection |

Choix de touches :

- **Alt+Maj+lettre** pour les raccourcis globaux : libre dans Chrome sur les trois systèmes, et rarement utilisé par les sites, contrairement à Ctrl+Maj (Slack, Google Docs, Jira…). Un raccourci global passe avant la page ; d'où ce choix. Tout se réassigne dans `chrome://extensions/shortcuts` (lien dans le panneau).
- **Pas de « Alt tenu » hors Mac** : sous Windows et Linux, Alt seul active le menu de Chrome, et Alt+clic déplace la fenêtre sur plusieurs bureaux Linux (Xfce, KDE 5…). `Alt+Maj+E` remplace ce geste.
- **Touches simples** (`D`, `Z`, `V`, flèches…) : prises seulement en mode actif, jamais dans un champ de saisie ni avec `⌘` / `Ctrl` / `Alt` (donc ni AltGr ni les raccourcis système). Mode coupé, la page reçoit toutes ses touches. Avec une disposition non latine (cyrillique, grec…), c'est la touche physique qui compte.
- Sous Windows, si `Alt+Maj` sert aussi à changer de langue de clavier et qu'un raccourci la fait basculer, réassigner (par exemple `Ctrl+Maj+lettre`).

## Comment ça marche

### Pas de conflit avec la page

Le content script pose un seul écouteur par type d'événement sur `window`, en phase de capture, à `document_start`, donc avant tout script de la page. Ce qui vient de l'overlay (Shadow DOM fermé) est traité puis stoppé : la page ne voit ni nos frappes, ni nos clics, ni nos `focusin` (les pièges à focus des modales ne volent pas le champ commentaire). Côté page, on ne bloque que les touches et clics effectivement consommés.

### Détection d'élément

- Traverse les Shadow DOM ouverts ; un morceau de SVG remonte au SVG entier.
- Accroche l'élément interactif le plus proche (bouton, lien, champ, `role=…`, image) plutôt que son `<span>` interne, et le texte en ligne remonte à son bloc.
- Les enveloppes de même taille sont fusionnées : on désigne la racine du composant.
- Fil d'Ariane : noms des composants React / Vue lus dans le monde MAIN (`react-main.content.ts`), éléments personnalisés, sinon repères (`main`, `nav`, `data-testid`, `id` stables).
- Sélecteur unique, avec ` >>> ` aux frontières de Shadow DOM, et le texte en secours pour retrouver l'élément.

Chaque sélection d'élément produit une capture recadrée (16 px de contexte, contour Azur).

### Stockage

| Clé | Contenu |
|---|---|
| `storage.local` `sessions`, `courante`, `dernier` | Sessions, session active, dernier feedback (pour `⇧`) |
| `storage.local` `fb:<sessionId>` | Liste ordonnée des feedbacks (texte et métadonnées) |
| IndexedDB `designer-feedback/images` | Les images, en Blob, par id |
| `storage.session` `mode:<tabId>` | Mode actif par onglet |

Le content script lit `storage.local` mais n'écrit jamais : captures et modifications passent par le background (`lib/messages.ts`).

## Tester

```bash
npm run build && uv run --with playwright python tests/e2e.py
```

Lance Chrome Canary en headless (`$CHROME_PATH`, profil `/tmp/cdp-designer-feedback`), charge l'extension via CDP `Extensions.loadUnpacked` (`--load-extension` est ignoré par Canary) et déroule ses vérifications sur `tests/site/` : accroche, fil React, Shadow DOM, fuites de touches, clics et focus vers la page, `⇧`, `Esc`, localisation, copie, exports, glisser-déposer, fusion, détachement, clics dans la barre et la carte, ⌥ sur Mac, Windows simulé (user-agent et plateforme émulés via CDP), disposition cyrillique. Le test lui-même suppose macOS + Canary ; l'extension, elle, tourne partout. Captures dans `tests/shots/`. Ajouter `--headed` pour regarder.

## Limites connues

- Pas de capture pleine page ni d'iframes (V2).
- Les raccourcis globaux (`chrome.commands`), un vrai Windows / Linux et le collage réel dans Notion / Jira ne sont pas couverts par le test automatique : à vérifier à la main.
- Pages `chrome://` et Chrome Web Store : Chrome interdit toute injection, le mode y est indisponible.
