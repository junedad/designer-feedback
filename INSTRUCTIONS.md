# Designer Feedback — installation et prise en main

## En bref

- **Designer Feedback** est une extension pour Chrome (et Edge, Brave, Arc… tout navigateur Chromium récent).
- Elle sert à **noter des retours sur n'importe quelle page web** : vous pointez un élément, vous tracez une zone ou vous capturez l'écran, puis vous écrivez votre commentaire.
- Tout reste **sur votre ordinateur**. Rien n'est envoyé sur Internet.
- Vous n'avez **rien à installer d'autre** : l'extension est déjà prête dans le dossier `extension`.

---

## 1. Installer l'extension (2 minutes)

1. **Dézippez** le fichier `Designer-Feedback.zip` où vous voulez (par exemple dans *Documents*).
   Vous obtenez un dossier `Designer-Feedback` qui contient ce fichier et un dossier `extension`.
2. **Ne supprimez pas et ne déplacez pas** ce dossier ensuite : Chrome lit l'extension directement depuis cet emplacement.
3. Ouvrez Chrome et tapez dans la barre d'adresse : `chrome://extensions` puis Entrée.
4. En haut à droite, activez **Mode développeur**.
5. Cliquez sur **Charger l'extension non empaquetée** (bouton en haut à gauche).
6. Choisissez le dossier **`extension`** (celui qui contient un fichier `manifest.json`) et validez.
7. La carte **Designer Feedback** apparaît : c'est installé.
8. Cliquez sur l'icône puzzle 🧩 en haut à droite de Chrome, puis sur l'épingle 📌 à côté de *Designer Feedback* pour garder l'icône (un appareil photo orange) toujours visible.

> Si Chrome affiche un message « Désactiver les extensions en mode développeur » au démarrage, fermez-le simplement. C'est normal pour une extension chargée à la main.

**Version de Chrome requise** : 114 ou plus récente (menu ⋮ → Aide → À propos de Google Chrome pour vérifier).

---

## 2. Premiers pas

1. Allez sur la page web sur laquelle vous voulez faire des retours.
2. Cliquez sur l'icône **Designer Feedback** : un panneau s'ouvre sur le côté. Créez une **session** (par exemple « Retours site client »).
3. Activez le **mode feedback** : touche `Alt+Maj+F` (voir tableau plus bas) ou l'interrupteur dans le panneau. Un badge **ON** apparaît sur l'icône et une barre d'outils s'affiche en bas de la page.
4. Choisissez ce que vous voulez capturer :
   - **Élément** (`D`) : passez la souris, un cadre bleu suit l'élément visé. Cliquez pour le sélectionner.
   - **Zone** (`Z`) : tracez un rectangle avec la souris.
   - **Écran** (`V`) : capture tout ce qui est visible à l'écran.
5. Une petite carte s'ouvre : **écrivez votre commentaire** (la première ligne sert de titre), puis `Ctrl+Entrée` (ou `⌘+Entrée` sur Mac) pour enregistrer.
6. Répétez autant de fois que nécessaire. Pour **quitter le mode**, appuyez sur `Échap` ou `Alt+Maj+F`.

Un feedback = un commentaire + une ou plusieurs captures. Pour **ajouter une capture à un feedback existant**, gardez `Maj` enfoncée en capturant.

---

## 3. Relire, trier, partager

- En haut du panneau latéral, l’icône **Ouvrir la review** ouvre la page **Review** : vous y voyez tous vos feedbacks sous forme de tableau. Vous pouvez modifier un commentaire, **changer l'ordre en glissant-déposant**, marquer un feedback comme traité, fusionner ou supprimer.
- **Copier** : le bouton de copie met dans le presse-papiers un texte avec les images, que vous pouvez coller directement dans **Notion, Jira, un e-mail, Google Docs**…
- **Exporter** :
  - `.zip` : un fichier texte (Markdown) + un dossier `images`.
  - `.json` : toutes les données, images comprises.

---

## 4. Raccourcis clavier

Sur Mac : `⌥` = Option, `⇧` = Maj. Sur Windows / Linux : `Alt` et `Maj`.

| Raccourci | Effet |
|---|---|
| `Alt+Maj+F` | Activer / couper le mode feedback sur l'onglet |
| `Alt+Maj+E` | Sélectionner un élément, une seule fois |
| `Alt+Maj+S` | Capturer une zone, une seule fois |
| `Alt+Maj+P` | Ouvrir le panneau latéral |
| `D` / `Z` / `V` (en mode actif) | Élément / Zone / Écran |
| `↑` `↓` `←` `→` (en mode actif) | Viser le parent, l'enfant ou les voisins de l'élément |
| `Entrée` (en mode actif) | Sélectionner l'élément visé |
| `Ctrl+Entrée` (`⌘+Entrée` sur Mac) | Enregistrer le commentaire |
| `Échap` | Fermer / annuler / quitter le mode |

Un raccourci ne marche pas, ou vous voulez le changer ? Ouvrez `chrome://extensions/shortcuts` et réassignez-le.

---

## 5. Mettre à jour ou désinstaller

- **Mise à jour** : si on vous envoie une nouvelle version, remplacez le contenu du dossier `extension` par le nouveau, puis dans `chrome://extensions` cliquez sur la flèche circulaire ↻ de la carte *Designer Feedback*.
- **Désinstaller** : `chrome://extensions` → **Supprimer** sur la carte *Designer Feedback*.

---

## 6. Problèmes fréquents

| Problème | Solution |
|---|---|
| Le mode ne s'active pas sur la page | Rechargez l'onglet (`F5`) après l'installation. |
| Impossible de l'utiliser sur `chrome://…` ou le Chrome Web Store | C'est une interdiction de Chrome, aucune extension ne peut y fonctionner. |
| Le bouton « Charger l'extension non empaquetée » n'existe pas | Activez d'abord **Mode développeur** (étape 4). |
| Chrome dit « Fichier manifeste manquant » | Vous avez choisi le mauvais dossier : il faut sélectionner `extension`, pas `Designer-Feedback`. |
| L'extension a disparu après avoir déplacé le dossier | Remettez le dossier à sa place ou rechargez-le (étapes 3 à 6). |
| Le raccourci `Alt+Maj` change la langue du clavier (Windows) | Réassignez le raccourci dans `chrome://extensions/shortcuts`. |

---

## 7. Vie privée

- Les sessions sont stockées dans votre navigateur (stockage local de l'extension).
- Aucune donnée n'est envoyée à un serveur.
- Supprimer l'extension supprime aussi toutes les sessions : **exportez avant** si vous voulez les garder.
