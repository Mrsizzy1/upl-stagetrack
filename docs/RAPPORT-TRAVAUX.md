# État technique d’UPL StageTrack

Ce document décrit le comportement présent dans le dépôt. Il ne constitue pas un procès-verbal de tests ni une certification de production.

## Données de référence

Le script `backend/src/cli/seed.ts` initialise les rôles, les catégories génériques de composants et un compte administrateur créé à partir des variables d’environnement. Il ne crée pas d’étudiants, de présences, d’horaires, de laboratoires, de rangées ni de machines.

Les horaires, jours de pointage, facultés, coordonnées, salles, rangées, machines et dossiers étudiants doivent être saisis ou importés à partir des informations validées par l’UPL. Les coordonnées de contact ne sont pas préremplies.

Le jeu de données de démonstration a été retiré. Les exemples d’identifiants visibles dans les formulaires ne sont que des aides à la saisie; ils ne sont pas enregistrés comme données réelles.

## Suppression des machines

Les comptes `ADMIN` et `SUPER_ADMIN` peuvent supprimer toutes les machines depuis la page **Salles informatiques & Ordinateurs**. L’interface demande de saisir `SUPPRIMER TOUTES LES MACHINES` avant d’envoyer l’opération.

La suppression enlève les machines et leurs composants de l’inventaire. Les contrôles et interventions sont conservés, avec le code de la machine enregistré dans leur historique. L’action écrit également une entrée dans le journal d’audit.

## Vérifier une version avant publication

Exécuter les contrôles sur le commit exact à publier :

```bash
npm ci
npm run prisma:generate -w backend
npm run prisma:validate -w backend
npm run build
npm run test
```

Les tests qui remettent une base à zéro doivent utiliser exclusivement `DATABASE_URL_TEST`. Vérifier également le résultat du workflow GitHub Actions et tester l’application sur une base de préproduction avant de déployer.

## Démarrage local

```bash
npm ci
cp backend/.env.example backend/.env
# Renseigner les valeurs locales et secrets indiqués dans le fichier.
npm run db:up
npm run prisma:generate -w backend
npm run prisma:deploy -w backend
npm run prisma:seed -w backend
npm run dev:api
npm run dev:web
```

Les données de développement ne doivent pas être copiées vers la production sans validation de leur origine.
