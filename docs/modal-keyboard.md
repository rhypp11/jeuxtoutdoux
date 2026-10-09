# Modales : clavier et interactions

Première étape issue de l’audit des formulaires, sans refonte visuelle.

- Toutes les modales ont un rôle de dialogue, un titre accessible et un focus initial. Une confirmation destructive commence sur Annuler.
- Tab et Maj+Tab restent dans la fenêtre au premier plan. Le fond et les fenêtres inférieures sont `inert` tant qu’une modale est ouverte.
- Échap annule uniquement la fenêtre au premier plan. Dans la création de plateforme, le premier Échap abandonne le petit formulaire, le suivant ferme la modale.
- Un clic sur le fond ne ferme aucun formulaire : il conserve la saisie. Annuler/Terminé et Échap sont les moyens explicites de fermer. Échap ne demande pas de confirmation supplémentaire et abandonne le brouillon courant.
- La fermeture rend le focus au déclencheur ; après reconstruction d’une carte/liste, son identifiant stable permet de retrouver l’élément. Si celui-ci a disparu, le focus rejoint la navigation active. Les cartes et lignes Wishlist/Arrivages peuvent ouvrir leur éditeur avec Entrée ou Espace.
- Les noms et plateformes obligatoires des trois formulaires affichent une erreur liée au champ avec `aria-describedby`, `aria-invalid` et une annonce. La création et le renommage des plateformes traitent aussi les noms absents ou en double. Les règles existantes de prix, dates et sauvegarde restent inchangées.
- L’annulation de commande, réception, retour vers la wishlist et import ne déclenche aucune écriture. La sauvegarde et les transferts continuent d’utiliser leurs fonctions métier existantes.

`dialogs.js` centralise uniquement le cycle des dialogues et les erreurs de champ. Chaque module fournit sa fonction d’annulation afin de conserver le nettoyage de son état. Le détecteur de mises à jour suit aussi cette nouvelle ressource.

Validation : `tests/dialog-keyboard.cjs` couvre focus, Tab dans les deux sens, inert, Échap, imbrication, erreurs, clic extérieur et annulation des transferts/imports à 320/390/1440 px, en clair/sombre. Les suites existantes contrôlent les données, les parcours et la disposition. La comparaison CSS utilise le balisage et les scripts actuels avec les feuilles de `main` pour isoler le rendu des changements d’accessibilité.

Restent pour la suite : essais avec lecteur d’écran et clavier virtuel sur appareil réel, messages de validation supplémentaires si nécessaire, puis polish des champs optionnels et de l’aperçu d’image. Aucun de ces points n’est présenté comme validé ici.
