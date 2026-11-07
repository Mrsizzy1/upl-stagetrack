# Déploiement et exploitation — UPL StageTrack

Cible : un serveur Linux (Ubuntu 22.04/24.04 ou Debian 12) du réseau de l'UPL, avec Docker.
L'hébergement exact (serveur interne ou externe) reste à confirmer par l'UPL (question Q5).

## 1. Préparer le serveur

```bash
# Docker et Docker Compose
curl -fsSL https://get.docker.com | sh

# Heure exacte : indispensable, c'est l'horloge du serveur qui décide des pointages
sudo apt-get install -y chrony
sudo systemctl enable --now chrony
chronyc tracking            # « System time » doit être à quelques millisecondes
timedatectl                 # « System clock synchronized: yes »
```

Le fuseau du système n'a pas d'importance : l'application stocke en UTC et calcule en
Africa/Lubumbashi. Seule la synchronisation NTP compte.

## 2. Installer l'application

```bash
sudo mkdir -p /opt/upl-stagetrack && sudo chown "$USER" /opt/upl-stagetrack
cd /opt/upl-stagetrack
# copier ici le contenu du dépôt (git clone ou archive), puis :
npm install                 # génère package-lock.json, utilisé par les images Docker
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production # remplacer chaque CHANGER
```

Générer les secrets :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # QR_TOKEN_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # POSTGRES_PASSWORD
```

Conserver une copie de `deploy/.env.production` hors du serveur, en lieu sûr.

## 3. Certificat HTTPS

La caméra des navigateurs ne fonctionne qu'en HTTPS. Placer dans `deploy/certs/` :
`fullchain.pem` et `privkey.pem`.

- **Nom de domaine public** : certificat Let's Encrypt (certbot), copié dans `deploy/certs/`.
- **Réseau interne uniquement** : certificat émis par l'autorité interne de l'UPL, ou
  certificat auto-signé dont l'autorité est installée sur les tablettes et ordinateurs des agents :

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout deploy/certs/privkey.pem -out deploy/certs/fullchain.pem \
  -subj "/CN=stagetrack.upl.local" -addext "subjectAltName=DNS:stagetrack.upl.local,IP:192.168.1.10"
```

(adapter le nom et l'adresse IP du serveur).

## 4. Démarrer

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production up -d --build
docker compose -f docker-compose.prod.yml logs -f api      # « API démarrée … »
```

Les migrations sont appliquées automatiquement au démarrage de l'API.

Première fois seulement — rôles, horaires officiels et compte administrateur :

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production exec api node dist/cli/seed.js
```

Ouvrir `https://<adresse>/`, se connecter avec `SEED_ADMIN_USERNAME`, changer le mot de passe,
puis retirer `SEED_ADMIN_PASSWORD` de `deploy/.env.production`.

## 5. Mise en service

1. **Référentiel** : saisir les facultés, départements et promotions officiels (codes courts).
2. **Comptes** : créer les responsables de stage et les agents de pointage.
3. **Étudiants** : import CSV/Excel (modèle téléchargeable) ou saisie ; vérifier les périodes de stage.
4. **Cartes** : imprimer les cartes QR depuis chaque fiche étudiant.
5. **Horaires** : vérifier 07h45–08h45 et 17h00–17h30, les jours actifs, les jours non travaillés.
6. **Essai** : un scan de test par un agent, sur tablette et sur smartphone.

## 6. Sauvegardes

```bash
sudo crontab -e
# chaque soir à 22h15 (heure du serveur)
15 22 * * * /opt/upl-stagetrack/deploy/backup.sh /srv/sauvegardes/stagetrack >> /var/log/stagetrack-backup.log 2>&1
```

Copier régulièrement `/srv/sauvegardes/stagetrack` hors du serveur. Restaurer une sauvegarde :

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U stagetrack -d stagetrack --clean --if-exists --no-owner < stagetrack-AAAAMMJJTHHMMSSZ.dump
```

Tester une restauration au moins une fois avant la mise en service.

## 7. Mises à jour

```bash
cd /opt/upl-stagetrack
./deploy/backup.sh /srv/sauvegardes/stagetrack     # toujours avant une mise à jour
# remplacer le code par la nouvelle version, puis :
npm install
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

## 8. Surveillance

- `https://<adresse>/api/health` : état de l'API, de la base, heure du serveur.
- `docker compose -f docker-compose.prod.yml logs --since 1h api` : journaux techniques.
- Écran « Journal d'audit » : actions et tentatives de scan.
- Après chaque fermeture de session, la clôture écrit `SESSION_CLOSED` dans le journal d'audit.
  Si le serveur était arrêté, elle rattrape automatiquement les 7 derniers jours au redémarrage.

## 9. Sécurité — points de contrôle

| Point | Où |
| --- | --- |
| Base non exposée sur le réseau | `docker-compose.prod.yml` (aucun port publié) |
| HTTPS seul, en-têtes de sécurité, CSP | `deploy/nginx.conf` |
| Swagger désactivé en production | `SWAGGER_ENABLED=false` |
| Blocage après 5 tentatives par adresse, verrouillage du compte après 20 échecs (15 min) | `backend/src/auth/auth.service.ts`, `login-throttle.ts` |
| Journaux non modifiables | déclencheurs PostgreSQL (migration `contraintes_metier`) |
| Photos hors du dossier web, servies après contrôle du rôle | `backend/src/students/photo-storage.service.ts` |
