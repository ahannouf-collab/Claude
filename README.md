# Cabinet Médical — Application de gestion

Application web full-stack pour la gestion d'un cabinet médical, adaptée au
contexte marocain : montants en dirhams (DH), couverture CNSS / CNOPS / AMO,
CIN, numéros de téléphone marocains, villes du Maroc.

## Structure

- `server/` — API Express + TypeScript, persistance SQLite (better-sqlite3).
  Authentification par JWT, rôles (`admin`, `medecin`, `secretaire`).
- `client/` — Application React + TypeScript (Vite), routage avec
  `react-router-dom`.

## Fonctionnalités

- **Authentification** avec rôles (administrateur, médecin, secrétaire).
- **Patients** : fiche complète (CIN, date de naissance, coordonnées, ville,
  mutuelle CNSS/CNOPS/AMO/Privée, groupe sanguin, allergies, antécédents,
  contact d'urgence), recherche, dossier patient avec historique.
- **Rendez-vous** : agenda journalier, création/modification, statuts
  (planifié, confirmé, terminé, annulé, absent), association médecin/acte.
- **Consultations** : dossier médical (motif, constantes — poids, taille,
  tension, température —, examen clinique, diagnostic, traitement,
  ordonnance imprimable, observations, prochain rendez-vous).
- **Facturation** : factures multi-lignes basées sur les actes et tarifs du
  cabinet, montants en DH, modes de paiement (espèces, carte, virement,
  mutuelle, chèque), suivi des paiements partiels/en attente.
- **Actes & tarifs** : catalogue des actes médicaux et de leurs tarifs (DH).
- **Utilisateurs** (réservé à l'administrateur) : gestion du personnel du
  cabinet (médecins avec spécialité, secrétaires).
- **Tableau de bord** : rendez-vous du jour, patients actifs, consultations
  du mois, revenus du mois, factures en attente, répartition des patients
  par couverture médicale.

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

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur (médecin) | admin@cabinet.ma | admin123 |
| Médecin (pédiatre) | k.bennani@cabinet.ma | medecin123 |
| Secrétaire | secretariat@cabinet.ma | secretaire123 |

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
docker build -t cabinet-medical-app .
docker run -d -p 4000:4000 -v cabinet-data:/app/data --name cabinet-medical cabinet-medical-app
```

Puis ouvrir http://localhost:4000 (l'API et le front sont servis sur le même
port en production, contrairement au mode dev qui utilise deux ports).

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4000` | Port d'écoute HTTP |
| `DB_PATH` | `/app/data/data.sqlite` | Chemin du fichier SQLite |
| `JWT_SECRET` | (à définir) | Clé de signature des jetons JWT — **à changer en production** |

Pour déployer sur une plateforme PaaS (Render, Railway, Fly.io, etc.), pointer
simplement la plateforme sur ce `Dockerfile` à la racine du repo — c'est un
build Docker standard sans dépendance particulière à l'infrastructure locale.
Pensez à définir `JWT_SECRET` avec une valeur secrète et aléatoire.

> Note : la construction de l'image nécessite de pouvoir tirer l'image de
> base `node:20-bookworm-slim` depuis Docker Hub. Si votre réseau restreint
> les registres de conteneurs (proxy d'entreprise, environnement bac à sable),
> lancez le build depuis un poste/CI qui a accès à Docker Hub.

## Modèle de données

- `users` — personnel du cabinet (admin/médecin/secrétaire), mot de passe
  hashé (bcrypt).
- `patients` — dossier administratif et médical de base.
- `actes` — catalogue des actes médicaux et tarifs (DH).
- `appointments` — rendez-vous liés à un patient, un médecin et un acte.
- `consultations` — dossier médical détaillé d'une visite (constantes,
  diagnostic, ordonnance).
- `invoices` / `invoice_items` — facturation multi-lignes avec suivi des
  paiements.
