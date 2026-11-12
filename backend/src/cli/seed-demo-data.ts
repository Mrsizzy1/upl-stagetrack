import { MachineStatus, ComponentState, InterventionPriority, InterventionStatus, ItemType, ItemCategory, ItemStatus, StudentStatus } from '../generated/prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { generateToken, hashToken, sealToken } from '../domain/qr/qr-token';
import { createPrismaClient } from '../prisma/create-prisma-client';

const prisma = createPrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Ce jeu de données fictives est réservé au développement. Définissez ALLOW_DEMO_SEED=true hors production pour continuer.');
  }
  console.log('--- Début du peuplement des données fictives de démonstration ---');

  const qrKeyBase64 = process.env.QR_TOKEN_ENCRYPTION_KEY;
  if (!qrKeyBase64) throw new Error('QR_TOKEN_ENCRYPTION_KEY manquant dans .env');
  const qrKey = Buffer.from(qrKeyBase64, 'base64');

  // 1. FACULTÉS ET DÉPARTEMENTS
  const fsi = await prisma.faculty.upsert({
    where: { code: 'FSI' },
    update: { name: 'Faculté des Sciences Informatiques' },
    create: { code: 'FSI', name: 'Faculté des Sciences Informatiques' },
  });

  const fseg = await prisma.faculty.upsert({
    where: { code: 'FSEG' },
    update: { name: 'Faculté des Sciences Économiques et de Gestion' },
    create: { code: 'FSEG', name: 'Faculté des Sciences Économiques et de Gestion' },
  });

  const deptGL = await prisma.department.upsert({
    where: { facultyId_code: { facultyId: fsi.id, code: 'GL' } },
    update: { name: 'Génie Logiciel & Développement' },
    create: { facultyId: fsi.id, code: 'GL', name: 'Génie Logiciel & Développement' },
  });

  const deptRT = await prisma.department.upsert({
    where: { facultyId_code: { facultyId: fsi.id, code: 'RT' } },
    update: { name: 'Réseaux & Télécommunications' },
    create: { facultyId: fsi.id, code: 'RT', name: 'Réseaux & Télécommunications' },
  });

  const deptSI = await prisma.department.upsert({
    where: { facultyId_code: { facultyId: fsi.id, code: 'SI' } },
    update: { name: 'Systèmes d\'Information & Données' },
    create: { facultyId: fsi.id, code: 'SI', name: 'Systèmes d\'Information & Données' },
  });

  console.log('✓ Facultés et Départements UPL initialisés');

  // 2. PROMOTIONS LMD
  const promoDefs = [
    { code: 'L1', label: 'Licence 1 (Bac+1)', sortOrder: 1 },
    { code: 'L2', label: 'Licence 2 (Bac+2)', sortOrder: 2 },
    { code: 'L3', label: 'Licence 3 (Bac+3)', sortOrder: 3 },
    { code: 'M1', label: 'Master 1 (Bac+4)', sortOrder: 4 },
    { code: 'M2', label: 'Master 2 (Bac+5)', sortOrder: 5 },
  ];

  const promos: Record<string, string> = {};
  for (const p of promoDefs) {
    const promo = await prisma.promotion.upsert({
      where: { code: p.code },
      update: { label: p.label, sortOrder: p.sortOrder },
      create: p,
    });
    promos[p.code] = promo.id;
  }
  console.log('✓ Promotions LMD créées');

  // 3. COMPTES UTILISATEURS DU PERSONNEL
  // 4. PARC INFORMATIQUE (LABORATOIRES ET MACHINES)
  const labGL = await prisma.laboratory.upsert({
    where: { code: 'LAB-GL' },
    update: {
      name: 'Laboratoire Génie Logiciel (Salle Turing)',
      building: 'Bâtiment Facultaire FSI',
      location: 'Rez-de-chaussée, Salle 02',
      description: 'Salle principale de travaux pratiques en développement logiciel, programmation et bases de données.',
    },
    create: {
      code: 'LAB-GL',
      name: 'Laboratoire Génie Logiciel (Salle Turing)',
      building: 'Bâtiment Facultaire FSI',
      location: 'Rez-de-chaussée, Salle 02',
      description: 'Salle principale de travaux pratiques en développement logiciel, programmation et bases de données.',
    },
  });

  const rowA = await prisma.laboratoryRow.upsert({
    where: { laboratoryId_code: { laboratoryId: labGL.id, code: 'ROW-A' } },
    update: { name: 'Rangée Nord (A)', sortOrder: 1 },
    create: { laboratoryId: labGL.id, code: 'ROW-A', name: 'Rangée Nord (A)', sortOrder: 1 },
  });

  const rowB = await prisma.laboratoryRow.upsert({
    where: { laboratoryId_code: { laboratoryId: labGL.id, code: 'ROW-B' } },
    update: { name: 'Rangée Sud (B)', sortOrder: 2 },
    create: { laboratoryId: labGL.id, code: 'ROW-B', name: 'Rangée Sud (B)', sortOrder: 2 },
  });

  const componentTypes = await prisma.componentType.findMany();

  // Machines Rangée A (Postes 1 à 6)
  for (let i = 1; i <= 6; i++) {
    const code = `L1-A0${i}`;
    const name = `Poste A${i}`;
    const status = i === 4 ? MachineStatus.DEFECTIVE : MachineStatus.FUNCTIONAL;

    let machine = await prisma.machine.findUnique({ where: { code } });
    if (!machine) {
      machine = await prisma.machine.create({
        data: {
          code,
          name,
          rowId: rowA.id,
          positionInRow: i,
          laboratoryId: labGL.id,
          generalStatus: status,
          brand: 'HP EliteDesk 800 G5',
          model: 'Core i7 9700, 16GB RAM, 512GB SSD',
          serialNumber: `HP-L1A0${i}-UPL26`,
        },
      });

      // Composants par défaut
      for (const ct of componentTypes) {
        const cState = (i === 4 && (ct.name.toLowerCase().includes('écran') || ct.code.includes('SCREEN')))
          ? ComponentState.DEFECTIVE
          : ComponentState.FUNCTIONAL;

        await prisma.machineComponent.create({
          data: {
            machineId: machine.id,
            componentTypeId: ct.id,
            state: cState,
          },
        });
      }
    }
  }

  // Machines Rangée B (Postes 1 à 6)
  for (let i = 1; i <= 6; i++) {
    const code = `L1-B0${i}`;
    const name = `Poste B${i}`;
    const status = i === 3 ? MachineStatus.MAINTENANCE : MachineStatus.FUNCTIONAL;

    let machine = await prisma.machine.findUnique({ where: { code } });
    if (!machine) {
      machine = await prisma.machine.create({
        data: {
          code,
          name,
          rowId: rowB.id,
          positionInRow: i,
          laboratoryId: labGL.id,
          generalStatus: status,
          brand: 'Dell OptiPlex 7070',
          model: 'Core i5 9500, 16GB RAM, 256GB SSD + 1TB HDD',
          serialNumber: `DELL-L1B0${i}-UPL26`,
        },
      });

      for (const ct of componentTypes) {
        await prisma.machineComponent.create({
          data: {
            machineId: machine.id,
            componentTypeId: ct.id,
            state: ComponentState.FUNCTIONAL,
          },
        });
      }
    }
  }

  // Incident fictif ouvert sur la machine L1-A04
  const defectiveMachine = await prisma.machine.findUnique({ where: { code: 'L1-A04' } });
  if (defectiveMachine) {
    const existingInterv = await prisma.technicalIntervention.findFirst({ where: { machineId: defectiveMachine.id } });
    if (!existingInterv) {
      await prisma.technicalIntervention.create({
        data: {
          machineId: defectiveMachine.id,
          title: 'Écran clignote et s\'éteint après démarrage',
          description: 'L\'affichage se coupe subitement au bout de quelques minutes de session TP. Câble HDMI ou bloc alimentation écran à remplacer.',
          priority: InterventionPriority.HIGH,
          status: InterventionStatus.IN_PROGRESS,
        },
      });
    }
  }

  console.log('✓ Laboratoire Génie Logiciel (12 machines, rangées, composants et intervention) initialisé');

  // 5. ÉTUDIANTS FICTIFS POUR LA DÉMONSTRATION
  const studentsData = [
    {
      matricule: '22-FSI-0142',
      lastName: 'KABANGE',
      middleName: 'NUMBI',
      firstName: 'Patrick',
      deptId: deptGL.id,
      promoId: promos['L3'],
      email: 'p.kabange@student.upl-univ.ac',
      phone: '+243 997 123 456',
      hostService: 'Direction des Systèmes d\'Information — Trust Merchant Bank (TMB)',
    },
    {
      matricule: '22-FSI-0155',
      lastName: 'ILUNGA',
      middleName: 'MWAMBA',
      firstName: 'Grace',
      deptId: deptGL.id,
      promoId: promos['L3'],
      email: 'g.ilunga@student.upl-univ.ac',
      phone: '+243 812 345 678',
      hostService: 'Département Automatisation & IT — Tenke Fungurume Mining (TFM)',
    },
    {
      matricule: '22-FSI-0178',
      lastName: 'TSHILOMBO',
      middleName: 'KAZADI',
      firstName: 'Dan',
      deptId: deptRT.id,
      promoId: promos['L3'],
      email: 'd.tshilombo@student.upl-univ.ac',
      phone: '+243 971 234 567',
      hostService: 'Division Réseaux & Transmission — Airtel RDC Direction Katanga',
    },
    {
      matricule: '22-FSI-0201',
      lastName: 'NGOY',
      middleName: 'MUTOMBO',
      firstName: 'Sarah',
      deptId: deptGL.id,
      promoId: promos['L3'],
      email: 's.ngoy@student.upl-univ.ac',
      phone: '+243 823 456 789',
      hostService: 'Service Informatique & Données — Kamoto Copper Company (KCC)',
    },
    {
      matricule: '22-FSI-0214',
      lastName: 'KASONGO',
      middleName: 'BANZA',
      firstName: 'Eric',
      deptId: deptRT.id,
      promoId: promos['L3'],
      email: 'e.kasongo@student.upl-univ.ac',
      phone: '+243 998 765 432',
      hostService: 'Direction Régionale Katanga — SNEL',
    },
    {
      matricule: '22-FSI-0230',
      lastName: 'MBAYO',
      middleName: 'KISULA',
      firstName: 'Christian',
      deptId: deptGL.id,
      promoId: promos['L3'],
      email: 'c.mbayo@student.upl-univ.ac',
      phone: '+243 814 567 890',
      hostService: 'Division Informatique Provinciale — Direction Générale des Impôts (DGI-HK)',
    },
  ];

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
  for (const st of studentsData) {
    let student = await prisma.student.findUnique({ where: { matricule: st.matricule } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          matricule: st.matricule,
          lastName: st.lastName,
          middleName: st.middleName,
          firstName: st.firstName,
          facultyId: fsi.id,
          departmentId: st.deptId,
          promotionId: st.promoId,
          email: st.email,
          phone: st.phone,
          enrolledAt: new Date('2025-10-15'),
          status: StudentStatus.ACTIVE,
        },
      });

      // Stage officiel actif pour l'année académique en cours
      await prisma.internship.create({
        data: {
          studentId: student.id,
          startDate: new Date('2026-10-01'),
          endDate: new Date('2027-01-31'),
          hostService: st.hostService,
        },
      });

      // Jeton QR officiel chiffré AES-256
      const rawToken = generateToken();
      await prisma.qRCodeCredential.create({
        data: {
          studentId: student.id,
          tokenHash: hashToken(rawToken),
          tokenSealed: sealToken(rawToken, qrKey),
          issuedById: adminUser.id,
        },
      });
    }
  }

  console.log('✓ 6 étudiants stagiaires créés avec stages, matricules UPL et jetons QR sécurisés');

  // 6. OBJETS PERDUS & TROUVÉS RÉELS DU CAMPUS
  const existingItems = await prisma.itemDeclaration.count();
  if (existingItems === 0) {
    await prisma.itemDeclaration.create({
      data: {
        type: ItemType.FOUND,
        category: ItemCategory.ELECTRONICS,
        title: 'Clé USB Kingston DataTraveler 64GB',
        description: 'Clé USB métallique grise trouvée sur la table 4 du Laboratoire Génie Logiciel (Salle Turing). Contient des dossiers de TP.',
        location: 'Laboratoire Génie Logiciel (FSI)',
        eventDate: new Date('2026-11-09'),
        status: ItemStatus.PUBLISHED,
        contactName: 'Service de Garde UPL / Bureau FSI',
        contactPhone: '+243 810 000 001',
        approvedById: adminUser.id,
      },
    });

    await prisma.itemDeclaration.create({
      data: {
        type: ItemType.FOUND,
        category: ItemCategory.ELECTRONICS,
        title: 'Calculatrice scientifique Casio fx-991ES Plus',
        description: 'Calculatrice avec son étui coulissant trouvée sur une banquette de l\'Amphithéâtre Central après le cours de Mathématiques appliquées.',
        location: 'Amphithéâtre Central',
        eventDate: new Date('2026-11-08'),
        status: ItemStatus.PUBLISHED,
        contactName: 'Secrétariat Facultaire',
        contactPhone: '+243 810 000 002',
        approvedById: adminUser.id,
      },
    });

    await prisma.itemDeclaration.create({
      data: {
        type: ItemType.LOST,
        category: ItemCategory.BAGS,
        title: 'Porte-documents noir avec badge étudiant',
        description: 'Pochette noire format A4 contenant des conventions de stage et un carnet de notes UPL.',
        location: 'Couloir Bâtiment Administratif',
        eventDate: new Date('2026-11-10'),
        status: ItemStatus.PENDING,
        contactName: 'Étudiant FSI',
        contactPhone: '+243 997 123 456',
      },
    });

    console.log('✓ Objets perdus et trouvés fictifs enregistrés et publiés');
  }

  // Mise à jour des dates de stage pour couvrir l'année académique active
  await prisma.internship.updateMany({
    data: {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-01-31'),
    },
  });

  // Session de présence et pointages fictifs du jour pour démonstration opérationnelle
  const scheduleMorning = await prisma.attendanceSchedule.findFirst({ where: { sessionType: 'MORNING' } });
  if (scheduleMorning) {
    const todayDate = new Date('2026-11-10T00:00:00Z');
    let session = await prisma.attendanceSession.findFirst({
      where: { date: todayDate, sessionType: 'MORNING' },
    });

    if (!session) {
      session = await prisma.attendanceSession.create({
        data: {
          date: todayDate,
          sessionType: 'MORNING',
          scheduleId: scheduleMorning.id,
          opensAt: new Date('2026-11-10T05:45:00Z'), // 07h45 à Lubumbashi (UTC+2)
          closesAt: new Date('2026-11-10T06:46:00Z'), // 08h46 à Lubumbashi
          lateFrom: new Date('2026-11-10T06:01:00Z'), // 08h01 = retard
          state: 'OPEN',
        },
      });
    }

    const allStudents = await prisma.student.findMany({ take: 6 });
    // Enregistrement des présences du matin
    if (allStudents.length >= 4) {
      const attendancesCount = await prisma.attendance.count({ where: { sessionId: session.id } });
      if (attendancesCount === 0) {
        // Étudiant 0 : Présent à 07h50
        await prisma.attendance.create({
          data: {
            studentId: allStudents[0].id,
            sessionId: session.id,
            date: todayDate,
            sessionType: 'MORNING',
            status: 'PRESENT',
            method: 'QR',
            recordedAt: new Date('2026-11-10T05:50:12Z'),
          },
        });

        // Étudiant 1 : Présent à 07h58
        await prisma.attendance.create({
          data: {
            studentId: allStudents[1].id,
            sessionId: session.id,
            date: todayDate,
            sessionType: 'MORNING',
            status: 'PRESENT',
            method: 'QR',
            recordedAt: new Date('2026-11-10T05:58:44Z'),
          },
        });

        // Étudiant 2 : En retard à 08h22
        await prisma.attendance.create({
          data: {
            studentId: allStudents[2].id,
            sessionId: session.id,
            date: todayDate,
            sessionType: 'MORNING',
            status: 'LATE',
            method: 'QR',
            recordedAt: new Date('2026-11-10T06:22:05Z'),
          },
        });

        // Étudiant 3 : Présent par validation manuelle à 08h05
        await prisma.attendance.create({
          data: {
            studentId: allStudents[3].id,
            sessionId: session.id,
            date: todayDate,
            sessionType: 'MORNING',
            status: 'PRESENT',
            method: 'MANUAL',
            recordedAt: new Date('2026-11-10T06:05:18Z'),
            manualReason: 'Badge temporairement laissé au domicile, identité vérifiée sur carte étudiant',
          },
        });
      }
    }
  }

  console.log('✓ Session du jour et pointages d\'émargement créés');
  console.log('--- Peuplement des données fictives achevé avec succès ---');
}

main()
  .catch((e) => {
    console.error('Erreur lors du peuplement :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
