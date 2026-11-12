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
| Horaires | Versionnés, seuil de retard configurable (aucun par défaut), jours actifs, jours non travaillés |
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
npm install
npm run db:up                         # PostgreSQL + base de test stagetrack_test

cp backend/.env.example backend/.env  # puis remplacer chaque CHANGER (commandes dans le fichier)

cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed                    # rôles, horaires officiels, compte administrateur
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

`test:integration` couvre les 12 cas obligatoires du cahier des charges (07h44 refusé, 07h45 accepté,
08h45 accepté, après 08h45 refusé, 16h59 refusé, 17h00 et 17h30 acceptés, après 17h30 refusé,
double scan, QR révoqué, étudiant suspendu, compte étudiant refusé), 10 scans simultanés,
la clôture, les corrections et les exports.

## Ce qui a été vérifié, et où

| Vérification | Résultat |
| --- | --- |
| 74 tests unitaires (`test/unit`) | Exécutés : tous réussis |
| Migrations sur PostgreSQL 16 | Appliquées sans erreur |
| 17 contrôles de contraintes SQL (`test/sql`) | Exécutés : tous réussis |
| 29 tests d'intégration (API réelle, base de test) | Exécutés : tous réussis |
| `npm install`, `prisma validate`, compilation TypeScript et de production | Réussis |
| Interface dans le navigateur, mobile et ordinateur | Contrôlée (voir [docs/RAPPORT-TRAVAUX.md](docs/RAPPORT-TRAVAUX.md)) |

Rapport détaillé des travaux (audit, corrections, vérifications) : [docs/RAPPORT-TRAVAUX.md](docs/RAPPORT-TRAVAUX.md).

Commande pour confirmer que les migrations écrites à la main correspondent au schéma :

```bash
cd backend
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://stagetrack:stagetrack_dev@localhost:5432/stagetrack_shadow"
# Attendu : « No difference detected » (créer la base stagetrack_shadow au préalable)
```

## Décisions en attente de l'UPL

Le code applique une hypothèse configurable, sans rien inventer :

| Question | Hypothèse actuelle |
| --- | --- |
| Liste des facultés, départements, promotions ; format du matricule | Saisie par l'administrateur, aucune valeur préremplie |
| Jours de pointage, jours fériés | Lundi à vendredi ; jours non travaillés déclarés à l'écran Horaires |
| Minute de fermeture | Incluse (08h45:59 accepté) |
| Périmètre du responsable de stage | Tous les stagiaires |
| Seuil de retard | Aucun |
| Charte graphique, logo | Bleu marine, blanc, vert ; pas de logo |

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
