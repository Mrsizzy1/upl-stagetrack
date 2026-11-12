# Rapport des travaux — UPL StageTrack

Novembre 2026. Ce rapport résume la mise en route locale, l'audit fonctionnel, les corrections apportées
et les vérifications effectuées. Il ne contient aucun mot de passe ni secret : ceux-ci restent dans
`backend/.env`, exclu du dépôt.

## 1. Mise en route locale

| Élément | État |
| --- | --- |
| Dépendances (`npm install`) | Installées (monorepo `backend` + `frontend`) |
| Base de données | PostgreSQL 16 dédié, port 5434 (Docker absent de la machine de développement) |
| Migrations Prisma | 4 migrations appliquées sans erreur |
| Données initiales (`prisma db seed`) | 4 rôles, horaires officiels, compte administrateur à mot de passe provisoire |
| API | `http://localhost:3000/api` — documentation `http://localhost:3000/api/docs` |
| Interface | `http://localhost:5174` (le port 5173 était occupé sur la machine) |

Seule erreur bloquante au démarrage : une option de mise en page PDF refusée par TypeScript
(`valign: 'top'`, `backend/src/qr/qr.service.ts`). Retirée, le rendu est identique (valeur par défaut de pdfkit).

## 2. Audit fonctionnel

Méthode : lecture complète du backend, du frontend principal et de la configuration de déploiement,
exécution des tests existants, sondes dédiées sur une base séparée avec horloge simulée,
captures mobiles dans Chrome sans interface.

### Fonctionnel dès l'origine

- Autorisations : 35 routes × 6 profils testés, aucun accès indu ; refus par défaut.
- Horaires stricts : 07h44 refusé, 07h45 accepté, 08h45 accepté, après 08h45 refusé ; 16h59 refusé,
  17h00 et 17h30 acceptés, après 17h30 refusé. Heure du serveur uniquement.
- Doubles pointages : contrainte unique en base ; 10 scans simultanés du même QR → 1 pointage.
- QR Codes : jeton aléatoire de 256 bits sans donnée personnelle, empreinte SHA-256, copie chiffrée AES-256-GCM.
- Clôture automatique des sessions, rejouable sans doublon ; journaux en ajout seul ; exports Excel et PDF.

### Problèmes relevés puis corrigés

| Réf. | Problème | Correction |
| --- | --- | --- |
| R1 | Verrouillage après 5 échecs contournable par des essais parallèles ; limite par adresse contournable par l'en-tête `X-Forwarded-For` | Tentatives réservées avant vérification du mot de passe ; en-tête de proxy pris en compte en production seulement |
| R2 | Un tiers pouvait bloquer le compte d'un agent 15 minutes | Blocage par couple compte + adresse après 5 essais ; verrou du compte après 20 échecs (attaque répartie) |
| R5 | Nginx : en-têtes de sécurité (CSP, HSTS…) annulés sur les pages | `expires` à la place de `add_header` dans les blocs `location` |
| B1 | Une correction ne mettait pas à jour les compteurs de la session clôturée | Compteurs recalculés dans la même transaction |
| B2 | Import CSV : une virgule dans un champ le tronquait ou décalait les colonnes | Séparateur unique détecté sur la ligne d'entêtes |
| B3 | Statistiques de l'historique calculées sur tout l'historique, pas sur la période | Calcul sur la période affichée |
| B4 | Deux onglets ouverts provoquaient la déconnexion générale | Rotation atomique du jeton, tolérance de 30 s ; la détection de vol est conservée |
| B5 | Pages Comptes et Horaires trop larges sur mobile | Conteneur des tableaux en position relative |
| B6 | Un stage commencé pouvait être supprimé en reportant d'abord sa date de début | Report du début d'un stage commencé refusé |

### Points non corrigés (décision ou infrastructure requise)

- R3 — En production, l'API utilise le superutilisateur PostgreSQL : il peut désactiver les déclencheurs
  qui protègent les journaux. À corriger en séparant le rôle propriétaire (migrations) du rôle applicatif.
- R4 — Le QR Code est fixe (une copie d'écran peut être prêtée) et la saisie manuelle n'est pas validée
  par l'administrateur. Choix métier à arbitrer par l'UPL.
- Un jeton d'accès reste valable jusqu'à 15 minutes après un changement de mot de passe (évolution du schéma nécessaire).
- `npm audit` signale des vulnérabilités dans les dépendances : mise à jour des versions à planifier.

## 3. Identité visuelle UPL

- Logo officiel téléchargé depuis `upl-univ.ac`, vérifié (PNG 1697 × 1676 px, 34 Ko), conservé sans
  modification dans un fichier unique : `frontend/public/brand/upl-logo.png`.
- Composant réutilisable `UPLLogo` (tailles prédéfinies ou sur mesure, texte alternatif, proportions conservées).
- Logo présent sur la page de connexion, la barre latérale, l'en-tête mobile, l'en-tête d'impression,
  les rapports PDF (en-tête répété sur chaque page, pagination), la carte de stagiaire PDF et l'export Excel.
- Palette tirée du logo : bleu `#0120A7`, or `#F9B233`, rouge `#FE0404` ; vert réservé à l'état « accepté ».
  Police Inter servie par l'application (aucun appel externe).

## 4. Pointage : diagnostic du « refus d'enregistrement »

- Les 9 tentatives refusées avaient toutes le résultat `NO_SESSION` : elles ont été faites un samedi,
  alors que les horaires prévoient le pointage du lundi au vendredi. QR, étudiant et stage étaient valides.
- Rejoué sur une copie de la base avec les vrais QR Codes et une horloge réglée sur un lundi :
  pointages acceptés aux heures prévues, refusés en dehors, doublon bloqué.
- Correction : chaque refus indique désormais la raison et la prochaine session, par exemple
  « Pas de pointage le samedi : les sessions ont lieu du lundi au vendredi. Prochaine session :
  lundi 9 novembre à 07h45 (matin, jusqu'à 08h45). » L'écran de pointage affiche les horaires en vigueur.
- Base de données injoignable : réponse 503 explicite au lieu d'une erreur interne.
- Aucune règle n'a été assouplie : horaires, anti-doublon et journalisation inchangés.

## 5. Page de connexion

Carte ramenée de 656 à environ 480 px de haut ; logo, champs et bouton réduits. Mesurée sur 9 écrans
(ordinateurs 1920 × 1080, 1366 × 768, 1280 × 720 ; tablettes 768 × 1024, 1024 × 600 ; téléphones 390 × 844,
375 × 667, 360 × 640 et 740 × 360 à l'horizontale) : aucun défilement, bouton toujours visible.

## 6. Gestion des étudiants

- **Suppression** (administrateur, motif obligatoire, journalisée) : autorisée pour un étudiant sans
  aucun pointage ; refusée sinon, l'historique officiel étant protégé (utiliser « Changer le statut »).
  Le journal des tentatives de scan est conservé.
- **Correction du matricule** : unicité contrôlée ; l'identifiant de connexion de l'étudiant suit ;
  pointages et QR Code inchangés.

## 7. Vérifications

| Vérification | Résultat |
| --- | --- |
| Tests unitaires (`npm run test:unit`) | 74 réussis |
| Contrôles de contraintes SQL (`test/sql`) | 17 réussis |
| Tests d'intégration (API réelle, base de test, horloge simulée) | 29 réussis |
| Compilation TypeScript backend et frontend | Sans erreur |
| Compilation de production du frontend | Réussie |
| Interface dans le navigateur (mobile et ordinateur) | 21 écrans contrôlés, aucune erreur JavaScript |
| PDF générés | Rendus en image et contrôlés visuellement |

## 8. Démarrage en développement

```bash
# PostgreSQL 16 local (instance dédiée, port 5434) ou : npm run db:up (Docker)
npm install
cp backend/.env.example backend/.env   # remplacer chaque valeur CHANGER
cd backend && npx prisma generate && npx prisma migrate deploy && npx prisma db seed && cd ..
npm run dev:api                        # http://localhost:3000/api
npm run dev:web                        # http://localhost:5173
```
