# SFD FCUBS — Gestion des comptes en déshérence

Application web full-stack conforme aux 9 mockups Oracle FLEXCUBE Enterprise
Browser (M01 à M09) de la SFD `BOA-TPOSIG-MCB-DESH-IHM-FCUBS-V2.0`.

## Structure

- `server/` — API Express + TypeScript, persistance SQLite (better-sqlite3).
  Implémente le modèle de persistance transversal (paramétrage versionné,
  dossier d'éligibilité, décisions N1/N2, réactivation, réconciliation,
  audit append-only) et le workflow Maker-Checker décrit dans la SFD.
- `client/` — Application React + TypeScript (Vite) reproduisant la charte
  Enterprise Browser (bandeau Oracle/FLEXCUBE, toolbar contextuelle, onglets
  Main/Audit, pied de page Record Status/Maker/Checker/Version).

## Écrans couverts

| Écran | Function ID | Finalité |
|---|---|---|
| M01 | BOA.DESH.PARAM | Paramétrage seuils, délais et workflow |
| M02 | BOA.DESH.ELIG | Catégories, transactions BANK et comptes indisponibles |
| M03 | BOA.DESH.N1.WORKLIST | Décision agence N1 |
| M04 | BOA.DESH.N2.WORKLIST | Décision back-office N2 |
| M05 | BOA.DESH.REACTIVATE | Saisie réactivation manuelle |
| M06 | BOA.DESH.REACT.AUTH | Autorisation réactivation |
| M07 | BOA.DESH.CIF.INQUIRY | Consultation Tiers et comptes |
| M08 | BOA.DESH.RECON.EXC | Anomalies et réconciliation |
| M09 | BOA.DESH.EOD.DASHBOARD | Pilotage batch et KPI |

## Principes de conception appliqués

- **Séparation des responsabilités** : paramétrage, décision, autorisation,
  consultation et supervision sont portés par des rôles distincts.
- **Maker-Checker** : chaque mutation sensible est persistée en statut `U`
  (non autorisé) puis nécessite une autorisation par un Checker distinct du
  Maker (`RG-04`) avant de passer en statut `A` (autorisé).
- **Tout ou rien Tiers/CIF** : le moteur d'éligibilité (`server/src/engine.ts`)
  évalue l'éligibilité sur le périmètre complet des comptes disponibles du
  CIF, en excluant les comptes déclarés indisponibles (M02).
- **Fraîcheur** : les décisions relisent le solde/statut CBS courant avant
  persistance ; un contrôle de version optimiste bloque toute écriture sur un
  enregistrement modifié depuis son chargement.
- **Traçabilité** : `audit_log` est append-only (consultations sensibles,
  décisions, autorisations, rejets, réactivations, exécutions batch).
- **Conservation** : un paramétrage déjà autorisé n'est jamais écrasé — une
  modification crée une nouvelle version, l'ancienne restant historisée.

## Rôles de démonstration

Un sélecteur de profil dans l'en-tête simule les rôles décrits dans la SFD :
Maker/Checker Paramétrage (M01/M02), Agence Maker/Checker (M03), Back-office
Maker/Checker (M04), Maker/Checker Réactivation (M05/M06), Support/Superviseur
Réconciliation (M08/M09) et Auditeur (consultation transverse en lecture
seule sur tous les écrans, y compris les journaux d'audit).

## Moteur d'éligibilité et batch EOD

`M09 - Pilotage batch et KPI` expose un bouton **Run EOD Batch** (réservé au
rôle superviseur) qui exécute le moteur d'éligibilité pour la date métier
sélectionnée : calcul de l'inactivité et du solde cumulé par Tiers/CIF,
application du paramétrage M01 et des règles M02, création des dossiers
d'éligibilité et alimentation de la worklist N1 (M03). Le traitement est
idempotent (pas de doublon pour une même date métier) et chaque exécution est
historisée dans `desh_batch_run`. La validation finale du décideur N2 (M04)
déclenche le traitement cible (bascule du compte en `DESHERENCE`) ; une
autorisation de réactivation (M06) recalcule le statut du compte (`ACTIVE`).

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
docker build -t sfd-desherence-app .
docker run -d -p 4000:4000 -v sfd-data:/app/data --name sfd-desherence sfd-desherence-app
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

Les tables de paramétrage/décision (`desh_parameter`, `desh_eligibility_rule`,
`desh_unavailable_account`, `desh_decision_n1`, `desh_decision_n2`,
`desh_reactivation`, `desh_exception`) sont versionnées (`version`,
`is_current`, `status` U/A) : Save persiste en statut `U` (nouvelle version si
l'enregistrement courant était déjà autorisé, sans écraser la version
autorisée), Authorize l'active et exige un Checker distinct du Maker (contrôle
4 yeux), Delete ne s'applique qu'aux enregistrements non autorisés. Les
tables `desh_eligibility_dossier` et `desh_batch_run` sont alimentées par le
moteur/batch EOD ; `audit_log` est append-only et alimente l'onglet Audit de
chaque écran.
