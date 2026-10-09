# Audit rapide des modales et formulaires

Audit du 9 octobre 2026, pendant le nettoyage CSS. Aucun changement de design ni de comportement des formulaires dans cette PR.

## À traiter ensuite

1. **Clavier et lecteurs d’écran — priorité haute.** Seul l’overlay d’import Cimetière déclare `role="dialog"`, `aria-modal` et un titre accessible. Les autres overlays devraient adopter le même contrat. Les fonctions d’ouverture/fermeture ne partagent pas de gestion du focus : le nom reçoit le focus en création, le canal en vente, mais l’édition et les plateformes n’en définissent pas ; aucun confinement du focus ni retour systématique au déclencheur n’est implémenté. À vérifier ensuite avec Tab/Maj+Tab, Échap et un lecteur d’écran, y compris l’éditeur imbriqué du Cimetière.

2. **Fermeture et modifications en cours — priorité haute.** Le formulaire Collection évite volontairement la fermeture au clic extérieur. L’import se ferme au clic extérieur mais ne gère pas Échap dans son module. Harmoniser les règles et définir ce qui doit se passer si des champs ont changé, sans casser l’annulation des transferts ni les protections de sauvegarde.

3. **Erreurs de saisie — priorité moyenne.** Les validations du nom et de la plateforme déplacent le focus ; elles gagneraient à annoncer aussi un message lié au champ. Les erreurs d’import ont une zone dédiée, tandis que certains autres parcours utilisent des toasts. Définir une présentation cohérente, puis vérifier les champs prix/date et les erreurs de persistance avec des données fictives.

4. **Densité et petits écrans — priorité moyenne.** Les sections d’identité et d’achat existent déjà, et l’édition masque une partie des champs derrière des résumés. La création affiche davantage de champs optionnels. Sur la capture à 390 px, l’aperçu d’image vide est étroit et son libellé se coupe ; c’est une piste de polish ciblé pour une prochaine PR. Conserver les actions Annuler/Enregistrer accessibles et tester aussi le clavier virtuel et une longue liste de correspondances d’import.

## Ce qui est déjà vérifié ici

- Contrôle clavier ciblé à 390 px : ouvrir une édition laisse le focus sur le bouton d’ajout derrière la modale ; Échap laisse l’import ouvert ; Tab depuis sa dernière action sort de l’overlay. Ces comportements existants sont documentés, sans correction dans cette PR.
- Comparaison avec le HTML et les six feuilles CSS de `main`, à 320, 390, 640, 820, 900, 1100 et 1440 px, en clair et sombre.
- Dix-huit scènes : pages Collection/Wishlist/Arrivages/Cimetière, statut, tiroirs, profil, commande/réception, création/édition, vente, import et plateformes. Styles calculés, pseudo-éléments et géométrie comparés sans exclusions mobiles.
- Suites existantes pour les actions des modales et les parcours métier ; aucune refonte des formulaires dans ce nettoyage.

## Limites

Il s’agit d’un audit du code et de contrôles automatisés sur navigateur de bureau, complétés par la lecture des captures. Un essai avec lecteur d’écran et clavier virtuel sur appareil réel reste nécessaire avant de considérer le futur chantier d’accessibilité comme validé.
