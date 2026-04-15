# Cahier de fabrication — Boucherie Carrefour

Application web progressive (PWA) pour remplacer le cahier de fabrication papier.

## Structure des fichiers

```
cahier-fabrication/
├── index.html        → Écran de connexion
├── accueil.html      → Page d'accueil avec historique
├── saisie.html       → Création d'une fabrication
├── detail.html       → Consultation d'une fiche
├── manifest.json     → Configuration PWA (installation Android)
├── css/
│   └── style.css     → Styles de l'application
└── js/
    └── app.js        → Logique complète de l'application
```

## Comptes de démonstration

| Identifiant              | Mot de passe |
|--------------------------|--------------|
| boucher@carrefour.com    | demo1234     |
| chef@carrefour.com       | demo1234     |
| olivier@carrefour.com    | admin        |

## Comment tester

1. Ouvrir `index.html` dans un navigateur (Chrome recommandé)
2. Se connecter avec un des comptes ci-dessus
3. Créer une fabrication, scanner des ingrédients, prendre une photo

## Stockage

Pour l'instant, les données sont stockées en **localStorage** (sur l'appareil).  
La prochaine étape est de brancher **Firebase** pour une base de données centralisée.

## Installation sur le TR (Android)

1. Ouvrir l'URL de l'app dans Chrome Android
2. Menu Chrome → "Ajouter à l'écran d'accueil"
3. L'app s'installe comme une application native

## Prochaines étapes

- [ ] Brancher Firebase (base de données centralisée)
- [ ] Intégrer le SSO Carrefour (après validation DSI)
- [ ] Connecter une API produit pour l'identification par code-barres
- [ ] Ajouter l'export PDF pour les contrôles hygiène
