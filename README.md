# UPL StageTrack

Gestion des présences des stagiaires de l'Université Protestante de Lubumbashi par QR Code.
Monorepo : `backend/` (API NestJS, Prisma, PostgreSQL) et `frontend/` (React, Vite, Tailwind).

- Déploiement et exploitation : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)
- Guide d'utilisation par rôle : [docs/GUIDE-UTILISATEUR.md](docs/GUIDE-UTILISATEUR.md)
- API documentée (développement) : `http://localhost:3000/api/docs`

## Fonctionnalités

| Domaine | Contenu |
| --- | --- |
| Authentification | JWT 15 min + rafraîchissement rotatif en cookie httpOnly, Argon2id, blocage après 5 tentatives par adresse et verrouillage du compte après 20 échecs, mot de passe provisoire à changer |
| Autorisation | Garde globale, refus par défaut, 9 rôles, compte relu en base à chaque requête |
| Étudiants | Fiche complète, photo, statut, périodes de stage, recherche, filtres, import CSV/Excel avec simulation |
| QR Codes | Jeton opaque 256 bits (aucune donnée personnelle), empreinte SHA-256 + copie chiffrée AES-256-GCM, PNG, carte PDF, régénération, révocation |
| Pointage | Caméra (html5-qrcode), saisie manuelle avec motif, heure serveur seule, contrainte unique en base, journal de chaque tentative |
| Clôture | Chaque minute : absents calculés, compteurs figés, rejouable, rattrapage après arrêt |
| Horaires | Plages versionnées, seuil de retard activé selon la configuration, jours actifs et jours non travaillés |
| Corrections | Administrateur seul, motif obligatoire, historique conservé, audit |
| Tableau de bord | Inscrits, présents matin/soir, absents, retards, taux, 14 jours, derniers pointages, filtres |
| Rapports | Journalier, hebdomadaire, mensuel, période libre ; par étudiant, faculté, promotion, session, jour ; Excel et PDF |
| Audit | Journal en ajout seul (déclencheurs PostgreSQL), consultation filtrée |
| Portail institutionnel | Accueil par rôle, supervision et paramètres institutionnels |
| Objets perdus et trouvés | Déclaration et réclamation publiques, modération et restitutions |
| Parc informatique | Laboratoires, machines, signalements QR, contrôles et interventions |

## Prérequis

- Node.js 22.9 ou plus récent
- Docker (PostgreSQL 16) ou un PostgreSQL 16 local

## Installation en développement

```bash
npm ci
npm run db:up                         # PostgreSQL + base de test stagetrack_test

cp backend/.env.example backend/.env  # puis remplacer chaque CHANGER (commandes dans le fichier)

cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed                    # rôles, types de composants, compte administrateur
cd ..

npm run dev:api                       # http://localhost:3000/api
npm run dev:web                       # http://localhost:5173
```

## Tests

```bash
cd backend
npm run test:unit         # règles horaires, fuseau, QR, import, mots de passe, périodes (sans base)
npm run test:db           # contraintes PostgreSQL
npm run test:integration  # API réelle + base de test (remise à zéro automatique)
npm test                  # tout
```

Les plages horaires utilisées dans les tests sont des données de test. Elles ne définissent pas les horaires de l'UPL. Les horaires réels doivent être saisis et validés dans l'application.

## Contrôles à effectuer avant une publication

| Vérification | Résultat |
| --- | --- |
| Tests unitaires, SQL et d'intégration | À exécuter localement ou via GitHub Actions avant une mise en production |
| Migrations de base de données | À appliquer et valider sur un environnement de préproduction |
| Build et interface | À vérifier sur le commit exact destiné au déploiement |

Rapport détaillé des travaux (audit, corrections, vérifications) : [docs/RAPPORT-TRAVAUX.md](docs/RAPPORT-TRAVAUX.md).

Le workflow GitHub Actions est configuré pour appliquer les migrations sur PostgreSQL 16, exécuter les tests SQL et d'intégration sur une base isolée et construire les images. Vérifiez le résultat du workflow du commit à publier. Prisma 7 charge sa configuration depuis `backend/prisma.config.ts`.


## Interface

Le système de design et ses couleurs sont décrits en tête de `frontend/src/index.css` :
`upl-blue` (marque, actions), `slate` (texte, bordures, fonds), `upl-gold` (accent, attention),
`danger` (refus, erreurs) et `success` (accepté, présent).

- Composants partagés : `frontend/src/components/ui.tsx` (boutons, champs, cartes, tableaux, badges, alertes, modales).
- Mises en page : `AppLayout` (application connectée), `AuthLayout` (connexion), `PublicHeader` (pages publiques).
- Les pages sont chargées à la demande ; seuls l'accueil et la connexion sont dans le lot initial.

## Décisions en attente de l'UPL

Le code applique une hypothèse configurable, sans rien inventer :

| Question | Hypothèse actuelle |
| --- | --- |
| Liste des facultés, départements, promotions ; format du matricule | Saisie par l'administrateur, aucune valeur préremplie |
| Jours et plages horaires | A saisir et valider avec l'administration avant le premier pointage |
| Minute de fermeture | La minute de fermeture configuree est incluse |
| Perimetre du responsable de stage | A confirmer avec l'UPL |
| Seuil de retard | A configurer selon la regle officielle |
| Charte graphique, logo | Logo officiel UPL ; bleu, or et rouge du logo, neutres gris (voir « Interface » ci-dessous) |

## Arborescence

```text
upl-stagetrack/
├── docker-compose.yml            PostgreSQL de développement et de test
├── docker-compose.prod.yml       Production : postgres + api + web (Nginx HTTPS)
├── deploy/                       Dockerfiles, nginx.conf, sauvegarde, modèle d'environnement
├── docs/                         Déploiement, guide d'utilisation
├── backend/
│   ├── prisma/                   schema.prisma, 4 migrations
│   ├── scripts/                  remise à zéro de la base de test, tests SQL
│   ├── src/
│   │   ├── auth/                 connexion, rafraîchissement, mot de passe
│   │   ├── users/                comptes
│   │   ├── students/             étudiants, stages, photos, import
│   │   ├── reference/            facultés, départements, promotions
│   │   ├── qr/                   jetons, PNG, carte PDF
│   │   ├── attendance/           horaires, sessions, scan, clôture, corrections, espace étudiant
│   │   ├── reports/              tableau de bord, rapports, exports, journaux
│   │   ├── domain/               règles pures (horaires, fuseau, QR, import, périodes)
│   │   ├── common/               garde, audit, horloge, erreurs, sécurité
│   │   └── cli/seed.ts           données initiales
│   └── test/                     unit/, sql/, integration/
└── frontend/src/
    ├── lib/                      client API, session, formats, types
    ├── components/               mise en page, composants
    └── features/                 auth, attendance, students, reports, admin, student, items, labs, machines, supervision, system
```
