# Images des jeux

- **Image entière** est le mode par défaut, y compris pour les jeux et sauvegardes existants. Les proportions et tout le contenu sont conservés. Une copie agrandie, floutée et assombrie derrière l’image remplit seulement les espaces laissés libres. Une image opaque au bon format masque entièrement ce fond.
- **Remplir le cadre** agrandit l’image sans déformation et coupe les bords qui dépassent, avec un centrage fixe. Le fond flouté est alors masqué.
- Le choix se règle près de l’aperçu d’image dans les formulaires Collection, Wishlist et Arrivages, y compris l’édition d’un jeu du Cimetière. L’aperçu réagit immédiatement.
- Le champ `imageFit` (`contain` / `cover`) reste attaché au jeu lors des sauvegardes, restaurations et transferts. Aucun changement des images source ni migration des données existantes. Les valeurs inconnues reviennent à Image entière.
- Le rendu est partagé entre cartes, miniatures des listes, résumés et aperçus. Le fond est décoratif (`alt` vide, `aria-hidden`) et les images introuvables gardent les fallbacks existants.

Vérification : images larges, portrait et 16:9, deux modes, aperçu interactif, rechargement, transferts, valeurs anciennes/inconnues et image en erreur. Captures à 320/390/1440 px dans les deux thèmes. La comparaison CSS avec main exclut les calques d’images volontairement modifiés et conserve la comparaison de leur disposition environnante ; les formulaires restent couverts par leurs tests dédiés.
