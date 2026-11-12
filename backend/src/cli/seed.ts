/**
 * Données initiales indispensables au démarrage :
 *  - les rôles pris en charge par l'application ;
 *  - les horaires officiels (07h45–08h45, 17h00–17h30), en vigueur à partir d'aujourd'hui ;
 *  - un compte administrateur, mot de passe à changer à la première connexion.
 *
 * Aucune faculté, aucun étudiant, aucun pointage n'est créé : ces données viennent
 * de l'administration de l'UPL (import ou saisie), jamais d'un jeu fictif.
 *
 * Le script est rejouable : il ne crée que ce qui manque.
 * Exécution : npm run prisma:seed (développement) ou node dist/cli/seed.js (production)
 */
import { PrismaClient, RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { INITIAL_WINDOWS, validateWindows } from '../domain/attendance/schedule-rules';
import { assertValidTimeZone, toLocal } from '../domain/time/zoned-time';
import { ARGON2_OPTIONS } from '../common/security/password-hashing';

const prisma = new PrismaClient();

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
  const timeZone = process.env.APP_TIMEZONE ?? 'Africa/Lubumbashi';
  assertValidTimeZone(timeZone);

  for (const role of ROLES) {
    await prisma.role.upsert({ where: { code: role.code }, update: { label: role.label }, create: role });
  }
  console.log(`Rôles : ${ROLES.length} présents.`);

  const errors = validateWindows(INITIAL_WINDOWS);
  if (errors.length > 0) throw new Error(`Horaires initiaux invalides : ${errors.join(' ; ')}`);

  const today = toLocal(new Date(), timeZone).date;
  for (const w of INITIAL_WINDOWS) {
    const existing = await prisma.attendanceSchedule.findFirst({ where: { sessionType: w.sessionType } });
    if (existing) {
      console.log(`Horaire ${w.sessionType} déjà défini, inchangé.`);
      continue;
    }
    await prisma.attendanceSchedule.create({
      data: {
        sessionType: w.sessionType,
        opensAtMinute: w.opensAtMinute,
        closesAtMinute: w.closesAtMinute,
        lateAfterMinute: w.lateAfterMinute,
        activeWeekdays: [...w.activeWeekdays],
        effectiveFrom: new Date(`${today}T00:00:00Z`),
      },
    });
    console.log(`Horaire ${w.sessionType} créé, en vigueur à partir du ${today}.`);
  }

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
        facultyName: 'Faculté des Sciences Informatiques',
        acronym: 'UPL',
        logoUrl: '/brand/upl-logo.png',
        contactEmail: 'contact@upl-univ.ac',
        contactPhone: '+243 000 000 000',
        address: 'Lubumbashi, RDC',
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
