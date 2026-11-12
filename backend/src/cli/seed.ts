/**
 * Données initiales indispensables au démarrage :
 *  - les rôles pris en charge par l'application ;
 *  - un compte administrateur, mot de passe à changer à la première connexion.
 *
 * Aucune faculté, aucun étudiant, aucun pointage n'est créé : ces données viennent
 * de l'administration de l'UPL (import ou saisie), jamais d'un jeu fictif.
 *
 * Le script est rejouable : il ne crée que ce qui manque.
 * Exécution : npm run prisma:seed (développement) ou node dist/cli/seed.js (production)
 */
import { RoleCode } from '../generated/prisma/client';
import { createPrismaClient } from '../prisma/create-prisma-client';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../common/security/password-hashing';

const prisma = createPrismaClient();

const ROLES: { code: RoleCode; label: string }[] = [
  { code: 'ADMIN', label: 'Administrateur' },
  { code: 'SUPERVISOR', label: 'Responsable de stage' },
  { code: 'SCAN_AGENT', label: 'Agent de pointage' },
  { code: 'STUDENT', label: 'Étudiant' },
  { code: 'SUPER_ADMIN', label: 'Super Administrateur' },
  { code: 'FACULTY_ADMIN', label: 'Administrateur de Faculté' },
  { code: 'INTERNSHIP_MANAGER', label: 'Gestionnaire des Stages' },
  { code: 'IT_TECHNICIAN', label: 'Technicien Informatique' },
  { code: 'INTERN', label: 'Stagiaire' },
];

const COMPONENT_TYPES = [
  { code: 'CPU', name: 'Unité centrale', sortOrder: 1 },
  { code: 'SCREEN', name: 'Écran', sortOrder: 2 },
  { code: 'KEYBOARD', name: 'Clavier', sortOrder: 3 },
  { code: 'MOUSE', name: 'Souris', sortOrder: 4 },
  { code: 'POWER_CABLE', name: "Câble d'alimentation", sortOrder: 5 },
  { code: 'VIDEO_CABLE', name: 'Câble vidéo', sortOrder: 6 },
  { code: 'UPS', name: 'Onduleur', sortOrder: 7 },
  { code: 'NETWORK', name: 'Connexion réseau', sortOrder: 8 },
  { code: 'SPEAKERS', name: 'Haut-parleurs', sortOrder: 9 },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('CHANGER')) {
    throw new Error(`Variable d'environnement ${name} absente ou non modifiée (voir .env.example)`);
  }
  return value;
}

async function main(): Promise<void> {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { code: role.code }, update: { label: role.label }, create: role });
  }
  console.log(`Rôles : ${ROLES.length} présents.`);

  const username = requireEnv('SEED_ADMIN_USERNAME');
  const existingAdmin = await prisma.user.findUnique({ where: { username } });
  if (existingAdmin) {
    console.log(`Compte « ${username} » déjà présent, inchangé.`);
  } else {
    const password = requireEnv('SEED_ADMIN_PASSWORD');
    if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD doit contenir au moins 12 caractères');
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
    const admin = await prisma.user.create({
      data: {
        username,
        fullName: process.env.SEED_ADMIN_FULLNAME ?? 'Administrateur',
        passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
        roleId: adminRole.id,
        mustChangePassword: true,
      },
    });
    await prisma.auditLog.create({
      data: { action: 'USER_CREATED_BY_SEED', entityType: 'User', entityId: admin.id, after: { username, role: 'ADMIN' } },
    });
    console.log(`Compte administrateur « ${username} » créé (changement de mot de passe exigé à la première connexion).`);
  }

  for (const c of COMPONENT_TYPES) {
    await prisma.componentType.upsert({
      where: { code: c.code },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { code: c.code, name: c.name, sortOrder: c.sortOrder },
    });
  }
  console.log(`Types de composants : ${COMPONENT_TYPES.length} initialisés.`);

  const existingSetting = await prisma.institutionSetting.findFirst();
  if (!existingSetting) {
    await prisma.institutionSetting.create({
      data: {
        institutionName: 'Université Protestante de Lubumbashi',
        facultyName: '',
        acronym: 'UPL',
        logoUrl: '/brand/upl-logo.png',
        portalSubtitle: 'Portail numérique unifié des services universitaires',
      },
    });
    console.log('Paramètres institutionnels initialisés.');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
