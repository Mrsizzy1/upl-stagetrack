import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComponentState, MachineStatus, Prisma } from '../generated/prisma/client';
import * as QRCode from 'qrcode';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth/auth.decorators';
import { UPL_INK } from '../common/pdf';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInterventionDto,
  CreateMachineDto,
  PerformControlDto,
  ReportIssueDto,
  UpdateInterventionDto,
  UpdateMachineDto,
} from './machines.dto';

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Création d'une machine avec initialisation de ses composants et attribution d'un QR code permanent. */
  async create(dto: CreateMachineDto, actor: AuthUser, ip?: string | null) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.machine.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException({ code: 'CODE_EXISTS', message: 'Une machine avec ce code existe déjà' });
    }

    const row = await this.prisma.laboratoryRow.findUnique({
      where: { id: dto.rowId },
    });
    if (!row || row.laboratoryId !== dto.laboratoryId) {
      throw new BadRequestException({ code: 'INVALID_ROW', message: 'La rangée sélectionnée n’appartient pas à ce laboratoire' });
    }

    const componentTypes = await this.prisma.componentType.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const machine = await this.prisma.$transaction(async (tx) => {
      const created = await tx.machine.create({
        data: {
          laboratoryId: dto.laboratoryId,
          rowId: dto.rowId,
          code,
          name: dto.name.trim(),
          positionInRow: dto.positionInRow,
          brand: dto.brand?.trim(),
          model: dto.model?.trim(),
          serialNumber: dto.serialNumber?.trim(),
          acquisitionDate: dto.acquisitionDate ? new Date(`${dto.acquisitionDate}T00:00:00Z`) : null,
          specifications: dto.specifications?.trim(),
          photoPath: dto.photoPath,
          generalStatus: MachineStatus.FUNCTIONAL,
        },
      });

      // Création automatique de chaque composant par défaut
      if (componentTypes.length > 0) {
        await tx.machineComponent.createMany({
          data: componentTypes.map((ct) => ({
            machineId: created.id,
            componentTypeId: ct.id,
            state: ComponentState.FUNCTIONAL,
          })),
        });
      }

      return created;
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'MACHINE_CREATED',
      entityType: 'Machine',
      entityId: machine.id,
      after: { code: machine.code, publicToken: machine.publicToken },
      ip: ip ?? null,
    });

    return this.get(machine.id);
  }

  /**
   * Mise à jour technique d'une machine.
   * RÈGLE ABSOLUE : Le `publicToken` ne figure JAMAIS dans les champs modifiables.
   */
  async update(id: string, dto: UpdateMachineDto, actor: AuthUser, ip?: string | null) {
    const current = await this.prisma.machine.findUniqueOrThrow({ where: { id } });

    if (dto.code && dto.code.trim().toUpperCase() !== current.code) {
      const existing = await this.prisma.machine.findUnique({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (existing) {
        throw new ConflictException({ code: 'CODE_EXISTS', message: 'Ce code de machine est déjà utilisé' });
      }
    }

    const updated = await this.prisma.machine.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.rowId ? { rowId: dto.rowId } : {}),
        ...(dto.positionInRow !== undefined ? { positionInRow: dto.positionInRow } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand?.trim() } : {}),
        ...(dto.model !== undefined ? { model: dto.model?.trim() } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber?.trim() } : {}),
        ...(dto.acquisitionDate !== undefined
          ? { acquisitionDate: dto.acquisitionDate ? new Date(`${dto.acquisitionDate}T00:00:00Z`) : null }
          : {}),
        ...(dto.specifications !== undefined ? { specifications: dto.specifications?.trim() } : {}),
        ...(dto.photoPath !== undefined ? { photoPath: dto.photoPath } : {}),
        ...(dto.generalStatus ? { generalStatus: dto.generalStatus } : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'MACHINE_UPDATED',
      entityType: 'Machine',
      entityId: id,
      after: dto,
      ip: ip ?? null,
    });

    return updated;
  }

  /** Fiche technique interne complète (accessible aux techniciens et administrateurs). */
  async get(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        laboratory: { select: { id: true, code: true, name: true, building: true, location: true } },
        row: { select: { id: true, code: true, name: true, sortOrder: true } },
        lastControlBy: { select: { id: true, fullName: true } },
        components: {
          include: { componentType: true },
          orderBy: { componentType: { sortOrder: 'asc' } },
        },
        interventions: {
          orderBy: { reportedAt: 'desc' },
          take: 5,
          include: {
            technician: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: 'Machine introuvable' });
    }

    return machine;
  }

  /**
   * Consultation publique par scan QR code : /m/:publicToken
   * Strictement en lecture seule, aucune information sensible ou administrative divulguée.
   */
  async getPublicByToken(publicToken: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { publicToken },
      select: {
        id: true,
        code: true,
        name: true,
        positionInRow: true,
        brand: true,
        model: true,
        specifications: true,
        generalStatus: true,
        lastControlAt: true,
        photoPath: true,
        laboratory: {
          select: { code: true, name: true, building: true, location: true },
        },
        row: {
          select: { code: true, name: true },
        },
        components: {
          select: {
            state: true,
            notes: true,
            componentType: { select: { code: true, name: true, sortOrder: true } },
          },
          orderBy: { componentType: { sortOrder: 'asc' } },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException({
        code: 'QR_INVALID_OR_NOT_FOUND',
        message: 'Ce QR Code est invalide ou la machine a été retirée du parc.',
      });
    }

    const missingComponents = machine.components
      .filter((c) => c.state === ComponentState.MISSING)
      .map((c) => c.componentType.name);

    const defectiveComponents = machine.components
      .filter((c) => c.state === ComponentState.DEFECTIVE)
      .map((c) => c.componentType.name);

    const toCheckComponents = machine.components
      .filter((c) => c.state === ComponentState.TO_CHECK)
      .map((c) => c.componentType.name);

    return {
      code: machine.code,
      name: machine.name,
      laboratory: machine.laboratory.name,
      building: machine.laboratory.building,
      location: machine.laboratory.location,
      row: machine.row.name,
      position: machine.positionInRow,
      brand: machine.brand,
      model: machine.model,
      specifications: machine.specifications,
      generalStatus: machine.generalStatus,
      lastControlAt: machine.lastControlAt,
      components: machine.components.map((c) => ({
        name: c.componentType.name,
        code: c.componentType.code,
        state: c.state,
      })),
      missingComponents,
      defectiveComponents,
      toCheckComponents,
    };
  }

  /** Génération de l'image PNG haute résolution du QR Code individuel permanent. */
  async generateQrPng(machineId: string): Promise<Buffer> {
    const machine = await this.prisma.machine.findUniqueOrThrow({ where: { id: machineId } });
    const baseUrl = process.env.APP_BASE_URL ?? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',')[0].trim() : 'http://localhost:5173');
    const publicUrl = `${baseUrl}/m/${machine.publicToken}`;
    return QRCode.toBuffer(publicUrl, {
      width: 400,
      margin: 2,
      color: { dark: UPL_INK, light: '#FFFFFF' },
    });
  }

  /** Signalement public direct d'un incident par scan du QR Code de la machine. */
  async reportPublicIssue(publicToken: string, dto: ReportIssueDto, ip?: string | null) {
    const machine = await this.prisma.machine.findUnique({
      where: { publicToken },
      include: { row: { include: { laboratory: true } } },
    });
    if (!machine) {
      throw new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: 'Machine introuvable' });
    }

    const descriptionWithContact = dto.contact?.trim()
      ? `${dto.description.trim()}\n\n[Signalé par : ${dto.contact.trim()}]`
      : dto.description.trim();

    const intervention = await this.prisma.technicalIntervention.create({
      data: {
        machineId: machine.id,
        title: dto.title.trim(),
        description: descriptionWithContact,
        priority: 'MEDIUM',
        status: 'REPORTED',
      },
    });

    if (machine.generalStatus === 'FUNCTIONAL') {
      await this.prisma.machine.update({
        where: { id: machine.id },
        data: { generalStatus: 'TO_CHECK' },
      });
    }

    await this.audit.log({
      actorId: null,
      action: 'PUBLIC_ISSUE_REPORTED',
      entityType: 'TechnicalIntervention',
      entityId: intervention.id,
      after: {
        machineCode: machine.code,
        title: dto.title,
        laboratory: machine.row.laboratory.name,
      },
      ip: ip ?? null,
    });

    return {
      success: true,
      message: 'Votre signalement a été transmis avec succès au service informatique.',
      interventionId: intervention.id,
    };
  }

  /**
   * Enregistrement certifié d'un contrôle technique composant par composant.
   * L'historique est conservé de manière immuable dans MachineControl (append-only).
   */
  async performControl(machineId: string, dto: PerformControlDto, actor: AuthUser, ip?: string | null) {
    const machine = await this.prisma.machine.findUniqueOrThrow({
      where: { id: machineId },
      include: {
        components: { include: { componentType: true } },
      },
    });

    // Calcul automatique du nouvel état général
    let calculatedStatus: MachineStatus = MachineStatus.FUNCTIONAL;
    const hasDefective = dto.components.some((c) => c.state === ComponentState.DEFECTIVE);
    const hasMissingOrCheck = dto.components.some(
      (c) => c.state === ComponentState.MISSING || c.state === ComponentState.TO_CHECK,
    );

    if (machine.generalStatus === MachineStatus.MAINTENANCE || machine.generalStatus === MachineStatus.OUT_OF_SERVICE) {
      calculatedStatus = machine.generalStatus;
    } else if (hasDefective) {
      calculatedStatus = MachineStatus.DEFECTIVE;
    } else if (hasMissingOrCheck) {
      calculatedStatus = MachineStatus.TO_CHECK;
    } else {
      calculatedStatus = MachineStatus.FUNCTIONAL;
    }

    const currentMap = new Map(machine.components.map((c) => [c.componentTypeId, c]));

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Création de l'enregistrement de contrôle immuable
      const control = await tx.machineControl.create({
        data: {
          machineId,
          technicianId: actor.id,
          generalStatus: calculatedStatus,
          observations: dto.observations,
          photoPath: dto.photoPath,
          ip: ip ?? null,
        },
      });

      // 2. Création des détails pour chaque composant
      for (const item of dto.components) {
        const cur = currentMap.get(item.componentTypeId);
        const compName = cur?.componentType.name ?? 'Composant';
        const prevState = cur?.state ?? ComponentState.NOT_APPLICABLE;

        await tx.machineControlDetail.create({
          data: {
            controlId: control.id,
            componentName: compName,
            previousState: prevState,
            newState: item.state,
            notes: item.notes,
          },
        });

        // Mise à jour de l'état actuel du composant sur la machine
        await tx.machineComponent.upsert({
          where: {
            machineId_componentTypeId: {
              machineId,
              componentTypeId: item.componentTypeId,
            },
          },
          update: {
            state: item.state,
            notes: item.notes,
          },
          create: {
            machineId,
            componentTypeId: item.componentTypeId,
            state: item.state,
            notes: item.notes,
          },
        });
      }

      // 3. Actualisation de la machine
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          generalStatus: calculatedStatus,
          lastControlAt: new Date(),
          lastControlById: actor.id,
        },
      });

      return { control, updatedMachine };
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'MACHINE_CONTROL_PERFORMED',
      entityType: 'MachineControl',
      entityId: result.control.id,
      after: {
        machineCode: machine.code,
        status: calculatedStatus,
        technician: actor.fullName,
      },
      ip: ip ?? null,
    });

    return result;
  }

  /** Historique chronologique des contrôles techniques d'une machine. */
  async getControlHistory(machineId: string) {
    return this.prisma.machineControl.findMany({
      where: { machineId },
      include: {
        technician: { select: { id: true, fullName: true, username: true } },
        details: true,
      },
      orderBy: { controlledAt: 'desc' },
    });
  }

  // --------------------------------------------------------------------------
  // GESTION DES INTERVENTIONS TECHNIQUES
  // --------------------------------------------------------------------------

  async listInterventions(query?: {
    status?: string;
    priority?: string;
    machineId?: string;
    labId?: string;
  }) {
    const where: Prisma.TechnicalInterventionWhereInput = {
      ...(query?.status ? { status: query.status as any } : {}),
      ...(query?.priority ? { priority: query.priority as any } : {}),
      ...(query?.machineId ? { machineId: query.machineId } : {}),
      ...(query?.labId ? { machine: { laboratoryId: query.labId } } : {}),
    };

    return this.prisma.technicalIntervention.findMany({
      where,
      include: {
        machine: {
          select: {
            id: true,
            code: true,
            name: true,
            laboratory: { select: { id: true, name: true, code: true } },
            row: { select: { code: true, name: true } },
          },
        },
        technician: { select: { id: true, fullName: true } },
        reportedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ priority: 'desc' }, { reportedAt: 'desc' }],
    });
  }

  async createIntervention(dto: CreateInterventionDto, actor: AuthUser, ip?: string | null) {
    const machine = await this.prisma.machine.findUniqueOrThrow({ where: { id: dto.machineId } });

    const intervention = await this.prisma.technicalIntervention.create({
      data: {
        machineId: dto.machineId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        priority: dto.priority,
        technicianId: dto.technicianId,
        reportedById: actor.id,
        status: dto.technicianId ? 'IN_PROGRESS' : 'REPORTED',
        startedAt: dto.technicianId ? new Date() : null,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'INTERVENTION_CREATED',
      entityType: 'TechnicalIntervention',
      entityId: intervention.id,
      after: { machineCode: machine.code, title: intervention.title, priority: intervention.priority },
      ip: ip ?? null,
    });

    return intervention;
  }

  async updateIntervention(id: string, dto: UpdateInterventionDto, actor: AuthUser, ip?: string | null) {
    const current = await this.prisma.technicalIntervention.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.technicalIntervention.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.description ? { description: dto.description.trim() } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.technicianId !== undefined ? { technicianId: dto.technicianId } : {}),
        ...(dto.resolutionReport !== undefined ? { resolutionReport: dto.resolutionReport?.trim() } : {}),
        ...(dto.replacedParts !== undefined ? { replacedParts: dto.replacedParts?.trim() } : {}),
        ...(dto.status === 'IN_PROGRESS' && !current.startedAt ? { startedAt: new Date() } : {}),
        ...(dto.status === 'RESOLVED' && !current.resolvedAt ? { resolvedAt: new Date() } : {}),
        ...(dto.status === 'CLOSED' && !current.closedAt ? { closedAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'INTERVENTION_UPDATED',
      entityType: 'TechnicalIntervention',
      entityId: id,
      after: dto,
      ip: ip ?? null,
    });

    return updated;
  }
}
