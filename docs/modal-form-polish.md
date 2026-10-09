# Polish des formulaires de jeux

Cette étape conserve les comportements et la DA : aucun changement de données, de sauvegarde, de transfert ni de validation.

- Collection, Wishlist et Arrivages : nom et plateforme précèdent les deux options d’édition, regroupées sur une ligne et explicitement facultatives. Les labels restent des cibles tactiles de 44 px.
- L’aperçu d’image reste horizontal (16:9), sans recadrage : 112 × 63 px sur desktop, 160 × 90 px sur une ligne dédiée sur mobile/tablette. Les champs restent accessibles sans panneau supplémentaire.
- Les résumés en édition, le pied d’actions, le focus, Échap et les annulations restent identiques.
- Vente et import conservent leur présentation. L’import est vérifié avec 40 titres longs et un écran de 700 px de haut ; aucune nouvelle refonte n’est nécessaire dans cette étape.

## Vérification

`modal-form-layout.cjs` couvre les trois créations, les options, les aperçus vides et chargés, les titres longs, l’absence de débordement, l’accès à Enregistrer et les imports longs annulés sans écriture, à 320/390/820/1440 px dans les deux thèmes. `modal-actions` et `dialog-keyboard` couvrent aussi l’édition, les actions et le clavier.

La comparaison CSS utilise les styles de la branche de base avec le même HTML courant. Elle exclut uniquement l’intérieur des trois modales volontairement modifiées et continue de comparer les pages, les overlays et toutes les autres modales (vente, import et plateformes compris), à sept largeurs dans les deux thèmes. Les changements visuels autorisés sont contrôlés par le test de disposition dédié et les captures.

## Suite éventuelle

Les champs facultatifs restent affichés pour préserver l’accès direct et éviter d’ajouter une étape à la saisie. Un masquage progressif serait une décision UX distincte. Les claviers virtuels iOS/Android et les lecteurs d’écran nécessitent encore une validation sur appareil réel.
