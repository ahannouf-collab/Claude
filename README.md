# SFD FCUBS — Référentiel des Événements Compte

Application web full-stack conforme aux 9 mockups Oracle FLEXCUBE Enterprise
Browser (M1 à M9) de la SFD `BOA-TPOSIG-MCB-REFCOMPTE-SFD-MOCKUPS-FCUBS-V1.0`.

## Structure

- `server/` — API Express + TypeScript, persistance SQLite (better-sqlite3).
  Implémente le modèle de persistance transversal (objets versionnés,
  append-only, workflow Maker/Checker) et les règles de gestion RG-M1 à RG-M9.
- `client/` — Application React + TypeScript (Vite) reproduisant la charte
  Enterprise Browser (bandeau Oracle/FLEXCUBE, toolbar contextuelle, onglets
  Main/Details/Audit, pied de page Record Status/Maker/Checker/Version).

## Écrans couverts

| Écran | Function ID | Pattern | Titre |
|---|---|---|---|
| M1 | MCDCEVNT | Maintenance | Code Event Maintenance |
| M2 | MCSAEVTS | Consultation | Active Account Events |
| M3 | MCDAEVTH | Consultation | Account Event History |
| M4 | MCDCEVRS | Maintenance | Event Reason Maintenance |
| M5 | MCDESOP | Maintenance | Event / SOP Impact Matrix |
| M6 | MCSEVREJ | Exploitation | Event Interface Rejection Monitor |
| M7 | MCSAEVST | Consultation | Account Events & Global Restriction |
| M8 | MCDMCLMX | Maintenance | MCL Restriction Contribution |
| M9 | MCSMCLMN | Exploitation | MCL Commutation Monitor |

## Sécurité / profils (démo)

Un sélecteur de profil dans l'en-tête simule les rôles décrits dans la SFD :
`FCUBS_PARAM_MAKER`, `FCUBS_PARAM_CHECKER`, `FCUBS_VIEWER`, `FCUBS_OPS_N2`,
`FCUBS_OPS_SENIOR`, `FCUBS_AUDITOR`. Chaque profil n'affiche que les fonctions
autorisées et active/désactive la toolbar contextuelle en conséquence
(New/Query/Unlock/Save/Delete/Submit/Authorize/Copy/Print/Close).

## Démarrage

```bash
# Terminal 1 — API (port 4000, SQLite auto-initialisée et pré-alimentée)
cd server
npm install
npm run dev

# Terminal 2 — Client (port 5173, proxy /api vers le port 4000)
cd client
npm install
npm run dev
```

Puis ouvrir http://localhost:5173.

## Déploiement (Docker)

L'application est packagée en une seule image Docker autonome : le serveur
Express sert à la fois l'API (`/api/*`) et les fichiers statiques du build
React (fallback SPA sur toutes les autres routes). La base SQLite est écrite
dans `/app/data/data.sqlite` (volume Docker), donc les données survivent aux
redémarrages/mises à jour du conteneur.

```bash
# Build + run avec docker-compose (recommandé)
docker compose up --build -d

# Ou manuellement :
docker build -t sfd-fcubs-app .
docker run -d -p 4000:4000 -v sfd-data:/app/data --name sfd-fcubs sfd-fcubs-app
```

Puis ouvrir http://localhost:4000 (l'API et le front sont servis sur le même
port en production, contrairement au mode dev qui utilise deux ports).

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4000` | Port d'écoute HTTP |
| `DB_PATH` | `/app/data/data.sqlite` | Chemin du fichier SQLite |

Pour déployer sur une plateforme PaaS (Render, Railway, Fly.io, etc.), pointer
simplement la plateforme sur ce `Dockerfile` à la racine du repo — c'est un
build Docker standard sans dépendance particulière à l'infrastructure locale.

> Note : la construction de l'image nécessite de pouvoir tirer l'image de
> base `node:20-bookworm-slim` depuis Docker Hub. Si votre réseau restreint
> les registres de conteneurs (proxy d'entreprise, environnement bac à sable),
> lancez le build depuis un poste/CI qui a accès à Docker Hub.

## Modèle de persistance

Chaque table de paramétrage (`ref_event_code`, `ref_event_reason`,
`ref_sop_event_matrix`, `mcl_restriction_contrib`) est versionnée
(`version`, `is_current`, `status` DRAFT/SUBMITTED/AUTHORIZED) : Unlock crée
une nouvelle version brouillon à partir de la version autorisée courante,
Authorize l'active et exige un Checker distinct du Maker (contrôle 4 yeux),
Delete ne s'applique qu'aux brouillons jamais autorisés. Les tables
`hist_evt_compte`, `event_rejection_log` et `commutation_history` sont
append-only et alimentent respectivement M3, M6 et M9.
