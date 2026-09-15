# FC Clash Mobile — Football Arcade & Carrière

Jeu de football arcade jouable sur **iPhone 13** (et tout mobile) directement
depuis Safari, sans passer par l'App Store : c'est une **PWA** (Progressive
Web App) installable sur l'écran d'accueil.

> ⚠️ Univers **100 % fictif** : clubs, joueurs, noms et ligue sont générés
> procéduralement. Aucun club, joueur, compétition ou logo réel n'est utilisé
> (contrainte de droits d'auteur vis-à-vis des jeux sous licence officielle
> type EA Sports FC). Les mécaniques (carrière, transferts, personnalisation,
> match tactile) s'en inspirent librement.

## Fonctionnalités

- **Match jouable en tactile** : joystick virtuel (déplacement) + bouton TIR,
  moteur physique arcade (Phaser 3 + Arcade Physics), IA pour les 21 autres
  joueurs (gardiens, marquage de zone, pressing sur le porteur du ballon).
- **Mode Carrière** : saison de 19 journées en championnat (aller simple),
  classement, calendrier, journal d'événements, enchaînement automatique des
  saisons.
- **Marché des transferts / Packs** : monnaie virtuelle gagnée uniquement en
  jouant les matchs (aucun paiement réel), 3 packs (Bronze/Or/Élite) pour
  recruter de nouveaux joueurs générés aléatoirement avec système de rareté.
- **Personnalisation de club** : nom, couleurs (principale/secondaire),
  formation (4-4-2 / 4-3-3 / 3-5-2), sélection des titulaires.
- **Progression des joueurs** : XP gagnée par les titulaires à chaque match,
  montée de niveau qui augmente leur note globale (OVR).
- **Sauvegarde locale automatique** (localStorage) : la carrière reprend là
  où vous l'avez laissée.

## Jouer sur iPhone 13

1. Déployez le build (`npm run build` puis servez le dossier `dist/`, ou une
   plateforme d'hébergement statique — voir plus bas).
2. Ouvrez l'URL dans **Safari** sur l'iPhone 13.
3. Appuyez sur l'icône de partage (le carré avec la flèche) puis
   **« Sur l'écran d'accueil »**.
4. Lancez l'app depuis l'icône ⚽ créée sur l'écran d'accueil : elle s'ouvre
   en plein écran, sans barre Safari, comme une app native.
5. Tournez le téléphone en **mode paysage** pour jouer les matchs (le jeu
   tente de verrouiller l'orientation automatiquement une fois installé en
   PWA plein écran).

Le service worker met les ressources en cache après la première visite : le
jeu (hors nouvelles données réseau, ici inutiles puisque tout est local)
reste jouable **hors-ligne**.

## Développement local

```bash
cd game
npm install
npm run dev       # http://localhost:5174 (ouvrez aussi depuis le réseau local sur l'iPhone : http://<IP-du-PC>:5174)
```

## Build de production

```bash
npm run build      # sortie dans game/dist/
npm run preview    # sert le build pour vérification locale
```

Le dossier `dist/` est un site statique autonome : n'importe quel
hébergement de fichiers statiques (Netlify, Vercel, GitHub Pages, Nginx,
`docker-compose` avec un serveur statique, etc.) suffit. HTTPS est requis
pour que l'installation PWA fonctionne correctement sur iPhone.

## Régénérer les icônes

Les icônes PWA (`public/icons/*.png`) sont produites par un script sans
dépendance externe (encodeur PNG minimal + zlib intégré à Node) :

```bash
npm run gen-icons
```

## Structure du code

- `src/state.ts` — modèle de sauvegarde (club, effectif, calendrier,
  classement, monnaie) + toutes les transitions de carrière.
- `src/data/` — génération procédurale des joueurs/clubs/noms fictifs et des
  dispositions tactiques par formation.
- `src/ui/app.ts` — écrans de menu (Accueil, Carrière, Effectif, Transferts)
  en DOM/HTML, tactile-first.
- `src/scenes/MatchScene.ts` — scène Phaser du match : terrain, IA, tirs,
  buts, chronomètre.
- `src/touch/` — joystick virtuel et bouton d'action tactiles.
