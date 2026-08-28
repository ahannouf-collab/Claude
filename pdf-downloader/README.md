# Téléchargeur PDF — Scribd / Calameo

Application web qui automatise le clic sur le bouton **« Télécharger »**
d'un document Scribd ou Calameo, quand ce bouton est proposé publiquement
par le site (c'est-à-dire quand le propriétaire du document a lui-même
activé le téléchargement).

## Portée volontairement limitée

Cet outil ne fait rien de plus que ce qu'un visiteur pourrait faire à la
main dans son navigateur :

1. il ouvre la page du document dans un navigateur headless (Playwright) ;
2. il cherche un bouton/lien visible portant le texte « Download » ou
   « Télécharger » ;
3. s'il le trouve, il clique dessus et récupère le fichier téléchargé ;
4. s'il ne le trouve pas, il **s'arrête** et renvoie une erreur claire —
   il ne tente aucune extraction des images de la visionneuse ni aucun
   autre contournement des protections du site.

Pour Scribd, un formulaire optionnel permet de se connecter avec son
propre compte (identifiants transmis uniquement pour la requête en cours,
jamais stockés) afin de télécharger ses propres documents.

## Démarrage

```bash
cd pdf-downloader
npm install          # installe aussi le navigateur Chromium pour Playwright
npm start
```

Puis ouvrir http://localhost:3000.

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute HTTP |

## Structure

```
pdf-downloader/
  server.js          # API Express (POST /api/download, GET /api/file/:token)
  src/
    detect.js         # Reconnaît scribd.com / calameo.com
    downloader.js      # Automatisation Playwright (recherche + clic du bouton)
  public/              # Frontend statique (formulaire + statut)
  downloads/            # Fichiers temporaires (purgés 10 min après génération)
```

## Limites connues

- Si le document ne propose pas de téléchargement public, l'application
  renvoie une erreur explicite plutôt que de tenter un contournement.
- Les sélecteurs recherchent un texte « Download »/« Télécharger » ; si
  Scribd ou Calameo change son interface, il peut être nécessaire
  d'ajuster `findDownloadControl` dans `src/downloader.js`.
